// Round-3 final boss 소배압 — V2 art (sobaeap_final_boss_v2) driven by the EXISTING domain Boss AI
// (src/domain/boss.ts: HP 700, phase 2 at 350, distance/phase pattern choice, summons ≤3). Only frame choice lives
// here; no second AI, hitbox or damage. Frames follow the same pattern clock the domain uses for its hit windows,
// so the thrust frames are on screen exactly while a hit is live.
import { DEFAULTS, type BossPatternSpec } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import { SOBAEAP_ANIMATIONS, SOBAEAP_DISPLAY, SOBAEAP_TEXTURE_KEY, chooseSobaeapFrame, type SobaeapAction } from '../bosses/sobaeap/PhaserSobaeapVisual';

export const SOBAEAP_KEY = SOBAEAP_TEXTURE_KEY;
/** Feet anchor (224,220) of the 448×256 frames. */
export const SOBAEAP_ORIGIN = { x: SOBAEAP_DISPLAY.originX, y: SOBAEAP_DISPLAY.originY };
export const REQUIRED_SOBAEAP_FRAMES = (Object.keys(SOBAEAP_ANIMATIONS) as SobaeapAction[]).flatMap((a) => [...SOBAEAP_ANIMATIONS[a].frames]);

const DEATH_MS = 900;
const f = (action: SobaeapAction, n: number): string => SOBAEAP_ANIMATIONS[action].frames[n - 1];

/** Domain pattern id → V2 action. Multi-hit sword patterns use the combo sheet, the rush the charge sheet. */
export const SOBAEAP_PATTERN_ACTION: Record<string, 'attack' | 'charge' | 'combo'> = {
  double_sword: 'combo',
  fast_triple: 'combo',
  rush: 'charge',
  heavy_cut: 'attack',
  red_ground_wave: 'attack',
  summon: 'attack',
};
/** Thrust frame for hit 1/2/3 of a combo; between hits the spear is drawn back (combo_04). */
const COMBO_HITS = [f('combo', 2), f('combo', 5), f('combo', 3)];

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
    if (action === 'combo') return into < active ? COMBO_HITS[k % COMBO_HITS.length] : f('combo', 4);
    if (action === 'charge') return [f('charge', 2), f('charge', 3), f('charge', 4)][Math.min(2, Math.floor((into / Math.max(1, active)) * 3))];
    return into < active / 2 ? f('attack', 3) : f('attack', 4);
  }
  const r = e - lastEnd;
  if (action === 'combo') return f('combo', 6);
  if (action === 'charge') return f('charge', 5);
  // Spear held out a moment after the thrust, then drawn back (no hit: summon command goes straight to the pose).
  return hits > 0 && r < Math.min(200, recMs / 3) ? f('attack', 4) : f('attack', 5);
}

export interface SobaeapView { t: number; transitionProgress: number; deadMs: number }

export function sobaeapFrame(b: Boss, v: SobaeapView): string {
  const t = v.t;
  switch (b.state) {
    case 'move': {
      // Faces the player while backing off: reverse the walk cycle (no dedicated retreat frames).
      const n = SOBAEAP_ANIMATIONS.walk.frames.length;
      const i = Math.floor((t * SOBAEAP_ANIMATIONS.walk.fps) / 1000) % n;
      const backing = b.body.vx !== 0 && Math.sign(b.body.vx) !== b.facing;
      return SOBAEAP_ANIMATIONS.walk.frames[backing ? n - 1 - i : i];
    }
    case 'windup':
    case 'hits':
    case 'recover':
      if (!b.pattern) return chooseSobaeapFrame('idle', t);
      return sobaeapPatternFrame(b.pattern, t - b.patternStart, b.recoveryMs(b.pattern));
    // Parry stun: the hurt sheet across the boss stun.
    case 'stunned': return chooseSobaeapFrame('hurt', ((t - b.stateT) / DEFAULTS.combat.parryStunBossMs) * (4000 / SOBAEAP_ANIMATIONS.hurt.fps) * 0.999);
    case 'transition': return f('phase2', 1 + Math.min(3, Math.floor(v.transitionProgress * 4)));
    case 'dead': return f('death', 1 + Math.min(5, Math.floor((v.deadMs / DEATH_MS) * 6)));
    default: return chooseSobaeapFrame('idle', t);
  }
}
