import type { ShieldSnapshot } from './core.js';
import { REQUIRED_FRAME_KEYS, SHIELD_TEXTURE_KEY, SHIELD_ORIGIN, shieldVisualPose, shieldFormation } from './presentation.js';
import type { HostAnchor } from './presentation.js';

/** Structural contracts for the small Phaser 3 API surface used here. Not fake Phaser typings. */
export interface PhaserImageLike {
  setOrigin(x: number, y: number): PhaserImageLike;
  setFrame(frame: string): PhaserImageLike;
  setPosition(x: number, y: number): PhaserImageLike;
  setFlipX(value: boolean): PhaserImageLike;
  setDepth(value: number): PhaserImageLike;
  setVisible(value: boolean): PhaserImageLike;
  setAlpha(value: number): PhaserImageLike;
  setScale(value: number): PhaserImageLike;
  destroy(): void;
}
export interface PhaserGraphicsLike {
  clear(): PhaserGraphicsLike;
  setDepth(value: number): PhaserGraphicsLike;
  setVisible(value: boolean): PhaserGraphicsLike;
  lineStyle(width: number, color: number, alpha?: number): PhaserGraphicsLike;
  fillStyle(color: number, alpha?: number): PhaserGraphicsLike;
  strokeEllipse(x: number, y: number, width: number, height: number, smoothness?: number): PhaserGraphicsLike;
  fillEllipse(x: number, y: number, width: number, height: number, smoothness?: number): PhaserGraphicsLike;
  destroy(): void;
}
export interface PhaserShieldScene {
  load: { atlas(key: string, textureURL: string, atlasURL: string): unknown; };
  textures: { exists(key: string): boolean; get(key: string): { has(frame: string): boolean; }; };
  add: { image(x: number, y: number, key: string, frame: string): PhaserImageLike; graphics(): PhaserGraphicsLike; };
}

/** Call once in Boot/PlayScene.preload as part of the project's existing all-at-once loading. */
export function preloadShieldSkill(scene: PhaserShieldScene, assetBase = '/assets/goryeo_shield_skill_v1/'): void {
  if (scene.textures.exists(SHIELD_TEXTURE_KEY)) return;
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  scene.load.atlas(SHIELD_TEXTURE_KEY, `${base}atlas/goryeo_shield_atlas.png`, `${base}atlas/goryeo_shield_atlas.json`);
}

export interface ShieldViewOptions { readonly spread?: number; readonly scale?: number; readonly soldierAlpha?: number; readonly showBarrier?: boolean; }
/** Read-only view. DOES NOT own HP, cooldowns, keyboard/gamepad bindings, clocks, bodies, or damage. */
export class PhaserShieldView {
  private readonly soldiers: PhaserImageLike[];
  private readonly barrier: PhaserGraphicsLike;
  private disposed = false;
  private readonly options: Required<ShieldViewOptions>;
  constructor(scene: PhaserShieldScene, options: ShieldViewOptions = {}) {
    this.options = { spread: options.spread ?? 34, scale: options.scale ?? 1,
      soldierAlpha: options.soldierAlpha ?? 0.86, showBarrier: options.showBarrier ?? true };
    if (!Number.isFinite(this.options.scale) || this.options.scale <= 0 || !Number.isFinite(this.options.spread) || this.options.spread < 0 || !Number.isFinite(this.options.soldierAlpha) || this.options.soldierAlpha < 0 || this.options.soldierAlpha > 1) {
      throw new RangeError('Invalid ShieldViewOptions');
    }
    if (!scene.textures.exists(SHIELD_TEXTURE_KEY)) throw new Error('Shield atlas not loaded. Call preloadShieldSkill during preload first.');
    const texture = scene.textures.get(SHIELD_TEXTURE_KEY);
    for (const name of REQUIRED_FRAME_KEYS) if (!texture.has(name)) throw new Error(`Missing shield frame: ${name}`);
    this.soldiers = [0, 1].map(() => scene.add.image(0, 0, SHIELD_TEXTURE_KEY, 'guard_01')
      .setOrigin(SHIELD_ORIGIN.x, SHIELD_ORIGIN.y).setScale(this.options.scale).setVisible(false));
    this.barrier = scene.add.graphics().setVisible(false);
  }
  render(state: ShieldSnapshot, host: HostAnchor): void {
    if (this.disposed) throw new Error('PhaserShieldView has been disposed');
    const pose = shieldVisualPose(state);
    this.barrier.clear().setVisible(pose.visible && this.options.showBarrier).setDepth(host.depth - 2);
    if (!pose.visible) { this.soldiers.forEach(s => s.setVisible(false)); return; }
    const formation = shieldFormation(host, this.options.spread);
    this.soldiers.forEach((s, i) => s.setFrame(pose.frame)
      .setOrigin(SHIELD_ORIGIN.x, SHIELD_ORIGIN.y)
      .setPosition(formation[i].x, formation[i].y).setFlipX(formation[i].flipX)
      .setDepth(formation[i].depth).setAlpha(this.options.soldierAlpha).setVisible(true));
    if (this.options.showBarrier) {
      const x = Math.round(host.x); const y = Math.round(host.footY - 47);
      this.barrier.fillStyle(0x3c7fb6, 0.025 + 0.045 * pose.strength).fillEllipse(x, y, 138, 112, 32);
      this.barrier.lineStyle(1, 0xf4d180, 0.22 + 0.58 * pose.strength).strokeEllipse(x, y, 138, 112, 32);
    }
  }
  clear(): void { this.soldiers.forEach(s => s.setVisible(false)); this.barrier.clear().setVisible(false); }
  dispose(): void {
    if (this.disposed) return;
    this.soldiers.forEach(s => s.destroy()); this.barrier.destroy(); this.disposed = true;
  }
}
