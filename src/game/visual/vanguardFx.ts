// Round-1 boss (거란군 선봉대장) combat effects — V2 (round1_vanguard_boss_fx_clean_v2). Display only: no damage,
// hitbox or timer. Only the phase-2 red slam uses them (user choice): a flame circle where it lands during the windup
// and a ground explosion on the hit. Frames follow sim time, so they freeze with pause and parry hitstop. The package's playVanguardBossFx (Phaser
// animation clock) is not used for that reason; only its frame/fps/origin table.
import Phaser from 'phaser';
import type { Boss } from '../../domain/boss';
import { DEFINITIONS, VANGUARD_FX_ATLAS_KEY, type VanguardFxKind } from '../bosses/vanguard/PhaserVanguardBossFx';

export const VANGUARD_FX_KEY = VANGUARD_FX_ATLAS_KEY;
export const REQUIRED_VANGUARD_FX_FRAMES = (Object.keys(DEFINITIONS) as VanguardFxKind[]).flatMap((k) => [...DEFINITIONS[k].frames]);

/** Effects in use. The atlas also holds slash_arc / dash_trail / summon_pillar / impact_burst (not shown). */
export type UsedFxKind = 'ground_flame_circle' | 'ground_explosion';
/** Display scale so the effect matches the 110 px red slam (frames are 384×256 with wide margins). */
export const VANGUARD_FX_SCALE: Record<UsedFxKind, number> = { ground_flame_circle: 0.45, ground_explosion: 0.5 };

/** Frame index of a one-shot effect `ms` after it started, or -1 once it has finished. */
export function fxFrameIndex(kind: VanguardFxKind, ms: number): number {
  const d = DEFINITIONS[kind];
  const i = Math.floor((Math.max(0, ms) * d.fps) / 1000);
  return i < d.frames.length ? i : -1;
}

interface Shot { kind: UsedFxKind; start: number; x: number; y: number; facing: 1 | -1 }
export interface FxFrame { kind: UsedFxKind; frame: string; x: number; y: number; facing: 1 | -1 }

/** Pure planner: which effects are on screen for this boss now (also used by tests). */
export class VanguardFxPlanner {
  private shots: Shot[] = [];
  private spawned = new Set<number>();

  reset(): void { this.shots = []; this.spawned.clear(); }

  /** `t` = sim time, `groundY` = feet line. */
  update(b: Boss, t: number, groundY: number): FxFrame[] {
    const out: FxFrame[] = [];
    // Boss gone or the phase-2 transition (sim time frozen): no leftovers.
    if (b.state === 'dead' || b.state === 'transition') { this.shots = []; return out; }
    const f = b.facing;
    const p = b.pattern;
    if (p?.id === 'red_slam' && (b.state === 'windup' || b.state === 'hits' || b.state === 'recover')) {
      const x = b.body.x + f * (b.body.w / 2 + 55); // centre of the 110 px slam hitbox
      // Warning: a looping flame circle where the slam lands, only while it winds up (no damage zone).
      if (b.state === 'windup') {
        const d = DEFINITIONS.ground_flame_circle;
        out.push({ kind: 'ground_flame_circle', frame: d.frames[Math.floor(((t - b.patternStart) * d.fps) / 1000) % d.frames.length], x, y: groundY, facing: f });
      }
      const at = b.patternStart + p.startupMs;
      if (t >= at && !this.spawned.has(b.patternStart)) {
        this.spawned.add(b.patternStart);
        this.shots.push({ kind: 'ground_explosion', start: at, x, y: groundY, facing: f });
      }
    }
    this.shots = this.shots.filter((q) => fxFrameIndex(q.kind, t - q.start) >= 0);
    for (const q of this.shots) out.push({ kind: q.kind, frame: DEFINITIONS[q.kind].frames[fxFrameIndex(q.kind, t - q.start)], x: q.x, y: q.y, facing: q.facing });
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
