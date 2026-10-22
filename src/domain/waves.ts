// Fixed-wave director for one locked combat arena. Pure timing logic; spawning is done by the caller.
import { LOCKED, type ArenaSpec } from '../config/spec';

export const SPAWN_WARNING_MS = 650;
export const WAVE_GAP_MS = LOCKED.levels.waveGapMs;

export type WaveEvent =
  | { type: 'warn'; waveIndex: number }
  | { type: 'spawn'; waveIndex: number }
  | { type: 'waveCleared'; waveIndex: number }
  | { type: 'arenaCleared' };

export type ArenaState = 'idle' | 'warning' | 'active' | 'gap' | 'cleared';

export class WaveDirector {
  state: ArenaState = 'idle';
  waveIndex = 0;
  phaseStart = 0;
  alive = new Set<string>();
  rewardSpawned = false;
  private gapWarnSent = false;

  constructor(public readonly spec: ArenaSpec) {}

  get totalWaves(): number { return this.spec.waves.length; }

  lock(t: number): WaveEvent[] {
    if (this.state !== 'idle') return [];
    this.state = 'warning';
    this.phaseStart = t;
    this.waveIndex = 0;
    return [{ type: 'warn', waveIndex: 0 }];
  }

  update(t: number): WaveEvent[] {
    if (this.state === 'warning' && t - this.phaseStart >= SPAWN_WARNING_MS) {
      this.state = 'active';
      return [{ type: 'spawn', waveIndex: this.waveIndex }];
    }
    if (this.state === 'gap') {
      const out: WaveEvent[] = [];
      const elapsed = t - this.phaseStart;
      // Next-wave warning overlaps the final 650ms of the 2s gap; the gap is not extended.
      if (!this.gapWarnSent && elapsed >= WAVE_GAP_MS - SPAWN_WARNING_MS) {
        this.gapWarnSent = true;
        out.push({ type: 'warn', waveIndex: this.waveIndex + 1 });
      }
      if (elapsed >= WAVE_GAP_MS) {
        this.waveIndex += 1;
        this.state = 'active';
        out.push({ type: 'spawn', waveIndex: this.waveIndex });
      }
      return out;
    }
    return [];
  }

  registerSpawned(ids: string[]): void {
    for (const id of ids) this.alive.add(id);
  }

  /** Called when a wave member dies or is technically removed. Duplicate calls are ignored. */
  onEnemyGone(id: string, t: number): WaveEvent[] {
    if (!this.alive.delete(id)) return [];
    if (this.state !== 'active' || this.alive.size > 0) return [];
    if (this.waveIndex + 1 >= this.totalWaves) {
      this.state = 'cleared';
      if (this.rewardSpawned) return [];
      this.rewardSpawned = true;
      return [{ type: 'waveCleared', waveIndex: this.waveIndex }, { type: 'arenaCleared' }];
    }
    this.state = 'gap';
    this.phaseStart = t;
    this.gapWarnSent = false;
    return [{ type: 'waveCleared', waveIndex: this.waveIndex }];
  }
}
