import { describe, expect, it } from 'vitest';
import { ENEMY_HP, ENEMY_PATTERNS } from '../../src/config/spec';
import { AttackSlots, Enemy, type EnemyCtx } from '../../src/domain/enemies';
import { EventQueue } from '../../src/domain/events';
import { frameForState } from '../../src/game/enemies/shield/core';
import { shieldmanSnapshot } from '../../src/game/visual/shieldman';
import { addDummy, makeSim } from './helpers';

const GROUND = 304;
const frameOf = (e: Enemy, t: number) => { const s = shieldmanSnapshot(e, t); return frameForState(s.state, s.stateElapsedMs); };

/** Runs the EXISTING shieldman AI against a still player. */
function run(playerX: number, ms: number) {
  const e = new Enemy('sh', 1, 'shieldman', 400, GROUND, 0, { minX: 0, maxX: 800 }, false, 'test');
  const ctx: EnemyCtx = {
    t: 0, dt: 1, playerX, playerY: GROUND, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(1),
    isVisible: () => true, events: new EventQueue(), spawnArrow: () => {}, newId: (p) => `${p}-${Math.random()}`, findSafePoint: () => null,
  };
  const log: { state: string; frame: string; hit: boolean; facing: number }[] = [];
  for (let t = 1; t <= ms; t++) { ctx.t = t; e.update(ctx); log.push({ state: e.state, frame: frameOf(e, t), hit: !!e.activeAttack(), facing: e.facing }); }
  return log;
}
const uniq = (xs: string[]) => [...new Set(xs)].sort();

describe('khitan shieldman V2 art on the existing AI', () => {
  it('keeps HP 80 and the 650 / 120 / 900 ms attack', () => {
    expect(ENEMY_HP.shieldman).toBe(80);
    expect(ENEMY_PATTERNS.shieldman).toMatchObject({ startupMs: 650, activeMs: 120, recoveryMs: 900 });
  });

  it('windup attack_01–04, the shield strike attack_05 exactly while the hitbox is live, then recovery', () => {
    const log = run(400 - 50, 4000);
    expect(uniq(log.filter((l) => l.state === 'windup').map((l) => l.frame))).toEqual(['attack/attack_01.png', 'attack/attack_02.png', 'attack/attack_03.png', 'attack/attack_04.png']);
    expect(uniq(log.filter((l) => l.hit).map((l) => l.frame))).toEqual(['attack/attack_05.png']);
    expect(uniq(log.filter((l) => l.state === 'recover').map((l) => l.frame))).toContain('attack/attack_06.png');
  });

  it('faces the player on either side (flipX from facing)', () => {
    expect(shieldmanSnapshotFacing(400 - 200)).toBe(-1);
    expect(shieldmanSnapshotFacing(400 + 200)).toBe(1);
  });

  it('one attack hits the player once (10 damage), never per animation frame', () => {
    const { sim, driver: d } = makeSim();
    const px = d.player.body.x;
    const e = new Enemy('sh2', 2, 'shieldman', px + 40, sim.groundY, sim.t - 10000, { minX: 0, maxX: sim.spec.worldWidth }, false, 'test');
    e.facing = -1;
    sim.enemies.push(e);
    const hp0 = d.player.hp;
    d.run(650 + 120 + 50); // through one full active window
    expect(hp0 - d.player.hp).toBe(10);
  });

  it('front weak hit is blocked (block pose); back hit and spear support pierce; front heavy breaks the guard', () => {
    const slots = new AttackSlots(1);
    const e = new Enemy('sh3', 3, 'shieldman', 400, GROUND, -10000, { minX: 0, maxX: 800 }, false, 'test');
    e.facing = -1;
    expect(e.takeHit(10, 'weak1', 350, slots, 1000)).toBe('blocked');
    expect(e.hp).toBe(80);
    expect(frameOf(e, 1030)).toBe('guard/guard_02.png'); // block reaction guard_02 → 03 → 01 (55 ms each)
    expect(frameOf(e, 1080)).toBe('guard/guard_03.png');
    expect(frameOf(e, 1300).startsWith('idle/')).toBe(true); // back to the stance after 165 ms
    expect(e.takeHit(10, 'weak1', 450, slots, 2000)).toBe('hit'); // from behind
    expect(e.takeHit(5, null, 350, slots, 3000)).toBe('hit');      // spear support pierces
    expect(e.hp).toBe(65);
    const f = new Enemy('sh4', 4, 'shieldman', 400, GROUND, -10000, { minX: 0, maxX: 800 }, false, 'test');
    f.facing = -1;
    expect(f.takeHit(25, 'heavy', 350, slots, 1000)).toBe('hit');
    expect(f.state).toBe('guardBroken');
    expect(frameOf(f, 1000)).toBe('guard_break/guard_break_01.png');
    expect(frameOf(f, 1650)).toBe('guard_break/guard_break_04.png');
  });

  it('death plays death_01→05 and counts one kill even if hit again', () => {
    const { sim, recorder } = makeSim();
    const e = addDummy(sim, 'shieldman', sim.player.body.x + 60);
    sim.debugKillWave();
    sim.debugKillWave();
    expect(e.state).toBe('dead');
    expect(recorder.stats.normalEnemyKills).toBe(1);
    expect(frameOf(e, e.deadAt)).toBe('death/death_01.png');
    expect(frameOf(e, e.deadAt + 2000)).toBe('death/death_05.png');
  });
});

function shieldmanSnapshotFacing(playerX: number): number {
  const log = run(playerX, 30);
  return log.at(-1)!.facing;
}
