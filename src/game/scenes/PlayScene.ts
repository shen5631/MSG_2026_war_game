// Owns the single render loop: polls input, advances the controller's fixed-step simulation, renders the state.
import Phaser from 'phaser';
import { DEFAULTS, ENEMY_PATTERNS, VIEW_H, VIEW_W } from '../../config/spec';
import type { Services } from '../../app/bridge';
import type { Boss } from '../../domain/boss';
import type { Enemy } from '../../domain/enemies';
import type { GameEvent } from '../../domain/events';
import type { RoundSim } from '../../domain/round';
import type { MusicTheme } from '../../audio/AudioSystem';
import { ATLAS_KEY, PLAYER_ORIGIN, playerFrame } from '../visual/AnimationBindings';
import { BOSS_FRAME_INFO, type Pose } from '../visual/placeholders';
import { BG_ROUND1_KEY, GROUND_STRIP_KEY, ROUND_BG_KEYS, groundStripKey, GROUND_STRIP_TOP, INFANTRY_KEY, infantryPose, makeDecor, makeSolidImage } from '../visual/environment';
import { ARCHER_KEY, ARCHER_ORIGIN, ARCHER_SCALE, ARROW_KEYS, archerFrame, arrowPlacement, arrowTextureFor } from '../visual/archer';
import { SPEARMAN_KEY, spearmanPose } from '../visual/spearman';
import { PhaserShieldEnemyView } from '../enemies/shield/PhaserShieldEnemyView';
import { SHIELDMAN_SCALE, shieldmanSnapshot } from '../visual/shieldman';
import { PhaserCavalryView } from '../enemies/cavalry/PhaserCavalryView';
import { CAVALRY_ART_HEIGHT, cavalrySnapshot } from '../visual/cavalry';
import { drawSpawnWarning, spawnWarningProgress } from '../visual/spawnWarning';
import { drawEnemyBar, newEnemyBarState, stepEnemyBar, type EnemyBarState } from '../visual/enemyHpBar';
import { ALLY_SPEAR_KEY, allySpearPose } from '../visual/allySpearman';
import { VANGUARD_KEY, VANGUARD_ORIGIN, vanguardFrame } from '../visual/vanguard';
import { SPEAR_CAPTAIN_KEY, SPEAR_CAPTAIN_ORIGIN, spearCaptainFrame } from '../visual/spearCaptain';
import { drawChargeGauge } from '../visual/chargeGauge';
import { shadowScale, shadowSurfaceY } from '../visual/shadow';
import { PhaserShieldView } from '../skills/shield/PhaserShieldView';
import { shieldSnapshotOf } from '../visual/shieldAllies';

/** Round-1 illustration: crop above its own road (y<700) and scale so that line meets the game ground. */
const BG_CROP_H = 700;
const BG_SCALE = 304 / BG_CROP_H;
const BG_DISPLAY_W = Math.round(1672 * BG_SCALE);

const HEAL_TEXT_MS = 1000;

interface FxItem { sprite: Phaser.GameObjects.Sprite; frames: string[]; start: number; dur: number; active: boolean; follow?: boolean }

const FX_FRAMES: Record<string, string[]> = {
  hit: ['ganggamchan_hit_fx_01', 'ganggamchan_hit_fx_02', 'ganggamchan_hit_fx_03', 'ganggamchan_hit_fx_04'],
  parry: ['ganggamchan_parry_fx_01', 'ganggamchan_parry_fx_02', 'ganggamchan_parry_fx_03', 'ganggamchan_parry_fx_04'],
  dash: ['ganggamchan_dash_fx_01', 'ganggamchan_dash_fx_02', 'ganggamchan_dash_fx_03', 'ganggamchan_dash_fx_04'],
  charge: ['ganggamchan_charge_fx_01', 'ganggamchan_charge_fx_02', 'ganggamchan_charge_fx_03', 'ganggamchan_charge_fx_04'],
  // skill effect sheet is a collection of distinct shapes: each use picks single frames, never one long loop.
  skillBuff: ['ganggamchan_skill_01', 'ganggamchan_skill_02'],
  skillShield: ['ganggamchan_skill_03', 'ganggamchan_skill_04'],
  spear: ['ganggamchan_skill_05', 'ganggamchan_skill_06'],
  heal: ['ganggamchan_skill_07'],
};

export class PlayScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private bgImage!: Phaser.GameObjects.Image;
  private decor: Phaser.GameObjects.Image[] = [];
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private buffAura!: Phaser.GameObjects.Sprite;
  private chargeAura!: Phaser.GameObjects.Sprite;
  private chargeGauge!: Phaser.GameObjects.Graphics;
  private healTexts: { text: Phaser.GameObjects.Text; start: number; active: boolean }[] = [];
  /** 방패병 막기 soldiers (goryeo_shield_skill_v1): a view of the player's shield, never an actor. */
  private shieldView!: PhaserShieldView;
  private walls!: Phaser.GameObjects.Graphics;
  private spawnMarks!: Phaser.GameObjects.Graphics;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private bossGlow!: Phaser.GameObjects.Ellipse;
  private enemySprites = new Map<string, { s: Phaser.GameObjects.Sprite; bar: Phaser.GameObjects.Graphics; barState: EnemyBarState; lastHp: number; flashUntil: number; shieldView?: PhaserShieldEnemyView; cavalryView?: PhaserCavalryView }>();
  private bossSprite: Phaser.GameObjects.Sprite | null = null;
  private bossFlashUntil = 0;
  private bossLastHp = 0;
  private solidSprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private pools = { arrows: [] as Phaser.GameObjects.Image[], allies: [] as Phaser.GameObjects.Sprite[] };
  private fx: FxItem[] = [];
  private renderedRound: RoundSim | null = null;
  private roundTheme = 1;
  private camX = 0;
  private lastNow = 0;
  private unsubs: (() => void)[] = [];

  constructor() { super('play'); }

  private get services(): Services { return this.game.registry.get('services') as Services; }

  create(): void {
    this.sky = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'generated_bg_r3_sky').setOrigin(0).setScrollFactor(0).setDepth(-50);
    this.far = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'generated_bg_r3_far').setOrigin(0).setScrollFactor(0).setDepth(-40);
    this.mid = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'generated_bg_r3_mid').setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.near = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'generated_bg_r3_near').setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.bgImage = this.add.image(0, 0, BG_ROUND1_KEY).setOrigin(0).setScrollFactor(0).setDepth(-45).setScale(BG_SCALE).setCrop(0, 0, 1672, BG_CROP_H);
    const strip = this.textures.get(GROUND_STRIP_KEY).getSourceImage();
    this.ground = this.add.tileSprite(0, GROUND_STRIP_TOP, VIEW_W, strip.height, GROUND_STRIP_KEY).setOrigin(0).setScrollFactor(0).setDepth(-10);
    this.roundTheme = 0;
    this.walls = this.add.graphics().setDepth(40);
    this.spawnMarks = this.add.graphics().setDepth(7);
    this.bossGlow = this.add.ellipse(0, 0, 90, 22, 0xff2020, 0.45).setDepth(4).setVisible(false);
    // Above terrain art (depth 6) so it shows on platforms and crates, below the hero (20).
    this.shadow = this.add.ellipse(0, 0, 34, 8, 0x000000, 0.35).setDepth(7);
    this.buffAura = this.add.sprite(0, 0, ATLAS_KEY, 'ganggamchan_skill_02').setOrigin(0.5, 0.89).setDepth(9).setAlpha(0.6).setVisible(false);
    this.chargeAura = this.add.sprite(0, 0, ATLAS_KEY, 'ganggamchan_charge_fx_01').setOrigin(0.5, 0.89).setDepth(21).setVisible(false);
    this.chargeGauge = this.add.graphics().setDepth(26).setVisible(false);
    this.player = this.add.sprite(200, 304, ATLAS_KEY, 'ganggamchan_idle_01').setOrigin(PLAYER_ORIGIN[0], PLAYER_ORIGIN[1]).setDepth(20);
    // No barrier ellipse around the soldiers (user preference): the soldiers alone show the shield.
    this.shieldView = new PhaserShieldView(this, { showBarrier: false });
    if (import.meta.env.DEV) {
      window.__GGC_SCENE__ = this;
      if (new URLSearchParams(window.location.search).has('debug')) this.debugGfx = this.add.graphics().setDepth(100);
    }

    const { controller, audio } = this.services;
    this.unsubs.push(controller.onEvent((e) => this.onGameEvent(e)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.lastNow = performance.now();
    audio.setMusic('title');
  }

  private cleanup(): void {
    if (import.meta.env.DEV && window.__GGC_SCENE__ === this) window.__GGC_SCENE__ = undefined;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.shieldView?.dispose();
  }

  update(): void {
    const now = performance.now();
    const dt = now - this.lastNow;
    this.lastNow = now;
    const { controller, router, audio } = this.services;
    router.setMode(controller.phase === 'playing' && !controller.pause.paused ? 'combat' : 'menu');
    router.update(now);
    controller.frame(dt, router);
    audio.setGamePaused(controller.phase === 'playing' && controller.pause.paused);
    audio.setMusic(this.musicTheme());
    audio.update();
    this.renderFrame(dt);
  }

  private musicTheme(): MusicTheme {
    const c = this.services.controller;
    switch (c.phase) {
      case 'title': return 'title';
      case 'playing':
      case 'game-over':
      case 'reward': {
        const r = c.round;
        if (r && r.bossStage !== 'pending') return 'boss';
        return `round${c.roundIndex}` as MusicTheme;
      }
      case 'ending':
      case 'results': return 'ending';
      default: return null;
    }
  }

  private onGameEvent(e: GameEvent): void {
    const audio = this.services.audio;
    if (e.type === 'sfx') audio.playSfx(e.id);
    else if (e.type === 'fx') {
      this.spawnFx(e.fx, e.x, e.y, e.facing ?? 1, e.level ?? 0);
      if (e.fx === 'heal' && e.amount) this.spawnHealText(e.amount);
    }
    else if (e.type === 'bossPhase2') this.cameras.main.flash(250, 255, 80, 60);
    else if (e.type === 'hitstop') this.cameras.main.shake(60, 0.004);
    else if (e.type === 'playerDied') this.cameras.main.shake(200, 0.006);
  }

  /** '체력 +N' rising over the hero's head; follows the hero, fades out. */
  private spawnHealText(amount: number): void {
    const r = this.services.controller.round;
    let item = this.healTexts.find((h) => !h.active);
    if (!item) {
      const text = this.add.text(0, 0, '', { fontFamily: '"Gowun Batang", "Noto Sans KR", "Malgun Gothic", serif', fontSize: '10px', fontStyle: 'bold', color: '#8dff8d', stroke: '#06210a', strokeThickness: 3 })
        .setOrigin(0.5, 1).setDepth(27).setResolution(4);
      item = { text, start: 0, active: false };
      this.healTexts.push(item);
    }
    item.active = true;
    item.start = r ? r.presentationT : 0;
    item.text.setText(`체력 +${amount}`).setVisible(true).setAlpha(1);
  }

  private spawnFx(kind: string, x: number, y: number, facing: 1 | -1, level: number): void {
    let frames: string[];
    let dur = 220;
    let tint: number | undefined;
    switch (kind) {
      case 'hit': frames = FX_FRAMES.hit; tint = level ? 0xffd080 : undefined; break;
      case 'guard': frames = FX_FRAMES.hit; tint = 0x9a9a9a; dur = 160; break;
      case 'parry': frames = FX_FRAMES.parry; dur = 260; break;
      case 'dash': frames = FX_FRAMES.dash; dur = 300; break;
      case 'charge': frames = [FX_FRAMES.charge[Math.min(3, level)]]; dur = 260; break;
      case 'skill': frames = level ? FX_FRAMES.skillShield : FX_FRAMES.skillBuff; dur = 420; break;
      case 'spear': frames = FX_FRAMES.spear; dur = 300; break;
      case 'shieldBreak': frames = FX_FRAMES.parry; tint = 0x7fb0ff; dur = 300; break;
      // skill_07 is a blue-white rising glow: no multiply tint (it turned it a muddy yellow-green).
      case 'heal': frames = FX_FRAMES.heal; dur = 450; break;
      default: return;
    }
    let item = this.fx.find((f) => !f.active);
    if (!item) {
      item = { sprite: this.add.sprite(0, 0, ATLAS_KEY, frames[0]).setDepth(30), frames, start: 0, dur, active: false };
      this.fx.push(item);
    }
    const r = this.services.controller.round;
    item.active = true;
    item.frames = frames;
    item.dur = dur;
    item.start = r ? r.presentationT : 0;
    item.sprite.setVisible(true).setFrame(frames[0]).setFlipX(facing < 0).setOrigin(0.5, 0.5).setAlpha(1);
    if (kind === 'dash' || kind === 'charge' || kind === 'skill' || kind === 'heal') item.sprite.setOrigin(0.5, 0.89);
    item.follow = kind === 'heal';
    item.sprite.setBlendMode(kind === 'heal' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    item.sprite.setPosition(x, y);
    if (tint !== undefined) item.sprite.setTint(tint); else item.sprite.clearTint();
  }

  // ---------------- rendering ----------------
  private renderFrame(dt: number): void {
    const c = this.services.controller;
    const r = c.round;
    const showWorld = r && (c.phase === 'playing' || c.phase === 'game-over' || c.phase === 'reward');
    if (showWorld && r) {
      if (this.renderedRound !== r) this.rebuildWorld(r);
      this.renderWorld(r, dt);
    } else {
      this.renderBackdrop(c.phase === 'ending' || c.phase === 'results' ? 3 : 1, dt);
    }
  }

  /** Rounds 1/2 use the supplied illustrations (same 1672×941 layout and crop); round 3 still uses generated parallax layers. */
  private setTheme(round: number): void {
    if (this.roundTheme === round) return;
    this.roundTheme = round;
    const bgKey = ROUND_BG_KEYS[round];
    const real = bgKey !== undefined;
    this.bgImage.setVisible(real);
    if (bgKey) this.bgImage.setTexture(bgKey).setCrop(0, 0, 1672, BG_CROP_H);
    this.ground.setTexture(groundStripKey(round));
    for (const l of [this.sky, this.far, this.mid, this.near]) l.setVisible(!real);
    if (!real) {
      this.sky.setTexture(`generated_bg_r${round}_sky`);
      this.far.setTexture(`generated_bg_r${round}_far`);
      this.mid.setTexture(`generated_bg_r${round}_mid`);
      this.near.setTexture(`generated_bg_r${round}_near`);
    }
  }

  private clearEntities(): void {
    for (const v of this.enemySprites.values()) { v.s.destroy(); v.bar.destroy(); }
    this.enemySprites.clear();
    this.bossSprite?.destroy();
    this.bossSprite = null;
    this.bossFlashUntil = 0;
    for (const s of this.solidSprites.values()) s.destroy();
    this.solidSprites.clear();
    for (const s of this.pickupSprites.values()) s.destroy();
    this.pickupSprites.clear();
    for (const d of this.decor) d.destroy();
    this.decor = [];
    for (const f of this.fx) { f.active = false; f.sprite.setVisible(false); }
    for (const h of this.healTexts) { h.active = false; h.text.setVisible(false); }
    this.shieldView.clear();
  }

  private rebuildWorld(r: RoundSim): void {
    this.clearEntities();
    this.renderedRound = r;
    this.setTheme(r.roundIndex);
    for (const s of r.solids) this.solidSprites.set(s.id, makeSolidImage(this, s, r.roundIndex));
    this.decor = makeDecor(this, r.roundIndex, r.groundY);
    this.worldW = r.spec.worldWidth;
    this.camX = r.cameraX;
  }

  private worldW = VIEW_W * 5;

  private parallax(camX: number): void {
    this.cameras.main.setScroll(Math.round(camX), 0);
    const k = Math.max(0, Math.min(1, camX / Math.max(1, this.worldW - VIEW_W)));
    this.bgImage.x = -Math.round(k * (BG_DISPLAY_W - VIEW_W));
    this.far.tilePositionX = Math.round(camX * 0.2);
    this.mid.tilePositionX = Math.round(camX * 0.45);
    this.near.tilePositionX = Math.round(camX * 0.8);
    this.ground.tilePositionX = Math.round(camX);
  }

  private renderBackdrop(theme: number, dt: number): void {
    if (this.renderedRound) {
      this.clearEntities();
      this.renderedRound = null;
    }
    this.setTheme(theme);
    this.worldW = VIEW_W * 5;
    this.camX = (this.camX + dt * 0.02) % (VIEW_W * 4);
    this.parallax(this.camX);
    const t = performance.now();
    const p = this.player.setVisible(true);
    // Left of the centred lobby menu (panel spans x≈207–433).
    p.setPosition(Math.round(this.camX + 110), 304).setFlipX(false).setAlpha(1).clearTint();
    p.setFrame(`ganggamchan_idle_0${1 + (Math.floor(t / 166) % 4)}`);
    this.shadow.setPosition(p.x, 305).setScale(1).setAlpha(1);
    for (const o of [this.buffAura, this.chargeAura, this.chargeGauge, this.bossGlow]) o.setVisible(false);
    this.shieldView.clear();
    this.walls.clear();
    this.debugGfx?.clear();
    for (const a of this.pools.arrows) a.setVisible(false);
    this.spawnMarks.clear();
    for (const a of this.pools.allies) a.setVisible(false);
  }

  private renderWorld(r: RoundSim, dt: number): void {
    const t = r.t;
    // camera: smooth toward the simulation camera (visual only)
    const target = r.cameraX;
    if (Math.abs(target - this.camX) > 400) this.camX = target;
    else this.camX += (target - this.camX) * Math.min(1, dt * 0.012);
    this.parallax(this.camX);

    // player
    const pl = r.player;
    const pf = playerFrame(pl, t);
    const ps = this.player.setVisible(true);
    ps.setFrame(pf.frame).setPosition(Math.round(pl.body.x), Math.round(pl.body.y)).setFlipX(pl.facing < 0);
    if (pf.tint !== undefined) ps.setTint(pf.tint); else ps.clearTint();
    const blinking = pl.alive && t < pl.invulnUntil && Math.floor(t / 60) % 2 === 0;
    ps.setAlpha(blinking ? 0.35 : 1);
    const surfaceY = shadowSurfaceY(r.solids, pl.body.x, pl.body.y, r.groundY);
    const k = shadowScale(surfaceY - pl.body.y);
    this.shadow.setPosition(Math.round(pl.body.x), surfaceY + 1).setScale(k).setAlpha(0.35 + 0.65 * k);

    this.buffAura.setVisible(pl.commandBuffActive).setPosition(pl.body.x, pl.body.y).setAlpha(0.35 + 0.2 * Math.sin(t / 120));
    const charging = pl.mode === 'charge';
    this.chargeAura.setVisible(charging && pl.chargeStage > 0);
    if (charging && pl.chargeStage > 0) this.chargeAura.setFrame(FX_FRAMES.charge[Math.min(3, pl.chargeStage)]).setPosition(pl.body.x, pl.body.y);
    this.chargeGauge.setVisible(charging);
    if (charging) drawChargeGauge(this.chargeGauge, Math.round(pl.body.x), Math.round(pl.body.y), t - pl.chargeStart, r.presentationT);
    // Feet = physics body bottom (body.y); hidden at once on break / death / round end.
    this.shieldView.render(shieldSnapshotOf(pl, !r.outcome), { x: pl.body.x, footY: pl.body.y, depth: this.player.depth });

    // solids
    for (const s of r.solids) {
      const img = this.solidSprites.get(s.id);
      if (!img) continue;
      img.setVisible(s.alive);
      if (s.destructible && s.alive) img.setAlpha(0.6 + 0.4 * (s.hp / s.maxHp));
    }

    // enemies
    const seen = new Set<string>();
    for (const e of r.enemies) {
      seen.add(e.id);
      this.renderEnemy(e, t);
    }
    for (const [id, v] of this.enemySprites) {
      if (!seen.has(id)) { v.s.destroy(); v.bar.destroy(); this.enemySprites.delete(id); }
    }

    // boss
    this.renderBoss(r.boss, r, t);

    // projectiles
    this.syncPool(this.pools.arrows, r.projectiles.length, () => this.add.image(0, 0, ARROW_KEYS[0]).setScale(ARCHER_SCALE).setDepth(25));
    r.projectiles.forEach((p, i) => {
      const a = arrowPlacement(p);
      const img = this.pools.arrows[i];
      const key = arrowTextureFor(p);
      if (img.texture.key !== key) img.setTexture(key);
      img.setOrigin(a.originX, a.originY).setFlipX(a.flipX).setPosition(Math.round(a.x), Math.round(a.y));
    });

    // pickups
    const pseen = new Set<string>();
    for (const it of r.pickups) {
      pseen.add(it.id);
      let img = this.pickupSprites.get(it.id);
      if (!img) {
        img = this.add.image(it.x, it.y, 'generated_pickups', it.kind).setOrigin(0.5, 1).setDepth(8);
        this.pickupSprites.set(it.id, img);
      }
      img.setPosition(it.x, it.y - 2 + Math.round(Math.sin(r.presentationT / 200) * 2));
    }
    for (const [id, img] of this.pickupSprites) if (!pseen.has(id)) { img.destroy(); this.pickupSprites.delete(id); }

    // spawn warnings: only at the planned spawn points the sim will actually use
    this.spawnMarks.clear();
    for (const w of r.spawnWarnings) drawSpawnWarning(this.spawnMarks, w.x, r.groundY, spawnWarningProgress(w.start, w.until, r.t), r.presentationT);

    // ally spear soldiers (visual only)
    // 창병 공격: damage was already applied by the domain at the command instant; this only plays the art.
    this.syncPool(this.pools.allies, r.allyVisuals.length, () => this.add.sprite(0, 0, ALLY_SPEAR_KEY, 'goryeo_spearman_strike_03.png').setDepth(22));
    r.allyVisuals.forEach((a, i) => {
      const pose = allySpearPose(a, t, DEFAULTS.skills.spearVisualMs);
      this.pools.allies[i].setFrame(pose.frame).setScale(pose.scale).setOrigin(pose.originX, pose.originY).setFlipX(pose.flipX).setPosition(Math.round(a.x), Math.round(a.y));
    });

    // arena walls (the open exit is announced by the HUD text only)
    this.walls.clear();
    if (r.lockedBounds) {
      this.walls.fillStyle(0xc8402a, 0.35);
      this.walls.fillRect(r.lockedBounds.minX, 0, 4, 304);
      this.walls.fillRect(r.lockedBounds.maxX - 4, 0, 4, 304);
    }

    // effects
    for (const f of this.fx) {
      if (!f.active) continue;
      const age = r.presentationT - f.start;
      if (age >= f.dur || age < 0) { f.active = false; f.sprite.setVisible(false); continue; }
      f.sprite.setFrame(f.frames[Math.min(f.frames.length - 1, Math.floor((age / f.dur) * f.frames.length))]);
      f.sprite.setAlpha(1 - age / f.dur * 0.5);
      if (f.follow) f.sprite.setPosition(this.player.x, this.player.y);
    }
    for (const h of this.healTexts) {
      if (!h.active) continue;
      const age = r.presentationT - h.start;
      if (age >= HEAL_TEXT_MS || age < 0) { h.active = false; h.text.setVisible(false); continue; }
      const k = age / HEAL_TEXT_MS;
      h.text.setPosition(Math.round(this.player.x), Math.round(this.player.y - 100 - 16 * k)).setAlpha(k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
    }

    if (this.debugGfx) this.drawDebug(r);
  }

  private syncPool<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(pool: T[], n: number, make: () => T): void {
    while (pool.length < n) pool.push(make());
    pool.forEach((o, i) => o.setVisible(i < n));
  }

  private renderEnemy(e: Enemy, t: number): void {
    let v = this.enemySprites.get(e.id);
    if (!v) {
      // Shieldman: the package view (192×192, feet 96,160, SHIELDMAN_SCALE) owns its sprite; we keep tint/fade/HP bar.
      const shieldView = e.kind === 'shieldman' ? new PhaserShieldEnemyView(this, e.body.x, e.body.y, SHIELDMAN_SCALE) : undefined;
      // Cavalry: package view (320×224, feet 160,192, scale 1, flipX for left) on the existing cavalry AI.
      const cavalryView = e.kind === 'cavalry' ? new PhaserCavalryView(this, 12) : undefined;
      const s = shieldView
        ? (shieldView.sprite as unknown as Phaser.GameObjects.Sprite).setDepth(12)
        : cavalryView
        ? (cavalryView.sprite as unknown as Phaser.GameObjects.Sprite)
        : e.kind === 'infantry'
        ? this.add.sprite(e.body.x, e.body.y, INFANTRY_KEY, 'khitan_infantry_idle_01.png').setDepth(12)
        : e.kind === 'spearman'
        ? this.add.sprite(e.body.x, e.body.y, SPEARMAN_KEY, 'khitan_spearman_idle_01.png').setDepth(12)
        : this.add.sprite(e.body.x, e.body.y, ARCHER_KEY, 'khitan_archer_idle_01.png').setOrigin(ARCHER_ORIGIN.x, ARCHER_ORIGIN.y).setScale(ARCHER_SCALE).setDepth(12);
      const bar = this.add.graphics().setDepth(13);
      v = { s, bar, barState: newEnemyBarState(e.hp, t), lastHp: e.hp, flashUntil: 0, shieldView, cavalryView };
      this.enemySprites.set(e.id, v);
    }
    if (e.hp < v.lastHp) v.flashUntil = t + 80;
    v.lastHp = e.hp;
    const hidden = e.state === 'relocating';
    if (e.kind === 'infantry') {
      const pat = ENEMY_PATTERNS.infantry;
      const pose = infantryPose(e, t, pat.startupMs, pat.activeMs ?? 100);
      v.s.setFrame(pose.frame).setScale(pose.scale).setOrigin(0.5, pose.originY);
    } else if (e.kind === 'spearman') {
      const pat = ENEMY_PATTERNS.spearman;
      const pose = spearmanPose(e, t, pat.startupMs, pat.activeMs ?? 140);
      v.s.setFrame(pose.frame).setScale(pose.scale).setOrigin(pose.originX, pose.originY);
    } else if (v.shieldView) {
      v.shieldView.sync(shieldmanSnapshot(e, t));
    } else if (v.cavalryView) {
      v.cavalryView.sync(cavalrySnapshot(e, t));
    } else {
      v.s.setFrame(archerFrame(e, t, ENEMY_PATTERNS.archer.startupMs));
    }
    v.s.setVisible(!hidden).setPosition(Math.round(e.body.x), Math.round(e.body.y)).setFlipX(e.facing < 0);
    if (t < v.flashUntil) v.s.setTintFill(0xffffff);
    else v.s.clearTint();
    let alpha = 1;
    if (e.state === 'dead') alpha = Math.max(0, 1 - (t - e.deadAt) / 900);
    else if (t < e.graceUntil) alpha = 0.55 + 0.45 * Math.min(1, 1 - (e.graceUntil - t) / 650);
    v.s.setAlpha(alpha);
    stepEnemyBar(v.barState, e.hp, e.maxHp, t);
    const showBar = e.alive && !hidden && e.hp < e.maxHp;
    v.bar.setVisible(showBar);
    const barY = e.kind === 'cavalry' ? e.body.y - CAVALRY_ART_HEIGHT - 4 : e.body.y - e.body.h - 10;
    if (showBar) drawEnemyBar(v.bar, e.body.x, barY, e.hp, e.maxHp, v.barState);
  }

  private renderBoss(b: Boss | null, r: RoundSim, t: number): void {
    if (!b || r.bossStage === 'pending') {
      this.bossSprite?.setVisible(false);
      this.bossGlow.setVisible(false);
      return;
    }
    const real = b.bossId === 'vanguard';
    const captain = b.bossId === 'spear_captain';
    const texKey = real ? VANGUARD_KEY : captain ? SPEAR_CAPTAIN_KEY : `generated_boss_${b.bossId}`;
    if (!this.bossSprite || this.bossSprite.texture.key !== texKey) {
      this.bossSprite?.destroy();
      this.bossSprite = real
        ? this.add.sprite(b.body.x, b.body.y, VANGUARD_KEY, 'idle_01').setOrigin(VANGUARD_ORIGIN.x, VANGUARD_ORIGIN.y).setDepth(14)
        : captain
        ? this.add.sprite(b.body.x, b.body.y, SPEAR_CAPTAIN_KEY, 'idle_01').setOrigin(SPEAR_CAPTAIN_ORIGIN.x, SPEAR_CAPTAIN_ORIGIN.y).setDepth(14)
        : this.add.sprite(b.body.x, b.body.y, texKey, 'idle').setOrigin(0.5, BOSS_FRAME_INFO.footY / BOSS_FRAME_INFO.h).setDepth(14);
      this.bossLastHp = b.hp;
      // presentationT restarts every round: a flash deadline left over from the previous boss would keep the
      // new boss white until the new round caught up with it.
      this.bossFlashUntil = 0;
    }
    if (b.hp < this.bossLastHp) this.bossFlashUntil = r.presentationT + 70;
    this.bossLastHp = b.hp;
    let frame: string;
    const view = { t, transitionProgress: r.freeze?.kind === 'transition' ? 1 - r.freeze.remaining / DEFAULTS.boss.phaseTransitionMs : 0, deadMs: r.outcome === 'victory' ? r.outcomeElapsed : 0 };
    if (real) {
      frame = vanguardFrame(b, view);
    } else if (captain) {
      // Native scale 1, fixed feet anchor (160,176): no per-frame resizing or bbox cropping.
      frame = spearCaptainFrame(b, view);
    } else {
      let pose: Pose = 'idle';
      switch (b.state) {
        case 'move': pose = Math.floor(t / 180) % 2 ? 'walkA' : 'walkB'; break;
        case 'windup': pose = 'windup'; break;
        case 'hits': pose = 'attack'; break;
        case 'recover': pose = t - b.stateT < 220 ? 'attack' : 'idle'; break;
        case 'stunned': pose = 'hurt'; break;
        case 'transition': pose = 'hurt'; break;
        case 'dead': pose = 'dead'; break;
        default: pose = 'idle';
      }
      frame = pose;
    }
    const s = this.bossSprite.setVisible(true).setFrame(frame).setPosition(Math.round(b.body.x), Math.round(b.body.y)).setFlipX(b.facing < 0);
    s.setAlpha(r.bossStage === 'intro' ? Math.min(1, 0.3 + r.presentationT % 1000 / 1000) : 1);
    const red = b.redTelegraph;
    if (r.presentationT < this.bossFlashUntil) s.setTintFill(0xffffff);
    else if (red) s.setTint(Math.floor(r.presentationT / 90) % 2 ? 0xff3030 : 0xff8080);
    // The V2 transition frames already carry their red aura: no extra flashing tint on top.
    else if (b.state === 'transition' && !real && !captain) s.setTint(Math.floor(r.presentationT / 70) % 2 ? 0xffffff : 0xffb0a0);
    else s.clearTint();
    this.bossGlow.setVisible(red).setPosition(b.body.x, b.body.y - 2).setAlpha(0.3 + 0.3 * Math.abs(Math.sin(r.presentationT / 80)));
  }

  private drawDebug(r: RoundSim): void {
    const g = this.debugGfx!;
    g.clear();
    g.lineStyle(1, 0x00ff00, 1);
    const pb = r.player.box;
    g.strokeRect(pb.x, pb.y, pb.w, pb.h);
    const pa = r.player.activeAttackBox(r.t);
    if (pa) { g.lineStyle(1, 0xffff00, 1); g.strokeRect(pa.box.x, pa.box.y, pa.box.w, pa.box.h); }
    for (const e of r.enemies) {
      g.lineStyle(1, 0xff8800, 1);
      const b = e.box;
      g.strokeRect(b.x, b.y, b.w, b.h);
      const a = e.activeAttack();
      if (a) { g.lineStyle(1, 0xff0000, 1); g.strokeRect(a.box.x, a.box.y, a.box.w, a.box.h); }
    }
    if (r.boss) {
      const b = r.boss.box;
      g.lineStyle(1, 0xff00ff, 1);
      g.strokeRect(b.x, b.y, b.w, b.h);
      const a = r.boss.activeAttack(r.t);
      if (a) { g.lineStyle(2, 0xff0000, 1); g.strokeRect(a.box.x, a.box.y, a.box.w, a.box.h); }
    }
  }
}
