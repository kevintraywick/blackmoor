# Raven Post World AI — Rollout Guide

## Required Environment Variables

### On the Railway app service

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | API key from console.anthropic.com. Billed per-token. |
| `OPENAI_API_KEY` | Recommended | For pgvector embeddings (text-embedding-3-small). Without this, RAG context selection falls back to SQL fuzzy match. |
| `WORLD_AI_CRON_SECRET` | Recommended | Shared secret for cron auth. Generate with `openssl rand -hex 32`. |
| `ELEVENLABS_API_KEY` | Optional | For newsie TTS audio on broadsheet items. |
| `TWILIO_ACCOUNT_SID` | Optional | For SMS push (Overheard at the library). |
| `TWILIO_AUTH_TOKEN` | Optional | Paired with ACCOUNT_SID. |
| `TWILIO_FROM` | Optional | Provisioned US phone number. |

### On the Railway cron service

| Variable | Required | Description |
|----------|----------|-------------|
| `WORLD_AI_CRON_SECRET` | **Yes** | Same value as the app service. |

## First-Time Setup Checklist

1. **Deploy the app** with all World AI code on `main` (or merge `feat/raven-post`)
2. **Set env vars** per the table above
3. **Verify schema**: hit any API route (e.g., `curl /api/campaign`) to trigger `ensureSchema()` — the World AI tables will be created automatically
4. **Bootstrap the corpus** (optional, recommended):
   ```bash
   curl -X POST https://<app-domain>/api/raven-post/world-ai/bootstrap
   ```
   This embeds all existing journal/journey/player data into pgvector for RAG. Takes ~30 seconds for a typical campaign. Costs ~$0.01 in OpenAI embeddings.
5. **Trigger a manual tick** to verify everything works:
   ```bash
   curl -X POST https://<app-domain>/api/raven-post/world-ai/tick
   ```
   Or use the "Generate now" button on `/dm/raven-post`.
6. **Set up Railway Cron**: follow `docs/railway-cron-setup.md`
7. **Review the first proposals** on `/dm/raven-post` — approve to publish, leave others to push down

## Budget Expectations

| Service | Monthly cost (estimate) | Notes |
|---------|------------------------|-------|
| Anthropic (Haiku triage) | ~$3.60 | 8 ticks/day with prompt caching |
| Anthropic (Sonnet drafts) | ~$6.50 | 1 draft per tick |
| Anthropic (web search) | ~$2.40 | 1 search per draft |
| OpenAI (embeddings) | ~$0.10 | Incremental, tiny deltas per tick |
| **Total** | **~$12.60** | Well under the $19 soft cap |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tick returns `{ skipped: true, reason: "paused" }` | Loop is paused | Click "Resume loop" on `/dm/raven-post` |
| Tick returns `{ skipped: true, reason: "budget" }` | Anthropic soft cap exceeded | Adjust cap at `/api/spend/caps` or wait for month reset |
| Tick returns `{ skipped: true, reason: "no_changes" }` | No campaign updates since last tick | Expected for auto ticks; manual ticks bypass this |
| No proposals after a tick | Haiku returned no seeds | Check `/api/raven-post/world-ai/ticks` for the notes field |
| Proposals have low quality | Prompt needs iteration | Edit the system prompt in `lib/world-ai-context.ts`, bump `prompt_version` on the state |
| pgvector warnings in logs | Extension not available | RAG falls back to SQL — functional but less rich context |
| `OPENAI_API_KEY` not set | Embeddings disabled | Bootstrap and incremental indexing silently skip; RAG falls back to SQL |

## Monitoring

- **Tick history**: `GET /api/raven-post/world-ai/ticks` — shows last 20 ticks with token counts, cost, and proposal counts
- **Spend**: `GET /api/spend/mtd` — month-to-date breakdown by service
- **Proposals**: `GET /api/raven-post/world-ai/proposals` — currently pending proposals
- **Published items**: `GET /api/raven-post/items` — all published items (filter by `source` column for world_ai vs manual)
