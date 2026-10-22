import { describe, expect, it } from 'vitest';
import { EventQueue } from '../../src/domain/events';
import { shieldFormation, shieldVisualPose } from '../../src/game/skills/shield/presentation';
import { shieldSnapshotOf } from '../../src/game/visual/shieldAllies';
import { makeSim } from './helpers';

/** Selects 방패병 막기 (2× cycle) and casts it through the real input path. */
function castShield() {
  const ctx = makeSim();
  const d = ctx.driver;
  d.press('cycleSkill').run(1).release('cycleSkill');
  d.press('cycleSkill').run(1).release('cycleSkill');
  expect(d.player.selectedSkillId).toBe('shield_guard');
  d.press('castSkill').run(1).release('castSkill');
  return ctx;
}
const pose = (p: Parameters<typeof shieldSnapshotOf>[0], live = true) => shieldVisualPose(shieldSnapshotOf(p, live));

describe('방패병 막기 soldiers ← existing shield state', () => {
  it('one shared 40 shield: summon → guard → despawn in the last 320 ms → hidden exactly at 5 s', () => {
    const { driver: d } = castShield();
    expect(d.player.shield.value).toBeCloseTo(40, 1);
    expect(pose(d.player).frame).toBe('summon_01');
    d.run(300);
    expect(pose(d.player)).toMatchObject({ visible: true, action: 'guard' });
    d.run(4400); // ≈4.7 s after the cast
    expect(pose(d.player)).toMatchObject({ visible: true, action: 'despawn' });
    d.run(400);
    expect(d.player.shield.value).toBe(0);
    expect(pose(d.player).visible).toBe(false);
  });

  it('the effect is immediate (no wait for the summon animation) and the strength follows the real value', () => {
    const { driver: d } = castShield();
    d.run(2500);
    const p = pose(d.player);
    expect(p.visible).toBe(true);
    expect(p.strength).toBeCloseTo(d.player.shield.value / 40, 5);
  });

  it('hides at once when the shield breaks, the hero dies or the round has ended', () => {
    const { driver: d, sim } = castShield();
    d.run(500);
    expect(pose(d.player, false).visible).toBe(false); // round over (victory / defeat hold)
    d.player.receiveHit({ damage: 50, parryable: true, fromX: d.player.body.x + 50, attackerId: 'x' }, { t: sim.t, events: new EventQueue() });
    expect(d.player.shield.value).toBe(0);
    expect(pose(d.player).visible).toBe(false);

    const second = castShield();
    second.driver.player.hp = 0;
    (second.driver.player as { mode: string }).mode = 'dead';
    expect(pose(second.driver.player).visible).toBe(false);
  });

  it('two soldiers are placement only: both share the hero feet and sit behind the hero', () => {
    const f = shieldFormation({ x: 200, footY: 304, depth: 20 });
    expect(f).toHaveLength(2);
    expect(f.map((s) => [s.x, s.y, s.flipX, s.depth])).toEqual([[166, 304, true, 19], [234, 304, false, 19]]);
  });
});
