// Run this once to create database tables.
// Called automatically on first API request if tables don't exist.
import { pool } from './db';
import { PLAYERS } from './players';
import { lookupNpcImage } from './npc-images';
import { lookupSrd } from './srd-hp';

// Memoize across the process lifetime — avoids DDL round-trip on every request
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = _initSchema();
  return schemaReady;
}

async function _initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      number      INTEGER NOT NULL DEFAULT 0,
      title       TEXT NOT NULL DEFAULT '',
      date        TEXT NOT NULL DEFAULT '',
      goal        TEXT NOT NULL DEFAULT '',
      scenes      TEXT NOT NULL DEFAULT '',
      npcs        TEXT NOT NULL DEFAULT '',
      locations   TEXT NOT NULL DEFAULT '',
      loose_ends  TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      last_modified BIGINT NOT NULL DEFAULT 0
    )
  `);

  // Player sheets — one row per player, gear stored as JSONB array
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_sheets (
      id             TEXT PRIMARY KEY,
      discord        TEXT NOT NULL DEFAULT '',
      species        TEXT NOT NULL DEFAULT '',
      class          TEXT NOT NULL DEFAULT '',
      level          TEXT NOT NULL DEFAULT '',
      hp             TEXT NOT NULL DEFAULT '',
      xp             TEXT NOT NULL DEFAULT '',
      speed          TEXT NOT NULL DEFAULT '',
      size           TEXT NOT NULL DEFAULT '',
      ac             TEXT NOT NULL DEFAULT '',
      boons          TEXT NOT NULL DEFAULT '',
      class_features TEXT NOT NULL DEFAULT '',
      species_traits TEXT NOT NULL DEFAULT '',
      player_notes   TEXT NOT NULL DEFAULT '',
      general_notes  TEXT NOT NULL DEFAULT '',
      gear           JSONB NOT NULL DEFAULT '[]'
    )
  `);

  // Add spells column if it doesn't exist yet (safe migration)
  await pool.query(`
    ALTER TABLE player_sheets
    ADD COLUMN IF NOT EXISTS spells JSONB NOT NULL DEFAULT '[]'
  `);

  // Legacy `maps` subsystem removed 2026-04-19. Map Builder (`map_builds`)
  // is the only image-map path going forward. Production table was empty at
  // removal time; prod DROP is handled by scripts/drop-legacy-maps.mjs.

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id             SERIAL PRIMARY KEY,
      title          TEXT        NOT NULL,
      price          INTEGER     NOT NULL,
      description    TEXT,
      stat_type      TEXT        CHECK (stat_type IN ('heal', 'magic', 'attack', 'damage')),
      stat_value     INTEGER,
      image_path     TEXT,
      in_marketplace BOOLEAN     NOT NULL DEFAULT false,
      created_at     TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS in_marketplace BOOLEAN NOT NULL DEFAULT false
  `);

  // Migrate stat_type constraint to include 'damage'.
  // ADD is .catch-guarded — the DROP+ADD is not atomic under HMR re-runs and
  // Postgres will error 42710 "already exists" if another concurrent init
  // slipped between the two statements.
  await pool.query(`
    ALTER TABLE items DROP CONSTRAINT IF EXISTS items_stat_type_check
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE items ADD CONSTRAINT items_stat_type_check
    CHECK (stat_type IN ('heal', 'magic', 'attack', 'damage'))
  `).catch(() => {});

  // Switch from boolean in_marketplace to integer marketplace_qty
  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS marketplace_qty INTEGER NOT NULL DEFAULT 0
  `);
  // Migrate existing in_marketplace = true rows to qty = 1 (only if still 0)
  await pool.query(`
    UPDATE items SET marketplace_qty = 1
    WHERE in_marketplace = true AND marketplace_qty = 0
  `);

  // Item type + type-specific columns
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS attack INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS damage INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS heal INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS rarity TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS attunement BOOLEAN DEFAULT false`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS level INTEGER`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS school TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS casting_time TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS range TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS components TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS duration TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS risk_percent INTEGER`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS npcs (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '',
      species    TEXT NOT NULL DEFAULT '',
      cr         TEXT NOT NULL DEFAULT '',
      hp         TEXT NOT NULL DEFAULT '',
      ac         TEXT NOT NULL DEFAULT '',
      speed      TEXT NOT NULL DEFAULT '',
      attacks    TEXT NOT NULL DEFAULT '',
      traits     TEXT NOT NULL DEFAULT '',
      actions    TEXT NOT NULL DEFAULT '',
      notes      TEXT NOT NULL DEFAULT '',
      image_path TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE npcs ADD COLUMN IF NOT EXISTS image_path TEXT
  `);
  await pool.query(`
    ALTER TABLE npcs ADD COLUMN IF NOT EXISTS hp_roll TEXT NOT NULL DEFAULT ''
  `);
  await pool.query(`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS gold TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS equipment TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS treasure TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Add npc_ids JSONB column to sessions for explicit NPC selection
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS npc_ids JSONB NOT NULL DEFAULT '[]'
  `);

  // Menagerie — per-session NPC instances with individual HP
  await pool.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS menagerie JSONB NOT NULL DEFAULT '[]'
  `);

  // Session lifecycle status — controlled by the Session Control Bar.
  // 'open'   = upcoming or in-progress, clock may be running
  // 'paused' = session paused, clock should be paused too
  // 'ended'  = session over, clock not auto-touched
  await pool.query(
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'`
  ).catch(() => {});

  // DM-only player fields
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS dm_notes TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);

  // Purchased marketplace items — separate from spells for future transfer
  await pool.query(`
    ALTER TABLE player_sheets
    ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'
  `);

  // Gold — currency for marketplace purchases
  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS gold TEXT NOT NULL DEFAULT '0'`);
  // Seed gold: level 3 players (levi, brandon) → 100, others → 50
  await pool.query(`
    UPDATE player_sheets SET gold = CASE
      WHEN id IN ('levi', 'brandon') THEN '100'
      ELSE '50'
    END
    WHERE gold = '0'
  `);

  // Repair any rows where npc_ids is not an array (e.g. {} from a bad default)
  await pool.query(`
    UPDATE sessions SET npc_ids = '[]'::jsonb
    WHERE jsonb_typeof(npc_ids) IS DISTINCT FROM 'array'
  `);

  // Ensure the column default is correct regardless of how it was first created
  await pool.query(`
    ALTER TABLE sessions ALTER COLUMN npc_ids SET DEFAULT '[]'::jsonb
  `);

  // Players table — dynamic player roster (seeded from static config)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      player_name TEXT NOT NULL DEFAULT '',
      character   TEXT NOT NULL DEFAULT '',
      initial     TEXT NOT NULL DEFAULT '',
      img         TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `);
  // Seed from static PLAYERS if table is empty
  const [{ count }] = await pool.query('SELECT COUNT(*)::int as count FROM players').then(r => r.rows);
  if (count === 0) {
    for (let i = 0; i < PLAYERS.length; i++) {
      const p = PLAYERS[i];
      await pool.query(
        `INSERT INTO players (id, player_name, character, initial, img, sort_order) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.playerName, p.character, p.initial, p.img, i]
      );
    }
  }

  // Backfill img for players with empty img — auto-link to /images/players/{id}.png
  await pool.query(
    `UPDATE players SET img = '/images/players/' || id || '.png' WHERE img = '' OR img IS NULL`
  );

  // Backfill image_path for existing NPCs that match a known image file.
  // Idempotent — only updates rows with empty image_path.
  // Uses the same lookupNpcImage() with partial matching so "Flameskull_2" → flameskull.png.
  const npcsToFill = await pool.query(
    `SELECT id, name FROM npcs WHERE image_path IS NULL OR image_path = ''`
  );
  for (const row of npcsToFill.rows) {
    const match = lookupNpcImage(row.name as string);
    if (match) {
      await pool.query(`UPDATE npcs SET image_path = $1 WHERE id = $2`, [match, row.id]);
    }
  }

  // Campaign — single-row campaign settings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign (
      id    TEXT PRIMARY KEY,
      name  TEXT NOT NULL DEFAULT '',
      world TEXT NOT NULL DEFAULT ''
    )
  `);
  // Seed a single campaign row if table is empty
  const [{ campaign_count }] = await pool.query(
    `SELECT COUNT(*)::int as campaign_count FROM campaign`
  ).then(r => r.rows);
  if (campaign_count === 0) {
    await pool.query(
      `INSERT INTO campaign (id, name, world) VALUES ('default', '', '')`
    );
  }

  // ── Campaign game clock ─────────────────────────────────────────────────────
  // The game clock is a campaign-wide singleton stored on the campaign row.
  // game_time_seconds is "seconds since campaign start"; presentation layer
  // formats it into an in-fiction date/time. clock_paused gates the only
  // mutator (lib/game-clock.ts::advanceGameTime).
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS game_time_seconds BIGINT NOT NULL DEFAULT 0`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS clock_paused BOOLEAN NOT NULL DEFAULT true`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS clock_last_advanced_at BIGINT NOT NULL DEFAULT 0`
  ).catch(() => {});

  // Magic catalog — DM's persistent reference library of spells, scrolls, magic items, and custom entries
  await pool.query(`
    CREATE TABLE IF NOT EXISTS magic_catalog (
      id          TEXT PRIMARY KEY,
      category    TEXT NOT NULL CHECK (category IN ('spell', 'scroll', 'magic_item', 'weapon', 'armor', 'tool', 'other')),
      name        TEXT NOT NULL,
      api_key     TEXT,
      description TEXT NOT NULL DEFAULT '',
      metadata    JSONB NOT NULL DEFAULT '{}',
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `);

  // Per-row image path — DM-uploadable card art for spells / magic items.
  await pool.query(
    `ALTER TABLE magic_catalog ADD COLUMN IF NOT EXISTS image_path TEXT NOT NULL DEFAULT ''`
  ).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS magic_catalog_created_at_idx
    ON magic_catalog (created_at DESC)
  `);
  // Deduplicate existing rows before adding unique constraint (keep one per key)
  await pool.query(`
    DELETE FROM magic_catalog
    WHERE api_key IS NOT NULL
      AND ctid NOT IN (
        SELECT MIN(ctid) FROM magic_catalog
        WHERE api_key IS NOT NULL
        GROUP BY category, api_key
      )
  `).catch(() => {});
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS magic_catalog_category_api_key_idx
    ON magic_catalog (category, api_key) WHERE api_key IS NOT NULL
  `).catch(() => {});

  // Seed Instruments of the Bards into magic_catalog if not already present
  const [{ bard_count }] = await pool.query(
    `SELECT COUNT(*)::int as bard_count FROM magic_catalog WHERE category = 'other' AND api_key LIKE 'seed:bard-%'`
  ).then(r => r.rows);
  if (bard_count === 0) {
    const bardInstruments = [
      { key: 'seed:bard-fochlucan-bandore', name: 'Fochlucan Bandore', description: 'An instrument of the bards, this bandore is an uncommon magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Entangle, Faerie Fire, Shillelagh, Speak with Animals.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-mac-fuirmidh-cittern', name: 'Mac-Fuirmidh Cittern', description: 'An instrument of the bards, this cittern is an uncommon magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Barkskin, Cure Wounds, Fog Cloud.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-doss-lute', name: 'Doss Lute', description: 'An instrument of the bards, this lute is an uncommon magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Animal Friendship, Protection from Energy (fire only), Protection from Poison.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-canaith-mandolin', name: 'Canaith Mandolin', description: 'An instrument of the bards, this mandolin is a rare magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Cure Wounds (3rd level), Dispel Magic, Protection from Energy (lightning only).\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-cli-lyre', name: 'Cli Lyre', description: 'An instrument of the bards, this lyre is a rare magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Stone Shape, Wall of Fire, Wind Wall.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-anstruth-harp', name: 'Anstruth Harp', description: 'An instrument of the bards, this harp is a very rare magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Control Weather, Cure Wounds (5th level), Wall of Thorns.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
      { key: 'seed:bard-ollamh-harp', name: 'Ollamh Harp', description: 'An instrument of the bards, this harp is a legendary magic item requiring attunement by a bard. A creature that attempts to play the instrument without being attuned to it must succeed on a DC 15 Wisdom saving throw or take 2d4 psychic damage.\n\nYou can use an action to play the instrument and cast one of its spells: Fly, Invisibility, Levitate, Protection from Evil and Good, Confusion, Control Weather, Fire Storm.\n\nOnce the instrument has been used to cast a spell, it can\'t be used to cast that spell again until the next dawn.' },
    ];
    for (const inst of bardInstruments) {
      await pool.query(
        `INSERT INTO magic_catalog (id, category, name, api_key, description, metadata)
         VALUES (gen_random_uuid()::text, 'other', $1, $2, $3, '{}')
         ON CONFLICT (category, api_key) WHERE api_key IS NOT NULL DO NOTHING`,
        [inst.name, inst.key, inst.description]
      );
    }
  }

  // ── Availability (Can you play?) ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability (
      player_id TEXT NOT NULL,
      saturday  TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT 'in',
      PRIMARY KEY (player_id, saturday)
    )
  `).catch(() => {});

  // Quorum threshold on campaign row
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS quorum INTEGER NOT NULL DEFAULT 5
  `).catch(() => {});

  // DM email for quorum notifications
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS dm_email TEXT NOT NULL DEFAULT ''
  `).catch(() => {});

  // Track which Saturdays have already triggered a quorum notification
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS quorum_notified JSONB NOT NULL DEFAULT '[]'
  `).catch(() => {});

  // Site description for Discord embeds / meta tags
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
  `).catch(() => {});

  // Campaign background / backstory
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS background TEXT NOT NULL DEFAULT ''
  `).catch(() => {});

  // Active home splash + campaign banner paths. Empty string means "use the
  // committed default in public/images/...". Uploaded replacements live on the
  // persistent disk at DATA_DIR/uploads/splash/ and are served via
  // /api/uploads/splash/[filename].
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS home_splash_path TEXT NOT NULL DEFAULT ''
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE campaign ADD COLUMN IF NOT EXISTS home_banner_path TEXT NOT NULL DEFAULT ''
  `).catch(() => {});

  // ── Invitations (shareable availability polls) ─────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      slug TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      dates JSONB NOT NULL DEFAULT '[]',
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::bigint)
    )
  `).catch(() => {});

  // ── DM Messages ────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id         TEXT PRIMARY KEY,
      player_id  TEXT NOT NULL,
      message    TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      read       BOOLEAN NOT NULL DEFAULT false
    )
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS dm_messages_player_id_idx
    ON dm_messages (player_id, created_at DESC)
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS poison_status (
      id          TEXT PRIMARY KEY,
      player_id   TEXT NOT NULL,
      poison_type TEXT NOT NULL DEFAULT 'Poisoned',
      duration    TEXT NOT NULL DEFAULT 'long_rest',
      started_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      active      BOOLEAN NOT NULL DEFAULT true
    )
  `).catch(() => {});

  // ── Session Events (session lifecycle logging) ──────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_events (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id  TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      payload     JSONB NOT NULL DEFAULT '{}',
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS session_events_session_id_idx
    ON session_events (session_id, created_at DESC)
  `).catch(() => {});

  // ── Player Change Notifications ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_changes (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      player_id   TEXT NOT NULL,
      field       TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      read        BOOLEAN NOT NULL DEFAULT false
    )
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS player_changes_unread_idx
    ON player_changes (read, created_at DESC)
  `).catch(() => {});

  // ── Player Presence (online indicator) ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_presence (
      player_id  TEXT PRIMARY KEY,
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  // Ability scores — the six core D&D attributes
  for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS ${ab} TEXT NOT NULL DEFAULT ''`).catch(() => {});
  }

  await pool.query(`ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS align TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Session tracking — link boons/poisons to sessions
  await pool.query(`ALTER TABLE player_boons ADD COLUMN IF NOT EXISTS session_id TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE player_boons ADD COLUMN IF NOT EXISTS dm_notes TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE poison_status ADD COLUMN IF NOT EXISTS session_id TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE poison_status ADD COLUMN IF NOT EXISTS poison_name TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE poison_status ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Session lifecycle timestamps
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_at BIGINT`).catch(() => {});
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at BIGINT`).catch(() => {});
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS journal TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS journal_public TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS narrative_notes TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE campaign ADD COLUMN IF NOT EXISTS narrative_notes TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Journal audio — optional URL to an audio reading of the public journal /
  // "Our Story So Far…" backstory. Rendered as a speaker icon on the overlay.
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE campaign ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT ''`).catch(() => {});

  // Seed the 4 existing Shadow audio files if a session/campaign row is present
  // and no audio_url has been set yet. One-time — idempotent.
  await pool.query(
    `UPDATE campaign SET audio_url = '/audio/Shadow_Backstory.mp3' WHERE audio_url = ''`
  ).catch(() => {});
  await pool.query(
    `UPDATE sessions SET audio_url = '/audio/Shadow_Hunted.mp3' WHERE number = 1 AND audio_url = ''`
  ).catch(() => {});
  await pool.query(
    `UPDATE sessions SET audio_url = '/audio/Shadow_Graveyard.mp3' WHERE number = 2 AND audio_url = ''`
  ).catch(() => {});
  await pool.query(
    `UPDATE sessions SET audio_url = '/audio/Shadow_S3_The_Cliffhanger.mp3' WHERE number = 3 AND audio_url = ''`
  ).catch(() => {});

  // ── Map Builder tables ──────────────────────────────────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_builds (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT '',
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `);

  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS map_builds_session_id_idx ON map_builds (session_id)`
  ).catch(() => {});

  // Grid + scale metadata. Populated by Mappy AI on upload, refined by the
  // confirmation panel, and used by the viewer to enforce canonical screen scale.
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS grid_type       TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS hex_orientation TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS cell_size_px    INTEGER`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS scale_mode      TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS scale_value_ft  REAL`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS map_kind        TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_path      TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_width_px  INTEGER`).catch(() => {});
  await pool.query(`ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_height_px INTEGER`).catch(() => {});

  // Map workflow classification: 'local_map' (default — placed on a world hex)
  // or 'world_addition' (extends the singleton world map). NULL is treated as
  // 'local_map' for legacy rows.
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS map_role TEXT
     CHECK (map_role IN ('local_map', 'world_addition'))`
  ).catch(() => {});

  // World location anchor for local maps. NULL until the DM places the build
  // on a world hex via the picker. Updated in lockstep with world_hexes by
  // lib/world.ts::setHexLocalMap.
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS world_hex_q INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS world_hex_r INTEGER`
  ).catch(() => {});

  // Globe placement (snap-grid offset within the anchor hex). h3_cell holds
  // the anchor; offsets are signed integer grid units from hex center.
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS placement_offset_col INTEGER NOT NULL DEFAULT 0`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS placement_offset_row INTEGER NOT NULL DEFAULT 0`
  ).catch(() => {});
  // v3 #2 — hex-shaped placement at true km extent. Replaces the legacy
  // 30×30 snap grid with continuous km offsets from the hex centroid plus
  // a per-image scale multiplier (defaults to 1.0 = native km extent).
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS placement_offset_km_x DOUBLE PRECISION NOT NULL DEFAULT 0`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS placement_offset_km_y DOUBLE PRECISION NOT NULL DEFAULT 0`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS placement_scale DOUBLE PRECISION NOT NULL DEFAULT 1`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_build_levels (
      id          TEXT PRIMARY KEY,
      build_id    TEXT NOT NULL REFERENCES map_builds(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT 'Level 1',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      cols        INTEGER NOT NULL DEFAULT 100,
      rows        INTEGER NOT NULL DEFAULT 100,
      tiles       JSONB NOT NULL DEFAULT '{}',
      assets      JSONB NOT NULL DEFAULT '[]',
      images      JSONB NOT NULL DEFAULT '[]'
    )
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS map_build_levels_build_id_idx
    ON map_build_levels (build_id, sort_order)
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_build_bookmarks (
      id          TEXT PRIMARY KEY,
      build_id    TEXT NOT NULL REFERENCES map_builds(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      snapshot    JSONB NOT NULL DEFAULT '{}',
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS map_build_assets (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL CHECK (category IN ('wall', 'door', 'stairs', 'water', 'custom')),
      image_path  TEXT,
      is_builtin  BOOLEAN NOT NULL DEFAULT false,
      created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `).catch(() => {});

  // Seed built-in primitive assets
  const [{ builtin_count }] = await pool.query(
    `SELECT COUNT(*)::int as builtin_count FROM map_build_assets WHERE is_builtin = true`
  ).then(r => r.rows).catch(() => [{ builtin_count: 0 }]);
  if (builtin_count === 0) {
    const builtins = [
      { name: 'Wall', category: 'wall' },
      { name: 'Door', category: 'door' },
      { name: 'Stairs', category: 'stairs' },
      { name: 'Water', category: 'water' },
    ];
    for (const b of builtins) {
      await pool.query(
        `INSERT INTO map_build_assets (id, name, category, is_builtin)
         VALUES (gen_random_uuid()::text, $1, $2, true)
         ON CONFLICT DO NOTHING`,
        [b.name, b.category]
      ).catch(() => {});
    }
  }

  // ── World map tables ────────────────────────────────────────────────────────
  // The world map is the singleton spatial backbone of the campaign. It holds
  // reveal state per hex, anchors for local maps, and the moving entities
  // (storms, hordes, caravans, armies, other parties) that advance with the
  // campaign game clock.

  await pool.query(`
    CREATE TABLE IF NOT EXISTS world_map (
      id                TEXT PRIMARY KEY CHECK (id = 'default'),
      name              TEXT NOT NULL DEFAULT 'World',
      default_north_deg REAL NOT NULL DEFAULT 0,
      created_at        BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `).catch(() => {});

  // Seed the singleton row if absent
  await pool.query(
    `INSERT INTO world_map (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`
  ).catch(() => {});

  // Party position on the world map (for compass circle)
  await pool.query(
    `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_q INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_r INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_prev_q INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_prev_r INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_moved_at BIGINT`
  ).catch(() => {});

  // Sparse per-hex state. Only hexes the DM has interacted with (revealed,
  // mapped, or annotated) get a row. Missing row == unrevealed.
  // (q, r) are even-q offset coords matching lib/hex-math.ts.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS world_hexes (
      q                INTEGER NOT NULL,
      r                INTEGER NOT NULL,
      reveal_state     TEXT NOT NULL DEFAULT 'unrevealed'
                         CHECK (reveal_state IN ('unrevealed', 'revealed', 'mapped')),
      terrain_note     TEXT NOT NULL DEFAULT '',
      local_map_id     TEXT REFERENCES map_builds(id) ON DELETE SET NULL,
      weather_override TEXT,
      updated_at       BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      PRIMARY KEY (q, r)
    )
  `).catch(() => {});

  await pool.query(
    `ALTER TABLE world_hexes ADD COLUMN IF NOT EXISTS terrain_type TEXT`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE world_hexes ADD COLUMN IF NOT EXISTS terrain_rotation INTEGER NOT NULL DEFAULT 0`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS world_hexes_local_map_id_idx ON world_hexes (local_map_id) WHERE local_map_id IS NOT NULL`
  ).catch(() => {});

  // Moving entities on the world map. One table with a kind discriminator —
  // storms, hordes, caravans, armies, and "other parties" share the same
  // model: a current position, an optional waypoint path, and a cadence.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS world_entities (
      id                TEXT PRIMARY KEY,
      kind              TEXT NOT NULL CHECK (kind IN ('storm', 'horde', 'caravan', 'army', 'other_party')),
      label             TEXT NOT NULL DEFAULT '',
      current_q         INTEGER NOT NULL,
      current_r         INTEGER NOT NULL,
      waypoints         JSONB NOT NULL DEFAULT '[]',
      waypoint_index    INTEGER NOT NULL DEFAULT 0,
      seconds_per_step  BIGINT NOT NULL DEFAULT 21600,
      created_at        BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
      updated_at        BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS world_entities_position_idx ON world_entities (current_q, current_r)`
  ).catch(() => {});

  // ─── Ambience v1 — biome substrate + session forecast cache (R1, R3) ────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambience_hex_substrate (
      h3_cell      BIGINT PRIMARY KEY,
      h3_res       SMALLINT NOT NULL,
      koppen       TEXT NOT NULL,
      elevation_m  INTEGER NOT NULL,
      coastal      BOOLEAN NOT NULL,
      cw_latitude  REAL NOT NULL,
      seeded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ambience_hex_substrate_h3_res_idx ON ambience_hex_substrate (h3_res)`,
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambience_session_cache (
      session_id         TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      party_h3_cell      BIGINT NOT NULL,
      fetched_at_real    TIMESTAMPTZ NOT NULL DEFAULT now(),
      session_game_start BIGINT NOT NULL,
      forecast           JSONB NOT NULL
    )
  `).catch(() => {});

  // ─── H3 spatial substrate (v3 item #20) ──────────────────────────────────
  // Nullable `h3_cell BIGINT` + `h3_res SMALLINT` on every spatial table.
  // Reads still use (q,r) legacy coords; writes populate H3 alongside
  // starting in v3 item #50 (dual-write). Backfill is item #40.
  // See lib/h3.ts for cell ↔ bigint conversion helpers.
  for (const table of ['world_map', 'world_hexes', 'map_builds', 'world_entities', 'npcs']) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS h3_cell BIGINT`).catch(() => {});
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS h3_res  SMALLINT`).catch(() => {});
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${table}_h3_cell_idx ON ${table} (h3_cell) WHERE h3_cell IS NOT NULL`,
    ).catch(() => {});
  }

  // Backfill hp_roll (and empty stat fields) for existing NPCs from SRD.
  // Idempotent — only updates rows with empty hp_roll.
  // Strips _N suffixes and uses partial matching so "Ettercap_4" → "8d8+8".
  const npcsNeedingHpRoll = await pool.query(
    `SELECT id, name, ac, speed, cr FROM npcs WHERE hp_roll IS NULL OR hp_roll = ''`
  );
  for (const row of npcsNeedingHpRoll.rows) {
    const match = lookupSrd(row.name as string);
    if (match) {
      const sets: string[] = ['hp_roll = $1'];
      const vals: unknown[] = [match.hp];
      let i = 2;
      if (!row.ac) { sets.push(`ac = $${i}`); vals.push(match.ac); i++; }
      if (!row.speed) { sets.push(`speed = $${i}`); vals.push(match.speed); i++; }
      if (!row.cr) { sets.push(`cr = $${i}`); vals.push(match.cr); i++; }
      vals.push(row.id);
      await pool.query(`UPDATE npcs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    }
  }

  // ── Raven Post: budget tracker ─────────────────────────────────────────────
  // Two tables: per-service caps + paused flags, and an append-only ledger of
  // every charge from ElevenLabs / Anthropic / Twilio / Anthropic web search /
  // Railway. The ledger is the source of truth for month-to-date spend; the
  // caps row stores the soft cap and the hard kill-switch flag.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_budget_caps (
      service       TEXT PRIMARY KEY,
      soft_cap_usd  NUMERIC(10, 2) NOT NULL,
      paused        BOOLEAN NOT NULL DEFAULT false,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_spend_ledger (
      id            TEXT PRIMARY KEY,
      service       TEXT NOT NULL,
      amount_usd    NUMERIC(10, 4) NOT NULL,
      units         INTEGER,
      unit_kind     TEXT,
      details       JSONB,
      occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      ref_table     TEXT,
      ref_id        TEXT
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_spend_service_time
       ON raven_spend_ledger(service, occurred_at DESC)`
  ).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_spend_month
       ON raven_spend_ledger(date_trunc('month', occurred_at))`
  ).catch(() => {});

  // Seed the default soft caps once. ON CONFLICT keeps existing DM tweaks.
  await pool.query(`
    INSERT INTO raven_budget_caps (service, soft_cap_usd) VALUES
      ('elevenlabs', 5.00),
      ('anthropic',  8.00),
      ('twilio',     3.00),
      ('websearch',  3.00),
      ('railway',    0.00),
      ('openai_embeddings', 1.00),
      ('noaa_gfs',   1.00)
    ON CONFLICT (service) DO NOTHING
  `).catch(() => {});

  // ── Raven Post: items, reads, overheard queue, weather, opt-in ─────────────
  // The whole feature lives behind the raven_* prefix. Items are unified
  // across mediums via a `medium` discriminator.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_items (
      id            TEXT PRIMARY KEY,
      medium        TEXT NOT NULL,
      body          TEXT NOT NULL,
      headline      TEXT,
      sender        TEXT,
      target_player TEXT,
      trust         TEXT NOT NULL DEFAULT 'official',
      tags          TEXT[] DEFAULT '{}',
      ad_image_url  TEXT,
      ad_real_link  TEXT,
      ad_real_copy  TEXT,
      newsie_mp3    TEXT,
      published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_medium ON raven_items(medium)`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_target ON raven_items(target_player) WHERE target_player IS NOT NULL`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_published ON raven_items(published_at DESC)`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_reads (
      player_id     TEXT NOT NULL,
      item_id       TEXT NOT NULL REFERENCES raven_items(id) ON DELETE CASCADE,
      read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, item_id)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_queue (
      id            TEXT PRIMARY KEY,
      location      TEXT NOT NULL,
      body          TEXT NOT NULL,
      trust         TEXT NOT NULL DEFAULT 'rumored',
      position      INTEGER NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_overheard_loc_pos ON raven_overheard_queue(location, position)`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_deliveries (
      player_id     TEXT NOT NULL,
      queue_id      TEXT NOT NULL REFERENCES raven_overheard_queue(id) ON DELETE CASCADE,
      delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, queue_id)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_triggers (
      player_id     TEXT NOT NULL,
      location      TEXT NOT NULL,
      last_at       TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (player_id, location)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_weather (
      hex_id        TEXT PRIMARY KEY,
      condition     TEXT NOT NULL DEFAULT 'clear',
      temp_c        INTEGER,
      wind_label    TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  // Seed the 'default' weather row so /api/weather/current always has something
  await pool.query(`
    INSERT INTO raven_weather (hex_id, condition, temp_c, wind_label)
    VALUES ('default', 'clear', 16, 'calm')
    ON CONFLICT (hex_id) DO NOTHING
  `).catch(() => {});

  // Structured wind columns for the banner ambient circles
  await pool.query(
    `ALTER TABLE raven_weather ADD COLUMN IF NOT EXISTS wind_dir_deg INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE raven_weather ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER`
  ).catch(() => {});

  // Player sheets gain SMS opt-in fields
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_phone TEXT`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_optin BOOLEAN NOT NULL DEFAULT false`
  ).catch(() => {});

  // HP tracking — current_hp tracks damage, max_hp is snapshotted at session/combat start
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS current_hp TEXT NOT NULL DEFAULT ''`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS max_hp TEXT NOT NULL DEFAULT ''`
  ).catch(() => {});

  // Campaign gains the broadsheet's Volume / Issue counter
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_volume INTEGER NOT NULL DEFAULT 1`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issue INTEGER NOT NULL DEFAULT 1`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issues_per_volume INTEGER NOT NULL DEFAULT 12`
  ).catch(() => {});

  // ── Raven Post: World AI engine ────────────────────────────────────────────
  // pgvector extension for embedding-based RAG. Silently fails on hosts
  // that don't support it — the embedding pipeline checks pgvector_available
  // at runtime and degrades to SQL-based context selection.
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`).catch(() => {
    console.log('pgvector extension not available — RAG will use SQL fallback');
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_world_ai_state (
      campaign_id        TEXT PRIMARY KEY,
      active_themes      TEXT[] DEFAULT '{}',
      paused             BOOLEAN NOT NULL DEFAULT false,
      pgvector_available BOOLEAN NOT NULL DEFAULT true,
      last_tick_at       TIMESTAMPTZ,
      next_tick_at       TIMESTAMPTZ,
      active_window_start TIME DEFAULT '18:00',
      active_window_end   TIME DEFAULT '23:00',
      daily_cap_ticks    INTEGER NOT NULL DEFAULT 4,
      daily_cap_drafts   INTEGER NOT NULL DEFAULT 12,
      daily_cap_websearch INTEGER NOT NULL DEFAULT 10,
      prompt_version     INTEGER NOT NULL DEFAULT 1,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  // Seed the singleton state row
  await pool.query(`
    INSERT INTO raven_world_ai_state (campaign_id)
    VALUES ('default')
    ON CONFLICT (campaign_id) DO NOTHING
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_world_ai_proposals (
      id                TEXT PRIMARY KEY,
      proposed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      medium            TEXT NOT NULL,
      body              TEXT NOT NULL,
      headline          TEXT,
      reasoning         TEXT NOT NULL,
      tags              TEXT[] DEFAULT '{}',
      confidence        INTEGER NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      pushdown_count    INTEGER NOT NULL DEFAULT 0,
      published_item_id TEXT REFERENCES raven_items(id),
      prompt_version    INTEGER NOT NULL DEFAULT 1,
      original_body     TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_proposals_status
       ON raven_world_ai_proposals(status, confidence DESC)`
  ).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_proposals_prompt_version
       ON raven_world_ai_proposals(prompt_version)`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_world_ai_ticks (
      id                   TEXT PRIMARY KEY,
      ticked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      trigger              TEXT NOT NULL,
      haiku_input_tokens   INTEGER,
      haiku_output_tokens  INTEGER,
      sonnet_input_tokens  INTEGER,
      sonnet_output_tokens INTEGER,
      websearch_calls      INTEGER NOT NULL DEFAULT 0,
      proposals_generated  INTEGER NOT NULL DEFAULT 0,
      cost_usd             NUMERIC(10, 4),
      notes                TEXT
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_world_ai_corpus (
      id            TEXT PRIMARY KEY,
      source_type   TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      chunk_text    TEXT NOT NULL,
      embedding     vector(1536),
      indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_corpus_source
       ON raven_world_ai_corpus(source_type, source_id)`
  ).catch(() => {});

  // ivfflat index — requires at least some rows to be present,
  // so we create it but it may need a REINDEX after bootstrapping.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_raven_corpus_embedding
      ON raven_world_ai_corpus
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10)
  `).catch(() => {});

  // Tag whether an item was DM-authored or World AI-authored
  await pool.query(
    `ALTER TABLE raven_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`
  ).catch(() => {});

  // Stamp each item with the issue it was published in
  await pool.query(
    `ALTER TABLE raven_items ADD COLUMN IF NOT EXISTS raven_volume INTEGER`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE raven_items ADD COLUMN IF NOT EXISTS raven_issue INTEGER`
  ).catch(() => {});

  // Raven Post real-world product directory — pool of D&D-adjacent products
  // the World AI can draw from when proposing real-world classifieds.
  // "Real" copy/link appear only in the ad-click modal; the broadsheet shows
  // only `in_fiction_copy` so the fiction is never broken on the page.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_ad_products (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      image_url       TEXT NOT NULL DEFAULT '',
      link            TEXT NOT NULL,
      tags            TEXT NOT NULL DEFAULT '',
      in_fiction_copy TEXT NOT NULL DEFAULT '',
      real_copy       TEXT NOT NULL DEFAULT '',
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_ad_products_active_tags
       ON raven_ad_products(active, tags)`
  ).catch(() => {});

  // Seed starter product: Chaos Engine dice set (dnddice.com).
  // DM can add more rows via the product directory UI (future pass).
  await pool.query(`
    INSERT INTO raven_ad_products (id, name, image_url, link, tags, in_fiction_copy, real_copy)
    VALUES (
      'chaos-engine-dice',
      'Chaos Engine Dice Set — Limited Edition',
      '/images/ads/dnddice_ad.jpg',
      'https://dnddice.com/products/chaos-engine-dice-set-limited-edition',
      'dice,amber,limited',
      'Chaos Engine Dice — amber cogs suspended in resin, each die a limited casting from the Artificer''s Hall.',
      'Limited-edition Chaos Engine polyhedral set from dnddice.com.'
    )
    ON CONFLICT (id) DO NOTHING
  `).catch(() => {});
  // Retire the earlier placeholder row if it was seeded on any dev DB.
  await pool.query(
    `DELETE FROM raven_ad_products WHERE id = 'dwarf-bone-dice'`
  ).catch(() => {});

  // ─── Raven Post broadsheet editor (Layout 1 v1) ─────────────────────────
  // section_id lets the renderer slot broadsheet items by explicit position
  // instead of brittle headline regex. Nullable so legacy rows survive.
  await pool.query(
    `ALTER TABLE raven_items ADD COLUMN IF NOT EXISTS section_id TEXT`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_section ON raven_items(section_id) WHERE section_id IS NOT NULL`
  ).catch(() => {});

  // One-time backfill: tag legacy broadsheet rows by headline match so the
  // renderer finds them via section_id after the migration.
  await pool.query(
    `UPDATE raven_items SET section_id = 'blood_moon'
       WHERE section_id IS NULL AND medium = 'broadsheet'
         AND headline ~* 'blood\\s*moon'`
  ).catch(() => {});
  await pool.query(
    `UPDATE raven_items SET section_id = 'crimson_moon'
       WHERE section_id IS NULL AND medium = 'broadsheet'
         AND headline ~* 'crimson\\s*moon'`
  ).catch(() => {});

  // Issue draft — one row per campaign, overwritten by the DM editor as
  // they type (debounced autosave). Wiped on publish (prose only), so
  // hero image / ad / QOTD carry over to the next issue as a starting
  // point.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_issue_draft (
      campaign_id            TEXT PRIMARY KEY,
      big_headline           TEXT NOT NULL DEFAULT '',
      col1_lead_headline     TEXT NOT NULL DEFAULT '',
      col1_lead_body         TEXT NOT NULL DEFAULT '',
      blood_moon_headline    TEXT NOT NULL DEFAULT '',
      blood_moon_body        TEXT NOT NULL DEFAULT '',
      crimson_moon_headline  TEXT NOT NULL DEFAULT '',
      crimson_moon_body      TEXT NOT NULL DEFAULT '',
      opinion_headline       TEXT NOT NULL DEFAULT '',
      opinion_body           TEXT NOT NULL DEFAULT '',
      hero_image_url         TEXT NOT NULL DEFAULT '',
      hero_caption           TEXT NOT NULL DEFAULT '',
      ad_product_id          TEXT,
      qotd_text              TEXT NOT NULL DEFAULT '',
      qotd_author            TEXT NOT NULL DEFAULT '',
      in_fiction_date        TEXT NOT NULL DEFAULT '',
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Published issues — front-page assembly record. One row per volume+issue
  // publish event. `raven_items` remains the prose log; this table stores
  // the non-prose pieces (hero image, caption, ad, QOTD, big headline) so
  // `/raven-post` can render the latest assembled issue without scanning
  // items for non-prose artifacts.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_issues (
      id                TEXT PRIMARY KEY,
      campaign_id       TEXT NOT NULL,
      volume            INTEGER NOT NULL,
      issue             INTEGER NOT NULL,
      big_headline      TEXT NOT NULL DEFAULT '',
      hero_image_url    TEXT NOT NULL DEFAULT '',
      hero_caption      TEXT NOT NULL DEFAULT '',
      ad_product_id     TEXT REFERENCES raven_ad_products(id),
      qotd_text         TEXT NOT NULL DEFAULT '',
      qotd_author       TEXT NOT NULL DEFAULT '',
      in_fiction_date   TEXT NOT NULL DEFAULT '',
      published_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (campaign_id, volume, issue)
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_issues_campaign_published
       ON raven_issues(campaign_id, published_at DESC)`
  ).catch(() => {});

  // Roadmap items — DB-backed so prod edits persist across deploys.
  // The `ladder` column is legacy (was 'shadow' | 'common'); all rows
  // are now 'common'. Column is kept for one release cycle before drop.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roadmap_items (
      id         SERIAL PRIMARY KEY,
      ladder     TEXT NOT NULL DEFAULT 'common' CHECK (ladder = 'common'),
      version    INTEGER NOT NULL,
      title      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('built', 'in_progress', 'planned')),
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  await pool.query(
    `DO $$
     BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage
                  WHERE table_name = 'roadmap_items' AND constraint_name = 'roadmap_items_ladder_check') THEN
         ALTER TABLE roadmap_items DROP CONSTRAINT roadmap_items_ladder_check;
         ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_ladder_check CHECK (ladder = 'common');
       END IF;
     END $$;`,
  ).catch(() => {});

  // API key validation — warn at startup if keys are missing or malformed
  const keyChecks: { name: string; prefix?: string; label: string }[] = [
    { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', label: 'World AI triage and drafting' },
    { name: 'ELEVENLABS_API_KEY', label: 'Newsie TTS audio' },
    { name: 'TWILIO_ACCOUNT_SID', prefix: 'AC', label: 'SMS notifications' },
    { name: 'TWILIO_AUTH_TOKEN', label: 'SMS notifications' },
  ];
  for (const { name, prefix, label } of keyChecks) {
    const val = process.env[name];
    if (!val) {
      console.warn(`⚠ ${name} is missing — ${label} will be disabled`);
    } else if (prefix && !val.startsWith(prefix)) {
      console.warn(`⚠ ${name} does not start with "${prefix}" — possible misconfiguration`);
    }
  }
}
