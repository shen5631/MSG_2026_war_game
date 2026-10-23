/** Phaser 3-compatible visual-only VFX adapter (no damage, physics, or timers). */
export type VanguardFxKind = 'slash_arc' | 'dash_trail' | 'summon_pillar' | 'impact_burst' | 'ground_flame_circle' | 'ground_explosion';

export interface FxSpriteLike {
  setOrigin(x: number, y: number): this;
  setFlipX(value: boolean): this;
  setDepth(depth: number): this;
  setScale(value: number): this;
  play(key: string): this;
  once(event: string, callback: () => void): this;
  destroy(): void;
}

export interface FxSceneLike {
  load: { atlas(key: string, pngUrl: string, jsonUrl: string): unknown };
  anims: {
    exists(key: string): boolean;
    create(cfg: { key: string; frames: Array<{ key: string; frame: string }>; frameRate: number; repeat: number }): unknown;
  };
  add: { sprite(x: number, y: number, atlasKey: string, frame: string): FxSpriteLike };
}

export const VANGUARD_FX_ATLAS_KEY = 'round1-vanguard-fx-clean-v2';
export const VANGUARD_FX_BASE_URL = '/assets/round1_vanguard_boss_fx_clean_v2';
// (project: exported so the sim-time view can read frames/fps/origin; otherwise unchanged)
export const DEFINITIONS = {
  slash_arc: { frames: ["vanguard_slash_arc_01.png", "vanguard_slash_arc_02.png", "vanguard_slash_arc_03.png", "vanguard_slash_arc_04.png", "vanguard_slash_arc_05.png", "vanguard_slash_arc_06.png"], fps: 16, origin: { x: 0.5, y: 0.5 } },
  dash_trail: { frames: ["vanguard_dash_trail_01.png", "vanguard_dash_trail_02.png", "vanguard_dash_trail_03.png", "vanguard_dash_trail_04.png", "vanguard_dash_trail_05.png", "vanguard_dash_trail_06.png"], fps: 14, origin: { x: 0.5, y: 0.82 } },
  summon_pillar: { frames: ["vanguard_summon_pillar_01.png", "vanguard_summon_pillar_02.png", "vanguard_summon_pillar_03.png", "vanguard_summon_pillar_04.png"], fps: 11, origin: { x: 0.5, y: 0.82 } },
  impact_burst: { frames: ["vanguard_impact_burst_01.png", "vanguard_impact_burst_02.png", "vanguard_impact_burst_03.png", "vanguard_impact_burst_04.png"], fps: 18, origin: { x: 0.5, y: 0.5 } },
  ground_flame_circle: { frames: ["vanguard_ground_flame_circle_01.png", "vanguard_ground_flame_circle_02.png", "vanguard_ground_flame_circle_03.png", "vanguard_ground_flame_circle_04.png", "vanguard_ground_flame_circle_05.png"], fps: 10, origin: { x: 0.5, y: 0.82 } },
  ground_explosion: { frames: ["vanguard_ground_explosion_01.png", "vanguard_ground_explosion_02.png", "vanguard_ground_explosion_03.png", "vanguard_ground_explosion_04.png", "vanguard_ground_explosion_05.png", "vanguard_ground_explosion_06.png"], fps: 13, origin: { x: 0.5, y: 0.82 } },
} as const;

/** Must be called from Scene.preload(), prior to animation registration. */
export function preloadVanguardBossFx(scene: FxSceneLike, baseUrl = VANGUARD_FX_BASE_URL): void {
  const path = baseUrl.replace(/\/$/, '');
  scene.load.atlas(VANGUARD_FX_ATLAS_KEY, `${path}/atlas/vanguard_fx_atlas.png`, `${path}/atlas/vanguard_fx_atlas.json`);
}

/** Call once after the atlas has loaded, normally in Scene.create(). */
export function createVanguardBossFxAnimations(scene: FxSceneLike): void {
  for (const kind of Object.keys(DEFINITIONS) as VanguardFxKind[]) {
    const name = `round1-vanguard-fx-${kind}`;
    if (scene.anims.exists(name)) continue;
    const def = DEFINITIONS[kind];
    scene.anims.create({
      key: name,
      frames: [...def.frames].map(frame => ({ key: VANGUARD_FX_ATLAS_KEY, frame })),
      frameRate: def.fps,
      repeat: 0,
    });
  }
}

export interface PlayFxOptions {
  facing?: 1 | -1;
  depth?: number;
  scale?: number;
}

/** Display only; never call player/enemy damage functions from animation frames. */
export function playVanguardBossFx(
  scene: FxSceneLike,
  kind: VanguardFxKind,
  x: number,
  y: number,
  options: PlayFxOptions = {}
): FxSpriteLike {
  const def = DEFINITIONS[kind];
  const animKey = `round1-vanguard-fx-${kind}`;
  if (!scene.anims.exists(animKey)) {
    throw new Error(`Vanguard FX animation not registered: ${animKey}. Call createVanguardBossFxAnimations() in create().`);
  }
  const effect = scene.add.sprite(x, y, VANGUARD_FX_ATLAS_KEY, def.frames[0]);
  effect.setOrigin(def.origin.x, def.origin.y);
  effect.setFlipX(options.facing === -1);
  if (options.depth !== undefined) effect.setDepth(options.depth);
  if (options.scale !== undefined) effect.setScale(options.scale);
  effect.once('animationcomplete', () => effect.destroy());
  effect.play(animKey);
  return effect;
}
