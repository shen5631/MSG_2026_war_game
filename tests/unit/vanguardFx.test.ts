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
  const log: { t: number; pattern: string | null; state: string; kinds: string[]; facing: number; fxFacing: number[] }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    b.update(ctx);
    const f = fx.update(b, t, GROUND, playerX, 0);
    log.push({ t, pattern: b.pattern?.id ?? null, state: b.state, kinds: f.map((q) => q.kind), facing: b.facing, fxFacing: f.map((q) => q.facing) });
  }
  return { b, fx, log, hp0 };
}

describe('vanguard combat effects V2 (visual only)', () => {
  it('31 frames; slash on each sword hit, dash trail on the rush, flame circle only during the red slam windup, explosion on its hit', () => {
    expect(REQUIRED_VANGUARD_FX_FRAMES).toHaveLength(31);
    const p1 = run(340, 20000, 1).log;
    const p2 = run(340, 30000, 2).log;
    const all = [...p1, ...p2];
    const firstOf = (kind: string) => all.find((l) => l.kinds.includes(kind));
    expect(firstOf('slash_arc')?.pattern).toMatch(/sword_cut|triple_cut/);
    expect(run(150, 20000, 1).log.find((l) => l.kinds.includes('dash_trail'))?.pattern).toBe('rush');
    for (const l of all.filter((q) => q.kinds.includes('ground_flame_circle'))) expect([l.pattern, l.state]).toEqual(['red_slam', 'windup']);
    expect(firstOf('ground_explosion')?.pattern).toBe('red_slam');
    // a triple cut shows three separate slashes (one per hit)
    const tri = p2.filter((l) => l.pattern === 'triple_cut');
    let starts = 0;
    for (let i = 1; i < tri.length; i++) if (tri[i].kinds.filter((k) => k === 'slash_arc').length > tri[i - 1].kinds.filter((k) => k === 'slash_arc').length) starts++;
    expect(starts).toBeGreaterThanOrEqual(3);
  });

  it('effects face the boss direction on both sides and never change the boss (HP / pattern)', () => {
    for (const px of [150, 650]) {
      const { log, b, hp0 } = run(px, 15000, 1);
      for (const l of log) for (const f of l.fxFacing) expect(f).toBe(l.facing);
      expect(b.hp).toBe(hp0);
    }
  });

  it('parry flash once per stun, pillar during the phase-2 transition, everything cleared when the boss dies', () => {
    const b = new Boss('b2', 'vanguard', 400, GROUND, 0, { minX: 0, maxX: 800 });
    b.startFight(0);
    const slots = new AttackSlots(2);
    const fx = new VanguardFxPlanner();
    b.parryStun(1000, slots);
    expect(fx.update(b, 1000, GROUND, 360, 0).map((f) => f.kind)).toEqual(['impact_burst']);
    expect(fx.update(b, 1100, GROUND, 360, 0).filter((f) => f.kind === 'impact_burst')).toHaveLength(1);
    expect(fx.update(b, 1000 + 1000, GROUND, 360, 0)).toEqual([]); // 4 frames at 18 fps are over
    b.state = 'idle';
    b.parryStun(2900, slots);
    fx.update(b, 2900, GROUND, 360, 0);
    b.beginTransition(3000, slots);
    // only the pillar: the parry flash from 100 ms earlier is dropped when the transition starts
    expect(fx.update(b, 3000, GROUND, 360, 0.6).map((f) => [f.kind, f.frame])).toEqual([['summon_pillar', 'vanguard_summon_pillar_03.png']]);
    b.die(4000, slots);
    expect(fx.update(b, 4000, GROUND, 360, 0)).toEqual([]);
    expect(fxFrameIndex('slash_arc', 0)).toBe(0);
    expect(fxFrameIndex('slash_arc', 1000)).toBe(-1);
  });
});
