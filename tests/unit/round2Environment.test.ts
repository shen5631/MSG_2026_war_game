import { describe, expect, it } from 'vitest';
import atlas from '../../public/assets/round2_environment_v2/atlas/round2_environment_atlas.json';
import { LEVELS } from '../../src/config/spec';
import { buildSolids } from '../../src/domain/world';
import { R2_CONTENT, R2_DECOR, R2_GROUND_PIECES, R2_SOLID_ART, REQUIRED_ROUND2_ENV_FRAMES } from '../../src/game/visual/round2Environment';

const frames = (atlas as { frames: Record<string, { frame: { w: number; h: number } }> }).frames;
const inside = (name: string, r: { x: number; y: number; w: number; h: number }) => {
  const f = frames[name]?.frame;
  expect(f, name).toBeDefined();
  expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= f.w && r.y + r.h <= f.h, `${name} crop inside ${f.w}x${f.h}`).toBe(true);
};

describe('round 2 environment art (round2_environment_game_ready_v2)', () => {
  it('atlas has the 70 supplied frames; every used crop lies inside its frame', () => {
    expect(Object.keys(frames)).toHaveLength(70);
    for (const [name, r] of Object.entries(R2_CONTENT)) inside(name, r);
    for (const p of R2_GROUND_PIECES) inside(p.frame, p);
  });

  it('every solid kind and decor entry uses a measured frame that the boot check requires', () => {
    for (const art of Object.values(R2_SOLID_ART)) expect(REQUIRED_ROUND2_ENV_FRAMES).toContain(art.frame);
    for (const d of R2_DECOR) expect(REQUIRED_ROUND2_ENV_FRAMES).toContain(d.frame);
  });

  it('collision comes from the domain solids, not PNG bounds; the added palisade stays out of combat arenas', () => {
    const r2 = LEVELS.rounds[1];
    const solids = buildSolids(r2);
    expect(solids.map((s) => s.kind).sort()).toEqual(['barricade', 'crate', 'crate', 'platform', 'platform', 'rock', 'rock', 'step', 'step']);
    const palisade = solids.find((s) => s.kind === 'barricade')!;
    expect({ w: palisade.w, h: palisade.h, y: palisade.y + palisade.h }).toEqual({ w: 52, h: 46, y: r2.groundY });
    const arenas = [...r2.arenas.map((a) => [a.left, a.right]), [r2.bossArena.left, r2.bossArena.left + r2.bossArena.width]];
    for (const [l, r] of arenas) expect(palisade.x + palisade.w <= l || palisade.x >= r).toBe(true);
    // all obstacles stay low enough to jump (player jump peak ≈ 73 px above the ground)
    for (const s of solids) expect(r2.groundY - s.y).toBeLessThanOrEqual(46);
  });
});
