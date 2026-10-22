import { describe, expect, it } from 'vitest';
import { ENEMY_PATTERNS } from '../../src/config/spec';
import { AttackSlots, Enemy, type EnemyCtx } from '../../src/domain/enemies';
import { EventQueue } from '../../src/domain/events';
import { REQUIRED_SPEARMAN_FRAMES, spearmanPose } from '../../src/game/visual/spearman';

const GROUND = 304;
const pat = ENEMY_PATTERNS.spearman;

/** Runs the EXISTING spearman AI against a still player; records the pose and whether the hitbox is live. */
function run(playerX: number, ms: number) {
  const e = new Enemy('s1', 1, 'spearman', 400, GROUND, 0, { minX: 0, maxX: 800 }, false, 'test');
  const ctx: EnemyCtx = {
    t: 0, dt: 1, playerX, playerY: GROUND, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(1),
    isVisible: () => true, events: new EventQueue(), spawnArrow: () => {}, newId: (p) => `${p}-${Math.random()}`, findSafePoint: () => null,
  };
  const log: { state: string; frame: string; hit: boolean; originX: number; facing: number }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    e.update(ctx);
    const p = spearmanPose(e, t, pat.startupMs, pat.activeMs ?? 140);
    log.push({ state: e.state, frame: p.frame.replace('khitan_spearman_', '').replace('.png', ''), hit: !!e.activeAttack(), originX: p.originX, facing: e.facing });
  }
  return log;
}
const uniq = (xs: string[]) => [...new Set(xs)].sort();

describe('khitan spearman art on the existing AI', () => {
  it('uses all 25 atlas frames', () => {
    expect(REQUIRED_SPEARMAN_FRAMES).toHaveLength(25);
  });

  it('windup attack_01–03, thrust 04–05 exactly while the hitbox is live, recovery 06', () => {
    const log = run(400 - 80, 3000);
    expect(uniq(log.filter((l) => l.state === 'windup').map((l) => l.frame))).toEqual(['attack_01', 'attack_02', 'attack_03']);
    expect(uniq(log.filter((l) => l.hit).map((l) => l.frame))).toEqual(['attack_04', 'attack_05']);
    expect(uniq(log.filter((l) => l.state === 'recover').map((l) => l.frame))).toContain('attack_06');
  });

  it('faces the player and mirrors the feet anchor for flipX', () => {
    const left = run(400 - 300, 50).at(-1)!;
    const right = run(400 + 300, 50).at(-1)!;
    expect(left.facing).toBe(-1);
    expect(right.facing).toBe(1);
    expect(left.state).toBe('move');
    expect(left.originX).toBeCloseTo(1 - right.originX);
  });

  it('feet rest on the ground line for every action (bottom row + 1 = origin)', () => {
    const e = new Enemy('s2', 2, 'spearman', 400, GROUND, 0, { minX: 0, maxX: 800 }, false, 'test');
    for (const state of ['idle', 'move', 'windup', 'active', 'stunned', 'dead'] as const) {
      e.state = state;
      const p = spearmanPose(e, 0, pat.startupMs, pat.activeMs ?? 140);
      expect(p.originY * 192).toBeGreaterThan(137);
      expect(p.originY * 192).toBeLessThanOrEqual(163);
    }
  });
});
