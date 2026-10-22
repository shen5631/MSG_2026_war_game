// Real Khitan archer art (v2 cleaned pack): frame choice and display alignment only.
// Frames come from atlas/khitan_archer_all_atlas.json as-is (never re-split); every frame shares baseline y=122.
// Combat timing stays in the domain: the arrow is spawned once by Enemy.update when windup ends.
import type { Enemy, Projectile } from '../../domain/enemies';

export const ARCHER_KEY = 'khitan_archer';
export const ARROW_KEYS = ['khitan_archer_arrow_01', 'khitan_archer_arrow_02'] as const;

const FRAMES = {
  idle: [1, 2, 3, 4].map((i) => `khitan_archer_idle_0${i}.png`),
  walk: [1, 2, 3, 4, 5, 6].map((i) => `khitan_archer_walk_0${i}.png`),
  attack: [1, 2, 3, 4, 5, 6].map((i) => `khitan_archer_attack_0${i}.png`),
  hurt: [1, 2, 3].map((i) => `khitan_archer_hurt_0${i}.png`),
  death: [1, 2, 3, 4, 5, 6].map((i) => `khitan_archer_death_0${i}.png`),
};
export const REQUIRED_ARCHER_FRAMES = Object.values(FRAMES).flat();

/** Pack origin (0.5, 122/128): feet on body.y for every frame. */
export const ARCHER_ORIGIN = { x: 0.5, y: 0.953125 } as const;
/**
 * Drawn standing height is ~90px with the nocked arrow 63px above the feet. At 0.8 the archer is ~72px tall
 * (between its 66px body and the infantry's ~79px) and the bow line sits ~50px up, near the domain arrow (44px).
 */
export const ARCHER_SCALE = 0.8;
/** Release pose (attack_06) is held this long after the arrow spawns, then idle resumes. */
const RELEASE_HOLD_MS = 240;

const pick = (n: number, p: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n)));

export function archerFrame(e: Enemy, t: number, windupMs: number): string {
  switch (e.state) {
    case 'move': {
      // Archers back away while still facing the player: play the walk cycle in reverse (no dedicated retreat sheet).
      const i = Math.floor(t / 125) % 6;
      const backing = e.body.vx !== 0 && Math.sign(e.body.vx) !== e.facing;
      return FRAMES.walk[backing ? 5 - i : i];
    }
    // attack_01..05 = ready, draw arrow, nock, draw bow, aim — spread over the windup.
    case 'windup': return FRAMES.attack[pick(5, (t - e.stateT) / windupMs)];
    // attack_06 = release; recover begins on the same step the single arrow is spawned.
    case 'recover': return t - e.stateT < RELEASE_HOLD_MS ? FRAMES.attack[5] : FRAMES.idle[Math.floor(t / 200) % 4];
    case 'stunned':
    case 'guardBroken': return FRAMES.hurt[Math.min(2, Math.floor((t - e.stateT) / 70))];
    case 'dead': return FRAMES.death[Math.min(5, Math.floor((t - e.deadAt) / 125))];
    default: return FRAMES.idle[Math.floor(t / 200) % 4];
  }
}

// ---- Arrow projectile (64x32, points right; tip at x=59, shaft centred on row 15) ----
const ARROW_TIP_X = 59.5 / 64;
const ARROW_SHAFT_Y = 15.5 / 32;
/** Domain arrow hitbox is 14px wide centred on p.x: the drawn tip sits on its leading edge. */
const HITBOX_HALF_W = 7;

/** Variant chosen once per projectile (stable for its lifetime); variants are shapes, not animation frames. */
export const arrowTextureFor = (p: Projectile): string => ARROW_KEYS[(Number(p.id.split('-').pop()) || 0) % 2];

export function arrowPlacement(p: Projectile): { x: number; y: number; originX: number; originY: number; flipX: boolean } {
  const dir = p.vx < 0 ? -1 : 1;
  // flipX mirrors inside the frame, so the tip moves to 1 - TIP when facing left.
  return { x: p.x + dir * HITBOX_HALF_W, y: p.y, originX: dir < 0 ? 1 - ARROW_TIP_X : ARROW_TIP_X, originY: ARROW_SHAFT_Y, flipX: dir < 0 };
}
