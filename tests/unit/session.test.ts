import { describe, expect, it } from 'vitest';
import { GameController, type CombatInputSource } from '../../src/domain/session';
import { emptyInput } from '../../src/domain/player';

const idle: CombatInputSource = { takeCombatInput: () => emptyInput() };
const FRAME = 1000 / 60;

function frames(c: GameController, n: number) {
  for (let i = 0; i < n; i++) c.frame(FRAME, idle);
}

/** Clears a round through the real simulation, using test helpers only to remove enemies. */
function clearRound(c: GameController) {
  const sim = c.round!;
  for (let a = 0; a < sim.arenas.length; a++) {
    sim.debugTeleport(sim.arenas[a].spec.lockAtPlayerX + 5);
    frames(c, 45);
    for (let w = 0; w < sim.arenas[a].totalWaves; w++) {
      sim.debugKillWave();
      frames(c, 130);
    }
    sim.debugTeleport(sim.arenas[a].spec.right + 20);
    frames(c, 2);
  }
  sim.debugTeleport(sim.spec.bossArena.playerEntryX + 2);
  frames(c, 60);
  sim.debugDamageBoss(sim.boss!.maxHp / 2 + 1);
  frames(c, 70);
  sim.player.hp = 100;
  sim.debugDamageBoss(99999);
  frames(c, 120);
}

describe('game flow', () => {
  it('title → 3 rounds → 2 rewards → ending → results → title', () => {
    const c = new GameController(1);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    expect(c.phase).toBe('playing');
    clearRound(c);
    expect(c.phase).toBe('reward');
    c.chooseUpgrade('sword');
    expect(c.roundIndex).toBe(2);
    clearRound(c);
    expect(c.phase).toBe('reward');
    c.chooseUpgrade('sword');
    expect(c.upgrades.sword).toBe(2);
    clearRound(c);
    expect(c.phase).toBe('ending');
    c.chooseUpgrade('parry'); // no third reward
    expect(c.upgrades.parry).toBe(0);
    for (let i = 0; i < 5; i++) c.advanceEnding(); // 6 ending scenes
    expect(c.phase).toBe('ending');
    c.advanceEnding();
    expect(c.phase).toBe('results');
    expect(c.recorder.stats.bossKills).toBe(3);
    expect(c.recorder.stats.normalEnemyKills).toBe(50);
    expect(c.recorder.stats.playTimeMs).toBeGreaterThan(0);
    c.finishResults();
    expect(c.phase).toBe('title');
    expect(c.recorder.stats.bossKills).toBe(0);
  });

  it('T062/T089 death keeps upgrades and accumulated stats, resets round state', () => {
    const c = new GameController(2);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    clearRound(c);
    c.chooseUpgrade('command_cooldown');
    const sim = c.round!;
    sim.player.cooldownRemaining = 5000;
    sim.player.buffRemaining = 3000;
    sim.debugTeleport(sim.arenas[0].spec.lockAtPlayerX + 5);
    frames(c, 45);
    sim.debugKillWave();
    frames(c, 5);
    const kills = c.recorder.stats.normalEnemyKills;
    sim.player.hp = 0;
    frames(c, 120);
    expect(c.phase).toBe('game-over');
    expect(c.recorder.stats.deaths).toBe(1);
    c.retryRound();
    expect(c.phase).toBe('playing');
    expect(c.roundIndex).toBe(2);
    expect(c.upgrades.command_cooldown).toBe(1);
    const p = c.round!.player;
    expect([p.hp, p.cooldownRemaining, p.buffRemaining, p.shield.value, p.selectedSkillId]).toEqual([100, 0, 0, 0, 'command_buff']);
    expect(c.recorder.stats.normalEnemyKills).toBe(kills);
    expect(c.round!.enemies.length).toBe(0);
  });

  it('T091 pause freezes cooldowns, buffs, shield and play time', () => {
    const c = new GameController(3);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    const p = c.round!.player;
    p.cooldownRemaining = 10000;
    p.buffRemaining = 5000;
    p.shield = { value: 40, remainingMs: 5000 };
    c.pauseManual();
    const time = c.recorder.stats.playTimeMs;
    frames(c, 1200); // 20s real time
    expect([p.cooldownRemaining, p.buffRemaining, p.shield.value, c.recorder.stats.playTimeMs]).toEqual([10000, 5000, 40, time]);
  });

  it('T094 auto pause needs explicit resume; manual remains after hidden clears', () => {
    const c = new GameController(4);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    c.addAutoPause('hidden');
    c.clearAutoPause('hidden');
    expect(c.pause.paused).toBe(true);
    c.resume();
    expect(c.pause.paused).toBe(false);
  });

  it('T090 return to menu resets upgrades and stats', () => {
    const c = new GameController(5);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    clearRound(c);
    c.chooseUpgrade('parry');
    c.returnToMenu();
    expect(c.phase).toBe('title');
    expect(c.upgrades).toEqual({ sword: 0, parry: 0, command_cooldown: 0 });
    expect(c.recorder.stats.bossKills).toBe(0);
  });

  it('long frame gaps pause instead of replaying time', () => {
    const c = new GameController(6);
    c.setLoaded();
    c.startGame();
    c.finishStory(); c.finishTutorial(); // skip the story and control guide (tested separately)
    // A long frame right after the start is dropped without pausing (texture upload grace)…
    c.frame(5000, idle);
    expect(c.pause.paused).toBe(false);
    frames(c, 40);
    // …afterwards a long gap pauses and its time is never replayed.
    const t0 = c.round!.t;
    c.frame(5000, idle);
    expect(c.round!.t).toBe(t0);
    expect(c.pause.paused).toBe(true);
  });
});

describe('opening story and control guide after 시작하기', () => {
  it('holds round 1 on its first frame until finished; START/pause cannot stack on top', () => {
    const c = new GameController(1);
    c.setLoaded();
    c.startGame();
    expect(c.phase).toBe('playing');
    expect(c.snapshot().pauseReasons).toEqual(['story', 'tutorial']);
    frames(c, 120);
    expect(c.round!.t).toBe(0);
    c.pauseManual();
    c.finishTutorial(); // the guide cannot be closed while the story is still showing
    expect(c.snapshot().pauseReasons).toEqual(['story', 'tutorial']);
    c.finishStory();
    expect(c.snapshot().pauseReasons).toEqual(['tutorial']);
    frames(c, 60);
    expect(c.round!.t).toBe(0); // still held by the guide
    c.finishTutorial();
    expect(c.snapshot().paused).toBe(false);
    frames(c, 60);
    expect(c.round!.t).toBeGreaterThan(0);
    c.finishTutorial(); // second call is a no-op
    expect(c.snapshot().paused).toBe(false);
  });

  it('shows again for every new game from the title, never on a retry or a later round', () => {
    const c = new GameController(1);
    c.setLoaded();
    c.startGame();
    c.finishStory();
    c.finishTutorial();
    c.round!.player.hp = 0;
    frames(c, 120);
    expect(c.phase).toBe('game-over');
    c.retryRound();
    expect(c.phase).toBe('playing');
    expect(c.snapshot().pauseReasons).toEqual([]);
    c.debugStartRound(2);
    expect(c.snapshot().pauseReasons).toEqual([]);
    c.returnToMenu();
    c.startGame();
    expect(c.snapshot().pauseReasons).toEqual(['story', 'tutorial']);
  });
});
