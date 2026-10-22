import type { ShieldSnapshot } from './core.js';
export const SHIELD_TEXTURE_KEY = 'goryeo-shield-skill-v1';
export const FRAME_WIDTH = 128;
export const FRAME_HEIGHT = 128;
export const SHIELD_ORIGIN = Object.freeze({ x: 0.5, y: 114 / 128 });
export const REQUIRED_FRAME_KEYS = ['summon', 'guard', 'despawn'].flatMap(a => [1, 2, 3, 4].map(i => `${a}_${String(i).padStart(2, '0')}`));
export type ShieldAction = 'summon' | 'guard' | 'despawn';
export interface VisualPose { readonly visible: boolean; readonly frame: string; readonly action: ShieldAction; readonly strength: number; }
export interface HostAnchor { readonly x: number; readonly footY: number; readonly depth: number; }
export interface SoldierPose { readonly x: number; readonly y: number; readonly flipX: boolean; readonly depth: number; }

/** No animation clock of its own: pausing the game's elapsedMs freezes the pose as well. */
export function shieldVisualPose(state: ShieldSnapshot): VisualPose {
  if (!Number.isFinite(state.remaining) || !Number.isFinite(state.elapsedMs)) throw new RangeError('Invalid shield snapshot');
  if (!state.active || state.remaining <= 0 || state.elapsedMs >= 5000) {
    return { visible: false, frame: 'guard_01', action: 'guard', strength: 0 };
  }
  const t = Math.max(0, state.elapsedMs);
  let action: ShieldAction = 'guard'; let index = 0;
  if (t < 280) { action = 'summon'; index = Math.min(3, Math.floor(t / 70)); }
  else if (t >= 4680) { action = 'despawn'; index = Math.min(3, Math.floor((t - 4680) / 80)); }
  else { index = Math.floor((t - 280) / 160) % 4; }
  return { visible: true, frame: `${action}_${String(index + 1).padStart(2, '0')}`, action,
    strength: Math.max(0, Math.min(1, state.remaining / 40)) };
}
/** Two visual soldiers share the SAME shield; neither has health, AI or a collision body. */
export function shieldFormation(host: HostAnchor, spread = 34): readonly SoldierPose[] {
  if (![host.x, host.footY, host.depth, spread].every(Number.isFinite) || spread < 0) throw new RangeError('Invalid placement');
  return [
    { x: Math.round(host.x - spread), y: Math.round(host.footY), flipX: true, depth: host.depth - 1 },
    { x: Math.round(host.x + spread), y: Math.round(host.footY), flipX: false, depth: host.depth - 1 }
  ];
}
