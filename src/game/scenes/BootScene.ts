// Loads every registered runtime asset once at boot, verifies frames, then builds generated placeholders.
import Phaser from 'phaser';
import { RUNTIME_ASSETS } from '../../config/spec';
import type { Services } from '../../app/bridge';
import { requiredFrames } from '../visual/AnimationBindings';
import { generateBackgrounds, generateCharacterTextures, generatePropTextures } from '../visual/placeholders';

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
    for (const a of RUNTIME_ASSETS.assets) {
      if (a.type !== 'atlas' || this.textures.exists(a.key)) continue;
      this.load.atlas(a.key, assetUrl(a.texture), assetUrl(a.atlas));
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
    const tex = this.textures.exists('ganggamchan') ? this.textures.get('ganggamchan') : null;
    if (tex) for (const f of requiredFrames()) if (!tex.has(f)) missing.push(`frame:${f}`);
    return missing;
  }
}
