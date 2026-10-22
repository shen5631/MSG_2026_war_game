/**
 * Rendering helpers + an OPTIONAL shared cooldown model for the standalone demo.
 * Existing games must keep their own authoritative skill timer and pass its snapshot.
 * No animation frame / setInterval / Date.now is used to determine skill readiness.
 */
export const SKILL_IDS = ['command', 'spear', 'shield'] as const;
export type SkillId = typeof SKILL_IDS[number];
export type GaugeResolution = 64 | 128;
export const SKILL_LABELS: Record<SkillId, string> = {
  command: '지휘 강화', spear: '창병 공격', shield: '방패병 막기',
};
export const FRAMES_PER_SKILL = 101;
export const ATLAS_COLUMNS = 16;
export const ATLAS_ROWS = 19;
export const ATLAS_PADDING = 2;

export interface CooldownSnapshot {
  remainingMs: number;
  totalMs: number;
  selectedSkill: SkillId;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}
export function assertSkill(skill: string): asserts skill is SkillId {
  if (!(SKILL_IDS as readonly string[]).includes(skill)) throw new RangeError(`Unknown skill: ${skill}`);
}
/** Readiness index, not cooldown remaining percent. 100 occurs ONLY when remainingMs <= 0. */
export function cooldownFrame(remainingMs: number, totalMs: number): number {
  finite(remainingMs, 'remainingMs'); finite(totalMs, 'totalMs');
  if (totalMs <= 0) throw new RangeError('totalMs must be > 0');
  if (remainingMs <= 0) return 100;
  const progress = 1 - Math.min(remainingMs, totalMs) / totalMs;
  return Math.max(0, Math.min(99, Math.floor(progress * 100 + 1e-9)));
}
export function frameName(skill: SkillId, percent: number): string {
  assertSkill(skill); finite(percent, 'percent');
  return `${skill}_${Math.floor(Math.max(0, Math.min(100, percent))).toString().padStart(3, '0')}`;
}
export function atlasFrameIndex(skill: SkillId, percent: number): number {
  assertSkill(skill); finite(percent, 'percent');
  return SKILL_IDS.indexOf(skill) * FRAMES_PER_SKILL + Math.floor(Math.max(0, Math.min(100, percent)));
}
export function remainingLabel(remainingMs: number): string {
  finite(remainingMs, 'remainingMs');
  return remainingMs <= 0 ? '준비' : `${(Math.ceil(remainingMs / 100) / 10).toFixed(1)}초`;
}
/** Respects the already approved 20 -> 17 -> 14 second shared cooldown. */
export function cooldownDurationMs(upgradeCount: number): number {
  finite(upgradeCount, 'upgradeCount');
  if (!Number.isInteger(upgradeCount) || upgradeCount < 0 || upgradeCount > 2)
    throw new RangeError('upgradeCount must be 0, 1 or 2');
  return 20000 - upgradeCount * 3000;
}
export function assetUrl(baseUrl: string, relativePath: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`;
}
export function atlasCssGeometry(skill: SkillId, percent: number, size: number, resolution: GaugeResolution = 64) {
  finite(size, 'size'); if (size <= 0) throw new RangeError('size must be > 0');
  if (resolution !== 64 && resolution !== 128) throw new RangeError('resolution must be 64 or 128');
  const index = atlasFrameIndex(skill, percent);
  const stride = resolution + ATLAS_PADDING * 2;
  const scale = size / resolution;
  return {
    width: size, height: size,
    backgroundSize: `${ATLAS_COLUMNS * stride * scale}px ${ATLAS_ROWS * stride * scale}px`,
    backgroundPosition: `${-((index % ATLAS_COLUMNS) * stride + ATLAS_PADDING) * scale}px ${-(Math.floor(index / ATLAS_COLUMNS) * stride + ATLAS_PADDING) * scale}px`,
  };
}

/** For new projects / demos only. Do not create this if the game already has a skill cooldown. */
export class SharedSkillCooldown {
  private remaining = 0;
  private total = 20000;
  private selection: SkillId = 'command';
  private upgrades = 0;
  snapshot(): CooldownSnapshot {
    return { remainingMs: this.remaining, totalMs: this.total, selectedSkill: this.selection };
  }
  get ready(): boolean { return this.remaining <= 0; }
  select(skill: SkillId): void { assertSkill(skill); this.selection = skill; }
  selectNext(): SkillId {
    this.selection = SKILL_IDS[(SKILL_IDS.indexOf(this.selection) + 1) % SKILL_IDS.length];
    return this.selection;
  }
  /** Call AFTER the actual skill successfully starts, not on every RB keydown. */
  tryStart(): boolean {
    if (!this.ready) return false;
    this.total = cooldownDurationMs(this.upgrades);
    this.remaining = this.total;
    return true;
  }
  /** Accept simulation delta; paused / hitstop policy belongs to the existing game clock. */
  advance(deltaMs: number, paused = false): void {
    finite(deltaMs, 'deltaMs');
    if (deltaMs < 0) throw new RangeError('deltaMs cannot be negative');
    if (paused) return;
    // Remove floating-point residue below 0.1 nanosecond at an exact expiry.
    const next = this.remaining - deltaMs;
    this.remaining = next <= 1e-7 ? 0 : next;
  }
  /** The new duration takes effect on the next successful cast; active timers do not jump. */
  setUpgradeCount(count: number): void {
    const duration = cooldownDurationMs(count);
    this.upgrades = count;
    if (this.ready) this.total = duration;
  }
  /** Retry / next round: reset temporary cooldown but keep upgrade count. */
  resetReady(): void { this.remaining = 0; this.total = cooldownDurationMs(this.upgrades); }
}
