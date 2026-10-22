// Round-2 boss '정예 창병장' (elite_spearman_commander_round2_boss_v1) driven by the EXISTING domain Boss AI
// (src/domain/boss.ts 'spear_captain': HP 500, phase 2 at 250, distance/phase pattern choice, red telegraph).
// Only frame choice and alignment live here. Frames come from a 1/3-resolution display copy of the supplied
// atlas (scripts/downscale-atlas.mjs: same scenes/names, never re-split) — the original 567×737 cells would be
// shown at ~0.15× and alias badly.
import { DEFAULTS } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import type { VanguardView } from './vanguard';

export const SPEAR_CAPTAIN_KEY = 'elite_spearman_commander';
const CELL_W = 189;
const CELL_H = 246;

const COUNTS = { idle: 4, walk: 6, attack: 6, charge: 6, combo: 8, phase2: 4, hurt: 4, death: 6 } as const;
type Action = keyof typeof COUNTS;
const name = (a: Action, i: number) => `elite_spearman_commander_${a}_0${i + 1}.png`;
export const REQUIRED_SPEAR_CAPTAIN_FRAMES = (Object.keys(COUNTS) as Action[]).flatMap((a) => Array.from({ length: COUNTS[a] }, (_, i) => name(a, i)));

/** Bottom row of the drawn feet per frame (display atlas, measured). */
const FOOT: Record<Action, number[]> = {
  idle: [200, 199, 200, 198], walk: [196, 193, 192, 193, 189, 191], attack: [191, 193, 192, 194, 194, 194],
  charge: [177, 177, 177, 177, 187, 176], combo: [182, 185, 189, 185, 185, 176, 184, 188],
  phase2: [236, 236, 236, 230], hurt: [204, 199, 195, 199], death: [201, 198, 189, 197, 205, 201],
};
/** Feet centre per action: the figure is not centred in its cell and flipX mirrors around the cell. */
const FEET_X: Record<Action, number> = { idle: 77, walk: 96, attack: 90, charge: 88, combo: 92, phase2: 80, hurt: 80, death: 95 };
/**
 * The source sheets were drawn at different sizes (idle/hurt large, combo ~0.68× the attack sheet):
 * per-action scale so the standing commander is ~105px tall (body 40×88, a little larger than the vanguard).
 */
const SCALE: Record<Action, number> = { idle: 0.77, walk: 1.02, attack: 0.98, charge: 1.04, combo: 1.44, phase2: 0.77, hurt: 0.8, death: 0.9 };

const pick = (frames: readonly number[], u: number) => frames[Math.min(frames.length - 1, Math.max(0, Math.floor(u * frames.length)))];

/** Domain pattern → art: frames during windup / each active hit / recovery (damage timing stays in the domain). */
function patternFrame(b: Boss, t: number): { action: Action; index: number } {
  const p = b.pattern!;
  const el = t - b.patternStart;
  const act = p.activeMsPerHit ?? 100;
  const hits = p.hitCount ?? 1;
  const spacing = p.hitSpacingMs ?? 0;
  const end = p.startupMs + (hits - 1) * spacing + act;
  const rec = Math.max(1, b.recoveryMs(p));
  switch (p.id) {
    case 'double_thrust': { // combo: 01–03 windup, hit 1 = 04–05, gap 06, hit 2 = 07, 08 recovery
      if (el < p.startupMs) return { action: 'combo', index: pick([0, 1, 2], el / p.startupMs) };
      const second = p.startupMs + spacing;
      if (el < p.startupMs + act) return { action: 'combo', index: pick([3, 4], (el - p.startupMs) / act) };
      if (el < second) return { action: 'combo', index: 5 };
      if (el < end) return { action: 'combo', index: 6 };
      return { action: 'combo', index: 7 };
    }
    case 'long_thrust': // charge (lunge thrust): 01–02 windup, 03–04 thrust, 05–06 recovery
    case 'sweep':       // attack: 01–02 windup, 03–04 strike, 05–06 recovery
    case 'red_jump_slam': { // attack: 01 crouch, 02 spear overhead while airborne, 03–04 slam, 05–06 recovery
      const action: Action = p.id === 'long_thrust' ? 'charge' : 'attack';
      if (el < p.startupMs) return { action, index: pick([0, 1], el / p.startupMs) };
      if (el < end) return { action, index: pick([2, 3], (el - p.startupMs) / (end - p.startupMs)) };
      return { action, index: pick([4, 5], (el - end) / rec) };
    }
    default:
      return { action: 'idle', index: Math.floor(t / 200) % 4 };
  }
}

export interface SpearCaptainPose { frame: string; scale: number; originX: number; originY: number }

export function spearCaptainPose(b: Boss, v: VanguardView): SpearCaptainPose {
  const t = v.t;
  let action: Action = 'idle';
  let index = Math.floor(t / 200) % 4;
  switch (b.state) {
    case 'move': {
      action = 'walk';
      const i = Math.floor(t / 125) % 6;
      index = b.body.vx !== 0 && Math.sign(b.body.vx) !== b.facing ? 5 - i : i; // backing off: reversed walk
      break;
    }
    case 'windup': case 'hits': case 'recover':
      if (b.pattern) ({ action, index } = patternFrame(b, t));
      break;
    case 'stunned': action = 'hurt'; index = Math.min(3, Math.floor(((t - b.stateT) / DEFAULTS.combat.parryStunBossMs) * 4)); break;
    case 'transition': action = 'phase2'; index = Math.min(3, Math.floor(v.transitionProgress * 4)); break;
    case 'dead': action = 'death'; index = Math.min(5, Math.floor((v.deadMs / 900) * 6)); break;
    default: break;
  }
  const fx = FEET_X[action] / CELL_W;
  return {
    frame: name(action, index),
    scale: SCALE[action],
    originX: b.facing < 0 ? 1 - fx : fx,
    originY: (FOOT[action][index] + 1) / CELL_H,
  };
}
