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

  it('markers never move during the warning, even if the player walks onto one; the enemy appears right there', () => {
    const { sim, driver: d } = makeSim(1);
    sim.debugTeleport(sim.arenas[0].spec.lockAtPlayerX + 5);
    d.run(5);
    const before = sim.spawnWarnings.map((w) => w.x);
    sim.player.body.x = before[0];
    let last = before;
    while (!sim.enemies.some((e) => e.alive)) {
      expect(sim.spawnWarnings.map((w) => w.x)).toEqual(before);
      last = sim.spawnWarnings.map((w) => w.x);
      d.run(1);
    }
    expectAtMarkers(sim.enemies.filter((e) => e.alive).map((e) => e.body.x), last);
    // the enemy that appeared next to the player cannot attack during its spawn grace
    const near = sim.enemies.find((e) => e.alive && Math.abs(e.body.x - before[0]) < 1)!;
    expect(near.graceUntil - sim.t).toBeGreaterThan(600);
  });

  it('points are chosen with room to spare: a player running at full speed for the whole warning stays clear', () => {
    for (const round of [1, 2, 3]) {
      const { sim, driver: d } = makeSim(round);
      for (const a of sim.arenas) {
        sim.debugTeleport(a.spec.lockAtPlayerX + 5);
        d.run(2);
        const px = sim.player.body.x;
        for (const w of sim.spawnWarnings) expect(Math.abs(w.x - px), `r${round} ${a.spec.id}`).toBeGreaterThanOrEqual(96 + 117);
        // every later wave warning of this arena must also keep its distance
        for (let w = 0; w < a.totalWaves; w++) {
          sim.debugKillWave();
          for (let n = 0; n < 2100 && sim.spawnWarnings.length === 0 && a.state !== 'cleared'; n++) d.run(1);
          const qx = sim.player.body.x;
          for (const m of sim.spawnWarnings) expect(Math.abs(m.x - qx), `r${round} ${a.spec.id} wave ${w + 2}`).toBeGreaterThanOrEqual(96 + 117);
          d.run(700);
        }
        sim.debugTeleport(a.spec.right + 20);
        d.run(2);
      }
    }
  });

  it('marker ring closes in over the warning time (sim time)', () => {
    expect(spawnWarningProgress(1000, 1650, 1000)).toBe(0);
    expect(spawnWarningProgress(1000, 1650, 1650)).toBe(1);
    expect(spawnWarningProgress(1000, 1650, 2000)).toBe(1);
    expect(spawnRingHalfWidth(0)).toBeGreaterThan(spawnRingHalfWidth(1));
  });
});
