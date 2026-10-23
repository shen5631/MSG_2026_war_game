// Khitan cavalry (khitan_cavalry_enemy_v1) driven by the EXISTING domain AI (src/domain/enemies.ts 'cavalry':
// HP 70, damage 18, charge 260 px/s, trigger 160–320 px, 850 ms windup / ≤600 ms charge / 1000 ms recovery).
// Converts our enemy state into the package's ViewState for PhaserCavalryView; the package CavalryController is
// never used. Display only.
import type { Enemy } from '../../domain/enemies';
import type { ViewState } from '../enemies/cavalry/PhaserCavalryView';
import { CAVALRY, frameForState, type CavalryState } from '../enemies/cavalry/core';

export const CAVALRY_KEY = CAVALRY.atlasKey;
/** Feet anchor (160,192) of the 320×224 frames. */
export const CAVALRY_ORIGIN = { x: CAVALRY.anchorX / CAVALRY.frameWidth, y: CAVALRY.anchorY / CAVALRY.frameHeight };
/** Top of the horse+rider above the feet (~122 px idle, 134 px at the walk peak), for the HP bar. */
export const CAVALRY_ART_HEIGHT = 134;

const ACTIONS = { idle: 4, walk: 6, run: 6, attack: 6, charge: 2, hurt: 4, death: 6 } as const;
export const REQUIRED_CAVALRY_FRAMES = Object.entries(ACTIONS).flatMap(([a, n]) =>
  Array.from({ length: n }, (_, i) => `khitan_cavalry_${a}_${String(i + 1).padStart(2, '0')}.png`),
);

export function cavalrySnapshot(e: Enemy, t: number): ViewState {
  let state: CavalryState = 'idle';
  let elapsedMs = t - e.stateT;
  let durationMs: number | undefined;
  switch (e.state) {
    // Repositioning walk; loops on sim time so it does not restart every idle/move flip.
    case 'move': state = 'walk'; elapsedMs = t; break;
    case 'windup': state = 'windup'; break;
    case 'active': state = 'charge'; break;
    case 'recover': state = 'recovery'; break;
    // Hit flinch (120 ms) and parry stun (1000 ms) both play hurt_01–04 across the stun.
    case 'stunned': case 'guardBroken': state = 'hurt'; durationMs = Math.max(1, e.stunUntil - e.stateT); break;
    case 'dead': state = 'death'; elapsedMs = t - e.deadAt; break;
    default: elapsedMs = t; break;
  }
  return {
    x: e.body.x, feetY: e.body.y, facing: e.facing, state, elapsedMs: Math.max(0, elapsedMs), durationMs,
    visible: e.state !== 'relocating',
  };
}

/** Frame the view will show for this enemy (same function the view uses; for tests). */
export function cavalryFrame(e: Enemy, t: number): string {
  const s = cavalrySnapshot(e, t);
  return frameForState(s.state, s.elapsedMs, s.durationMs);
}
