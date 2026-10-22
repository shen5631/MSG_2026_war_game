// HP bar geometry (percent of the bar width). Display only — HP and shield values come from the simulation.

/**
 * Blue shield segment drawn inside the HP bar: it continues right after the red HP fill.
 * When HP + shield would overflow the bar, the segment keeps its full size and covers the
 * right end of the red fill, so the shield amount is always readable.
 */
export function shieldSegment(hp: number, shield: number, maxHp: number): { left: number; width: number } {
  if (shield <= 0 || maxHp <= 0) return { left: 0, width: 0 };
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const width = Math.min(100, (shield / maxHp) * 100);
  return { left: Math.max(0, Math.min(hpPct, 100 - width)), width };
}
