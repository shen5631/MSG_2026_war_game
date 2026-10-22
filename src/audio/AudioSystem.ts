// TEMPORARY audio: synthesized Web Audio SFX and procedural pentatonic loops.
// Not the final 국악+action soundtrack — see IMPLEMENTATION_NOTES.md replacement list.
import { DEFAULTS } from '../config/spec';
import type { SfxId } from '../domain/events';

export type MusicTheme = 'title' | 'round1' | 'round2' | 'round3' | 'boss' | 'ending' | null;

interface ThemeDef { bpm: number; root: number; scale: number[]; melody: number[]; drum: string; wave: OscillatorType }

// 평조-like pentatonic degrees; melodies index into the scale (−1 = rest).
const THEMES: Record<Exclude<MusicTheme, null>, ThemeDef> = {
  title: { bpm: 76, root: 220, scale: [0, 2, 5, 7, 9, 12, 14], melody: [4, -1, 3, 2, 3, -1, 1, 0, 2, -1, 3, 4, 5, -1, 4, -1], drum: 'x..x..x...x.x...', wave: 'triangle' },
  round1: { bpm: 112, root: 196, scale: [0, 2, 5, 7, 9, 12, 14], melody: [0, 2, 3, 4, 3, 2, 3, -1, 4, 5, 4, 3, 2, 1, 2, -1], drum: 'x.x.x..xx.x.x..x', wave: 'square' },
  round2: { bpm: 120, root: 174.6, scale: [0, 3, 5, 7, 10, 12, 15], melody: [2, 3, 4, -1, 4, 3, 2, 0, 1, 2, 3, -1, 5, 4, 3, 2], drum: 'x..xx.x.x..xx.x.', wave: 'square' },
  round3: { bpm: 132, root: 164.8, scale: [0, 2, 5, 7, 9, 12, 14], melody: [5, 4, 3, 4, 5, -1, 6, 5, 4, 3, 2, 3, 4, -1, 3, 2], drum: 'x.xxx.x.x.xxx.x.', wave: 'sawtooth' },
  boss: { bpm: 144, root: 146.8, scale: [0, 3, 5, 7, 10, 12, 15], melody: [0, 0, 3, 2, 0, -1, 4, 3, 0, 0, 5, 4, 3, 2, 1, -1], drum: 'xx.xx.x.xx.xx.xx', wave: 'sawtooth' },
  ending: { bpm: 70, root: 261.6, scale: [0, 2, 5, 7, 9, 12, 14], melody: [2, 3, 4, -1, 5, 4, 3, -1, 2, 1, 0, -1, 1, 2, 3, -1], drum: 'x.......x.......', wave: 'triangle' },
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  bgmVolume: number = DEFAULTS.ui.bgmDefault;
  sfxVolume: number = DEFAULTS.ui.sfxDefault;
  private theme: MusicTheme = null;
  private nextNoteTime = 0;
  private step = 0;
  private suspendedByGame = false;
  private listeners = new Set<() => void>();

  get unlocked(): boolean { return !!this.ctx && this.ctx.state === 'running'; }
  /** Needs a trusted gesture: not created yet, or suspended by the browser (not by our own pause). */
  get locked(): boolean { return !this.ctx || (this.ctx.state !== 'running' && !this.suspendedByGame); }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(); }

  /** Must be called from a trusted user gesture (click / key). Gamepad polling is not a user activation. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.bgmGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.applyVolumes();
        this.ctx.onstatechange = () => this.emit();
      }
      if (this.ctx.state === 'suspended' && !this.suspendedByGame) void this.ctx.resume().then(() => this.emit(), () => this.emit());
    } catch (err) {
      console.warn('audio unlock failed', err);
    }
    this.emit();
  }

  setVolumes(bgm: number, sfx: number): void {
    this.bgmVolume = bgm;
    this.sfxVolume = sfx;
    this.applyVolumes();
    this.emit();
  }

  private applyVolumes(): void {
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume * 0.18;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume * 0.5;
  }

  /** Pause stops BGM position and blocks new SFX; resume never creates a second BGM. */
  setGamePaused(paused: boolean): void {
    if (this.suspendedByGame === paused) return;
    this.suspendedByGame = paused;
    this.emit();
    if (!this.ctx) return;
    if (paused && this.ctx.state === 'running') void this.ctx.suspend();
    if (!paused && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusic(theme: MusicTheme): void {
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.05;
  }

  /** Lookahead scheduler, driven by the render loop (no independent timers). */
  update(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.theme || !this.bgmGain) return;
    const def = THEMES[this.theme];
    const stepDur = 60 / def.bpm / 2;
    if (this.nextNoteTime < ctx.currentTime - 0.5) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const i = this.step % def.melody.length;
      const deg = def.melody[i];
      if (deg >= 0) this.pluck(def.root * Math.pow(2, def.scale[deg % def.scale.length] / 12), this.nextNoteTime, stepDur * 1.6, def.wave);
      if (i % 4 === 0) this.pluck(def.root / 2 * Math.pow(2, def.scale[(this.step >> 2) % 3 === 0 ? 0 : 3] / 12), this.nextNoteTime, stepDur * 3, 'triangle', 0.6);
      if (def.drum[i] === 'x') this.drum(this.nextNoteTime, i % 8 === 0);
      this.nextNoteTime += stepDur;
      this.step += 1;
    }
  }

  private pluck(freq: number, at: number, dur: number, wave: OscillatorType, gain = 0.35): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.bgmGain!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private drum(at: number, accent: boolean): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 110 : 160, at);
    o.frequency.exponentialRampToValueAtTime(50, at + 0.15);
    g.gain.setValueAtTime(accent ? 0.9 : 0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g).connect(this.bgmGain!);
    o.start(at);
    o.stop(at + 0.2);
  }

  playSfx(id: SfxId): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfxGain || this.suspendedByGame) return;
    const t = ctx.currentTime;
    const tone = (f0: number, f1: number, dur: number, type: OscillatorType, vol = 0.5, delay = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur);
      g.gain.setValueAtTime(vol, t + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      o.connect(g).connect(this.sfxGain!);
      o.start(t + delay);
      o.stop(t + delay + dur + 0.02);
    };
    const noise = (dur: number, vol = 0.4, hp = 800) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f).connect(g).connect(this.sfxGain!);
      src.start(t);
    };
    switch (id) {
      case 'swing': noise(0.08, 0.25, 2500); break;
      case 'hit': noise(0.06, 0.5, 1200); tone(300, 120, 0.08, 'square', 0.25); break;
      case 'heavyHit': noise(0.12, 0.6, 600); tone(180, 60, 0.15, 'square', 0.4); break;
      case 'chargeStage': tone(440, 880, 0.12, 'triangle', 0.35); break;
      case 'parrySuccess': tone(1320, 1760, 0.12, 'square', 0.35); tone(1980, 2400, 0.2, 'triangle', 0.25, 0.03); break;
      case 'parryWhiff': noise(0.05, 0.15, 3000); break;
      case 'dash': noise(0.15, 0.3, 1500); break;
      case 'playerHurt': tone(220, 90, 0.18, 'sawtooth', 0.4); break;
      case 'shieldAbsorb': tone(600, 500, 0.1, 'square', 0.25); break;
      case 'shieldBreak': noise(0.2, 0.5, 900); tone(500, 150, 0.2, 'square', 0.3); break;
      case 'spearCall': tone(330, 440, 0.12, 'square', 0.3); tone(440, 660, 0.12, 'square', 0.3, 0.1); break;
      case 'skillReady': tone(660, 990, 0.1, 'triangle', 0.25); break;
      case 'buff': tone(392, 784, 0.25, 'triangle', 0.35); break;
      case 'heal': tone(523, 784, 0.18, 'sine', 0.35); break;
      case 'waveStart': tone(150, 150, 0.2, 'square', 0.3); tone(200, 200, 0.2, 'square', 0.3, 0.18); break;
      case 'phaseChange': tone(110, 55, 0.6, 'sawtooth', 0.5); break;
      case 'victory': [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.25, 'triangle', 0.4, i * 0.12)); break;
      case 'menuMove': tone(880, 880, 0.04, 'square', 0.15); break;
      case 'menuConfirm': tone(660, 990, 0.08, 'square', 0.2); break;
      case 'guard': tone(900, 700, 0.06, 'square', 0.3); break;
      case 'arrow': noise(0.1, 0.2, 4000); break;
      case 'death': tone(300, 40, 0.8, 'sawtooth', 0.4); break;
    }
  }

  dispose(): void {
    this.theme = null;
  }
}
