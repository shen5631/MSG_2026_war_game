// Real Khitan spearman art (khitan_spearman_enemy_v1): frame choice and display alignment only.
// The existing domain AI (src/domain/enemies.ts, 'spearman') owns movement, timing and the thrust hitbox.
// Frames come from atlas/khitan_spearman_all_atlas.json as-is (never re-split).
import type { Enemy } from '../../domain/enemies';

export const SPEARMAN_KEY = 'khitan_spearman';
const CELL = 192;

const FRAMES = {
  idle: [1, 2, 3, 4].map((i) => `khitan_spearman_idle_0${i}.png`),
  walk: [1, 2, 3, 4, 5, 6].map((i) => `khitan_spearman_walk_0${i}.png`),
  attack: [1, 2, 3, 4, 5, 6].map((i) => `khitan_spearman_attack_0${i}.png`),
  hurt: [1, 2, 3].map((i) => `khitan_spearman_hurt_0${i}.png`),
  death: [1, 2, 3, 4, 5, 6].map((i) => `khitan_spearman_death_0${i}.png`),
};
type Action = keyof typeof FRAMES;
export const REQUIRED_SPEARMAN_FRAMES = Object.values(FRAMES).flat();

/**
 * Measured from the supplied atlas: the pack's stated baseline (y=184) does not match the drawings, whose feet
 * end between y=137 and y=162, and the sheets were drawn at different sizes (walk/attack small, hurt large).
 * Bottom opaque row per frame (feet on the ground) …
 */
const FOOT: Record<Action, number[]> = {
  idle: [151, 153, 153, 151], walk: [151, 152, 151, 151, 151, 152], attack: [150, 147, 150, 150, 148, 151],
  hurt: [162, 158, 158], death: [143, 153, 144, 137, 141, 142],
};
/** … feet centre per action (the figure is not centred in the 192px cell; flipX mirrors around the cell) … */
const FEET_X: Record<Action, number> = { idle: 80, walk: 92, attack: 84, hurt: 88, death: 90 };
/** … and display scale per action so the standing figure is ~80px tall like the other Khitan infantry. */
const SCALE: Record<Action, number> = { idle: 0.83, walk: 1.12, attack: 1.2, hurt: 0.72, death: 1.15 };

const pick = (n: number, p: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n)));

export interface SpearmanPose { frame: string; scale: number; originX: number; originY: number }

export function spearmanPose(e: Enemy, t: number, windupMs: number, activeMs: number): SpearmanPose {
  let action: Action = 'idle';
  let i = Math.floor(t / 200) % 4;
  switch (e.state) {
    case 'move': action = 'walk'; i = Math.floor(t / 125) % 6; break;
    // attack_01–03 = draw back during the windup, 04–05 = thrust while the domain hitbox is active, 06 = recovery.
    case 'windup': action = 'attack'; i = pick(3, (t - e.stateT) / windupMs); break;
    case 'active': action = 'attack'; i = 3 + pick(2, (t - e.stateT) / activeMs); break;
    case 'recover': if (t - e.stateT < 300) { action = 'attack'; i = 5; } break;
    case 'stunned': case 'guardBroken': action = 'hurt'; i = Math.min(2, Math.floor((t - e.stateT) / 70)); break;
    case 'dead': action = 'death'; i = Math.min(5, Math.floor((t - e.deadAt) / 125)); break;
    default: break;
  }
  const fx = FEET_X[action] / CELL;
  return {
    frame: FRAMES[action][i],
    scale: SCALE[action],
    // Phaser flips inside the frame: the feet sit at 1 - fx when facing left.
    originX: e.facing < 0 ? 1 - fx : fx,
    originY: (FOOT[action][i] + 1) / CELL,
  };
}
