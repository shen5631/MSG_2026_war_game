export interface Rect { x: number; y: number; w: number; h: number }

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Body rect from a feet-centered position. */
export const bodyRect = (x: number, feetY: number, w: number, h: number): Rect => ({ x: x - w / 2, y: feetY - h, w, h });

/** Forward hitbox starting at the body front edge, vertically centered `centerAbove` px above the feet. */
export function forwardHitbox(x: number, feetY: number, bodyW: number, facing: 1 | -1, reach: number, height: number, centerAbove = 40): Rect {
  const front = x + (facing * bodyW) / 2;
  const left = facing === 1 ? front : front - reach;
  return { x: left, y: feetY - centerAbove - height / 2, w: reach, h: height };
}

/** Swept rect covering movement from prev to current (used for dashes/fast projectiles). */
export function sweptRect(prev: Rect, cur: Rect): Rect {
  const x = Math.min(prev.x, cur.x);
  const y = Math.min(prev.y, cur.y);
  return { x, y, w: Math.max(prev.x + prev.w, cur.x + cur.w) - x, h: Math.max(prev.y + prev.h, cur.y + cur.h) - y };
}

/** Seeded deterministic RNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
