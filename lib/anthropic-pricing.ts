// Anthropic API pricing per million tokens, in USD.
// Source: https://www.anthropic.com/pricing as of 2026-04-08.
// Update this table when prices change.

export interface ModelPricing {
  input_per_mtok: number;
  output_per_mtok: number;
  cached_input_per_mtok: number; // 90% discount when prompt caching is hit
}

export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5-20251001': {
    input_per_mtok: 1.00,
    output_per_mtok: 5.00,
    cached_input_per_mtok: 0.10,
  },
  'claude-sonnet-4-5': {
    input_per_mtok: 3.00,
    output_per_mtok: 15.00,
    cached_input_per_mtok: 0.30,
  },
  'claude-opus-4-6': {
    input_per_mtok: 15.00,
    output_per_mtok: 75.00,
    cached_input_per_mtok: 1.50,
  },
};

/** Compute USD cost for a Claude call given token counts. Returns 0 for unknown models. */
export function anthropicCost(
  model: string,
  input_tokens: number,
  output_tokens: number,
  cached_input_tokens = 0,
): number {
  const p = ANTHROPIC_PRICING[model];
  if (!p) return 0;
  const input = Math.max(0, input_tokens);
  const output = Math.max(0, output_tokens);
  const cached = Math.max(0, Math.min(cached_input_tokens, input));
  const non_cached_input = input - cached;
  return (
    (non_cached_input / 1_000_000) * p.input_per_mtok +
    (cached / 1_000_000) * p.cached_input_per_mtok +
    (output / 1_000_000) * p.output_per_mtok
  );
}
