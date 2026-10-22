import { describe, expect, it } from 'vitest';
import { EventQueue } from '../../src/domain/events';
import { makeSim } from './helpers';

const hit = { damage: 15, parryable: true, fromX: 200, attackerId: 'x' };

describe('damage feedback event (red screen-edge flash)', () => {
  it('fires once when HP is actually lost', () => {
    const { driver: d, sim } = makeSim();
    const events = new EventQueue();
    expect(d.player.receiveHit(hit, { t: sim.t, events })).toBe('hurt');
    expect(events.drain().filter((e) => e.type === 'playerDamaged')).toHaveLength(1);
  });

  it('fires on the killing blow too', () => {
    const { driver: d, sim } = makeSim();
    d.player.hp = 10;
    const events = new EventQueue();
    expect(d.player.receiveHit(hit, { t: sim.t, events })).toBe('killed');
    expect(events.drain().some((e) => e.type === 'playerDamaged')).toBe(true);
  });

  it('does not fire when the shield absorbs the whole hit', () => {
    const { driver: d, sim } = makeSim();
    d.player.shield = { value: 40, remainingMs: 5000 };
    const events = new EventQueue();
    expect(d.player.receiveHit(hit, { t: sim.t, events })).toBe('absorbed');
    expect(events.drain().some((e) => e.type === 'playerDamaged')).toBe(false);
  });
});
