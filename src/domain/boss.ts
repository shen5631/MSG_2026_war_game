// Boss AI: two phases, distance/phase pattern selection, multi-hit patterns, summons.
import { BOSS_HP, BOSS_PATTERNS, DEFAULTS, LOCKED, type BossId, type BossPatternSpec, type EnemyKind } from '../config/spec';
import { bodyRect, forwardHitbox, type Rect } from './geometry';
import { stepBody, type Body, type Bounds, type Solid } from './physics';
import type { AttackSlots, EnemyAttackBox } from './enemies';

export type BossState = 'intro' | 'idle' | 'move' | 'windup' | 'hits' | 'recover' | 'stunned' | 'transition' | 'dead';

const BOSS_BODY: Record<BossId, { w: number; h: number; speed: number; rushSpeed: number }> = {
  vanguard: { w: 40, h: 84, speed: 95, rushSpeed: 320 },
  spear_captain: { w: 40, h: 88, speed: 85, rushSpeed: 320 },
  so_bae_ap: { w: 44, h: 92, speed: 100, rushSpeed: 340 },
};

const B = DEFAULTS.boss;
const GRAVITY = DEFAULTS.movement.gravityY;
const JUMP_AIR_MS = 300;
const SAME_PATTERN_MAX = B.samePatternConsecutiveMax;

export interface PatternChoiceCtx {
  phase: 1 | 2;
  dist: number;
  t: number;
  lastUsed: Map<string, number>;
  cooldownUntil: Map<string, number>;
  consecutive: { id: string | null; count: number };
  summonNeeded: boolean;
}

/**
 * Deterministic selection (spec §12.5): summon if needed → available phase-2 specials in range →
 * distance-matched normal attacks; ties: least recently used, then patternId order.
 * Returns movement direction (+1 approach, -1 retreat) when nothing fits.
 */
export function choosePattern(patterns: BossPatternSpec[], c: PatternChoiceCtx): { pattern: BossPatternSpec | null; move: -1 | 0 | 1 } {
  const available = patterns.filter(
    (p) =>
      p.phases.includes(c.phase) &&
      c.t >= (c.cooldownUntil.get(p.id) ?? -Infinity) &&
      !(c.consecutive.id === p.id && c.consecutive.count >= SAME_PATTERN_MAX),
  );
  const summon = available.find((p) => p.id === 'summon');
  if (summon && c.summonNeeded) return { pattern: summon, move: 0 };
  const attacks = available.filter((p) => p.id !== 'summon');
  const inRange = attacks.filter((p) => c.dist >= (p.distanceMinPx ?? 0) && c.dist <= (p.distanceMaxPx ?? Infinity));
  const specials = inRange.filter((p) => !p.phases.includes(1));
  const pool = specials.length > 0 ? specials : inRange;
  if (pool.length === 0) {
    if (attacks.length === 0) return { pattern: null, move: 0 };
    const tooFar = attacks.every((p) => c.dist > (p.distanceMaxPx ?? Infinity));
    if (tooFar) return { pattern: null, move: 1 };
    const tooClose = attacks.some((p) => c.dist < (p.distanceMinPx ?? 0));
    return { pattern: null, move: tooClose ? -1 : 1 };
  }
  const sorted = pool.slice().sort((a, b) => {
    const la = c.lastUsed.get(a.id) ?? -Infinity;
    const lb = c.lastUsed.get(b.id) ?? -Infinity;
    if (la !== lb) return la < lb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { pattern: sorted[0], move: 0 };
}

export interface BossCtx {
  t: number;
  dt: number;
  playerX: number;
  playerAlive: boolean;
  solids: Solid[];
  groundY: number;
  slots: AttackSlots;
  livingSummons: () => number;
  requestSummons: (kinds: EnemyKind[]) => void;
  newId: (prefix: string) => string;
}

export class Boss {
  body: Body;
  facing: 1 | -1 = -1;
  state: BossState = 'intro';
  stateT: number;
  hp: number;
  readonly maxHp: number;
  phase: 1 | 2 = 1;
  pattern: BossPatternSpec | null = null;
  patternStart = 0;
  hitIndex = -1;
  attackId: string | null = null;
  attackHitPlayer = false;
  lastUsed = new Map<string, number>();
  cooldownUntil = new Map<string, number>();
  consecutive: { id: string | null; count: number } = { id: null, count: 0 };
  lastSummonT = -Infinity;
  pendingSummons = 0;
  jumpFromX = 0;
  jumpTargetX = 0;
  stunUntil = 0;
  private readonly spec: { w: number; h: number; speed: number; rushSpeed: number };

  constructor(public id: string, public bossId: BossId, x: number, y: number, t: number, public bounds: Bounds) {
    this.spec = BOSS_BODY[bossId];
    this.body = { x, y, w: this.spec.w, h: this.spec.h, vx: 0, vy: 0, onGround: true, blockedX: 0 };
    this.hp = BOSS_HP[bossId];
    this.maxHp = this.hp;
    this.stateT = t;
  }

  get patterns(): BossPatternSpec[] { return BOSS_PATTERNS[this.bossId]; }
  get alive(): boolean { return this.state !== 'dead'; }
  get invulnerable(): boolean { return this.state === 'intro' || this.state === 'transition' || this.state === 'dead'; }
  get box(): Rect { return bodyRect(this.body.x, this.body.y, this.body.w, this.body.h); }
  get phase2Threshold(): number { return this.maxHp * LOCKED.bosses.phase2HpRatio; }
  /** Unparryable attacks glow red during their windup. */
  get redTelegraph(): boolean { return this.state === 'windup' && !!this.pattern && this.pattern.parryable === false; }

  private setState(s: BossState, t: number): void { this.state = s; this.stateT = t; }

  startFight(t: number): void { this.setState('idle', t); }

  beginTransition(t: number, slots: AttackSlots): void {
    this.cancelPattern(slots);
    this.setState('transition', t);
  }

  endTransition(t: number): void {
    this.phase = 2;
    this.setState('idle', t);
  }

  private cancelPattern(slots: AttackSlots): void {
    slots.release(this.id);
    this.pattern = null;
    this.attackId = null;
    this.hitIndex = -1;
    if (this.pendingSummons > 0) this.pendingSummons = 0;
  }

  recoveryMs(p: BossPatternSpec): number {
    const normalPattern = p.phases.includes(1);
    return this.phase === 2 && normalPattern ? p.recoveryMs * B.phase2NormalRecoveryMultiplier : p.recoveryMs;
  }

  summonNeeded(t: number, living: number): boolean {
    const summon = this.patterns.find((p) => p.id === 'summon');
    if (!summon || this.phase !== 2) return false;
    const cap = summon.maxLivingAndPending ?? 3;
    return living + this.pendingSummons < cap && t - this.lastSummonT >= summon.cooldownMs;
  }

  update(ctx: BossCtx): void {
    const t = ctx.t;
    const b = this.body;
    const dx = ctx.playerX - b.x;
    const dist = Math.abs(dx);
    const toward: 1 | -1 = dx >= 0 ? 1 : -1;
    let vx = 0;
    let physics = true;

    switch (this.state) {
      case 'intro':
      case 'transition':
      case 'dead':
        break;
      case 'stunned':
        if (t >= this.stunUntil) this.setState('idle', t);
        break;
      case 'idle':
      case 'move': {
        if (!ctx.playerAlive) break;
        this.facing = toward;
        const choice = choosePattern(this.patterns, {
          phase: this.phase,
          dist,
          t,
          lastUsed: this.lastUsed,
          cooldownUntil: this.cooldownUntil,
          consecutive: this.consecutive,
          summonNeeded: this.summonNeeded(t, ctx.livingSummons()),
        });
        if (choice.pattern && (choice.pattern.id === 'summon' || ctx.slots.tryAcquire(this.id, true))) {
          this.beginPattern(choice.pattern, t, ctx);
        } else if (choice.move !== 0) {
          vx = choice.move * toward * this.spec.speed;
          this.state = 'move';
        } else {
          this.state = 'idle';
        }
        break;
      }
      case 'windup': {
        const p = this.pattern!;
        if (p.id === 'red_jump_slam') {
          const leapAt = this.patternStart + p.startupMs - JUMP_AIR_MS;
          if (t < leapAt) {
            this.facing = toward;
            this.jumpTargetX = clamp(ctx.playerX, this.bounds.minX + b.w / 2, this.bounds.maxX - b.w / 2);
            this.jumpFromX = b.x;
          } else {
            physics = false;
            const k = Math.min(1, (t - leapAt) / JUMP_AIR_MS);
            b.x = this.jumpFromX + (this.jumpTargetX - this.jumpFromX) * k;
            b.y = ctx.groundY - Math.sin(Math.PI * k) * 90;
          }
        }
        if (t >= this.patternStart + p.startupMs) {
          if (p.id === 'red_jump_slam') b.y = ctx.groundY;
          if (p.id === 'summon') {
            this.lastSummonT = t;
            const kinds = this.pendingKinds;
            this.pendingSummons = 0;
            this.pendingKinds = [];
            ctx.requestSummons(kinds);
            this.setState('recover', t);
          } else {
            this.hitIndex = 0;
            this.attackId = ctx.newId('ba');
            this.attackHitPlayer = false;
            this.setState('hits', t);
          }
        }
        break;
      }
      case 'hits': {
        const p = this.pattern!;
        const hits = p.hitCount ?? 1;
        const spacing = p.hitSpacingMs ?? 0;
        const activeMs = p.activeMsPerHit ?? 100;
        const firstActive = this.patternStart + p.startupMs;
        const curStart = firstActive + this.hitIndex * spacing;
        if (p.id === 'rush' && t < curStart + activeMs) {
          vx = this.facing * this.spec.rushSpeed;
          if (b.blockedX === this.facing) vx = 0;
        }
        if (t >= curStart + activeMs) {
          if (this.hitIndex + 1 < hits) {
            const nextStart = firstActive + (this.hitIndex + 1) * spacing;
            this.attackId = null;
            if (t >= nextStart) {
              this.hitIndex += 1;
              this.attackId = ctx.newId('ba');
              this.attackHitPlayer = false;
            }
          } else {
            ctx.slots.release(this.id);
            this.attackId = null;
            this.setState('recover', t);
          }
        }
        break;
      }
      case 'recover':
        if (this.pattern && t >= this.stateT + this.recoveryMs(this.pattern)) {
          this.pattern = null;
          this.setState('idle', t);
        } else if (!this.pattern) this.setState('idle', t);
        break;
    }

    if (physics) {
      b.vx = vx;
      stepBody(b, ctx.dt, ctx.solids, this.bounds, ctx.groundY, GRAVITY);
      if (this.state === 'move' && b.onGround && b.blockedX !== 0 && vx !== 0 && !this.atBound(b.blockedX)) {
        b.vy = -380;
        b.onGround = false;
      }
    }
  }

  pendingKinds: EnemyKind[] = [];

  private atBound(dir: 1 | -1): boolean {
    const b = this.body;
    return dir < 0 ? b.x - b.w / 2 <= this.bounds.minX + 2 : b.x + b.w / 2 >= this.bounds.maxX - 2;
  }

  private beginPattern(p: BossPatternSpec, t: number, ctx: BossCtx): void {
    this.pattern = p;
    this.patternStart = t;
    this.hitIndex = -1;
    this.attackId = null;
    this.lastUsed.set(p.id, t);
    if (p.cooldownMs > 0) this.cooldownUntil.set(p.id, t + p.cooldownMs);
    if (this.consecutive.id === p.id) this.consecutive.count += 1;
    else this.consecutive = { id: p.id, count: 1 };
    if (p.id === 'summon') {
      const cap = p.maxLivingAndPending ?? 3;
      const missing = Math.max(0, cap - ctx.livingSummons() - this.pendingSummons);
      this.pendingSummons += missing;
      this.pendingKinds = (p.slots ?? []).slice(0, missing) as EnemyKind[];
      this.lastSummonT = t;
    }
    this.jumpFromX = this.body.x;
    this.setState('windup', t);
  }

  /** Active damage box of the current hit, if any. */
  activeAttack(t: number): EnemyAttackBox | null {
    if (this.state !== 'hits' || !this.pattern || !this.attackId || this.attackHitPlayer) return null;
    const p = this.pattern;
    const firstActive = this.patternStart + p.startupMs;
    const curStart = firstActive + this.hitIndex * (p.hitSpacingMs ?? 0);
    if (t < curStart || t >= curStart + (p.activeMsPerHit ?? 100)) return null;
    const b = this.body;
    const g = b.y;
    let box: Rect;
    switch (p.id) {
      case 'red_slam': box = forwardHitbox(b.x, g, b.w, this.facing, 110, 100, 50); break;
      case 'red_jump_slam': box = { x: b.x - 96, y: g - 48, w: 192, h: 48 }; break;
      case 'red_ground_wave': box = { x: b.x - 220, y: g - 48, w: 440, h: 48 }; break;
      case 'long_thrust':
      case 'double_thrust': box = forwardHitbox(b.x, g, b.w, this.facing, 150, 28, 44); break;
      case 'sweep': box = forwardHitbox(b.x, g, b.w, this.facing, 96, 60); break;
      case 'rush': box = forwardHitbox(b.x, g, b.w, this.facing, 36, 70); break;
      case 'heavy_cut': box = forwardHitbox(b.x, g, b.w, this.facing, 92, 80); break;
      default: box = forwardHitbox(b.x, g, b.w, this.facing, 72, 70); break;
    }
    return { id: this.attackId, box, damage: p.damagePerHit, parryable: p.parryable !== false, fromX: b.x, ownerId: this.id };
  }

  /** Damage from the player; bosses never flinch from ordinary hits. */
  takeHit(damage: number): void {
    if (this.invulnerable) return;
    this.hp = Math.max(0, this.hp - damage);
  }

  parryStun(t: number, slots: AttackSlots): void {
    this.cancelPattern(slots);
    this.stunUntil = t + DEFAULTS.combat.parryStunBossMs;
    this.setState('stunned', t);
  }

  die(t: number, slots: AttackSlots): void {
    this.cancelPattern(slots);
    this.setState('dead', t);
  }

  windupProgress(t: number): number {
    if (this.state !== 'windup' || !this.pattern) return 0;
    return Math.min(1, (t - this.patternStart) / this.pattern.startupMs);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
