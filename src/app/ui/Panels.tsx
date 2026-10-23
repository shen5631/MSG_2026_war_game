// Title, settings, controls, pause, confirm, game over, loading and error screens.
// Visual design follows the ganggamchan_menu_ui package; navigation stays on the single InputRouter → useMenu path.
import { useEffect, useState } from 'react';
import { STORY } from '../../config/spec';
import type { InputSource } from '../../input/InputRouter';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';
import { Frame } from './Frame';
import { MenuList } from './MenuList';

/** Registered in spec/runtime_assets.json (ui_title_logo), so it is already cached by the boot loader. */
const TITLE_LOGO = `${import.meta.env.BASE_URL}assets/ui/title_logo.png`;
const VOLUME_STEP = 5;

export function Loading({ progress }: { progress: number }) {
  return (
    <div className="screen center" data-testid="loading">
      <Frame>
        <h2>불러오는 중…</h2>
        <div className="bar"><div className="fill" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <p className="small">{Math.round(progress * 100)}%</p>
      </Frame>
    </div>
  );
}

export function LoadError({ files }: { files: string[] }) {
  const s = useServices();
  const [busy, setBusy] = useState(false);
  const retry = () => {
    if (busy) return;
    setBusy(true);
    sendCommand(s, { type: 'retryLoad' });
    setTimeout(() => setBusy(false), 500);
  };
  return (
    <div className="screen center" data-testid="load-error">
      <Frame>
        <h2>오류</h2>
        <p>{STORY.ui.loadError}</p>
        <ul className="files">{files.map((f) => <li key={f}>{f}</li>)}</ul>
        <MenuList items={[{ label: '다시 시도', onSelect: retry, testId: 'retry-load' }]} />
      </Frame>
    </div>
  );
}

export function requestFullscreen(onFail: (msg: string) => void): void {
  const root = document.querySelector('.app-root') as HTMLElement | null;
  if (!root) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
    return;
  }
  root.requestFullscreen?.().catch(() => onFail(STORY.ui.fullscreenPermission));
}

function useFullscreen(): boolean {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return on;
}

function BackButton({ focused, onHover, onClick }: { focused: boolean; onHover: () => void; onClick: () => void }) {
  return (
    <div role="button" className={`back-button ${focused ? 'focused' : ''}`} onMouseEnter={onHover} onClick={onClick}>
      <span aria-hidden="true">‹</span> 돌아가기
    </div>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const s = useServices();
  const [vol, setVol] = useState({ bgm: Math.round(s.audio.bgmVolume * 100), sfx: Math.round(s.audio.sfxVolume * 100) });
  const [note, setNote] = useState('');
  const fullscreen = useFullscreen();
  // The only 0–100 → 0–1 conversion; values are session-only (no persistence).
  useEffect(() => sendCommand(s, { type: 'setVolume', bgm: vol.bgm / 100, sfx: vol.sfx / 100 }), [vol, s]);
  const set = (key: 'bgm' | 'sfx', value: number) => setVol((v) => ({ ...v, [key]: Math.max(0, Math.min(100, Math.round(value))) }));
  const adjust = (i: number, d: number) => { if (i < 2) set(i === 0 ? 'bgm' : 'sfx', (i === 0 ? vol.bgm : vol.sfx) + d); };
  const toggleFullscreen = (source: InputSource) => {
    // Pad polling is not a browser user activation: ask for a click / Enter instead of failing silently.
    if (source === 'pad') { setNote('전체 화면은 이 항목을 클릭하거나 Enter를 눌러 변경해 주세요.'); return; }
    setNote('');
    requestFullscreen(setNote);
  };
  // While fullscreen, the first back press only leaves fullscreen (a fresh press then closes settings).
  const back = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else onClose(); };
  const { index, setIndex } = useMenu({
    count: 4,
    onLeft: (i) => adjust(i, -VOLUME_STEP),
    onRight: (i) => adjust(i, VOLUME_STEP),
    onConfirm: (i, src) => { if (i === 2) toggleFullscreen(src); else if (i === 3) onClose(); },
    onCancel: back,
  });
  return (
    <div className="screen center dim" data-testid="settings">
      <Frame className="sheet">
        <header className="subhead">
          <div><p className="eyebrow">고려의 수호자</p><h2>설정</h2></div>
          <span className="section-mark" aria-hidden="true">◇</span>
        </header>
        <div className="settings-list">
          {(['bgm', 'sfx'] as const).map((key, i) => (
            <div key={key} className={`setting-row ${index === i ? 'focused' : ''}`} onMouseEnter={() => setIndex(i)}>
              <span className="setting-label">{key === 'bgm' ? '배경 음악' : '효과음'}<span>{key.toUpperCase()}</span></span>
              <input className="range" type="range" min={0} max={100} step={1} value={vol[key]} tabIndex={-1} data-testid={`volume-${key}`}
                aria-label={key === 'bgm' ? '배경 음악' : '효과음'} aria-valuetext={`${vol[key]}%`}
                style={{ background: `linear-gradient(to right, #d5b35e ${vol[key]}%, #253245 ${vol[key]}%)` }}
                onChange={(e) => set(key, Number(e.currentTarget.value))}
                // Hand focus back after a drag so arrows/pad keep the 5-step menu control (no native 1-step).
                onPointerUp={(e) => e.currentTarget.blur()} />
              <output className="volume-value">{vol[key]}<span>%</span></output>
            </div>
          ))}
          <div role="button" data-testid="fullscreen" className={`setting-row ${index === 2 ? 'focused' : ''}`} onMouseEnter={() => setIndex(2)} onClick={() => toggleFullscreen('keyboard')}>
            <span className="setting-label">전체 화면<span>DISPLAY</span></span>
            <span className="fullscreen-state">{fullscreen ? '사용 중' : '창 모드'}</span>
            <span className={`switch ${fullscreen ? 'on' : ''}`} aria-hidden="true"><i /></span>
          </div>
        </div>
        <p className="settings-message" role="status">{note || '변경 사항은 바로 적용되며, 새로고침하면 기본 설정으로 돌아갑니다.'}</p>
        <footer className="sheet-footer">
          <span className="hint">↑ ↓ 이동 · ← → 음량 조절</span>
          <BackButton focused={index === 3} onHover={() => setIndex(3)} onClick={onClose} />
        </footer>
      </Frame>
    </div>
  );
}

const CONTROL_PAGES = [
  {
    title: '이동 · 기본 검술',
    rows: [
      ['좌우 이동', '왼쪽 스틱', 'A / D'],
      ['점프', 'A', 'Space'],
      ['달리기', 'LT 유지', 'Ctrl 유지'],
      ['공격형 대쉬', 'RT', 'Shift'],
      ['약공격 (3연타)', 'B', 'J'],
      ['강공격', 'Y', 'K'],
    ],
    note: '대쉬는 공격 동작입니다. 대쉬 중에도 적의 공격에 맞을 수 있습니다.',
  },
  {
    title: '패링 · 차징 · 지휘',
    rows: [
      ['패링', 'X', 'L'],
      ['3단계 차징', 'B + Y 유지', 'J + K 유지'],
      ['콤보 마무리', 'B → B → B → Y', 'J → J → J → K'],
      ['지휘 스킬 선택', 'LB', 'Q'],
      ['선택 스킬 발동', 'RB', 'E'],
      ['일시정지', 'START', 'Esc'],
    ],
    note: '차징은 0.5 / 1.0 / 1.5초에 강화됩니다. 패링에 성공하면 적이 경직되니 직접 반격하세요. 붉게 빛나는 보스 공격은 패링할 수 없습니다.',
  },
] as const;

export function Controls({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const flip = () => setPage((p) => 1 - p);
  // Items: [page tab 1, page tab 2, back]. ← → flips the page from anywhere.
  const { index, setIndex } = useMenu({
    count: 3,
    onLeft: () => { flip(); setIndex(1 - page); },
    onRight: () => { flip(); setIndex(1 - page); },
    onConfirm: (i) => { if (i < 2) setPage(i); else onClose(); },
    onCancel: onClose,
  });
  const p = CONTROL_PAGES[page];
  return (
    <div className="screen center dim" data-testid="controls">
      <Frame className="sheet">
        <header className="subhead">
          <div><p className="eyebrow">고려의 수호자</p><h2>조작 방법</h2></div>
          <span className="page-counter" data-testid="controls-page">{page + 1}<span> / 2</span></span>
        </header>
        <div className="tabs" role="tablist">
          {CONTROL_PAGES.map((cp, i) => (
            <div key={cp.title} role="tab" aria-selected={page === i} className={`tab ${page === i ? 'active' : ''} ${index === i ? 'focused' : ''}`}
              onMouseEnter={() => setIndex(i)} onClick={() => setPage(i)}>{cp.title}</div>
          ))}
        </div>
        <table className="controls">
          <thead><tr><th>동작</th><th>Xbox형 게임패드</th><th>키보드</th></tr></thead>
          <tbody>{p.rows.map(([action, pad, key]) => (
            <tr key={action}><th>{action}</th><td><kbd>{pad}</kbd></td><td><kbd>{key}</kbd></td></tr>
          ))}</tbody>
        </table>
        <p className="control-note">{p.note}</p>
        <footer className="sheet-footer">
          <span className="hint">← → 페이지 · Esc / B 뒤로</span>
          <BackButton focused={index === 2} onHover={() => setIndex(2)} onClick={onClose} />
        </footer>
      </Frame>
    </div>
  );
}

export function Title({ padNotice, padActive }: { padNotice: string | null; padActive: boolean }) {
  const s = useServices();
  const [sub, setSub] = useState<'settings' | 'controls' | null>(null);
  return (
    <div className="screen" data-testid="title">
      <div className="title-block">
        <h1><img className="title-logo" src={TITLE_LOGO} alt="강감찬: 고려의 수호자" draggable={false} /></h1>
      </div>
      <Frame className="title-menu">
        <MenuList enabled={!sub} items={[
          { label: '게임 시작', glyph: 'sword', onSelect: () => sendCommand(s, { type: 'startGame' }), testId: 'start' },
          { label: '조작 방법', glyph: 'book', onSelect: () => setSub('controls'), testId: 'open-controls' },
          { label: '설정', glyph: 'gear', onSelect: () => setSub('settings'), testId: 'open-settings' },
        ]} />
        <footer className="title-footer">
          <span className={`device-dot ${padActive ? 'connected' : ''}`} aria-hidden="true" />
          <span>{padActive ? '스틱 / 방향키 이동 · A 선택 · B 뒤로' : '↑ ↓ 이동 · Enter 선택 · Esc 뒤로'}</span>
        </footer>
      </Frame>
      {padNotice && <p className="pad-notice">{padNotice}</p>}
      <p className="temp-tag">개발 빌드 · 보병·궁병·선봉대장 외 적/보스, 2·3라운드 배경, 엔딩 음악·효과음은 임시 자료</p>
      {sub === 'settings' && <Settings onClose={() => setSub(null)} />}
      {sub === 'controls' && <Controls onClose={() => setSub(null)} />}
    </div>
  );
}

export function ConfirmExit({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="screen center dim" data-testid="confirm-exit">
      <Frame>
        <p>{STORY.ui.exitConfirm}</p>
        <p className="small">다음 게임은 1라운드부터 시작합니다.</p>
        <MenuList initial={0} onCancel={onCancel} items={[
          { label: '취소', onSelect: onCancel, testId: 'confirm-cancel' },
          { label: '메인 메뉴로', glyph: 'home', onSelect: onConfirm, testId: 'confirm-ok' },
        ]} />
      </Frame>
    </div>
  );
}

export function Pause({ note }: { note: string | null }) {
  const s = useServices();
  const [sub, setSub] = useState<'settings' | 'controls' | 'confirm' | null>(null);
  const resume = () => sendCommand(s, { type: 'resume' });
  return (
    <div className="screen center dim" data-testid="pause">
      <Frame>
        <h2>{STORY.ui.paused}</h2>
        {note && <p className="small">{note}</p>}
        <MenuList enabled={!sub} onCancel={resume} items={[
          { label: '계속하기', glyph: 'sword', onSelect: resume, testId: 'resume' },
          { label: '조작 방법', glyph: 'book', onSelect: () => setSub('controls') },
          { label: '설정', glyph: 'gear', onSelect: () => setSub('settings') },
          { label: '메인 메뉴', glyph: 'home', onSelect: () => setSub('confirm'), testId: 'to-menu' },
        ]} />
      </Frame>
      {sub === 'settings' && <Settings onClose={() => setSub(null)} />}
      {sub === 'controls' && <Controls onClose={() => setSub(null)} />}
      {sub === 'confirm' && <ConfirmExit onCancel={() => setSub(null)} onConfirm={() => sendCommand(s, { type: 'returnToMenu' })} />}
    </div>
  );
}

export function GameOver() {
  const s = useServices();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen center dim red" data-testid="game-over">
      <Frame>
        <h2>패배</h2>
        <p>현재 라운드 처음부터 다시 도전할 수 있습니다. 이전 강화와 기록은 유지됩니다.</p>
        <MenuList enabled={!confirm} items={[
          { label: '재도전', glyph: 'sword', onSelect: () => sendCommand(s, { type: 'retryRound' }), testId: 'retry' },
          { label: '메인 메뉴', glyph: 'home', onSelect: () => setConfirm(true) },
        ]} />
      </Frame>
      {confirm && <ConfirmExit onCancel={() => setConfirm(false)} onConfirm={() => sendCommand(s, { type: 'returnToMenu' })} />}
    </div>
  );
}

export function RuntimeError({ message }: { message: string }) {
  const s = useServices();
  return (
    <div className="screen center dim red" data-testid="runtime-error">
      <Frame>
        <h2>오류가 발생했습니다</h2>
        <p className="small">{message}</p>
        <MenuList items={[
          { label: '현재 라운드 재시도', onSelect: () => sendCommand(s, { type: 'retryRound' }) },
          { label: '메인 메뉴', glyph: 'home', onSelect: () => sendCommand(s, { type: 'returnToMenu' }) },
        ]} />
      </Frame>
    </div>
  );
}

export function PadDisconnected({ padActive }: { padActive: boolean }) {
  const s = useServices();
  const resumeWithPad = () => s.controller.clearAutoPause('pad-disconnected');
  const continueKeyboard = () => {
    s.router.pad.forgetPad();
    s.controller.clearAutoPause('pad-disconnected');
  };
  useMenu({
    count: 1,
    onConfirm: (_i, source) => {
      if (source === 'pad' && padActive) resumeWithPad();
      else if (source === 'keyboard') continueKeyboard();
    },
  });
  return (
    <div className="screen center dim" data-testid="pad-disconnected">
      <Frame>
        <h2>게임패드 연결 해제</h2>
        <p>{STORY.ui.controllerDisconnected}</p>
        <p className="small">{padActive ? '게임패드가 다시 연결되었습니다. A 버튼을 새로 눌러 계속하세요.' : '게임패드 연결을 기다리는 중…'}</p>
        <button className="btn" onClick={continueKeyboard}>키보드로 계속하기 (클릭 / Enter)</button>
      </Frame>
    </div>
  );
}
