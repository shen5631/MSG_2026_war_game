// Round-3 burning-fortress environment art (round3_environment_game_ready_v1): placement data only.
// The package ships 93 separate PNGs (no atlas); each used one is loaded as its own image `r3env_<id>` and shown as-is
// (never re-cut) through a crop of its measured main object (`R3_CONTENT`, connected alpha regions; drops the 8 px
// padding and stray neighbour pixels). Collision stays in the domain Solids (src/domain/world.ts), never PNG bounds.
import type { SolidKind } from '../../domain/physics';
import type { SolidArt } from './environment';

export const R3_TEXTURE_PREFIX = 'r3env_';
export const r3TextureKey = (id: string): string => `${R3_TEXTURE_PREFIX}${id}`;

/** Package file of each used tile (relative to public/), keyed by manifest id. */
const R3_DIR = 'assets/round3_environment_game_ready_v1/tiles';
export const r3TileFile = (id: string): string => `${R3_DIR}/${id.replace(/_\d+$/, '')}/round3_${id}.png`;

/** Visible main-object rect inside each used tile (tile-local px). */
export const R3_CONTENT: Record<string, { x: number; y: number; w: number; h: number }> = {
  ruins_walls_03: { x: 9, y: 9, w: 110, h: 88 },
  platforms_02: { x: 8, y: 8, w: 200, h: 189 },
  small_decor_09: { x: 9, y: 8, w: 67, h: 62 },
  fortress_props_22: { x: 8, y: 9, w: 73, h: 120 },
  small_decor_01: { x: 8, y: 9, w: 93, h: 51 },
  fortress_props_06: { x: 9, y: 9, w: 54, h: 236 },
  fortress_props_19: { x: 8, y: 8, w: 45, h: 242 },
  fortress_props_01: { x: 8, y: 9, w: 91, h: 213 },
  hazards_barricades_01: { x: 8, y: 8, w: 147, h: 83 },
  hazards_barricades_02: { x: 9, y: 18, w: 68, h: 142 },
  fortress_props_25: { x: 8, y: 8, w: 167, h: 44 },
  fortress_props_12: { x: 8, y: 8, w: 37, h: 55 },
  fortress_props_11: { x: 8, y: 8, w: 65, h: 74 },
  platforms_09: { x: 8, y: 8, w: 156, h: 132 },
  small_decor_13: { x: 9, y: 8, w: 80, h: 47 },
  small_decor_02: { x: 8, y: 9, w: 93, h: 47 },
};

/**
 * Solid kind → round-3 art (fit/topInset as in the round-1 table: topInset = art top above the walkable top, in px).
 * step = a castle-wall section with a flat top (성벽), platform = wooden scaffold whose plank top is the walkable top
 * (posts/brace sink behind the ground band), barricade = two palisade panels side by side (one panel is too narrow
 * for the 52 px solid), crate = supply crate, rock = rubble mound.
 */
export const R3_SOLID_ART: Record<SolidKind, SolidArt> = {
  crate: { frame: 'small_decor_09', fit: 'width', topInset: 2, behindGround: false },
  step: { frame: 'ruins_walls_03', fit: 'width', topInset: 1, behindGround: true },
  platform: { frame: 'platforms_02', fit: 'width', topInset: 15, behindGround: true },
  rock: { frame: 'small_decor_01', fit: 'width', topInset: 3, behindGround: false, groundSink: 3 },
  barricade: { frame: 'fortress_props_22', fit: 'height', topInset: 4, behindGround: false, repeat: 2 },
};

/** Non-colliding fortress scenery for round 3 (implementation default layout; height = displayed px). */
export const R3_DECOR: { x: number; frame: string; height: number; flip?: boolean }[] = [
  { x: 60, frame: 'fortress_props_06', height: 80 },
  { x: 300, frame: 'small_decor_01', height: 20 },
  { x: 620, frame: 'fortress_props_19', height: 78 },
  { x: 880, frame: 'hazards_barricades_02', height: 48 },
  { x: 1150, frame: 'fortress_props_25', height: 18 },
  { x: 1320, frame: 'fortress_props_01', height: 72 },
  { x: 1640, frame: 'platforms_09', height: 40 },
  { x: 2010, frame: 'fortress_props_12', height: 24 },
  { x: 2330, frame: 'hazards_barricades_01', height: 32 },
  { x: 2620, frame: 'fortress_props_11', height: 30 },
  { x: 2860, frame: 'small_decor_13', height: 18 },
  { x: 3120, frame: 'fortress_props_06', height: 80, flip: true },
  { x: 3460, frame: 'small_decor_02', height: 18 },
  { x: 3820, frame: 'hazards_barricades_02', height: 48 },
  { x: 4180, frame: 'fortress_props_19', height: 78, flip: true },
  { x: 4520, frame: 'hazards_barricades_02', height: 48 },
];

/**
 * Round-3 ground band, left to right (repeated by the tile sprite): the flat middle columns of four cliff tiles whose
 * top is level (rows ~9–14) and whose face brightness matches (mean luminance 43–45). Brighter tiles (05/08, ~60) and
 * the rounded ends of each tile are not used so the band shows no light/dark stripes or notches.
 */
export const R3_GROUND_PIECES: { frame: string; x: number; y: number; w: number; h: number }[] = [
  { frame: 'terrain_cliffs_18', x: 20, y: 0, w: 86, h: 144 },
  { frame: 'terrain_cliffs_19', x: 20, y: 0, w: 84, h: 143 },
  { frame: 'terrain_cliffs_17', x: 20, y: 0, w: 80, h: 144 },
  { frame: 'terrain_cliffs_20', x: 22, y: 0, w: 70, h: 144 },
];

export const REQUIRED_ROUND3_TILES = [...new Set([...Object.keys(R3_CONTENT), ...R3_GROUND_PIECES.map((p) => p.frame)])];
