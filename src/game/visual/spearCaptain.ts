// Round-2 boss '정예 창병장' (elite_spearman_commander_round2_boss_game_ready_v2) driven by the EXISTING domain Boss AI
// (src/domain/boss.ts 'spear_captain': HP 500, phase 2 at 250, distance/phase pattern choice, red telegraph).
// Only frame choice and alignment live here. Frames come from a 0.3× display copy of the supplied v2 atlas
// (scripts/downscale-atlas.mjs: same scenes/names, never re-split) — the original 640×640 cells would be shown
// at ~0.2× and alias badly.
import { DEFAULTS } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import type { VanguardView } from './vanguard';

export const SPEAR_CAPTAIN_KEY = 'elite_spearman_commander';
const CELL_W = 192;
const CELL_H = 192;

const COUNTS = { idle: 4, walk: 6, attack: 6, charge: 6, combo: 8, phase2: 4, hurt: 4, death: 6 } as const;
type Action = keyof typeof COUNTS;
const name = (a: Action, i: number) => `elite_spearman_commander_${a}_0${i + 1}.png`;
export const REQUIRED_SPEAR_CAPTAIN_FRAMES = (Object.keys(COUNTS) as Action[]).flatMap((a) => Array.from({ length: COUNTS[a] }, (_, i) => name(a, i)));

/**
 * Bottom row of the boots per frame (display atlas, measured on dark opaque pixels). The pack says every frame is
 * aligned to y=622 (186.6 here); the drawings actually end between 151 and 185.
 */
const FOOT: Record<Action, number[]> = {
  idle: [176, 176, 174, 174], walk: [178, 178, 178, 165, 165, 165], attack: [178, 178, 178, 161, 161, 161],
  charge: [170, 169, 170, 153, 153, 151], combo: [183, 182, 182, 183, 160, 161, 160, 161],
  phase2: [185, 184, 154, 166], hurt: [178, 180, 166, 169], death: [185, 185, 185, 158, 166, 169],
};
/**
 * Boots centre per frame (the figure is not centred on the cell; flipX mirrors around the cell). Lunge frames keep
 * their own value so the body visibly drives forward over the planted feet; hurt/phase2 use one value because their
 * spear tips / flames hide the boots.
 */
const FEET_X: Record<Action, number[]> = {
  idle: [124, 124, 125, 126], walk: [95, 105, 102, 104, 103, 102], attack: [106, 101, 69, 93, 97, 86],
  charge: [93, 62, 54, 53, 50, 74], combo: [90, 101, 85, 102, 93, 99, 68, 106],
  phase2: [95, 95, 95, 95], hurt: [110, 110, 110, 110], death: [112, 101, 107, 103, 122, 122],
};
/** The v2 sheets are still drawn at different sizes (idle/phase2/hurt/death large): standing commander ≈105px. */
const SCALE: Record<Action, number> = { idle: 0.77, walk: 1, attack: 1, charge: 1, combo: 1, phase2: 0.8, hurt: 0.8, death: 0.8 };

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
  const fx = FEET_X[action][index] / CELL_W;
  return {
    frame: name(action, index),
    scale: SCALE[action],
    originX: b.facing < 0 ? 1 - fx : fx,
    originY: (FOOT[action][index] + 1) / CELL_H,
  };
}
