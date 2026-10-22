// Input-only bot: plays rounds through the real simulation (no kill/teleport hooks) to catch
// soft-locks, stuck enemies and unwinnable flows. It is not a balance or human playtest.
import { SIM_STEP_MS } from '../../src/config/spec';
import type { CombatAction, CombatInput } from '../../src/domain/player';
import { StatsRecorder } from '../../src/domain/records';
import { RoundSim } from '../../src/domain/round';
import { makeRng } from '../../src/domain/geometry';
import { type UpgradeStacks } from '../../src/domain/upgrades';

export function botInput(sim: RoundSim, frame: number, prevHeld: Set<CombatAction>): CombatInput {
  const p = sim.player;
  const px = p.body.x;
  const held = new Set<CombatAction>();
  let moveX = 0;
  const foes: { x: number; danger: boolean; red: boolean; windup: number }[] = [];
  for (const e of sim.enemies) if (e.targetable && e.state !== 'dead') foes.push({ x: e.body.x, danger: e.state === 'windup', red: false, windup: e.windupProgress(sim.t) });
  if (sim.boss && sim.bossStage === 'fight' && sim.boss.alive) foes.push({ x: sim.boss.body.x, danger: sim.boss.state === 'windup', red: sim.boss.redTelegraph, windup: sim.boss.windupProgress(sim.t) });
  foes.sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px));
  const target = foes[0];
  const boss = sim.boss && sim.bossStage === 'fight' && sim.boss.alive ? sim.boss : null;
  if (!target) {
    moveX = 1;
    if (frame % 40 < 2) held.add('jump'); // hop over props
  } else if (boss && Math.abs(boss.body.x - px) <= Math.abs(target.x - px) + 1) {
    // Boss: read the telegraph. Parry normal attacks just before they connect, avoid red ones.
    const dx = boss.body.x - px;
    const dist = Math.abs(dx);
    const pat = boss.pattern;
    if (boss.state === 'windup' && pat && pat.id !== 'summon') {
      const toActive = boss.patternStart + pat.startupMs - sim.t;
      const travel = pat.id === 'rush' ? Math.max(0, (dist - 70) / 330) * 1000 : 0;
      if (pat.parryable === false) {
        moveX = -Math.sign(dx) || -1;
        held.add('run');
        if (toActive < 120) held.add('jump');
      } else if (toActive + travel <= 120 && p.mode === 'free') {
        moveX = Math.sign(dx) * 0.05;
        held.add('parry');
      } else {
        moveX = Math.sign(dx) * 0.05;
      }
    } else if (boss.state === 'hits') {
      moveX = Math.sign(dx) * 0.05;
    } else if (dist > 58) {
      moveX = Math.sign(dx);
      held.add('run');
    } else {
      moveX = Math.sign(dx) * 0.05;
      if (frame % 6 < 3) held.add('weak');
    }
  } else {
    const dx = target.x - px;
    const dist = Math.abs(dx);
    if (target.danger && target.windup > 0.72 && dist < 170 && p.mode === 'free') {
      moveX = Math.sign(dx) * 0.05;
      held.add('parry');
    } else if (dist > 58) {
      moveX = Math.sign(dx);
      held.add('run');
    } else {
      moveX = Math.sign(dx) * 0.05;
      if (frame % 6 < 3) held.add('weak');
    }
  }
  // Parry an incoming cavalry lance charge.
  const charger = sim.enemies.find((e) => e.kind === 'cavalry' && e.state === 'active' && Math.sign(px - e.body.x) === e.facing && Math.abs(e.body.x - px) < 110);
  if (charger && p.mode === 'free' && p.body.onGround) {
    moveX = Math.sign(charger.body.x - px) * 0.05;
    held.delete('weak');
    held.add('parry');
  }
  // Parry arrows that are about to arrive from the front.
  const incoming = sim.projectiles.some((pr) => pr.alive && Math.sign(px - pr.x) === Math.sign(pr.vx) && Math.abs(pr.x - px) < 40 + Math.abs(pr.vx) * 0.12);
  if (incoming && p.mode === 'free' && p.body.onGround) {
    const pr = sim.projectiles.find((q) => q.alive && Math.sign(px - q.x) === Math.sign(q.vx))!;
    moveX = Math.sign(pr.x - px) * 0.05;
    held.delete('weak');
    held.add('parry');
  }
  if (target && p.cooldownRemaining === 0 && frame % 30 === 0) {
    held.add('castSkill');
    if (frame % 90 === 0) held.add('cycleSkill');
  }
  const pressed = [...held].filter((a) => !prevHeld.has(a));
  const released = [...prevHeld].filter((a) => !held.has(a));
  prevHeld.clear();
  for (const a of held) prevHeld.add(a);
  const heldRec: Partial<Record<CombatAction, boolean>> = {};
  for (const a of held) heldRec[a] = true;
  return { moveX, held: heldRec, pressed, released };
}

export function playRound(round: number, upgrades: UpgradeStacks, seed: number, maxAttempts = 12) {
  const recorder = new StatsRecorder();
  const rng = makeRng(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sim = new RoundSim(round, attempt, upgrades, recorder, rng);
    const prev = new Set<CombatAction>();
    for (let f = 0; f < 60 * 60 * 12; f++) {
      sim.step(SIM_STEP_MS, botInput(sim, f + attempt * 7, prev));
      sim.drainEvents();
      if (sim.finished) break;
    }
    if (sim.outcome === 'victory') return { attempts: attempt, simSeconds: sim.t / 1000, recorder, sim };
    if (!sim.outcome) throw new Error(`round ${round} attempt ${attempt} did not finish: stage=${sim.bossStage} arena=${sim.activeArena} x=${sim.player.body.x.toFixed(0)} enemies=${sim.enemies.length}`);
  }
  return { attempts: Infinity, simSeconds: 0, recorder, sim: null };
}

