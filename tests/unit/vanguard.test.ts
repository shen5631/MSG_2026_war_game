import { describe, expect, it } from 'vitest';
import { BOSS_PATTERNS } from '../../src/config/spec';
import { Boss, type BossCtx } from '../../src/domain/boss';
import { AttackSlots } from '../../src/domain/enemies';
import { PATTERNS } from '../../src/game/bosses/vanguard/VanguardBoss';
import { REQUIRED_VANGUARD_FRAMES, VANGUARD_PATTERN_ACTION, vanguardFrame } from '../../src/game/visual/vanguard';

const GROUND = 304;

/** Steps the existing domain boss (the only AI) against a still player, recording the V2 frame each ms. */
function runBoss(playerX: number, ms: number, phase: 1 | 2 = 1) {
  const boss = new Boss('b1', 'vanguard', 400, GROUND, 0, { minX: 0, maxX: 800 });
  boss.phase = phase;
  boss.startFight(0);
  const slots = new AttackSlots(2);
  let id = 0;
  const ctx: BossCtx = {
    t: 0, dt: 1, playerX, playerAlive: true, solids: [], groundY: GROUND, slots,
    livingSummons: () => 0, requestSummons: () => {}, newId: (p) => `${p}-${++id}`,
  };
  const log: { t: number; state: string; pattern: string | null; elapsed: number; frame: string; facing: number; hit: boolean }[] = [];
  for (let t = 1; t <= ms; t++) {
    ctx.t = t;
    boss.update(ctx);
    log.push({
      t, state: boss.state, pattern: boss.pattern?.id ?? null, elapsed: t - boss.patternStart, facing: boss.facing,
      frame: vanguardFrame(boss, { t, transitionProgress: 0, deadMs: 0 }), hit: !!boss.activeAttack(t),
    });
  }
  return log;
}

describe('vanguard V2 art bound to the existing boss AI', () => {
  it('package frame timings match the locked vanguard patterns exactly (startup / hit windows / recovery)', () => {
    for (const p of BOSS_PATTERNS.vanguard) {
      const action = VANGUARD_PATTERN_ACTION[p.id];
      expect(action, p.id).toBeDefined();
      const v = PATTERNS[action];
      expect(v.windup).toBe(p.startupMs);
      expect(v.recovery).toBe(p.recoveryMs);
      expect(v.windows.map((w) => w.start)).toEqual(Array.from({ length: p.hitCount ?? 1 }, (_, i) => p.startupMs + i * (p.hitSpacingMs ?? 0)));
      for (const w of v.windows) {
        expect(w.duration).toBe(p.activeMsPerHit);
        expect(w.damage).toBe(p.damagePerHit);
        expect(w.parryable).toBe(p.parryable !== false);
      }
    }
  });

  it('lists all 51 atlas frames for the boot check', () => {
    expect(REQUIRED_VANGUARD_FRAMES).toHaveLength(51);
    expect(new Set(REQUIRED_VANGUARD_FRAMES).size).toBe(51);
  });

  it('sword cut: windup shows slash_01–02, the hit window slash_03–04, recovery slash_05–06', () => {
    const log = runBoss(340, 2500).filter((l) => l.pattern === 'sword_cut');
    expect(log.length).toBeGreaterThan(0);
    const frames = (pred: (l: (typeof log)[number]) => boolean) => [...new Set(log.filter(pred).map((l) => l.frame))].sort();
    expect(frames((l) => l.state === 'windup')).toEqual(['slash_01', 'slash_02']);
    expect(frames((l) => l.hit)).toEqual(['slash_03', 'slash_04']);
    expect(frames((l) => l.state === 'recover')).toEqual(['slash_05', 'slash_06']);
  });

  it('rush uses dash_slash frames and the boss faces the player on either side', () => {
    const right = runBoss(400 + 250, 2000);
    expect(right.some((l) => l.pattern === 'rush' && l.frame.startsWith('dash_slash_'))).toBe(true);
    expect(right.find((l) => l.pattern === 'rush')!.facing).toBe(1);
    const left = runBoss(400 - 250, 2000);
    expect(left.find((l) => l.pattern === 'rush')!.facing).toBe(-1);
  });

  it('phase 2 patterns map to combo_3hit / heavy_smash frames', () => {
    const log = runBoss(340, 20000, 2);
    expect(log.some((l) => l.pattern === 'triple_cut' && l.frame.startsWith('combo_3hit_'))).toBe(true);
    expect(log.some((l) => l.pattern === 'red_slam' && l.frame.startsWith('heavy_smash_'))).toBe(true);
  });

  it('parry stagger, phase transition and death use their own V2 actions', () => {
    const boss = new Boss('b1', 'vanguard', 400, GROUND, 0, { minX: 0, maxX: 800 });
    boss.startFight(0);
    const slots = new AttackSlots(2);
    boss.parryStun(1000, slots);
    expect(vanguardFrame(boss, { t: 1000, transitionProgress: 0, deadMs: 0 })).toBe('parry_stagger_01');
    expect(vanguardFrame(boss, { t: 1640, transitionProgress: 0, deadMs: 0 })).toBe('parry_stagger_04');
    boss.beginTransition(2000, slots);
    expect(vanguardFrame(boss, { t: 2000, transitionProgress: 0, deadMs: 0 })).toBe('phase2_transition_01');
    expect(vanguardFrame(boss, { t: 2000, transitionProgress: 0.99, deadMs: 0 })).toBe('phase2_transition_04');
    boss.die(3000, slots);
    expect(vanguardFrame(boss, { t: 3000, transitionProgress: 0, deadMs: 0 })).toBe('death_01');
    expect(vanguardFrame(boss, { t: 3000, transitionProgress: 0, deadMs: 5000 })).toBe('death_06');
  });

  it('the package boss controller is never instantiated (one AI per boss)', () => {
    const sources = import.meta.glob('../../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    const offenders = Object.entries(sources).filter(([, text]) => /new\s+(VanguardBossController|PhaserVanguard)\b/.test(text)).map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
