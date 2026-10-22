import type { CSSProperties } from 'react';
import { assetUrl, atlasCssGeometry, cooldownFrame, SKILL_LABELS, type SkillId, type GaugeResolution } from './core';
import './skill-gauges.css';

export interface SkillGaugeIconProps {
  skill: SkillId;
  remainingMs: number;
  totalMs: number;
  selected?: boolean;
  size?: number;
  resolution?: GaugeResolution;
  /** e.g. `${import.meta.env.BASE_URL}assets/skill_gauges_v1` */
  assetBaseUrl: string;
}
/** Pure view: does NOT own a timer, activate skills, poll gamepads, or change gameplay. */
export function SkillGaugeIcon({
  skill, remainingMs, totalMs, selected = false, size = 32, resolution = 64, assetBaseUrl,
}: SkillGaugeIconProps) {
  const percent = cooldownFrame(remainingMs, totalMs);
  const style: CSSProperties = {
    ...atlasCssGeometry(skill, percent, size, resolution),
    backgroundImage: `url("${assetUrl(assetBaseUrl, `atlas/skill_gauges_${resolution}.png`)}")`,
  };
  return <span
    className={`ggc-skill-gauge${selected ? ' is-selected' : ''}${percent === 100 ? ' is-ready' : ''}`}
    role="img"
    aria-label={`${SKILL_LABELS[skill]}: ${percent === 100 ? '사용 준비' : `재사용 대기, ${percent}%`}`}
    data-skill={skill}
    data-frame={percent}
    style={style}
  />;
}
