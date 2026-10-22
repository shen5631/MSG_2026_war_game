// One attempt of one round. Owns all combat entities and advances them on the simulation clock.
import { BOSS_NAMES, DEFAULTS, ENEMY_DAMAGE, LEVELS, LOCKED, VIEW_W, type BossId, type EnemyKind, type RoundSpec, type AttackKind } from '../config/spec';
import { Boss } from './boss';
import { attackDamage, displayHp, resolveTerminal, rollDrop } from './damage';
import { Enemy, AttackSlots, arrowBox, type EnemyAttackBox, type Projectile } from './enemies';
import { EventQueue, type GameEvent } from './events';
import { rectsOverlap, type Rect } from './geometry';
import { type Bounds, type Solid } from './physics';
import { Player, type CombatInput, type PlayerCtx } from './player';
import type { StatsRecorder, KillSource } from './records';
import { nearestSpearTargets, SPEAR_DAMAGE, type SpearCandidate } from './skills';
import type { UpgradeStacks } from './upgrades';
import { SPAWN_WARNING_MS, WaveDirector, type WaveEvent } from './waves';
import { buildSolids } from './world';

export interface Pickup { id: string; kind: 'riceball' | 'herb'; x: number; y: number; areaId: string; alive: boolean }
export interface SpawnWarning { x: number; until: number; kind: EnemyKind }
export interface AllyVisual { id: string; kind: 'spear'; x: number; y: number; facing: 1 | -1; until: number }
export type RoundOutcome = 'victory' | 'defeat' | null;
export type FreezeKind = 'hitstop' | 'transition' | 'intro';

const PICKUP_SIZE = 16;
const HEAL = { riceball: LOCKED.healing.riceball.heal, herb: LOCKED.healing.herb_pouch.heal } as const;
const CORPSE_MS = 900;
const VICTORY_HOLD_MS = 1600;
const DEFEAT_HOLD_MS = 1600;

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  shieldRemainingMs: number;
  buffRemainingMs: number;
  selectedSkill: string;
  cooldownRemainingMs: number;
  cooldownTotalMs: number;
  spearReserved: boolean;
  round: number;
  roundName: string;
  arenaLabel: string;
  waveLabel: string;
  boss: null | { name: string; hp: number; maxHp: number; phase: 1 | 2; transition: boolean };
  chargeStage: number;
  exitOpen: boolean;
}

export class RoundSim {
  readonly spec: RoundSpec;
  t = 0;
  presentationT = 0;
  readonly player: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  solids: Solid[];
  arenas: WaveDirector[];
  arenaExited: boolean[];
  activeArena = -1;
  lockedBounds: Bounds | null = null;
  minX = 0;
  bossStage: 'pending' | 'intro' | 'fight' | 'done' = 'pending';
  freeze: { kind: FreezeKind; remaining: number } | null = null;
  outcome: RoundOutcome = null;
  outcomeElapsed = 0;
  events = new EventQueue();
  slots: AttackSlots;
  spawnWarnings: SpawnWarning[] = [];
  allyVisuals: AllyVisual[] = [];
  cameraX = 0;
  technicalRemovals = 0;
  playerRecoveries = 0;
  private plannedSpawns = new Map<number, { kind: EnemyKind; x: number }[]>();
  private reportedGone = new Set<string>();
  private serial = 0;
  private idSerial = 0;

  constructor(
    public readonly roundIndex: number,
    public readonly attemptId: number,
    private readonly upgrades: UpgradeStacks,
    private readonly recorder: StatsRecorder,
    private readonly rng: () => number,
  ) {
    this.spec = LEVELS.rounds[roundIndex - 1];
    this.player = new Player(this.spec.playerStart.x, this.spec.groundY);
    this.solids = buildSolids(this.spec);
    this.arenas = this.spec.arenas.map((a) => new WaveDirector(a));
    this.arenaExited = this.arenas.map(() => false);
    const caps = DEFAULTS.enemy.maxSimultaneousAttackers as Record<string, number>;
    this.slots = new AttackSlots(caps[`round${roundIndex}`] ?? 2);
    this.updateCamera();
  }

  newId = (prefix: string): string => `${prefix}-${this.attemptId}-${++this.idSerial}`;

  get groundY(): number { return this.spec.groundY; }
  get finished(): boolean {
    if (this.outcome === 'victory') return this.outcomeElapsed >= VICTORY_HOLD_MS;
    if (this.outcome === 'defeat') return this.outcomeElapsed >= DEFEAT_HOLD_MS;
    return false;
  }
  get bossName(): string { return BOSS_NAMES[this.spec.bossId as BossId]; }

  playerBounds(): Bounds {
    return this.lockedBounds ?? { minX: this.minX, maxX: this.spec.worldWidth };
  }

  /** Whether combat is currently accepting input (not frozen / not ended). */
  get combatLive(): boolean { return !this.outcome && !this.freeze; }

  step(dt: number, input: CombatInput): void {
    this.presentationT += dt;
    if (this.outcome) {
      this.outcomeElapsed += dt;
      return;
    }
    if (this.freeze) {
      this.freeze.remaining -= dt;
      if (this.freeze.remaining <= 0) this.endFreeze();
      return;
    }
    this.t += dt;
    const t = this.t;

    const ctx: PlayerCtx = {
      t,
      dt,
      upgrades: this.upgrades,
      events: this.events,
      solids: this.solids,
      bounds: this.playerBounds(),
      groundY: this.groundY,
      newId: this.newId,
      resolveSpear: () => this.resolveSpear(),
    };
    this.player.update(input, ctx);
    this.checkPlayerBounds();
    this.updateTriggers();
    this.updateWaves();
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.resolvePlayerAttacks();
    this.resolveEnemyAttacks();
    this.updatePickups();
    this.resolveOutcome();
    this.cleanup();
    this.updateCamera();
  }

  private endFreeze(): void {
    const kind = this.freeze!.kind;
    this.freeze = null;
    if (kind === 'transition' && this.boss) {
      this.boss.endTransition(this.t);
      this.events.push({ type: 'bossPhase2' });
      this.events.push({ type: 'hud' });
    } else if (kind === 'intro' && this.boss) {
      this.boss.startFight(this.t);
      this.bossStage = 'fight';
      this.events.push({ type: 'hud' });
    }
  }

  private checkPlayerBounds(): void {
    const b = this.player.body;
    if (b.y > this.groundY + 120 || b.x < -64 || b.x > this.spec.worldWidth + 64) {
      b.x = this.player.lastSafe.x;
      b.y = this.player.lastSafe.y;
      b.vx = 0;
      b.vy = 0;
      this.playerRecoveries += 1;
      this.recorder.warn(`player position restored (round ${this.roundIndex})`);
    }
  }

  // ---- area triggers ----
  private updateTriggers(): void {
    const px = this.player.body.x;
    this.arenas.forEach((d, i) => {
      if (d.state === 'idle' && this.activeArena === -1 && !this.arenaExited[i] && px >= d.spec.lockAtPlayerX) {
        this.activeArena = i;
        this.lockedBounds = { minX: d.spec.left, maxX: d.spec.right };
        this.handleWaveEvents(i, d.lock(this.t));
        this.events.push({ type: 'hud' });
      }
    });
    if (this.activeArena >= 0) {
      const d = this.arenas[this.activeArena];
      if (d.state === 'cleared' && px > d.spec.right + 8) {
        this.minX = d.spec.right;
        this.pickups = this.pickups.filter((p) => p.areaId !== d.spec.id);
        this.arenaExited[this.activeArena] = true;
        this.activeArena = -1;
      }
    }
    const ba = this.spec.bossArena;
    if (this.bossStage === 'pending' && px >= ba.playerEntryX) {
      this.lockedBounds = { minX: ba.left, maxX: ba.left + ba.width };
      this.minX = ba.left;
      this.pickups = [];
      this.boss = new Boss(this.newId('boss'), this.spec.bossId as BossId, ba.bossSpawnX, this.groundY, this.t, this.lockedBounds);
      this.slots = new AttackSlots(DEFAULTS.enemy.maxSimultaneousAttackers.bossPlusSummons);
      this.slots.bossId = this.boss.id;
      this.bossStage = 'intro';
      this.freeze = { kind: 'intro', remaining: DEFAULTS.boss.introMs };
      this.events.push({ type: 'toast', text: `${this.bossName} 등장!` });
      this.events.push({ type: 'hud' });
    }
  }

  private updateWaves(): void {
    this.arenas.forEach((d, i) => this.handleWaveEvents(i, d.update(this.t)));
    this.spawnWarnings = this.spawnWarnings.filter((w) => w.until > this.t);
    this.allyVisuals = this.allyVisuals.filter((a) => a.until > this.t);
  }

  private handleWaveEvents(i: number, evs: WaveEvent[]): void {
    const d = this.arenas[i];
    for (const e of evs) {
      if (e.type === 'warn') {
        const kinds = d.spec.waves[e.waveIndex].spawnOrder;
        const plan = this.chooseSpawnSlots(d, kinds);
        this.plannedSpawns.set(i, plan);
        const until = this.t + SPAWN_WARNING_MS;
        plan.forEach((p) => this.spawnWarnings.push({ x: p.x, until, kind: p.kind }));
      } else if (e.type === 'spawn') {
        let plan = this.plannedSpawns.get(i) ?? this.chooseSpawnSlots(d, d.spec.waves[e.waveIndex].spawnOrder);
        if (plan.some((p) => !this.spawnSafe(p.x, d))) plan = this.chooseSpawnSlots(d, plan.map((p) => p.kind));
        const ids = plan.map((p) => {
          const en = new Enemy(this.newId('e'), ++this.serial, p.kind, p.x, this.groundY, this.t, { minX: d.spec.left, maxX: d.spec.right }, false, d.spec.id);
          this.enemies.push(en);
          return en.id;
        });
        d.registerSpawned(ids);
        this.plannedSpawns.delete(i);
        this.events.push({ type: 'waveStarted', arenaId: d.spec.id, waveIndex: e.waveIndex });
        this.events.push({ type: 'sfx', id: 'waveStart' });
        this.events.push({ type: 'hud' });
      } else if (e.type === 'waveCleared') {
        this.projectiles = [];
        this.events.push({ type: 'hud' });
      } else if (e.type === 'arenaCleared') {
        this.lockedBounds = null;
        const herbX = d.spec.right - 48;
        this.pickups.push({ id: this.newId('herb'), kind: 'herb', x: herbX, y: this.groundY, areaId: d.spec.id, alive: true });
        this.events.push({ type: 'arenaCleared', arenaId: d.spec.id });
        this.events.push({ type: 'toast', text: '구역 확보! 출구가 열렸습니다.' });
        this.events.push({ type: 'hud' });
      }
    }
  }

  private spawnSafe(x: number, d: WaveDirector): boolean {
    if (Math.abs(x - this.player.body.x) < DEFAULTS.enemy.minSpawnPlayerDistance) return false;
    if (x < d.spec.left + 16 || x > d.spec.right - 16) return false;
    const box: Rect = { x: x - 20, y: this.groundY - 70, w: 40, h: 70 };
    return !this.solids.some((s) => s.alive && rectsOverlap(s, box));
  }

  /** Deterministic slot choice: nominal slot i, otherwise the next safe unused slot. Kinds/count never change. */
  chooseSpawnSlots(d: WaveDirector, kinds: EnemyKind[]): { kind: EnemyKind; x: number }[] {
    const slots = d.spec.nominalSpawnSlotsX;
    const used = new Set<number>();
    return kinds.map((kind, i) => {
      for (let k = 0; k < slots.length; k++) {
        const idx = (i + k) % slots.length;
        if (used.has(idx)) continue;
        const x = d.spec.left + slots[idx];
        if (this.spawnSafe(x, d)) {
          used.add(idx);
          return { kind, x };
        }
      }
      let best = -1;
      let bestD = -1;
      slots.forEach((sx, idx) => {
        if (used.has(idx)) return;
        const dd = Math.abs(d.spec.left + sx - this.player.body.x);
        if (dd > bestD) { bestD = dd; best = idx; }
      });
      if (best < 0) best = i % slots.length;
      used.add(best);
      return { kind, x: d.spec.left + slots[best] };
    });
  }

  // ---- entities ----
  private isVisible = (x: number): boolean => x >= this.cameraX - 4 && x <= this.cameraX + VIEW_W + 4;

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      e.update({
        t: this.t,
        dt,
        playerX: p.body.x,
        playerY: p.body.y,
        playerAlive: p.alive,
        solids: this.solids,
        groundY: this.groundY,
        slots: this.slots,
        isVisible: this.isVisible,
        events: this.events,
        spawnArrow: (en) => this.spawnArrow(en),
        newId: this.newId,
        findSafePoint: (en) => this.findSafePoint(en),
      });
    }
  }

  private updateBoss(dt: number): void {
    if (!this.boss || this.bossStage !== 'fight') return;
    this.boss.update({
      t: this.t,
      dt,
      playerX: this.player.body.x,
      playerAlive: this.player.alive,
      solids: this.solids,
      groundY: this.groundY,
      slots: this.slots,
      livingSummons: () => this.livingSummons(),
      requestSummons: (kinds) => this.spawnSummons(kinds),
      newId: this.newId,
    });
  }

  livingSummons(): number {
    return this.enemies.filter((e) => e.isSummon && e.alive).length;
  }

  private spawnSummons(kinds: EnemyKind[]): void {
    const ba = this.spec.bossArena;
    const cap = LOCKED.bosses.so_bae_ap.maxLivingSummons;
    const bounds = { minX: ba.left, maxX: ba.left + ba.width };
    for (const kind of kinds) {
      if (this.livingSummons() >= cap) break;
      const px = this.player.body.x;
      const left = ba.left + 48;
      const right = ba.left + ba.width - 48;
      let x = Math.abs(left - px) > Math.abs(right - px) ? left : right;
      if (Math.abs(x - px) < DEFAULTS.enemy.minSpawnPlayerDistance) x = x === left ? right : left;
      const en = new Enemy(this.newId('s'), ++this.serial, kind, x, this.groundY, this.t, bounds, true, 'boss');
      this.enemies.push(en);
      this.spawnWarnings.push({ x, until: this.t + 400, kind });
    }
    this.events.push({ type: 'sfx', id: 'waveStart' });
  }

  private spawnArrow(e: Enemy): void {
    this.projectiles.push({
      id: this.newId('arrow'),
      ownerId: e.id,
      x: e.body.x + e.facing * 18,
      prevX: e.body.x + e.facing * 18,
      y: e.body.y - 44,
      vx: e.facing * DEFAULTS.enemy.projectileSpeed,
      born: this.t,
      damage: ENEMY_DAMAGE.archer,
      alive: true,
    });
  }

  findSafePoint(e: Enemy): number | null {
    const px = this.player.body.x;
    const b = e.bounds;
    const arena = this.arenas.find((a) => a.spec.id === e.areaId);
    const offsets = arena ? arena.spec.nominalSpawnSlotsX : [48, 592, 96, 544];
    const candidates = offsets
      .map((o) => b.minX + o)
      .filter((x) => x - e.body.w / 2 >= b.minX && x + e.body.w / 2 <= b.maxX)
      .filter((x) => Math.abs(x - px) >= DEFAULTS.faultTolerance.relocationMinPlayerDistance)
      .filter((x) => {
        const box: Rect = { x: x - e.body.w / 2, y: this.groundY - e.body.h, w: e.body.w, h: e.body.h };
        if (this.solids.some((s) => s.alive && rectsOverlap(s, box))) return false;
        return !this.enemies.some((o) => o !== e && o.targetable && rectsOverlap(o.box, box));
      })
      .sort((a, c) => Math.abs(c - px) - Math.abs(a - px));
    return candidates.length ? candidates[0] : null;
  }

  private updateProjectiles(dt: number): void {
    const bounds = this.lockedBounds ?? { minX: 0, maxX: this.spec.worldWidth };
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.prevX = p.x;
      p.x += (p.vx * dt) / 1000;
      if (this.t - p.born > DEFAULTS.enemy.projectileMaxAgeMs || p.x < bounds.minX - 16 || p.x > bounds.maxX + 16) {
        p.alive = false;
        continue;
      }
      const box = arrowBox(p);
      for (const s of this.solids) {
        if (s.alive && s.blocksProjectiles && rectsOverlap(s, box)) {
          p.alive = false;
          break;
        }
      }
    }
  }

  // ---- damage resolution ----
  private resolvePlayerAttacks(): void {
    const t = this.t;
    const pa = this.player.activeAttackBox(t);
    if (pa) this.applyPlayerHitbox(pa.box, pa.attack.kind, pa.attack.hit);
    const pd = this.player.activeDashBox(t);
    if (pd) this.applyPlayerHitbox(pd.box, 'dash', pd.dash.hit);
  }

  private applyPlayerHitbox(box: Rect, kind: AttackKind, hit: Set<string>): void {
    const t = this.t;
    const dmg = attackDamage(kind, this.upgrades.sword, this.player.commandBuffActive);
    const px = this.player.body.x;
    const heavyKinds = kind === 'heavy' || kind === 'finisher' || kind.startsWith('charge');
    for (const e of this.enemies) {
      if (!e.targetable || hit.has(e.id) || !rectsOverlap(box, e.box)) continue;
      hit.add(e.id);
      const res = e.takeHit(dmg, kind, px, this.slots, t);
      if (res === 'blocked') {
        this.events.push({ type: 'sfx', id: 'guard' });
        this.events.push({ type: 'fx', fx: 'guard', x: e.body.x, y: e.body.y - 40 });
        continue;
      }
      this.events.push({ type: 'sfx', id: heavyKinds ? 'heavyHit' : 'hit' });
      this.events.push({ type: 'fx', fx: 'hit', x: e.body.x, y: e.body.y - 40, level: heavyKinds ? 1 : 0 });
      if (res === 'killed') this.onEnemyKilled(e, 'sword');
    }
    const boss = this.boss;
    if (boss && boss.alive && this.bossStage === 'fight' && !hit.has(boss.id) && rectsOverlap(box, boss.box)) {
      hit.add(boss.id);
      if (!boss.invulnerable) {
        boss.takeHit(dmg);
        this.events.push({ type: 'sfx', id: heavyKinds ? 'heavyHit' : 'hit' });
        this.events.push({ type: 'fx', fx: 'hit', x: boss.body.x, y: boss.body.y - 46, level: heavyKinds ? 1 : 0 });
        this.events.push({ type: 'hud' });
      }
    }
    for (const s of this.solids) {
      if (!s.alive || !s.destructible || hit.has(s.id) || !rectsOverlap(box, s)) continue;
      hit.add(s.id);
      s.hp -= dmg;
      this.events.push({ type: 'fx', fx: 'hit', x: s.x + s.w / 2, y: s.y + s.h / 2, level: 0 });
      if (s.hp <= 0) s.alive = false;
    }
  }

  private onEnemyKilled(e: Enemy, source: KillSource): void {
    const fresh = this.recorder.recordNormalKill(e.id, source);
    if (fresh && rollDrop(this.rng())) {
      this.pickups.push({ id: this.newId('rice'), kind: 'riceball', x: e.body.x, y: this.groundY, areaId: e.areaId, alive: true });
    }
    this.reportGone(e);
  }

  private reportGone(e: Enemy): void {
    if (this.reportedGone.has(e.id)) return;
    this.reportedGone.add(e.id);
    const i = this.arenas.findIndex((a) => a.spec.id === e.areaId);
    if (i >= 0) this.handleWaveEvents(i, this.arenas[i].onEnemyGone(e.id, this.t));
  }

  private resolveSpear(): number {
    const p = this.player;
    const cands: { cand: SpearCandidate; enemy?: Enemy; boss?: Boss }[] = [];
    for (const e of this.enemies) {
      cands.push({ cand: { id: e.id, x: e.body.x, y: e.body.y, targetable: e.targetable, blockedByWall: this.wallBetween(p.body.x, e.body.x), spawnSerial: e.serial, isBoss: false }, enemy: e });
    }
    const boss = this.boss;
    if (boss && this.bossStage === 'fight') {
      cands.push({ cand: { id: boss.id, x: boss.body.x, y: boss.body.y, targetable: boss.alive && !boss.invulnerable, blockedByWall: this.wallBetween(p.body.x, boss.body.x), spawnSerial: 0, isBoss: true }, boss });
    }
    const chosen = nearestSpearTargets(p.body.x, p.body.y, cands.map((c) => c.cand));
    for (const target of chosen) {
      const entry = cands.find((c) => c.cand.id === target.id)!;
      // The ally appears on the player's side of the target, facing it.
      const side: 1 | -1 = target.x >= p.body.x ? -1 : 1;
      const facing: 1 | -1 = side === -1 ? 1 : -1;
      this.allyVisuals.push({ id: this.newId('ally'), kind: 'spear', x: target.x + side * 34, y: this.groundY, facing, until: this.t + DEFAULTS.skills.spearVisualMs });
      if (entry.enemy) {
        const res = entry.enemy.takeHit(SPEAR_DAMAGE, null, p.body.x, this.slots, this.t);
        this.events.push({ type: 'fx', fx: 'spear', x: target.x, y: this.groundY - 40 });
        if (res === 'killed') this.onEnemyKilled(entry.enemy, 'command-skills');
      } else if (entry.boss) {
        entry.boss.takeHit(SPEAR_DAMAGE);
        this.events.push({ type: 'fx', fx: 'spear', x: target.x, y: this.groundY - 46 });
      }
    }
    if (chosen.length > 0) {
      this.events.push({ type: 'sfx', id: 'spearCall' });
      this.events.push({ type: 'hud' });
    }
    return chosen.length;
  }

  /** A wall only blocks when an alive solid at least as tall as a body sits between the two points. */
  private wallBetween(x0: number, x1: number): boolean {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    return this.solids.some((s) => s.alive && s.h >= 72 && s.x > lo && s.x + s.w < hi);
  }

  private resolveEnemyAttacks(): void {
    const p = this.player;
    if (!p.alive) return;
    const pbox = p.box;
    const attacks: { atk: EnemyAttackBox; owner: Enemy | Boss }[] = [];
    for (const e of this.enemies) {
      const a = e.activeAttack();
      if (a) attacks.push({ atk: a, owner: e });
    }
    if (this.boss && this.bossStage === 'fight') {
      const a = this.boss.activeAttack(this.t);
      if (a) attacks.push({ atk: a, owner: this.boss });
    }
    for (const { atk, owner } of attacks) {
      if (!rectsOverlap(atk.box, pbox)) continue;
      owner.attackHitPlayer = true;
      const out = p.receiveHit({ damage: atk.damage, parryable: atk.parryable, fromX: atk.fromX, attackerId: atk.ownerId }, { t: this.t, events: this.events });
      if (out === 'parried') {
        this.onParry(p.body.x + p.facing * 24, p.body.y - 44);
        if (owner instanceof Boss) owner.parryStun(this.t, this.slots);
        else owner.parryStun(this.slots, this.t);
      } else if (out === 'killed' || out === 'hurt') {
        this.events.push({ type: 'fx', fx: 'hit', x: p.body.x, y: p.body.y - 40, level: 0 });
      }
      if (!p.alive) break;
    }
    if (!p.alive) return;
    for (const pr of this.projectiles) {
      if (!pr.alive || !rectsOverlap(arrowBox(pr), p.box)) continue;
      const fromX = p.body.x - Math.sign(pr.vx) * 100;
      const out = p.receiveHit({ damage: pr.damage, parryable: true, fromX, attackerId: pr.ownerId }, { t: this.t, events: this.events });
      if (out === 'invulnerable') continue;
      pr.alive = false;
      if (out === 'parried') this.onParry(pr.x, pr.y);
      if (!p.alive) break;
    }
  }

  private onParry(x: number, y: number): void {
    this.recorder.recordParry();
    this.events.push({ type: 'sfx', id: 'parrySuccess' });
    this.events.push({ type: 'fx', fx: 'parry', x, y });
    this.events.push({ type: 'hitstop', ms: DEFAULTS.combat.parryHitstopMs });
    if (!this.freeze) this.freeze = { kind: 'hitstop', remaining: DEFAULTS.combat.parryHitstopMs };
  }

  private updatePickups(): void {
    const p = this.player;
    if (!p.alive) return;
    const pbox = p.box;
    for (const it of this.pickups) {
      if (!it.alive) continue;
      const box: Rect = { x: it.x - PICKUP_SIZE / 2, y: it.y - PICKUP_SIZE, w: PICKUP_SIZE, h: PICKUP_SIZE };
      if (!rectsOverlap(box, pbox)) continue;
      if (p.hp <= 0 || p.hp >= LOCKED.player.maxHp) continue;
      p.hp = Math.min(LOCKED.player.maxHp, p.hp + HEAL[it.kind]);
      it.alive = false;
      this.events.push({ type: 'sfx', id: 'heal' });
      this.events.push({ type: 'fx', fx: 'heal', x: it.x, y: it.y - 20 });
      this.events.push({ type: 'hud' });
    }
    this.pickups = this.pickups.filter((i) => i.alive);
  }

  private resolveOutcome(): void {
    const boss = this.boss;
    const bossHp = boss && this.bossStage === 'fight' && boss.alive ? boss.hp : null;
    const res = resolveTerminal(this.player.hp, bossHp);
    if (res === 'boss-victory' && boss) {
      this.victory(boss);
      return;
    }
    if (res === 'game-over') {
      this.outcome = 'defeat';
      this.outcomeElapsed = 0;
      this.recorder.recordDeath();
      this.events.push({ type: 'playerDied' });
      return;
    }
    if (boss && boss.phase === 1 && boss.alive && boss.state !== 'transition' && boss.hp <= boss.phase2Threshold) {
      boss.beginTransition(this.t, this.slots);
      this.clearHazards();
      this.freeze = { kind: 'transition', remaining: DEFAULTS.boss.phaseTransitionMs };
      this.events.push({ type: 'sfx', id: 'phaseChange' });
      this.events.push({ type: 'hud' });
    }
  }

  private clearHazards(): void {
    this.projectiles = [];
    for (const e of this.enemies) if (e.alive) e.cancelAttack(this.slots, this.t);
  }

  private victory(boss: Boss): void {
    boss.die(this.t, this.slots);
    this.recorder.recordBossKill(boss.id);
    // Final cleanup: remaining summons/attacks vanish without kills or drops.
    for (const e of this.enemies) if (e.alive) e.removeSilently(this.slots);
    this.projectiles = [];
    this.spawnWarnings = [];
    this.bossStage = 'done';
    this.outcome = 'victory';
    this.outcomeElapsed = 0;
    this.events.push({ type: 'bossDefeated' });
    this.events.push({ type: 'sfx', id: 'victory' });
    this.events.push({ type: 'hud' });
  }

  private cleanup(): void {
    for (const e of this.enemies) {
      if (e.removed && e.technicalRemoved && !this.reportedGone.has(e.id)) {
        this.technicalRemovals += 1;
        this.recorder.warn(`enemy ${e.id} technically removed`);
        this.reportGone(e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.removed && !(e.state === 'dead' && this.t - e.deadAt > CORPSE_MS));
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateCamera(): void {
    if (this.lockedBounds) this.cameraX = this.lockedBounds.minX;
    else this.cameraX = Math.max(0, Math.min(this.spec.worldWidth - VIEW_W, this.player.body.x - VIEW_W / 2));
  }

  drainEvents(): GameEvent[] { return this.events.drain(); }

  hud(): HudSnapshot {
    const p = this.player;
    const boss = this.boss;
    let arenaLabel = '이동 구간';
    let waveLabel = '';
    if (this.bossStage !== 'pending') {
      arenaLabel = '보스전';
    } else if (this.activeArena >= 0) {
      const d = this.arenas[this.activeArena];
      arenaLabel = `구역 ${this.activeArena + 1}/${this.arenas.length}`;
      waveLabel = d.state === 'cleared' ? '출구 개방' : `웨이브 ${Math.min(d.waveIndex + 1, d.totalWaves)}/${d.totalWaves}`;
    } else {
      const next = this.arenaExited.filter(Boolean).length;
      arenaLabel = next >= this.arenas.length ? '보스 진영으로' : `구역 ${next + 1}/${this.arenas.length} 이동`;
    }
    return {
      hp: displayHp(p.hp),
      maxHp: LOCKED.player.maxHp,
      shield: p.shield.value,
      shieldRemainingMs: p.shield.remainingMs,
      buffRemainingMs: p.buffRemaining,
      selectedSkill: p.selectedSkillId,
      cooldownRemainingMs: p.cooldownRemaining,
      cooldownTotalMs: p.cooldownTotal,
      spearReserved: p.spearReserved || p.mode === 'command',
      round: this.roundIndex,
      roundName: this.spec.name,
      arenaLabel,
      waveLabel,
      boss: boss && this.bossStage !== 'pending'
        ? { name: this.bossName, hp: Math.ceil(boss.hp), maxHp: boss.maxHp, phase: boss.phase, transition: boss.state === 'transition' }
        : null,
      chargeStage: p.mode === 'charge' ? p.chargeStage : 0,
      exitOpen: this.activeArena >= 0 && this.arenas[this.activeArena].state === 'cleared',
    };
  }

  // ---- development/test helpers (never wired in production builds) ----
  debugKillWave(): void {
    for (const e of this.enemies) {
      if (!e.targetable || e.isSummon) continue;
      const res = e.takeHit(9999, null, this.player.body.x, this.slots, this.t);
      if (res === 'killed') this.onEnemyKilled(e, 'sword');
    }
  }

  debugTeleport(x: number): void {
    this.player.body.x = x;
    this.player.body.y = this.groundY;
    this.player.lastSafe = { x, y: this.groundY };
  }

  /** Test-only skip: marks remaining arenas as passed (no kills/drops) and moves before the boss gate. */
  debugSkipArenas(): void {
    this.arenas.forEach((d, i) => {
      for (const id of d.alive) {
        const e = this.enemies.find((x) => x.id === id);
        e?.removeSilently(this.slots);
      }
      d.alive.clear();
      d.state = 'cleared';
      this.arenaExited[i] = true;
    });
    this.activeArena = -1;
    this.lockedBounds = null;
    this.spawnWarnings = [];
    this.minX = this.arenas.length ? this.arenas[this.arenas.length - 1].spec.right : 0;
    this.debugTeleport(this.spec.bossArena.left - 40);
  }

  debugDamageBoss(amount: number): void {
    if (this.boss && this.bossStage === 'fight') this.boss.takeHit(amount);
  }
}
