# Common v2 — DM Identity Groundwork

**Date:** 2026-04-11
**Status:** ready (depends on Common v1 shipping first)
**Owner:** Kevin (@kevin / @thewolf)
**Estimate:** 3–4 days

## Goal

Introduce real DM identity into Blackmoor. Add the `dms` table, magic-link login via Resend, `/login` page, a stub `/dms/[handle]` portfolio page. **No multi-tenancy yet** — there is still exactly one campaign (Shadow), and everything scoped to that campaign continues to work against the singleton `campaign` row as it does today.

This version exists so Common v3 (the multi-tenancy refactor) has a DM identity to plug into. Splitting identity from multi-tenancy gives us a small, shippable unit that's easy to verify before the big refactor.

## Non-goals

- No multi-tenancy. `campaigns` table does not exist yet.
- No campaign slugs in URLs. `/dm/*` stays the way it is.
- No Common World tables, hexes, entities.
- No public signup. Login is gated to an env-var allowlist.

## Schema additions

```sql
CREATE TABLE IF NOT EXISTS dms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle            TEXT UNIQUE NOT NULL,             -- @thewolf (primary handle)
  chronicler_handle TEXT UNIQUE,                      -- @kevin (Chronicler identity)
  email             TEXT UNIQUE NOT NULL,
  display_name      TEXT NOT NULL DEFAULT '',
  tier              TEXT NOT NULL DEFAULT 'cartographer'
                    CHECK (tier IN ('cartographer','chronicler','loremaster')),
  created_at        BIGINT NOT NULL,
  last_seen_at      BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dm_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id      UUID NOT NULL REFERENCES dms(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS dm_magic_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  BIGINT NOT NULL,
  consumed_at BIGINT,
  created_at  BIGINT NOT NULL
);
```

All three tables go into `lib/schema.ts` as additive `CREATE TABLE IF NOT EXISTS` blocks. No existing tables are touched.

## Seed row

On first deploy of Common v2, seed one DM row:

```sql
INSERT INTO dms (handle, chronicler_handle, email, display_name, tier, created_at)
VALUES ('@thewolf', '@kevin', <CHRONICLER_EMAIL env>, 'Kevin', 'loremaster', <now>)
ON CONFLICT (handle) DO NOTHING;
```

`CHRONICLER_EMAIL` is an env var on Railway. Kevin sets it before deploy.

## Auth flow

### `/login` page

- Simple centered card, site aesthetic.
- Email input + "Send me a link" button.
- POST `/api/auth/magic-link`:
  - Validates the email is on the allowlist (env var `CHRONICLER_ALLOWED_EMAILS`, comma-separated).
  - Creates a `dm_magic_links` row with a 15-minute expiry and a random token.
  - Sends an email via `lib/email.ts` with a link to `/api/auth/consume?token=...`.
  - Returns 204 regardless (no email enumeration).

### `/api/auth/consume` endpoint

- Validates the token, checks expiry, marks consumed.
- Finds or creates the DM row.
- Creates a `dm_sessions` row with a 30-day expiry.
- Sets an `httpOnly` `Secure` `SameSite=Lax` cookie named `dm_session`.
- Redirects to `/dm` (which continues to behave exactly as it does today).

### `getDm()` server helper

`lib/auth.ts` (new) exposes:

```ts
export async function getDm(): Promise<DM | null>
export async function requireDm(): Promise<DM>  // throws / redirects
```

**Important — v2 does not yet enforce auth on `/dm/*` routes.** The helper exists; routes don't call it. The enforcement comes in v3 when multi-tenancy lands. This keeps v2 small and means the login is opt-in for now — Kevin can log in, his sessions start working, but Shadow continues to run as an implicitly-owned singleton until v3.

## Page surface

### `/login` — new

Card-style form, EB Garamond, warm parchment tones. Uses Resend per `lib/email.ts`. Matches DESIGN.md aesthetic.

### `/dms/[handle]` — new stub

Logged-in-only (per Kevin's Q9 answer). Renders:

- DM handle, display name, tier.
- Chronicler handle if set.
- "No campaigns yet" — v2 doesn't know about campaigns.
- Join date.

That's it. It's a placeholder that proves the route exists. v14 expands this into the full portfolio.

## ROADMAP.md updates

- Mark `common-v1` items `[x]` when v1 ships.
- Mark `common-v2` items `[ ]` (already done).

## Verification

- `npm run lint` — no new warnings in `app/login`, `app/dms`, `lib/auth.ts`, `app/api/auth/*`.
- `npx tsc --noEmit 2>&1 | grep -v ".next/types"` clean.
- `npm run build` succeeds.
- Magic link flow end-to-end: hit `/login`, submit email, receive email, click link, land on `/dm` with cookie set.
- `/dms/@thewolf` shows the stub page.
- `/dms/someone-else` returns 404.
- Visiting `/dms/@thewolf` while logged out redirects to `/login`.

## Rollback

All changes are additive. Drop the three new tables, remove the new files, and Shadow is back to pre-v2 state. The old singleton `campaign` row is untouched.

## Open questions

None. All decisions for v2 are settled.
