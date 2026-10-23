import { describe, expect, it } from 'vitest';
import { DEFAULTS, ENEMY_HP, ENEMY_PATTERNS } from '../../src/config/spec';
import { AttackSlots, Enemy, type EnemyCtx } from '../../src/domain/enemies';
import { EventQueue } from '../../src/domain/events';
import { CAVALRY } from '../../src/game/enemies/cavalry/core';
import { CAVALRY_ORIGIN, CAVALRY_SCALE, REQUIRED_CAVALRY_FRAMES, cavalryFrame, cavalryScale, cavalrySnapshot } from '../../src/game/visual/cavalry';
import { makeSim } from './helpers';

const GROUND = 304;

/** Runs the EXISTING cavalry AI against a still player (optional wall at maxX). */
function run(playerX: number, ms: number, startX = 400, maxX = 2000) {
  const e = new Enemy('cv', 1, 'cavalry', startX, GROUND, -10000, { minX: 0, maxX }, false, 'test');
  const ctx: EnemyCtx = {
    t: 0, dt: 1, playerX, playerY: GROUND, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(1),
    isVisible: () => true, events: new EventQueue(), spawnArrow: () => {}, newId: (p) => `${p}-${Math.random()}`, findSafePoint: () => null,
  };
  const log: { t: number; state: string; frame: string; hit: boolean; facing: number; x: number }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    e.update(ctx);
    log.push({ t, state: e.state, frame: cavalryFrame(e, t), hit: !!e.activeAttack(), facing: e.facing, x: e.body.x });
  }
  return { e, log };
}
const uniq = (xs: string[]) => [...new Set(xs)].sort();
const f = (a: string, i: number) => `khitan_cavalry_${a}_0${i}.png`;

describe('khitan cavalry V6 art on the existing cavalry AI', () => {
  it('keeps HP 70, damage 18, 260 px/s, trigger 160–320, 850 / ≤600 / 1000 ms (same as the package constants)', () => {
    expect(ENEMY_HP.cavalry).toBe(70);
    expect(DEFAULTS.enemy.damage.cavalry).toBe(18);
    expect(DEFAULTS.enemy.speed.cavalry).toBe(260);
    expect(ENEMY_PATTERNS.cavalry).toMatchObject({ chargeTriggerDistance: [160, 320], startupMs: 850, activeMsMax: 600, recoveryMs: 1000 });
    expect(CAVALRY).toMatchObject({ maxHp: 70, damage: 18, chargeSpeed: 260, attackMinRange: 160, attackMaxRange: 320, windupMs: 850, chargeMaxMs: 600, recoveryMs: 1000 });
  });

  it('lists all 34 atlas frames; V6 feet origin (224,220) of 448×256', () => {
    expect(REQUIRED_CAVALRY_FRAMES).toHaveLength(34);
    expect(new Set(REQUIRED_CAVALRY_FRAMES).size).toBe(34);
    expect(CAVALRY_ORIGIN).toEqual({ x: 0.5, y: 220 / 256 });
  });

  it('windup attack_01–03, charge_01/02 only while the lance is live, recovery attack_04–06', () => {
    const { log } = run(400 - 240, 3000);
    expect(uniq(log.filter((l) => l.state === 'windup').map((l) => l.frame))).toEqual([f('attack', 1), f('attack', 2), f('attack', 3)]);
    expect(log.filter((l) => l.state === 'windup').length).toBe(850);
    expect(uniq(log.filter((l) => l.hit).map((l) => l.frame))).toEqual([f('charge', 1), f('charge', 2)]);
    expect(uniq(log.filter((l) => l.state === 'recover').map((l) => l.frame))).toEqual([f('attack', 4), f('attack', 5), f('attack', 6)]);
    // no hitbox outside the charge (no standing horse-body damage)
    expect(log.filter((l) => l.hit && l.state !== 'active')).toEqual([]);
  });

  it('charge lasts at most 600 ms at 260 px/s, and ends at a wall', () => {
    const open = run(400 - 240, 3000).log.filter((l) => l.state === 'active');
    expect(open.length).toBeLessThanOrEqual(600);
    expect(Math.abs(open.at(-1)!.x - open[0].x)).toBeCloseTo(260 * (open.length - 1) / 1000, 0);
    // player 200 px to the right beyond a wall at x 520: the charge stops at the wall early
    const walled = run(600, 3000, 400, 520).log;
    const act = walled.filter((l) => l.state === 'active');
    expect(act.length).toBeGreaterThan(0);
    expect(act.length).toBeLessThan(600);
    expect(Math.max(...walled.map((l) => l.x))).toBeLessThanOrEqual(520 - 32);
    expect(walled.some((l) => l.state === 'recover')).toBe(true);
  });

  it('the charge frames (drawn ~1.25× larger) are shown smaller so the horse keeps one size', () => {
    const { log, e } = run(400 - 240, 3000);
    expect(log.some((l) => l.state === 'active')).toBe(true);
    e.state = 'active';
    expect(cavalryScale(e)).toBeCloseTo(CAVALRY_SCALE * 0.8);
    for (const s of ['idle', 'move', 'windup', 'recover', 'stunned', 'dead'] as const) { e.state = s; expect(cavalryScale(e)).toBe(CAVALRY_SCALE); }
  });

  it('faces the player on either side (flipX from facing)', () => {
    expect(run(400 - 240, 30).log.at(-1)!.facing).toBe(-1);
    expect(run(400 + 240, 30).log.at(-1)!.facing).toBe(1);
    const e = new Enemy('cv2', 2, 'cavalry', 400, GROUND, 0, { minX: 0, maxX: 800 }, false, 'test');
    e.facing = -1;
    expect(cavalrySnapshot(e, 10).facing).toBe(-1);
  });

  it('one charge hits the player once for 18, no repeat from the same attack ID', () => {
    const { sim, driver: d } = makeSim();
    for (const so of sim.solids) so.alive = false; // open ground: a prop near the start would end the charge (wall stop)
    const px = d.player.body.x;
    const e = new Enemy('cv3', 3, 'cavalry', px + 200, sim.groundY, sim.t - 10000, { minX: 0, maxX: sim.spec.worldWidth }, false, 'test');
    e.facing = -1;
    sim.enemies.push(e);
    const hp0 = d.player.hp;
    d.run(850 + 600 + 1000 + 100);
    expect(hp0 - d.player.hp).toBe(18);
  });

  it('a parry cancels the charge into the hurt pose; death plays death_01→06 and counts one kill', () => {
    const slots = new AttackSlots(1);
    const e = new Enemy('cv4', 4, 'cavalry', 400, GROUND, -10000, { minX: 0, maxX: 800 }, false, 'test');
    e.state = 'active';
    e.attackId = 'a1';
    e.parryStun(slots, 1000);
    expect(e.state).toBe('stunned');
    expect(e.activeAttack()).toBeNull();
    expect(cavalryFrame(e, 1000)).toBe(f('hurt', 1));
    expect(cavalryFrame(e, 1999)).toBe(f('hurt', 4));
    const { sim, recorder } = makeSim();
    const d = new Enemy('cv5', 5, 'cavalry', sim.player.body.x + 200, sim.groundY, sim.t - 10000, { minX: 0, maxX: sim.spec.worldWidth }, false, 'test');
    d.update = () => {};
    sim.enemies.push(d);
    sim.debugKillWave();
    sim.debugKillWave();
    expect(d.state).toBe('dead');
    expect(recorder.stats.normalEnemyKills).toBe(1);
    expect(cavalryFrame(d, d.deadAt)).toBe(f('death', 1));
    expect(cavalryFrame(d, d.deadAt + 2000)).toBe(f('death', 6));
  });
});
