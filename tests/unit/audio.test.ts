import { describe, expect, it } from 'vitest';
import { trackFor } from '../../src/audio/AudioSystem';

describe('BGM track mapping', () => {
  it('uses the supplied 「전투의 기수」 for rounds 1–3 and boss fights, one shared track (no restart round → boss)', () => {
    const keys = (['round1', 'round2', 'round3', 'boss'] as const).map((t) => trackFor(t)?.key);
    expect(new Set(keys)).toEqual(new Set(['bgm_battle_standard_bearer']));
    expect(trackFor('round1')?.file).toBe('assets/audio/battle_standard_bearer.mp3');
  });

  it('title and ending keep the temporary synthesized themes', () => {
    expect(trackFor('title')).toBeNull();
    expect(trackFor('ending')).toBeNull();
    expect(trackFor(null)).toBeNull();
  });
});
