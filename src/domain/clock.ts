// Central time management: pause reasons, fixed-step accumulator and the separate clocks.
import { DEFAULTS, SIM_STEP_MS } from '../config/spec';

export type PauseReason =
  | 'manual'
  | 'hidden'
  | 'pad-disconnected'
  | 'focus-lost'
  | 'viewport-small'
  | 'runtime-error'
  | 'stall'
  /** Control guide shown once after 시작하기 (title → new game), before round 1 runs. */
  | 'tutorial';

export class PauseReasons {
  private reasons = new Set<PauseReason>();
  add(r: PauseReason): void { this.reasons.add(r); }
  remove(r: PauseReason): void { this.reasons.delete(r); }
  has(r: PauseReason): boolean { return this.reasons.has(r); }
  clear(): void { this.reasons.clear(); }
  get paused(): boolean { return this.reasons.size > 0; }
  list(): PauseReason[] { return [...this.reasons]; }
}

/**
 * Fixed 1/60s stepper. Real frame deltas go in; whole simulation steps come out.
 * Long gaps (>= performancePauseDeltaMs) are dropped instead of being replayed.
 */
export class FixedStepper {
  private acc = 0;
  readonly stepMs = SIM_STEP_MS;
  readonly maxSteps = DEFAULTS.time.maxCatchupSteps;
  readonly stallMs = DEFAULTS.time.performancePauseDeltaMs;

  /** Returns number of steps to run; `stalled` true when the delta was discarded. */
  advance(realDeltaMs: number): { steps: number; stalled: boolean } {
    if (!(realDeltaMs > 0)) return { steps: 0, stalled: false };
    if (realDeltaMs >= this.stallMs) {
      this.acc = 0;
      return { steps: 0, stalled: true };
    }
    this.acc += realDeltaMs;
    let steps = Math.floor(this.acc / this.stepMs + 1e-9);
    if (steps > this.maxSteps) {
      steps = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc -= steps * this.stepMs;
      if (this.acc < 0) this.acc = 0;
    }
    return { steps, stalled: false };
  }

  reset(): void { this.acc = 0; }
}
