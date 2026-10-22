// Input routing with simulated devices. This is NOT a physical gamepad test (T013/T015/T093 still need real hardware).
import { afterEach, describe, expect, it } from 'vitest';
import { applyDeadzone, isSupportedPad, triggerHeld } from '../../src/input/GamepadAdapter';
import { InputRouter, type MenuEvent } from '../../src/input/InputRouter';

type FakePad = { index: number; id: string; connected: boolean; mapping: string; axes: number[]; buttons: { pressed: boolean; value: number }[] };
const makePad = (): FakePad => ({
  index: 0, id: 'Virtual Xbox', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
let pads: (FakePad | null)[] = [];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } });
afterEach(() => { pads = []; });

const key = (router: InputRouter, type: 'down' | 'up', code: string, repeat = false) => {
  const ev = { code, repeat, cancelable: false, ctrlKey: false, target: null, timeStamp: 0, preventDefault() {} };
  const kb = router.keyboard as unknown as { onKeyDown(e: unknown): void; onKeyUp(e: unknown): void };
  if (type === 'down') kb.onKeyDown(ev); else kb.onKeyUp(ev);
};

describe('gamepad thresholds', () => {
  it('T016 deadzone 0.20 removes small stick values and rescales the rest', () => {
    for (const v of [0.05, 0.19, 0.2, -0.2]) expect(applyDeadzone(v)).toBe(0);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(0.6)).toBeCloseTo(0.5, 6);
  });
  it('T015 trigger hysteresis press 0.55 / release 0.35', () => {
    expect(triggerHeld(0.54, false)).toBe(false);
    expect(triggerHeld(0.55, false)).toBe(true);
    expect(triggerHeld(0.4, true)).toBe(true);
    expect(triggerHeld(0.35, true)).toBe(false);
  });
  it('requires the standard mapping', () => {
    expect(isSupportedPad({ mapping: 'standard', buttons: new Array(17), axes: [0, 0] } as never)).toBe(true);
    expect(isSupportedPad({ mapping: '', buttons: new Array(17), axes: [0, 0] } as never)).toBe(false);
  });
});

describe('InputRouter', () => {
  it('T011 OS key repeat does not create new presses', () => {
    const r = new InputRouter();
    r.setMode('combat');
    key(r, 'down', 'KeyJ');
    key(r, 'down', 'KeyJ', true);
    key(r, 'down', 'KeyJ', true);
    r.update(0);
    expect(r.takeCombatInput(true).pressed).toEqual(['weak']);
  });
  it('A+D together gives no movement', () => {
    const r = new InputRouter();
    r.setMode('combat');
    key(r, 'down', 'KeyA');
    key(r, 'down', 'KeyD');
    r.update(0);
    expect(r.takeCombatInput(true).moveX).toBe(0);
  });
  it('T013 (simulated) a connected standard pad owns combat; keyboard input is ignored', () => {
    const pad = makePad();
    pads = [pad];
    const r = new InputRouter();
    r.setMode('combat');
    r.update(0);
    expect(r.combatDevice).toBe('pad');
    key(r, 'down', 'KeyD');
    key(r, 'down', 'KeyJ');
    pad.axes[0] = -1;
    r.update(16);
    const inp = r.takeCombatInput(true);
    expect(inp.moveX).toBe(-1);
    expect(inp.pressed).toEqual([]);
    pad.buttons[1] = { pressed: true, value: 1 };
    r.update(32);
    expect(r.takeCombatInput(true).pressed).toEqual(['weak']);
  });
  it('T017 a button held across a screen change is not a new press on the next screen', () => {
    const pad = makePad();
    pads = [pad];
    const r = new InputRouter();
    const menu: MenuEvent[] = [];
    r.onMenu((e) => menu.push(e));
    r.update(0);
    pad.buttons[0] = { pressed: true, value: 1 };
    r.update(16);
    expect(menu.map((m) => m.action)).toEqual(['confirm']);
    r.setMode('combat'); // e.g. game started by that A press
    r.update(32);
    expect(r.takeCombatInput(true).pressed).toEqual([]);
    expect(r.takeCombatInput(true).held.jump).toBeUndefined();
    pad.buttons[0] = { pressed: false, value: 0 };
    r.update(48);
    pad.buttons[0] = { pressed: true, value: 1 };
    r.update(64);
    expect(r.takeCombatInput(true).pressed).toEqual(['jump']);
  });
  it('T093 (simulated) disconnect is reported; after reconnect held buttons must be released first', () => {
    const pad = makePad();
    pads = [pad];
    const r = new InputRouter();
    const statuses: boolean[] = [];
    r.onPadStatus((s) => statuses.push(s.disconnected));
    r.update(0);
    pads = [];
    r.update(16);
    expect(statuses.at(-1)).toBe(true);
    pad.buttons[0] = { pressed: true, value: 1 };
    pads = [pad];
    const menu: MenuEvent[] = [];
    r.onMenu((e) => menu.push(e));
    r.update(32);
    r.update(48);
    expect(menu).toEqual([]); // A held during reconnect is not a fresh press
    pad.buttons[0] = { pressed: false, value: 0 };
    r.update(64);
    pad.buttons[0] = { pressed: true, value: 1 };
    r.update(80);
    expect(menu.map((m) => `${m.action}:${m.source}`)).toEqual(['confirm:pad']);
  });
  it('menu direction repeats after 300ms then every 150ms', () => {
    const r = new InputRouter();
    const menu: MenuEvent[] = [];
    r.onMenu((e) => menu.push(e));
    key(r, 'down', 'ArrowDown');
    r.update(0);
    r.update(299);
    expect(menu.length).toBe(1);
    r.update(300);
    r.update(449);
    expect(menu.length).toBe(2);
    r.update(450);
    expect(menu.length).toBe(3);
  });
});
