// Game flow controller: owns the in-memory session (no persistence) and drives RoundSim on the fixed step.
import { LOCKED, SIM_STEP_MS, STORY, type UpgradeId } from '../config/spec';
import { FixedStepper, PauseReasons, type PauseReason } from './clock';
import type { GameEvent } from './events';
import { makeRng } from './geometry';
import type { CombatInput } from './player';
import { StatsRecorder, type Stats } from './records';
import { RoundSim, type HudSnapshot } from './round';
import { applyUpgrade, canChooseUpgrade, emptyUpgrades, type UpgradeStacks } from './upgrades';

export type AppPhase = 'boot' | 'loading' | 'load-error' | 'title' | 'playing' | 'game-over' | 'reward' | 'ending' | 'results';

export interface CombatInputSource {
  /** Pressed/released edges are only delivered on the first simulation step of a frame. */
  takeCombatInput(firstStep: boolean): CombatInput;
}

export interface ControllerState {
  phase: AppPhase;
  paused: boolean;
  pauseReasons: PauseReason[];
  round: number;
  attempt: number;
  upgrades: UpgradeStacks;
  stats: Stats;
  endingIndex: number;
  loadProgress: number;
  loadErrorFiles: string[];
  runtimeError: string | null;
  integrityWarnings: string[];
  pauseNote: string | null;
}

export const ROUND_COUNT = LOCKED.game.roundCount;
export const ENDING_SCENES = STORY.ending.length;

export class GameController {
  phase: AppPhase = 'boot';
  upgrades: UpgradeStacks = emptyUpgrades();
  readonly recorder = new StatsRecorder();
  roundIndex = 1;
  attempt = 0;
  round: RoundSim | null = null;
  readonly pause = new PauseReasons();
  private readonly stepper = new FixedStepper();
  endingIndex = 0;
  loadProgress = 0;
  loadErrorFiles: string[] = [];
  runtimeError: string | null = null;
  pauseNote: string | null = null;
  private rng: () => number;
  private stateListeners = new Set<(s: ControllerState) => void>();
  private eventListeners = new Set<(e: GameEvent) => void>();
  private hudListeners = new Set<(h: HudSnapshot | null) => void>();
  private hudAccum = 0;
  /** Frames right after a round start/resume may be long (texture upload, layout); they are dropped without pausing. */
  private stallGraceFrames = 0;
  private static readonly STALL_GRACE_FRAMES = 30;
  private readonly hudIntervalMs = 1000 / 10;

  constructor(seed = Math.floor(Math.random() * 2 ** 31)) {
    this.rng = makeRng(seed);
  }

  // ---- subscriptions ----
  subscribe(fn: (s: ControllerState) => void): () => void {
    this.stateListeners.add(fn);
    fn(this.snapshot());
    return () => this.stateListeners.delete(fn);
  }
  onEvent(fn: (e: GameEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }
  onHud(fn: (h: HudSnapshot | null) => void): () => void {
    this.hudListeners.add(fn);
    fn(this.round ? this.round.hud() : null);
    return () => this.hudListeners.delete(fn);
  }

  snapshot(): ControllerState {
    return {
      phase: this.phase,
      paused: this.pause.paused,
      pauseReasons: this.pause.list(),
      round: this.roundIndex,
      attempt: this.attempt,
      upgrades: { ...this.upgrades },
      stats: { ...this.recorder.stats },
      endingIndex: this.endingIndex,
      loadProgress: this.loadProgress,
      loadErrorFiles: [...this.loadErrorFiles],
      runtimeError: this.runtimeError,
      integrityWarnings: [...this.recorder.integrityWarnings],
      pauseNote: this.pauseNote,
    };
  }

  private notify(): void {
    const s = this.snapshot();
    for (const fn of this.stateListeners) fn(s);
  }

  private pushHud(): void {
    const h = this.round ? this.round.hud() : null;
    for (const fn of this.hudListeners) fn(h);
  }

  private setPhase(p: AppPhase): void {
    this.phase = p;
    this.notify();
    this.pushHud();
  }

  // ---- loading ----
  setLoading(progress: number): void {
    this.loadProgress = progress;
    if (this.phase === 'boot' || this.phase === 'load-error') this.phase = 'loading';
    this.notify();
  }
  setLoadError(files: string[]): void {
    this.loadErrorFiles = files;
    this.setPhase('load-error');
  }
  setLoaded(): void {
    this.loadErrorFiles = [];
    this.loadProgress = 1;
    this.setPhase('title');
  }

  // ---- commands from the UI ----
  startGame(): void {
    if (this.phase !== 'title') return;
    this.resetSession();
    this.beginRound();
    // The opening story, then the control guide, hold round 1 at its first frame (retries and later rounds never
    // show them).
    this.pause.add('story');
    this.pause.add('tutorial');
    this.notify();
  }

  /** Story finished or skipped: the control guide follows (round 1 stays held). */
  finishStory(): void {
    if (this.phase !== 'playing' || !this.pause.has('story')) return;
    this.pause.remove('story');
    this.notify();
  }

  /** Guide finished or skipped: round 1 starts from where it was held. */
  finishTutorial(): void {
    if (this.phase !== 'playing' || !this.pause.has('tutorial') || this.pause.has('story')) return;
    this.pause.remove('tutorial');
    this.stepper.reset();
    this.stallGraceFrames = GameController.STALL_GRACE_FRAMES;
    this.notify();
  }

  retryRound(): void {
    if (this.phase !== 'game-over' && !this.runtimeError) return;
    this.runtimeError = null;
    this.beginRound();
  }

  chooseUpgrade(id: UpgradeId): void {
    if (this.phase !== 'reward' || !canChooseUpgrade(this.upgrades)) return;
    this.upgrades = applyUpgrade(this.upgrades, id);
    this.roundIndex += 1;
    this.beginRound();
  }

  pauseManual(): void {
    if (this.phase !== 'playing' || this.pause.has('tutorial')) return;
    this.pause.add('manual');
    this.notify();
  }

  /** Resume only removes the manual reason; other active reasons keep the game paused. */
  resume(): void {
    if (this.phase !== 'playing') return;
    if (this.runtimeError) return;
    this.pause.remove('manual');
    if (!this.pause.paused) this.pauseNote = null;
    this.stepper.reset();
    this.stallGraceFrames = GameController.STALL_GRACE_FRAMES;
    this.notify();
  }

  /** Automatic reasons also require an explicit "continue" afterwards. */
  addAutoPause(reason: PauseReason, note?: string): void {
    if (this.phase !== 'playing') return;
    this.pause.add(reason);
    if (reason !== 'pad-disconnected') this.pause.add('manual');
    if (note) this.pauseNote = note;
    this.notify();
  }

  clearAutoPause(reason: PauseReason): void {
    if (!this.pause.has(reason)) return;
    this.pause.remove(reason);
    this.stepper.reset();
    this.stallGraceFrames = GameController.STALL_GRACE_FRAMES;
    this.notify();
  }

  returnToMenu(): void {
    this.resetSession();
    this.round = null;
    this.setPhase('title');
  }

  advanceEnding(): void {
    if (this.phase !== 'ending') return;
    this.endingIndex += 1;
    if (this.endingIndex >= ENDING_SCENES) this.setPhase('results');
    else this.notify();
  }

  finishResults(): void {
    if (this.phase !== 'results') return;
    this.returnToMenu();
  }

  // ---- DEV-only shortcuts (src/debug/DevPanel, dev server only; the shipped UI never calls these) ----
  debugInvincible = false;

  /** Jump straight to the start of round n, keeping the current upgrades and stats. */
  debugStartRound(n: number): void {
    if (n < 1 || n > 3) return;
    this.runtimeError = null;
    this.endingIndex = 0;
    this.roundIndex = n;
    this.beginRound();
  }

  debugShowEnding(): void {
    this.round = null;
    this.pause.clear();
    this.endingIndex = 0;
    this.setPhase('ending');
  }

  debugShowResults(): void {
    this.round = null;
    this.pause.clear();
    this.setPhase('results');
  }

  /** Upgrades apply from the next round start (the running round keeps the stacks it was built with). */
  debugSetUpgrades(u: UpgradeStacks): void {
    this.upgrades = { ...u };
    this.notify();
  }

  debugSetInvincible(on: boolean): void {
    this.debugInvincible = on;
    if (this.round) this.round.player.debugInvincible = on;
    this.notify();
  }

  private resetSession(): void {
    this.upgrades = emptyUpgrades();
    this.recorder.reset();
    this.roundIndex = 1;
    this.endingIndex = 0;
    this.pause.clear();
    this.runtimeError = null;
    this.pauseNote = null;
  }

  private beginRound(): void {
    this.attempt += 1;
    this.round = new RoundSim(this.roundIndex, this.attempt, this.upgrades, this.recorder, this.rng);
    this.round.player.debugInvincible = this.debugInvincible;
    this.pause.clear();
    this.pauseNote = null;
    this.stepper.reset();
    this.stallGraceFrames = GameController.STALL_GRACE_FRAMES;
    this.setPhase('playing');
  }

  // ---- per render frame ----
  frame(realDeltaMs: number, input: CombatInputSource): void {
    if (this.phase !== 'playing' || !this.round) return;
    if (this.pause.paused) {
      this.stepper.reset();
      return;
    }
    const { steps, stalled } = this.stepper.advance(realDeltaMs);
    const inGrace = this.stallGraceFrames > 0;
    if (inGrace) this.stallGraceFrames -= 1;
    if (stalled && inGrace) return; // time discarded, never replayed
    if (stalled) {
      this.addAutoPause('stall', '화면 갱신이 오래 멈춰 안전하게 일시정지했습니다.');
      this.pause.remove('stall');
      this.notify();
      return;
    }
    const round = this.round;
    let hudDirty = false;
    for (let i = 0; i < steps; i++) {
      try {
        round.step(SIM_STEP_MS, input.takeCombatInput(i === 0));
      } catch (err) {
        console.error(err);
        this.runtimeError = err instanceof Error ? err.message : String(err);
        this.pause.add('runtime-error');
        this.notify();
        return;
      }
      if (round.outcome !== 'victory') this.recorder.addPlayTime(SIM_STEP_MS);
      for (const e of round.drainEvents()) {
        if (e.type === 'hud') hudDirty = true;
        for (const fn of this.eventListeners) fn(e);
      }
      if (round.finished) {
        this.finishRound(round);
        return;
      }
    }
    this.hudAccum += realDeltaMs;
    if (hudDirty || this.hudAccum >= this.hudIntervalMs) {
      this.hudAccum = 0;
      this.pushHud();
    }
  }

  private finishRound(round: RoundSim): void {
    if (round.outcome === 'victory') {
      if (this.roundIndex < ROUND_COUNT) this.setPhase('reward');
      else {
        this.endingIndex = 0;
        this.setPhase('ending');
      }
    } else {
      this.setPhase('game-over');
    }
  }
}
