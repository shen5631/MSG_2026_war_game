import Phaser from 'phaser';

// (project: ATLAS/FRAMES/FPS exported so the sim-time adapter can read them; otherwise unchanged)
export const ATLAS = 'sobaeap-final-v3';
const PREFIX = '/assets/sobaeap_final_v3';
export const FRAMES: Record<string, number> = { idle: 4, walk: 6, attack: 5, charge: 2, combo: 4, phase2: 4, hurt: 4, death: 6 };
export const FPS: Record<string, number> = { idle: 6, walk: 9, attack: 10, charge: 10, combo: 11, phase2: 9, hurt: 9, death: 8 };

export const SOBAEAP_MAX_HP = 700;
export const SOBAEAP_PHASE_TWO_HP = 350;

/** Must be called during Scene.preload(). */
export function preloadSobaeapV3(scene: Phaser.Scene): void {
  scene.load.atlas(ATLAS, `${PREFIX}/atlas/sobaeap_atlas.png`, `${PREFIX}/atlas/sobaeap_atlas.json`);
}

/** Must be called during Scene.create(), after atlas loading. */
export function registerSobaeapV3Animations(scene: Phaser.Scene): void {
  for (const [action, n] of Object.entries(FRAMES)) {
    const key = `sobaeap-v3-${action}`;
    if (scene.anims.exists(key)) continue;
    const frames = Array.from({ length: n }, (_, i) => ({ key: ATLAS, frame: `sobaeap_${action}_${String(i + 1).padStart(2, '0')}.png` }));
    scene.anims.create({ key, frames, frameRate: FPS[action], repeat: action === 'idle' || action === 'walk' ? -1 : 0 });
  }
}

export type SobaeapVisualState = keyof typeof FRAMES;

/** Presentation only. Reuse your project's existing combat AI, timing, hit boxes and HP. */
export class PhaserSobaeapVisual {
  readonly sprite: Phaser.GameObjects.Sprite;
  private state = 'idle';
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.sprite = scene.add.sprite(x, groundY, ATLAS, 'sobaeap_idle_01.png');
    this.sprite.setOrigin(0.5, 282 / 320).setScale(1);
    this.sprite.play('sobaeap-v3-idle');
  }
  sync(x: number, groundY: number, facing: 1 | -1, state: string): void {
    this.sprite.setPosition(x, groundY).setFlipX(facing === -1);
    const name = Object.prototype.hasOwnProperty.call(FRAMES, state) ? state : 'idle';
    if (this.state !== name) {
      this.state = name;
      this.sprite.play(`sobaeap-v3-${name}`, true);
    }
  }
  destroy(): void { this.sprite.destroy(); }
}
