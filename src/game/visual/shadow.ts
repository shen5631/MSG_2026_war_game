// Hero drop shadow: drawn on the nearest surface under the feet (platform / crate / step top, else the ground).
import type { Solid } from '../../domain/physics';

/** Top y of the closest standable surface at or below the feet at x; falls back to the ground line. */
export function shadowSurfaceY(solids: readonly Solid[], x: number, feetY: number, groundY: number): number {
  let best = groundY;
  for (const s of solids) {
    if (!s.alive || x < s.x || x > s.x + s.w) continue;
    // 1px tolerance: standing on a solid puts the feet exactly on its top.
    if (s.y >= feetY - 1 && s.y < best) best = s.y;
  }
  return best;
}

/** Shrinks and fades as the hero rises above that surface (jumps are ~80px high). */
export function shadowScale(heightAbove: number): number {
  return Math.max(0.45, Math.min(1, 1 - Math.max(0, heightAbove) / 140));
}
