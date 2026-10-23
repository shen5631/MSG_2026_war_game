// Reward selection, ending scenes and results.
import { useEffect, useRef } from 'react';
import { DEFAULTS, STORY, UPGRADE_IDS } from '../../config/spec';
import { formatPlayTime, type Stats } from '../../domain/records';
import { UPGRADE_INFO, type UpgradeStacks } from '../../domain/upgrades';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';
import { Frame, MenuGlyph } from './Frame';

export function Rewards({ upgrades, round }: { upgrades: UpgradeStacks; round: number }) {
  const s = useServices();
  const chosen = useRef(false);
  const choose = (i: number) => {
    if (chosen.current) return;
    chosen.current = true;
    sendCommand(s, { type: 'chooseUpgrade', id: UPGRADE_IDS[i] });
  };
  const { index, setIndex } = useMenu({ count: 3, horizontal: true, onConfirm: choose });
  return (
    <div className="screen center dim" data-testid="rewards">
      <Frame className="wide">
        <h2>{round}라운드 승리 · 강화 선택</h2>
        <div className="cards">
          {UPGRADE_IDS.map((id, i) => {
            const info = UPGRADE_INFO[id];
            const n = upgrades[id];
            return (
              <div key={id} data-testid={`reward-${id}`} className={`card ${i === index ? 'focused' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => choose(i)}>
                <h3>{info.name}</h3>
                <p className="small">현재: {info.describe(n)}</p>
                <p>선택 후: <b>{info.describe(n + 1)}</b></p>
                <p className="small">보유 {n}회</p>
              </div>
            );
          })}
        </div>
        <p className="small">같은 강화를 다시 고를 수 있습니다. 선택 후에는 되돌릴 수 없습니다.</p>
      </Frame>
    </div>
  );
}

export function Ending({ index }: { index: number }) {
  const s = useServices();
  const shownAt = useRef(performance.now());
  useEffect(() => { shownAt.current = performance.now(); }, [index]);
  const advance = () => {
    if (performance.now() - shownAt.current < DEFAULTS.ui.endingAdvanceMinMs) return;
    sendCommand(s, { type: 'advanceEnding' });
  };
  useMenu({ count: 1, onConfirm: advance });
  const scene = STORY.ending[Math.min(index, STORY.ending.length - 1)];
  return (
    <div className="screen center ending" data-testid="ending" onClick={advance}>
      <div className="ending-card" data-testid={`ending-${index}`}>
        <h2>{scene.title}</h2>
        <p>{scene.body}</p>
        <p className="small blink">A / Enter : 계속</p>
      </div>
    </div>
  );
}

export function Results({ stats, warnings }: { stats: Stats; warnings: string[] }) {
  const s = useServices();
  const { index } = useMenu({ count: 1, onConfirm: () => sendCommand(s, { type: 'finishResults' }) });
  return (
    <div className="screen center" data-testid="results">
      <Frame className="wide">
        <h2>{STORY.ui.results}</h2>
        <table className="results">
          <tbody>
            <tr><td>총 플레이 시간</td><td data-testid="stat-time">{formatPlayTime(stats.playTimeMs)}</td></tr>
            <tr><td>일반 적 처치 수</td><td data-testid="stat-kills">{stats.normalEnemyKills}</td></tr>
            <tr><td>보스 처치 수</td><td data-testid="stat-bosses">{stats.bossKills}</td></tr>
            <tr><td>패링 성공 횟수</td><td data-testid="stat-parries">{stats.parrySuccesses}</td></tr>
            <tr><td>사망 횟수</td><td data-testid="stat-deaths">{stats.deaths}</td></tr>
          </tbody>
        </table>
        <p className="small">플레이 시간은 첫 라운드 조작 시작부터 최종 보스 승리까지의 실제 플레이 시간(재도전 포함, 웨이브 대기·보스 전환 포함)이며, 메뉴·로딩·보상 선택·일시정지·게임오버 화면·엔딩은 제외합니다. 처치 수에는 재도전 중 처치와 소배압 소환병이 포함되어 50명을 넘을 수 있습니다.</p>
        {warnings.length > 0 && <p className="small warn">기록 무결성 경고 {warnings.length}건 (기술적 정리/위치 보정)</p>}
        <ul className="menu"><li className={`menu-item ${index === 0 ? 'focused' : ''}`} data-testid="results-menu" onClick={() => sendCommand(s, { type: 'finishResults' })}><span className="cursor" aria-hidden="true">▸</span><MenuGlyph kind="home" /><span className="label">메인 메뉴</span><span className="end" aria-hidden="true">◆</span></li></ul>
      </Frame>
    </div>
  );
}
