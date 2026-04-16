import Anthropic from '@anthropic-ai/sdk';
import { canSpend, record } from './spend';
import { anthropicCost } from './anthropic-pricing';
import type { RavenMedium } from './types';

interface DraftArgs {
  medium: RavenMedium;
  oneLineBeat: string;
  targetWords?: number;
}

interface DraftResult {
  headline: string | null;
  body: string;
}

const SYSTEM_PROMPTS: Record<RavenMedium, string> = {
  broadsheet: `You are the in-fiction editor of "The Raven Post," a fortnightly broadsheet in a fantasy D&D 5e setting. The DM gives you a one-line beat. Return JSON: { "headline": "...", "body": "..." }. Rules: headline ≤ 60 chars; body 2-4 sentences, 50-90 words; period-appropriate prose; never break the fiction; no modern idioms; never use em-dashes.`,
  raven: `You are an in-fiction NPC writing a sealed letter to a player character. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 1-3 sentences; intimate, urgent voice; period-appropriate; no modern idioms; never use em-dashes.`,
  sending: `You are the cryptic arcane voice of a magical Sending. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body MUST be ≤25 words exactly; cryptic, fragmentary, prophetic; no greeting, no signature; never break the fiction; never use em-dashes.`,
  overheard: `You are an in-fiction tavern gossip. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 1-3 sentences in quotes; an unreliable witness voice; period-appropriate; no modern idioms; never use em-dashes.`,
  ad: `You are the in-fiction copywriter for a Raven Post classified ad. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 2-3 sentences; period-appropriate; no real-world prices, links, or vendor names; never use em-dashes.`,
  cant: `You are encoding a message in Thieves' Cant — the secret coded language of rogues. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body ≤25 words; uses double meanings, trade jargon, and subtle signals; sounds like normal speech to outsiders; never use em-dashes.`,
  druid_sign: `You are inscribing a Druidic sign — the secret script of druids scratched into bark, stone, or earth. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body ≤20 words; terse, nature-symbolic, directional or warning; never use em-dashes.`,
};

export async function draftBeat({ medium, oneLineBeat, targetWords }: DraftArgs): Promise<DraftResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !oneLineBeat.trim()) return null;

  if (!(await canSpend('anthropic'))) {
    console.log('draftBeat: skipped — budget paused');
    return null;
  }

  const client = new Anthropic({ apiKey });
  const model = 'claude-haiku-4-5-20251001';

  try {
    let systemPrompt = SYSTEM_PROMPTS[medium];
    if (targetWords) {
      const lo = targetWords - 6;
      const hi = targetWords + 6;
      systemPrompt = systemPrompt.replace(
        /body \d+-\d+ sentences,?\s*\d+-\d+ words/,
        `body EXACTLY ${lo}–${hi} words (count carefully)`
      );
    }

    const message = await client.messages.create({
      model,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Beat: ${oneLineBeat.trim()}` }],
    });

    // Record the cost based on the reported token usage
    const usage = message.usage;
    if (usage) {
      const cost = anthropicCost(model, usage.input_tokens, usage.output_tokens);
      await record({
        service: 'anthropic',
        amount_usd: cost,
        units: usage.input_tokens + usage.output_tokens,
        unit_kind: 'tok_total',
        details: { model, medium, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
      });
    }

    // Pull the JSON blob out of the response
    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { headline?: string | null; body?: string };
    if (!parsed.body) return null;

    let body = parsed.body.trim();
    // Sending hard cap at 25 words
    if (medium === 'sending') {
      const words = body.split(/\s+/);
      if (words.length > 25) body = words.slice(0, 25).join(' ');
    }

    return {
      headline: parsed.headline?.trim() || null,
      body,
    };
  } catch (err) {
    console.error('draftBeat error:', err);
    return null;
  }
}
