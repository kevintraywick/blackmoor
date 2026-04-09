import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { query } from './db';
import { ensureSchema } from './schema';
import { canSpend, record } from './spend';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_COST_PER_MTOK = 0.02; // $0.02 per million tokens
const BATCH_SIZE = 100;

interface ChunkInput {
  source_type: string;
  source_id: string;
  chunk_text: string;
}

interface SearchResult {
  chunk_text: string;
  source_type: string;
  source_id: string;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isPgvectorAvailable(): Promise<boolean> {
  try {
    await ensureSchema();
    const rows = await query<{ pgvector_available: boolean }>(
      `SELECT pgvector_available FROM raven_world_ai_state WHERE campaign_id = 'default'`,
    );
    if (rows.length === 0) return false;
    return rows[0].pgvector_available;
  } catch {
    return false;
  }
}

async function markPgvectorUnavailable(): Promise<void> {
  try {
    await query(
      `UPDATE raven_world_ai_state SET pgvector_available = false, updated_at = now() WHERE campaign_id = 'default'`,
    );
  } catch {
    // Best-effort — if we can't even update state, the flag stays stale
    // but every operation already catches table-missing errors.
  }
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/** Rough BPE token estimate: ~4 chars per token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Format a float[] as a pgvector literal string '[0.1,0.2,...]'. */
function vecLiteral(embedding: number[]): string {
  return '[' + embedding.join(',') + ']';
}

// ---------------------------------------------------------------------------
// Core exports
// ---------------------------------------------------------------------------

/**
 * Embed an array of chunks and upsert them into the raven_world_ai_corpus table.
 * Silent no-op when pgvector is unavailable, API key is missing, or budget is exhausted.
 */
export async function embedChunks(chunks: ChunkInput[]): Promise<void> {
  if (chunks.length === 0) return;

  try {
    if (!(await isPgvectorAvailable())) return;
    if (!(await canSpend('openai_embeddings'))) return;

    const client = getOpenAIClient();
    if (!client) return;

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.chunk_text);

      // Estimate cost and check budget before each batch
      const totalTokens = texts.reduce((sum, t) => sum + estimateTokens(t), 0);

      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });

      // Delete old rows for these (source_type, source_id) pairs, then insert
      // Group by source_type for efficient deletes
      const byType = new Map<string, string[]>();
      for (const chunk of batch) {
        const ids = byType.get(chunk.source_type) ?? [];
        ids.push(chunk.source_id);
        byType.set(chunk.source_type, ids);
      }

      for (const [sourceType, sourceIds] of byType) {
        await query(
          `DELETE FROM raven_world_ai_corpus WHERE source_type = $1 AND source_id = ANY($2::text[])`,
          [sourceType, sourceIds],
        );
      }

      // Insert new rows
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = response.data[j].embedding;
        await query(
          `INSERT INTO raven_world_ai_corpus (id, source_type, source_id, chunk_text, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            randomUUID(),
            chunk.source_type,
            chunk.source_id,
            chunk.chunk_text,
            vecLiteral(embedding),
          ],
        );
      }

      // Record spend — use actual usage from API if available, otherwise estimate
      const actualTokens = response.usage?.total_tokens ?? totalTokens;
      const costUsd = (actualTokens / 1_000_000) * EMBEDDING_COST_PER_MTOK;
      await record({
        service: 'openai_embeddings',
        amount_usd: costUsd,
        units: actualTokens,
        unit_kind: 'tokens',
        details: { model: EMBEDDING_MODEL, chunks: batch.length },
      });
    }
  } catch (err: unknown) {
    // If the corpus table doesn't exist, mark pgvector unavailable
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('raven_world_ai_corpus') || msg.includes('does not exist') || msg.includes('vector')) {
      console.warn('embedChunks: pgvector table missing — marking unavailable:', msg);
      await markPgvectorUnavailable();
      return;
    }
    console.error('embedChunks failed:', msg);
  }
}

/**
 * Bootstrap the full corpus from all source tables. Reads journals, journey
 * entries, raven items, and player sheet text fields, then embeds everything.
 * Silent no-op when pgvector is unavailable.
 */
export async function bootstrapCorpus(): Promise<void> {
  try {
    if (!(await isPgvectorAvailable())) {
      console.warn('bootstrapCorpus: pgvector not available — skipping');
      return;
    }

    await ensureSchema();
    const chunks: ChunkInput[] = [];

    // 1. Journal entries (DM private)
    const journals = await query<{ id: string; journal: string }>(
      `SELECT id, journal FROM sessions WHERE journal IS NOT NULL AND journal != '' ORDER BY number DESC`,
    );
    for (const row of journals) {
      chunks.push({ source_type: 'journal', source_id: row.id, chunk_text: row.journal });
    }

    // 2. Journey entries (public)
    const journeys = await query<{ id: string; journal_public: string }>(
      `SELECT id, journal_public FROM sessions WHERE journal_public IS NOT NULL AND journal_public != '' ORDER BY number DESC`,
    );
    for (const row of journeys) {
      chunks.push({ source_type: 'journey', source_id: row.id, chunk_text: row.journal_public });
    }

    // 3. Raven items
    const items = await query<{ id: string; text: string }>(
      `SELECT id, COALESCE(headline, '') || ' ' || body AS text FROM raven_items ORDER BY published_at DESC`,
    );
    for (const row of items) {
      const text = row.text.trim();
      if (text) {
        chunks.push({ source_type: 'raven_items', source_id: row.id, chunk_text: text });
      }
    }

    // 4. Player sheets
    const sheets = await query<{ id: string; text: string }>(
      `SELECT id, COALESCE(player_notes, '') || ' ' || COALESCE(general_notes, '') || ' ' || COALESCE(dm_notes, '') AS text
       FROM player_sheets WHERE id != 'dm'`,
    );
    for (const row of sheets) {
      const text = row.text.trim();
      if (text) {
        chunks.push({ source_type: 'player_sheet', source_id: row.id, chunk_text: text });
      }
    }

    if (chunks.length === 0) return;

    await embedChunks(chunks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('bootstrapCorpus failed:', msg);
  }
}

/**
 * Incremental embedding: only processes rows modified since `since`.
 * Player sheets are skipped (no reliable timestamp) — use bootstrapCorpus for those.
 */
export async function embedNewRows(since: Date): Promise<void> {
  try {
    if (!(await isPgvectorAvailable())) {
      console.warn('embedNewRows: pgvector not available — skipping');
      return;
    }

    await ensureSchema();
    const sinceMs = since.getTime();
    const chunks: ChunkInput[] = [];

    // Journals modified since
    const journals = await query<{ id: string; journal: string }>(
      `SELECT id, journal FROM sessions
       WHERE journal IS NOT NULL AND journal != ''
         AND last_modified >= $1
       ORDER BY number DESC`,
      [sinceMs],
    );
    for (const row of journals) {
      chunks.push({ source_type: 'journal', source_id: row.id, chunk_text: row.journal });
    }

    // Journey entries modified since
    const journeys = await query<{ id: string; journal_public: string }>(
      `SELECT id, journal_public FROM sessions
       WHERE journal_public IS NOT NULL AND journal_public != ''
         AND last_modified >= $1
       ORDER BY number DESC`,
      [sinceMs],
    );
    for (const row of journeys) {
      chunks.push({ source_type: 'journey', source_id: row.id, chunk_text: row.journal_public });
    }

    // Raven items published since
    const items = await query<{ id: string; text: string }>(
      `SELECT id, COALESCE(headline, '') || ' ' || body AS text FROM raven_items
       WHERE published_at >= $1
       ORDER BY published_at DESC`,
      [since.toISOString()],
    );
    for (const row of items) {
      const text = row.text.trim();
      if (text) {
        chunks.push({ source_type: 'raven_items', source_id: row.id, chunk_text: text });
      }
    }

    if (chunks.length === 0) return;

    await embedChunks(chunks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('embedNewRows failed:', msg);
  }
}

/**
 * Cosine similarity search against the corpus. Returns top K results.
 * Returns [] when pgvector is unavailable or API key is missing.
 */
export async function searchCorpus(queryText: string, topK: number = 5): Promise<SearchResult[]> {
  try {
    if (!(await isPgvectorAvailable())) return [];

    const client = getOpenAIClient();
    if (!client) return [];

    if (!(await canSpend('openai_embeddings'))) return [];

    // Embed the query
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: [queryText],
    });

    const queryEmbedding = response.data[0].embedding;

    // Record cost for the query embedding
    const actualTokens = response.usage?.total_tokens ?? estimateTokens(queryText);
    const costUsd = (actualTokens / 1_000_000) * EMBEDDING_COST_PER_MTOK;
    await record({
      service: 'openai_embeddings',
      amount_usd: costUsd,
      units: actualTokens,
      unit_kind: 'tokens',
      details: { model: EMBEDDING_MODEL, operation: 'search' },
    });

    // Cosine similarity search
    const rows = await query<SearchResult>(
      `SELECT chunk_text, source_type, source_id,
              1 - (embedding <=> $1::vector) AS similarity
       FROM raven_world_ai_corpus
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vecLiteral(queryEmbedding), topK],
    );

    return rows;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('raven_world_ai_corpus') || msg.includes('does not exist') || msg.includes('vector')) {
      console.warn('searchCorpus: pgvector table missing — marking unavailable:', msg);
      await markPgvectorUnavailable();
      return [];
    }
    console.error('searchCorpus failed:', msg);
    return [];
  }
}
