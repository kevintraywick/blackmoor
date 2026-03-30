---
title: "feat: Email DM when quorum is reached on Can You Play"
type: feat
status: active
date: 2026-03-30
---

# feat: Email DM when quorum is reached on Can You Play

## Overview

When a player marks themselves "in" on the /can-you-play page and that vote causes the quorum threshold to be met for a Saturday, send the DM an email notification. This is the app's first external service integration.

## Problem Frame

The DM currently has to manually check the availability page to see if enough players have confirmed. An email notification when quorum is reached closes the loop — the DM knows it's time to prep without visiting the site.

## Requirements Trace

- R1. When a PUT to /api/availability causes the "in" count for a Saturday to meet or exceed the quorum, send the DM an email
- R2. Do not send duplicate emails for the same Saturday (if a player toggles out and back in, don't re-notify)
- R3. Store the DM's email address in the campaign table, editable via the DM campaign settings page
- R4. Use Resend as the email provider (lightweight, single dependency, API-key auth)
- R5. Gracefully degrade — if email sending fails, the availability update must still succeed

## Scope Boundaries

- No player-facing email notifications (DM only)
- No email templates or rich HTML — plain text is fine for v1
- No email verification flow for the DM email address
- No retry/queue for failed sends — fire-and-forget with error logging

## Key Technical Decisions

- **Resend over SendGrid/SES/Postmark**: Simplest integration for a single-notification use case. One npm dependency, one env var, one API call. No SMTP config.
- **Campaign table for DM email**: Follows existing single-row settings pattern. Editable in the app without touching Railway env vars.
- **Dedup via `quorum_notified` column on availability**: Track per-Saturday whether the quorum notification has already fired. A simple TEXT column holding the saturday date, or a separate small table. Simplest: add a `quorum_notified` JSONB array on the campaign row storing saturday dates that have been notified.
- **Server-side quorum check in PUT handler**: After upserting availability, count "in" rows for that Saturday, compare against campaign.quorum. This moves quorum detection from client-only to server-side.

## Implementation Units

- [ ] **Unit 1: Add DM email to campaign table and settings UI**

  **Goal:** Store and edit the DM's email address in the campaign settings.

  **Requirements:** R3

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts` — add `dm_email TEXT NOT NULL DEFAULT ''` and `quorum_notified JSONB NOT NULL DEFAULT '[]'` columns to campaign
  - Modify: `lib/types.ts` — add `dm_email: string` and `quorum_notified: string[]` to Campaign interface
  - Modify: `app/api/campaign/route.ts` — accept `dm_email` in PATCH, validate as non-empty string (no strict email regex needed)
  - Modify: DM campaign settings page/component — add DM Email input field

  **Patterns to follow:**
  - Existing `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS` pattern in schema.ts with `.catch(() => {})`
  - Existing campaign PATCH handler for field validation
  - Existing input field patterns on DM settings pages

  **Verification:**
  - DM can enter an email on the campaign settings page
  - Email persists across page reloads
  - GET /api/campaign returns the dm_email field

- [ ] **Unit 2: Install Resend and add email sending utility**

  **Goal:** Add the Resend SDK and a small helper to send plain-text emails.

  **Requirements:** R4, R5

  **Dependencies:** None (can be done in parallel with Unit 1)

  **Files:**
  - Modify: `package.json` — add `resend` dependency
  - Create: `lib/email.ts` — export a `sendEmail({ to, subject, text })` function that wraps Resend. Returns silently on failure (console.error + swallow). No-ops if `RESEND_API_KEY` env var is missing.

  **Approach:**
  - `RESEND_API_KEY` env var, read via `process.env.RESEND_API_KEY`
  - The `from` address uses Resend's default onboarding sender (`onboarding@resend.dev`) or a configured domain
  - Fire-and-forget: await the send but catch errors without propagating

  **Patterns to follow:**
  - Existing env var convention (bare `process.env.X`)
  - Existing error logging pattern (`console.error`)

  **Verification:**
  - With a valid API key, calling `sendEmail()` delivers an email
  - With no API key, `sendEmail()` returns without error

- [ ] **Unit 3: Server-side quorum detection and email trigger in PUT handler**

  **Goal:** After upserting availability, check if quorum was just reached for that Saturday and send the DM an email if so.

  **Requirements:** R1, R2, R5

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `app/api/availability/route.ts` — after the upsert, query the "in" count for the Saturday, compare against quorum, check dedup, send email, mark notified

  **Approach:**
  - After the existing upsert query, run:
    1. Count availability rows WHERE saturday = $1 AND status = 'in'
    2. Fetch campaign row (quorum, dm_email, quorum_notified)
    3. If inCount >= quorum AND saturday NOT IN quorum_notified AND dm_email is non-empty:
       - Send email with subject like "Quorum reached for [formatted date]" and body listing who's in
       - Append saturday to quorum_notified JSONB array on campaign row
  - All of this happens after the PUT response could be sent, but for simplicity in v1, do it before responding (the Resend API call is fast, ~200ms)
  - Wrap the entire notification block in try/catch so availability updates never fail due to email issues

  **Test scenarios:**
  - Player marks "in" and quorum is reached → email sent, saturday added to quorum_notified
  - Player marks "in" but quorum was already reached → no email (dedup)
  - Player marks "in" but quorum not yet reached → no email
  - Player marks "out" → no email check needed (quorum can only be reached on "in" votes)
  - dm_email is empty → no email sent, no error
  - Resend API fails → availability still saved, error logged

  **Verification:**
  - Toggling the quorum-reaching vote sends exactly one email
  - Toggling out and back in for the same Saturday does not re-send
  - The availability PUT still returns 200 even if email fails

## Risks & Dependencies

- **Resend API key required**: The feature silently no-ops without it. Must be added as an env var on Railway.
- **Resend free tier**: 100 emails/day, 3000/month — more than sufficient for this use case (max ~3 emails per week).
- **quorum_notified cleanup**: The JSONB array will grow slowly (one entry per Saturday that hits quorum). Could be pruned periodically but not worth building for v1 — a year of weekly sessions is only ~52 entries.

## Sources & References

- Resend docs: https://resend.com/docs/send-with-nextjs
- Existing availability API: `app/api/availability/route.ts`
- Existing campaign API: `app/api/campaign/route.ts`
- Campaign schema: `lib/schema.ts` lines 242-257
