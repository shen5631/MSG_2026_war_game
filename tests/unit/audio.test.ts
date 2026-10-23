import { describe, expect, it } from 'vitest';
import { trackFor } from '../../src/audio/AudioSystem';

describe('BGM track mapping', () => {
  it('uses the supplied 「전투의 기수」 for rounds 1–3 and boss fights, one shared track (no restart round → boss)', () => {
    const keys = (['round1', 'round2', 'round3', 'boss'] as const).map((t) => trackFor(t)?.key);
    expect(new Set(keys)).toEqual(new Set(['bgm_battle_standard_bearer']));
    expect(trackFor('round1')?.file).toBe('assets/audio/battle_standard_bearer.mp3');
  });

  it('the lobby (title) plays 「준비 yourselves」, a different track so entering a round switches songs', () => {
    expect(trackFor('title')?.key).toBe('bgm_prepare_yourselves');
    expect(trackFor('title')?.file).toBe('assets/audio/prepare_yourselves.mp3');
    expect(trackFor('title')?.key).not.toBe(trackFor('round1')?.key);
  });

  it('the opening story (and the control guide after it) plays 「성宵의 별」, then round 1 switches to the battle track', () => {
    expect(trackFor('story')?.key).toBe('bgm_story_star');
    expect(trackFor('story')?.file).toBe('assets/audio/성宵의 별.mp3');
    expect(trackFor('story')?.key).not.toBe(trackFor('round1')?.key);
    expect(trackFor('story')?.key).not.toBe(trackFor('title')?.key);
  });

  it('ending keeps the temporary synthesized theme', () => {
    expect(trackFor('ending')).toBeNull();
    expect(trackFor(null)).toBeNull();
  });
});
