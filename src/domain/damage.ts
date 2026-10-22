// Pure combat math. No Phaser/DOM dependencies.
import { BASE_DAMAGE, LOCKED, type AttackKind } from '../config/spec';

const SHIELD_DECAY_PER_SEC = LOCKED.skills.shield_guard.decayPerSecond;
const HP_INVULN_MS = LOCKED.player.hpHitInvulnerabilityMs;
const EPS = 1e-9;

/**
 * Final sword damage: all bonuses are summed as integer percentages, then rounded half-up once.
 * Integer percent math avoids 57.4999… at positive .5 boundaries.
 */
export function swordDamage(base: number, swordStacks: number, commandBuff: boolean): number {
  if (!Number.isSafeInteger(base) || base < 0) throw new RangeError('invalid base damage');
  if (!Number.isInteger(swordStacks) || swordStacks < 0 || swordStacks > 2) throw new RangeError('sword stacks 0..2');
  const percent = 100 + 15 * swordStacks + (commandBuff ? 30 : 0);
  return Math.floor((base * percent + 50) / 100);
}

export function attackDamage(kind: AttackKind, swordStacks: number, commandBuff: boolean): number {
  return swordDamage(BASE_DAMAGE[kind], swordStacks, commandBuff);
}

export function chargeLevel(heldMs: number): 0 | 1 | 2 | 3 {
  const [t1, t2, t3] = LOCKED.player.chargeThresholdMs;
  return heldMs >= t3 ? 3 : heldMs >= t2 ? 2 : heldMs >= t1 ? 1 : 0;
}

/** Below level 1 the release is an ordinary heavy attack (25), an implementation default. */
export function chargeReleaseKind(heldMs: number): AttackKind {
  const lvl = chargeLevel(heldMs);
  return lvl === 0 ? 'heavy' : (`charge${lvl}` as AttackKind);
}

export interface ShieldState { value: number; remainingMs: number }

/** Continuous real-valued decay; never rounded per frame. */
export function decayShield(s: ShieldState, elapsedMs: number): ShieldState {
  if (s.remainingMs <= 0 || s.value <= 0) return { value: 0, remainingMs: 0 };
  if (elapsedMs >= s.remainingMs) return { value: 0, remainingMs: 0 };
  const next = Math.max(0, s.value - (SHIELD_DECAY_PER_SEC * elapsedMs) / 1000);
  if (next < EPS) return { value: 0, remainingMs: 0 };
  return { value: next, remainingMs: s.remainingMs - elapsedMs };
}

export interface IncomingResult {
  hp: number;
  shield: number;
  absorbed: number;
  hpDamage: number;
  stun: boolean;
  invulnerabilityMs: number;
}

/** Shield absorbs first; only overflow touches HP and only HP damage causes stun + 500ms invulnerability. */
export function applyIncomingDamage(args: { hp: number; shield: number; damage: number; hpInvulnerable: boolean }): IncomingResult {
  const { hp, shield, damage, hpInvulnerable } = args;
  if (hp <= 0 || hpInvulnerable || damage <= 0) {
    return { hp, shield, absorbed: 0, hpDamage: 0, stun: false, invulnerabilityMs: 0 };
  }
  const absorbed = Math.min(shield, damage);
  const hpDamage = Math.max(0, damage - absorbed);
  const hurt = hpDamage > EPS;
  return {
    hp: hurt ? Math.max(0, hp - hpDamage) : hp,
    shield: Math.max(0, shield - absorbed),
    absorbed,
    hpDamage: hurt ? hpDamage : 0,
    stun: hurt,
    invulnerabilityMs: hurt ? HP_INVULN_MS : 0,
  };
}

export function pickupHeal(hp: number, amount: number, maxHp = LOCKED.healing.capHp): { hp: number; consumed: boolean } {
  if (hp <= 0 || hp >= maxHp) return { hp, consumed: false };
  return { hp: Math.min(maxHp, hp + amount), consumed: true };
}

/** HUD shows positive internal HP rounded up. */
export function displayHp(hp: number): number {
  return hp <= 0 ? 0 : Math.ceil(hp - EPS);
}

export function isParryActive(parryStartMs: number, nowMs: number, windowMs: number): boolean {
  const dt = nowMs - parryStartMs;
  return dt >= 0 && dt < windowMs;
}

export function rollDrop(rngValue: number, chance = LOCKED.healing.riceball.normalEnemyDropChance): boolean {
  return rngValue < chance;
}

export type TerminalResult = 'boss-victory' | 'game-over' | 'continue';
/** Same-tick resolution: boss death wins over player death. */
export function resolveTerminal(playerHp: number, bossHp: number | null): TerminalResult {
  if (bossHp !== null && bossHp <= 0) return 'boss-victory';
  if (playerHp <= 0) return 'game-over';
  return 'continue';
}
