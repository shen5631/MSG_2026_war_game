import { describe, expect, it } from 'vitest';
import { Boss, type BossCtx } from '../../src/domain/boss';
import { AttackSlots } from '../../src/domain/enemies';
import { REQUIRED_VANGUARD_FX_FRAMES, VanguardFxPlanner, fxFrameIndex } from '../../src/game/visual/vanguardFx';

const GROUND = 304;

/** Runs the EXISTING vanguard AI and records which effects the planner shows (display only). */
function run(playerX: number, ms: number, phase: 1 | 2) {
  const b = new Boss('b1', 'vanguard', 400, GROUND, 0, { minX: 0, maxX: 800 });
  b.phase = phase;
  b.startFight(0);
  let id = 0;
  const hp0 = b.hp;
  const ctx: BossCtx = { t: 0, dt: 1, playerX, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(2), livingSummons: () => 0, requestSummons: () => {}, newId: (p) => `${p}-${++id}` };
  const fx = new VanguardFxPlanner();
  const log: { pattern: string | null; state: string; kinds: string[]; facing: number; fxFacing: number[] }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    b.update(ctx);
    const f = fx.update(b, t, GROUND);
    log.push({ pattern: b.pattern?.id ?? null, state: b.state, kinds: f.map((q) => q.kind), facing: b.facing, fxFacing: f.map((q) => q.facing) });
  }
  return { b, log, hp0 };
}

describe('vanguard effects V2: only the phase-2 red slam (visual only)', () => {
  it('flame circle only during the red slam windup, explosion on its hit; no effect for any other pattern', () => {
    expect(REQUIRED_VANGUARD_FX_FRAMES).toHaveLength(31); // full atlas stays loaded/checked
    const p2 = run(340, 30000, 2).log;
    for (const l of p2.filter((q) => q.kinds.includes('ground_flame_circle'))) expect([l.pattern, l.state]).toEqual(['red_slam', 'windup']);
    expect(p2.some((l) => l.kinds.includes('ground_flame_circle'))).toBe(true);
    expect(p2.find((l) => l.kinds.includes('ground_explosion'))?.pattern).toBe('red_slam');
    const kinds = new Set(p2.flatMap((l) => l.kinds));
    expect([...kinds].sort()).toEqual(['ground_explosion', 'ground_flame_circle']);
    // phase 1 has no red slam: no effects at all (sword cut / rush show nothing)
    for (const px of [340, 150]) expect(run(px, 20000, 1).log.every((l) => l.kinds.length === 0)).toBe(true);
  });

  it('effects face the boss direction and never change the boss (HP)', () => {
    for (const px of [150, 650]) {
      const { log, b, hp0 } = run(px, 30000, 2);
      for (const l of log) for (const f of l.fxFacing) expect(f).toBe(l.facing);
      expect(b.hp).toBe(hp0);
    }
  });

  it('no parry flash or transition pillar; everything cleared on transition and death', () => {
    const b = new Boss('b2', 'vanguard', 400, GROUND, 0, { minX: 0, maxX: 800 });
    b.startFight(0);
    const slots = new AttackSlots(2);
    const fx = new VanguardFxPlanner();
    b.parryStun(1000, slots);
    expect(fx.update(b, 1000, GROUND)).toEqual([]);
    b.beginTransition(3000, slots);
    expect(fx.update(b, 3000, GROUND)).toEqual([]);
    b.die(4000, slots);
    expect(fx.update(b, 4000, GROUND)).toEqual([]);
    expect(fxFrameIndex('ground_explosion', 0)).toBe(0);
    expect(fxFrameIndex('ground_explosion', 1000)).toBe(-1);
  });
});
