// Khitan cavalry V6 (khitan_cavalry_production_v6, 448×256 frames, feet 224,220) driven by the EXISTING domain AI
// (src/domain/enemies.ts 'cavalry': HP 70, damage 18, charge 260 px/s, trigger 160–320 px, 850 ms windup /
// ≤600 ms charge / 1000 ms recovery).
// Converts our enemy state into the package's CavalryViewState for PhaserCavalryView; the package CavalryController is
// never used. Display only.
import type { Enemy } from '../../domain/enemies';
import type { CavalryViewState } from '../enemies/cavalry/PhaserCavalryView';
import { CAVALRY, frameForState, type CavalryState } from '../enemies/cavalry/core';

export const CAVALRY_KEY = CAVALRY.atlasKey;
/** Feet anchor (224,220) of the 448×256 frames. */
export const CAVALRY_ORIGIN = { x: CAVALRY.anchorX / CAVALRY.frameWidth, y: CAVALRY.anchorY / CAVALRY.frameHeight };
/**
 * Display scale: the V6 horse+rider is ~143 px tall at native size, almost twice the ~78–80 px foot soldiers; 0.7 makes
 * it ~100 px, a little taller than the infantry (rider on horseback). Display only, the body/hitboxes are unchanged.
 */
export const CAVALRY_SCALE = 0.7;
/** Top of the horse+rider above the feet (V6 native: ~144 px idle/attack_01, 147 px charge_02), for the HP bar. */
export const CAVALRY_ART_HEIGHT = Math.round(146 * CAVALRY_SCALE);

const ACTIONS = { idle: 4, walk: 6, run: 6, attack: 6, charge: 2, hurt: 4, death: 6 } as const;
export const REQUIRED_CAVALRY_FRAMES = Object.entries(ACTIONS).flatMap(([a, n]) =>
  Array.from({ length: n }, (_, i) => `khitan_cavalry_${a}_${String(i + 1).padStart(2, '0')}.png`),
);

export function cavalrySnapshot(e: Enemy, t: number): CavalryViewState {
  let state: CavalryState = 'idle';
  let elapsedMs = t - e.stateT;
  let stateDurationMs: number | undefined;
  switch (e.state) {
    // Repositioning walk; loops on sim time so it does not restart every idle/move flip.
    case 'move': state = 'walk'; elapsedMs = t; break;
    case 'windup': state = 'windup'; break;
    case 'active': state = 'charge'; break;
    case 'recover': state = 'recovery'; break;
    // Hit flinch (120 ms) and parry stun (1000 ms) both play hurt_01–04 across the stun.
    case 'stunned': case 'guardBroken': state = 'hurt'; stateDurationMs = Math.max(1, e.stunUntil - e.stateT); break;
    case 'dead': state = 'death'; elapsedMs = t - e.deadAt; break;
    default: elapsedMs = t; break;
  }
  return {
    x: e.body.x, feetY: e.body.y, facing: e.facing, state, elapsedMs: Math.max(0, elapsedMs), stateDurationMs,
    visible: e.state !== 'relocating',
  };
}

/** Frame the view will show for this enemy (same function the view uses; for tests). */
export function cavalryFrame(e: Enemy, t: number): string {
  const s = cavalrySnapshot(e, t);
  return frameForState(s.state, s.elapsedMs, s.stateDurationMs);
}
