// Loads every registered runtime asset once at boot, verifies frames, then builds generated placeholders.
import Phaser from 'phaser';
import { RUNTIME_ASSETS } from '../../config/spec';
import type { Services } from '../../app/bridge';
import { requiredFrames } from '../visual/AnimationBindings';
import { generateBackgrounds, generateCharacterTextures, generatePropTextures } from '../visual/placeholders';
import { ENV_KEY, INFANTRY_KEY, REQUIRED_ENV_FRAMES, REQUIRED_INFANTRY_FRAMES, buildGroundStrip } from '../visual/environment';
import { ARCHER_KEY, REQUIRED_ARCHER_FRAMES } from '../visual/archer';
import { REQUIRED_SPEARMAN_FRAMES, SPEARMAN_KEY } from '../visual/spearman';
import { ATLAS_KEY as SHIELDMAN_KEY } from '../enemies/shield/PhaserShieldEnemyView';
import { FRAMES as SHIELDMAN_FRAMES } from '../enemies/shield/core';
import { ALLY_SPEAR_KEY, REQUIRED_ALLY_SPEAR_FRAMES } from '../visual/allySpearman';
import { REQUIRED_VANGUARD_FRAMES, VANGUARD_KEY } from '../visual/vanguard';
import { REQUIRED_SPEAR_CAPTAIN_FRAMES, SPEAR_CAPTAIN_KEY } from '../visual/spearCaptain';
import { REQUIRED_FRAME_KEYS as REQUIRED_SHIELD_FRAMES, SHIELD_TEXTURE_KEY } from '../skills/shield/presentation';

export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export class BootScene extends Phaser.Scene {
  private loading = false;

  constructor() { super('boot'); }

  private get services(): Services { return this.game.registry.get('services') as Services; }

  create(): void {
    this.services.assets.retry = () => this.startLoad();
    this.startLoad();
  }

  /** Menus (e.g. the load-error retry) still need input while booting. */
  update(): void {
    const { router } = this.services;
    router.setMode('menu');
    router.update(performance.now());
  }

  private startLoad(): void {
    if (this.loading) return;
    this.loading = true;
    const ctl = this.services.controller;
    ctl.setLoading(0);
    const failed: string[] = [];
    for (const a of RUNTIME_ASSETS.assets as { type: string; key: string; texture: string; atlas?: string }[]) {
      if (this.textures.exists(a.key)) continue;
      if (a.type === 'atlas' && a.atlas) this.load.atlas(a.key, assetUrl(a.texture), assetUrl(a.atlas));
      else if (a.type === 'image') this.load.image(a.key, assetUrl(a.texture));
    }
    const onProgress = (p: number) => ctl.setLoading(p);
    const onError = (file: Phaser.Loader.File) => failed.push(String(file.url ?? file.key));
    this.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      this.loading = false;
      if (failed.length > 0) {
        ctl.setLoadError(failed);
        return;
      }
      const missing = this.verifyFrames();
      if (missing.length > 0) {
        ctl.setLoadError(missing);
        return;
      }
      buildGroundStrip(this);
      generateCharacterTextures(this);
      generatePropTextures(this);
      generateBackgrounds(this);
      ctl.setLoaded();
      this.scene.start('play');
    });
    this.load.start();
  }

  /** Every frame referenced by animation bindings must exist in the loaded atlas. */
  private verifyFrames(): string[] {
    const missing: string[] = [];
    for (const a of RUNTIME_ASSETS.assets) {
      if (!this.textures.exists(a.key)) missing.push(a.texture);
    }
    const need: [string, string[]][] = [['ganggamchan', requiredFrames()], [INFANTRY_KEY, REQUIRED_INFANTRY_FRAMES], [ARCHER_KEY, REQUIRED_ARCHER_FRAMES], [SPEARMAN_KEY, REQUIRED_SPEARMAN_FRAMES], [SHIELDMAN_KEY, Object.values(SHIELDMAN_FRAMES).flat()], [ALLY_SPEAR_KEY, REQUIRED_ALLY_SPEAR_FRAMES], [VANGUARD_KEY, REQUIRED_VANGUARD_FRAMES], [SPEAR_CAPTAIN_KEY, REQUIRED_SPEAR_CAPTAIN_FRAMES], [SHIELD_TEXTURE_KEY, REQUIRED_SHIELD_FRAMES], [ENV_KEY, REQUIRED_ENV_FRAMES]];
    for (const [key, frames] of need) {
      if (!this.textures.exists(key)) continue;
      const tex = this.textures.get(key);
      for (const f of frames) if (!tex.has(f)) missing.push(`frame:${key}/${f}`);
    }
    return missing;
  }
}
