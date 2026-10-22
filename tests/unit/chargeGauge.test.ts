import { describe, expect, it } from 'vitest';
import { LOCKED } from '../../src/config/spec';
import { chargeLevel } from '../../src/domain/damage';
import { chargeSegments } from '../../src/game/visual/chargeGauge';

describe('over-head charge gauge', () => {
  it('fills one segment per locked threshold (0.5 / 1.0 / 1.5 s)', () => {
    expect(LOCKED.player.chargeThresholdMs).toEqual([500, 1000, 1500]);
    expect(chargeSegments(0)).toEqual([0, 0, 0]);
    expect(chargeSegments(250)).toEqual([0.5, 0, 0]);
    expect(chargeSegments(500)).toEqual([1, 0, 0]);
    expect(chargeSegments(750)).toEqual([1, 0.5, 0]);
    expect(chargeSegments(1500)).toEqual([1, 1, 1]);
    expect(chargeSegments(4000)).toEqual([1, 1, 1]);
  });

  it('completed segments always equal the domain charge level', () => {
    for (let ms = 0; ms <= 2000; ms += 25) {
      const full = chargeSegments(ms).filter((f) => f >= 1).length;
      expect(full, `${ms}ms`).toBe(chargeLevel(ms));
    }
  });
});
