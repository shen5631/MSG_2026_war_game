import { describe, expect, it } from 'vitest';
import { makeSolid } from '../../src/domain/world';
import { makeSim } from './helpers';

/** Walks right from just left of a single solid of `kind` on open ground; records the player's path. */
function walkInto(kind: 'rock' | 'crate', ms = 1500) {
  const { sim, driver: d } = makeSim();
  for (const s of sim.solids) s.alive = false;
  const x0 = d.player.body.x;
  const solid = makeSolid('test-solid', kind, x0 + 60, sim.groundY);
  sim.solids.push(solid);
  d.moveX = 1;
  const path: { x: number; y: number; onGround: boolean }[] = [];
  for (let i = 0; i < ms; i++) { d.run(1); const b = d.player.body; path.push({ x: b.x, y: b.y, onGround: b.onGround }); }
  return { sim, solid, path, groundY: sim.groundY };
}

describe('automatic hop over low rocks (player)', () => {
  it('walking into a rock pops up onto it and comes back down past it, with no jump input', () => {
    const { solid, path, groundY } = walkInto('rock');
    const peak = Math.min(...path.map((p) => p.y));
    expect(groundY - peak).toBeGreaterThanOrEqual(groundY - solid.y); // rises above the rock top (24 px)
    expect(groundY - peak).toBeLessThanOrEqual(groundY - solid.y + 10); // a small hop, not a full jump (~77 px)
    // never inside the rock (it is cleared or stood on, never walked through)
    for (const p of path) expect(p.x + 16 > solid.x && p.x - 16 < solid.x + solid.w && p.y > solid.y + 0.5).toBe(false);
    const last = path.at(-1)!;
    expect(last.x).toBeGreaterThan(solid.x + solid.w); // carried on past it
    expect(Math.abs(last.y - groundY)).toBeLessThan(1); // and landed back on the ground (physics snaps within 0.5 px)
    expect(last.onGround).toBe(true);
  });

  it('crates are not auto-hopped: they still need a real jump', () => {
    const { solid, path, groundY } = walkInto('crate');
    expect(Math.min(...path.map((p) => p.y))).toBe(groundY);
    expect(path.at(-1)!.x).toBeLessThanOrEqual(solid.x);
  });
});
