// Control guide shown once after 시작하기: the real round-1 screen is held (pause reason 'tutorial') and dimmed,
// except a spotlight on the HUD part or the hero being explained. Menu input path (useMenu): Enter/A next,
// ←/→ previous/next, Esc/B/START skip. Display only; the controller resumes the round on finish or skip.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LOCKED, VIEW_H, VIEW_W } from '../../config/spec';
import { sendCommand } from '../bridge';
import { useMenu, useServices } from '../useMenu';

type Target = { kind: 'hud'; testId: string } | { kind: 'hero' } | null;
interface Step { title: string; target: Target; lines: ReactNode[]; pad?: ReactNode }
interface Rect { x: number; y: number; w: number; h: number }

const K = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;
const SKILLS = LOCKED.skills;

export const TUTORIAL_STEPS: Step[] = [
  {
    title: '고려를 지켜라!',
    target: null,
    lines: [
      '거란군이 고려를 침입했습니다. 강감찬이 되어 세 번의 전투를 이겨내세요.',
      '라운드마다 적의 무리를 물리치고 나면 마지막에 적장이 기다립니다.',
    ],
  },
  {
    title: '이동',
    target: { kind: 'hero' },
    lines: [
      <><K>A</K> <K>D</K> 좌우 이동 · <K>Ctrl</K>을 누른 채 이동하면 달리기</>,
      <><K>Space</K> 점프 · <K>Shift</K> 대쉬 (빠르게 돌진하며 적에게 {LOCKED.player.dashDamage} 피해)</>,
      '낮은 바위는 걸어가면 저절로 넘어갑니다.',
    ],
    pad: <>왼쪽 스틱 이동 · <K>LT</K> 달리기 · <K>A</K> 점프 · <K>RT</K> 대쉬</>,
  },
  {
    title: '공격과 패링',
    target: { kind: 'hero' },
    lines: [
      <><K>J</K> 약공격 — 연달아 누르면 3연속 공격</>,
      <><K>K</K> 강공격 — 방패병의 방어를 깨뜨립니다</>,
      <><K>J</K>+<K>K</K> 함께 길게 누르기 — 차징 공격 (오래 누를수록 3단계까지 강해짐)</>,
      <><K>L</K> 패링 — 적의 공격이 닿기 직전에 누르면 적이 휘청입니다. 그 틈에 반격하세요!</>,
    ],
    pad: <><K>B</K> 약공격 · <K>Y</K> 강공격 · <K>B</K>+<K>Y</K> 차징 · <K>X</K> 패링</>,
  },
  {
    title: '체력',
    target: { kind: 'hud', testId: 'hud-hp' },
    lines: [
      `체력은 ${LOCKED.player.maxHp}입니다. 0이 되면 지금 라운드 처음부터 다시 도전합니다 (받은 강화는 유지).`,
      `주먹밥(+${LOCKED.healing.riceball.heal})과 약초(+${LOCKED.healing.herb_pouch.heal})를 주우면 회복합니다. 방패병 막기의 보호막은 파란색으로 표시됩니다.`,
    ],
  },
  {
    title: '라운드와 구역',
    target: { kind: 'hud', testId: 'hud-round' },
    lines: [
      '전투 구역에 들어서면 양옆이 막히고 적이 몰려옵니다. 바닥의 붉은 표식은 적이 나타날 자리입니다.',
      '웨이브를 모두 물리치면 출구가 열립니다. 오른쪽으로 나아가세요.',
    ],
  },
  {
    title: '지휘 스킬',
    target: { kind: 'hud', testId: 'hud-skills' },
    lines: [
      <><K>Q</K> 스킬 고르기 · <K>E</K> 사용</>,
      `지휘 강화: ${SKILLS.command_buff.durationMs / 1000}초 동안 공격력 +${Math.round(SKILLS.command_buff.damageIncrease * 100)}%`,
      `창병 공격: 가까운 적 최대 ${SKILLS.spear_support.maxTargets}명에게 창병이 ${SKILLS.spear_support.damagePerTarget} 피해`,
      `방패병 막기: 보호막 ${SKILLS.shield_guard.initialShield} (최대 ${SKILLS.shield_guard.maxDurationMs / 1000}초)`,
    ],
    pad: <><K>LB</K> 스킬 고르기 · <K>RB</K> 사용</>,
  },
  {
    title: '공유 쿨타임',
    target: { kind: 'hud', testId: 'hud-cooldown' },
    lines: [
      `세 스킬은 쿨타임 ${SKILLS.baseSharedCooldownMs / 1000}초를 함께 씁니다. ‘지휘 준비’가 보이면 사용할 수 있습니다.`,
      '라운드를 마치면 보상으로 검술·패링·지휘를 강화할 수 있습니다.',
    ],
  },
  {
    title: '준비 완료',
    target: null,
    lines: [
      <><K>Esc</K> (게임패드 <K>START</K>) 일시정지 — 조작 방법은 일시정지 메뉴에서 다시 볼 수 있습니다.</>,
      '고려의 운명이 그대의 칼끝에 달렸습니다. 출전!',
    ],
  },
];

const CARD_W = 236;
const GAP = 8;
const HERO_BOX = { w: 56, h: 96 };

export function Tutorial() {
  const s = useServices();
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const step = TUTORIAL_STEPS[i];
  const last = i === TUTORIAL_STEPS.length - 1;

  // Steps advance from a ref so presses that arrive before the next render are not lost.
  const at = useRef(0);
  at.current = i;
  const finish = () => sendCommand(s, { type: 'finishTutorial' });
  const go = (n: number) => { at.current = n; setI(n); };
  const next = () => (at.current >= TUTORIAL_STEPS.length - 1 ? finish() : go(at.current + 1));
  const prev = () => go(Math.max(0, at.current - 1));
  useMenu({ count: 1, onConfirm: next, onRight: next, onLeft: prev, onCancel: finish });

  // Measure the spotlight in 640×360 UI coordinates (the UI layer is scaled by the integer stage factor).
  useLayoutEffect(() => {
    const t = step.target;
    if (!t) { setHole(null); return; }
    if (t.kind === 'hero') {
      const r = s.controller.round;
      if (!r) { setHole(null); return; }
      const b = r.player.body;
      setHole({ x: Math.round(b.x - r.cameraX - HERO_BOX.w / 2), y: Math.round(b.y - HERO_BOX.h + 4), w: HERO_BOX.w, h: HERO_BOX.h });
      return;
    }
    const layer = rootRef.current?.closest('.ui-layer');
    const el = layer?.querySelector(`[data-testid="${t.testId}"]`);
    if (!layer || !el) { setHole(null); return; }
    const L = layer.getBoundingClientRect();
    const E = el.getBoundingClientRect();
    const k = L.width / VIEW_W || 1;
    const pad = 4;
    setHole({ x: (E.left - L.left) / k - pad, y: (E.top - L.top) / k - pad, w: E.width / k + pad * 2, h: E.height / k + pad * 2 });
  }, [i, s, step.target]);
  useLayoutEffect(() => { setCardH(cardRef.current?.offsetHeight ?? 0); }, [i, hole]);

  // 건너뛰기 sits top-right; if the spotlight covers that corner (round info), it drops just below the spotlight.
  const skipTop = hole && hole.x + hole.w > VIEW_W - 90 && hole.y < 28 ? hole.y + hole.h + 4 : 6;
  const skipMoved = skipTop !== 6;
  // Card beside the spotlight: below it when the spotlight is in the upper half, above it otherwise.
  const card = (() => {
    if (!hole) return { left: (VIEW_W - CARD_W) / 2, top: Math.max(8, (VIEW_H - cardH) / 2) };
    const cx = hole.x + hole.w / 2;
    const left = Math.min(VIEW_W - CARD_W - 8, Math.max(8, cx - CARD_W / 2));
    const below = hole.y + hole.h / 2 < VIEW_H / 2;
    // (and below the moved 건너뛰기 button when it shares that corner)
    const top = below ? (skipMoved ? skipTop + 18 + GAP : hole.y + hole.h + GAP) : hole.y - GAP - cardH;
    return { left, top: Math.min(VIEW_H - cardH - 8, Math.max(8, top)) };
  })();

  return (
    <div ref={rootRef} className="tutorial" data-testid="tutorial" data-step={i}>
      {hole ? <div className="tut-hole" data-testid="tutorial-hole" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        : <div className="tut-dim" />}
      <button className="tut-skip" data-testid="tutorial-skip" style={{ top: skipTop }} onClick={finish}>건너뛰기 ▸▸</button>
      <div ref={cardRef} className="tut-card" data-testid="tutorial-card" style={{ left: card.left, top: card.top, width: CARD_W }}>
        <div className="tut-head">
          <span className="tut-step">{i + 1} / {TUTORIAL_STEPS.length}</span>
          <h3>{step.title}</h3>
        </div>
        <ul>{step.lines.map((l, n) => <li key={n}>{l}</li>)}</ul>
        {step.pad && <p className="tut-pad"><span>게임패드</span>{step.pad}</p>}
        <div className="tut-nav">
          <button className="btn" disabled={i === 0} onClick={prev} data-testid="tutorial-prev">◂ 이전</button>
          <span className="tut-dots" aria-hidden="true">{TUTORIAL_STEPS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</span>
          <button className="btn primary" onClick={next} data-testid="tutorial-next">{last ? '전투 시작' : '다음 ▸'}</button>
        </div>
      </div>
    </div>
  );
}
