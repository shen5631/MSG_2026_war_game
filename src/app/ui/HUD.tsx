import { useEffect, useState } from 'react';
import { SKILL_CYCLE, SKILL_NAMES, STORY, type SkillId } from '../../config/spec';
import type { HudSnapshot } from '../../domain/round';
import { useServices } from '../useMenu';
import { SkillGaugeIcon } from '../../skill-gauges/SkillGaugeIcon';
import { shieldSegment } from './hudBars';
import type { SkillId as GaugeSkillId } from '../../skill-gauges/core';

const GAUGE_SKILL: Record<SkillId, GaugeSkillId> = { command_buff: 'command', spear_support: 'spear', shield_guard: 'shield' };
/** Registered in spec/runtime_assets.json (ui_skill_gauges_64) so the boot loader has it cached. */
const GAUGE_BASE = `${import.meta.env.BASE_URL}assets/skill_gauges_v1`;

export function HUD() {
  const s = useServices();
  const [h, setH] = useState<HudSnapshot | null>(null);
  const [phaseBanner, setPhaseBanner] = useState(false);
  const [hurtFlash, setHurtFlash] = useState(0);
  useEffect(() => s.controller.onHud(setH), [s]);
  useEffect(() => s.controller.onEvent((e) => {
    // A new key remounts the vignette so its fade restarts on every hit.
    if (e.type === 'playerDamaged') setHurtFlash((n) => n + 1);
    if (e.type === 'bossPhase2') {
      setPhaseBanner(true);
      setTimeout(() => setPhaseBanner(false), 1400);
    }
  }), [s]);
  if (!h) return null;
  // The game's one shared cooldown, passed identically to all three icons (no UI timer). 000 = just used, 100 = ready.
  const cdRemaining = Math.max(0, h.cooldownRemainingMs);
  const cdTotal = Math.max(1, h.cooldownTotalMs);
  const sh = shieldSegment(h.hp, h.shield, h.maxHp);
  return (
    <div className="hud" data-testid="hud">
      {hurtFlash > 0 && <div key={hurtFlash} className="damage-vignette" data-testid="damage-vignette" />}
      <div className="hud-hp" data-testid="hud-hp">
        <div className="label">HP <b>{h.hp}</b>/{h.maxHp}</div>
        {/* Red drops at once; the orange trail behind it catches up slowly (CSS transition with a short delay). */}
        <div className="hpbar">
          <div className="lag" style={{ width: `${h.hp}%` }} />
          <div className="fill" style={{ width: `${h.hp}%` }} />
          {/* Shield (방패병 막기) as a blue segment inside the bar instead of a text tag. */}
          {sh.width > 0 && <div className="shield" data-testid="hud-shield" style={{ left: `${sh.left}%`, width: `${sh.width}%` }} />}
        </div>
        <div className="statuses">
          {h.buffRemainingMs > 0 && <span className="tag buff" data-testid="hud-buff">지휘 강화 {(h.buffRemainingMs / 1000).toFixed(1)}초</span>}
        </div>
      </div>
      <div className="hud-round" data-testid="hud-round">
        <div>{h.round}라운드 · {h.roundName}</div>
        <div className="small">{h.arenaLabel}{h.waveLabel ? ` · ${h.waveLabel}` : ''}</div>
      </div>
      {h.boss && (
        // Boss plate in the menu style: name between gold ornaments, phase badge, framed bar with the 50% phase notch.
        <div className={`hud-boss ${h.boss.phase === 2 ? 'p2' : ''}`} data-testid="hud-boss">
          <div className="boss-plate">
            <i className="orn" aria-hidden="true" />
            <span className="name">{h.boss.name}</span>
            <i className="orn" aria-hidden="true" />
            <span className="phase" data-testid="hud-boss-phase">{h.boss.phase === 2 ? STORY.ui.phase2 : '1페이즈'}</span>
          </div>
          <div className="bossbar">
            <div className="lag" style={{ width: `${(h.boss.hp / h.boss.maxHp) * 100}%` }} />
            <div className="fill" style={{ width: `${(h.boss.hp / h.boss.maxHp) * 100}%` }} />
            <div className="sheen" aria-hidden="true" />
            <div className="half" aria-hidden="true" />
          </div>
          <div className="boss-hp-num">{Math.ceil(h.boss.hp)} / {h.boss.maxHp}</div>
        </div>
      )}
      {phaseBanner && <div className="phase-banner">{STORY.ui.phase2}</div>}
      <div className="hud-skills" data-testid="hud-skills">
        {SKILL_CYCLE.map((id) => (
          <div key={id} className={`skill ${h.selectedSkill === id ? 'selected' : ''} ${cdRemaining > 0 ? 'cooling' : ''}`} data-testid={`hud-skill-${id}`}>
            <SkillGaugeIcon skill={GAUGE_SKILL[id]} remainingMs={cdRemaining} totalMs={cdTotal} size={30} selected={h.selectedSkill === id} assetBaseUrl={GAUGE_BASE} />
            <span className="nm">{SKILL_NAMES[id]}</span>
          </div>
        ))}
        {/* Status badge (not a skill name): framed chip with a state dot, separate from the icon labels. */}
        <div className={`skill-status ${cdRemaining > 0 ? 'cooling' : h.spearReserved ? 'waiting' : 'ready'}`} data-testid="hud-cooldown">
          <span className="eyebrow">공유 쿨타임</span>
          <span className="value">
            {cdRemaining > 0 ? <b>{(cdRemaining / 1000).toFixed(1)}<small>초</small></b> : <><i aria-hidden="true">◆</i>{h.spearReserved ? '창병 명령 대기' : '지휘 준비'}</>}
          </span>
          {/* Same shared cooldown as the icons; display only. */}
          <span className="meter" aria-hidden="true"><span style={{ width: `${cdRemaining > 0 ? (1 - Math.min(cdRemaining, cdTotal) / cdTotal) * 100 : 100}%` }} /></span>
        </div>
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
