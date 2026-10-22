// TEMPORARY generated pixel art (generated_* textures). Every key here is listed in TEMPORARY_ASSETS
// and in IMPLEMENTATION_NOTES.md. Replacing them means swapping texture keys, not gameplay numbers.
import Phaser from 'phaser';
import type { BossId, EnemyKind } from '../../config/spec';

export const POSES = ['idle', 'walkA', 'walkB', 'windup', 'attack', 'hurt', 'dead'] as const;
export type Pose = (typeof POSES)[number];

type Weapon = 'sword' | 'spear' | 'shield' | 'lance' | 'bigsword' | 'glaive';
interface Palette { armor: string; armorDark: string; trim: string; skin: string; helmet: string; plume: string; cloth: string; metal: string; wood: string; outline: string }

const ENEMY_PAL: Palette = { armor: '#8a3b2a', armorDark: '#5a2418', trim: '#c27a3a', skin: '#d9a066', helmet: '#4e2a1e', plume: '#b8452e', cloth: '#6e3324', metal: '#c8c8c8', wood: '#6b4a2b', outline: '#1b0d08' };
const ALLY_PAL: Palette = { armor: '#2a3f7a', armorDark: '#18264d', trim: '#c9a227', skin: '#e0ac74', helmet: '#1b2a52', plume: '#3e64b8', cloth: '#22345f', metal: '#d0d4dc', wood: '#7a5a34', outline: '#070b17' };

const FRAME = { w: 96, h: 112, footY: 106 };
const BOSS_FRAME = { w: 160, h: 160, footY: 152 };

export const TEMPORARY_ASSETS = [
  'generated_enemy_shieldman', 'generated_enemy_cavalry',
  'generated_boss_spear_captain', 'generated_boss_so_bae_ap',
  'generated_ally_spear',
  'generated_pickups', 'generated_ui_markers',
  'generated_bg_r2_*', 'generated_bg_r3_*',
  'synth_bgm_*', 'synth_sfx_*',
] as const;

interface Part { x: number; y: number; w: number; h: number; c: string }

class Painter {
  parts: Part[] = [];
  constructor(private ox: number, private oy: number, private s: number) {}
  r(x: number, y: number, w: number, h: number, c: string): void {
    const s = this.s;
    this.parts.push({ x: Math.round(this.ox + x * s), y: Math.round(this.oy + y * s), w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), c });
  }
  flush(ctx: CanvasRenderingContext2D, outline: string): void {
    ctx.fillStyle = outline;
    for (const p of this.parts) ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
    for (const p of this.parts) {
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    this.parts = [];
  }
}

/** Humanoid facing right; (0,0) = feet center; y grows downward (negative = up). */
function drawHumanoid(ctx: CanvasRenderingContext2D, fx: number, fy: number, scale: number, pal: Palette, pose: Pose, weapon: Weapon, opts: { cape?: boolean; crest?: boolean } = {}): void {
  const p = new Painter(fx, fy, scale);
  if (pose === 'dead') {
    p.r(-26, -10, 40, 9, pal.armor);
    p.r(14, -12, 10, 10, pal.skin);
    p.r(14, -14, 11, 4, pal.helmet);
    p.r(-34, -6, 10, 4, pal.cloth);
    p.flush(ctx, pal.outline);
    return;
  }
  const lean = pose === 'attack' ? 3 : pose === 'windup' ? -2 : pose === 'hurt' ? -4 : 0;
  const stepA = pose === 'walkA' ? 4 : pose === 'walkB' ? -4 : pose === 'attack' ? 5 : 0;
  if (opts.cape) p.r(-14 + lean, -50, 8, 40, pal.plume);
  // legs
  p.r(-8 - stepA * 0.5, -24, 7, 24, pal.cloth);
  p.r(2 + stepA * 0.5, -24, 7, 24, pal.cloth);
  p.r(-9 - stepA * 0.5, -4, 9, 4, pal.armorDark);
  p.r(2 + stepA * 0.5, -4, 9, 4, pal.armorDark);
  // torso
  p.r(-10 + lean, -52, 20, 30, pal.armor);
  p.r(-10 + lean, -30, 20, 5, pal.armorDark);
  p.r(-10 + lean, -52, 20, 3, pal.trim);
  p.r(-12 + lean, -26, 24, 6, pal.cloth);
  // head
  p.r(-6 + lean, -64, 12, 12, pal.skin);
  p.r(2 + lean, -60, 3, 2, pal.outline);
  p.r(-8 + lean, -68, 16, 7, pal.helmet);
  p.r(-1 + lean, -73, 3, 5, opts.crest ? pal.trim : pal.helmet);
  if (opts.crest) p.r(-5 + lean, -78, 10, 5, pal.plume);
  // weapon + front arm
  const ax = 6 + lean;
  switch (weapon) {
    case 'sword':
    case 'bigsword': {
      const len = weapon === 'bigsword' ? 34 : 24;
      const wid = weapon === 'bigsword' ? 5 : 3;
      if (pose === 'windup') { p.r(ax - 14, -58, 6, 16, pal.armor); p.r(ax - 18, -60 - len, wid, len, pal.metal); p.r(ax - 21, -60, wid + 6, 3, pal.trim); }
      else if (pose === 'attack') { p.r(ax, -46, 16, 6, pal.armor); p.r(ax + 16, -46, len + 6, wid, pal.metal); p.r(ax + 13, -49, 3, wid + 6, pal.trim); }
      else { p.r(ax, -50, 6, 20, pal.armor); p.r(ax + 6, -54 - len + 20, wid, len, pal.metal); p.r(ax + 3, -36, wid + 6, 3, pal.trim); }
      break;
    }
    case 'glaive': {
      if (pose === 'windup') { p.r(ax - 12, -58, 6, 16, pal.armor); p.r(ax - 40, -66, 44, 3, pal.wood); p.r(ax - 52, -70, 14, 8, pal.metal); }
      else if (pose === 'attack') { p.r(ax, -46, 14, 6, pal.armor); p.r(ax + 4, -46, 50, 3, pal.wood); p.r(ax + 52, -50, 18, 9, pal.metal); }
      else { p.r(ax, -50, 6, 20, pal.armor); p.r(ax + 8, -92, 3, 90, pal.wood); p.r(ax + 6, -102, 9, 14, pal.metal); }
      break;
    }
    case 'spear':
    case 'lance': {
      const len = weapon === 'lance' ? 64 : 58;
      if (pose === 'windup') { p.r(ax - 10, -50, 8, 6, pal.armor); p.r(ax - 40, -48, len, 2, pal.wood); p.r(ax - 40 + len, -50, 8, 6, pal.metal); }
      else if (pose === 'attack') { p.r(ax, -48, 18, 6, pal.armor); p.r(ax, -47, len + 10, 2, pal.wood); p.r(ax + len + 10, -49, 10, 6, pal.metal); }
      else { p.r(ax, -50, 6, 20, pal.armor); p.r(ax + 7, -86, 2, 84, pal.wood); p.r(ax + 5, -94, 6, 9, pal.metal); }
      break;
    }
    case 'shield': {
      if (pose === 'attack') { p.r(ax, -46, 14, 6, pal.armor); p.r(ax + 14, -47, 18, 3, pal.metal); p.r(ax - 4, -56, 8, 34, pal.wood); }
      else if (pose === 'windup') { p.r(ax - 12, -58, 6, 14, pal.armor); p.r(ax - 16, -76, 3, 20, pal.metal); p.r(ax + 2, -58, 8, 38, pal.wood); }
      else { p.r(ax + 6, -60, 10, 42, pal.wood); p.r(ax + 9, -48, 4, 18, pal.trim); }
      break;
    }
  }
  p.flush(ctx, pal.outline);
}

function drawCavalry(ctx: CanvasRenderingContext2D, fx: number, fy: number, pal: Palette, pose: Pose): void {
  const p = new Painter(fx, fy, 1);
  if (pose === 'dead') {
    p.r(-34, -16, 60, 14, '#5b3a29');
    p.r(-20, -24, 26, 9, pal.armor);
    p.flush(ctx, pal.outline);
    return;
  }
  const gallop = pose === 'walkA' || pose === 'attack' ? 5 : pose === 'walkB' ? -5 : 0;
  const horse = '#5b3a29';
  const horseDark = '#3b2418';
  p.r(-30, -44, 54, 22, horse);
  p.r(18, -60, 10, 22, horse);
  p.r(22, -66, 18, 10, horse);
  p.r(34, -62, 4, 3, pal.outline);
  p.r(14, -64, 6, 16, horseDark);
  p.r(-36, -42, 8, 18, horseDark);
  p.r(-26 + gallop, -24, 6, 24, horseDark);
  p.r(-14 - gallop, -24, 6, 24, horse);
  p.r(10 + gallop, -24, 6, 24, horseDark);
  p.r(18 - gallop, -24, 6, 24, horse);
  p.r(-14, -50, 30, 6, pal.trim);
  // rider
  p.r(-8, -76, 16, 26, pal.armor);
  p.r(-5, -88, 11, 11, pal.skin);
  p.r(-7, -92, 15, 6, pal.helmet);
  p.r(-1, -97, 3, 5, pal.plume);
  if (pose === 'windup') { p.r(-40, -70, 64, 2, pal.wood); p.r(24, -72, 8, 6, pal.metal); }
  else if (pose === 'attack') { p.r(0, -64, 70, 2, pal.wood); p.r(70, -66, 10, 6, pal.metal); }
  else { p.r(8, -110, 2, 60, pal.wood); p.r(6, -116, 6, 8, pal.metal); }
  p.flush(ctx, pal.outline);
}

function makeSheet(scene: Phaser.Scene, key: string, fw: number, fh: number, draw: (ctx: CanvasRenderingContext2D, pose: Pose, ox: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, fw * POSES.length, fh)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  POSES.forEach((pose, i) => draw(ctx, pose, i * fw));
  tex.refresh();
  POSES.forEach((pose, i) => tex.add(pose, 0, i * fw, 0, fw, fh));
}

const ENEMY_WEAPON: Record<Exclude<EnemyKind, 'infantry' | 'archer' | 'spearman'>, Weapon> = { shieldman: 'shield', cavalry: 'lance' };

// The round-1 vanguard uses the supplied V2 atlas (visual/vanguard.ts); the other two bosses are still generated.
const BOSS_STYLE: Record<Exclude<BossId, 'vanguard'>, { pal: Palette; weapon: Weapon; scale: number; cape: boolean }> = {
  spear_captain: { pal: { ...ENEMY_PAL, armor: '#6a3a26', trim: '#b9b9b9', helmet: '#3a1f16', plume: '#e0e0e0' }, weapon: 'glaive', scale: 1.3, cape: false },
  so_bae_ap: { pal: { ...ENEMY_PAL, armor: '#5a1e1a', armorDark: '#33100d', trim: '#d4a72c', helmet: '#2a1410', plume: '#9c1c1c' }, weapon: 'bigsword', scale: 1.38, cape: true },
};

export const ENEMY_FRAME = FRAME;
export const BOSS_FRAME_INFO = BOSS_FRAME;

export function generateCharacterTextures(scene: Phaser.Scene): void {
  // Infantry, archer and spearman use their supplied atlases; shieldman and cavalry are still generated.
  (Object.keys(ENEMY_WEAPON) as (keyof typeof ENEMY_WEAPON)[]).forEach((kind) => {
    makeSheet(scene, `generated_enemy_${kind}`, FRAME.w, FRAME.h, (ctx, pose, ox) => {
      if (kind === 'cavalry') drawCavalry(ctx, ox + FRAME.w / 2 - 8, FRAME.footY, ENEMY_PAL, pose);
      else drawHumanoid(ctx, ox + FRAME.w / 2, FRAME.footY, 1, ENEMY_PAL, pose, ENEMY_WEAPON[kind]);
    });
  });
  (Object.keys(BOSS_STYLE) as (keyof typeof BOSS_STYLE)[]).forEach((id) => {
    const st = BOSS_STYLE[id];
    makeSheet(scene, `generated_boss_${id}`, BOSS_FRAME.w, BOSS_FRAME.h, (ctx, pose, ox) =>
      drawHumanoid(ctx, ox + BOSS_FRAME.w / 2, BOSS_FRAME.footY, st.scale, st.pal, pose, st.weapon, { cape: st.cape, crest: true }),
    );
  });
  makeSheet(scene, 'generated_ally_spear', FRAME.w, FRAME.h, (ctx, pose, ox) => drawHumanoid(ctx, ox + FRAME.w / 2, FRAME.footY, 1, ALLY_PAL, pose, 'spear'));
  // 방패병 막기 soldiers use the supplied goryeo_shield_skill_v1 atlas (game/skills/shield).
}

export function generatePropTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('generated_pickups')) {
    const tex = scene.textures.createCanvas('generated_pickups', 64, 16)!;
    const c = tex.getContext();
    // riceball (주먹밥)
    c.fillStyle = '#222'; c.fillRect(2, 1, 12, 14);
    c.fillStyle = '#f4f1e6'; c.fillRect(3, 2, 10, 12); c.fillRect(5, 1, 6, 2);
    c.fillStyle = '#1d3b1d'; c.fillRect(3, 9, 10, 5);
    // herb pouch (약초 주머니)
    c.fillStyle = '#16210f'; c.fillRect(17, 2, 14, 14);
    c.fillStyle = '#4c8a34'; c.fillRect(18, 5, 12, 10);
    c.fillStyle = '#c9a227'; c.fillRect(19, 3, 10, 2);
    c.fillStyle = '#9fd36f'; c.fillRect(22, 0, 2, 4); c.fillRect(25, 1, 2, 3);
    tex.refresh();
    tex.add('riceball', 0, 0, 0, 16, 16);
    tex.add('herb', 0, 16, 0, 16, 16);
  }
  if (!scene.textures.exists('generated_ui_markers')) {
    const tex = scene.textures.createCanvas('generated_ui_markers', 96, 32)!;
    const c = tex.getContext();
    // spawn warning (dust + red flag)
    c.fillStyle = 'rgba(200,60,40,0.5)'; c.fillRect(0, 26, 32, 6);
    c.fillStyle = '#2a1a0c'; c.fillRect(14, 4, 2, 24);
    c.fillStyle = '#c8402a'; c.fillRect(16, 4, 12, 8);
    // exit arrow
    c.fillStyle = '#f5d76e';
    for (let i = 0; i < 8; i++) c.fillRect(36 + i, 8 + i, 3, 16 - i * 2);
    c.fillRect(44, 12, 3, 8);
    // gate wall segment 32x32 (blocked boundary)
    c.fillStyle = 'rgba(200,60,40,0.35)'; c.fillRect(64, 0, 6, 32);
    tex.refresh();
    tex.add('spawn', 0, 0, 0, 32, 32);
    tex.add('exit', 0, 32, 0, 32, 32);
    tex.add('wall', 0, 64, 0, 8, 32);
  }
}

const BG: Record<number, { skyTop: string; skyBottom: string; far: string; mid: string; near: string }> = {
  2: { skyTop: '#5f9fb0', skyBottom: '#cfe3d2', far: '#4f6e78', mid: '#2b4d63', near: '#3d5a2c' },
  3: { skyTop: '#3b2a4a', skyBottom: '#e08a4a', far: '#4a3a52', mid: '#2a2230', near: '#3a2c20' },
};

/** Parallax layers for rounds 2/3 (round 1 uses the supplied fortress-village illustration). */
export function generateBackgrounds(scene: Phaser.Scene): void {
  for (const r of [2, 3]) {
    const pal = BG[r];
    const sky = `generated_bg_r${r}_sky`;
    if (!scene.textures.exists(sky)) {
      const t = scene.textures.createCanvas(sky, 640, 360)!;
      const c = t.getContext();
      const g = c.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, pal.skyTop);
      g.addColorStop(1, pal.skyBottom);
      c.fillStyle = g;
      c.fillRect(0, 0, 640, 360);
      if (r === 3) { c.fillStyle = '#f2c45a'; c.fillRect(470, 150, 40, 40); }
      else { c.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) c.fillRect(40 + i * 105, 40 + (i % 3) * 22, 54, 8); }
      t.refresh();
    }
    const far = `generated_bg_r${r}_far`;
    if (!scene.textures.exists(far)) {
      const t = scene.textures.createCanvas(far, 640, 360)!;
      const c = t.getContext();
      c.fillStyle = pal.far;
      for (let i = 0; i < 6; i++) {
        const cx = i * 128 + 40;
        for (let y = 0; y < 110; y += 2) {
          const w = Math.round((y / 110) * 150);
          c.fillRect(cx - w / 2, 170 + y, w, 2);
        }
      }
      c.fillRect(0, 280, 640, 80);
      t.refresh();
    }
    const mid = `generated_bg_r${r}_mid`;
    if (!scene.textures.exists(mid)) {
      const t = scene.textures.createCanvas(mid, 640, 360)!;
      const c = t.getContext();
      c.fillStyle = pal.mid;
      if (r === 2) {
        // river band + bridge piers
        c.fillStyle = '#3c7aa0'; c.fillRect(0, 262, 640, 30);
        c.fillStyle = '#7fb6d4'; for (let i = 0; i < 16; i++) c.fillRect(i * 40 + (i % 2) * 12, 270 + (i % 3) * 6, 18, 2);
        c.fillStyle = '#5a4026'; c.fillRect(0, 238, 640, 8);
        for (let i = 0; i < 8; i++) c.fillRect(i * 80 + 30, 238, 8, 54);
      } else {
        // tents and banners
        for (let i = 0; i < 5; i++) {
          const x = i * 128 + 20;
          for (let y = 0; y < 40; y += 2) c.fillRect(x + 40 - y, 240 + y, y * 2, 2);
          c.fillStyle = i % 2 ? '#2a3f7a' : '#8a3b2a';
          c.fillRect(x + 90, 196, 18, 26);
          c.fillStyle = '#2a1a0c'; c.fillRect(x + 88, 196, 2, 84);
          c.fillStyle = pal.mid;
        }
      }
      t.refresh();
    }
    const near = `generated_bg_r${r}_near`;
    if (!scene.textures.exists(near)) {
      const t = scene.textures.createCanvas(near, 640, 360)!;
      const c = t.getContext();
      c.fillStyle = pal.near;
      for (let i = 0; i < 20; i++) {
        const x = i * 32;
        if (r === 2) { c.fillRect(x + 6, 284 - (i % 3) * 4, 2, 20 + (i % 3) * 4); c.fillRect(x + 12, 288, 2, 16); }
        else { c.fillRect(x + 8, 292, 3, 12); c.fillRect(x + 14, 296, 2, 8); }
      }
      t.refresh();
    }
  }
}
