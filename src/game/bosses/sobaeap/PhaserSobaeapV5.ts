import type Phaser from "phaser";

/** Final boss visual package only. Does NOT implement a boss AI or modify damage rules. */
export const SOBAEAP_VISUALS = {
  assetPath: "assets/sobaeap_v5",
  frameWidth: 704,
  frameHeight: 480,
  scale: 0.5,
  originX: 0.5,
  originY: 416 / 480,
  animations: {
  "idle": {
    "count": 4,
    "fps": 6,
    "loop": true
  },
  "walk": {
    "count": 6,
    "fps": 9,
    "loop": true
  },
  "attack": {
    "count": 6,
    "fps": 11,
    "loop": false
  },
  "charge": {
    "count": 4,
    "fps": 13,
    "loop": false
  },
  "combo": {
    "count": 8,
    "fps": 12,
    "loop": false
  },
  "phase2": {
    "count": 4,
    "fps": 9,
    "loop": false
  },
  "hurt": {
    "count": 4,
    "fps": 9,
    "loop": false
  },
  "death": {
    "count": 6,
    "fps": 8,
    "loop": false
  }
},
} as const;

export type SobaeapAnim = keyof typeof SOBAEAP_VISUALS.animations;

export function preloadSobaeapV5(scene: Phaser.Scene): void {
  for (const key of Object.keys(SOBAEAP_VISUALS.animations) as SobaeapAnim[]) {
    const dir = `${SOBAEAP_VISUALS.assetPath}/atlas/${key}_atlas`;
    scene.load.atlas(`sobaeap-v5-${key}`, `${dir}.png`, `${dir}.json`);
  }
}

export function registerSobaeapV5Animations(scene: Phaser.Scene): void {
  for (const key of Object.keys(SOBAEAP_VISUALS.animations) as SobaeapAnim[]) {
    const cfg = SOBAEAP_VISUALS.animations[key];
    const animationKey = `sobaeap-v5-anim-${key}`;
    if (scene.anims.exists(animationKey)) continue;
    const frames: Phaser.Types.Animations.AnimationFrame[] = Array.from({ length: cfg.count }, (_, i) => ({
      key: `sobaeap-v5-${key}`,
      frame: `sobaeap_${key}_${String(i + 1).padStart(2, "0")}.png`,
    }));
    scene.anims.create({
      key: animationKey,
      frames,
      frameRate: cfg.fps,
      repeat: cfg.loop ? -1 : 0,
    });
  }
}

/** x is player-world-facing boss center; groundY is world ground surface. */
export function createSobaeapV5Sprite(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(x, groundY, "sobaeap-v5-idle", "sobaeap_idle_01.png")
    .setOrigin(SOBAEAP_VISUALS.originX, SOBAEAP_VISUALS.originY)
    .setScale(SOBAEAP_VISUALS.scale);
  sprite.play("sobaeap-v5-anim-idle");
  return sprite;
}

/** Call ONLY when boss state actually changes; never restart attack every frame. */
export function setSobaeapV5Visual(sprite: Phaser.GameObjects.Sprite, state: SobaeapAnim, facing: 1 | -1 = 1): void {
  const key = `sobaeap-v5-anim-${state}`;
  sprite.setFlipX(facing === -1);
  if (sprite.anims.currentAnim?.key !== key) sprite.play(key);
}
