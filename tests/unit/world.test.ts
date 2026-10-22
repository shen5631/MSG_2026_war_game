import { describe, expect, it } from 'vitest';
import { LEVELS, BOSS_PATTERNS } from '../../src/config/spec';
import { WaveDirector } from '../../src/domain/waves';
import { choosePattern } from '../../src/domain/boss';
import { Enemy, AttackSlots } from '../../src/domain/enemies';
import { makeSim } from './helpers';

describe('wave director (T069, T071)', () => {
  it('T069 next wave spawns exactly 2000ms after the last kill', () => {
    const d = new WaveDirector(LEVELS.rounds[0].arenas[0]);
    d.lock(0);
    expect(d.update(649)).toEqual([]);
    expect(d.update(650)).toEqual([{ type: 'spawn', waveIndex: 0 }]);
    d.registerSpawned(['a', 'b']);
    d.onEnemyGone('a', 1000);
    expect(d.onEnemyGone('b', 1000)).toEqual([{ type: 'waveCleared', waveIndex: 0 }]);
    expect(d.update(2349)).toEqual([]);
    expect(d.update(2350)).toEqual([{ type: 'warn', waveIndex: 1 }]);
    expect(d.update(2999)).toEqual([]);
    expect(d.update(3000)).toEqual([{ type: 'spawn', waveIndex: 1 }]);
  });
  it('T071 last wave clears once, no extra empty wave, duplicate gone ignored', () => {
    const d = new WaveDirector(LEVELS.rounds[0].arenas[0]);
    d.lock(0);
    d.update(650);
    for (let w = 0; w < 3; w++) {
      d.registerSpawned([`w${w}`]);
      const ev = d.onEnemyGone(`w${w}`, 1000 * (w + 1) * 10);
      if (w < 2) {
        expect(ev).toEqual([{ type: 'waveCleared', waveIndex: w }]);
        d.update(1000 * (w + 1) * 10 + 2000);
      } else {
        expect(ev).toEqual([{ type: 'waveCleared', waveIndex: 2 }, { type: 'arenaCleared' }]);
      }
    }
    expect(d.onEnemyGone('w2', 99999)).toEqual([]);
    expect(d.update(999999)).toEqual([]);
  });
});

describe('boss pattern choice (T082)', () => {
  const ctx = (over: Partial<Parameters<typeof choosePattern>[1]>) => ({
    phase: 1 as 1 | 2, dist: 50, t: 0, lastUsed: new Map(), cooldownUntil: new Map(), consecutive: { id: null, count: 0 }, summonNeeded: false, ...over,
  });
  it('picks by distance and phase', () => {
    const v = BOSS_PATTERNS.vanguard;
    expect(choosePattern(v, ctx({ dist: 60 })).pattern?.id).toBe('sword_cut');
    expect(choosePattern(v, ctx({ dist: 200 })).pattern?.id).toBe('rush');
    expect(choosePattern(v, ctx({ dist: 400 })).move).toBe(1);
    expect(choosePattern(v, ctx({ dist: 120 })).move).not.toBe(0);
    // phase 2 specials take priority in range
    const p2 = choosePattern(v, ctx({ phase: 2, dist: 60 })).pattern?.id;
    expect(['red_slam', 'triple_cut']).toContain(p2);
  });
  it('limits the same pattern to 2 in a row', () => {
    const v = BOSS_PATTERNS.vanguard;
    const r = choosePattern(v, ctx({ dist: 60, consecutive: { id: 'sword_cut', count: 2 } }));
    expect(r.pattern).toBeNull();
    expect(r.move).toBe(-1);
  });
  it('so_bae_ap summons first in phase 2 when needed', () => {
    expect(choosePattern(BOSS_PATTERNS.so_bae_ap, ctx({ phase: 2, summonNeeded: true })).pattern?.id).toBe('summon');
  });
});

describe('attack slots', () => {
  it('round 1 allows a single attacker', () => {
    const s = new AttackSlots(1);
    expect(s.tryAcquire('a')).toBe(true);
    expect(s.tryAcquire('b')).toBe(false);
    s.release('a');
    expect(s.tryAcquire('b')).toBe(true);
  });
  it('boss keeps priority over summons', () => {
    const s = new AttackSlots(2);
    s.bossId = 'boss';
    expect(s.tryAcquire('m1')).toBe(true);
    expect(s.tryAcquire('m2')).toBe(false);
    expect(s.tryAcquire('boss', true)).toBe(true);
  });
});

describe('round simulation', () => {
  it('arena locks, spawns the exact composition and opens with one herb', () => {
    const { sim, driver: d, recorder } = makeSim(1);
    sim.debugTeleport(1210);
    d.run(20);
    expect(sim.lockedBounds).toEqual({ minX: 960, maxX: 1600 });
    d.run(700);
    expect(sim.enemies.map((e) => e.kind).sort()).toEqual(['infantry', 'infantry']);
    for (let w = 0; w < 3; w++) {
      sim.debugKillWave();
      d.run(2100);
    }
    expect(recorder.stats.normalEnemyKills).toBe(9);
    expect(sim.lockedBounds).toBeNull();
    expect(sim.pickups.filter((p) => p.kind === 'herb').length).toBe(1);
    // Leaving the arena cleans up its items and blocks backtracking.
    sim.debugTeleport(1640);
    d.run(5);
    expect(sim.pickups.length).toBe(0);
    expect(sim.minX).toBe(1600);
  });

  it('spawn safety moves a slot away from the player without changing kinds', () => {
    const { sim } = makeSim(1);
    sim.debugTeleport(960 + 72);
    const plan = sim.chooseSpawnSlots(sim.arenas[0], ['infantry', 'infantry', 'archer']);
    expect(plan.map((p) => p.kind)).toEqual(['infantry', 'infantry', 'archer']);
    for (const p of plan) expect(Math.abs(p.x - sim.player.body.x)).toBeGreaterThanOrEqual(96);
  });

  const toBoss = (round: number) => {
    const h = makeSim(round);
    const { sim, driver: d } = h;
    for (let a = 0; a < sim.arenas.length; a++) {
      sim.debugTeleport(sim.arenas[a].spec.lockAtPlayerX + 5);
      d.run(700);
      for (let w = 0; w < sim.arenas[a].totalWaves; w++) {
        sim.debugKillWave();
        d.run(2100);
      }
      sim.debugTeleport(sim.arenas[a].spec.right + 20);
      d.run(5);
    }
    sim.debugTeleport(sim.spec.bossArena.playerEntryX + 2);
    d.run(5);
    d.run(820); // intro (presentation freeze)
    return h;
  };

  it('T078/T079/T081 phase 2 at half HP, overflow kept, invulnerable during transition', () => {
    const { sim, driver: d } = toBoss(1);
    expect(sim.bossStage).toBe('fight');
    const boss = sim.boss!;
    sim.debugDamageBoss(200); // 350 -> 150 crosses 175
    d.run(1);
    expect(boss.state).toBe('transition');
    expect(boss.hp).toBe(150);
    sim.debugDamageBoss(50);
    expect(boss.hp).toBe(150);
    d.run(950);
    expect(boss.phase).toBe(2);
  });

  it('T080 lethal hit in phase 1 wins without a transition', () => {
    const { sim, driver: d } = toBoss(2);
    sim.debugDamageBoss(9999);
    d.run(1);
    expect(sim.outcome).toBe('victory');
    expect(sim.boss!.phase).toBe(1);
  });

  it('T083/T084 so_bae_ap summons never exceed 3; victory removes them without kills', () => {
    const { sim, driver: d, recorder } = toBoss(3);
    sim.debugDamageBoss(360);
    d.run(1000);
    expect(sim.boss!.phase).toBe(2);
    let maxSeen = 0;
    sim.player.invulnUntil = Infinity;
    for (let i = 0; i < 30000; i += 50) {
      d.run(50);
      maxSeen = Math.max(maxSeen, sim.livingSummons() + sim.boss!.pendingSummons);
      if (sim.outcome) break;
    }
    expect(maxSeen).toBeGreaterThan(0);
    expect(maxSeen).toBeLessThanOrEqual(3);
    const killsBefore = recorder.stats.normalEnemyKills;
    sim.player.hp = 100;
    sim.debugDamageBoss(9999);
    d.run(1);
    expect(sim.outcome).toBe('victory');
    expect(sim.enemies.filter((e) => e.alive).length).toBe(0);
    expect(recorder.stats.normalEnemyKills).toBe(killsBefore);
    expect(recorder.stats.bossKills).toBe(1);
  });

  it('T085 same-tick player and boss death resolves as victory with no death count', () => {
    const { sim, driver: d, recorder } = toBoss(1);
    sim.player.hp = 0;
    sim.boss!.hp = 0;
    d.run(1);
    expect(sim.outcome).toBe('victory');
    expect(recorder.stats.deaths).toBe(0);
  });

  it('T086 an earlier game over is not overturned', () => {
    const { sim, driver: d } = toBoss(1);
    sim.player.hp = 0;
    d.run(1);
    expect(sim.outcome).toBe('defeat');
    sim.boss!.hp = 0;
    d.run(5);
    expect(sim.outcome).toBe('defeat');
  });

  it('T100/T101 stuck enemy relocates keeping its id; failing search removes it technically', () => {
    const { sim, recorder } = makeSim(1);
    const e = new Enemy('stuck', 1, 'infantry', 1000, 304, 0, { minX: 960, maxX: 1600 }, false, 'r1a1');
    e.beginRelocation({ t: 0, slots: sim.slots, findSafePoint: () => 1500 });
    expect(e.state).toBe('relocating');
    const ctx = { t: 700, dt: 16, playerX: 1100, playerY: 304, playerAlive: true, solids: [], groundY: 304, slots: sim.slots, isVisible: () => true, events: sim.events, spawnArrow: () => {}, newId: sim.newId, findSafePoint: () => null };
    e.update(ctx);
    expect(e.id).toBe('stuck');
    expect(e.body.x).toBe(1500);
    const f = new Enemy('nowhere', 2, 'infantry', 1000, 304, 0, { minX: 960, maxX: 1600 }, false, 'r1a1');
    f.beginRelocation({ t: 0, slots: sim.slots, findSafePoint: () => null });
    for (let t = 500; t <= 3000; t += 500) f.update({ ...ctx, t });
    expect(f.technicalRemoved).toBe(true);
    expect(recorder.stats.normalEnemyKills).toBe(0);
  });
});

describe('terrain layout', () => {
  it('extra terrain and props stay out of combat and boss arenas', async () => {
    const { buildSolids } = await import('../../src/domain/world');
    for (const r of LEVELS.rounds) {
      const solids = buildSolids(r);
      for (const s of solids.filter((x) => !x.id.includes('b'))) {
        for (const a of r.arenas) expect(s.x + s.w <= a.left || s.x >= a.right).toBe(true);
        expect(s.x + s.w).toBeLessThanOrEqual(r.bossArena.left);
        expect(s.h).toBeLessThanOrEqual(48); // jumpable (spec §5.1: 32~48px obstacles)
      }
      const ba = r.bossArena;
      for (const s of solids.filter((x) => x.id.includes('b'))) {
        expect(Math.abs(s.x + s.w / 2 - ba.playerEntryX)).toBeGreaterThan(40);
        expect(Math.abs(s.x + s.w / 2 - ba.bossSpawnX)).toBeGreaterThan(40);
      }
    }
  });
});
