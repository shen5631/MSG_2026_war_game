// Real round-1 environment, background and Khitan infantry art: placement/alignment only.
// Frames come from the supplied atlases as-is (never re-split); only display scale/origin are set here.
import Phaser from 'phaser';
import type { Enemy } from '../../domain/enemies';
import type { Solid, SolidKind } from '../../domain/physics';

export const ENV_KEY = 'round1_env';
export const INFANTRY_KEY = 'khitan_infantry';
export const BG_ROUND1_KEY = 'bg_round1_fortress';
export const GROUND_STRIP_KEY = 'terrain_ground_strip';

/** Visible (alpha) content rect of each used environment frame, measured from the supplied atlas. */
const CONTENT: Record<string, { x: number; y: number; w: number; h: number }> = {
  cliff_face_01: { x: 4, y: 4, w: 169, h: 183 },
  cliff_face_04: { x: 5, y: 5, w: 249, h: 181 },
  cliff_face_07: { x: 6, y: 5, w: 238, h: 177 },
  raised_block_02: { x: 4, y: 6, w: 152, h: 98 },
  wood_platform_04: { x: 6, y: 5, w: 244, h: 110 },
  wooden_crate: { x: 4, y: 5, w: 234, h: 194 },
  rock_pile: { x: 6, y: 4, w: 324, h: 160 },
  palisade_wall: { x: 5, y: 5, w: 343, h: 295 },
  spike_barricade: { x: 4, y: 5, w: 445, h: 297 },
  sandbag_cover: { x: 4, y: 4, w: 356, h: 207 },
  wooden_barrel: { x: 4, y: 4, w: 211, h: 198 },
  supply_chest: { x: 4, y: 5, w: 252, h: 147 },
  broken_cart: { x: 5, y: 4, w: 497, h: 230 },
  brazier_lit: { x: 4, y: 4, w: 155, h: 269 },
  blue_banner_stone_ruin: { x: 4, y: 4, w: 349, h: 499 },
  low_wood_fence: { x: 4, y: 4, w: 376, h: 147 },
  stone_ruin_low: { x: 6, y: 4, w: 312, h: 196 },
  spike_log_wreck: { x: 4, y: 4, w: 383, h: 189 },
  red_palisade_wreck: { x: 6, y: 7, w: 298, h: 214 },
  red_flag_wreck: { x: 5, y: 6, w: 280, h: 212 },
  wheel_wreck: { x: 4, y: 5, w: 399, h: 187 },
};

export const REQUIRED_ENV_FRAMES = Object.keys(CONTENT);

/** Solid kind → art. `topInset` lets grass tufts overhang the walkable top slightly. */
const SOLID_ART: Record<SolidKind, { frame: string; fit: 'width' | 'height'; topInset: number; behindGround: boolean }> = {
  crate: { frame: 'wooden_crate', fit: 'width', topInset: 2, behindGround: false },
  step: { frame: 'raised_block_02', fit: 'width', topInset: 4, behindGround: true },
  platform: { frame: 'wood_platform_04', fit: 'width', topInset: 3, behindGround: false },
  rock: { frame: 'rock_pile', fit: 'width', topInset: 3, behindGround: false },
  barricade: { frame: 'palisade_wall', fit: 'height', topInset: 4, behindGround: false },
};

/** Places the image so the frame's visible top sits at the solid top (bottom may sink behind the ground strip). */
const SOLID_RIM_COLOR = 0xffe2a0;
/** Non-colliding props are pushed back: cooler and darker than the obstacles you can stand on or hit. */
const DECOR_TINT = 0x8f96a8;

export function makeSolidImage(scene: Phaser.Scene, s: Solid): Phaser.GameObjects.Image {
  const art = SOLID_ART[s.kind];
  const c = CONTENT[art.frame];
  const scale = art.fit === 'width' ? (s.w + 4) / c.w : (s.h + art.topInset) / c.h;
  const img = scene.add.image(0, 0, ENV_KEY, art.frame).setScale(scale).setOrigin(0, 0);
  img.setPosition(Math.round(s.x + s.w / 2 - (c.x + c.w / 2) * scale), Math.round(s.y - art.topInset - c.y * scale));
  img.setDepth(art.behindGround ? -12 : 6);
  // Colliding terrain must read apart from the painted background: warm rim light (WebGL FX; absent on canvas).
  img.preFX?.addGlow(SOLID_RIM_COLOR, 3, 0, false, 0.1, 6);
  return img;
}

interface Decor { x: number; frame: string; height: number; flip?: boolean }

/** Non-colliding scenery per round (implementation default layout). Rounds 2/3 reuse round-1 props temporarily. */
const DECOR: Record<number, Decor[]> = {
  1: [
    { x: 40, frame: 'brazier_lit', height: 58 }, { x: 430, frame: 'low_wood_fence', height: 30 }, { x: 700, frame: 'wooden_barrel', height: 30 },
    { x: 880, frame: 'blue_banner_stone_ruin', height: 104 }, { x: 1090, frame: 'sandbag_cover', height: 30 }, { x: 1440, frame: 'broken_cart', height: 38 },
    { x: 1700, frame: 'brazier_lit', height: 58 }, { x: 2060, frame: 'red_flag_wreck', height: 46 }, { x: 2330, frame: 'stone_ruin_low', height: 40 },
    { x: 2470, frame: 'spike_barricade', height: 48 }, { x: 2560, frame: 'brazier_lit', height: 58 }, { x: 3140, frame: 'brazier_lit', height: 58 },
    { x: 2800, frame: 'supply_chest', height: 26 },
  ],
  2: [
    { x: 160, frame: 'wooden_barrel', height: 30 }, { x: 900, frame: 'low_wood_fence', height: 30 }, { x: 1250, frame: 'wheel_wreck', height: 36 },
    { x: 1950, frame: 'blue_banner_stone_ruin', height: 104 }, { x: 2400, frame: 'sandbag_cover', height: 30 }, { x: 3000, frame: 'broken_cart', height: 38 },
    { x: 3300, frame: 'red_palisade_wreck', height: 46 }, { x: 3720, frame: 'stone_ruin_low', height: 40 },
  ],
  3: [
    { x: 200, frame: 'red_flag_wreck', height: 46 }, { x: 1100, frame: 'spike_log_wreck', height: 36 }, { x: 1500, frame: 'brazier_lit', height: 58 },
    { x: 2100, frame: 'blue_banner_stone_ruin', height: 104 }, { x: 2600, frame: 'wheel_wreck', height: 36 }, { x: 2950, frame: 'red_palisade_wreck', height: 46 },
    { x: 3550, frame: 'spike_barricade', height: 48 }, { x: 4000, frame: 'brazier_lit', height: 58 }, { x: 4500, frame: 'red_flag_wreck', height: 46, flip: true },
  ],
};

export function makeDecor(scene: Phaser.Scene, round: number, groundY: number): Phaser.GameObjects.Image[] {
  return (DECOR[round] ?? []).map((d) => {
    const c = CONTENT[d.frame];
    const scale = d.height / c.h;
    const img = scene.add.image(0, 0, ENV_KEY, d.frame).setScale(scale).setOrigin(0, 0).setFlipX(!!d.flip).setDepth(-13).setTint(DECOR_TINT);
    // Sink the base 3px into the ground strip so props read as standing on it.
    img.setPosition(Math.round(d.x - (c.x + c.w / 2) * scale), Math.round(groundY + 3 - (c.y + c.h) * scale));
    return img;
  });
}

const GROUND_PIECES = ['cliff_face_04', 'cliff_face_07', 'cliff_face_01'];
export const GROUND_STRIP_TOP = 296;
const GROUND_STRIP_H = 64;

/**
 * Builds one repeating ground band from whole cliff-face frames (scaled, placed edge to edge with a small overlap).
 * The supplied pieces are not verified seamless tiles; seams are reported in IMPLEMENTATION_NOTES.md.
 */
export function buildGroundStrip(scene: Phaser.Scene): void {
  if (scene.textures.exists(GROUND_STRIP_KEY)) return;
  const tex = scene.textures.get(ENV_KEY);
  const src = tex.getSourceImage() as HTMLImageElement;
  const scale = (GROUND_STRIP_H + 6) / 181;
  const overlap = 6;
  const widths = GROUND_PIECES.map((k) => Math.round(CONTENT[k].w * scale));
  const total = widths.reduce((a, b) => a + b - overlap, 0);
  const canvas = scene.textures.createCanvas(GROUND_STRIP_KEY, total, GROUND_STRIP_H)!;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(0, 10, total, GROUND_STRIP_H - 10);
  let x = 0;
  GROUND_PIECES.forEach((k, i) => {
    const f = tex.get(k);
    const c = CONTENT[k];
    ctx.drawImage(src, f.cutX + c.x, f.cutY + c.y, c.w, c.h, x, 0, widths[i], Math.round(c.h * scale));
    x += widths[i] - overlap;
  });
  canvas.refresh();
}

// ---- Khitan infantry (real art) ----
const INF_FRAMES = {
  idle: [1, 2, 3, 4].map((i) => `khitan_infantry_idle_0${i}.png`),
  walk: [1, 2, 3, 4, 5, 6].map((i) => `khitan_infantry_walk_0${i}.png`),
  attack: [1, 2, 3, 4, 5, 6].map((i) => `khitan_infantry_attack_0${i}.png`),
  hurt: [1, 2, 3].map((i) => `khitan_infantry_hurt_0${i}.png`),
  death: [1, 2, 3, 4, 5, 6].map((i) => `khitan_infantry_death_0${i}.png`),
};
export const REQUIRED_INFANTRY_FRAMES = Object.values(INF_FRAMES).flat();

/** Visible bottom row per frame (the source sheets were drawn at slightly different baselines). */
const INF_FOOT: Record<string, number[]> = {
  idle: [116, 118, 111, 116], walk: [122, 122, 122, 117, 117, 117], attack: [122, 122, 122, 110, 110, 113],
  hurt: [117, 117, 121], death: [119, 119, 119, 107, 106, 107],
};
/** Display scale per action so standing height stays ~79px (hurt sheet was drawn larger, walk/attack smaller). */
const INF_SCALE: Record<string, number> = { idle: 1, walk: 1.1, attack: 1.1, hurt: 0.9, death: 1 };

const pick = (n: number, p: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n)));

export function infantryPose(e: Enemy, t: number, windupMs: number, activeMs: number): { frame: string; scale: number; originY: number } {
  let action: keyof typeof INF_FRAMES = 'idle';
  let i = Math.floor(t / 200) % 4;
  switch (e.state) {
    case 'move': action = 'walk'; i = Math.floor(t / 125) % 6; break;
    case 'windup': action = 'attack'; i = pick(2, (t - e.stateT) / windupMs); break;
    case 'active': action = 'attack'; i = 2 + pick(2, (t - e.stateT) / activeMs); break;
    case 'recover': if (t - e.stateT < 300) { action = 'attack'; i = 4 + pick(2, (t - e.stateT) / 300); } break;
    case 'stunned': case 'guardBroken': action = 'hurt'; i = Math.min(2, Math.floor((t - e.stateT) / 70)); break;
    case 'dead': action = 'death'; i = Math.min(5, Math.floor((t - e.deadAt) / 100)); break;
    default: break;
  }
  return { frame: INF_FRAMES[action][i], scale: INF_SCALE[action], originY: INF_FOOT[action][i] / 128 };
}
