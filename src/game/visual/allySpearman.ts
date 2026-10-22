// '창병 공격' ally soldiers (goryeo_spearman_skill_v1, v1 art — see IMPLEMENTATION_NOTES replacement list).
// Pure presentation of RoundSim.allyVisuals: targets and the 50 damage per target are applied by the domain
// (resolveSpear) at the end of the 300 ms command pose; this timeline starts at that same instant and never
// delays or repeats damage. Frames come from the supplied atlas as-is (never re-split).
import type { AllyVisual } from '../../domain/round';

export const ALLY_SPEAR_KEY = 'goryeo_spearman_skill';
const CELL = 192;

const F = (action: string, n: number) => `goryeo_spearman_${action}_0${n}.png`;
export const REQUIRED_ALLY_SPEAR_FRAMES = [
  ...[1, 2, 3, 4].map((i) => F('ready', i)), ...[1, 2, 3, 4, 5, 6].map((i) => F('strike', i)),
  ...[1, 2, 3, 4].map((i) => F('summon', i)), ...[1, 2, 3, 4].map((i) => F('despawn', i)),
];

type Action = 'summon' | 'strike' | 'despawn';
/**
 * Timeline from the damage instant (ms): appear 0–80 (summon_03/04), thrust 80–200 (strike_03/04 = the pack's
 * active frames), follow-through 200–300 (strike_05/06), vanish 300–620 (despawn_01–04). Total = spearVisualMs.
 */
const TIMELINE: { until: number; action: Action; frame: number }[] = [
  { until: 40, action: 'summon', frame: 3 }, { until: 80, action: 'summon', frame: 4 },
  { until: 140, action: 'strike', frame: 3 }, { until: 200, action: 'strike', frame: 4 },
  { until: 250, action: 'strike', frame: 5 }, { until: 300, action: 'strike', frame: 6 },
  { until: 380, action: 'despawn', frame: 1 }, { until: 460, action: 'despawn', frame: 2 },
  { until: 540, action: 'despawn', frame: 3 }, { until: Infinity, action: 'despawn', frame: 4 },
];
export const ALLY_SPEAR_TIMELINE_MS = 620;

/** Measured bottom row of the drawn feet (the pack's stated anchor y=184 does not match the drawings). */
const FOOT: Record<string, number> = {
  summon_03: 152, summon_04: 151, strike_03: 141, strike_04: 139, strike_05: 145, strike_06: 143,
  despawn_01: 154, despawn_02: 154, despawn_03: 158, despawn_04: 150,
};
/** Feet centre per action (figures are not centred in the 192px cell; flipX mirrors around the cell). */
const FEET_X: Record<Action, number> = { summon: 84, strike: 96, despawn: 86 };
/** The strike sheet was drawn at ~60% of the others: scale each action to a ~84px standing soldier. */
const SCALE: Record<Action, number> = { summon: 0.88, strike: 1.2, despawn: 0.82 };

export interface AllySpearPose { frame: string; scale: number; originX: number; originY: number; flipX: boolean }

export function allySpearPose(a: AllyVisual, t: number, visualMs: number): AllySpearPose {
  const age = t - (a.until - visualMs);
  const step = TIMELINE.find((s) => age < s.until)!;
  const key = `${step.action}_0${step.frame}`;
  const fx = FEET_X[step.action] / CELL;
  return {
    frame: F(step.action, step.frame),
    scale: SCALE[step.action],
    originX: a.facing < 0 ? 1 - fx : fx,
    originY: (FOOT[key] + 1) / CELL,
    flipX: a.facing < 0,
  };
}
