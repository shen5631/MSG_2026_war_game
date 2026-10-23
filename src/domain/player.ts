// Player state machine: movement, combo, chord charge, parry, dash, command skills, hit handling.
// All timing uses the simulation clock passed in `ctx.t` (ms). Animation frames never decide damage.
import { ATTACK_TIMINGS, DEFAULTS, LOCKED, SKILL_CYCLE, type AttackKind, type SkillId } from '../config/spec';
import { applyIncomingDamage, chargeLevel, chargeReleaseKind, decayShield, isParryActive, type ShieldState } from './damage';
import type { EventQueue } from './events';
import { bodyRect, forwardHitbox, sweptRect, type Rect } from './geometry';
import { stepBody, type Body, type Bounds, type Solid } from './physics';
import { parryWindowMs, sharedCooldownMs, type UpgradeStacks } from './upgrades';

export type CombatAction = 'jump' | 'weak' | 'heavy' | 'parry' | 'dash' | 'run' | 'cycleSkill' | 'castSkill';

export interface CombatInput {
  moveX: number;
  held: Partial<Record<CombatAction, boolean>>;
  pressed: CombatAction[];
  released: CombatAction[];
}

export const emptyInput = (): CombatInput => ({ moveX: 0, held: {}, pressed: [], released: [] });

export type PlayerMode = 'free' | 'attack' | 'charge' | 'dash' | 'parry' | 'parryRecover' | 'command' | 'hurt' | 'dead';

const M = DEFAULTS.movement;
const C = DEFAULTS.combat;
const CHORD_MS = LOCKED.player.chargeChordWindowMs;
const BODY_W = M.playerBodyWidth;
const BODY_H = M.playerBodyHeight;
const DASH_TOTAL = M.dashActiveMs + M.dashRecoveryMs;
const PARRY_FAIL_MS = C.parryFailureRecoveryMs;
const HURT_MS = C.hpHitStunMs;
const COMMAND_MS = DEFAULTS.skills.spearCommandMs;
/**
 * [구현 기본값] Walking into a low rock pops the player up onto it (an automatic hop) instead of stopping dead;
 * gravity then brings them back down past its far edge. Only rocks (the low boss-arena/terrain stones): crates,
 * steps, platforms and barricades still need a real jump. The hop clears the rock top by this margin.
 */
const AUTO_HOP_KINDS = new Set(['rock']);
const AUTO_HOP_MARGIN_PX = 8;
const AUTO_HOP_MAX_RISE_PX = 32;

export interface PlayerAttack {
  kind: AttackKind;
  id: string;
  startT: number;
  facing: 1 | -1;
  startupEnd: number;
  activeEnd: number;
  end: number;
  chordOpenUntil: number;
  chordFirst: 'weak' | 'heavy' | null;
  hit: Set<string>;
}

export interface PlayerDash { id: string; startT: number; facing: 1 | -1; hit: Set<string>; prevBox: Rect }

export interface PlayerCtx {
  t: number;
  dt: number;
  upgrades: UpgradeStacks;
  events: EventQueue;
  solids: Solid[];
  bounds: Bounds;
  groundY: number;
  newId: (prefix: string) => string;
  /** Resolves the spear support at the end of the command pose. Returns number of targets hit. */
  resolveSpear: () => number;
}

export type HitOutcome = 'none' | 'parried' | 'invulnerable' | 'absorbed' | 'hurt' | 'killed';

export interface IncomingHit { damage: number; parryable: boolean; fromX: number; attackerId: string }

export class Player {
  body: Body;
  facing: 1 | -1 = 1;
  mode: PlayerMode = 'free';
  modeT = 0;
  hp: number = LOCKED.player.maxHp;
  shield: ShieldState = { value: 0, remainingMs: 0 };
  invulnUntil = -Infinity;
  attack: PlayerAttack | null = null;
  dash: PlayerDash | null = null;
  dashReadyAt = -Infinity;
  chargeStart = 0;
  chargeStage = 0;
  chargeLock = false;
  comboStep = 0;
  comboExpire = -Infinity;
  buffer: { action: CombatAction; t: number } | null = null;
  parryReservedFor: string | null = null;
  parryStart = -Infinity;
  parryWindow: number = LOCKED.player.baseParryWindowMs;
  airAttackUsed = false;
  lastGroundT = 0;
  jumpedSinceGround = false;
  jumpBufferedAt = -Infinity;
  knockVx = 0;
  // skills
  selectedSkill = 0;
  cooldownRemaining = 0;
  cooldownTotal: number = LOCKED.skills.baseSharedCooldownMs;
  buffRemaining = 0;
  spearReserved = false;
  /** DEV-only (DevPanel "무적"): every incoming hit is ignored. Never set by the shipped game. */
  debugInvincible = false;
  lastSafe: { x: number; y: number };
  deathT = 0;

  constructor(x: number, y: number) {
    this.body = { x, y, w: BODY_W, h: BODY_H, vx: 0, vy: 0, onGround: true, blockedX: 0 };
    this.lastSafe = { x, y };
  }

  get selectedSkillId(): SkillId { return SKILL_CYCLE[this.selectedSkill]; }
  get commandBuffActive(): boolean { return this.buffRemaining > 0; }
  get alive(): boolean { return this.mode !== 'dead'; }
  get box(): Rect { return bodyRect(this.body.x, this.body.y, BODY_W, BODY_H); }

  private setMode(m: PlayerMode, t: number): void { this.mode = m; this.modeT = t; }

  private modeEnd(): number {
    switch (this.mode) {
      case 'attack': return this.attack ? this.attack.end : this.modeT;
      case 'dash': return this.modeT + DASH_TOTAL;
      case 'parryRecover': return this.modeT + PARRY_FAIL_MS;
      case 'command': return this.modeT + COMMAND_MS;
      case 'parry': return this.parryStart + this.parryWindow + PARRY_FAIL_MS;
      default: return this.modeT;
    }
  }

  /** Inputs during an action are kept only inside the final 150ms (one slot). */
  private bufferIfLate(action: CombatAction, t: number): void {
    if (t >= this.modeEnd() - C.comboInputBufferMs) this.buffer = { action, t };
  }

  resetCombo(): void { this.comboStep = 0; this.comboExpire = -Infinity; }

  update(input: CombatInput, ctx: PlayerCtx): void {
    this.tickSkillTimers(ctx);

    if (this.mode === 'dead') {
      this.body.vx = 0;
      stepBody(this.body, ctx.dt, ctx.solids, ctx.bounds, ctx.groundY, M.gravityY);
      return;
    }

    for (const a of input.pressed) {
      if (a === 'cycleSkill') this.selectedSkill = (this.selectedSkill + 1) % SKILL_CYCLE.length;
    }
    if (!input.held.weak && !input.held.heavy) this.chargeLock = false;

    for (const a of input.pressed) {
      if (a === 'castSkill') this.castSkill(ctx);
      else if (a !== 'cycleSkill' && a !== 'run') this.handlePress(a, input, ctx);
    }

    this.advanceMode(input, ctx);
    this.move(input, ctx);
  }

  private tickSkillTimers(ctx: PlayerCtx): void {
    const dt = ctx.dt;
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
      if (this.cooldownRemaining === 0) ctx.events.push({ type: 'sfx', id: 'skillReady' });
    }
    if (this.buffRemaining > 0) this.buffRemaining = Math.max(0, this.buffRemaining - dt);
    if (this.shield.remainingMs > 0) this.shield = decayShield(this.shield, dt);
  }

  private handlePress(a: CombatAction, input: CombatInput, ctx: PlayerCtx): void {
    const t = ctx.t;
    const onGround = this.body.onGround;
    switch (a) {
      case 'dash':
        if ((this.mode === 'free' || this.mode === 'attack' || this.mode === 'charge') && onGround && t >= this.dashReadyAt) {
          this.startDash(input, ctx);
        }
        return;
      case 'jump':
        if (this.mode === 'free') {
          if (this.canJump(t)) this.doJump(t);
          else this.jumpBufferedAt = t;
        } else if (this.mode === 'charge') {
          this.cancelCharge();
          if (this.canJump(t)) this.doJump(t);
        } else if (this.mode === 'attack' || this.mode === 'dash' || this.mode === 'parryRecover' || this.mode === 'command') {
          this.bufferIfLate('jump', t);
        }
        return;
      case 'weak':
      case 'heavy': {
        const other = a === 'weak' ? 'heavy' : 'weak';
        if (this.mode === 'free') {
          if (!onGround) {
            if (a === 'weak' && !this.airAttackUsed) this.startAttack('air_attack', t, input, null, -Infinity);
          } else {
            this.startGroundAttack(a, t, t, input);
          }
        } else if (this.mode === 'attack' && this.attack) {
          const atk = this.attack;
          // Chord: second button inside the undecided window while the first is still held.
          if (atk.chordFirst === other && t - atk.startT <= CHORD_MS && t <= atk.chordOpenUntil && input.held[other] && !this.chargeLock) {
            this.startCharge(t, ctx);
          } else {
            this.bufferIfLate(a, t);
          }
        } else if (this.mode === 'dash' || this.mode === 'parryRecover' || this.mode === 'command') {
          this.bufferIfLate(a, t);
        }
        return;
      }
      case 'parry':
        if (this.mode === 'free' && onGround) this.startParry(ctx);
        else if (this.mode === 'attack' && this.attack && this.attack.kind !== 'air_attack') this.parryReservedFor = this.attack.id;
        else if (this.mode === 'dash' || this.mode === 'parryRecover') this.bufferIfLate('parry', t);
        return;
      default:
        return;
    }
  }

  private canJump(t: number): boolean {
    if (this.body.onGround) return true;
    return !this.jumpedSinceGround && t - this.lastGroundT <= M.jumpCoyoteMs;
  }

  private doJump(t: number): void {
    this.body.vy = M.jumpVelocityY;
    this.body.onGround = false;
    this.jumpedSinceGround = true;
    this.jumpBufferedAt = -Infinity;
    this.resetCombo();
    this.lastGroundT = t - 1000;
  }

  private faceFromInput(input: CombatInput): void {
    if (input.moveX > 0) this.facing = 1;
    else if (input.moveX < 0) this.facing = -1;
  }

  private startGroundAttack(button: 'weak' | 'heavy', pressT: number, t: number, input: CombatInput): void {
    if (t > this.comboExpire) this.comboStep = 0;
    let kind: AttackKind;
    if (button === 'weak') {
      const next = this.comboStep >= 3 ? 1 : this.comboStep + 1;
      kind = `weak${next}` as AttackKind;
      this.comboStep = next;
    } else if (this.comboStep === 3) {
      kind = 'finisher';
      this.comboStep = 0;
    } else {
      kind = 'heavy';
      this.comboStep = 0;
    }
    const chordable = kind !== 'finisher' && !this.chargeLock && t - pressT <= CHORD_MS;
    this.startAttack(kind, chordable ? pressT : t, input, chordable ? button : null, chordable ? pressT + CHORD_MS : -Infinity);
  }

  private startAttack(kind: AttackKind, startT: number, input: CombatInput, chordFirst: 'weak' | 'heavy' | null, chordOpenUntil: number): void {
    if (kind === 'dash') return;
    this.faceFromInput(input);
    const tm = ATTACK_TIMINGS[kind];
    this.attack = {
      kind,
      id: `pa${Player.attackSerial++}`,
      startT,
      facing: this.facing,
      startupEnd: startT + tm.startupMs,
      activeEnd: startT + tm.startupMs + tm.activeMs,
      end: startT + tm.startupMs + tm.activeMs + tm.recoveryMs,
      chordOpenUntil,
      chordFirst,
      hit: new Set(),
    };
    if (kind === 'air_attack') this.airAttackUsed = true;
    this.setMode('attack', startT);
  }

  static attackSerial = 1;

  private startCharge(t: number, ctx: PlayerCtx): void {
    this.attack = null;
    this.parryReservedFor = null;
    this.buffer = null;
    this.resetCombo();
    this.chargeStart = t;
    this.chargeStage = 0;
    this.setMode('charge', t);
    ctx.events.push({ type: 'fx', fx: 'charge', x: this.body.x, y: this.body.y, level: 0 });
  }

  private cancelCharge(): void {
    this.chargeLock = true;
    this.setMode('free', this.modeT);
  }

  private releaseCharge(t: number, input: CombatInput): void {
    const kind = chargeReleaseKind(t - this.chargeStart);
    this.chargeLock = true;
    this.startAttack(kind, t, input, null, -Infinity);
  }

  private startDash(input: CombatInput, ctx: PlayerCtx): void {
    const t = ctx.t;
    this.attack = null;
    this.parryReservedFor = null;
    this.buffer = null;
    if (this.mode === 'charge') this.chargeLock = true;
    this.resetCombo();
    this.faceFromInput(input);
    this.dash = { id: ctx.newId('dash'), startT: t, facing: this.facing, hit: new Set(), prevBox: this.box };
    this.dashReadyAt = t + M.dashCooldownMs;
    this.setMode('dash', t);
    ctx.events.push({ type: 'sfx', id: 'dash' });
    ctx.events.push({ type: 'fx', fx: 'dash', x: this.body.x, y: this.body.y, facing: this.facing });
  }

  private startParry(ctx: PlayerCtx): void {
    this.parryStart = ctx.t;
    this.parryWindow = parryWindowMs(ctx.upgrades);
    this.parryReservedFor = null;
    this.setMode('parry', ctx.t);
  }

  private startCommand(t: number): void {
    this.spearReserved = false;
    this.attack = null;
    this.resetCombo();
    this.setMode('command', t);
  }

  private castSkill(ctx: PlayerCtx): void {
    if (this.mode === 'hurt' || this.mode === 'dead') return;
    if (this.spearReserved || this.mode === 'command') return;
    if (this.cooldownRemaining > 0) {
      ctx.events.push({ type: 'toast', text: '지휘 스킬 재사용 대기 중입니다.' });
      return;
    }
    const skill = this.selectedSkillId;
    if (skill === 'command_buff') {
      this.buffRemaining = LOCKED.skills.command_buff.durationMs;
      this.startCooldown(ctx);
      ctx.events.push({ type: 'sfx', id: 'buff' });
      ctx.events.push({ type: 'fx', fx: 'skill', x: this.body.x, y: this.body.y, level: 0 });
    } else if (skill === 'shield_guard') {
      this.shield = { value: LOCKED.skills.shield_guard.initialShield, remainingMs: LOCKED.skills.shield_guard.maxDurationMs };
      this.startCooldown(ctx);
      ctx.events.push({ type: 'sfx', id: 'spearCall' });
      ctx.events.push({ type: 'fx', fx: 'skill', x: this.body.x, y: this.body.y, level: 1 });
    } else {
      if (this.mode === 'free' && this.body.onGround) this.startCommand(ctx.t);
      else if (this.mode === 'charge') {
        this.chargeLock = true;
        this.startCommand(ctx.t);
      } else this.spearReserved = true;
    }
    ctx.events.push({ type: 'hud' });
  }

  startCooldown(ctx: PlayerCtx): void {
    this.cooldownTotal = sharedCooldownMs(ctx.upgrades);
    this.cooldownRemaining = this.cooldownTotal;
  }

  private advanceMode(input: CombatInput, ctx: PlayerCtx): void {
    const t = ctx.t;
    switch (this.mode) {
      case 'attack': {
        const atk = this.attack!;
        if (atk.chordFirst && !input.held[atk.chordFirst]) atk.chordOpenUntil = -Infinity;
        if (t >= atk.end) {
          if (atk.kind.startsWith('weak')) this.comboExpire = t + C.comboContinuationMs;
          this.attack = null;
          this.setMode('free', t);
          this.afterAction(input, ctx, atk.id);
        } else if (atk.kind === 'air_attack' && this.body.onGround && t >= atk.activeEnd) {
          this.attack = null;
          this.setMode('free', t);
        }
        break;
      }
      case 'charge': {
        if (!input.held.weak || !input.held.heavy) {
          this.releaseCharge(t, input);
          break;
        }
        this.faceFromInput(input);
        const lvl = chargeLevel(t - this.chargeStart);
        if (lvl > this.chargeStage) {
          this.chargeStage = lvl;
          ctx.events.push({ type: 'sfx', id: 'chargeStage' });
          ctx.events.push({ type: 'fx', fx: 'charge', x: this.body.x, y: this.body.y, level: lvl });
        }
        break;
      }
      case 'dash':
        if (t >= this.modeT + DASH_TOTAL) {
          this.dash = null;
          this.setMode('free', t);
          this.afterAction(input, ctx, null);
        }
        break;
      case 'parry':
        if (!isParryActive(this.parryStart, t, this.parryWindow)) {
          this.setMode('parryRecover', this.parryStart + this.parryWindow);
          ctx.events.push({ type: 'sfx', id: 'parryWhiff' });
        }
        break;
      case 'parryRecover':
        if (t >= this.modeT + PARRY_FAIL_MS) {
          this.setMode('free', t);
          this.afterAction(input, ctx, null);
        }
        break;
      case 'command':
        if (t >= this.modeT + COMMAND_MS) {
          const hits = ctx.resolveSpear();
          if (hits > 0) {
            this.startCooldown(ctx);
            ctx.events.push({ type: 'hud' });
          } else {
            ctx.events.push({ type: 'toast', text: '주변에 공격할 대상이 없습니다.' });
          }
          this.setMode('free', t);
          this.afterAction(input, ctx, null);
        }
        break;
      case 'hurt':
        if (t >= this.modeT + HURT_MS) this.setMode('free', t);
        break;
      default:
        break;
    }
    if (this.mode === 'free' && this.spearReserved && this.body.onGround) this.startCommand(t);
  }

  /** Reservation priority after an action ends: parry → spear command → buffered input. */
  private afterAction(input: CombatInput, ctx: PlayerCtx, finishedAttackId: string | null): void {
    const t = ctx.t;
    if (finishedAttackId && this.parryReservedFor === finishedAttackId) {
      this.parryReservedFor = null;
      this.buffer = null;
      if (this.body.onGround) this.startParry(ctx);
      return;
    }
    this.parryReservedFor = null;
    if (this.spearReserved && this.body.onGround) {
      this.buffer = null;
      this.startCommand(t);
      return;
    }
    const buf = this.buffer;
    this.buffer = null;
    if (!buf) return;
    if (buf.action === 'weak' || buf.action === 'heavy') {
      // Buffered presses start now; the chord window opens from the actual start, never retroactively.
      if (this.body.onGround) this.startGroundAttack(buf.action, t, t, input);
      else if (buf.action === 'weak' && !this.airAttackUsed) this.startAttack('air_attack', t, input, null, -Infinity);
    } else if (buf.action === 'jump') {
      if (this.canJump(t)) this.doJump(t);
    } else if (buf.action === 'parry') {
      if (this.body.onGround) this.startParry(ctx);
    }
  }

  private move(input: CombatInput, ctx: PlayerCtx): void {
    const b = this.body;
    const t = ctx.t;
    const air = !b.onGround;
    switch (this.mode) {
      case 'free': {
        this.faceFromInput(input);
        const speed = input.held.run ? M.runSpeed : M.walkSpeed;
        b.vx = input.moveX * speed * (air ? M.airControlFactor : 1);
        break;
      }
      case 'attack':
        if (this.attack?.kind === 'air_attack') b.vx = input.moveX * M.walkSpeed * M.airControlFactor;
        else b.vx = input.moveX * M.walkSpeed * M.attackMoveFactor;
        break;
      case 'charge':
        b.vx = Math.sign(input.moveX) * M.chargeMoveSpeed;
        break;
      case 'dash':
        if (this.dash) this.dash.prevBox = this.box;
        b.vx = t < this.modeT + M.dashActiveMs ? this.facing * M.dashSpeed : 0;
        break;
      case 'hurt':
        b.vx = this.knockVx;
        this.knockVx *= 0.85;
        break;
      default:
        b.vx = 0;
    }
    const wasGround = b.onGround;
    stepBody(b, ctx.dt, ctx.solids, ctx.bounds, ctx.groundY, M.gravityY);
    if (this.mode === 'free' && b.onGround && input.moveX !== 0 && b.blockedX === Math.sign(input.moveX)) this.autoHop(ctx.solids);
    if (b.onGround) {
      this.lastGroundT = t;
      this.jumpedSinceGround = false;
      this.airAttackUsed = false;
      if (!wasGround) ctx.events.push({ type: 'hud' });
      this.lastSafe = { x: b.x, y: b.y };
      if (this.mode === 'free' && t - this.jumpBufferedAt <= M.jumpBufferMs) this.doJump(t);
    }
  }

  /** Pops over a low rock the player is walking into (see AUTO_HOP_KINDS). Not a jump: no jump state is consumed. */
  private autoHop(solids: Solid[]): void {
    const b = this.body;
    const dir = b.blockedX;
    const face = b.x + (dir * b.w) / 2;
    const rock = solids.find((s) => s.alive && AUTO_HOP_KINDS.has(s.kind) && b.y > s.y && b.y - b.h < s.y + s.h &&
      Math.abs((dir > 0 ? s.x : s.x + s.w) - face) <= 1);
    if (!rock) return;
    const rise = b.y - rock.y;
    if (rise > AUTO_HOP_MAX_RISE_PX) return;
    b.vy = -Math.sqrt(2 * M.gravityY * (rise + AUTO_HOP_MARGIN_PX));
    b.onGround = false;
  }

  /** Active forward hitbox of the current sword attack, if any. */
  activeAttackBox(t: number): { attack: PlayerAttack; box: Rect } | null {
    const a = this.attack;
    if (!a || this.mode !== 'attack' || t < a.startupEnd || t >= a.activeEnd) return null;
    const tm = ATTACK_TIMINGS[a.kind as Exclude<AttackKind, 'dash'>];
    return { attack: a, box: forwardHitbox(this.body.x, this.body.y, BODY_W, a.facing, tm.reachPx, tm.heightPx) };
  }

  /** Dash sweeps from the previous to the current body box during the active portion. */
  activeDashBox(t: number): { dash: PlayerDash; box: Rect } | null {
    if (this.mode !== 'dash' || !this.dash || t >= this.modeT + M.dashActiveMs) return null;
    return { dash: this.dash, box: sweptRect(this.dash.prevBox, this.box) };
  }

  receiveHit(hit: IncomingHit, ctx: { t: number; events: EventQueue }): HitOutcome {
    const t = ctx.t;
    if (this.mode === 'dead') return 'none';
    const front = (hit.fromX - this.body.x) * this.facing >= -2;
    if (hit.parryable && this.mode === 'parry' && front && isParryActive(this.parryStart, t, this.parryWindow)) {
      this.setMode('free', t);
      return 'parried';
    }
    if (t < this.invulnUntil || this.debugInvincible) return 'invulnerable';
    const res = applyIncomingDamage({ hp: this.hp, shield: this.shield.value, damage: hit.damage, hpInvulnerable: false });
    const hadShield = this.shield.value > 0;
    this.shield = res.shield > 0 ? { value: res.shield, remainingMs: this.shield.remainingMs } : { value: 0, remainingMs: 0 };
    if (hadShield && res.absorbed > 0) {
      ctx.events.push({ type: 'sfx', id: res.shield > 0 ? 'shieldAbsorb' : 'shieldBreak' });
      if (res.shield <= 0) ctx.events.push({ type: 'fx', fx: 'shieldBreak', x: this.body.x, y: this.body.y });
    }
    if (!res.stun) {
      ctx.events.push({ type: 'hud' });
      return 'absorbed';
    }
    this.hp = res.hp;
    this.invulnUntil = t + res.invulnerabilityMs;
    // User rule change (2026-10-23): an HP hit no longer breaks a charge — damage and the 0.5 s invulnerability
    // apply, but no hit-stun / knockback, and the charge keeps building (jump/dash still cancel it).
    const keepCharge = this.mode === 'charge' && !LOCKED.player.chargeCancelOnHpHit;
    this.attack = null;
    this.dash = null;
    this.buffer = null;
    this.parryReservedFor = null;
    this.spearReserved = false;
    this.jumpBufferedAt = -Infinity;
    if (this.mode === 'charge' && !keepCharge) this.chargeLock = true;
    this.resetCombo();
    ctx.events.push({ type: 'hud' });
    ctx.events.push({ type: 'playerDamaged' });
    if (this.hp <= 0) {
      this.hp = 0;
      this.setMode('dead', t);
      this.deathT = t;
      ctx.events.push({ type: 'sfx', id: 'death' });
      return 'killed';
    }
    if (keepCharge) {
      ctx.events.push({ type: 'sfx', id: 'playerHurt' });
      return 'hurt';
    }
    this.knockVx = (this.body.x >= hit.fromX ? 1 : -1) * 120;
    this.setMode('hurt', t);
    ctx.events.push({ type: 'sfx', id: 'playerHurt' });
    return 'hurt';
  }
}
