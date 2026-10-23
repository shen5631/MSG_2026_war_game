import { describe, expect, it } from 'vitest';
import { BOSS_HP, BOSS_PATTERNS, LOCKED } from '../../src/config/spec';
import { Boss, type BossCtx } from '../../src/domain/boss';
import { AttackSlots } from '../../src/domain/enemies';
import { REQUIRED_SOBAEAP_FRAMES, SOBAEAP_ORIGIN, SOBAEAP_PATTERN_ACTION, sobaeapFrame } from '../../src/game/visual/sobaeap';

const GROUND = 304;

/** Runs the EXISTING so_bae_ap AI; logs pattern, live hit and the V2 frame each ms. */
function run(playerX: number, ms: number, phase: 1 | 2, summons: string[] = []) {
  const b = new Boss('b3', 'so_bae_ap', 400, GROUND, 0, { minX: 0, maxX: 800 });
  b.phase = phase;
  b.startFight(0);
  let id = 0;
  const ctx: BossCtx = { t: 0, dt: 1, playerX, playerAlive: true, solids: [], groundY: GROUND, slots: new AttackSlots(2), livingSummons: () => summons.length, requestSummons: (k) => { summons.push(...k); }, newId: (p) => `${p}-${++id}` };
  const log: { pattern: string | null; state: string; hit: boolean; frame: string; facing: number }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    b.update(ctx);
    log.push({ pattern: b.pattern?.id ?? null, state: b.state, hit: !!b.activeAttack(t), frame: sobaeapFrame(b, { t, transitionProgress: 0, deadMs: 0 }), facing: b.facing });
  }
  return { b, log };
}
const uniq = (xs: string[]) => [...new Set(xs)].sort();
const fr = (a: string, n: number) => `sobaeap_${a}_0${n}.png`;

describe('소배압 V2 art on the existing boss AI', () => {
  it('keeps HP 700, phase 2 at 350, at most 3 summons; 40 atlas frames, feet origin (224,220) of 448×256', () => {
    expect(BOSS_HP.so_bae_ap).toBe(700);
    expect(700 * LOCKED.bosses.phase2HpRatio).toBe(350);
    expect(LOCKED.bosses.so_bae_ap.maxLivingSummons).toBe(3);
    expect(REQUIRED_SOBAEAP_FRAMES).toHaveLength(40);
    expect(SOBAEAP_ORIGIN).toEqual({ x: 0.5, y: 220 / 256 });
    for (const p of BOSS_PATTERNS.so_bae_ap) expect(SOBAEAP_PATTERN_ACTION[p.id], p.id).toBeDefined();
  });

  it('every live hit shows a thrust/charge frame; windups never do; the boss faces the player on both sides', () => {
    const thrust = new Set([fr('attack', 3), fr('attack', 4), fr('combo', 2), fr('combo', 3), fr('combo', 5), fr('charge', 2), fr('charge', 3), fr('charge', 4)]);
    const seen = new Set<string>();
    for (const [px, phase] of [[340, 1], [150, 1], [340, 2], [150, 2], [620, 2]] as const) {
      const { log } = run(px, 25000, phase);
      for (const l of log.filter((q) => q.hit)) expect(thrust.has(l.frame), `${l.pattern} ${l.frame}`).toBe(true);
      for (const l of log.filter((q) => q.state === 'windup')) expect(thrust.has(l.frame), `${l.pattern} windup ${l.frame}`).toBe(false);
      for (const l of log) seen.add(l.pattern ?? '');
      expect(log.at(-1)!.facing).toBe(px < 400 ? -1 : 1);
    }
    for (const p of ['double_sword', 'rush', 'heavy_cut', 'fast_triple', 'red_ground_wave']) expect(seen.has(p), p).toBe(true);
  });

  it('combo hits step through combo_02 → combo_05 (→ combo_03) with the spear drawn back (combo_04) between hits', () => {
    const { log } = run(340, 25000, 2);
    const tri = log.filter((l) => l.pattern === 'fast_triple' && l.hit).map((l) => l.frame);
    expect(uniq(tri)).toEqual([fr('combo', 2), fr('combo', 3), fr('combo', 5)]);
    const dbl = log.filter((l) => l.pattern === 'double_sword' && l.state === 'hits' && !l.hit).map((l) => l.frame);
    expect(uniq(dbl)).toEqual([fr('combo', 4)]);
  });

  it('summon, parry stun, phase-2 transition and death use their own frames', () => {
    const { log } = run(340, 30000, 2);
    expect(uniq(log.filter((l) => l.pattern === 'summon').map((l) => l.frame))).toEqual([fr('attack', 1), fr('attack', 2), fr('attack', 5)]);
    const b = new Boss('b4', 'so_bae_ap', 400, GROUND, 0, { minX: 0, maxX: 800 });
    b.startFight(0);
    const slots = new AttackSlots(2);
    b.parryStun(1000, slots);
    expect(sobaeapFrame(b, { t: 1000, transitionProgress: 0, deadMs: 0 })).toBe(fr('hurt', 1));
    expect(sobaeapFrame(b, { t: 1649, transitionProgress: 0, deadMs: 0 })).toBe(fr('hurt', 4));
    b.beginTransition(2000, slots);
    expect(sobaeapFrame(b, { t: 2000, transitionProgress: 0, deadMs: 0 })).toBe(fr('phase2', 1));
    expect(sobaeapFrame(b, { t: 2000, transitionProgress: 0.99, deadMs: 0 })).toBe(fr('phase2', 4));
    b.die(3000, slots);
    expect(sobaeapFrame(b, { t: 3000, transitionProgress: 0, deadMs: 0 })).toBe(fr('death', 1));
    expect(sobaeapFrame(b, { t: 3000, transitionProgress: 0, deadMs: 5000 })).toBe(fr('death', 6));
  });
});
