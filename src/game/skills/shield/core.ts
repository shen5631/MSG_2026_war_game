/** Pure, engine-independent rules. Use ONLY when the host has no shield implementation. */
export const SHIELD_RULES = Object.freeze({ capacity: 40, decayPerSecond: 8, durationMs: 5000 });
export const COMMAND_COOLDOWNS = [20000, 17000, 14000] as const;
const EPSILON = 1e-9;

function nonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0`);
}
export interface ShieldSnapshot {
  readonly active: boolean;
  readonly remaining: number;
  readonly elapsedMs: number;
  readonly generation: number;
}
export interface ShieldHit {
  readonly absorbed: number;
  readonly hpDamage: number;
  readonly remaining: number;
  readonly broke: boolean;
  readonly requestHitstun: boolean;
  readonly requestInvulnerabilityMs: number;
}

/** Input damage is FINAL damage; no extra rounding, armor, HP mutation or damage event here. */
export function splitShieldDamage(shield: number, damage: number): ShieldHit {
  nonNegative(shield, 'shield'); nonNegative(damage, 'damage');
  const absorbed = Math.min(shield, damage);
  const hpDamage = Math.max(0, damage - absorbed);
  const remaining = Math.max(0, shield - absorbed);
  return { absorbed, hpDamage, remaining, broke: shield > 0 && remaining === 0,
    requestHitstun: hpDamage > 0, requestInvulnerabilityMs: hpDamage > 0 ? 500 : 0 };
}

export class ShieldBuff {
  private amount = 0;
  private elapsed = 0;
  private live = false;
  private activation = 0;
  get snapshot(): ShieldSnapshot {
    return Object.freeze({ active: this.live, remaining: this.amount, elapsedMs: this.elapsed, generation: this.activation });
  }
  /** The shield exists immediately; summon art does not delay protection. */
  activate(): boolean {
    if (this.live) return false;
    this.activation += 1; this.amount = 40; this.elapsed = 0; this.live = true;
    return true;
  }
  /** Only advance with the host's simulated game delta, NEVER wall-clock delta or an extra interval. */
  step(gameDeltaMs: number, paused = false): void {
    nonNegative(gameDeltaMs, 'gameDeltaMs');
    if (paused || !this.live) return;
    const dt = Math.min(gameDeltaMs, SHIELD_RULES.durationMs - this.elapsed);
    this.elapsed += dt;
    this.amount = Math.max(0, this.amount - SHIELD_RULES.decayPerSecond * dt / 1000);
    if (this.amount <= EPSILON || this.elapsed >= SHIELD_RULES.durationMs) {
      this.amount = 0; this.live = false;
    }
  }
  /** Call once per accepted unique attack, AFTER pause/death/phase/parry/i-frame checks. */
  absorb(damage: number): ShieldHit {
    const hit = splitShieldDamage(this.live ? this.amount : 0, damage);
    this.amount = hit.remaining;
    if (this.amount === 0) this.live = false;
    return hit;
  }
  /** Death / retry / round transition / menu return must remove the effect immediately. */
  reset(): void { this.amount = 0; this.elapsed = 0; this.live = false; }
}

export interface CooldownSnapshot { readonly remainingMs: number; readonly totalMs: number; readonly ready: boolean; }
/** ONE instance per player for command + spear + shield. Never one instance per soldier/icon. */
export class SharedCommandCooldown {
  private stacks = 0;
  private remaining = 0;
  private total = 20000;
  get snapshot(): CooldownSnapshot {
    return Object.freeze({ remainingMs: this.remaining, totalMs: this.total, ready: this.remaining === 0 });
  }
  setUpgradeStacks(stacks: number): void {
    if (!Number.isInteger(stacks) || stacks < 0 || stacks > 2) throw new RangeError('stacks must be 0, 1, or 2');
    this.stacks = stacks;
    if (this.remaining === 0) this.total = COMMAND_COOLDOWNS[stacks];
    // An in-flight cooldown is not retroactively changed. Apply the new duration on next successful use.
  }
  tryStart(): boolean {
    if (this.remaining > 0) return false;
    this.total = COMMAND_COOLDOWNS[this.stacks]; this.remaining = this.total;
    return true;
  }
  step(gameDeltaMs: number, paused = false): void {
    nonNegative(gameDeltaMs, 'gameDeltaMs');
    if (paused) return;
    this.remaining = Math.max(0, this.remaining - gameDeltaMs);
    if (this.remaining < EPSILON) this.remaining = 0;
  }
  reset(): void { this.remaining = 0; this.total = COMMAND_COOLDOWNS[this.stacks]; }
}

/** Optional coordinator. Existing combat systems should keep their own authoritative state. */
export class ShieldSkill {
  readonly shield = new ShieldBuff();
  constructor(readonly cooldown: SharedCommandCooldown) {}
  tryActivate(canAct: boolean): boolean {
    if (!canAct || this.shield.snapshot.active || !this.cooldown.snapshot.ready) return false;
    if (!this.shield.activate()) return false;
    this.cooldown.tryStart();
    return true;
  }
  /** This advances ONLY the buff. The owner advances the SHARED cooldown exactly once. */
  step(gameDeltaMs: number, paused = false): void { this.shield.step(gameDeltaMs, paused); }
  reset(): void { this.shield.reset(); }
}
