import { query } from './db';
import { ensureSchema } from './schema';
import { getMoonPhase } from './lunar';
import { getAstronomicalEvents } from './almanac';
import { getPlayers } from './getPlayers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageContext {
  /** Static system prompt blocks with cache_control for prompt caching */
  systemBlocks: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  }>;
  /** Variable campaign context -- changes each tick */
  userContent: string;
}

// ---------------------------------------------------------------------------
// System prompt (static, prompt-cached)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the World AI for a D&D 5e campaign called Blackmoor, run through a web app called Shadow of the Wolf. You propose in-fiction news beats for a broadsheet called The Raven Post.

OUTPUT FORMAT
Return a JSON array of idea seeds. Each seed is:
{ "category": string, "medium": "broadsheet" | "raven" | "sending" | "overheard" | "ad", "oneLiner": string, "targetPlayer"?: string, "confidence": number }
Return 5-10 seeds per tick.

CATEGORIES TO EXPLORE
- Weather omens
- Faction movement
- Political beats
- Economic beats
- Mentor news
- Skill-building hooks
- Guild news
- Mystery hooks
- Real-world parallels
- Callbacks (escalate or resolve earlier beats)
- Real-world ads (in-fiction parody ads for real products)

STYLE GUARDRAILS
- No modern idioms.
- No em-dashes.
- No AI-tells ("It's not just X, it's Y", "In a world where...").
- Period-appropriate prose. This is a medieval fantasy setting.
- Length caps per medium: broadsheet 80 words max, raven 60 words max, sending 25 words max, overheard 50 words max.

PII GUARDRAIL
Never include real-world player names. Use character names only (you will see them in the player sheets below). Player IDs like "ashton" or "brandon" are database identifiers. They are NOT character names and must never appear in your output.

CALLBACKS
When you see a theme from a recent published item, propose a seed that escalates or resolves it. This is the "three-clue rule": the same thread should surface in 2-3 different channels with different slants.

DM TEACHES YOU
Below you will find recent DM edits (original to edited). Learn from the edits to match the DM's voice. If no edits are shown, use your default style.

WHAT NOT TO PROPOSE
Do not repeat seeds that are already in the pending proposals list. Do not propose themes similar to expired proposals. The DM rejected those directions.`;

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface CampaignRow {
  name: string;
  world: string;
  raven_volume: number;
  raven_issue: number;
}

interface PlayerSheetRow {
  id: string;
  species: string;
  class: string;
  level: number;
  hp: number;
  ac: number;
  gold: number;
  player_notes: string | null;
  general_notes: string | null;
  dm_notes: string | null;
  align: string | null;
}

interface SessionRow {
  number: number;
  title: string;
  journal: string | null;
  journal_public: string | null;
}

interface RavenItemRow {
  medium: string;
  headline: string | null;
  body: string;
  trust: string;
  tags: string[];
  published_at: string;
}

interface ProposalRow {
  medium: string;
  body: string;
  reasoning: string | null;
}

interface EditDiffRow {
  body: string;
  original_body: string;
}

interface WeatherRow {
  condition: string;
  temp_c: number;
  wind_label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ---------------------------------------------------------------------------
// Main assembly
// ---------------------------------------------------------------------------

export async function assembleTriageContext(): Promise<TriageContext> {
  await ensureSchema();

  // Run all DB reads in parallel
  const [
    campaignRows,
    playerSheets,
    players,
    journalRows,
    journeyRows,
    recentItems,
    pendingProposals,
    expiredProposals,
    editDiffs,
    weatherRows,
  ] = await Promise.all([
    query<CampaignRow>(
      `SELECT name, world, raven_volume, raven_issue FROM campaign WHERE id = 'default'`
    ),
    query<PlayerSheetRow>(
      `SELECT id, species, class, level, hp, ac, gold, player_notes, general_notes, dm_notes, align
       FROM player_sheets WHERE id != 'dm' AND status = 'active'`
    ),
    getPlayers({ publicOnly: true }),
    query<SessionRow>(
      `SELECT number, title, journal FROM sessions
       WHERE journal IS NOT NULL AND journal != ''
       ORDER BY number DESC LIMIT 10`
    ),
    query<SessionRow>(
      `SELECT number, title, journal_public FROM sessions
       WHERE journal_public IS NOT NULL AND journal_public != ''
       ORDER BY number DESC LIMIT 10`
    ),
    query<RavenItemRow>(
      `SELECT medium, headline, body, trust, tags, published_at
       FROM raven_items ORDER BY published_at DESC LIMIT 20`
    ),
    query<ProposalRow>(
      `SELECT medium, body, reasoning FROM raven_world_ai_proposals
       WHERE status = 'pending' ORDER BY confidence DESC`
    ),
    query<ProposalRow>(
      `SELECT medium, body, reasoning FROM raven_world_ai_proposals
       WHERE status = 'expired' ORDER BY created_at DESC LIMIT 20`
    ),
    query<EditDiffRow>(
      `SELECT body, original_body FROM raven_world_ai_proposals
       WHERE status = 'published' AND original_body IS NOT NULL AND original_body != body
       ORDER BY proposed_at DESC LIMIT 5`
    ),
    query<WeatherRow>(
      `SELECT condition, temp_c, wind_label FROM raven_weather WHERE hex_id = 'default'`
    ),
  ]);

  // Build player ID -> character name map
  const charNameMap = new Map<string, string>();
  for (const p of players) {
    if (p.character) charNameMap.set(p.id, p.character);
  }

  // Assemble sections
  const sections: string[] = [];

  // 1. Campaign state
  if (campaignRows.length > 0) {
    const c = campaignRows[0];
    sections.push(
      `# Campaign\nCampaign: ${c.name}, World: ${c.world}, Volume ${c.raven_volume} Issue ${c.raven_issue}`
    );
  }

  // 2. Date + lunar phase
  const today = new Date();
  const moon = getMoonPhase(today);
  sections.push(
    `# Date and Moon\nToday: ${today.toISOString().slice(0, 10)}, Moon: ${moon.name} (${Math.round(moon.illumination * 100)}% illuminated). Next full moon: ${moon.nextFullMoon.toISOString().slice(0, 10)}`
  );

  // 3. Astronomical events
  const astroEvents = getAstronomicalEvents(30, today);
  if (astroEvents.length > 0) {
    const bullets = astroEvents.map(e => `- ${e.date}: ${e.event} -- ${e.description}`).join('\n');
    sections.push(`# Upcoming Astronomical Events (next 30 days)\n${bullets}`);
  }

  // 4. Current weather
  if (weatherRows.length > 0) {
    const w = weatherRows[0];
    sections.push(
      `# Current Weather\nCondition: ${w.condition}, Temperature: ${w.temp_c}C, Wind: ${w.wind_label}`
    );
  }

  // 5. Player characters
  if (playerSheets.length > 0) {
    const playerBlocks = playerSheets.map(ps => {
      const charName = charNameMap.get(ps.id) ?? ps.id;
      const lines = [
        `## ${charName}`,
        `Species: ${ps.species}, Class: ${ps.class}, Level: ${ps.level}`,
        `HP: ${ps.hp}, AC: ${ps.ac}, Gold: ${ps.gold}, Alignment: ${ps.align ?? 'unknown'}`,
      ];
      if (ps.player_notes) lines.push(`Player notes: ${truncate(ps.player_notes, 500)}`);
      if (ps.general_notes) lines.push(`Background: ${truncate(ps.general_notes, 500)}`);
      if (ps.dm_notes) lines.push(`DM notes: ${truncate(ps.dm_notes, 500)}`);
      return lines.join('\n');
    });
    sections.push(`# Player Characters\n${playerBlocks.join('\n\n')}`);
  }

  // 6. Recent journal entries
  if (journalRows.length > 0) {
    const entries = journalRows.map(
      s => `### Session ${s.number}: ${s.title}\n${truncate(s.journal!, 1000)}`
    );
    sections.push(`# Recent Journal Entries (DM private)\n${entries.join('\n\n')}`);
  }

  // 7. Recent journey entries
  if (journeyRows.length > 0) {
    const entries = journeyRows.map(
      s => `### Session ${s.number}: ${s.title}\n${truncate(s.journal_public!, 1000)}`
    );
    sections.push(`# Recent Journey Entries (player-facing)\n${entries.join('\n\n')}`);
  }

  // 8. Recently published raven items
  if (recentItems.length > 0) {
    const bullets = recentItems.map(
      r => `- ${r.medium}: ${r.headline ?? truncate(r.body, 80)}`
    );
    sections.push(`# Recently Published Raven Items\n${bullets.join('\n')}`);
  }

  // 9. Pending proposals
  if (pendingProposals.length > 0) {
    const bullets = pendingProposals.map(
      p => `- ${p.medium}: ${truncate(p.body, 100)}`
    );
    sections.push(`# Already Pending (do not duplicate)\n${bullets.join('\n')}`);
  }

  // 10. Expired proposals
  if (expiredProposals.length > 0) {
    const bullets = expiredProposals.map(
      p => `- ${p.medium}: ${truncate(p.body, 100)}`
    );
    sections.push(`# Expired (avoid similar)\n${bullets.join('\n')}`);
  }

  // 11. DM edit diffs
  if (editDiffs.length > 0) {
    const diffs = editDiffs.map(
      d => `Original: ${d.original_body}\nEdited to: ${d.body}`
    );
    sections.push(`# DM Edits (learn from these)\n${diffs.join('\n\n')}`);
  }

  return {
    systemBlocks: [
      {
        type: 'text' as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    userContent: sections.join('\n\n'),
  };
}
