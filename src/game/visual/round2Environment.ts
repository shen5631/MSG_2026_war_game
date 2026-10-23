// Round-2 war-camp environment art (round2_environment_game_ready_v2): placement data only.
// Frames come from the supplied atlas as-is (never re-split). Several cells still carry slivers of neighbouring
// pieces from the source sheet, so each used frame is shown through a crop of its main object (`CONTENT`, measured
// by connected alpha regions). Collision stays in the domain Solids (src/domain/world.ts), never the PNG bounds.
import type { SolidKind } from '../../domain/physics';

export const ROUND2_ENV_KEY = 'round2-environment-v2';

/** Visible main-object rect inside each used frame (frame-local px). */
export const R2_CONTENT: Record<string, { x: number; y: number; w: number; h: number }> = {
  ground_long_02: { x: 0, y: 0, w: 235, h: 144 },
  cliff_mid_01: { x: 0, y: 4, w: 160, h: 171 },
  raised_cliff_02: { x: 25, y: 0, w: 130, h: 145 },
  wood_bridge_01: { x: 24, y: 4, w: 266, h: 131 },
  crate_stack_01: { x: 179, y: 22, w: 161, h: 153 },
  palisade_tall_02: { x: 34, y: 9, w: 205, h: 211 },
  rocks_01: { x: 13, y: 51, w: 196, h: 92 },
  tent_red_01: { x: 0, y: 18, w: 291, h: 123 },
  tent_beige_01: { x: 132, y: 0, w: 208, h: 143 },
  watchtower_01: { x: 28, y: 8, w: 192, h: 257 },
  brazier_large_01: { x: 51, y: 14, w: 139, h: 161 },
  torch_01: { x: 49, y: 1, w: 66, h: 174 },
  battle_banner_01: { x: 116, y: 36, w: 152, h: 249 },
  red_flag_01: { x: 55, y: 10, w: 155, h: 160 },
  wagon_wreck_01: { x: 9, y: 42, w: 225, h: 123 },
  palisade_broken_02: { x: 132, y: 10, w: 128, h: 148 },
  sacks_01: { x: 0, y: 22, w: 245, h: 153 },
  lantern_01: { x: 20, y: 28, w: 104, h: 147 },
};

export const REQUIRED_ROUND2_ENV_FRAMES = Object.keys(R2_CONTENT);

/** Solid kind → round-2 art (fit/topInset as in the round-1 table: topInset = art top above the walkable top). */
export const R2_SOLID_ART: Record<SolidKind, { frame: string; fit: 'width' | 'height'; topInset: number; behindGround: boolean }> = {
  crate: { frame: 'crate_stack_01', fit: 'width', topInset: 2, behindGround: false },
  step: { frame: 'raised_cliff_02', fit: 'width', topInset: 8, behindGround: true },
  platform: { frame: 'wood_bridge_01', fit: 'width', topInset: 9, behindGround: false },
  rock: { frame: 'rocks_01', fit: 'width', topInset: 3, behindGround: false },
  barricade: { frame: 'palisade_tall_02', fit: 'height', topInset: 4, behindGround: false },
};

/** Non-colliding camp scenery for round 2 (implementation default layout; height = displayed px). */
export const R2_DECOR: { x: number; frame: string; height: number; flip?: boolean }[] = [
  { x: 60, frame: 'brazier_large_01', height: 44 },
  { x: 470, frame: 'tent_red_01', height: 44 },
  { x: 900, frame: 'red_flag_01', height: 48 },
  { x: 1180, frame: 'sacks_01', height: 30 },
  { x: 1460, frame: 'torch_01', height: 46 },
  { x: 1660, frame: 'watchtower_01', height: 110 },
  { x: 2050, frame: 'lantern_01', height: 40 },
  { x: 2300, frame: 'wagon_wreck_01', height: 34 },
  { x: 2600, frame: 'battle_banner_01', height: 76 },
  { x: 2980, frame: 'tent_beige_01', height: 46 },
  { x: 3260, frame: 'palisade_broken_02', height: 40 },
  { x: 3420, frame: 'brazier_large_01', height: 44 },
  { x: 4000, frame: 'brazier_large_01', height: 44 },
];

/**
 * Round-2 ground band, left to right (repeated by the tile sprite): only the column ranges whose grass top is flat
 * (~row 16 in both frames), drawn from frame row 0 so the tops line up. The left half of ground_long_02 dips to
 * rows 29–42 and the rounded edge of cliff_mid_01 would leave notches in the band, so those columns are not used.
 */
export const R2_GROUND_PIECES: { frame: string; x: number; y: number; w: number; h: number }[] = [
  { frame: 'cliff_mid_01', x: 20, y: 0, w: 140, h: 175 },
  { frame: 'ground_long_02', x: 150, y: 0, w: 85, h: 145 },
];
