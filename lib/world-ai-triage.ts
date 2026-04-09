import { getWorldAiClient } from './world-ai-client';
import { canSpend, record } from './spend';
import { anthropicCost } from './anthropic-pricing';
import type { RavenMedium } from './types';
import type { TriageContext } from './world-ai-context';

export interface IdeaSeed {
  category: string;
  medium: RavenMedium;
  oneLiner: string;
  targetPlayer?: string;
  confidence: number; // 0–100
}

interface TriageResult {
  seeds: IdeaSeed[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
  };
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];

/**
 * Run Pass 1: Haiku triage. Reads the full campaign context (with the
 * static system prompt cached) and returns 5–10 idea seeds for Pass 2.
 *
 * Silent-degrade on failure: returns null on any error.
 */
export async function runTriage(context: TriageContext): Promise<TriageResult | null> {
  const wc = getWorldAiClient();
  if (!wc) return null;

  if (!(await canSpend('anthropic'))) {
    console.log('runTriage: skipped — anthropic budget paused');
    return null;
  }

  try {
    const message = await wc.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1500,
      system: context.systemBlocks,
      messages: [{ role: 'user', content: context.userContent }],
    });

    // Extract usage with cache_read_input_tokens (extension field)
    const usage = message.usage;
    const cacheRead = usage.cache_read_input_tokens ?? 0;

    // Record cost (only when using API key path)
    if (wc.costMode === 'api') {
      const cost = anthropicCost(HAIKU_MODEL, usage.input_tokens, usage.output_tokens, cacheRead);
      await record({
        service: 'anthropic',
        amount_usd: cost,
        units: usage.input_tokens + usage.output_tokens,
        unit_kind: 'tok_total',
        details: {
          model: HAIKU_MODEL,
          pass: 'triage',
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: cacheRead,
        },
      });
    }

    // Parse the JSON array of seeds from the response
    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('runTriage: no JSON array found in response');
      return {
        seeds: [],
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: cacheRead,
        },
      };
    }

    const raw: unknown[] = JSON.parse(jsonMatch[0]);

    // Validate and clean each seed
    const seeds: IdeaSeed[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;

      const medium = typeof s.medium === 'string' && VALID_MEDIA.includes(s.medium as RavenMedium)
        ? (s.medium as RavenMedium)
        : 'broadsheet';
      const confidence = typeof s.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(s.confidence)))
        : 50;
      const oneLiner = typeof s.oneLiner === 'string' ? s.oneLiner.trim() : '';
      const category = typeof s.category === 'string' ? s.category.trim() : 'unknown';

      if (!oneLiner) continue; // skip empty seeds

      seeds.push({
        category,
        medium,
        oneLiner,
        targetPlayer: typeof s.targetPlayer === 'string' ? s.targetPlayer : undefined,
        confidence,
      });
    }

    return {
      seeds: seeds.slice(0, 10), // cap at 10
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: cacheRead,
      },
    };
  } catch (err) {
    console.error('runTriage error:', err);
    return null;
  }
}
