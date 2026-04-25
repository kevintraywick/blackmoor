// Shared TypeScript types used across the app

export interface Player {
  id: string;
  playerName: string;
  character: string;
  initial: string;
  img: string;
}

export interface WeaponItem {
  id: string;
  name: string;
  attack_bonus: string;
  damage: string;
  price: string;
}

export interface SpellItem {
  id: string;
  name: string;
  effect: string;
  action_type: string;
  range: string;
  components: string;
  duration: string;
}

export interface MarketplaceItem {
  id: string;                    // unique instance ID
  source_item_id: number;        // FK back to items table
  name: string;
  price: number;                 // purchase price (for resale/refund)
  image_path: string | null;
  stat_type: string | null;
  stat_value: number | null;
  purchased_at: string;          // ISO timestamp
}

// A player character sheet row in the DB
export interface PlayerSheet {
  id: string;              // e.g. 'levi'
  discord: string;
  sms_phone: string;
  sms_optin: boolean;
  species: string;
  class: string;
  level: string;
  hp: string;
  xp: string;
  speed: string;
  size: string;
  ac: string;
  gold: string;
  boons: string;
  class_features: string;
  species_traits: string;  // kept for DB compat, unused in UI
  player_notes: string;    // "Species Notes" in UI
  general_notes: string;   // "Background" in UI
  gear: WeaponItem[];      // "Weapons" in UI — stored as JSONB
  spells: SpellItem[];     // "Magic Spells or Items" — stored as JSONB
  items: MarketplaceItem[]; // Purchased marketplace items — stored as JSONB, transferable
  str: string;             // Ability scores
  dex: string;
  con: string;
  int: string;
  wis: string;
  cha: string;
  align: string;            // Alignment (e.g. 'CG', 'LN')
  current_hp: string;      // Current HP (snapshotted + decremented by DM)
  max_hp: string;          // Max HP snapshot (set at session/combat start)
  dm_notes: string;        // DM-only notes (not shown to player)
  status: string;          // 'active' | 'away' | 'removed'
}

export interface MenagerieEntry {
  npc_id: string;
  hp: number;
  maxHp?: number;
  label?: string;
  // Instance overrides — snapshotted from template on creation, editable per-instance
  species?: string;
  cr?: string;
  ac?: string;
  speed?: string;
  attacks?: string;
  traits?: string;
  actions?: string;
  notes?: string;
  gold?: string;
  equipment?: string;
  treasure?: string;
}

export interface Session {
  id: string;
  number: number;
  title: string;
  date: string;
  goal: string;
  scenes: string;
  npcs: string;
  locations: string;
  loose_ends: string;
  notes: string;
  npc_ids: string[];
  menagerie: MenagerieEntry[];
  terrain: string;
  sort_order: number;
  last_modified: number;
  started_at: number | null;
  ended_at: number | null;
  journal: string;
  journal_public: string;
  narrative_notes: string;
  audio_url: string;
}

export type GridType = 'square' | 'hex';
export type HexOrientation = 'flat' | 'pointy';

// Legacy `maps` subsystem types (DmNote / MapRow / PlayerMapRow) removed
// 2026-04-19. Map Builder (`map_builds`) is the single image-map path now.

export interface Campaign {
  id: string;
  name: string;
  world: string;
  quorum: number;
  dm_email: string;
  quorum_notified: string[];
  description: string;
  background: string;
  narrative_notes: string;
  home_splash_path: string;
  home_banner_path: string;
  audio_url: string;
}

export interface Invitation {
  id: string;
  slug: string;
  label: string;
  dates: string[];
  created_at: number;
}

export interface Availability {
  player_id: string;
  saturday: string;
  status: 'in' | 'out';
}

export interface DmMessage {
  id: string;
  player_id: string;
  message: string;
  created_at: number;
  read: boolean;
}

export interface PoisonStatus {
  id: string;
  player_id: string;
  poison_type: string;
  poison_name: string;
  effect: string;
  duration: string;       // 'long_rest', 'unknown', or minutes as string (e.g. '10')
  started_at: number;
  active: boolean;
}

export type BoonCategory = 'boon' | 'inspiration' | 'luck';

export interface BoonTemplate {
  id: string;
  name: string;
  category: BoonCategory;
  description: string;
  effect: string;
  action_type: string;
  range: string;
  components: string;
  duration: string;
  grants_advantage: boolean;
  created_at: number;
}

export interface PlayerBoon {
  id: string;
  player_id: string;
  template_id: string;
  name: string;
  category: BoonCategory;
  description: string;
  effect: string;
  action_type: string;
  range: string;
  components: string;
  duration_text: string;
  grants_advantage: boolean;
  expiry_type: string;
  expiry_minutes: number;
  started_at: number;
  active: boolean;
  seen: boolean;
  dm_notes: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface PlayerChange {
  id: string;
  player_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
  read: boolean;
}

export type MagicCategory = 'spell' | 'scroll' | 'magic_item' | 'weapon' | 'armor' | 'tool' | 'other';

export interface MagicCatalogEntry {
  id: string;
  category: MagicCategory;
  name: string;
  api_key: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

// ── Map Builder types ─────────────────────────────────────────────────────────

export interface TileState {
  active: boolean;       // tile exists (placed during Build mode)
  visible?: boolean;     // visible to players (set during Visible mode)
  obscured?: boolean;    // assets show as muddy blob to players (set during Obscure mode)
}

export interface PlacedAsset {
  id: string;
  asset_id: string;
  col: number;
  row: number;
}

export interface ImageLayer {
  id: string;
  image_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GridDetectType = 'square' | 'hex' | 'none';
export type ScaleMode = 'combat' | 'overland' | 'none';
export type MapKind = 'interior' | 'exterior' | 'dungeon' | 'town' | 'overland' | 'other';

export type MapRole = 'local_map' | 'world_addition';

export interface MapBuild {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  session_id: string | null;
  // Joined from sessions when listed via GET /api/map-builder
  session_number?: number | null;
  session_title?: string | null;
  // Grid + scale metadata (all nullable until Mappy or the DM populates them)
  grid_type: GridDetectType | null;
  hex_orientation: HexOrientation | null;
  cell_size_px: number | null;
  scale_mode: ScaleMode | null;
  scale_value_ft: number | null;
  map_kind: MapKind | null;
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  // Map workflow classification — null for legacy rows is treated as local_map
  map_role: MapRole | null;
  // World hex anchor (only set for local maps placed via the world hex picker)
  world_hex_q: number | null;
  world_hex_r: number | null;
  // H3 cell anchor (BIGINT in Postgres → string when serialized to JSON).
  // Set by either /world-location (res-6, legacy axial flow) or
  // /globe-placement (res-4, Globe3D drop flow).
  h3_cell: string | null;
  h3_res: number | null;
  // Globe placement (snap-grid offset within the anchor hex). 0/0 = centered.
  placement_offset_col: number;
  placement_offset_row: number;
  // Hex-shaped placement at true km extent (v3 #2). km_x/y is signed offset
  // from hex centroid in km; placement_scale is the image's size multiplier
  // (1.0 = native km extent derived from cell_size_px + scale_value_ft).
  placement_offset_km_x: number;
  placement_offset_km_y: number;
  placement_scale: number;
}

export interface MapBuildLevel {
  id: string;
  build_id: string;
  name: string;
  sort_order: number;
  cols: number;
  rows: number;
  tiles: Record<string, TileState>;   // "col,row" → state
  assets: PlacedAsset[];
  images: ImageLayer[];
}

export interface MapBuildBookmark {
  id: string;
  build_id: string;
  name: string;
  snapshot: unknown;
  created_at: number;
}

export type BuilderAssetCategory = 'wall' | 'door' | 'stairs' | 'water' | 'custom';

export interface BuilderAsset {
  id: string;
  name: string;
  category: BuilderAssetCategory;
  image_path: string | null;
  is_builtin: boolean;
  created_at: number;
}

export interface Npc {
  id: string;
  name: string;
  species: string;
  cr: string;
  hp: string;
  hp_roll: string;
  ac: string;
  speed: string;
  attacks: string;
  traits: string;
  actions: string;
  notes: string;
  gold: string;
  equipment: string;
  treasure: string;
  image_path: string | null;
}

// ── Raven Post: budget tracker ─────────────────────────────────────────────

export type SpendService = 'elevenlabs' | 'anthropic' | 'twilio' | 'websearch' | 'railway' | 'openai_embeddings' | 'noaa_gfs';

// ── Ambience v1 (see docs/plans/2026-04-19-001-feat-ambience-v1-plan.md) ──

/** One hour of a GFS forecast response. */
export interface ForecastHour {
  /** Offset from forecast start, in hours (0..167). */
  offset_hours: number;
  temp_c: number;
  humidity_pct: number;
  precip_mm: number;
  wind_mph: number;
  wind_deg: number;
  pressure_hpa: number;
  cloud_pct: number;
}

/**
 * A snapshot of current weather resolved for some (cell, game_time_hour).
 * Derived either from a live forecast (party hex) or a biome-stats distribution
 * (everywhere else).
 */
export interface WeatherState {
  condition: WeatherCondition;
  temp_c: number;
  wind_mph: number;
  wind_deg: number;
  precip_mm: number;
  pressure_hpa: number;
  pressure_trend: 'rising' | 'falling' | 'steady';
  cloud_pct: number;
}

/** Köppen-Geiger climate zone codes (subset in active use; extend as needed). */
export type KoppenZone =
  // A = tropical
  | 'Af' | 'Am' | 'Aw'
  // B = arid
  | 'BWh' | 'BWk' | 'BSh' | 'BSk'
  // C = temperate
  | 'Cfa' | 'Cfb' | 'Cfc' | 'Csa' | 'Csb' | 'Csc' | 'Cwa' | 'Cwb' | 'Cwc'
  // D = continental
  | 'Dfa' | 'Dfb' | 'Dfc' | 'Dfd' | 'Dsa' | 'Dsb' | 'Dsc' | 'Dsd' | 'Dwa' | 'Dwb' | 'Dwc' | 'Dwd'
  // E = polar
  | 'ET' | 'EF';

/** Biome substrate — immutable per-hex climate metadata (R1). */
export interface BiomeSubstrate {
  h3_cell: string;
  h3_res: number;
  koppen: KoppenZone;
  elevation_m: number;
  coastal: boolean;
  cw_latitude: number;
}

/** Session-scoped forecast cache (R3). */
export interface AmbienceSessionCache {
  session_id: string;
  party_h3_cell: string;
  fetched_at_real: string;         // ISO timestamp
  session_game_start: number;      // game_time_seconds at fetch time
  forecast: ForecastHour[];        // 168 hours
}


export interface BudgetCap {
  service: SpendService;
  soft_cap_usd: number;
  paused: boolean;
  updated_at: string;
}

export interface SpendLedgerRow {
  id: string;
  service: SpendService;
  amount_usd: number;
  units: number | null;
  unit_kind: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string;
  ref_table: string | null;
  ref_id: string | null;
}

export interface MtdSpend {
  service: SpendService;
  soft_cap_usd: number;
  mtd_usd: number;
  paused: boolean;
}

// ── Raven Post ─────────────────────────────────────────────────────────────

export type RavenMedium = 'broadsheet' | 'raven' | 'sending' | 'overheard' | 'ad' | 'cant' | 'druid_sign';
export type RavenTrust = 'official' | 'whispered' | 'rumored' | 'prophesied';
export type WeatherCondition =
  // Precipitation
  | 'clear' | 'drizzle' | 'light_rain' | 'rain' | 'heavy_rain' | 'sleet' | 'snow' | 'hail'
  // Wind
  | 'windy' | 'gale' | 'calm'
  // Visibility
  | 'fog' | 'mist' | 'haze'
  // Sky
  | 'overcast' | 'hot' | 'cold'
  // Storms
  | 'storm' | 'thunderstorm' | 'sandstorm'
  // Magical / Fantasy
  | 'dust' | 'embers' | 'fae' | 'blood_moon' | 'aurora';

// Broadsheet section slots — set on `raven_items.section_id` so the player
// renderer can place each prose block without headline-regex matching.
export type RavenSectionId =
  | 'big_headline'
  | 'col1_lead'
  | 'blood_moon'
  | 'crimson_moon'
  | 'opinion';

export interface RavenItem {
  id: string;
  medium: RavenMedium;
  body: string;
  headline: string | null;
  sender: string | null;
  target_player: string | null;
  trust: RavenTrust;
  tags: string[];
  ad_image_url: string | null;
  ad_real_link: string | null;
  ad_real_copy: string | null;
  newsie_mp3: string | null;
  raven_volume: number | null;
  raven_issue: number | null;
  section_id: RavenSectionId | null;
  published_at: string;
  created_at: string;
}

// The DM editor's draft state. One row per campaign, overwritten on every
// debounced autosave. Prose fields are wiped on publish; hero/ad/QOTD carry
// forward as a starting point for the next issue.
export interface RavenIssueDraft {
  campaign_id: string;
  big_headline: string;
  col1_lead_headline: string;
  col1_lead_body: string;
  blood_moon_headline: string;
  blood_moon_body: string;
  crimson_moon_headline: string;
  crimson_moon_body: string;
  opinion_headline: string;
  opinion_body: string;
  hero_image_url: string;
  hero_caption: string;
  ad_product_id: string | null;
  qotd_text: string;
  qotd_author: string;
  in_fiction_date: string;
  updated_at: string;
}

// A published issue's assembly record — non-prose artifacts stored here so
// /raven-post can render without scanning items for them. Prose lives in
// `raven_items` stamped with (volume, issue, section_id).
export interface RavenIssue {
  id: string;
  campaign_id: string;
  volume: number;
  issue: number;
  big_headline: string;
  hero_image_url: string;
  hero_caption: string;
  ad_product_id: string | null;
  qotd_text: string;
  qotd_author: string;
  in_fiction_date: string;
  published_at: string;
}

export interface RavenOverheardQueueRow {
  id: string;
  location: string;
  body: string;
  trust: RavenTrust;
  position: number;
  created_at: string;
  delivered_to: string[]; // joined on read for convenience
}

export interface RavenWeatherRow {
  hex_id: string;
  condition: WeatherCondition;
  temp_c: number | null;
  wind_label: string | null;
  wind_dir_deg: number | null;
  wind_speed_mph: number | null;
  updated_at: string;
}

export interface RavenHeadlinesPayload {
  headlines: { id: string; headline: string; published_at: string }[];
  newsie_mp3_url: string | null;
  last_read_at: string | null;
  newest_published_at: string | null;
}

// ── Raven Post: World AI ───────────────────────────────────────────────────

export interface WorldAiState {
  campaign_id: string;
  active_themes: string[];
  paused: boolean;
  pgvector_available: boolean;
  last_tick_at: string | null;
  next_tick_at: string | null;
  active_window_start: string;
  active_window_end: string;
  daily_cap_ticks: number;
  daily_cap_drafts: number;
  daily_cap_websearch: number;
  prompt_version: number;
  updated_at: string;
}

export interface WorldAiProposal {
  id: string;
  proposed_at: string;
  medium: RavenMedium;
  body: string;
  headline: string | null;
  reasoning: string;
  tags: string[];
  confidence: number;
  status: 'pending' | 'published' | 'pushed_down' | 'expired';
  pushdown_count: number;
  published_item_id: string | null;
  prompt_version: number;
  original_body: string | null;
  created_at: string;
}

export interface WorldAiTick {
  id: string;
  ticked_at: string;
  trigger: 'auto' | 'manual';
  haiku_input_tokens: number | null;
  haiku_output_tokens: number | null;
  sonnet_input_tokens: number | null;
  sonnet_output_tokens: number | null;
  websearch_calls: number;
  proposals_generated: number;
  cost_usd: number | null;
  notes: string | null;
}

export interface WorldAiCorpusRow {
  id: string;
  source_type: 'journal' | 'journey' | 'raven_items' | 'player_sheet';
  source_id: string;
  chunk_text: string;
  embedding: number[] | null;
  indexed_at: string;
}
