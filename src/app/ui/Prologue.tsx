// Opening story after 시작하기: 강감찬's birth at 낙성대 and the march against 소배압. Round 1 is held (pause reason
// 'story'); the control guide follows. Menu input path (useMenu): Enter/A or → next, ← previous, Esc/B/START skip.
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, STORY } from '../../config/spec';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';

type Scene = { eyebrow?: string; title: string; body: string; star?: boolean };
export const PROLOGUE: Scene[] = (STORY as { prologue: Scene[] }).prologue;

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
      {scene.star && <span className="pro-star" aria-hidden="true" />}
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
