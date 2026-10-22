/** Reference only: pure rules, not a complete Phaser implementation. */
const finiteNonNegative = (n, label) => {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${label} must be finite and non-negative`);
  return n;
};
const stack = (n) => {
  if (!Number.isInteger(n) || n < 0 || n > 2) throw new RangeError('stack must be 0, 1, or 2');
  return n;
};
export function swordDamage(base, swordStacks = 0, commandBuff = false) {
  if (!Number.isSafeInteger(base) || base < 0 || base > 1000000) throw new RangeError('invalid base damage');
  // Integer percentages avoid 57.499999999... at positive half boundaries.
  const percent = 100 + 15 * stack(swordStacks) + (commandBuff ? 30 : 0);
  return Math.floor((base * percent + 50) / 100);
}
export function upgradeStats({sword = 0, parry = 0, command = 0} = {}) {
  [sword, parry, command].forEach(stack);
  if (sword + parry + command > 2) throw new RangeError('Only two total reward selections per run');
  return {swordBonus: sword * 0.15, parryWindowMs: 200 + 50 * parry,
    sharedCooldownMs: 20000 - 3000 * command};
}
export function decayShield(shield, elapsedMs, remainingLifetimeMs) {
  [shield, elapsedMs, remainingLifetimeMs].forEach(n => finiteNonNegative(n, 'shield time/value'));
  if (elapsedMs >= remainingLifetimeMs) return {shield: 0, remainingLifetimeMs: 0};
  const next = Math.max(0, shield - 8 * elapsedMs / 1000);
  return {shield: next < 1e-9 ? 0 : next, remainingLifetimeMs: remainingLifetimeMs - elapsedMs};
}
export function applyIncomingDamage({hp, shield, damage, hpInvulnerable = false}) {
  [hp, shield, damage].forEach(n => finiteNonNegative(n, 'damage argument'));
  if (hp <= 0 || hpInvulnerable) return {hp, shield, absorbed: 0, hpDamage: 0, stun: false, invulnerabilityMs: 0};
  const absorbed = Math.min(shield, damage);
  const hpDamage = Math.max(0, damage - absorbed);
  const hurt = hpDamage > 1e-9;
  return {hp: Math.max(0, hp - hpDamage), shield: Math.max(0, shield - absorbed), absorbed,
    hpDamage, stun: hurt, invulnerabilityMs: hurt ? 500 : 0};
}
export function pickupHeal(hp, amount) {
  finiteNonNegative(hp, 'hp'); finiteNonNegative(amount, 'heal');
  if (hp <= 0 || hp >= 100) return {hp, consumed: false};
  return {hp: Math.min(100, hp + amount), consumed: true};
}
export function chargeLevel(heldMs) {
  finiteNonNegative(heldMs, 'heldMs');
  return heldMs >= 1500 ? 3 : heldMs >= 1000 ? 2 : heldMs >= 500 ? 1 : 0;
}
export function chargeReleaseBaseDamage(heldMs) {
  return [25, 20, 35, 50][chargeLevel(heldMs)]; // under 500ms = implementation default ordinary heavy
}
export function resolveTerminal({playerHp, bossHp, bossPresent = true}) {
  if (bossPresent && bossHp <= 0) return 'boss-victory';
  if (playerHp <= 0) return 'game-over';
  return 'continue';
}
export function nearestSpearTargets(player, entities) {
  const filtered = entities.filter(e => e.alive && e.active && !e.blockedByWall &&
    Math.abs(e.x - player.x) <= 180 && Math.abs(e.y - player.y) <= 96);
  return filtered.slice().sort((a,b) => {
    const da = (a.x-player.x)**2 + (a.y-player.y)**2;
    const db = (b.x-player.x)**2 + (b.y-player.y)**2;
    return da-db || a.spawnSerial-b.spawnSerial;
  }).slice(0,5);
}
