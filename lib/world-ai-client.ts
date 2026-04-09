import Anthropic from '@anthropic-ai/sdk';

/**
 * Central factory for the World AI's Anthropic client.
 *
 * ## Spike findings (2026-04-08)
 *
 * The brainstorm spec proposed routing World AI through the "Claude Agent SDK
 * on a Max plan" for $0 API costs. Investigation:
 *
 * - `@anthropic-ai/claude-agent-sdk` v0.2.97 exists on npm. It is a
 *   programmatic wrapper around the Claude Code CLI — `query()` spawns
 *   a `claude` subprocess and inherits auth from the CLI's login state
 *   (browser-based OAuth or stored token).
 *
 * - There is no `apiKey` parameter or headless auth mode in the SDK.
 *   Auth is delegated entirely to the CLI process, which on first use
 *   opens a browser for OAuth consent. On a headless server (Railway),
 *   there is no browser — so no way to authenticate without manually
 *   planting a refresh token, which is unsupported and fragile.
 *
 * - Even if auth were solved, Max plan usage is rate-limited (not
 *   unlimited) and the SDK is designed for code-agent workflows
 *   (file editing, bash, MCP tools), not bare LLM completions.
 *   Using it for structured JSON generation would be fighting the tool.
 *
 * - A community package (`ai-sdk-provider-claude-code`) wraps the Agent
 *   SDK for Vercel AI SDK, but has the same CLI auth dependency.
 *
 * **Conclusion:** No viable headless server-side path exists today.
 * The standard API key path (`@anthropic-ai/sdk`) is the correct choice.
 * At projected costs ($8-10/mo with Haiku triage + Sonnet drafts +
 * prompt caching), this is well within the $19 soft cap.
 *
 * If Anthropic later ships a server-side token or service-account auth
 * mode for the Agent SDK, this is the single point to wire it in.
 *
 * ---
 *
 * Returns null if no API key is configured — callers must handle the
 * null case (silent degrade, matching lib/email.ts pattern).
 */

export type CostMode = 'api' | 'max_plan';

export interface WorldAiClient {
  client: Anthropic;
  costMode: CostMode;
}

export function getWorldAiClient(): WorldAiClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  return {
    client: new Anthropic({ apiKey }),
    costMode: 'api',
  };
}
