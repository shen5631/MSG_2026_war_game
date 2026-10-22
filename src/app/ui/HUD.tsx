import { useEffect, useState } from 'react';
import { SKILL_CYCLE, SKILL_NAMES, STORY, type SkillId } from '../../config/spec';
import type { HudSnapshot } from '../../domain/round';
import { useServices } from '../useMenu';

const SKILL_ICON: Record<SkillId, string> = { command_buff: '旗', spear_support: '槍', shield_guard: '盾' };

export function HUD() {
  const s = useServices();
  const [h, setH] = useState<HudSnapshot | null>(null);
  const [phaseBanner, setPhaseBanner] = useState(false);
  useEffect(() => s.controller.onHud(setH), [s]);
  useEffect(() => s.controller.onEvent((e) => {
    if (e.type === 'bossPhase2') {
      setPhaseBanner(true);
      setTimeout(() => setPhaseBanner(false), 1400);
    }
  }), [s]);
  if (!h) return null;
  const cdRatio = h.cooldownTotalMs > 0 ? h.cooldownRemainingMs / h.cooldownTotalMs : 0;
  return (
    <div className="hud" data-testid="hud">
      <div className="hud-hp" data-testid="hud-hp">
        <div className="label">HP <b>{h.hp}</b>/{h.maxHp}</div>
        {/* Red drops at once; the orange trail behind it catches up slowly (CSS transition with a short delay). */}
        <div className="hpbar"><div className="lag" style={{ width: `${h.hp}%` }} /><div className="fill" style={{ width: `${h.hp}%` }} /></div>
        <div className="statuses">
          {h.shield > 0 && <span className="tag shield" data-testid="hud-shield">방패 {Math.ceil(h.shield)} · {(h.shieldRemainingMs / 1000).toFixed(1)}초</span>}
          {h.buffRemainingMs > 0 && <span className="tag buff" data-testid="hud-buff">지휘 강화 {(h.buffRemainingMs / 1000).toFixed(1)}초</span>}
        </div>
      </div>
      <div className="hud-round" data-testid="hud-round">
        <div>{h.round}라운드 · {h.roundName}</div>
        <div className="small">{h.arenaLabel}{h.waveLabel ? ` · ${h.waveLabel}` : ''}</div>
      </div>
      {h.boss && (
        <div className="hud-boss" data-testid="hud-boss">
          <div className="name">{h.boss.name} {h.boss.phase === 2 && <span className="phase">{STORY.ui.phase2}</span>}</div>
          <div className="bossbar"><div className="lag" style={{ width: `${(h.boss.hp / h.boss.maxHp) * 100}%` }} /><div className="fill" style={{ width: `${(h.boss.hp / h.boss.maxHp) * 100}%` }} /><div className="half" /></div>
        </div>
      )}
      {phaseBanner && <div className="phase-banner">{STORY.ui.phase2}</div>}
      <div className="hud-skills" data-testid="hud-skills">
        {SKILL_CYCLE.map((id) => (
          <div key={id} className={`skill ${h.selectedSkill === id ? 'selected' : ''} ${cdRatio > 0 ? 'cooling' : ''}`}>
            <span className="icon">{SKILL_ICON[id]}</span>
            <span className="cd" style={{ height: `${cdRatio * 100}%` }} />
            <span className="nm">{SKILL_NAMES[id]}</span>
          </div>
        ))}
        <div className="cd-text" data-testid="hud-cooldown">{h.cooldownRemainingMs > 0 ? `공유 쿨타임 ${(h.cooldownRemainingMs / 1000).toFixed(1)}초` : h.spearReserved ? '창병 명령 대기' : '지휘 준비'}</div>
      </div>
      {h.exitOpen && <div className="exit-hint">출구가 열렸습니다 →</div>}
    </div>
  );
}

export function Toasts() {
  const s = useServices();
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let n = 0;
    return s.controller.onEvent((e) => {
      if (e.type !== 'toast') return;
      const id = ++n;
      setItems((prev) => [...prev.filter((p) => p.text !== e.text).slice(-2), { id, text: e.text }]);
      setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== id)), 2000);
    });
  }, [s]);
  return <div className="toasts">{items.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}
