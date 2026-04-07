# Communications

External services and patterns used for notifications and messaging between the DM and players. Review this when building features that need to notify or communicate with users.

## Email — Resend

**Purpose:** Transactional notifications from the app to the DM (e.g., quorum reached/lost on "Can you play?" page).

**Provider:** [Resend](https://resend.com) (free tier — 100 emails/day, 3,000/month)

**Sender:** `Blackmoor <dm@kevintraywick.com>` (custom domain with SPF/DKIM configured via Hover DNS)

**Configuration:**
- `RESEND_API_KEY` env var on Railway (Blackmoor production service)
- `RESEND_FROM` env var optional — overrides the default sender address
- DM's email address stored in `campaign.dm_email`, editable at `/dm/campaign`

**Code:**
- `lib/email.ts` — `sendEmail({ to, subject, text })` helper. No-ops if API key is missing. Catches errors silently so calling code never fails.
- Currently used in `app/api/availability/route.ts` for quorum notifications

**Notes:**
- Free tier is sufficient for this project's volume
- Gmail may initially filter new senders — mark as "not spam" on first receive

## Discord — Planned

**Purpose:** Direct messaging between DM and players, and group notifications.

**Status:** Blocked on bot setup. `player_sheets.discord` column exists for storing Discord usernames. See `project_discord_dm_feature.md` in memory.

**Planned features:**
- Pixie emoji on character sheets to DM players via Discord bot
- Potential availability notifications pushed to Discord channel
