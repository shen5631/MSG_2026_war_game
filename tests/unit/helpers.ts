import type { EnemyKind } from '../../src/config/spec';
import { Enemy } from '../../src/domain/enemies';
import type { CombatAction, CombatInput } from '../../src/domain/player';
import { StatsRecorder } from '../../src/domain/records';
import { RoundSim } from '../../src/domain/round';
import { emptyUpgrades, type UpgradeStacks } from '../../src/domain/upgrades';

/** Drives a RoundSim in 1ms steps with explicit press/release timing. */
export class Driver {
  held: Partial<Record<CombatAction, boolean>> = {};
  moveX = 0;
  private pressed: CombatAction[] = [];
  private released: CombatAction[] = [];

  constructor(public sim: RoundSim) {}

  get t(): number { return this.sim.t; }
  get player() { return this.sim.player; }

  press(...a: CombatAction[]): this {
    for (const x of a) { this.held[x] = true; this.pressed.push(x); }
    return this;
  }
  release(...a: CombatAction[]): this {
    for (const x of a) { this.held[x] = false; this.released.push(x); }
    return this;
  }
  /** Advance `ms` milliseconds, delivering queued edges on the first step. */
  run(ms: number, dt = 1): this {
    const n = Math.round(ms / dt);
    for (let i = 0; i < n; i++) {
      const input: CombatInput = { moveX: this.moveX, held: { ...this.held }, pressed: this.pressed, released: this.released };
      this.pressed = [];
      this.released = [];
      this.sim.step(dt, input);
    }
    return this;
  }
}

export function makeSim(round = 1, upgrades: UpgradeStacks = emptyUpgrades(), rngValue = 0.5) {
  const recorder = new StatsRecorder();
  const sim = new RoundSim(round, 1, upgrades, recorder, () => rngValue);
  return { sim, recorder, driver: new Driver(sim) };
}

/** Adds a passive (AI disabled) enemy at x. */
export function addDummy(sim: RoundSim, kind: EnemyKind, x: number, facing: 1 | -1 = -1): Enemy {
  const e = new Enemy(`dummy-${sim.enemies.length}`, 100 + sim.enemies.length, kind, x, sim.groundY, sim.t - 10000, { minX: 0, maxX: sim.spec.worldWidth }, false, 'test');
  e.facing = facing;
  e.update = () => {};
  sim.enemies.push(e);
  return e;
}
