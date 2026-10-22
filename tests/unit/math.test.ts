import { describe, expect, it } from 'vitest';
import {
  applyIncomingDamage, attackDamage, chargeReleaseKind, decayShield, displayHp, isParryActive, pickupHeal, resolveTerminal, rollDrop, swordDamage,
} from '../../src/domain/damage';
import { applyUpgrade, emptyUpgrades, parryWindowMs, sharedCooldownMs } from '../../src/domain/upgrades';
import { BASE_DAMAGE, ENEMY_HP, LEVELS } from '../../src/config/spec';
import { FixedStepper, PauseReasons } from '../../src/domain/clock';

describe('damage formulas', () => {
  it('T022 combo total is 72 and the finisher adds no extra 25', () => {
    const total = ['weak1', 'weak2', 'weak3', 'finisher'].reduce((s, k) => s + attackDamage(k as never, 0, false), 0);
    expect(total).toBe(72);
  });
  it('T029/T030 charge thresholds', () => {
    const at = (ms: number) => BASE_DAMAGE[chargeReleaseKind(ms)];
    expect([499, 500, 999, 1000, 1499, 1500, 9000].map(at)).toEqual([25, 20, 20, 35, 35, 50, 50]);
  });
  it('T057/T059 additive bonuses, rounded once', () => {
    expect(swordDamage(50, 2, true)).toBe(80);
    expect(swordDamage(50, 1, false)).toBe(58);
    expect(swordDamage(25, 1, true)).toBe(36);
    expect(swordDamage(10, 0, true)).toBe(13);
  });
  it('T042 HP hit causes stun + 500ms invulnerability', () => {
    expect(applyIncomingDamage({ hp: 100, shield: 0, damage: 15, hpInvulnerable: false })).toMatchObject({ hp: 85, stun: true, invulnerabilityMs: 500 });
  });
  it('T044/T045/T046/T048 shield absorption', () => {
    expect(applyIncomingDamage({ hp: 100, shield: 40, damage: 15, hpInvulnerable: false })).toMatchObject({ hp: 100, shield: 25, stun: false });
    expect(applyIncomingDamage({ hp: 100, shield: 15, damage: 15, hpInvulnerable: false })).toMatchObject({ hp: 100, shield: 0, stun: false });
    expect(applyIncomingDamage({ hp: 100, shield: 10, damage: 15, hpInvulnerable: false })).toMatchObject({ hp: 95, shield: 0, stun: true });
    expect(applyIncomingDamage({ hp: 100, shield: 10.5, damage: 15, hpInvulnerable: false }).hp).toBeCloseTo(95.5, 9);
  });
  it('T049 invulnerability protects both HP and shield', () => {
    expect(applyIncomingDamage({ hp: 80, shield: 30, damage: 15, hpInvulnerable: true })).toMatchObject({ hp: 80, shield: 30, absorbed: 0 });
  });
  it('T047 shield decay is continuous at 60fps (no per-frame rounding)', () => {
    let s = { value: 40, remainingMs: 5000 };
    for (let i = 0; i < 60; i++) s = decayShield(s, 1000 / 60);
    expect(s.value).toBeCloseTo(32, 6);
    for (let i = 0; i < 240; i++) s = decayShield(s, 1000 / 60);
    expect(s.value).toBe(0);
  });
  it('HUD hp shows ceil of positive internal value', () => {
    expect(displayHp(95.5)).toBe(96);
    expect(displayHp(0)).toBe(0);
  });
  it('T035 parry window [0,200)', () => {
    expect(isParryActive(0, 199, 200)).toBe(true);
    expect(isParryActive(0, 200, 200)).toBe(false);
  });
  it('T074/T075 pickups', () => {
    expect(pickupHeal(100, 15)).toEqual({ hp: 100, consumed: false });
    expect(pickupHeal(95, 15)).toEqual({ hp: 100, consumed: true });
  });
  it('T076 drop roll boundary', () => {
    expect(rollDrop(0.0999)).toBe(true);
    expect(rollDrop(0.1)).toBe(false);
  });
  it('T085 simultaneous death -> boss victory first', () => {
    expect(resolveTerminal(0, 0)).toBe('boss-victory');
    expect(resolveTerminal(0, 10)).toBe('game-over');
    expect(resolveTerminal(0, null)).toBe('game-over');
  });
});

describe('upgrades', () => {
  it('T036/T060 stacking and cap', () => {
    let u = emptyUpgrades();
    u = applyUpgrade(u, 'parry');
    expect(parryWindowMs(u)).toBe(250);
    u = applyUpgrade(u, 'parry');
    expect(parryWindowMs(u)).toBe(300);
    expect(() => applyUpgrade(u, 'sword')).toThrow();
    const c = applyUpgrade(applyUpgrade(emptyUpgrades(), 'command_cooldown'), 'command_cooldown');
    expect(sharedCooldownMs(c)).toBe(14000);
    expect(parryWindowMs(emptyUpgrades())).toBe(200);
  });
});

describe('data integrity', () => {
  it('T068 levels: 3 rounds / 5 arenas / 13 waves / 9+14+27=50', () => {
    const rounds = LEVELS.rounds;
    expect(rounds.length).toBe(3);
    expect(rounds.reduce((s, r) => s + r.arenas.length, 0)).toBe(5);
    expect(rounds.reduce((s, r) => s + r.arenas.reduce((a, ar) => a + ar.waves.length, 0), 0)).toBe(13);
    const perRound = rounds.map((r) => r.arenas.reduce((a, ar) => a + ar.waves.reduce((w, wv) => w + wv.spawnOrder.length, 0), 0));
    expect(perRound).toEqual([9, 14, 27]);
    for (const r of rounds) for (const a of r.arenas) for (const w of a.waves) {
      const fromComp = Object.values(w.composition).reduce((x, y) => x + (y ?? 0), 0);
      expect(w.spawnOrder.length).toBe(fromComp);
      expect(w.count).toBe(fromComp);
    }
  });
  it('T063 enemy HP', () => {
    expect(ENEMY_HP).toEqual({ infantry: 40, archer: 30, spearman: 55, shieldman: 80, cavalry: 70 });
  });
});

describe('clock', () => {
  it('fixed stepper caps catch-up and drops long gaps', () => {
    const s = new FixedStepper();
    expect(s.advance(1000 / 60).steps).toBe(1);
    expect(s.advance(200).steps).toBe(6);
    expect(s.advance(300)).toEqual({ steps: 0, stalled: true });
  });
  it('T094 pause reasons are independent', () => {
    const p = new PauseReasons();
    p.add('manual');
    p.add('hidden');
    p.remove('hidden');
    expect(p.paused).toBe(true);
    expect(p.list()).toEqual(['manual']);
  });
});
