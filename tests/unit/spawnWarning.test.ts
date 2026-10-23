import { describe, expect, it } from 'vitest';
import { spawnRingHalfWidth, spawnWarningProgress } from '../../src/game/visual/spawnWarning';
import { makeSim } from './helpers';

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
/** Spawned enemies vs the last markers (enemies may already have stepped <1px on their first frame). */
const expectAtMarkers = (enemyX: number[], markers: number[]) => {
  expect(enemyX).toHaveLength(markers.length);
  sorted(enemyX).forEach((x, i) => expect(Math.abs(x - sorted(markers)[i])).toBeLessThan(1));
};

describe('enemy spawn warnings show only the real spawn points', () => {
  it('one marker per enemy, and every enemy appears exactly where a marker stood', () => {
    const { sim, driver: d } = makeSim(1);
    sim.debugTeleport(sim.arenas[0].spec.lockAtPlayerX + 5);
    d.run(5);
    const kinds = sim.arenas[0].spec.waves[0].spawnOrder;
    expect(sim.spawnWarnings).toHaveLength(kinds.length);
    let last = sim.spawnWarnings.map((w) => w.x);
    while (!sim.enemies.some((e) => e.alive)) { last = sim.spawnWarnings.map((w) => w.x); d.run(1); }
    expectAtMarkers(sim.enemies.filter((e) => e.alive).map((e) => e.body.x), last);
    expect(sim.spawnWarnings).toHaveLength(0);
  });

  it('a marker the player walks onto moves at once (others stay), and the enemy spawns at the moved marker', () => {
    const { sim, driver: d } = makeSim(1);
    sim.debugTeleport(sim.arenas[0].spec.lockAtPlayerX + 5);
    d.run(5);
    const before = sim.spawnWarnings.map((w) => w.x);
    const target = before[0];
    sim.player.body.x = target;
    d.run(1);
    const after = sim.spawnWarnings.map((w) => w.x);
    expect(after).toHaveLength(before.length);
    expect(after).not.toContain(target);
    for (const x of after) expect(Math.abs(x - sim.player.body.x)).toBeGreaterThanOrEqual(96);
    // points that stayed safe did not move
    before.forEach((x, i) => { if (Math.abs(x - target) >= 96) expect(after[i]).toBe(x); });
    let last = after;
    while (!sim.enemies.some((e) => e.alive)) { last = sim.spawnWarnings.map((w) => w.x); d.run(1); }
    expectAtMarkers(sim.enemies.filter((e) => e.alive).map((e) => e.body.x), last);
  });

  it('marker ring closes in over the warning time (sim time)', () => {
    expect(spawnWarningProgress(1000, 1650, 1000)).toBe(0);
    expect(spawnWarningProgress(1000, 1650, 1650)).toBe(1);
    expect(spawnWarningProgress(1000, 1650, 2000)).toBe(1);
    expect(spawnRingHalfWidth(0)).toBeGreaterThan(spawnRingHalfWidth(1));
  });
});
