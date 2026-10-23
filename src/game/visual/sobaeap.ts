// Round-3 final boss 소배압 — V3 art (sobaeap_final_boss_v3, 512×320 frames, feet origin 282/320) driven by the
// EXISTING domain Boss AI (src/domain/boss.ts: HP 700, phase 2 at 350, distance/phase pattern choice, summons ≤3).
// Only frame choice lives here; no second AI, hitbox or damage. Frames follow the same pattern clock the domain uses
// for its hit windows, so the strike frames are on screen exactly while a hit is live. The package's
// PhaserSobaeapVisual (Phaser animation clock) is not instantiated: it would not freeze with pause/hitstop.
import { DEFAULTS, type BossPatternSpec } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import { ATLAS, FPS, FRAMES } from '../bosses/sobaeap/PhaserSobaeapVisual';

export type SobaeapAction = 'idle' | 'walk' | 'attack' | 'charge' | 'combo' | 'phase2' | 'hurt' | 'death';
export const SOBAEAP_KEY = ATLAS;
/** Feet anchor (256,282) of the 512×320 frames. */
export const SOBAEAP_ORIGIN = { x: 0.5, y: 282 / 320 };

const f = (action: SobaeapAction, n: number): string => `sobaeap_${action}_${String(n).padStart(2, '0')}.png`;
export const REQUIRED_SOBAEAP_FRAMES = (Object.keys(FRAMES) as SobaeapAction[]).flatMap((a) => Array.from({ length: FRAMES[a] }, (_, i) => f(a, i + 1)));
/** Looping clip frame on sim time. */
const loop = (a: SobaeapAction, t: number): string => f(a, 1 + (Math.floor((Math.max(0, t) * FPS[a]) / 1000) % FRAMES[a]));

/** Domain pattern id → V3 action. Multi-hit sword patterns use the combo sheet, the rush the charge sheet. */
export const SOBAEAP_PATTERN_ACTION: Record<string, 'attack' | 'charge' | 'combo'> = {
  double_sword: 'combo',
  fast_triple: 'combo',
  rush: 'charge',
  heavy_cut: 'attack',
  red_ground_wave: 'attack',
  summon: 'attack',
};
/** Strike frame for hit 1/2/3 of a combo (wide cut, spin cut, wide cut); between hits the spear is drawn back. */
const COMBO_HITS = [f('combo', 3), f('combo', 4), f('combo', 3)];
export const SOBAEAP_STRIKE_FRAMES = new Set([f('attack', 3), f('attack', 4), f('charge', 2), f('combo', 3), f('combo', 4)]);

/** Frame for pattern `p` at `e` ms after the pattern start (windup → hit windows → recovery of `recMs`). */
export function sobaeapPatternFrame(p: BossPatternSpec, e: number, recMs: number): string {
  const action = SOBAEAP_PATTERN_ACTION[p.id] ?? 'attack';
  const startup = p.startupMs;
  const hits = p.hitCount ?? (p.activeMsPerHit ? 1 : 0);
  const active = p.activeMsPerHit ?? 0;
  const spacing = p.hitSpacingMs ?? 0;
  const lastEnd = hits > 0 ? startup + (hits - 1) * spacing + active : startup;
  if (e < startup) {
    if (action === 'charge') return f('charge', 1);
    if (action === 'combo') return f('combo', 1);
    return e < startup / 2 ? f('attack', 1) : f('attack', 2);
  }
  if (e < lastEnd) {
    const k = spacing > 0 ? Math.min(hits - 1, Math.floor((e - startup) / spacing)) : 0;
    const into = e - startup - k * spacing;
    if (action === 'combo') return into < active ? COMBO_HITS[k % COMBO_HITS.length] : f('combo', 2);
    if (action === 'charge') return f('charge', 2);
    // Thrust, then the wide sweep follows through.
    return into < active / 2 ? f('attack', 3) : f('attack', 4);
  }
  // Recovery: back to the guard stance (summon has no hit: command pose straight to recovery).
  if (action === 'charge') return f('charge', 1);
  if (action === 'combo') return f('combo', 1);
  return hits > 0 && e - lastEnd < Math.min(200, recMs / 3) ? f('attack', 4) : f('attack', 5);
}

export interface SobaeapView { t: number; transitionProgress: number; deadMs: number }

const DEATH_MS = 900;

export function sobaeapFrame(b: Boss, v: SobaeapView): string {
  const t = v.t;
  switch (b.state) {
    case 'move': {
      // Faces the player while backing off: reverse the walk cycle (no dedicated retreat frames).
      const n = FRAMES.walk;
      const i = Math.floor((t * FPS.walk) / 1000) % n;
      const backing = b.body.vx !== 0 && Math.sign(b.body.vx) !== b.facing;
      return f('walk', 1 + (backing ? n - 1 - i : i));
    }
    case 'windup':
    case 'hits':
    case 'recover':
      if (!b.pattern) return loop('idle', t);
      return sobaeapPatternFrame(b.pattern, t - b.patternStart, b.recoveryMs(b.pattern));
    // Parry stun: the hurt sheet across the boss stun.
    case 'stunned': return f('hurt', 1 + Math.min(3, Math.floor(((t - b.stateT) / DEFAULTS.combat.parryStunBossMs) * 4)));
    case 'transition': return f('phase2', 1 + Math.min(3, Math.floor(v.transitionProgress * 4)));
    case 'dead': return f('death', 1 + Math.min(5, Math.floor((v.deadMs / DEATH_MS) * 6)));
    default: return loop('idle', t);
  }
}
