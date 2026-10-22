// Title, settings, controls, pause, confirm, game over, loading and error screens.
import { useEffect, useState } from 'react';
import { STORY } from '../../config/spec';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';
import { MenuList } from './MenuList';

/** Registered in spec/runtime_assets.json (ui_title_logo), so it is already cached by the boot loader. */
const TITLE_LOGO = `${import.meta.env.BASE_URL}assets/ui/title_logo.png`;

export function Loading({ progress }: { progress: number }) {
  return (
    <div className="screen center" data-testid="loading">
      <div className="panel">
        <h2>불러오는 중…</h2>
        <div className="bar"><div className="fill" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <p className="small">{Math.round(progress * 100)}%</p>
      </div>
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
      <div className="panel">
        <h2>오류</h2>
        <p>{STORY.ui.loadError}</p>
        <ul className="files">{files.map((f) => <li key={f}>{f}</li>)}</ul>
        <MenuList items={[{ label: '다시 시도', onSelect: retry, testId: 'retry-load' }]} />
      </div>
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

export function Settings({ onClose }: { onClose: () => void }) {
  const s = useServices();
  const [bgm, setBgm] = useState(Math.round(s.audio.bgmVolume * 100));
  const [sfx, setSfx] = useState(Math.round(s.audio.sfxVolume * 100));
  const [note, setNote] = useState('');
  useEffect(() => sendCommand(s, { type: 'setVolume', bgm: bgm / 100, sfx: sfx / 100 }), [bgm, sfx, s]);
  const adjust = (i: number, d: number) => {
    if (i === 0) setBgm((v) => Math.max(0, Math.min(100, v + d)));
    if (i === 1) setSfx((v) => Math.max(0, Math.min(100, v + d)));
  };
  const fs = () => requestFullscreen(setNote);
  return (
    <div className="screen center dim" data-testid="settings">
      <div className="panel">
        <h2>설정</h2>
        <MenuList
          onCancel={onClose}
          onLeft={(i) => adjust(i, -10)}
          onRight={(i) => adjust(i, 10)}
          items={[
            { label: <span className="slider">배경음악 <button onClick={(e) => { e.stopPropagation(); adjust(0, -10); }}>◀</button> <b>{bgm}%</b> <button onClick={(e) => { e.stopPropagation(); adjust(0, 10); }}>▶</button></span>, onSelect: () => adjust(0, 10) },
            { label: <span className="slider">효과음 <button onClick={(e) => { e.stopPropagation(); adjust(1, -10); }}>◀</button> <b>{sfx}%</b> <button onClick={(e) => { e.stopPropagation(); adjust(1, 10); }}>▶</button></span>, onSelect: () => adjust(1, 10) },
            { label: document.fullscreenElement ? '전체 화면 해제' : '전체 화면', onSelect: fs, testId: 'fullscreen' },
            { label: '돌아가기', onSelect: onClose },
          ]}
        />
        {note && <p className="note" onClick={fs}>{note}</p>}
        <p className="small">볼륨 설정은 이 세션 동안만 유지됩니다.</p>
      </div>
    </div>
  );
}

export function Controls({ onClose }: { onClose: () => void }) {
  const rows: [string, string, string][] = [
    ['좌우 이동', '왼쪽 스틱', 'A / D'],
    ['점프', 'A', 'Space'],
    ['약공격 (3연타)', 'B', 'J'],
    ['강공격', 'Y', 'K'],
    ['패링', 'X', 'L'],
    ['공격형 대쉬', 'RT', 'Shift'],
    ['달리기 (유지)', 'LT', 'Ctrl'],
    ['지휘 스킬 선택', 'LB', 'Q'],
    ['지휘 스킬 발동', 'RB', 'E'],
    ['3단계 차징', 'B+Y 유지', 'J+K 유지'],
    ['콤보 마무리', 'B→B→B→Y', 'J→J→J→K'],
    ['일시정지', 'START', 'Esc'],
  ];
  return (
    <div className="screen center dim" data-testid="controls">
      <div className="panel wide">
        <h2>조작 방법</h2>
        <table className="controls">
          <thead><tr><th>행동</th><th>게임패드</th><th>키보드</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
        <p className="small">패링 성공 시 적이 경직됩니다. 반격은 직접 공격해야 합니다. 붉게 빛나는 보스 공격은 패링할 수 없습니다.</p>
        <MenuList items={[{ label: '돌아가기', onSelect: onClose }]} onCancel={onClose} />
      </div>
    </div>
  );
}

export function Title({ padNotice }: { padNotice: string | null }) {
  const s = useServices();
  const [sub, setSub] = useState<'settings' | 'controls' | null>(null);
  return (
    <div className="screen" data-testid="title">
      <div className="title-block">
        <h1><img className="title-logo" src={TITLE_LOGO} alt="강감찬: 고려의 수호자" draggable={false} /></h1>
      </div>
      <div className="title-menu">
        <MenuList enabled={!sub} items={[
          { label: '게임 시작', onSelect: () => sendCommand(s, { type: 'startGame' }), testId: 'start' },
          { label: '조작 방법', onSelect: () => setSub('controls'), testId: 'open-controls' },
          { label: '설정', onSelect: () => setSub('settings'), testId: 'open-settings' },
        ]} />
      </div>
      <p className="title-hint">게임패드 A / Enter: 선택 · 방향키: 이동</p>
      {padNotice && <p className="pad-notice">{padNotice}</p>}
      <p className="temp-tag">개발 빌드 · 보병·궁병 외 적/보스, 2·3라운드 배경, 타이틀·엔딩 음악·효과음은 임시 자료</p>
      {sub === 'settings' && <Settings onClose={() => setSub(null)} />}
      {sub === 'controls' && <Controls onClose={() => setSub(null)} />}
    </div>
  );
}

export function ConfirmExit({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="screen center dim" data-testid="confirm-exit">
      <div className="panel">
        <p>{STORY.ui.exitConfirm}</p>
        <p className="small">다음 게임은 1라운드부터 시작합니다.</p>
        <MenuList initial={0} onCancel={onCancel} items={[
          { label: '취소', onSelect: onCancel, testId: 'confirm-cancel' },
          { label: '메인 메뉴로', onSelect: onConfirm, testId: 'confirm-ok' },
        ]} />
      </div>
    </div>
  );
}

export function Pause({ note }: { note: string | null }) {
  const s = useServices();
  const [sub, setSub] = useState<'settings' | 'controls' | 'confirm' | null>(null);
  const resume = () => sendCommand(s, { type: 'resume' });
  return (
    <div className="screen center dim" data-testid="pause">
      <div className="panel">
        <h2>{STORY.ui.paused}</h2>
        {note && <p className="small">{note}</p>}
        <MenuList enabled={!sub} onCancel={resume} items={[
          { label: '계속하기', onSelect: resume, testId: 'resume' },
          { label: '조작 방법', onSelect: () => setSub('controls') },
          { label: '설정', onSelect: () => setSub('settings') },
          { label: '메인 메뉴', onSelect: () => setSub('confirm'), testId: 'to-menu' },
        ]} />
      </div>
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
      <div className="panel">
        <h2>패배</h2>
        <p>현재 라운드 처음부터 다시 도전할 수 있습니다. 이전 강화와 기록은 유지됩니다.</p>
        <MenuList enabled={!confirm} items={[
          { label: '재도전', onSelect: () => sendCommand(s, { type: 'retryRound' }), testId: 'retry' },
          { label: '메인 메뉴', onSelect: () => setConfirm(true) },
        ]} />
      </div>
      {confirm && <ConfirmExit onCancel={() => setConfirm(false)} onConfirm={() => sendCommand(s, { type: 'returnToMenu' })} />}
    </div>
  );
}

export function RuntimeError({ message }: { message: string }) {
  const s = useServices();
  return (
    <div className="screen center dim red" data-testid="runtime-error">
      <div className="panel">
        <h2>오류가 발생했습니다</h2>
        <p className="small">{message}</p>
        <MenuList items={[
          { label: '현재 라운드 재시도', onSelect: () => sendCommand(s, { type: 'retryRound' }) },
          { label: '메인 메뉴', onSelect: () => sendCommand(s, { type: 'returnToMenu' }) },
        ]} />
      </div>
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
      <div className="panel">
        <h2>게임패드 연결 해제</h2>
        <p>{STORY.ui.controllerDisconnected}</p>
        <p className="small">{padActive ? '게임패드가 다시 연결되었습니다. A 버튼을 새로 눌러 계속하세요.' : '게임패드 연결을 기다리는 중…'}</p>
        <button className="btn" onClick={continueKeyboard}>키보드로 계속하기 (클릭 / Enter)</button>
      </div>
    </div>
  );
}
