import { describe, expect, it } from 'vitest';
import { ENEMY_BAR_W, enemyBarWidths, newEnemyBarState, stepEnemyBar } from '../../src/game/visual/enemyHpBar';

describe('enemy HP bar (display only)', () => {
  it('red fill drops at once, orange lag holds 120 ms then drains a full bar in 0.4 s on sim time', () => {
    const s = newEnemyBarState(60, 0);
    stepEnemyBar(s, 30, 60, 100);
    expect(enemyBarWidths(30, s.lagHp, 60)).toEqual({ fill: ENEMY_BAR_W / 2, lag: ENEMY_BAR_W });
    stepEnemyBar(s, 30, 60, 220);
    expect(s.lagHp).toBe(60);
    stepEnemyBar(s, 30, 60, 320);
    expect(s.lagHp).toBeCloseTo(45);
    stepEnemyBar(s, 30, 60, 420);
    expect(s.lagHp).toBe(30);
  });

  it('a pause (no sim time passing) freezes the lag; a new hit restarts the hold', () => {
    const s = newEnemyBarState(60, 0);
    stepEnemyBar(s, 40, 60, 0);
    stepEnemyBar(s, 40, 60, 150);
    const frozen = s.lagHp;
    expect(frozen).toBeGreaterThan(40);
    stepEnemyBar(s, 40, 60, 150);
    expect(s.lagHp).toBe(frozen);
    stepEnemyBar(s, 20, 60, 160);
    stepEnemyBar(s, 20, 60, 280);
    expect(s.lagHp).toBe(frozen);
  });

  it('widths are whole pixels, never 0 while alive, and never exceed the bar', () => {
    expect(enemyBarWidths(1, 1, 80).fill).toBe(1);
    expect(enemyBarWidths(0, 0, 80)).toEqual({ fill: 0, lag: 0 });
    expect(enemyBarWidths(80, 999, 80).lag).toBe(ENEMY_BAR_W);
  });
});
