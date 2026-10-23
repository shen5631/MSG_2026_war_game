// Button glyphs for on-screen hints. The game is gamepad-first: hints show the Xbox-style pad button first (face
// buttons in their usual colours) and the keyboard key second.
import type { ReactNode } from 'react';

const FACE: Record<string, string> = { A: 'a', B: 'b', X: 'x', Y: 'y' };

/** Gamepad button: A/B/X/Y as coloured round buttons, LB/RB/LT/RT/START/stick as dark pills. */
export function Pad({ children }: { children: string }) {
  const face = FACE[children];
  return <kbd className={`pad-btn ${face ? `face ${face}` : 'pill'}`}>{children}</kbd>;
}

/** Keyboard key (secondary). */
export function Kb({ children }: { children: ReactNode }) {
  return <kbd className="kb-key">{children}</kbd>;
}
