import { lazy, Suspense, useEffect, useState } from 'react';
import { STORY } from '../config/spec';
import type { ControllerState } from '../domain/session';
import type { Services } from './bridge';
import { GameHost } from './GameHost';
import { ServicesContext } from './useMenu';
import { Ending, Results, Rewards } from './ui/Flow';
import { HUD, Toasts } from './ui/HUD';
import { Tutorial } from './ui/Tutorial';
import { GameOver, Loading, LoadError, Pause, PadDisconnected, RuntimeError, Title } from './ui/Panels';

// Dev server only: the test panel (` key) is dropped from production builds with this constant branch.
const DevPanel = import.meta.env.DEV ? lazy(() => import('../debug/DevPanel')) : null;

function Overlay({ st, padActive, padNotice }: { st: ControllerState; padActive: boolean; padNotice: string | null }) {
  switch (st.phase) {
    case 'boot':
    case 'loading':
      return <Loading progress={st.loadProgress} />;
    case 'load-error':
      return <LoadError files={st.loadErrorFiles} />;
    case 'title':
      return <Title padNotice={padNotice} padActive={padActive} />;
    case 'playing': {
      const r = st.pauseReasons;
      return (
        <>
          <HUD />
          <Toasts />
          {st.runtimeError ? <RuntimeError message={st.runtimeError} />
            : r.includes('tutorial') ? <Tutorial />
            : r.includes('pad-disconnected') ? <PadDisconnected padActive={padActive} />
              : st.paused && r.includes('manual') ? <Pause note={st.pauseNote} /> : null}
        </>
      );
    }
    case 'game-over':
      return <GameOver />;
    case 'reward':
      return <Rewards upgrades={st.upgrades} round={st.round} />;
    case 'ending':
      return <Ending index={st.endingIndex} />;
    case 'results':
      return <Results stats={st.stats} warnings={st.integrityWarnings} />;
  }
}

export function App({ services }: { services: Services }) {
  const [st, setSt] = useState<ControllerState>(() => services.controller.snapshot());
  const [padActive, setPadActive] = useState(false);
  const [padNotice, setPadNotice] = useState<string | null>(null);
  const [audioLocked, setAudioLocked] = useState(true);

  useEffect(() => services.controller.subscribe(setSt), [services]);
  useEffect(() => services.router.onPadStatus((p) => {
    setPadActive(p.active);
    setPadNotice(p.unsupported ? '지원하지 않는 게임패드입니다(표준 매핑 아님). 키보드로 플레이할 수 있습니다.' : p.active ? `게임패드 연결됨: ${p.id}` : null);
  }), [services]);
  useEffect(() => {
    const update = () => setAudioLocked(services.audio.locked);
    update();
    return services.audio.onChange(update);
  }, [services]);
  // Every screen transition consumes held buttons so nothing passes through to the next screen.
  useEffect(() => { services.router.consumeAll(); }, [services, st.phase, st.paused]);

  return (
    <ServicesContext.Provider value={services}>
      <div className="app-root">
        <GameHost>
          <Overlay st={st} padActive={padActive} padNotice={padNotice} />
          {DevPanel && <Suspense fallback={null}><DevPanel /></Suspense>}
          {audioLocked && st.phase === 'playing' && (
            <button className="audio-unlock" data-testid="audio-unlock" onClick={() => services.audio.unlock()}>{STORY.ui.audioUnlock}</button>
          )}
        </GameHost>
      </div>
    </ServicesContext.Provider>
  );
}
