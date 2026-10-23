import { describe, expect, it } from 'vitest';
import { ENEMY_BAR_W, enemyBarWidths, newEnemyBarState, stepEnemyBar } from '../../src/game/visual/enemyHpBar';

describe('enemy HP bar (display only)', () => {
  it('red fill drops at once, orange lag holds 350 ms then drains to the new HP on sim time', () => {
    const s = newEnemyBarState(60, 0);
    stepEnemyBar(s, 30, 60, 100);
    expect(enemyBarWidths(30, s.lagHp, 60)).toEqual({ fill: ENEMY_BAR_W / 2, lag: ENEMY_BAR_W });
    stepEnemyBar(s, 30, 60, 440);
    expect(s.lagHp).toBe(60);
    stepEnemyBar(s, 30, 60, 700);
    expect(s.lagHp).toBeLessThan(60);
    expect(s.lagHp).toBeGreaterThan(30);
    stepEnemyBar(s, 30, 60, 3000);
    expect(s.lagHp).toBe(30);
  });

  it('a pause (no sim time passing) freezes the lag; a new hit restarts the hold', () => {
    const s = newEnemyBarState(60, 0);
    stepEnemyBar(s, 40, 60, 0);
    stepEnemyBar(s, 40, 60, 500);
    const frozen = s.lagHp;
    stepEnemyBar(s, 40, 60, 500);
    expect(s.lagHp).toBe(frozen);
    stepEnemyBar(s, 20, 60, 510);
    stepEnemyBar(s, 20, 60, 800);
    expect(s.lagHp).toBe(frozen);
  });

  it('widths are whole pixels, never 0 while alive, and never exceed the bar', () => {
    expect(enemyBarWidths(1, 1, 80).fill).toBe(1);
    expect(enemyBarWidths(0, 0, 80)).toEqual({ fill: 0, lag: 0 });
    expect(enemyBarWidths(80, 999, 80).lag).toBe(ENEMY_BAR_W);
  });
});
