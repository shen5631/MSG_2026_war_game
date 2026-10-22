// DEV/E2E ONLY. Never imported by production builds (guarded by import.meta.env.DEV in main.tsx).
import type { Services } from '../app/bridge';

export interface TestHooks {
  state: () => Record<string, unknown>;
  canvasCount: () => number;
  atlasFrameCount: () => number;
  playerSpriteFrame: () => string | null;
  skipArenas: () => void;
  killWave: () => void;
  teleport: (x: number) => void;
  toBoss: () => void;
  damageBoss: (n: number) => void;
  setPlayerHp: (n: number) => void;
}

declare global {
  interface Window { __GGC__?: TestHooks; __GGC_SCENE__?: unknown }
}

export function installTestHooks(s: Services): void {
  const c = s.controller;
  const round = () => c.round;
  window.__GGC__ = {
    state: () => {
      const r = round();
      return {
        phase: c.phase,
        paused: c.pause.paused,
        pauseReasons: c.pause.list(),
        round: c.roundIndex,
        upgrades: { ...c.upgrades },
        stats: { ...c.recorder.stats },
        endingIndex: c.endingIndex,
        player: r ? { x: r.player.body.x, y: r.player.body.y, hp: r.player.hp, mode: r.player.mode, facing: r.player.facing, attack: r.player.attack?.kind ?? null } : null,
        simT: r?.t ?? 0,
        bossStage: r?.bossStage ?? null,
        boss: r?.boss ? { hp: r.boss.hp, phase: r.boss.phase, state: r.boss.state } : null,
        enemies: r?.enemies.filter((e) => e.alive).length ?? 0,
        lockedBounds: r?.lockedBounds ?? null,
        outcome: r?.outcome ?? null,
        combatDevice: s.router.combatDevice,
        routerMode: s.router.mode,
      };
    },
    canvasCount: () => document.querySelectorAll('canvas').length,
    atlasFrameCount: () => {
      const scene = window.__GGC_SCENE__ as { textures?: { exists(k: string): boolean; get(k: string): { getFrameNames(): string[] } } } | undefined;
      if (!scene?.textures?.exists('ganggamchan')) return 0;
      return scene.textures.get('ganggamchan').getFrameNames().length;
    },
    playerSpriteFrame: () => {
      const scene = window.__GGC_SCENE__ as { player?: { frame?: { name?: string }; texture?: { key: string } } } | undefined;
      const p = scene?.player;
      return p?.texture && p.frame?.name ? `${p.texture.key}:${p.frame.name}` : null;
    },
    skipArenas: () => round()?.debugSkipArenas(),
    killWave: () => round()?.debugKillWave(),
    teleport: (x) => round()?.debugTeleport(x),
    toBoss: () => {
      const r = round();
      if (!r) return;
      r.debugSkipArenas();
      r.debugTeleport(r.spec.bossArena.playerEntryX + 2);
    },
    damageBoss: (n) => round()?.debugDamageBoss(n),
    setPlayerHp: (n) => { const r = round(); if (r) r.player.hp = n; },
  };
}
