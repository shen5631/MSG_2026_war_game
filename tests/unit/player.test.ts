import { describe, expect, it } from 'vitest';
import { addDummy, makeSim } from './helpers';
import { applyUpgrade, emptyUpgrades } from '../../src/domain/upgrades';
import { EventQueue } from '../../src/domain/events';

/** Press B, then Y `gap` ms later (both held). */
function chord(gap: number, first: 'weak' | 'heavy' = 'weak') {
  const { driver: d, sim } = makeSim();
  const second = first === 'weak' ? 'heavy' : 'weak';
  d.press(first).run(1);
  d.run(gap - 1);
  d.press(second).run(1);
  return { d, sim };
}

describe('B+Y chord (T007–T012)', () => {
  it('T007 99/100ms -> charge, 101ms -> single attack', () => {
    expect(chord(99).d.player.mode).toBe('charge');
    expect(chord(100).d.player.mode).toBe('charge');
    const late = chord(101).d.player;
    expect(late.mode).toBe('attack');
    expect(late.attack?.kind).toBe('weak1');
  });
  it('T008 reverse order Y then B also charges', () => {
    expect(chord(60, 'heavy').d.player.mode).toBe('charge');
  });
  it('T009 B released before Y -> no chord', () => {
    const { driver: d } = makeSim();
    d.press('weak').run(30);
    d.release('weak').run(10);
    d.press('heavy').run(1);
    expect(d.player.mode).toBe('attack');
    expect(d.player.attack?.kind).toBe('weak1');
  });
  it('T010 the 100ms chord wait is part of weak1 startup, not added', () => {
    const { driver: d, sim } = makeSim();
    const e = addDummy(sim, 'infantry', 150);
    d.press('weak').run(1);
    d.run(99); // t=100
    expect(e.hp).toBe(40);
    d.run(1); // t=101 = press(1)+100
    expect(e.hp).toBe(30);
  });
  it('T011 holding B with no new press does not auto-repeat', () => {
    const { driver: d } = makeSim();
    d.press('weak').run(1000);
    expect(d.player.mode).toBe('free');
    expect(d.player.comboStep).toBe(0 + 1);
  });
  it('T012/T022 B,B,B then Y = 10+12+15+35 and no new chord with consumed B', () => {
    const { driver: d, sim } = makeSim();
    const e = addDummy(sim, 'shieldman', 150, 1); // back turned → no guard
    d.press('weak').run(200).release('weak').run(150);
    d.press('weak').run(200).release('weak').run(160);
    d.press('weak').run(200);
    // B still held from the third hit; Y now is the finisher, not a charge.
    d.run(240).press('heavy').run(80); // pressed in weak3's last 150ms → buffered finisher
    expect(d.player.mode).toBe('attack');
    expect(d.player.attack?.kind).toBe('finisher');
    d.run(800);
    expect(e.hp).toBe(80 - 72);
  });
});

describe('charge (T029–T034)', () => {
  const chargeHold = (ms: number) => {
    const { driver: d, sim } = makeSim();
    d.press('weak', 'heavy').run(1);
    d.run(ms - 1);
    d.release('heavy').run(1);
    return { d, sim };
  };
  it('T029 release thresholds pick the right attack', () => {
    expect(chargeHold(499).d.player.attack?.kind).toBe('heavy');
    expect(chargeHold(500).d.player.attack?.kind).toBe('charge1');
    expect(chargeHold(1000).d.player.attack?.kind).toBe('charge2');
    expect(chargeHold(1500).d.player.attack?.kind).toBe('charge3');
  });
  it('T030 holding past 1500ms never auto-fires', () => {
    const { driver: d } = makeSim();
    d.press('weak', 'heavy').run(4000);
    expect(d.player.mode).toBe('charge');
    expect(d.player.chargeStage).toBe(3);
  });
  it('T031 one release fires once; no new charge until both released', () => {
    const { driver: d } = makeSim();
    d.press('weak', 'heavy').run(600);
    d.release('weak').run(1);
    expect(d.player.attack?.kind).toBe('charge1');
    d.run(700); // attack over, heavy still held
    d.press('weak').run(1);
    d.run(10).press('heavy').run(1); // heavy re-press impossible while held; weak attack only
    expect(d.player.mode).toBe('attack');
    expect(d.player.chargeLock).toBe(true);
  });
  it('T032 jump or dash cancels charge without damage', () => {
    const { driver: d, sim } = makeSim();
    const e = addDummy(sim, 'infantry', 150);
    d.press('weak', 'heavy').run(800);
    d.press('jump').run(1);
    expect(d.player.mode).toBe('free');
    expect(d.player.body.vy).toBeLessThan(0);
    d.run(600);
    expect(e.hp).toBe(40);
  });
  it('T033 HP hit during charge cancels it', () => {
    const { driver: d, sim } = makeSim();
    d.press('weak', 'heavy').run(300);
    const out = d.player.receiveHit({ damage: 10, parryable: true, fromX: 200, attackerId: 'x' }, { t: sim.t, events: new EventQueue() });
    expect(out).toBe('hurt');
    expect(d.player.mode).toBe('hurt');
  });
  it('T034 fully absorbed hit keeps the charge', () => {
    const { driver: d, sim } = makeSim();
    d.press('weak', 'heavy').run(300);
    d.player.shield = { value: 40, remainingMs: 5000 };
    const out = d.player.receiveHit({ damage: 15, parryable: true, fromX: 200, attackerId: 'x' }, { t: sim.t, events: new EventQueue() });
    expect(out).toBe('absorbed');
    expect(d.player.mode).toBe('charge');
    expect(d.player.hp).toBe(100);
  });
});

describe('cancel / reservation matrix', () => {
  it('T024 dash cancels the current attack', () => {
    const { driver: d } = makeSim();
    d.press('weak').run(50);
    d.press('dash').run(1);
    expect(d.player.mode).toBe('dash');
    expect(d.player.attack).toBeNull();
  });
  it('T025 parry reserved during attack runs before the next weak attack', () => {
    const { driver: d } = makeSim();
    d.press('weak').run(50).release('weak');
    d.press('parry').run(1).release('parry');
    d.run(250).press('weak').run(1); // late buffer weak
    d.run(30);
    expect(d.player.mode).toBe('parry');
  });
  it('T026 reservation is cleared by an HP hit', () => {
    const { driver: d, sim } = makeSim();
    d.press('weak').run(50);
    d.press('parry').run(1);
    d.player.receiveHit({ damage: 10, parryable: true, fromX: 200, attackerId: 'x' }, { t: sim.t, events: new EventQueue() });
    d.run(600);
    expect(d.player.mode).toBe('free');
  });
  it('T027 dash deals 15 once and is not invulnerable', () => {
    const { driver: d, sim } = makeSim();
    const e = addDummy(sim, 'infantry', 200);
    d.press('dash').run(400);
    expect(e.hp).toBe(25);
    d.press('dash').run(1);
    const out = d.player.receiveHit({ damage: 10, parryable: false, fromX: 400, attackerId: 'x' }, { t: sim.t, events: new EventQueue() });
    expect(out).toBe('hurt');
  });
  it('T028 no air dash and no landing auto-dash', () => {
    const { driver: d } = makeSim();
    d.press('jump').run(50);
    d.press('dash').run(1);
    expect(d.player.mode).toBe('free');
    d.run(800);
    expect(d.player.mode).toBe('free');
  });
});

describe('parry (T035–T037, T043)', () => {
  it('T035 success at 199ms, failure at 200ms', () => {
    for (const [dt, expected] of [[199, 'parried'], [200, 'hurt']] as const) {
      const { driver: d, sim } = makeSim();
      d.press('parry').run(1);
      const start = d.player.parryStart;
      d.run(dt - 1);
      expect(sim.t - start).toBe(dt - 1);
      // Hit lands on the next tick: sim.t = start + dt
      d.run(1);
      const out = d.player.receiveHit({ damage: 15, parryable: true, fromX: 150, attackerId: 'a' }, { t: start + dt, events: new EventQueue() });
      expect(out).toBe(expected);
    }
  });
  it('T036 parry upgrade extends the window', () => {
    const { driver: d } = makeSim(1, applyUpgrade(emptyUpgrades(), 'parry'));
    d.press('parry').run(1);
    expect(d.player.parryWindow).toBe(250);
  });
  it('T037 parry success stuns the enemy and deals no damage', () => {
    const { sim, driver: d, recorder } = makeSim();
    const e = addDummy(sim, 'infantry', 150);
    e.update = Object.getPrototypeOf(e).update; // re-enable AI
    d.press('parry');
    // Let the infantry wind up: graceful approach then strike.
    let parried = false;
    for (let i = 0; i < 3000 && !parried; i++) {
      if (e.state === 'windup' && sim.t - e.stateT > 430 && d.player.mode === 'free') d.press('parry');
      d.run(1);
      parried = recorder.stats.parrySuccesses > 0;
      d.release('parry');
    }
    expect(parried).toBe(true);
    expect(e.hp).toBe(40);
    expect(e.state).toBe('stunned');
  });
  it('T043 invulnerability lasts 500ms', () => {
    const { driver: d, sim } = makeSim();
    const q = new EventQueue();
    d.player.receiveHit({ damage: 10, parryable: false, fromX: 150, attackerId: 'a' }, { t: sim.t, events: q });
    const t0 = sim.t;
    expect(d.player.receiveHit({ damage: 10, parryable: false, fromX: 150, attackerId: 'b' }, { t: t0 + 499, events: q })).toBe('invulnerable');
    expect(d.player.receiveHit({ damage: 10, parryable: false, fromX: 150, attackerId: 'c' }, { t: t0 + 500, events: q })).toBe('hurt');
  });
});

describe('command skills (T050–T058)', () => {
  it('T050 cycle order and cooldown lock', () => {
    const { driver: d } = makeSim();
    expect(d.player.selectedSkillId).toBe('command_buff');
    d.press('cycleSkill').run(1).release('cycleSkill');
    expect(d.player.selectedSkillId).toBe('spear_support');
    d.press('cycleSkill').run(1).release('cycleSkill');
    expect(d.player.selectedSkillId).toBe('shield_guard');
    d.press('castSkill').run(1).release('castSkill');
    expect(d.player.shield.value).toBeCloseTo(40, 0);
    d.press('cycleSkill').run(1).release('cycleSkill');
    expect(d.player.selectedSkillId).toBe('command_buff');
    d.press('castSkill').run(1).release('castSkill');
    expect(d.player.buffRemaining).toBe(0);
  });
  it('T051 buff ends at 8s, shared cooldown ready at 20s (not 28s)', () => {
    const { driver: d } = makeSim();
    d.press('castSkill').run(1).release('castSkill');
    d.run(7998);
    expect(d.player.commandBuffActive).toBe(true);
    d.run(2);
    expect(d.player.commandBuffActive).toBe(false);
    d.run(11999);
    expect(d.player.cooldownRemaining).toBeGreaterThan(0);
    d.run(2);
    expect(d.player.cooldownRemaining).toBe(0);
  });
  it('T052 buff during a sword attack keeps the attack and combo', () => {
    const { driver: d } = makeSim();
    d.press('weak').run(50);
    d.press('castSkill').run(1);
    expect(d.player.mode).toBe('attack');
    expect(d.player.commandBuffActive).toBe(true);
  });
  it('T053 spear reserved mid-attack stays spear even after LB change', () => {
    const { driver: d, sim } = makeSim();
    addDummy(sim, 'infantry', 230);
    d.press('cycleSkill').run(1).release('cycleSkill');
    d.press('weak').run(30);
    d.press('castSkill').run(1).release('castSkill');
    d.press('cycleSkill').run(1).release('cycleSkill');
    expect(d.player.spearReserved).toBe(true);
    d.run(400);
    expect(d.player.mode).toBe('command');
    d.run(400);
    expect(sim.enemies[0].hp).toBe(0);
  });
  it('T054 six enemies -> nearest five take 50 each', () => {
    const { driver: d, sim } = makeSim();
    const xs = [40, 150, 60, 200, 250, 270];
    const es = xs.map((x) => addDummy(sim, 'shieldman', x));
    d.press('cycleSkill').run(1).release('cycleSkill');
    d.press('castSkill').run(400);
    const hit = es.filter((e) => e.hp === 30).length;
    expect(hit).toBe(5);
    expect(es[5].hp).toBe(80);
    expect(d.player.cooldownRemaining).toBeGreaterThan(0);
  });
  it('T056 no target -> no cooldown, notice', () => {
    const { driver: d, sim } = makeSim();
    d.press('cycleSkill').run(1).release('cycleSkill');
    d.press('castSkill').run(400);
    expect(d.player.cooldownRemaining).toBe(0);
    expect(sim.drainEvents().some((e) => e.type === 'toast' && e.text.includes('대상이 없습니다'))).toBe(true);
  });
  it('T058 spear damage ignores command buff and sword upgrades', () => {
    const { driver: d, sim } = makeSim(1, applyUpgrade(emptyUpgrades(), 'sword'));
    const e = addDummy(sim, 'shieldman', 200);
    d.player.buffRemaining = 5000;
    d.press('cycleSkill').run(1).release('cycleSkill');
    d.press('castSkill').run(400);
    expect(e.hp).toBe(30);
  });
  it('T064 shieldman guard: front weak blocked, heavy breaks, back weak hits', () => {
    const front = makeSim();
    const e1 = addDummy(front.sim, 'shieldman', 150, -1);
    front.driver.press('weak').run(400);
    expect(e1.hp).toBe(80);
    const heavy = makeSim();
    const e2 = addDummy(heavy.sim, 'shieldman', 150, -1);
    heavy.driver.press('heavy').run(120).release('heavy').run(600);
    expect(e2.hp).toBe(55);
    expect(['guardBroken', 'idle']).toContain(e2.state);
    const back = makeSim();
    const e3 = addDummy(back.sim, 'shieldman', 150, 1);
    back.driver.press('weak').run(400);
    expect(e3.hp).toBe(70);
  });
});
