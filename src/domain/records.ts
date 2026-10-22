// Session statistics. Each entity death is counted at most once.
export interface Stats {
  playTimeMs: number;
  normalEnemyKills: number;
  bossKills: number;
  parrySuccesses: number;
  deaths: number;
}

export const emptyStats = (): Stats => ({ playTimeMs: 0, normalEnemyKills: 0, bossKills: 0, parrySuccesses: 0, deaths: 0 });

export type KillSource = 'sword' | 'command-skills';

export class StatsRecorder {
  stats: Stats = emptyStats();
  private counted = new Set<string>();
  integrityWarnings: string[] = [];

  /** Returns true when this kill was newly recorded. */
  recordNormalKill(entityId: string, _source: KillSource): boolean {
    if (this.counted.has(entityId)) return false;
    this.counted.add(entityId);
    this.stats.normalEnemyKills += 1;
    return true;
  }

  recordBossKill(entityId: string): boolean {
    if (this.counted.has(entityId)) return false;
    this.counted.add(entityId);
    this.stats.bossKills += 1;
    return true;
  }

  recordParry(): void {
    this.stats.parrySuccesses += 1;
  }

  recordDeath(): void {
    this.stats.deaths += 1;
  }

  addPlayTime(ms: number): void {
    this.stats.playTimeMs += ms;
  }

  warn(message: string): void {
    this.integrityWarnings.push(message);
  }

  reset(): void {
    this.stats = emptyStats();
    this.counted.clear();
    this.integrityWarnings = [];
  }
}

export function formatPlayTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}분 ${s.toString().padStart(2, '0')}초`;
}
