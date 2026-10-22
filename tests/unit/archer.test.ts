import { describe, expect, it } from 'vitest';
import { ENEMY_PATTERNS } from '../../src/config/spec';
import { AttackSlots, Enemy, type EnemyCtx } from '../../src/domain/enemies';
import { EventQueue } from '../../src/domain/events';
import { archerFrame, arrowPlacement } from '../../src/game/visual/archer';

const GROUND = 304;

/** Runs one archer against a stationary player in 1ms steps, recording every arrow spawn. */
function runArcher(ms: number, playerX = 200) {
  const e = new Enemy('a1', 1, 'archer', 400, GROUND, 0, { minX: 0, maxX: 640 }, false, 'test');
  const slots = new AttackSlots(1);
  const spawns: { t: number; windupStart: number; frame: string }[] = [];
  const frames: { t: number; state: string; frame: string }[] = [];
  let windupStart = -1;
  let id = 0;
  const ctx: EnemyCtx = {
    t: 0, dt: 1, playerX, playerY: GROUND, playerAlive: true, solids: [], groundY: GROUND, slots,
    isVisible: () => true, events: new EventQueue(),
    spawnArrow: () => spawns.push({ t: ctx.t, windupStart, frame: '' }),
    newId: (p) => `${p}-${++id}`, findSafePoint: () => null,
  };
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    const before = e.state;
    e.update(ctx);
    if (e.state === 'windup' && before !== 'windup') windupStart = e.stateT;
    const frame = archerFrame(e, t, ENEMY_PATTERNS.archer.startupMs);
    if (spawns.length && spawns[spawns.length - 1].t === t) spawns[spawns.length - 1].frame = frame;
    frames.push({ t, state: e.state, frame });
  }
  return { spawns, frames };
}

describe('archer (real art binding)', () => {
  it('fires exactly one arrow per attack, when the 650ms windup ends', () => {
    const { spawns, frames } = runArcher(10000);
    const windups = frames.filter((f, i) => f.state === 'windup' && (i === 0 || frames[i - 1].state !== 'windup')).length;
    expect(spawns.length).toBeGreaterThanOrEqual(3);
    const unfinished = frames[frames.length - 1].state === 'windup' ? 1 : 0;
    expect(spawns.length).toBe(windups - unfinished);
    for (const s of spawns) expect(s.t - s.windupStart).toBe(ENEMY_PATTERNS.archer.startupMs);
    // Consecutive shots are separated by at least windup + recovery (1200ms) — never two in one attack.
    for (let i = 1; i < spawns.length; i++) expect(spawns[i].t - spawns[i - 1].t).toBeGreaterThanOrEqual(650 + 1200);
  });

  it('shows the release pose (attack_06) on the step the arrow spawns, attack_01..05 during the windup', () => {
    const { spawns, frames } = runArcher(4000);
    for (const s of spawns) expect(s.frame).toBe('khitan_archer_attack_06.png');
    const windupFrames = [...new Set(frames.filter((f) => f.state === 'windup').map((f) => f.frame))];
    expect(windupFrames).toEqual([1, 2, 3, 4, 5].map((i) => `khitan_archer_attack_0${i}.png`));
  });

  it('places the drawn arrow tip on the leading edge of the hitbox in both directions', () => {
    const right = arrowPlacement({ id: 'arrow-1-1', ownerId: 'a', x: 100, prevX: 100, y: 260, vx: 260, born: 0, damage: 10, alive: true });
    const left = arrowPlacement({ id: 'arrow-1-2', ownerId: 'a', x: 100, prevX: 100, y: 260, vx: -260, born: 0, damage: 10, alive: true });
    expect(right).toMatchObject({ x: 107, flipX: false });
    expect(left).toMatchObject({ x: 93, flipX: true });
    expect(left.originX).toBeCloseTo(1 - right.originX);
  });
});
