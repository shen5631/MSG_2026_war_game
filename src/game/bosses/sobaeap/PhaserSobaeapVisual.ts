import type Phaser from 'phaser';

// Sobaeap final boss: PRESENTATION ONLY. Combat AI and hitboxes stay in the existing project.
export const SOBAEAP_TEXTURE_KEY = 'sobaeap-final-v2';
export const SOBAEAP_DISPLAY = { originX: 0.5, originY: 220/256, scale: 1 } as const;
export const SOBAEAP_MAX_HP = 700;
export const SOBAEAP_PHASE2_HP = 350;

export const SOBAEAP_ANIMATIONS = {
  "idle": {
    "fps": 5,
    "repeat": -1,
    "frames": [
      "sobaeap_idle_01.png",
      "sobaeap_idle_02.png",
      "sobaeap_idle_03.png",
      "sobaeap_idle_04.png"
    ]
  },
  "walk": {
    "fps": 9,
    "repeat": -1,
    "frames": [
      "sobaeap_walk_01.png",
      "sobaeap_walk_02.png",
      "sobaeap_walk_03.png",
      "sobaeap_walk_04.png",
      "sobaeap_walk_05.png",
      "sobaeap_walk_06.png"
    ]
  },
  "attack": {
    "fps": 12,
    "repeat": 0,
    "frames": [
      "sobaeap_attack_01.png",
      "sobaeap_attack_02.png",
      "sobaeap_attack_03.png",
      "sobaeap_attack_04.png",
      "sobaeap_attack_05.png"
    ]
  },
  "charge": {
    "fps": 12,
    "repeat": 0,
    "frames": [
      "sobaeap_charge_01.png",
      "sobaeap_charge_02.png",
      "sobaeap_charge_03.png",
      "sobaeap_charge_04.png",
      "sobaeap_charge_05.png"
    ]
  },
  "combo": {
    "fps": 13,
    "repeat": 0,
    "frames": [
      "sobaeap_combo_01.png",
      "sobaeap_combo_02.png",
      "sobaeap_combo_03.png",
      "sobaeap_combo_04.png",
      "sobaeap_combo_05.png",
      "sobaeap_combo_06.png"
    ]
  },
  "phase2": {
    "fps": 9,
    "repeat": 0,
    "frames": [
      "sobaeap_phase2_01.png",
      "sobaeap_phase2_02.png",
      "sobaeap_phase2_03.png",
      "sobaeap_phase2_04.png"
    ]
  },
  "hurt": {
    "fps": 10,
    "repeat": 0,
    "frames": [
      "sobaeap_hurt_01.png",
      "sobaeap_hurt_02.png",
      "sobaeap_hurt_03.png",
      "sobaeap_hurt_04.png"
    ]
  },
  "death": {
    "fps": 9,
    "repeat": 0,
    "frames": [
      "sobaeap_death_01.png",
      "sobaeap_death_02.png",
      "sobaeap_death_03.png",
      "sobaeap_death_04.png",
      "sobaeap_death_05.png",
      "sobaeap_death_06.png"
    ]
  }
} as const;
export type SobaeapAction = keyof typeof SOBAEAP_ANIMATIONS;
export type Facing = -1 | 1;

export interface SobaeapViewState {
  x: number;
  y: number;
  facing: Facing;
  action: SobaeapAction;
  elapsedMs: number; // unpaused game time elapsed in the CURRENT action
}

export function preloadSobaeapAssets(scene: Phaser.Scene, base = '/assets/sobaeap_final_v2'): void {
  scene.load.atlas(
    SOBAEAP_TEXTURE_KEY,
    `${base}/atlas/sobaeap_atlas.png`,
    `${base}/atlas/sobaeap_atlas.json`
  );
}

// Optional Phaser animation registration for projects that use built-in AnimationManager.
// Do not combine .play() with state-driven sync() on the same sprite.
export function createSobaeapAnimations(scene: Phaser.Scene): void {
  for (const action of Object.keys(SOBAEAP_ANIMATIONS) as SobaeapAction[]) {
    const data = SOBAEAP_ANIMATIONS[action];
    const key = `sobaeap-${action}-v2`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: data.frames.map(frame => ({ key: SOBAEAP_TEXTURE_KEY, frame })),
      frameRate: data.fps,
      repeat: data.repeat
    });
  }
}

export function chooseSobaeapFrame(action: SobaeapAction, elapsedMs: number): string {
  const data = SOBAEAP_ANIMATIONS[action];
  const step = Math.max(0, Math.floor(Math.max(0, elapsedMs) * data.fps / 1000));
  const index = data.repeat === -1 ? step % data.frames.length : Math.min(step, data.frames.length - 1);
  return data.frames[index];
}

export class SobaeapVisual {
  readonly sprite: Phaser.GameObjects.Sprite;
  private lastFrame = '';

  constructor(scene: Phaser.Scene, x = 0, y = 0, scale = SOBAEAP_DISPLAY.scale) {
    this.sprite = scene.add.sprite(x, y, SOBAEAP_TEXTURE_KEY, SOBAEAP_ANIMATIONS.idle.frames[0]);
    this.sprite.setOrigin(SOBAEAP_DISPLAY.originX, SOBAEAP_DISPLAY.originY);
    this.sprite.setScale(scale);
    this.sprite.setDepth(15);
  }

  sync(state: SobaeapViewState): void {
    this.sprite.setPosition(state.x, state.y);
    this.sprite.setFlipX(state.facing < 0);
    const frame = chooseSobaeapFrame(state.action, state.elapsedMs);
    if (frame !== this.lastFrame) {
      this.sprite.setFrame(frame);
      this.lastFrame = frame;
    }
  }

  setVisible(value: boolean): void { this.sprite.setVisible(value); }
  destroy(): void { this.sprite.destroy(); }
}
