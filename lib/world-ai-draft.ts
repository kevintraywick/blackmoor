import { randomUUID } from 'crypto';
import { query } from './db';
import { ensureSchema } from './schema';
import { getWorldAiClient } from './world-ai-client';
import { canSpend, record } from './spend';
import { anthropicCost } from './anthropic-pricing';
import { searchCorpus } from './embeddings';
import { withRetry } from './retry';
import type { IdeaSeed } from './world-ai-triage';
import type { WorldAiProposal, RavenMedium } from './types';

const SONNET_MODEL = 'claude-sonnet-4-5';

/** Word count caps per medium. Enforced post-generation. */
const WORD_CAPS: Record<RavenMedium, number> = {
  broadsheet: 80,
  raven: 60,
  sending: 25,
  overheard: 50,
  ad: 60,
  cant: 25,
  druid_sign: 20,
};

const DRAFTING_SYSTEM_PROMPT = `You are a fantasy author writing an in-fiction news item for "The Raven Post," a D&D campaign broadsheet.

Given a one-line direction (the "seed"), relevant campaign context, and optionally web search results, write a single news item.

Return JSON: { "medium": "broadsheet"|"raven"|"sending"|"overheard"|"ad", "body": "...", "headline": "..." or null, "reasoning": "...", "tags": ["..."], "confidence": 0-100 }

Rules:
- "medium" must match the seed's medium
- "body" must be period-appropriate fantasy prose — no modern idioms, no em-dashes, no AI-tells
- "headline" is required for broadsheet, null for other mediums
- "reasoning" explains why you proposed this — what campaign fact it ties to, what thread it advances
- "tags" are entity names (NPCs, locations, factions) mentioned in the body
- "confidence" is your self-assessed quality (0 = guess, 100 = perfectly tied to campaign canon)
- Length caps: broadsheet ≤ 80 words, raven ≤ 60, sending ≤ 25, overheard ≤ 50
- For ravens: write as the NPC sender, in first person
- For sendings: cryptic, fragmentary, no greeting, no signature, ≤ 25 words exactly
- For overheards: in quotes, unreliable witness voice
- Reference specific NPCs, locations, and events from the campaign context by name
- If web search returned real-world inspiration, weave it into the fiction seamlessly`;

export interface DraftResult {
  proposal: WorldAiProposal;
  webSearchUsed: boolean;
}

/**
 * Pass 2: Sonnet drafting. Takes a single idea seed from the triage pass,
 * RAGs relevant campaign context, optionally runs a web search, and
 * produces a full proposal written to raven_world_ai_proposals.
 *
 * Silent-degrade on every path: returns null on missing client, budget
 * pause, parse failure, or DB write failure.
 */
export async function draftProposal(
  seed: IdeaSeed,
  tickId: string,
  promptVersion: number,
): Promise<DraftResult | null> {
  // 1. Get the client
  const wc = getWorldAiClient();
  if (!wc) return null;

  // 2. Budget gate
  if (!(await canSpend('anthropic'))) {
    console.log('draftProposal: skipped — anthropic budget paused');
    return null;
  }

  try {
    await ensureSchema();

    // 3. RAG — pgvector first, SQL fallback
    const ragChunks = await searchCorpus(seed.oneLiner, 5);
    let ragContext = '';

    if (ragChunks.length > 0) {
      ragContext = ragChunks
        .map((c) => `[${c.source_type}] ${c.chunk_text}`)
        .join('\n\n');
    } else {
      // Fallback: keyword search against session journals
      const keywords = extractKeywords(seed.oneLiner);
      if (keywords) {
        try {
          const rows = await query<{ id: string; journal: string }>(
            `SELECT id, journal FROM sessions
             WHERE journal ILIKE '%' || $1 || '%'
             ORDER BY number DESC LIMIT 5`,
            [keywords],
          );
          if (rows.length > 0) {
            ragContext = rows
              .map((r) => `[journal] ${r.journal}`)
              .join('\n\n');
          }
        } catch {
          // SQL fallback failed — proceed without context
        }
      }
    }

    // 4. Web search (capped at 10/day)
    let webSearchText = '';
    let webSearchUsed = false;

    const webCapRows = await query<{ total: number }>(
      `SELECT COALESCE(SUM(websearch_calls), 0) AS total
       FROM raven_world_ai_ticks
       WHERE ticked_at >= CURRENT_DATE`,
    );
    const dailyWebSearchCount = Number(webCapRows[0]?.total ?? 0);

    if (dailyWebSearchCount < 10 && (await canSpend('websearch'))) {
      try {
        const webResponse = await wc.client.messages.create({
          model: SONNET_MODEL,
          max_tokens: 400,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 1 }],
          messages: [{
            role: 'user',
            content: `Search for: ${seed.oneLiner} fantasy D&D inspiration`,
          }],
        });

        // Extract text from the response (may contain tool_use + tool_result blocks)
        for (const block of webResponse.content) {
          if (block.type === 'text') {
            webSearchText += block.text + '\n';
          }
        }
        webSearchText = webSearchText.trim();
        webSearchUsed = true;

        // Record web search cost
        const wsUsage = webResponse.usage;
        const wsCacheRead = wsUsage.cache_read_input_tokens ?? 0;
        if (wc.costMode === 'api') {
          const wsCost = anthropicCost(
            SONNET_MODEL,
            wsUsage.input_tokens,
            wsUsage.output_tokens,
            wsCacheRead,
          );
          await record({
            service: 'websearch',
            amount_usd: wsCost,
            units: 1,
            unit_kind: 'search',
            details: {
              model: SONNET_MODEL,
              seed: seed.oneLiner,
              input_tokens: wsUsage.input_tokens,
              output_tokens: wsUsage.output_tokens,
            },
          });
        }
      } catch (err) {
        console.warn('draftProposal: web search failed, continuing without:', err);
      }
    }

    // 5. Sonnet draft call
    const userContent = buildUserContent(seed, ragContext, webSearchText);

    const response = await withRetry(() => wc.client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 800,
      system: DRAFTING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }));

    const usage = response.usage;
    const cacheRead = usage.cache_read_input_tokens ?? 0;

    // Record Sonnet cost
    if (wc.costMode === 'api') {
      const cost = anthropicCost(SONNET_MODEL, usage.input_tokens, usage.output_tokens, cacheRead);
      await record({
        service: 'anthropic',
        amount_usd: cost,
        units: usage.input_tokens + usage.output_tokens,
        unit_kind: 'tok_total',
        details: {
          model: SONNET_MODEL,
          pass: 'draft',
          tick_id: tickId,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: cacheRead,
        },
      });
    }

    // 6. Parse response
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('draftProposal: no JSON found in Sonnet response');
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      console.warn('draftProposal: failed to parse JSON from Sonnet response');
      return null;
    }

    // Validate fields
    const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];
    const medium: RavenMedium = typeof parsed.medium === 'string' && VALID_MEDIA.includes(parsed.medium as RavenMedium)
      ? (parsed.medium as RavenMedium)
      : seed.medium;

    const rawBody = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    if (!rawBody) {
      console.warn('draftProposal: empty body in Sonnet response');
      return null;
    }

    // Enforce word count caps
    const body = truncateWords(rawBody, WORD_CAPS[medium] ?? 80);

    const headline = medium === 'broadsheet' && typeof parsed.headline === 'string'
      ? parsed.headline.trim() || null
      : null;

    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '';

    const tags: string[] = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];

    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
      : 50;

    // 7. Write to DB
    const proposalId = randomUUID();
    try {
      const rows = await query<WorldAiProposal>(
        `INSERT INTO raven_world_ai_proposals
           (id, medium, body, headline, reasoning, tags, confidence, prompt_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          proposalId,
          medium,
          body,
          headline,
          reasoning,
          tags,
          confidence,
          promptVersion,
        ],
      );

      if (rows.length === 0) {
        console.warn('draftProposal: INSERT returned no rows');
        return null;
      }

      return { proposal: rows[0], webSearchUsed };
    } catch (err) {
      console.error('draftProposal: DB write failed:', err);
      return null;
    }
  } catch (err) {
    console.error('draftProposal error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the first 2-3 significant words from a one-liner for SQL ILIKE fallback. */
function extractKeywords(oneLiner: string): string | null {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'that', 'this', 'from',
    'about', 'into', 'through', 'during', 'before', 'after',
  ]);

  const words = oneLiner
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

  if (words.length === 0) return null;
  return words.slice(0, 3).join(' ');
}

/** Truncate text to N words. */
function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

/** Build the user message for the Sonnet draft call. */
function buildUserContent(
  seed: IdeaSeed,
  ragContext: string,
  webSearchText: string,
): string {
  const parts: string[] = [];

  parts.push(`## Seed\n- Medium: ${seed.medium}\n- Direction: ${seed.oneLiner}\n- Category: ${seed.category}\n- Confidence: ${seed.confidence}`);

  if (seed.targetPlayer) {
    parts.push(`- Target player: ${seed.targetPlayer}`);
  }

  if (ragContext) {
    parts.push(`\n## Campaign Context (from corpus search)\n${ragContext}`);
  }

  if (webSearchText) {
    parts.push(`\n## Web Search Results\n${webSearchText}`);
  }

  parts.push('\nReturn your response as a single JSON object.');

  return parts.join('\n');
}
