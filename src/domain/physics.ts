// Minimal deterministic platform physics owned by the domain (Phaser Arcade physics is not used).
import type { Rect } from './geometry';

export interface Body {
  x: number; // feet center
  y: number; // feet
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  blockedX: 0 | 1 | -1;
}

export type SolidKind = 'crate' | 'step' | 'platform' | 'rock' | 'barricade';

export interface Solid extends Rect {
  id: string;
  kind: SolidKind;
  hp: number;
  maxHp: number;
  destructible: boolean;
  alive: boolean;
  blocksProjectiles: boolean;
}

export interface Bounds { minX: number; maxX: number }

export function bodyBox(b: Body): Rect {
  return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
}

const hOverlap = (b: Body, s: Rect) => b.x + b.w / 2 > s.x + 0.01 && b.x - b.w / 2 < s.x + s.w - 0.01;

export function isSupported(b: Body, solids: Solid[], groundY: number): boolean {
  if (Math.abs(b.y - groundY) < 0.5) return true;
  return solids.some((s) => s.alive && Math.abs(b.y - s.y) < 0.5 && hOverlap(b, s));
}

export function stepBody(b: Body, dtMs: number, solids: Solid[], bounds: Bounds, groundY: number, gravity: number): void {
  const dt = dtMs / 1000;
  b.blockedX = 0;

  // Horizontal
  let nx = b.x + b.vx * dt;
  for (const s of solids) {
    if (!s.alive) continue;
    const feetAbove = b.y <= s.y + 0.5;
    const headBelow = b.y - b.h >= s.y + s.h;
    if (feetAbove || headBelow) continue;
    const left = nx - b.w / 2;
    const right = nx + b.w / 2;
    if (right > s.x && left < s.x + s.w) {
      if (b.vx > 0 || (b.vx === 0 && b.x < s.x + s.w / 2)) {
        nx = s.x - b.w / 2;
        b.blockedX = 1;
      } else {
        nx = s.x + s.w + b.w / 2;
        b.blockedX = -1;
      }
    }
  }
  const minX = bounds.minX + b.w / 2;
  const maxX = bounds.maxX - b.w / 2;
  if (nx < minX) { nx = minX; b.blockedX = -1; }
  if (nx > maxX) { nx = maxX; b.blockedX = 1; }
  b.x = nx;

  // Vertical
  const prevY = b.y;
  if (!b.onGround || b.vy < 0) b.vy += gravity * dt;
  let ny = b.y + b.vy * dt;
  let landed = false;
  if (b.vy >= 0) {
    for (const s of solids) {
      if (!s.alive || !hOverlap(b, s)) continue;
      if (prevY <= s.y + 0.5 && ny >= s.y) {
        ny = s.y;
        landed = true;
      }
    }
    if (ny >= groundY) { ny = groundY; landed = true; }
  } else {
    for (const s of solids) {
      if (!s.alive || !hOverlap(b, s)) continue;
      const prevTop = prevY - b.h;
      const newTop = ny - b.h;
      if (prevTop >= s.y + s.h - 0.5 && newTop < s.y + s.h) {
        ny = s.y + s.h + b.h;
        b.vy = 0;
      }
    }
  }
  b.y = ny;
  if (landed) {
    b.vy = 0;
    b.onGround = true;
  } else {
    b.onGround = b.vy >= 0 && isSupported(b, solids, groundY);
    if (b.onGround) b.vy = 0;
  }
}
