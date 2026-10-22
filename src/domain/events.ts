// Events emitted by the simulation for presentation (Phaser effects, audio, HUD).
export type SfxId =
  | 'swing' | 'hit' | 'heavyHit' | 'chargeStage' | 'parrySuccess' | 'parryWhiff' | 'dash'
  | 'playerHurt' | 'shieldAbsorb' | 'shieldBreak' | 'spearCall' | 'skillReady' | 'heal'
  | 'waveStart' | 'phaseChange' | 'victory' | 'menuMove' | 'menuConfirm' | 'guard' | 'arrow' | 'death' | 'buff';

export type FxId = 'hit' | 'parry' | 'dash' | 'charge' | 'skill' | 'spear' | 'shieldBreak' | 'heal' | 'guard' | 'slash';

export type GameEvent =
  | { type: 'sfx'; id: SfxId }
  | { type: 'fx'; fx: FxId; x: number; y: number; facing?: 1 | -1; level?: number }
  | { type: 'toast'; text: string }
  | { type: 'hitstop'; ms: number }
  | { type: 'bossPhase2' }
  | { type: 'bossDefeated' }
  | { type: 'playerDied' }
  | { type: 'waveStarted'; arenaId: string; waveIndex: number }
  | { type: 'arenaCleared'; arenaId: string }
  | { type: 'hud' };

export class EventQueue {
  private items: GameEvent[] = [];
  push(e: GameEvent): void { this.items.push(e); }
  drain(): GameEvent[] { const out = this.items; this.items = []; return out; }
}
