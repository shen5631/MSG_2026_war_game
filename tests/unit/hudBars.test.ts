import { describe, expect, it } from 'vitest';
import { shieldSegment } from '../../src/app/ui/hudBars';

describe('HP bar shield segment', () => {
  it('is hidden without a shield', () => {
    expect(shieldSegment(80, 0, 100)).toEqual({ left: 0, width: 0 });
  });
  it('continues right after the red HP fill when there is room', () => {
    expect(shieldSegment(50, 40, 100)).toEqual({ left: 50, width: 40 });
    expect(shieldSegment(60, 12.5, 100)).toEqual({ left: 60, width: 12.5 });
  });
  it('keeps its full size and covers the end of the red fill when HP + shield overflow', () => {
    expect(shieldSegment(100, 40, 100)).toEqual({ left: 60, width: 40 });
    expect(shieldSegment(80, 40, 100)).toEqual({ left: 60, width: 40 });
  });
});
