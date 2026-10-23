// Small HP bar over regular enemies, in the same language as the player's HUD bar: dark frame, red fill and an
// orange "lag" segment that holds briefly after a hit and then drains down to the new HP. Display only — HP comes
// from the simulation and the lag runs on sim time (it freezes with the game on pause).
import type Phaser from 'phaser';

export const ENEMY_BAR_W = 22;
export const ENEMY_BAR_H = 3;
const LAG_HOLD_MS = 350;
/** Lag drain speed as a fraction of max HP per millisecond (a full bar drains in ~1.25 s). */
const LAG_DRAIN_PER_MS = 0.0008;

export interface EnemyBarState { lagHp: number; lastHp: number; holdUntil: number; lastT: number }

export function newEnemyBarState(hp: number, t: number): EnemyBarState {
  return { lagHp: hp, lastHp: hp, holdUntil: -Infinity, lastT: t };
}

export function stepEnemyBar(s: EnemyBarState, hp: number, maxHp: number, t: number): void {
  const dt = Math.max(0, t - s.lastT);
  s.lastT = t;
  if (hp < s.lastHp) s.holdUntil = t + LAG_HOLD_MS;
  s.lastHp = hp;
  if (hp >= s.lagHp) s.lagHp = hp;
  else if (t >= s.holdUntil) s.lagHp = Math.max(hp, s.lagHp - maxHp * LAG_DRAIN_PER_MS * dt);
}

/** Whole-pixel widths of the red fill and of the orange lag (lag drawn under the fill). */
export function enemyBarWidths(hp: number, lagHp: number, maxHp: number): { fill: number; lag: number } {
  const px = (v: number) => (v <= 0 ? 0 : Math.max(1, Math.round((Math.min(v, maxHp) / maxHp) * ENEMY_BAR_W)));
  return { fill: px(hp), lag: px(lagHp) };
}

/** Draws the bar centred on x with its bottom edge at y. */
export function drawEnemyBar(g: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, maxHp: number, s: EnemyBarState): void {
  const { fill, lag } = enemyBarWidths(hp, s.lagHp, maxHp);
  const left = Math.round(x - ENEMY_BAR_W / 2);
  const top = Math.round(y - ENEMY_BAR_H);
  g.clear();
  g.fillStyle(0x0b0f18, 0.9).fillRect(left - 1, top - 1, ENEMY_BAR_W + 2, ENEMY_BAR_H + 2);
  g.fillStyle(0x3a0d0d, 1).fillRect(left, top, ENEMY_BAR_W, ENEMY_BAR_H);
  if (lag > fill) g.fillStyle(0xe8892a, 1).fillRect(left, top, lag, ENEMY_BAR_H);
  if (fill > 0) {
    g.fillStyle(0xc9341f, 1).fillRect(left, top, fill, ENEMY_BAR_H);
    g.fillStyle(0xf0735a, 1).fillRect(left, top, fill, 1);
  }
  // gold corner ticks tie it to the HUD frames
  g.fillStyle(0xc9a85a, 1).fillRect(left - 2, top - 1, 1, ENEMY_BAR_H + 2).fillRect(left + ENEMY_BAR_W + 1, top - 1, 1, ENEMY_BAR_H + 2);
}
