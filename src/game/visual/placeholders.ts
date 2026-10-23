// TEMPORARY generated pixel art (generated_* textures). Every key here is listed in TEMPORARY_ASSETS
// and in IMPLEMENTATION_NOTES.md. Replacing them means swapping texture keys, not gameplay numbers.
import Phaser from 'phaser';

export const TEMPORARY_ASSETS = [
  // Supplied but NOT final: goryeo_spearman_skill v1 frames need replacement (see IMPLEMENTATION_NOTES).
  'goryeo_spearman_skill (v1, replacement needed)',
  'generated_pickups', 'spawn marker (code-drawn, src/game/visual/spawnWarning.ts)',
  'synth_bgm_*', 'synth_sfx_*',
] as const;

// Characters: every player/enemy/boss sprite now comes from a supplied atlas (no generated character art).

export function generatePropTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('generated_pickups')) {
    const tex = scene.textures.createCanvas('generated_pickups', 64, 16)!;
    const c = tex.getContext();
    // riceball (주먹밥)
    c.fillStyle = '#222'; c.fillRect(2, 1, 12, 14);
    c.fillStyle = '#f4f1e6'; c.fillRect(3, 2, 10, 12); c.fillRect(5, 1, 6, 2);
    c.fillStyle = '#1d3b1d'; c.fillRect(3, 9, 10, 5);
    // herb pouch (약초 주머니)
    c.fillStyle = '#16210f'; c.fillRect(17, 2, 14, 14);
    c.fillStyle = '#4c8a34'; c.fillRect(18, 5, 12, 10);
    c.fillStyle = '#c9a227'; c.fillRect(19, 3, 10, 2);
    c.fillStyle = '#9fd36f'; c.fillRect(22, 0, 2, 4); c.fillRect(25, 1, 2, 3);
    tex.refresh();
    tex.add('riceball', 0, 0, 0, 16, 16);
    tex.add('herb', 0, 16, 0, 16, 16);
  }
}
