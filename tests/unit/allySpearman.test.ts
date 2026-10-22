import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/config/spec';
import { allySpearPose, ALLY_SPEAR_TIMELINE_MS } from '../../src/game/visual/allySpearman';
import { addDummy, makeSim } from './helpers';

/** Cast 창병 공격 through the real input path with 7 dummies around the hero (4 right, 3 left). */
function castSpear() {
  const ctx = makeSim();
  const { driver: d, sim } = ctx;
  const px = d.player.body.x;
  const enemies = [40, 70, 100, 130, -50, -90, -160].map((dx) => addDummy(sim, 'infantry', px + dx));
  d.press('cycleSkill').run(1).release('cycleSkill');
  expect(d.player.selectedSkillId).toBe('spear_support');
  d.press('castSkill').run(1).release('castSkill');
  return { ...ctx, enemies };
}

describe('창병 공격 ally art on the existing skill', () => {
  it('visual length equals the timeline (art never outlives / cuts its own animation)', () => {
    expect(DEFAULTS.skills.spearVisualMs).toBe(ALLY_SPEAR_TIMELINE_MS);
  });

  it('damage lands once at the end of the 300 ms command pose: nearest 5 of 7, 50 each, never repeated by the art', () => {
    const { driver: d, sim, enemies } = castSpear();
    d.run(DEFAULTS.skills.spearCommandMs - 2);
    expect(enemies.every((e) => e.hp === e.maxHp)).toBe(true); // nothing before the command delay
    d.run(3);
    const hit = enemies.filter((e) => e.hp < e.maxHp);
    expect(hit).toHaveLength(5);
    for (const e of hit) expect(e.maxHp - e.hp).toBe(Math.min(50, e.maxHp));
    expect(sim.allyVisuals).toHaveLength(5);
    const hpAfter = enemies.map((e) => e.hp);
    d.run(ALLY_SPEAR_TIMELINE_MS - 50); // the whole animation plays…
    expect(enemies.map((e) => e.hp)).toEqual(hpAfter); // …without any extra damage
    d.run(100);
    expect(sim.allyVisuals).toHaveLength(0); // and the soldiers are gone
  });

  it('timeline: appear → thrust (strike_03/04) right after the hit → follow-through → vanish, mirrored when facing left', () => {
    const a = { id: 'a', kind: 'spear' as const, x: 100, y: 304, facing: 1 as const, until: 1000 + ALLY_SPEAR_TIMELINE_MS };
    const at = (ms: number, facing: 1 | -1 = 1) => allySpearPose({ ...a, facing }, 1000 + ms, ALLY_SPEAR_TIMELINE_MS);
    expect(at(0).frame).toBe('goryeo_spearman_summon_03.png');
    expect(at(100).frame).toBe('goryeo_spearman_strike_03.png');
    expect(at(150).frame).toBe('goryeo_spearman_strike_04.png');
    expect(at(260).frame).toBe('goryeo_spearman_strike_06.png');
    expect(at(600).frame).toBe('goryeo_spearman_despawn_04.png');
    expect(at(100, -1).flipX).toBe(true);
    expect(at(100, -1).originX).toBeCloseTo(1 - at(100).originX);
  });
});
