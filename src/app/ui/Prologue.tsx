// Opening story after 시작하기: 강감찬's birth at 낙성대 and the march against 소배압. Round 1 is held (pause reason
// 'story'); the control guide follows. Menu input path (useMenu): Enter/A or → next, ← previous, Esc/B/START skip.
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, STORY } from '../../config/spec';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';

type Scene = { eyebrow?: string; title: string; body: string; star?: boolean };
export const PROLOGUE: Scene[] = (STORY as { prologue: Scene[] }).prologue;

/** Fixed night-sky star field (deterministic, so it does not reshuffle between scenes). UI coords 640×360. */
const SKY_STARS = (() => {
  let seed = 948;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 95 }, () => ({
    x: Math.round(rnd() * 636), y: Math.round(Math.pow(rnd(), 1.4) * 250),
    big: rnd() < 0.18, delay: Math.round(rnd() * 4000), dur: 2200 + Math.round(rnd() * 2600),
  }));
})();

/** Night sky over 낙성대: stars, far ridges and a village whose house lights up when the star lands (scene 1). */
export function NightSky({ falling }: { falling: boolean }) {
  return (
    <div className={`pro-sky ${falling ? 'falling' : ''}`} aria-hidden="true">
      <span className="pro-moon" />
      {SKY_STARS.map((st, n) => (
        <i key={n} className={st.big ? 'big' : ''} style={{ left: st.x, top: st.y, animationDelay: `${st.delay}ms`, animationDuration: `${st.dur}ms` }} />
      ))}
      {falling && <span className="pro-star" />}
      <svg className="pro-land" viewBox="0 0 640 360" preserveAspectRatio="none">
        <path className="far" d="M0 268 L60 240 L120 256 L190 222 L250 248 L320 214 L390 246 L450 228 L520 252 L580 232 L640 250 V360 H0Z" />
        <path className="near" d="M0 300 L80 282 L150 296 L230 276 L300 294 L380 284 L440 296 L520 280 L600 294 L640 286 V360 H0Z" />
        {/* the house of 낙성대: a hanok roof with upturned eaves and a window that catches the star's light */}
        <g className="house">
          <path d="M444 300 Q470 284 496 300 L490 300 L490 318 L450 318 L450 300Z" />
          <path d="M436 301 Q470 279 504 301 L500 303 Q470 288 440 303Z" />
          <rect className="win" x="464" y="304" width="12" height="9" />
        </g>
        <path className="ground" d="M0 316 H640 V360 H0Z" />
      </svg>
      <span className="pro-glow" />
    </div>
  );
}

export function Prologue() {
  const s = useServices();
  const [i, setI] = useState(0);
  // Presses that arrive before the next render must not be lost (same as the control guide).
  const at = useRef(0);
  at.current = i;
  const shownAt = useRef(performance.now());
  useEffect(() => { shownAt.current = performance.now(); }, [i]);

  const finish = () => sendCommand(s, { type: 'finishStory' });
  const go = (n: number) => { at.current = n; setI(n); };
  const next = () => {
    // A held/bouncing key must not flip two pages at once.
    if (performance.now() - shownAt.current < DEFAULTS.ui.endingAdvanceMinMs) return;
    if (at.current >= PROLOGUE.length - 1) finish();
    else go(at.current + 1);
  };
  const prev = () => go(Math.max(0, at.current - 1));
  useMenu({ count: 1, onConfirm: next, onRight: next, onLeft: prev, onCancel: finish });

  const scene = PROLOGUE[i];
  const last = i === PROLOGUE.length - 1;
  return (
    <div className="prologue" data-testid="prologue" data-step={i} onClick={next}>
      <NightSky falling={!!scene.star} />
      <button className="tut-skip" data-testid="prologue-skip" style={{ top: 6 }} onClick={(e) => { e.stopPropagation(); finish(); }}>건너뛰기 ▸▸</button>
      <div className="pro-card" key={i}>
        {scene.eyebrow && <p className="pro-eyebrow">{scene.eyebrow}</p>}
        <h2>{scene.title}</h2>
        <p className="pro-body">{scene.body}</p>
      </div>
      <div className="pro-foot">
        <span className="tut-dots" aria-hidden="true">{PROLOGUE.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</span>
        <span className="small blink">{last ? 'A / Enter : 출전' : 'A / Enter : 다음'}</span>
      </div>
    </div>
  );
}
