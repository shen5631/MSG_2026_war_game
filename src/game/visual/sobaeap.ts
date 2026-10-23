// Round-3 final boss 소배압 — V5 art (sobaeap_no_clipping_v5: one atlas per action, 704×480 frames, feet origin
// 416/480, shown at scale 0.5) driven by the EXISTING domain Boss AI (src/domain/boss.ts: HP 700, phase 2 at 350,
// distance/phase pattern choice, summons ≤3). Only frame choice lives here; no second AI, hitbox or damage. Frames
// follow the same pattern clock the domain uses for its hit windows, so strike frames are on screen exactly while a
// hit is live. The package's Phaser animations (play() on the animation clock) are not used: they would not freeze
// with pause / parry hitstop.
import { DEFAULTS, type BossPatternSpec } from '../../config/spec';
import type { Boss } from '../../domain/boss';
import { SOBAEAP_VISUALS, type SobaeapAnim } from '../bosses/sobaeap/PhaserSobaeapV5';

export type SobaeapAction = SobaeapAnim;
const ANIMS = SOBAEAP_VISUALS.animations;
const ACTIONS = Object.keys(ANIMS) as SobaeapAction[];

/** Atlas key of an action (the package's preload naming). */
export const sobaeapAtlasKey = (a: SobaeapAction): string => `sobaeap-v5-${a}`;
export const SOBAEAP_ATLAS_KEYS = ACTIONS.map(sobaeapAtlasKey);
/** Atlas holding a frame name (`sobaeap_<action>_NN.png`). */
export const sobaeapTextureFor = (frame: string): string => sobaeapAtlasKey(frame.replace(/^sobaeap_/, '').replace(/_\d+\.png$/, '') as SobaeapAction);
/** Feet anchor (352,416) of the 704×480 frames. */
export const SOBAEAP_ORIGIN = { x: SOBAEAP_VISUALS.originX, y: SOBAEAP_VISUALS.originY };
export const SOBAEAP_SCALE = SOBAEAP_VISUALS.scale;

const f = (action: SobaeapAction, n: number): string => `sobaeap_${action}_${String(n).padStart(2, '0')}.png`;
/** Every frame, grouped by the atlas it lives in (for the boot check). */
export const REQUIRED_SOBAEAP_FRAMES: [string, string[]][] = ACTIONS.map((a) => [sobaeapAtlasKey(a), Array.from({ length: ANIMS[a].count }, (_, i) => f(a, i + 1))]);
const loop = (a: SobaeapAction, t: number): string => f(a, 1 + (Math.floor((Math.max(0, t) * ANIMS[a].fps) / 1000) % ANIMS[a].count));

/** Domain pattern id → V5 action. Multi-hit sword patterns use the combo sheet, the rush the charge sheet. */
export const SOBAEAP_PATTERN_ACTION: Record<string, 'attack' | 'charge' | 'combo'> = {
  double_sword: 'combo',
  fast_triple: 'combo',
  rush: 'charge',
  heavy_cut: 'attack',
  red_ground_wave: 'attack',
  summon: 'attack',
};
/** Combo: hit 1/2/3 = big arc / spinning cut / low cut; after hit 1/2 the spear is set again (thrust / overhead). */
const COMBO_HITS = [f('combo', 3), f('combo', 5), f('combo', 7)];
const COMBO_BETWEEN = [f('combo', 4), f('combo', 6)];
export const SOBAEAP_STRIKE_FRAMES = new Set([f('attack', 3), f('attack', 4), f('charge', 2), f('charge', 3), f('charge', 4), ...COMBO_HITS]);

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
    return e < startup / 2 ? f(action, 1) : f(action, 2);
  }
  if (e < lastEnd) {
    const k = spacing > 0 ? Math.min(hits - 1, Math.floor((e - startup) / spacing)) : 0;
    const into = e - startup - k * spacing;
    if (action === 'combo') return into < active ? COMBO_HITS[k % COMBO_HITS.length] : COMBO_BETWEEN[k % COMBO_BETWEEN.length];
    if (action === 'charge') return f('charge', 2 + Math.min(2, Math.floor((into / Math.max(1, active)) * 3)));
    // Overhead arc, then the low lunge follows through.
    return into < active / 2 ? f('attack', 3) : f('attack', 4);
  }
  // Recovery (summon has no hit: command pose straight back to the stance).
  if (action === 'charge') return f('charge', 1);
  if (action === 'combo') return f('combo', 8);
  if (hits === 0) return f('attack', 1);
  return e - lastEnd < recMs / 2 ? f('attack', 5) : f('attack', 6);
}

export interface SobaeapView { t: number; transitionProgress: number; deadMs: number }

const DEATH_MS = 900;

export function sobaeapFrame(b: Boss, v: SobaeapView): string {
  const t = v.t;
  switch (b.state) {
    case 'move': {
      // Faces the player while backing off: reverse the walk cycle (no dedicated retreat frames).
      const n = ANIMS.walk.count;
      const i = Math.floor((t * ANIMS.walk.fps) / 1000) % n;
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
