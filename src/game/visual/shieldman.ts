// Khitan shieldman (khitan_shield_enemy_v2) driven by the EXISTING domain AI (src/domain/enemies.ts 'shieldman':
// HP 80, front guard, guard break 800 ms, 650/120/900 ms attack). Converts our enemy state into the package's
// ShieldSnapshot for PhaserShieldEnemyView; the package ShieldEnemyController is never used. Display only.
import type { Enemy } from '../../domain/enemies';
import { SHIELD_ENEMY, type ShieldSnapshot, type ShieldState } from '../enemies/shield/core';

/** The pack's native-size soldier is ~97px tall; 0.8 puts him at the ~78px of the other Khitan infantry. */
export const SHIELDMAN_SCALE = 0.8;

const WINDUP = SHIELD_ENEMY.windupMs;
const ACTIVE = SHIELD_ENEMY.activeMs;

export function shieldmanSnapshot(e: Enemy, t: number): ShieldSnapshot {
  let state: ShieldState = 'idle';
  let elapsed = t - e.stateT;
  switch (e.state) {
    case 'move': state = 'walk'; elapsed = t; break;
    // One continuous attack clock across our windup → active → recover states (package timeline 0–1670 ms).
    case 'windup': state = 'attack'; break;
    case 'active': state = 'attack'; elapsed = WINDUP + (t - e.stateT); break;
    case 'recover': state = 'attack'; elapsed = WINDUP + ACTIVE + (t - e.stateT); break;
    case 'guardBroken': state = 'guard_break'; break;
    case 'stunned': state = 'hurt'; break;
    case 'dead': state = 'death'; elapsed = t - e.deadAt; break;
    default: elapsed = t; break;
  }
  // A front block shows the short block reaction over idle/walk (the block itself is decided by the domain).
  if ((state === 'idle' || state === 'walk') && t - e.lastBlockAt < SHIELD_ENEMY.blockMs) {
    state = 'block';
    elapsed = t - e.lastBlockAt;
  }
  return { x: e.body.x, feetY: e.body.y, facing: e.facing, state, stateElapsedMs: Math.max(0, elapsed), visible: e.state !== 'relocating' };
}
