// Round-2 boss '정예 창병장' — elite_spearman_v2 art driven by the EXISTING domain Boss AI
// (src/domain/boss.ts 'spear_captain': HP 500, phase 2 at 250, distance/phase pattern choice, red telegraph).
// The package's EliteSpearmanController is never instantiated: our Boss state is converted to its Snapshot and
// the package's visualFor() picks the frame. 320×192 frames, feet anchor (160,176), native scale 1, nearest filter.
import { DEFAULTS } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import { FRAME_COUNTS, SPRITE, type PatternId } from '../bosses/elite_spearman/config';
import type { Snapshot } from '../bosses/elite_spearman/EliteSpearmanController';
import { visualFor } from '../bosses/elite_spearman/presentation';
import type { VanguardView } from './vanguard';

export const SPEAR_CAPTAIN_KEY = SPRITE.textureKey;
export const SPEAR_CAPTAIN_ORIGIN = { x: SPRITE.anchorX / SPRITE.width, y: SPRITE.anchorY / SPRITE.height } as const;
export const REQUIRED_SPEAR_CAPTAIN_FRAMES = (Object.keys(FRAME_COUNTS) as (keyof typeof FRAME_COUNTS)[]).flatMap((a) =>
  Array.from({ length: FRAME_COUNTS[a] }, (_, i) => `${a}_${String(i + 1).padStart(2, '0')}`));

const PATTERN_IDS = new Set<string>(['long_thrust', 'sweep', 'double_thrust', 'red_jump_slam']);
/** Our jump leaps during the LAST 300 ms of the 900 ms windup (domain JUMP_AIR_MS) and lands at 900. */
const JUMP_LEAP_AT = 600;

/**
 * The package times its jump with a 650 ms airborne phase AFTER the windup; our domain lands at the end of the
 * windup, so the jump frames follow our clock: crouch → spear up → airborne → landing slam (hit) → recover.
 */
function jumpFrame(elapsed: number, startupMs: number, activeMs: number, recoveryMs: number): string {
  const i = elapsed < JUMP_LEAP_AT / 2 ? 0 : elapsed < JUMP_LEAP_AT ? 1 : elapsed < startupMs ? 2
    : elapsed < startupMs + activeMs ? 3 : elapsed < startupMs + activeMs + recoveryMs / 2 ? 4 : 5;
  return `jump_slam_0${i + 1}`;
}

export function spearCaptainFrame(b: Boss, v: VanguardView): string {
  const t = v.t;
  let action: Snapshot['action'] = 'idle';
  let elapsed = t;
  let pattern: PatternId | null = null;
  switch (b.state) {
    case 'move': action = 'walk'; break;
    case 'windup': case 'hits': case 'recover':
      if (b.pattern && PATTERN_IDS.has(b.pattern.id)) {
        action = 'attack';
        pattern = b.pattern.id as PatternId;
        elapsed = t - b.patternStart;
        if (pattern === 'red_jump_slam') return jumpFrame(elapsed, b.pattern.startupMs, b.pattern.activeMsPerHit ?? 180, b.recoveryMs(b.pattern));
      }
      break;
    case 'stunned': action = 'parry_stagger'; elapsed = ((t - b.stateT) / DEFAULTS.combat.parryStunBossMs) * 650; break;
    case 'transition': action = 'phase2'; elapsed = v.transitionProgress * 900; break;
    case 'dead': action = 'death'; elapsed = v.deadMs; break;
    default: break;
  }
  const snap: Snapshot = {
    x: b.body.x, y: b.body.y, groundY: b.body.y, facing: b.facing, hp: b.hp, phase: b.phase,
    action, elapsedMs: Math.max(0, elapsed), pattern, recoveryMs: b.pattern ? b.recoveryMs(b.pattern) : 0,
    isInvulnerable: b.invulnerable, redWarning: b.redTelegraph, dead: b.state === 'dead',
    jumpTargetX: null, pauseWorld: false, visible: true,
  };
  return visualFor(snap).frameName;
}
