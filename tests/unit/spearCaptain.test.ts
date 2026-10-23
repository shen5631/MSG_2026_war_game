import { describe, expect, it } from 'vitest';
import { BOSS_HP, BOSS_NAMES, LOCKED } from '../../src/config/spec';
import { Boss, type BossCtx } from '../../src/domain/boss';
import { AttackSlots } from '../../src/domain/enemies';
import { REQUIRED_SPEAR_CAPTAIN_FRAMES, SPEAR_CAPTAIN_ORIGIN, spearCaptainFrame } from '../../src/game/visual/spearCaptain';

const GROUND = 304;

/** Runs the EXISTING spear_captain AI; logs pattern, live hit and the art frame each ms. */
function run(playerX: number, ms: number, phase: 1 | 2) {
  const b = new Boss('b2', 'spear_captain', 400, GROUND, 0, { minX: 0, maxX: 800 });
  b.phase = phase;
  b.startFight(0);
  let id = 0;
  const ctx: BossCtx = { t: 0, dt: 1, playerX, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(2), livingSummons: () => 0, requestSummons: () => {}, newId: (p) => `${p}-${++id}` };
  const log: { pattern: string | null; state: string; hit: boolean; frame: string; facing: number; el: number }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    b.update(ctx);
    const frame = spearCaptainFrame(b, { t, transitionProgress: 0, deadMs: 0 });
    log.push({ pattern: b.pattern?.id ?? null, state: b.state, hit: !!b.activeAttack(t), frame, facing: b.facing, el: t - b.patternStart });
  }
  return log;
}
const frames = (log: ReturnType<typeof run>, pred: (l: ReturnType<typeof run>[number]) => boolean) => [...new Set(log.filter(pred).map((l) => l.frame))].sort();

describe('정예 창병장 art on the existing round-2 boss AI', () => {
  it('keeps the locked boss rules: 정예 창병장, HP 500, phase 2 at 250', () => {
    expect(BOSS_NAMES.spear_captain).toBe('정예 창병장');
    expect(BOSS_HP.spear_captain).toBe(500);
    expect(BOSS_HP.spear_captain * LOCKED.bosses.phase2HpRatio).toBe(250);
    expect(REQUIRED_SPEAR_CAPTAIN_FRAMES).toHaveLength(50);
  });

  it('phase 1: long_thrust_03/04 and sweep_03/04 exactly while the hitbox is live', () => {
    const far = run(400 - 150, 6000, 1);
    expect(frames(far, (l) => l.pattern === 'long_thrust' && l.hit)).toEqual(['long_thrust_03', 'long_thrust_04']);
    const near = run(400 - 60, 6000, 1);
    expect(frames(near, (l) => l.pattern === 'sweep' && l.hit)).toEqual(['sweep_03', 'sweep_04']);
  });

  it('phase 2: double thrust hit 1 = double_thrust_03, hit 2 = double_thrust_06; jump airborne 03, landing hit 04', () => {
    const log = run(400 - 80, 30000, 2);
    const dbl = log.filter((l) => l.pattern === 'double_thrust');
    expect(dbl.length).toBeGreaterThan(0);
    expect(frames(dbl, (l) => l.hit && l.el < 700)).toEqual(['double_thrust_03']);
    expect(frames(dbl, (l) => l.hit && l.el >= 700)).toEqual(['double_thrust_06']);
    const slam = log.filter((l) => l.pattern === 'red_jump_slam');
    expect(slam.length).toBeGreaterThan(0);
    expect(frames(slam, (l) => l.state === 'windup' && l.el >= 600)).toEqual(['jump_slam_03']);
    expect(frames(slam, (l) => l.hit)).toEqual(['jump_slam_04']);
  });

  it('faces the player; the feet anchor (160,176) is centred so flipX mirrors in place', () => {
    expect(run(400 - 150, 30, 1).at(-1)!.facing).toBe(-1);
    expect(run(400 + 150, 30, 1).at(-1)!.facing).toBe(1);
    expect(SPEAR_CAPTAIN_ORIGIN).toEqual({ x: 0.5, y: 176 / 192 });
  });

  it('transition, parry stun and death use phase2 / parry_stagger / death frames', () => {
    const b = new Boss('b2', 'spear_captain', 400, GROUND, 0, { minX: 0, maxX: 800 });
    const slots = new AttackSlots(2);
    b.startFight(0);
    b.beginTransition(100, slots);
    expect(spearCaptainFrame(b, { t: 100, transitionProgress: 0, deadMs: 0 })).toBe('phase2_01');
    expect(spearCaptainFrame(b, { t: 100, transitionProgress: 0.99, deadMs: 0 })).toBe('phase2_04');
    b.endTransition(200);
    b.parryStun(300, slots);
    expect(spearCaptainFrame(b, { t: 300, transitionProgress: 0, deadMs: 0 })).toBe('parry_stagger_01');
    b.die(2000, slots);
    expect(spearCaptainFrame(b, { t: 2000, transitionProgress: 0, deadMs: 5000 })).toBe('death_06');
  });
});
