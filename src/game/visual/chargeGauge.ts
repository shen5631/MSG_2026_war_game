// Over-head charge gauge: three segments, one per locked charge threshold (0.5 / 1.0 / 1.5 s).
// Visual only — charge level and release damage stay in the domain (chargeLevel / chargeReleaseKind).
import Phaser from 'phaser';
import { LOCKED } from '../../config/spec';

const [T1, T2, T3] = LOCKED.player.chargeThresholdMs;
const BOUNDS = [0, T1, T2, T3];
/** Segment colours: stage 1 gold, stage 2 orange, stage 3 red. */
export const GAUGE_COLORS = [0xf5d76e, 0xffa040, 0xff5a3a] as const;
const W = 44;
const H = 5;
const GAP = 2;
const SEG_W = (W - GAP * 2) / 3;
/** Above the hero's head (sprite ~88px tall from the feet). */
export const GAUGE_OFFSET_Y = -100;

/** Fill 0..1 of each of the three segments for a hold time. */
export function chargeSegments(heldMs: number): [number, number, number] {
  const seg = (i: number) => Math.max(0, Math.min(1, (heldMs - BOUNDS[i]) / (BOUNDS[i + 1] - BOUNDS[i])));
  return [seg(0), seg(1), seg(2)];
}

export function drawChargeGauge(g: Phaser.GameObjects.Graphics, x: number, feetY: number, heldMs: number, now: number): void {
  const left = Math.round(x - W / 2);
  const top = Math.round(feetY + GAUGE_OFFSET_Y);
  const full = heldMs >= T3;
  g.clear();
  // frame: dark backing with a gold rim, like the menu panels
  g.fillStyle(0x0b1524, 0.85).fillRect(left - 2, top - 2, W + 4, H + 4);
  g.lineStyle(1, full && Math.floor(now / 90) % 2 === 0 ? 0xffffff : 0xd5b35e, 1).strokeRect(left - 2.5, top - 2.5, W + 5, H + 5);
  chargeSegments(heldMs).forEach((f, i) => {
    const sx = left + i * (SEG_W + GAP);
    g.fillStyle(0x253245, 1).fillRect(sx, top, SEG_W, H);
    if (f <= 0) return;
    const done = f >= 1;
    g.fillStyle(GAUGE_COLORS[i], done ? 1 : 0.7).fillRect(sx, top, Math.max(1, Math.round(SEG_W * f)), H);
    if (done) g.fillStyle(0xffffff, 0.45).fillRect(sx, top, SEG_W, 1); // highlight once a stage is reached
  });
}
