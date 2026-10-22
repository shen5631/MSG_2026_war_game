// Builds the collision world of a round from levels.json (coordinates are implementation defaults).
import { DEFAULTS, type RoundSpec } from '../config/spec';
import type { Solid, SolidKind } from './physics';

const SIZES: Record<SolidKind, { w: number; h: number; hp: number; destructible: boolean; blocks: boolean }> = {
  crate: { w: 32, h: 32, hp: DEFAULTS.world.crateHp, destructible: true, blocks: true },
  step: { w: 96, h: 40, hp: 0, destructible: false, blocks: true },
  // Wooden platform (art: wood_platform_04). Solid down to the ground: no walking underneath.
  platform: { w: 112, h: 44, hp: 0, destructible: false, blocks: true },
  rock: { w: 48, h: 24, hp: 0, destructible: false, blocks: true },
  // Sized to the palisade_wall art (was 28×48 before real art existed).
  barricade: { w: 52, h: 46, hp: DEFAULTS.world.barricadeHp, destructible: true, blocks: true },
};

/**
 * Extra jumpable terrain in traversal sections only (never inside combat or boss arenas).
 * Implementation-default layout added with the round-1 environment art; levels.json props are unchanged.
 */
const EXTRA_TERRAIN: Record<number, { x: number; kind: SolidKind }[]> = {
  1: [
    { x: 760, kind: 'platform' },
    { x: 2200, kind: 'platform' },
  ],
  2: [
    { x: 580, kind: 'platform' },
    { x: 3120, kind: 'platform' },
  ],
  3: [
    { x: 720, kind: 'platform' },
    { x: 2200, kind: 'platform' },
    { x: 3600, kind: 'platform' },
  ],
};

/** Boss arena obstacles per round (relative to arena left). Round 1: flat ground in front of the gate. */
const BOSS_OBSTACLES: Record<number, { dx: number; kind: SolidKind }[]> = {
  1: [],
  2: [
    { dx: 128, kind: 'rock' },
    { dx: 576, kind: 'rock' },
  ],
  3: [
    { dx: 112, kind: 'barricade' },
    { dx: 568, kind: 'barricade' },
  ],
};

export function makeSolid(id: string, kind: SolidKind, centerX: number, groundY: number): Solid {
  const s = SIZES[kind];
  return {
    id,
    kind,
    x: centerX - s.w / 2,
    y: groundY - s.h,
    w: s.w,
    h: s.h,
    hp: s.hp,
    maxHp: s.hp,
    destructible: s.destructible,
    alive: true,
    blocksProjectiles: s.blocks,
  };
}

export function buildSolids(round: RoundSpec): Solid[] {
  const solids: Solid[] = [];
  round.traversalProps.forEach((p, i) => solids.push(makeSolid(`r${round.id}p${i}`, p.kind, p.x, round.groundY)));
  (EXTRA_TERRAIN[round.id] ?? []).forEach((t, i) => solids.push(makeSolid(`r${round.id}t${i}`, t.kind, t.x, round.groundY)));
  (BOSS_OBSTACLES[round.id] ?? []).forEach((o, i) =>
    solids.push(makeSolid(`r${round.id}b${i}`, o.kind, round.bossArena.left + o.dx, round.groundY)),
  );
  return solids;
}
