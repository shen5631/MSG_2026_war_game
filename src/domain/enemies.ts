// Ordinary enemy AI: one shared state machine, per-species data and behaviour branches.
import { DEFAULTS, ENEMY_DAMAGE, ENEMY_HP, ENEMY_PATTERNS, ENEMY_SPEED, type AttackKind, type EnemyKind } from '../config/spec';
import type { EventQueue } from './events';
import { bodyRect, forwardHitbox, type Rect } from './geometry';
import { stepBody, type Body, type Bounds, type Solid } from './physics';

export type EnemyState =
  | 'idle' | 'move' | 'windup' | 'active' | 'recover' | 'stunned' | 'guardBroken' | 'dead' | 'relocating';

const BODY: Record<EnemyKind, { w: number; h: number }> = {
  infantry: { w: 30, h: 68 },
  archer: { w: 28, h: 66 },
  spearman: { w: 30, h: 70 },
  shieldman: { w: 36, h: 70 },
  cavalry: { w: 64, h: 84 },
};

const GRAVITY = DEFAULTS.movement.gravityY;
const HOP_VY = -380;
const CAVALRY_REPOSITION_SPEED = 100;
const GUARD_BREAK_TAGS = new Set<string>(DEFAULTS.enemy.guardBreakTags);
const FT = DEFAULTS.faultTolerance;

/** Shared attack slots: limits how many attackers may be in windup/active at once. */
export class AttackSlots {
  holders = new Set<string>();
  bossId: string | null = null;
  constructor(public capacity: number) {}

  tryAcquire(id: string, isBoss = false): boolean {
    if (this.holders.has(id)) return true;
    if (isBoss) {
      if (this.holders.size >= this.capacity) return false;
      this.holders.add(id);
      return true;
    }
    // Boss priority: while a boss is present, minions may use at most capacity-1 slots.
    const limit = this.bossId ? this.capacity - 1 : this.capacity;
    let minions = 0;
    for (const h of this.holders) if (h !== this.bossId) minions++;
    if (minions >= limit || this.holders.size >= this.capacity) return false;
    this.holders.add(id);
    return true;
  }

  release(id: string): void { this.holders.delete(id); }
  clear(): void { this.holders.clear(); }
}

export interface EnemyCtx {
  t: number;
  dt: number;
  playerX: number;
  playerY: number;
  playerAlive: boolean;
  solids: Solid[];
  groundY: number;
  slots: AttackSlots;
  isVisible: (x: number) => boolean;
  events: EventQueue;
  spawnArrow: (e: Enemy) => void;
  newId: (prefix: string) => string;
  findSafePoint: (e: Enemy) => number | null;
}

export interface EnemyAttackBox { id: string; box: Rect; damage: number; parryable: boolean; fromX: number; ownerId: string }

export class Enemy {
  body: Body;
  facing: 1 | -1 = -1;
  state: EnemyState = 'idle';
  stateT: number;
  hp: number;
  readonly maxHp: number;
  attackId: string | null = null;
  attackHitPlayer = false;
  stunUntil = 0;
  deadAt = 0;
  removed = false;
  technicalRemoved = false;
  knockVx = 0;
  chargeStartX = 0;
  // stuck detection
  private moveIntent = false;
  private stuckCheckT: number;
  private stuckCheckX: number;
  relocateAt = 0;
  relocateRetries = 0;
  relocateTargetX: number | null = null;

  constructor(
    public id: string,
    public serial: number,
    public kind: EnemyKind,
    x: number,
    y: number,
    t: number,
    public bounds: Bounds,
    public isSummon: boolean,
    public areaId: string,
  ) {
    const s = BODY[kind];
    this.body = { x, y, w: s.w, h: s.h, vx: 0, vy: 0, onGround: true, blockedX: 0 };
    this.hp = ENEMY_HP[kind];
    this.maxHp = this.hp;
    this.stateT = t;
    this.graceUntil = t + DEFAULTS.enemy.spawnAttackGraceMs;
    this.stuckCheckT = t;
    this.stuckCheckX = x;
  }

  graceUntil: number;

  get alive(): boolean { return this.state !== 'dead' && !this.removed; }
  get targetable(): boolean { return this.alive && this.state !== 'relocating'; }
  get box(): Rect { return bodyRect(this.body.x, this.body.y, this.body.w, this.body.h); }
  get damage(): number { return ENEMY_DAMAGE[this.kind]; }

  /** Shieldman guards its front while not attacking or stunned. */
  get guarding(): boolean {
    return this.kind === 'shieldman' && (this.state === 'idle' || this.state === 'move');
  }

  private setState(s: EnemyState, t: number): void { this.state = s; this.stateT = t; }

  private releaseSlot(ctx: { slots: AttackSlots }): void { ctx.slots.release(this.id); }

  cancelAttack(slots: AttackSlots, t: number): void {
    slots.release(this.id);
    this.attackId = null;
    if (this.state === 'windup' || this.state === 'active' || this.state === 'recover') this.setState('idle', t);
  }

  update(ctx: EnemyCtx): void {
    const t = ctx.t;
    if (this.removed) return;
    if (this.state === 'dead') {
      this.body.vx = 0;
      stepBody(this.body, ctx.dt, ctx.solids, this.bounds, ctx.groundY, GRAVITY);
      return;
    }
    if (this.state === 'relocating') {
      this.updateRelocation(ctx);
      return;
    }
    this.moveIntent = false;
    const p = ENEMY_PATTERNS[this.kind];
    const dx = ctx.playerX - this.body.x;
    const dist = Math.abs(dx);
    const toward: 1 | -1 = dx >= 0 ? 1 : -1;
    const canStartAttack = ctx.playerAlive && t >= this.graceUntil && ctx.isVisible(this.body.x);
    let vx = 0;

    switch (this.state) {
      case 'stunned':
      case 'guardBroken':
        vx = this.knockVx;
        this.knockVx *= 0.8;
        if (t >= this.stunUntil) this.setState('idle', t);
        break;
      case 'idle':
      case 'move': {
        this.facing = toward;
        const decision = this.decide(dist, toward, canStartAttack, ctx);
        vx = decision;
        if (vx !== 0) this.moveIntent = true;
        if (this.state === 'idle' || this.state === 'move') this.setStateKeep(vx !== 0 ? 'move' : 'idle');
        break;
      }
      case 'windup':
        if (t >= this.stateT + p.startupMs) {
          if (this.kind === 'archer') {
            ctx.spawnArrow(this);
            ctx.events.push({ type: 'sfx', id: 'arrow' });
            this.releaseSlot(ctx);
            this.setState('recover', t);
          } else {
            this.attackId = ctx.newId('ea');
            this.attackHitPlayer = false;
            this.chargeStartX = this.body.x;
            this.setState('active', t);
          }
        }
        break;
      case 'active': {
        if (this.kind === 'cavalry') {
          vx = this.facing * ENEMY_SPEED.cavalry;
          const maxMs = p.activeMsMax ?? 600;
          if (t >= this.stateT + maxMs || this.attackHitPlayer || this.body.blockedX === this.facing) {
            this.releaseSlot(ctx);
            this.attackId = null;
            this.setState('recover', t);
            vx = 0;
          }
        } else if (t >= this.stateT + (p.activeMs ?? 100)) {
          this.releaseSlot(ctx);
          this.attackId = null;
          this.setState('recover', t);
        }
        break;
      }
      case 'recover':
        if (t >= this.stateT + p.recoveryMs) this.setState('idle', t);
        break;
      default:
        break;
    }

    this.body.vx = vx;
    stepBody(this.body, ctx.dt, ctx.solids, this.bounds, ctx.groundY, GRAVITY);
    // Hop over low obstacles when walking into them.
    if (this.moveIntent && this.body.onGround && this.body.blockedX !== 0 && this.blockedBySolid(ctx.solids)) {
      this.body.vy = HOP_VY;
      this.body.onGround = false;
    }
    this.checkStuck(ctx);
  }

  private setStateKeep(s: EnemyState): void { this.state = s; }

  private blockedBySolid(solids: Solid[]): boolean {
    const b = this.body;
    const probe = { x: b.x - b.w / 2 + b.blockedX * 2, y: b.y - b.h, w: b.w, h: b.h - 1 };
    return solids.some((s) => s.alive && probe.x < s.x + s.w && probe.x + probe.w > s.x && probe.y < s.y + s.h && probe.y + probe.h > s.y);
  }

  /** Returns desired horizontal velocity; may transition into windup. */
  private decide(dist: number, toward: 1 | -1, canAttack: boolean, ctx: EnemyCtx): number {
    const t = ctx.t;
    const p = ENEMY_PATTERNS[this.kind];
    const speed = ENEMY_SPEED[this.kind];
    switch (this.kind) {
      case 'infantry':
      case 'spearman':
      case 'shieldman': {
        const range = p.attackRange ?? 68;
        if (dist > range) return toward * speed;
        if (canAttack && ctx.slots.tryAcquire(this.id)) {
          this.facing = toward;
          this.setState('windup', t);
          return 0;
        }
        // Keep a little spacing while waiting for a slot.
        if (dist < range * 0.55) return -toward * speed * 0.5;
        return 0;
      }
      case 'archer': {
        const [near, far] = p.preferredDistance ?? [160, 260];
        const atWall = this.atBound(toward === 1 ? -1 : 1);
        if (dist < near && !atWall) return -toward * speed;
        if (dist > far) return toward * speed;
        if (canAttack && ctx.slots.tryAcquire(this.id)) {
          this.facing = toward;
          this.setState('windup', t);
        }
        return 0;
      }
      case 'cavalry': {
        const [near, far] = p.chargeTriggerDistance ?? [160, 320];
        const atWall = this.atBound(toward === 1 ? -1 : 1);
        const inRange = dist >= near && dist <= far;
        if ((inRange || (atWall && dist > 40 && dist < near)) && canAttack && ctx.slots.tryAcquire(this.id)) {
          this.facing = toward;
          this.setState('windup', t);
          return 0;
        }
        if (dist < near && !atWall) return -toward * CAVALRY_REPOSITION_SPEED;
        if (dist > far) return toward * CAVALRY_REPOSITION_SPEED;
        return 0;
      }
      default:
        return 0;
    }
  }

  private atBound(dir: 1 | -1): boolean {
    const b = this.body;
    return dir < 0 ? b.x - b.w / 2 <= this.bounds.minX + 8 : b.x + b.w / 2 >= this.bounds.maxX - 8;
  }

  /** Current active hitbox (cavalry lance spans the charge). */
  activeAttack(): EnemyAttackBox | null {
    if (this.state !== 'active' || !this.attackId || this.attackHitPlayer) return null;
    const b = this.body;
    let box: Rect;
    switch (this.kind) {
      case 'infantry': box = forwardHitbox(b.x, b.y, b.w, this.facing, 46, 50); break;
      case 'spearman': box = forwardHitbox(b.x, b.y, b.w, this.facing, 96, 28, 42); break;
      case 'shieldman': box = forwardHitbox(b.x, b.y, b.w, this.facing, 40, 50); break;
      case 'cavalry': box = forwardHitbox(b.x, b.y, b.w, this.facing, 36, 56, 44); break;
      default: return null;
    }
    return { id: this.attackId, box, damage: this.damage, parryable: true, fromX: b.x, ownerId: this.id };
  }

  /** Telegraph progress 0..1 while winding up (for visuals). */
  windupProgress(t: number): number {
    if (this.state !== 'windup') return 0;
    return Math.min(1, (t - this.stateT) / ENEMY_PATTERNS[this.kind].startupMs);
  }

  /**
   * Applies player damage. Returns 'blocked' for shield guard, 'killed', or 'hit'.
   * `attackKind` null means spear support (pierces guard).
   */
  takeHit(damage: number, attackKind: AttackKind | null, fromX: number, slots: AttackSlots, t: number): 'blocked' | 'killed' | 'hit' {
    if (!this.targetable) return 'hit';
    const fromFront = (fromX - this.body.x) * this.facing >= 0;
    if (attackKind && this.guarding && fromFront) {
      if (!GUARD_BREAK_TAGS.has(attackKind)) return 'blocked';
      this.hp -= damage;
      if (this.hp <= 0) return this.die(slots, t);
      this.cancelAttack(slots, t);
      this.stunUntil = t + DEFAULTS.enemy.guardBreakMs;
      this.setState('guardBroken', t);
      return 'hit';
    }
    this.hp -= damage;
    if (this.hp <= 0) return this.die(slots, t);
    const superArmor = this.kind === 'cavalry' && this.state === 'active';
    if (!superArmor) {
      this.cancelAttack(slots, t);
      this.stunUntil = t + DEFAULTS.combat.ordinaryEnemyStunMs;
      this.knockVx = (this.body.x >= fromX ? 1 : -1) * 80;
      this.setState('stunned', t);
    }
    return 'hit';
  }

  parryStun(slots: AttackSlots, t: number): void {
    this.cancelAttack(slots, t);
    this.stunUntil = t + DEFAULTS.combat.parryStunNormalMs;
    this.knockVx = 0;
    this.setState('stunned', t);
  }

  private die(slots: AttackSlots, t: number): 'killed' {
    this.hp = 0;
    slots.release(this.id);
    this.attackId = null;
    this.deadAt = t;
    this.setState('dead', t);
    return 'killed';
  }

  /** Removal without a kill (final-victory cleanup / technical removal). */
  removeSilently(slots: AttackSlots): void {
    slots.release(this.id);
    this.removed = true;
    this.attackId = null;
  }

  // ---- stuck / out-of-bounds safety (spec §22) ----
  private checkStuck(ctx: EnemyCtx): void {
    const t = ctx.t;
    const b = this.body;
    const out = b.x < this.bounds.minX - 4 || b.x > this.bounds.maxX + 4 || b.y > ctx.groundY + 64;
    if (out) {
      this.beginRelocation(ctx);
      return;
    }
    const intentional = this.state === 'windup' || this.state === 'active' || this.state === 'recover' || this.state === 'stunned' || this.state === 'guardBroken' || this.state === 'idle';
    if (!this.moveIntent || intentional) {
      this.stuckCheckT = t;
      this.stuckCheckX = b.x;
      return;
    }
    if (t - this.stuckCheckT >= FT.stuckDetectMs) {
      const moved = Math.abs(b.x - this.stuckCheckX);
      if (moved < FT.minMovementPx && b.blockedX !== 0) this.beginRelocation(ctx);
      this.stuckCheckT = t;
      this.stuckCheckX = b.x;
    }
  }

  beginRelocation(ctx: Pick<EnemyCtx, 't' | 'slots' | 'findSafePoint'>): void {
    ctx.slots.release(this.id);
    this.attackId = null;
    this.setState('relocating', ctx.t);
    this.relocateRetries = 0;
    this.relocateTargetX = ctx.findSafePoint(this);
    this.relocateAt = ctx.t + (this.relocateTargetX === null ? FT.retryIntervalMs : FT.relocationSpawnWarningMs);
  }

  private updateRelocation(ctx: EnemyCtx): void {
    const t = ctx.t;
    if (t < this.relocateAt) return;
    if (this.relocateTargetX !== null) {
      this.body.x = this.relocateTargetX;
      this.body.y = ctx.groundY;
      this.body.vx = 0;
      this.body.vy = 0;
      this.relocateTargetX = null;
      this.stuckCheckT = t;
      this.stuckCheckX = this.body.x;
      this.graceUntil = t + DEFAULTS.enemy.spawnAttackGraceMs;
      this.setState('idle', t);
      return;
    }
    this.relocateRetries += 1;
    if (this.relocateRetries > FT.relocationRetries) {
      this.technicalRemoved = true;
      this.removeSilently(ctx.slots);
      return;
    }
    const x = ctx.findSafePoint(this);
    if (x !== null) {
      this.relocateTargetX = x;
      this.relocateAt = t + FT.relocationSpawnWarningMs;
    } else {
      this.relocateAt = t + FT.retryIntervalMs;
    }
  }
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  born: number;
  damage: number;
  alive: boolean;
  prevX: number;
}

export const ARROW_W = 14;
export const ARROW_H = 4;
export const arrowBox = (p: Projectile): Rect => {
  const x0 = Math.min(p.prevX, p.x) - ARROW_W / 2;
  const x1 = Math.max(p.prevX, p.x) + ARROW_W / 2;
  return { x: x0, y: p.y - ARROW_H / 2, w: x1 - x0, h: ARROW_H };
};
