import { describe, expect, it } from 'vitest';
import type { Solid } from '../../src/domain/physics';
import { shadowScale, shadowSurfaceY } from '../../src/game/visual/shadow';

const solid = (x: number, y: number, w: number, h: number, alive = true): Solid =>
  ({ id: 's', kind: 'platform', x, y, w, h, hp: 0, maxHp: 0, destructible: false, alive, blocksProjectiles: true });
const GROUND = 304;
const platform = solid(700, 260, 112, 44); // top y = 260

describe('hero shadow surface', () => {
  it('stays on the ground when nothing is under the feet', () => {
    expect(shadowSurfaceY([platform], 600, GROUND, GROUND)).toBe(GROUND);
  });
  it('sits on the platform top while standing on it or jumping above it', () => {
    expect(shadowSurfaceY([platform], 750, 260, GROUND)).toBe(260);
    expect(shadowSurfaceY([platform], 750, 200, GROUND)).toBe(260);
  });
  it('ignores surfaces above the feet and destroyed solids', () => {
    expect(shadowSurfaceY([platform], 750, 290, GROUND)).toBe(GROUND); // walking under / beside its top
    expect(shadowSurfaceY([solid(700, 272, 32, 32, false)], 710, GROUND, GROUND)).toBe(GROUND);
  });
  it('picks the nearest surface below when several overlap', () => {
    expect(shadowSurfaceY([solid(700, 280, 50, 24), platform], 720, 200, GROUND)).toBe(260);
  });
  it('shrinks with height and is full size on the surface', () => {
    expect(shadowScale(0)).toBe(1);
    expect(shadowScale(70)).toBeCloseTo(0.5);
    expect(shadowScale(500)).toBe(0.45);
  });
});
