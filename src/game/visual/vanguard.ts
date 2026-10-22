// Round-1 boss (거란군 선봉대장) — V2 art driven by the EXISTING domain Boss AI (src/domain/boss.ts).
// Only frame choice lives here: the package's VanguardBossController is never instantiated or updated,
// so there is exactly one AI per boss. Hits, parry, phase and victory stay in the domain simulation.
import { DEFAULTS } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import {
  BOSS_ORIGIN, BOSS_TEXTURE_KEY, FRAME_COUNTS, attackFrame, frameKey,
  type Action, type PatternId,
} from '../bosses/vanguard/VanguardBoss';

export const VANGUARD_KEY = BOSS_TEXTURE_KEY;
/** Feet root (96,176) of the 192×192 frames. */
export const VANGUARD_ORIGIN = BOSS_ORIGIN;
export const REQUIRED_VANGUARD_FRAMES = (Object.keys(FRAME_COUNTS) as Action[]).flatMap((a) =>
  Array.from({ length: FRAME_COUNTS[a] }, (_, i) => frameKey(a, i)));

/** Domain pattern id → V2 action (identical startup/active/recovery timings, see tests/unit/vanguard.test.ts). */
export const VANGUARD_PATTERN_ACTION: Record<string, PatternId> = {
  sword_cut: 'slash',
  rush: 'dash_slash',
  triple_cut: 'combo_3hit',
  red_slam: 'heavy_smash',
};

const DEATH_MS = 900;

export interface VanguardView {
  /** Sim time (frozen during hitstop / transition). */
  t: number;
  /** 0..1 progress of the phase-2 transition freeze. */
  transitionProgress: number;
  /** Ms since the boss died (victory hold keeps running). */
  deadMs: number;
}

export function vanguardFrame(b: Boss, v: VanguardView): string {
  const t = v.t;
  switch (b.state) {
    case 'move': {
      // Faces the player while backing off: reverse the walk cycle (no dedicated retreat frames).
      const i = Math.floor(t / 125) % 6;
      const backing = b.body.vx !== 0 && Math.sign(b.body.vx) !== b.facing;
      return frameKey('walk', backing ? 5 - i : i);
    }
    case 'windup':
    case 'hits':
    case 'recover': {
      const action = b.pattern ? VANGUARD_PATTERN_ACTION[b.pattern.id] : undefined;
      if (!action || !b.pattern) return frameKey('idle', Math.floor(t / 200) % 4);
      // Elapsed from the pattern start, the same clock the domain uses for its hit windows.
      return attackFrame(action, t - b.patternStart, b.recoveryMs(b.pattern));
    }
    case 'stunned': return frameKey('parry_stagger', Math.floor(((t - b.stateT) / DEFAULTS.combat.parryStunBossMs) * 4));
    case 'transition': return frameKey('phase2_transition', Math.floor(v.transitionProgress * 4));
    case 'dead': return frameKey('death', Math.floor((v.deadMs / DEATH_MS) * 6));
    default: return frameKey('idle', Math.floor(t / 200) % 4);
  }
}
