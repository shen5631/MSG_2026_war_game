// Keyboard events → held set + ordered edge queue. OS key repeat never creates new presses.
export interface KeyEdge { type: 'down' | 'up'; code: string; time: number; suppressPause: boolean }

const FULLSCREEN_ESC_COALESCE_MS = 120;
const CTRL_SHORTCUT_CODES = new Set(['KeyD', 'KeyE', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyA', 'KeyS', 'KeyW']);

export class KeyboardAdapter {
  readonly down = new Set<string>();
  private edges: KeyEdge[] = [];
  private lastFullscreenExit = -Infinity;

  constructor(private readonly owned: Set<string>) {}

  attach(target: Window): () => void {
    const onDown = (e: KeyboardEvent) => this.onKeyDown(e);
    const onUp = (e: KeyboardEvent) => this.onKeyUp(e);
    const onFs = () => {
      if (!document.fullscreenElement) this.lastFullscreenExit = performance.now();
    };
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }

  private isFormField(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.isFormField(e)) return;
    // Cancelable browser shortcuts that collide with Ctrl-run (Ctrl+D/E/J/K/L…) are suppressed while the game owns input.
    if ((this.owned.has(e.code) || (e.ctrlKey && CTRL_SHORTCUT_CODES.has(e.code))) && e.cancelable) e.preventDefault();
    if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (e.cancelable) e.preventDefault();
    }
    if (e.repeat || this.down.has(e.code)) return;
    this.down.add(e.code);
    let suppressPause = false;
    if (e.code === 'Escape') {
      // Esc that exits fullscreen must not also toggle pause.
      const now = performance.now();
      suppressPause = !!document.fullscreenElement || now - this.lastFullscreenExit < FULLSCREEN_ESC_COALESCE_MS;
    }
    this.edges.push({ type: 'down', code: e.code, time: e.timeStamp, suppressPause });
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.down.has(e.code)) return;
    this.down.delete(e.code);
    this.edges.push({ type: 'up', code: e.code, time: e.timeStamp, suppressPause: false });
  }

  drain(): KeyEdge[] {
    const out = this.edges;
    this.edges = [];
    return out;
  }

  releaseAll(): void {
    for (const code of this.down) this.edges.push({ type: 'up', code, time: performance.now(), suppressPause: false });
    this.down.clear();
  }
}
