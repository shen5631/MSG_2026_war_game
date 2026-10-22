// Chooses the supplied v2 atlas frame for the player's current state. Purely visual:
// frames are picked from simulation time/progress, never the other way around.
import { ANIMATION_BINDINGS, ATTACK_TIMINGS, type AttackKind } from '../../config/spec';
import type { Player } from '../../domain/player';

const CH = ANIMATION_BINDINGS.character;
type Group = keyof typeof CH;
const frames = (g: Group): string[] => CH[g].frames;

export const ATLAS_KEY = 'ganggamchan';
export const PLAYER_ORIGIN = CH.idle.origin as [number, number];

/** All frame names the runtime requires; verified after loading. */
export function requiredFrames(): string[] {
  const out = new Set<string>();
  for (const g of Object.keys(CH) as Group[]) for (const f of frames(g)) out.add(f);
  for (const list of Object.values(ANIMATION_BINDINGS.effects)) for (const f of list) out.add(f);
  return [...out];
}

const loop = (g: Group, t: number, fps: number): string => {
  const fr = frames(g);
  return fr[Math.floor((t / 1000) * fps) % fr.length];
};
const byProgress = (list: string[], p: number): string => list[Math.min(list.length - 1, Math.max(0, Math.floor(p * list.length)))];

export type BindingStatus = 'supplied' | 'temporary-reuse';

/** Strong attacks reuse heavy windup (2 prep poses only) + attack_3 strike: TEMPORARY. */
const STRONG = ANIMATION_BINDINGS.semanticFallbacks.strong_attack;

export function playerFrame(p: Player, t: number): { frame: string; status: BindingStatus; tint?: number } {
  switch (p.mode) {
    case 'dead': {
      const fr = frames('death');
      return { frame: byProgress(fr, Math.min(0.999, (t - p.deathT) / 900)), status: 'supplied' };
    }
    case 'hurt':
      return { frame: byProgress(frames('hurt'), Math.min(0.999, (t - p.modeT) / 180)), status: 'supplied' };
    case 'dash':
      return { frame: byProgress(frames('dash'), Math.min(0.999, (t - p.modeT) / 300)), status: 'supplied' };
    case 'parry':
      return { frame: frames('parry')[Math.min(1, Math.floor((t - p.parryStart) / 90))], status: 'supplied' };
    case 'parryRecover':
      return { frame: frames('parry')[2], status: 'supplied' };
    case 'command':
      // TEMPORARY: no command pose in the supplied sheet.
      return { frame: frames('idle')[1], status: 'temporary-reuse', tint: 0xd0e0ff };
    case 'charge': {
      const stageTint = [0xffffff, 0xfff2a0, 0xffd060, 0xff9a40][p.chargeStage];
      return { frame: STRONG.windup[1], status: 'temporary-reuse', tint: stageTint };
    }
    case 'attack': {
      const a = p.attack;
      if (!a) break;
      return attackFrame(a.kind, a.startT, a.startupEnd, a.activeEnd, a.end, t);
    }
    default:
      break;
  }
  const b = p.body;
  if (!b.onGround) {
    const j = frames('jump');
    if (b.vy < -200) return { frame: j[1], status: 'supplied' };
    if (b.vy < 150) return { frame: j[2], status: 'supplied' };
    return { frame: j[3], status: 'supplied' };
  }
  const speed = Math.abs(b.vx);
  if (speed < 1) return { frame: loop('idle', t, 6), status: 'supplied' };
  if (speed > 150) return { frame: loop('run', t, 12), status: 'supplied' };
  return { frame: loop('walk', t, 10), status: 'supplied' };
}

function attackFrame(kind: AttackKind, start: number, startupEnd: number, activeEnd: number, end: number, t: number): { frame: string; status: BindingStatus; tint?: number } {
  const phase = t < startupEnd ? 0 : t < activeEnd ? 1 : 2;
  const pIn = (a: number, b: number) => (b > a ? (t - a) / (b - a) : 1);
  const weak = (g: Group) => {
    const fr = frames(g);
    // windup frames → strike frames → follow-through, split across startup/active/recovery
    const split = [Math.ceil(fr.length * 0.4), Math.ceil(fr.length * 0.75)];
    if (phase === 0) return byProgress(fr.slice(0, split[0]), pIn(start, startupEnd));
    if (phase === 1) return byProgress(fr.slice(split[0], split[1]), pIn(startupEnd, activeEnd));
    return byProgress(fr.slice(split[1]), pIn(activeEnd, end));
  };
  switch (kind) {
    case 'weak1': return { frame: weak('attack_1'), status: 'supplied' };
    case 'weak2': return { frame: weak('attack_2'), status: 'supplied' };
    case 'weak3': return { frame: weak('attack_3'), status: 'supplied' };
    case 'air_attack': {
      // TEMPORARY: airborne reuse of attack_1 poses.
      const fr = frames('attack_1').slice(1, 4);
      return { frame: byProgress(fr, (t - start) / (end - start)), status: 'temporary-reuse' };
    }
    default: {
      // heavy / finisher / charge release: TEMPORARY heavy prep (2 poses) + attack_3 strike/recovery.
      const tint = kind === 'finisher' ? 0xffe0a0 : kind === 'charge3' ? 0xff9a40 : kind === 'charge2' ? 0xffd060 : kind === 'charge1' ? 0xfff2a0 : undefined;
      if (phase === 0) return { frame: byProgress(STRONG.windup, pIn(start, startupEnd)), status: 'temporary-reuse', tint };
      if (phase === 1) return { frame: STRONG.strike[0], status: 'temporary-reuse', tint };
      return { frame: STRONG.recovery[0], status: 'temporary-reuse', tint };
    }
  }
}

export function attackReach(kind: AttackKind): number {
  return kind === 'dash' ? 0 : ATTACK_TIMINGS[kind].reachPx;
}
