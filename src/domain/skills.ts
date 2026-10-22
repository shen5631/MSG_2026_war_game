// Command skill helpers that do not depend on the player state machine.
import { DEFAULTS, LOCKED } from '../config/spec';

export interface SpearCandidate {
  id: string;
  x: number;
  y: number;
  targetable: boolean;
  blockedByWall: boolean;
  spawnSerial: number;
  isBoss: boolean;
}

/** Up to 5 nearest targets in total (both sides), distance then spawn serial. 50 damage each, never split. */
export function nearestSpearTargets(px: number, py: number, candidates: SpearCandidate[]): SpearCandidate[] {
  const rx = DEFAULTS.skills.spearRangeX;
  const ry = DEFAULTS.skills.spearRangeY;
  return candidates
    .filter((c) => c.targetable && !c.blockedByWall && Math.abs(c.x - px) <= rx && Math.abs(c.y - py) <= ry)
    .map((c) => ({ c, d: (c.x - px) ** 2 + (c.y - py) ** 2 }))
    .sort((a, b) => a.d - b.d || a.c.spawnSerial - b.c.spawnSerial)
    .slice(0, LOCKED.skills.spear_support.maxTargets)
    .map((x) => x.c);
}

export const SPEAR_DAMAGE = LOCKED.skills.spear_support.damagePerTarget;
