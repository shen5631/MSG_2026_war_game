// Round-1 boss (거란군 선봉대장) combat effects — V2 (round1_vanguard_boss_fx_clean_v2). Display only: no damage,
// hitbox or timer. Effects are spawned from the EXISTING boss state (pattern clock, parry stun, phase transition) and
// their frames follow sim time, so they freeze with pause and parry hitstop. The package's playVanguardBossFx (Phaser
// animation clock) is not used for that reason; only its frame/fps/origin table.
import Phaser from 'phaser';
import type { Boss } from '../../domain/boss';
import { DEFINITIONS, VANGUARD_FX_ATLAS_KEY, type VanguardFxKind } from '../bosses/vanguard/PhaserVanguardBossFx';

export const VANGUARD_FX_KEY = VANGUARD_FX_ATLAS_KEY;
export const REQUIRED_VANGUARD_FX_FRAMES = (Object.keys(DEFINITIONS) as VanguardFxKind[]).flatMap((k) => [...DEFINITIONS[k].frames]);

/**
 * Display scale per effect so it matches the boss and the attack it decorates (frames are 384×256 with wide margins):
 * slash ≈ the 72 px sword reach, flame circle/explosion ≈ the 110 px red slam, pillar ≈ the boss height.
 */
export const VANGUARD_FX_SCALE: Record<VanguardFxKind, number> = {
  slash_arc: 0.55, dash_trail: 0.5, summon_pillar: 0.7, impact_burst: 0.45, ground_flame_circle: 0.45, ground_explosion: 0.5,
};

/** Frame index of a one-shot effect `ms` after it started, or -1 once it has finished. */
export function fxFrameIndex(kind: VanguardFxKind, ms: number): number {
  const d = DEFINITIONS[kind];
  const i = Math.floor((Math.max(0, ms) * d.fps) / 1000);
  return i < d.frames.length ? i : -1;
}

interface Shot { kind: VanguardFxKind; start: number; x: number; y: number; facing: 1 | -1 }
export interface FxFrame { kind: VanguardFxKind; frame: string; x: number; y: number; facing: 1 | -1 }

/** Pure planner: which effects are on screen for this boss now (also used by tests). */
export class VanguardFxPlanner {
  private shots: Shot[] = [];
  private spawned = new Set<string>();
  private lastStunAt = -1;

  reset(): void { this.shots = []; this.spawned.clear(); this.lastStunAt = -1; }

  /** `t` = sim time, `groundY` = feet line, `playerX` for the parry flash, `transitionProgress` 0..1. */
  update(b: Boss, t: number, groundY: number, playerX: number, transitionProgress: number): FxFrame[] {
    const out: FxFrame[] = [];
    // Boss gone: every active effect is removed at once.
    if (b.state === 'dead') { this.shots = []; return out; }
    const f = b.facing;
    const front = (reach: number) => b.body.x + f * (b.body.w / 2 + reach / 2);
    const p = b.pattern;
    if (p && (b.state === 'windup' || b.state === 'hits' || b.state === 'recover')) {
      const hits = p.hitCount ?? 1;
      for (let k = 0; k < hits; k++) {
        const at = b.patternStart + p.startupMs + k * (p.hitSpacingMs ?? 0);
        const key = `${b.patternStart}:${k}`;
        if (t < at || this.spawned.has(key)) continue;
        this.spawned.add(key);
        if (p.id === 'sword_cut' || p.id === 'triple_cut') this.shots.push({ kind: 'slash_arc', start: at, x: front(72), y: groundY - 40, facing: f });
        else if (p.id === 'rush') this.shots.push({ kind: 'dash_trail', start: at, x: b.body.x, y: groundY, facing: f });
        else if (p.id === 'red_slam') this.shots.push({ kind: 'ground_explosion', start: at, x: front(110), y: groundY, facing: f });
      }
      // Red slam warning: a looping flame circle where the slam lands, only while it winds up (no damage zone).
      if (p.id === 'red_slam' && b.state === 'windup') {
        const d = DEFINITIONS.ground_flame_circle;
        out.push({ kind: 'ground_flame_circle', frame: d.frames[Math.floor(((t - b.patternStart) * d.fps) / 1000) % d.frames.length], x: front(110), y: groundY, facing: f });
      }
    }
    // Parry success: one flash between the boss and the player when the parry stun starts.
    if (b.state === 'stunned' && b.stateT !== this.lastStunAt) {
      this.lastStunAt = b.stateT;
      this.shots.push({ kind: 'impact_burst', start: b.stateT, x: (b.body.x + playerX) / 2, y: groundY - 44, facing: f });
    }
    // Phase-2 transition: the red pillar plays across the transition freeze.
    if (b.state === 'transition') {
      // The transition freezes sim time: drop leftovers (e.g. a dash trail) instead of leaving them frozen beside it.
      this.shots = [];
      const d = DEFINITIONS.summon_pillar;
      out.push({ kind: 'summon_pillar', frame: d.frames[Math.min(d.frames.length - 1, Math.floor(transitionProgress * d.frames.length))], x: b.body.x, y: groundY, facing: f });
    }
    this.shots = this.shots.filter((s) => fxFrameIndex(s.kind, t - s.start) >= 0);
    for (const s of this.shots) out.push({ kind: s.kind, frame: DEFINITIONS[s.kind].frames[fxFrameIndex(s.kind, t - s.start)], x: s.x, y: s.y, facing: s.facing });
    return out;
  }
}

/** Phaser side: a small sprite pool drawing the planner's output. */
export class VanguardFxView {
  private pool: Phaser.GameObjects.Sprite[] = [];
  readonly planner = new VanguardFxPlanner();
  constructor(private scene: Phaser.Scene) {}

  draw(frames: FxFrame[]): void {
    while (this.pool.length < frames.length) this.pool.push(this.scene.add.sprite(0, 0, VANGUARD_FX_KEY, REQUIRED_VANGUARD_FX_FRAMES[0]).setDepth(16));
    this.pool.forEach((s, i) => {
      const fx = frames[i];
      if (!fx) { s.setVisible(false); return; }
      const d = DEFINITIONS[fx.kind];
      // The flame circle sits behind the boss's feet; everything else in front.
      s.setVisible(true).setFrame(fx.frame).setOrigin(d.origin.x, d.origin.y).setScale(VANGUARD_FX_SCALE[fx.kind])
        .setFlipX(fx.facing < 0).setPosition(Math.round(fx.x), Math.round(fx.y)).setDepth(fx.kind === 'ground_flame_circle' ? 13 : 16);
    });
  }

  clear(): void { this.planner.reset(); for (const s of this.pool) s.setVisible(false); }
}
