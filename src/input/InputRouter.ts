// Physical devices → semantic actions → consumers. Single path for keyboard and gamepad.
import { DEFAULTS, INPUT_MAP } from '../config/spec';
import type { CombatAction, CombatInput } from '../domain/player';
import { GamepadAdapter, type PadStatus } from './GamepadAdapter';
import { KeyboardAdapter } from './KeyboardAdapter';

export type MenuAction = 'confirm' | 'cancel' | 'up' | 'down' | 'left' | 'right';
export type InputSource = 'keyboard' | 'pad';
export interface MenuEvent { action: MenuAction; source: InputSource; repeat: boolean }
export type RouterMode = 'menu' | 'combat';

const KB_COMBAT: Record<string, CombatAction> = {};
for (const [action, codes] of Object.entries(INPUT_MAP.keyboard)) {
  if (action === 'left' || action === 'right' || action === 'pause') continue;
  for (const c of codes as string[]) KB_COMBAT[c] = action as CombatAction;
}
const PAD_COMBAT: Record<number, CombatAction> = {};
for (const [action, idx] of Object.entries(INPUT_MAP.standardGamepad.buttons)) {
  if (action === 'pause') continue;
  PAD_COMBAT[idx as number] = action as CombatAction;
}
const PAD_PAUSE = INPUT_MAP.standardGamepad.buttons.pause;
const KB_LEFT = new Set(INPUT_MAP.keyboard.left);
const KB_RIGHT = new Set(INPUT_MAP.keyboard.right);
const KB_PAUSE = new Set(INPUT_MAP.keyboard.pause);

const KB_MENU: Record<string, MenuAction> = {
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', Escape: 'cancel',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const MG = INPUT_MAP.menuGamepad;
const PAD_MENU: Record<string, MenuAction> = {
  [`b${MG.confirm}`]: 'confirm', [`b${MG.cancel}`]: 'cancel', [`b${MG.pause}`]: 'cancel',
  [`b${MG.up}`]: 'up', [`b${MG.down}`]: 'down', [`b${MG.left}`]: 'left', [`b${MG.right}`]: 'right',
  'sUp': 'up', 'sDown': 'down', 'sLeft': 'left', 'sRight': 'right',
};
const REPEATABLE = new Set<MenuAction>(['up', 'down', 'left', 'right']);
const REPEAT_INITIAL = DEFAULTS.input.menuRepeatInitialMs;
const REPEAT_EVERY = DEFAULTS.input.menuRepeatMs;

/** Keys whose browser default is suppressed while the game area owns input. */
const OWNED_CODES = new Set<string>([...Object.keys(KB_COMBAT), ...Object.keys(KB_MENU), 'KeyA', 'KeyD', 'Escape']);

export class InputRouter {
  readonly keyboard = new KeyboardAdapter(OWNED_CODES);
  readonly pad = new GamepadAdapter();
  mode: RouterMode = 'menu';
  private blocked = new Set<string>();
  private pressedCombat: CombatAction[] = [];
  private releasedCombat: CombatAction[] = [];
  private menuListeners = new Set<(e: MenuEvent) => void>();
  private pauseListeners = new Set<(source: InputSource) => void>();
  private padListeners = new Set<(s: PadStatus) => void>();
  private repeatState = new Map<string, number>();
  private prevPadHeld = new Set<string>();
  private lastPadStatus: PadStatus | null = null;

  attach(target: Window): () => void {
    const detachKb = this.keyboard.attach(target);
    const detachPad = this.pad.attach(target);
    return () => { detachKb(); detachPad(); };
  }

  onMenu(fn: (e: MenuEvent) => void): () => void { this.menuListeners.add(fn); return () => this.menuListeners.delete(fn); }
  onPause(fn: (source: InputSource) => void): () => void { this.pauseListeners.add(fn); return () => this.pauseListeners.delete(fn); }
  onPadStatus(fn: (s: PadStatus) => void): () => void {
    this.padListeners.add(fn);
    if (this.lastPadStatus) fn(this.lastPadStatus);
    return () => this.padListeners.delete(fn);
  }

  /** A compatible standard pad owns combat input while connected. */
  get combatDevice(): InputSource { return this.pad.status.active ? 'pad' : 'keyboard'; }

  setMode(mode: RouterMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.consumeAll();
  }

  /** Everything currently held must be released before it counts again (screen transitions, resume). */
  consumeAll(): void {
    for (const c of this.keyboard.down) this.blocked.add(`k:${c}`);
    for (const id of this.pad.heldControls()) this.blocked.add(`p:${id}`);
    this.pressedCombat = [];
    this.releasedCombat = [];
    this.repeatState.clear();
  }

  /** Poll once per render frame. */
  update(now: number): void {
    const padStatusChanged = this.pad.poll();
    if (padStatusChanged || !this.lastPadStatus) {
      this.lastPadStatus = { ...this.pad.status };
      if (padStatusChanged && this.pad.status.active) {
        // Reconnect: read neutral first; currently held pad buttons are not new presses.
        for (const id of this.pad.heldControls()) this.blocked.add(`p:${id}`);
      }
      for (const fn of this.padListeners) fn(this.lastPadStatus);
    }

    // Unblock released controls.
    for (const id of [...this.blocked]) {
      if (id.startsWith('k:') && !this.keyboard.down.has(id.slice(2))) this.blocked.delete(id);
      if (id.startsWith('p:') && !this.pad.heldControls().has(id.slice(2))) this.blocked.delete(id);
    }

    const kbEdges = this.keyboard.drain();
    const padHeld = this.pad.heldControls();
    const padPressed: string[] = [];
    const padReleased: string[] = [];
    for (const id of padHeld) if (!this.prevPadHeld.has(id)) padPressed.push(id);
    for (const id of this.prevPadHeld) if (!padHeld.has(id)) padReleased.push(id);
    this.prevPadHeld = new Set(padHeld);

    const device = this.combatDevice;
    for (const e of kbEdges) {
      const id = `k:${e.code}`;
      if (e.type === 'down') {
        if (this.blocked.has(id)) continue;
        if (KB_PAUSE.has(e.code) && this.mode === 'combat' && !e.suppressPause) this.emitPause('keyboard');
        if (this.mode === 'menu') {
          const m = KB_MENU[e.code];
          if (m) this.emitMenu({ action: m, source: 'keyboard', repeat: false }, id, now);
        } else if (device === 'keyboard') {
          const a = KB_COMBAT[e.code];
          if (a) this.pressedCombat.push(a);
        }
      } else {
        this.repeatState.delete(id);
        if (this.mode === 'combat' && device === 'keyboard') {
          const a = KB_COMBAT[e.code];
          if (a) this.releasedCombat.push(a);
        }
      }
    }
    for (const pid of padPressed) {
      const id = `p:${pid}`;
      if (this.blocked.has(id)) continue;
      if (pid === `b${PAD_PAUSE}` && this.mode === 'combat') this.emitPause('pad');
      if (this.mode === 'menu') {
        const m = PAD_MENU[pid];
        if (m) this.emitMenu({ action: m, source: 'pad', repeat: false }, id, now);
      } else if (device === 'pad' && pid.startsWith('b')) {
        const a = PAD_COMBAT[Number(pid.slice(1))];
        if (a) this.pressedCombat.push(a);
      }
    }
    for (const pid of padReleased) {
      this.repeatState.delete(`p:${pid}`);
      if (this.mode === 'combat' && device === 'pad' && pid.startsWith('b')) {
        const a = PAD_COMBAT[Number(pid.slice(1))];
        if (a) this.releasedCombat.push(a);
      }
    }
    if (this.mode === 'menu') this.updateMenuRepeat(now);
  }

  private emitPause(source: InputSource): void {
    for (const fn of this.pauseListeners) fn(source);
  }

  private emitMenu(e: MenuEvent, id: string, now: number): void {
    if (REPEATABLE.has(e.action) && !e.repeat) this.repeatState.set(id, now + REPEAT_INITIAL);
    for (const fn of [...this.menuListeners]) fn(e);
  }

  private updateMenuRepeat(now: number): void {
    for (const [id, next] of this.repeatState) {
      if (now < next) continue;
      const held = id.startsWith('k:') ? this.keyboard.down.has(id.slice(2)) : this.pad.heldControls().has(id.slice(2));
      if (!held) { this.repeatState.delete(id); continue; }
      const action = id.startsWith('k:') ? KB_MENU[id.slice(2)] : PAD_MENU[id.slice(2)];
      if (!action) continue;
      this.repeatState.set(id, now + REPEAT_EVERY);
      for (const fn of [...this.menuListeners]) fn({ action, source: id.startsWith('k:') ? 'keyboard' : 'pad', repeat: true });
    }
  }

  private heldCombat(): Partial<Record<CombatAction, boolean>> {
    const held: Partial<Record<CombatAction, boolean>> = {};
    if (this.combatDevice === 'pad') {
      for (const id of this.pad.heldControls()) {
        if (!id.startsWith('b') || this.blocked.has(`p:${id}`)) continue;
        const a = PAD_COMBAT[Number(id.slice(1))];
        if (a) held[a] = true;
      }
    } else {
      for (const code of this.keyboard.down) {
        if (this.blocked.has(`k:${code}`)) continue;
        const a = KB_COMBAT[code];
        if (a) held[a] = true;
      }
    }
    return held;
  }

  private moveX(): number {
    if (this.combatDevice === 'pad') return this.pad.moveX();
    let l = false;
    let r = false;
    for (const code of this.keyboard.down) {
      if (this.blocked.has(`k:${code}`)) continue;
      if (KB_LEFT.has(code)) l = true;
      if (KB_RIGHT.has(code)) r = true;
    }
    // Both pressed → no movement, facing kept.
    return l === r ? 0 : l ? -1 : 1;
  }

  takeCombatInput(firstStep: boolean): CombatInput {
    if (this.mode !== 'combat') return { moveX: 0, held: {}, pressed: [], released: [] };
    const input: CombatInput = {
      moveX: this.moveX(),
      held: this.heldCombat(),
      pressed: firstStep ? this.pressedCombat : [],
      released: firstStep ? this.releasedCombat : [],
    };
    if (firstStep) {
      this.pressedCombat = [];
      this.releasedCombat = [];
    }
    return input;
  }

  /** Focus loss: drop all held inputs so nothing stays stuck. */
  releaseAll(): void {
    this.keyboard.releaseAll();
    this.pressedCombat = [];
    this.releasedCombat = [];
    this.repeatState.clear();
  }
}
