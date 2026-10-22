// Builds the collision world of a round from levels.json (coordinates are implementation defaults).
import { DEFAULTS, type RoundSpec } from '../config/spec';
import type { Solid, SolidKind } from './physics';

const SIZES: Record<SolidKind, { w: number; h: number; hp: number; destructible: boolean; blocks: boolean }> = {
  crate: { w: 32, h: 32, hp: DEFAULTS.world.crateHp, destructible: true, blocks: true },
  step: { w: 96, h: 40, hp: 0, destructible: false, blocks: true },
  rock: { w: 48, h: 24, hp: 0, destructible: false, blocks: true },
  barricade: { w: 28, h: 48, hp: DEFAULTS.world.barricadeHp, destructible: true, blocks: true },
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
  (BOSS_OBSTACLES[round.id] ?? []).forEach((o, i) =>
    solids.push(makeSolid(`r${round.id}b${i}`, o.kind, round.bossArena.left + o.dx, round.groundY)),
  );
  return solids;
}
