import { describe, expect, it } from 'vitest';
import { cooldownFrame } from '../../src/skill-gauges/core';
import { makeSim } from './helpers';

/** The frame each HUD icon shows, computed exactly as HUD.tsx passes the game's shared cooldown. */
const frameOf = (p: { cooldownRemaining: number; cooldownTotal: number }) =>
  cooldownFrame(Math.max(0, p.cooldownRemaining), Math.max(1, p.cooldownTotal));

describe('command skill gauge icons ← existing shared cooldown', () => {
  it('ready (100) at round start, 000 right after a successful cast, 50 at half, 100 only at exactly 0 ms', () => {
    const { driver: d } = makeSim();
    expect(frameOf(d.player)).toBe(100);
    d.press('castSkill').run(1).release('castSkill');
    expect(d.player.cooldownTotal).toBe(20000);
    expect(frameOf(d.player)).toBe(0);
    d.run(10000);
    expect(frameOf(d.player)).toBe(50);
    d.run(9998);
    expect(d.player.cooldownRemaining).toBeGreaterThan(0);
    expect(frameOf(d.player)).toBe(99);
    d.run(2);
    expect(frameOf(d.player)).toBe(100);
  });

  it('changing the selection never resets or alters the gauge', () => {
    const { driver: d } = makeSim();
    d.press('castSkill').run(1).release('castSkill');
    d.run(5000);
    const before = { remaining: d.player.cooldownRemaining, frame: frameOf(d.player) };
    d.press('cycleSkill').run(1).release('cycleSkill');
    d.press('cycleSkill').run(1).release('cycleSkill');
    expect(d.player.selectedSkillId).toBe('shield_guard');
    expect(d.player.cooldownRemaining).toBe(before.remaining - 2);
    expect(frameOf(d.player)).toBe(before.frame);
  });

  it('pressing cast during the cooldown does not restart it', () => {
    const { driver: d } = makeSim();
    d.press('castSkill').run(1).release('castSkill');
    d.run(8000);
    const remaining = d.player.cooldownRemaining;
    d.press('castSkill').run(1).release('castSkill');
    expect(d.player.cooldownRemaining).toBe(remaining - 1);
    expect(frameOf(d.player)).toBe(40);
  });

  it('uses the upgraded 17 s / 14 s totals as the gauge length', () => {
    for (const [stacks, total] of [[1, 17000], [2, 14000]] as const) {
      const { driver: d } = makeSim(1, { sword: 0, parry: 0, command_cooldown: stacks });
      d.press('castSkill').run(1).release('castSkill');
      expect(d.player.cooldownTotal).toBe(total);
      d.run(total / 2);
      expect(frameOf(d.player)).toBe(50);
    }
  });
});
