// Real round-1 environment, background and Khitan infantry art: placement/alignment only.
// Frames come from the supplied atlases as-is (never re-split); only display scale/origin are set here.
import Phaser from 'phaser';
import type { Enemy } from '../../domain/enemies';
import type { Solid, SolidKind } from '../../domain/physics';
import { R2_CONTENT, R2_DECOR, R2_GROUND_PIECES, R2_SOLID_ART, R2_STEP_BRIGHTNESS, ROUND2_ENV_KEY } from './round2Environment';
import { R3_CONTENT, R3_DECOR, R3_GROUND_PIECES, R3_SOLID_ART, r3TextureKey } from './round3Environment';

export const ENV_KEY = 'round1_env';
export const INFANTRY_KEY = 'khitan_infantry';
export const BG_ROUND1_KEY = 'bg_round1_fortress';
export const BG_ROUND2_KEY = 'bg_round2_war_camp';
export const BG_ROUND3_KEY = 'bg_round3_burning_fortress';
/** Supplied full-scene illustrations (1672×941, same crop/scale) for every round. */
export const ROUND_BG_KEYS: Record<number, string> = { 1: BG_ROUND1_KEY, 2: BG_ROUND2_KEY, 3: BG_ROUND3_KEY };
export const GROUND_STRIP_KEY = 'terrain_ground_strip';
export const GROUND_STRIP_R2_KEY = 'terrain_ground_strip_r2';
export const GROUND_STRIP_R3_KEY = 'terrain_ground_strip_r3';
/** Ground band per round (each round has its own terrain set). */
export const groundStripKey = (round: number): string => (round === 2 ? GROUND_STRIP_R2_KEY : round === 3 ? GROUND_STRIP_R3_KEY : GROUND_STRIP_KEY);

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
/**
 * `groundSink`: anchor the art by its BOTTOM instead (sunk this many px under the walk line). Used for rocks, whose
 * art is shorter than the solid once scaled to its width, so top-anchoring left them floating above the ground.
 */
export type SolidArt = { frame: string; fit: 'width' | 'height'; topInset: number; behindGround: boolean; groundSink?: number; repeat?: number };

type Rect = { x: number; y: number; w: number; h: number };
/** Where a round's environment art lives: atlas frames (rounds 1/2) or one image per tile (round 3). */
interface RoundEnv { tex: (frame: string) => [string, string | undefined]; content: Record<string, Rect>; solid: Record<SolidKind, SolidArt>; crop: boolean }
function envFor(round: number): RoundEnv {
  if (round === 2) return { tex: (f) => [ROUND2_ENV_KEY, f], content: R2_CONTENT, solid: R2_SOLID_ART, crop: true };
  if (round === 3) return { tex: (f) => [r3TextureKey(f), undefined], content: R3_CONTENT, solid: R3_SOLID_ART, crop: true };
  return { tex: (f) => [ENV_KEY, f], content: CONTENT, solid: SOLID_ART, crop: false };
}
const SOLID_ART: Record<SolidKind, SolidArt> = {
  crate: { frame: 'wooden_crate', fit: 'width', topInset: 2, behindGround: false },
  step: { frame: 'raised_block_02', fit: 'width', topInset: 4, behindGround: true },
  platform: { frame: 'wood_platform_04', fit: 'width', topInset: 3, behindGround: false },
  rock: { frame: 'rock_pile', fit: 'width', topInset: 3, behindGround: false, groundSink: 3 },
  barricade: { frame: 'palisade_wall', fit: 'height', topInset: 4, behindGround: false },
};

/** Places the image so the frame's visible top sits at the solid top (bottom may sink behind the ground strip). */
const SOLID_RIM_COLOR = 0xffe2a0;
/** Non-colliding props are pushed back: cooler and darker than the obstacles you can stand on or hit. */
const DECOR_TINT = 0x8f96a8;

export type SolidView = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

export function makeSolidImage(scene: Phaser.Scene, s: Solid, round = 1): SolidView {
  const env = envFor(round);
  const art = env.solid[s.kind];
  const c = env.content[art.frame];
  const n = Math.max(1, art.repeat ?? 1);
  // `repeat` panels sit side by side (2 px overlap) and share one scale.
  const scale = art.fit === 'width' ? ((s.w + 4) / n + (n > 1 ? 2 : 0)) / c.w : (s.h + art.topInset) / c.h;
  const y = art.groundSink !== undefined ? s.y + s.h + art.groundSink - (c.y + c.h) * scale : s.y - art.topInset - c.y * scale;
  const shownW = c.w * scale;
  const span = n * shownW - (n - 1) * 2;
  const panels = Array.from({ length: n }, (_, i) => {
    const [key, frame] = env.tex(art.frame);
    const flip = i % 2 === 1;
    const img = scene.add.image(0, 0, key, frame).setScale(scale).setOrigin(0, 0).setFlipX(flip);
    // Cells/tiles can hold slivers of neighbouring pieces or padding: show only the measured main object.
    if (env.crop) img.setCrop(c.x, c.y, c.w, c.h);
    // WebGL colour matrix (absent on the canvas renderer, where the step simply stays darker).
    if (round === 2 && s.kind === 'step') img.preFX?.addColorMatrix().brightness(R2_STEP_BRIGHTNESS);
    // flipX mirrors the crop as well: the visible part of a flipped panel starts at (frame width - c.x - c.w).
    const cx = flip ? img.frame.width - c.x - c.w : c.x;
    img.setPosition(Math.round(s.x + s.w / 2 - span / 2 + i * (shownW - 2) - cx * scale), Math.round(y));
    // Only breakable terrain (crate, barricade) gets the warm rim light, so the player can tell what can be destroyed
    // (WebGL FX; absent on the canvas renderer).
    if (s.destructible) img.preFX?.addGlow(SOLID_RIM_COLOR, 3, 0, false, 0.1, 6);
    return img;
  });
  const depth = art.behindGround ? -12 : 6;
  if (n === 1) return panels[0].setDepth(depth);
  return scene.add.container(0, 0, panels).setDepth(depth);
}

interface Decor { x: number; frame: string; height: number; flip?: boolean }

/** Non-colliding round-1 scenery (implementation default layout). Rounds 2/3 use their own props (R2_DECOR / R3_DECOR). */
const DECOR: Partial<Record<number, Decor[]>> = {
  1: [
    { x: 40, frame: 'brazier_lit', height: 58 }, { x: 430, frame: 'low_wood_fence', height: 30 }, { x: 700, frame: 'wooden_barrel', height: 30 },
    { x: 880, frame: 'blue_banner_stone_ruin', height: 104 }, { x: 1090, frame: 'sandbag_cover', height: 30 }, { x: 1440, frame: 'broken_cart', height: 38 },
    { x: 1700, frame: 'brazier_lit', height: 58 }, { x: 2060, frame: 'red_flag_wreck', height: 46 }, { x: 2330, frame: 'stone_ruin_low', height: 40 },
    { x: 2470, frame: 'spike_barricade', height: 48 }, { x: 2560, frame: 'brazier_lit', height: 58 }, { x: 3140, frame: 'brazier_lit', height: 58 },
    { x: 2800, frame: 'supply_chest', height: 26 },
  ],
};

export function makeDecor(scene: Phaser.Scene, round: number, groundY: number): Phaser.GameObjects.Image[] {
  const env = envFor(round);
  const list = round === 2 ? R2_DECOR : round === 3 ? R3_DECOR : DECOR[round];
  return (list ?? []).map((d) => {
    const c = env.content[d.frame];
    const scale = d.height / c.h;
    const [key, frame] = env.tex(d.frame);
    const img = scene.add.image(0, 0, key, frame).setScale(scale).setOrigin(0, 0).setFlipX(!!d.flip).setDepth(-13).setTint(DECOR_TINT);
    if (env.crop) img.setCrop(c.x, c.y, c.w, c.h);
    // Sink the base 3px into the ground strip so props read as standing on it (flipX mirrors the crop).
    const cx = d.flip ? img.frame.width - c.x - c.w : c.x;
    img.setPosition(Math.round(d.x - (cx + c.w / 2) * scale), Math.round(groundY + 3 - (c.y + c.h) * scale));
    return img;
  });
}

/**
 * Round-1 ground band pieces. The shaded ends of each cliff face (column luminance ~35–45 vs ~50–68 inside) left a
 * dark band at every join, so a few columns are trimmed from each end.
 */
const GROUND_PIECES: { frame: string; x: number; y: number; w: number; h: number }[] = [
  { frame: 'cliff_face_04', x: 12, y: 5, w: 232, h: 181 },
  { frame: 'cliff_face_07', x: 10, y: 5, w: 228, h: 177 },
  { frame: 'cliff_face_01', x: 14, y: 4, w: 152, h: 183 },
];
export const GROUND_STRIP_TOP = 296;
const GROUND_STRIP_H = 64;

/**
 * Builds one repeating ground band from whole cliff-face frames (scaled, placed edge to edge with a small overlap).
 * The supplied pieces are not verified seamless tiles; seams are reported in IMPLEMENTATION_NOTES.md.
 */
export function buildGroundStrip(scene: Phaser.Scene): void {
  buildStrip(scene, GROUND_STRIP_KEY, ENV_KEY, GROUND_PIECES, (GROUND_STRIP_H + 6) / 181);
  // Round 2: war-camp ground; scale 0.5 puts the grass top (source row ~16) at the walk line 8 px under the band top.
  if (scene.textures.exists(ROUND2_ENV_KEY)) buildStrip(scene, GROUND_STRIP_R2_KEY, ROUND2_ENV_KEY, R2_GROUND_PIECES, 0.5);
  // Round 3: burning-fortress cliffs (one image per tile); scale 0.65 puts the top (source row ~12) at the walk line.
  if (R3_GROUND_PIECES.every((p) => scene.textures.exists(r3TextureKey(p.frame)))) {
    buildStrip(scene, GROUND_STRIP_R3_KEY, (f) => [r3TextureKey(f), undefined], R3_GROUND_PIECES, 0.65);
  }
}

function buildStrip(
  scene: Phaser.Scene, key: string, source: string | ((frame: string) => [string, string | undefined]),
  pieces: { frame: string; x: number; y: number; w: number; h: number }[], scale: number,
): void {
  if (scene.textures.exists(key)) return;
  // An atlas key (all pieces are frames of it) or a resolver to per-piece images.
  const resolve = typeof source === 'string' ? (f: string): [string, string | undefined] => [source, f] : source;
  const overlap = 6;
  const widths = pieces.map((p) => Math.round(p.w * scale));
  const total = widths.reduce((a, b) => a + b - overlap, 0);
  const canvas = scene.textures.createCanvas(key, total, GROUND_STRIP_H)!;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(0, 10, total, GROUND_STRIP_H - 10);
  let x = 0;
  pieces.forEach((c, i) => {
    const [texKey, frameName] = resolve(c.frame);
    const tex = scene.textures.get(texKey);
    const f = tex.get(frameName);
    const src = tex.getSourceImage() as HTMLImageElement;
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
/**
 * Display scale per action so the soldier keeps one body size (~79px standing). The source sheets were drawn at
 * different sizes: attack ~0.83× and death ~0.8× the walk sheet, hurt ~1.4× — matched by head/body size, not by
 * pose height (attack/death poses crouch).
 */
const INF_SCALE: Record<string, number> = { idle: 1, walk: 1.1, attack: 1.32, hurt: 0.78, death: 1.25 };

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
