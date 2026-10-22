// Input-only bot playthrough: catches soft-locks, stuck enemies and unwinnable flows (not a human playtest).
import { describe, expect, it } from 'vitest';
import { emptyUpgrades } from '../../src/domain/upgrades';
import { playRound } from './botPlayer';

describe('input-only bot playthrough', () => {
  for (const round of [1, 2, 3]) {
    it(`round ${round} can be completed through inputs alone without soft-locks`, () => {
      const r = playRound(round, round === 1 ? emptyUpgrades() : { sword: 1, parry: 0, command_cooldown: round - 2 }, 1234 + round);
      console.log(`round ${round}: attempts=${r.attempts} lastAttemptSimSeconds=${r.simSeconds.toFixed(1)} kills=${r.recorder.stats.normalEnemyKills} parries=${r.recorder.stats.parrySuccesses} deaths=${r.recorder.stats.deaths} warnings=${r.recorder.integrityWarnings.length}`);
      expect(r.attempts).toBeLessThan(Infinity);
      expect(r.recorder.integrityWarnings).toEqual([]);
    }, 60_000);
  }
});
