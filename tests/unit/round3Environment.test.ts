import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/round3_environment_game_ready_v1/manifest.json';
import runtime from '../../spec/runtime_assets.json';
import { LEVELS } from '../../src/config/spec';
import { buildSolids } from '../../src/domain/world';
import { R3_CONTENT, R3_DECOR, R3_GROUND_PIECES, R3_SOLID_ART, REQUIRED_ROUND3_TILES, r3TextureKey, r3TileFile } from '../../src/game/visual/round3Environment';

const tiles = new Map((manifest as unknown as { assets: { id: string; file: string; size: [number, number] }[] }).assets.map((a) => [a.id, a]));
const registered = new Map((runtime as unknown as { assets: { key: string; texture: string }[] }).assets.map((a) => [a.key, a.texture]));

describe('round 3 environment art (round3_environment_game_ready_v1)', () => {
  it('the package has its 93 separate tiles; every used crop lies inside its tile', () => {
    expect(tiles.size).toBe(93);
    const inside = (id: string, r: { x: number; y: number; w: number; h: number }) => {
      const t = tiles.get(id);
      expect(t, id).toBeDefined();
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= t!.size[0] && r.y + r.h <= t!.size[1], `${id} crop inside ${t!.size}`).toBe(true);
    };
    for (const [id, r] of Object.entries(R3_CONTENT)) inside(id, r);
    for (const p of R3_GROUND_PIECES) inside(p.frame, p);
  });

  it('every tile the code uses is registered as its own image at the package path (no re-cut sheet)', () => {
    for (const art of Object.values(R3_SOLID_ART)) expect(REQUIRED_ROUND3_TILES).toContain(art.frame);
    for (const d of R3_DECOR) expect(REQUIRED_ROUND3_TILES).toContain(d.frame);
    for (const id of REQUIRED_ROUND3_TILES) {
      expect(registered.get(r3TextureKey(id)), id).toBe(r3TileFile(id));
      expect(`assets/round3_environment_game_ready_v1/${tiles.get(id)!.file}`).toBe(r3TileFile(id));
    }
  });

  it('collision comes from the domain solids (unchanged layout); all are jumpable and sit on the ground', () => {
    const r3 = LEVELS.rounds[2];
    const solids = buildSolids(r3);
    expect(solids.map((s) => s.kind).sort()).toEqual(['barricade', 'barricade', 'crate', 'crate', 'platform', 'platform', 'platform', 'step', 'step']);
    for (const s of solids) {
      expect(s.y + s.h).toBe(r3.groundY);
      expect(r3.groundY - s.y).toBeLessThanOrEqual(46); // jump peak ≈ 73 px
    }
  });
});
