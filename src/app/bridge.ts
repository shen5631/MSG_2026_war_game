// Typed bridge between React (menus/HUD) and the game runtime. React sends commands, the controller sends state.
import { AudioSystem } from '../audio/AudioSystem';
import { GameController } from '../domain/session';
import { InputRouter } from '../input/InputRouter';

export interface AssetHandle {
  /** Reloads only the failed/missing runtime assets. Ignored while a load is already running. */
  retry: () => void;
}

export interface Services {
  controller: GameController;
  router: InputRouter;
  audio: AudioSystem;
  assets: AssetHandle;
}

export function createServices(): Services {
  return {
    controller: new GameController(),
    router: new InputRouter(),
    audio: new AudioSystem(),
    assets: { retry: () => {} },
  };
}

export type UiCommand =
  | { type: 'startGame' }
  | { type: 'finishTutorial' }
  | { type: 'retryRound' }
  | { type: 'chooseUpgrade'; id: 'sword' | 'parry' | 'command_cooldown' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'returnToMenu' }
  | { type: 'setVolume'; bgm: number; sfx: number }
  | { type: 'advanceEnding' }
  | { type: 'finishResults' }
  | { type: 'retryLoad' };

export function sendCommand(s: Services, cmd: UiCommand): void {
  const c = s.controller;
  switch (cmd.type) {
    case 'startGame': c.startGame(); break;
    case 'finishTutorial': c.finishTutorial(); break;
    case 'retryRound': c.retryRound(); break;
    case 'chooseUpgrade': c.chooseUpgrade(cmd.id); break;
    case 'pause': c.pauseManual(); break;
    case 'resume': c.resume(); break;
    case 'returnToMenu': c.returnToMenu(); break;
    case 'setVolume': s.audio.setVolumes(cmd.bgm, cmd.sfx); break;
    case 'advanceEnding': c.advanceEnding(); break;
    case 'finishResults': c.finishResults(); break;
    case 'retryLoad': s.assets.retry(); break;
  }
}
