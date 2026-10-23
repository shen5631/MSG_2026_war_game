// DEV-ONLY test panel (dev server only — App loads it behind import.meta.env.DEV, production builds drop it).
// Toggle with the ` key. Mouse only: buttons never take focus, so Space/Enter keep driving the game.
import { useEffect, useState, type ReactNode } from 'react';
import { BOSS_NAMES, LOCKED, UPGRADE_IDS, type BossId, type UpgradeId } from '../config/spec';
import { useServices } from '../app/useMenu';

const UPGRADE_LABEL: Record<UpgradeId, string> = { sword: '검술', parry: '패링', command_cooldown: '지휘' };
const MAX_UPGRADES = 2;

function Btn({ onClick, children, on }: { onClick: () => void; children: ReactNode; on?: boolean }) {
  return (
    <button type="button" className={`dev-btn ${on ? 'on' : ''}`} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

export default function DevPanel() {
  const s = useServices();
  const c = s.controller;
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote' && !e.repeat) { setOpen((o) => !o); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Live values (boss HP, upgrades) while open.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return <div className="dev-hint">` 테스트 패널</div>;

  const r = c.round;
  const boss = r?.boss ?? null;
  const fighting = !!(r && boss && r.bossStage === 'fight' && boss.alive);
  const u = c.upgrades;
  const total = u.sword + u.parry + u.command_cooldown;
  // Handlers read the LIVE round at click time (the rendered values may be up to 250 ms old).
  const toBoss = () => { const rr = c.round; if (!rr) return; rr.debugSkipArenas(); rr.debugTeleport(rr.spec.bossArena.playerEntryX + 2); };
  const bossHpTo = (target: (b: NonNullable<typeof boss>) => number) => {
    const rr = c.round;
    const b = rr?.boss;
    if (rr && b && rr.bossStage === 'fight' && b.alive) rr.debugDamageBoss(Math.max(0, b.hp - target(b)));
  };

  return (
    <div className="dev-panel" data-testid="dev-panel">
      <header>테스트 패널 <small>(개발 서버 전용 · ` 닫기)</small></header>
      <section>
        <h4>바로 가기</h4>
        <div className="row">
          {[1, 2, 3].map((n) => <Btn key={n} onClick={() => c.debugStartRound(n)}>{n}라운드 시작</Btn>)}
        </div>
        <div className="row">
          <Btn onClick={toBoss}>현재 라운드 보스전</Btn>
          <Btn onClick={() => c.debugShowEnding()}>엔딩</Btn>
          <Btn onClick={() => c.debugShowResults()}>결과</Btn>
        </div>
      </section>
      <section>
        <h4>전투 {fighting && boss ? `· ${BOSS_NAMES[boss.bossId as BossId]} HP ${Math.ceil(boss.hp)}/${boss.maxHp} · ${boss.phase}페이즈` : ''}</h4>
        <div className="row">
          <Btn onClick={() => c.round?.debugKillWave()}>현재 웨이브 정리</Btn>
          <Btn onClick={() => { if (c.round) c.round.player.hp = LOCKED.player.maxHp; }}>HP 회복</Btn>
          <Btn onClick={() => { if (c.round) c.round.player.cooldownRemaining = 0; }}>쿨타임 초기화</Btn>
        </div>
        <div className="row">
          <Btn on={c.debugInvincible} onClick={() => c.debugSetInvincible(!c.debugInvincible)}>무적 {c.debugInvincible ? 'ON' : 'OFF'}</Btn>
          <Btn onClick={() => bossHpTo((b) => b.phase2Threshold + 1)}>보스 2페이즈 직전</Btn>
          <Btn onClick={() => bossHpTo(() => 0)}>보스 처치</Btn>
        </div>
      </section>
      <section>
        <h4>강화 <small>(다음 라운드 시작부터 적용, 총 {MAX_UPGRADES}회)</small></h4>
        <div className="row">
          {UPGRADE_IDS.map((id) => (
            <span key={id} className="upg">
              {UPGRADE_LABEL[id]} {u[id]}
              <Btn onClick={() => c.debugSetUpgrades({ ...u, [id]: Math.max(0, u[id] - 1) })}>−</Btn>
              <Btn onClick={() => { if (total < MAX_UPGRADES) c.debugSetUpgrades({ ...u, [id]: u[id] + 1 }); }}>+</Btn>
            </span>
          ))}
        </div>
      </section>
      <p className="dev-state">상태: {c.phase} · {c.roundIndex}라운드{r ? ` · x ${Math.round(r.player.body.x)}` : ''}</p>
    </div>
  );
}
