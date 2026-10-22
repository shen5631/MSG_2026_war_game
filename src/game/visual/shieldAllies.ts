// '방패병 막기' presentation: the two Goryeo shield soldiers are a read-only view of the player's EXISTING
// shield (one shared 40-point shield, decay 8/s, max 5 s — src/domain/damage.ts). No HP, AI, body or timer here.
import { LOCKED } from '../../config/spec';
import type { ShieldSnapshot } from '../skills/shield/core';

const DURATION_MS = LOCKED.skills.shield_guard.maxDurationMs;

export interface ShieldOwner { shield: { value: number; remainingMs: number }; alive: boolean }

/**
 * Snapshot for PhaserShieldView. `elapsedMs` derives from the game's own shield clock (frozen while paused,
 * in hitstop or during a phase transition). Hidden at once on break, death or when the round has ended.
 */
export function shieldSnapshotOf(p: ShieldOwner, roundLive: boolean): ShieldSnapshot {
  const active = roundLive && p.alive && p.shield.value > 0 && p.shield.remainingMs > 0;
  return {
    active,
    remaining: active ? p.shield.value : 0,
    elapsedMs: active ? Math.max(0, DURATION_MS - p.shield.remainingMs) : 0,
    generation: 0, // the pose depends on elapsed time only; casts cannot overlap (5 s shield < shared cooldown)
  };
}
