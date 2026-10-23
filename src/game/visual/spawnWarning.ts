// Enemy spawn marker, drawn only at the exact x where an enemy will appear (positions come from the round sim's
// planned spawns). A red ground sigil that closes in as the spawn approaches, a faint light column and a bobbing
// arrow above it. Display only; all timing is sim time so it freezes on pause.
import type Phaser from 'phaser';

const RED = 0xe0482c;
const GLOW = 0xff8a4a;

/** 0 when the warning appears, 1 at the spawn instant. */
export function spawnWarningProgress(start: number, until: number, t: number): number {
  if (until <= start) return 1;
  return Math.max(0, Math.min(1, (t - start) / (until - start)));
}

/** Half-width of the closing ground ring in px: wide at first, settles on the body width at spawn. */
export function spawnRingHalfWidth(progress: number): number {
  return Math.round(26 - 12 * progress);
}

export function drawSpawnWarning(g: Phaser.GameObjects.Graphics, x: number, groundY: number, progress: number, t: number): void {
  const cx = Math.round(x);
  const fadeIn = Math.min(1, 0.4 + progress * 6);
  const blink = Math.floor(t / 90) % 2 ? 1 : 0.75;

  // light column, brighter towards the ground
  for (let i = 0; i < 5; i++) {
    g.fillStyle(GLOW, (0.1 + 0.07 * i) * fadeIn * (0.7 + 0.3 * progress));
    g.fillRect(cx - 9 + i, groundY - 70 + i * 14, 18 - i * 2, 70 - i * 14);
  }

  // ground sigil: fixed inner mark + ring closing in
  const hw = spawnRingHalfWidth(progress);
  g.fillStyle(RED, 0.45 * fadeIn).fillEllipse(cx, groundY - 1, 30, 7);
  g.lineStyle(3, 0x1a0806, 0.6 * fadeIn).strokeEllipse(cx, groundY - 1, hw * 2 + 2, Math.max(5, Math.round(hw / 3) + 2));
  g.lineStyle(2, RED, fadeIn * blink).strokeEllipse(cx, groundY - 1, hw * 2, Math.max(4, Math.round(hw / 3)));
  g.lineStyle(1, 0xffd2a0, 0.9 * fadeIn).strokeEllipse(cx, groundY - 1, 16, 4);

  // arrow pointing at the spot
  const ay = Math.round(groundY - 92 + Math.sin(t / 120) * 3);
  g.fillStyle(0x1a0806, 0.9 * fadeIn).fillTriangle(cx - 9, ay - 2, cx + 9, ay - 2, cx, ay + 11);
  g.fillStyle(RED, fadeIn * blink).fillTriangle(cx - 7, ay, cx + 7, ay, cx, ay + 8);
  g.fillStyle(0xffd2a0, fadeIn).fillRect(cx - 3, ay + 1, 6, 1).fillRect(cx - 1, ay + 2, 2, 3);
}
