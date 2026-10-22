// Standard-mapping gamepad polling with deadzone and trigger hysteresis.
import { DEFAULTS, INPUT_MAP } from '../config/spec';

export interface PadStatus {
  active: boolean;
  /** A pad is connected but lacks the standard mapping or required controls. */
  unsupported: boolean;
  id: string;
  /** The previously active pad disappeared. */
  disconnected: boolean;
}

const DEADZONE = DEFAULTS.input.axisDeadzone;
const TRIGGER_PRESS = DEFAULTS.input.triggerPress;
const TRIGGER_RELEASE = DEFAULTS.input.triggerRelease;
const TRIGGERS = new Set([INPUT_MAP.standardGamepad.buttons.runHold, INPUT_MAP.standardGamepad.buttons.dash]);
const REQUIRED_BUTTONS = 16;
const STICK_MENU_THRESHOLD = 0.5;

export function applyDeadzone(v: number, dz = DEADZONE): number {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return (Math.sign(v) * (a - dz)) / (1 - dz);
}

/** Hysteresis for analog triggers: press ≥0.55, release ≤0.35. */
export function triggerHeld(value: number, wasHeld: boolean): boolean {
  return wasHeld ? value > TRIGGER_RELEASE : value >= TRIGGER_PRESS;
}

export function isSupportedPad(p: Pick<Gamepad, 'mapping' | 'buttons' | 'axes'>): boolean {
  return p.mapping === 'standard' && p.buttons.length >= REQUIRED_BUTTONS && p.axes.length >= 2;
}

export class GamepadAdapter {
  status: PadStatus = { active: false, unsupported: false, id: '', disconnected: false };
  private index: number | null = null;
  private held = new Set<string>();
  private axisX = 0;
  private hadPad = false;

  attach(target: Window): () => void {
    const onConnect = () => { /* polling picks it up */ };
    target.addEventListener('gamepadconnected', onConnect);
    target.addEventListener('gamepaddisconnected', onConnect);
    return () => {
      target.removeEventListener('gamepadconnected', onConnect);
      target.removeEventListener('gamepaddisconnected', onConnect);
    };
  }

  private pads(): (Gamepad | null)[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads());
  }

  /** Returns true when the connection status changed. */
  poll(): boolean {
    const pads = this.pads();
    let pad: Gamepad | null = null;
    if (this.index !== null) {
      const p = pads[this.index];
      if (p && p.connected && isSupportedPad(p)) pad = p;
    }
    let unsupported = false;
    if (!pad) {
      // Pick the first compatible standard pad; other pads never drive the player.
      this.index = null;
      for (const p of pads) {
        if (!p || !p.connected) continue;
        if (isSupportedPad(p)) { pad = p; this.index = p.index; break; }
        unsupported = true;
      }
    }
    const prev = this.status;
    const disconnected = !pad && this.hadPad;
    const next: PadStatus = { active: !!pad, unsupported: !pad && unsupported, id: pad?.id ?? '', disconnected };
    if (pad) this.hadPad = true;
    if (!pad) {
      this.held.clear();
      this.axisX = 0;
    } else {
      this.readPad(pad);
    }
    const changed = prev.active !== next.active || prev.unsupported !== next.unsupported || prev.id !== next.id || prev.disconnected !== next.disconnected;
    this.status = next;
    return changed;
  }

  /** The disconnect flag is consumed once the user chose to continue without the pad. */
  forgetPad(): void {
    this.hadPad = false;
    this.status = { ...this.status, disconnected: false };
  }

  private readPad(pad: Gamepad): void {
    const next = new Set<string>();
    pad.buttons.forEach((b, i) => {
      const id = `b${i}`;
      const isHeld = TRIGGERS.has(i) ? triggerHeld(b.value, this.held.has(id)) : b.pressed;
      if (isHeld) next.add(id);
    });
    const x = applyDeadzone(pad.axes[0] ?? 0);
    const y = applyDeadzone(pad.axes[1] ?? 0);
    this.axisX = x;
    if (x <= -STICK_MENU_THRESHOLD) next.add('sLeft');
    if (x >= STICK_MENU_THRESHOLD) next.add('sRight');
    if (y <= -STICK_MENU_THRESHOLD) next.add('sUp');
    if (y >= STICK_MENU_THRESHOLD) next.add('sDown');
    this.held = next;
  }

  heldControls(): Set<string> { return this.held; }
  moveX(): number { return this.axisX; }
}
