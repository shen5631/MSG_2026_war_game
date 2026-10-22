import Phaser from 'phaser';
import { DEFAULTS, VIEW_H, VIEW_W } from '../config/spec';
import type { Services } from '../app/bridge';
import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';

/** Phaser renders at a fixed 640×360; integer scaling is applied with setZoom by the host. */
export function createGame(parent: HTMLElement, services: Services): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#000000',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 },
    fps: { target: 60, smoothStep: false },
    loader: { timeout: DEFAULTS.loading.fileTimeoutMs },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scene: [],
    callbacks: { preBoot: (g) => g.registry.set('services', services) },
  });
  game.scene.add('boot', BootScene, true);
  game.scene.add('play', PlayScene, false);
  return game;
}
