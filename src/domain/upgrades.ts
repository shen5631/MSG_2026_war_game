import { LOCKED, type UpgradeId } from '../config/spec';

export interface UpgradeStacks { sword: number; parry: number; command_cooldown: number }

export const emptyUpgrades = (): UpgradeStacks => ({ sword: 0, parry: 0, command_cooldown: 0 });

export const totalSelections = (u: UpgradeStacks): number => u.sword + u.parry + u.command_cooldown;

export function canChooseUpgrade(u: UpgradeStacks): boolean {
  return totalSelections(u) < LOCKED.upgrades.maxTotalSelections;
}

export function applyUpgrade(u: UpgradeStacks, id: UpgradeId): UpgradeStacks {
  if (!canChooseUpgrade(u)) throw new RangeError('Only two total reward selections per run');
  return { ...u, [id]: u[id] + 1 };
}

export function parryWindowMs(u: UpgradeStacks): number {
  return LOCKED.player.baseParryWindowMs + LOCKED.upgrades.parryWindowIncreaseMsPerStack * u.parry;
}

export function sharedCooldownMs(u: UpgradeStacks): number {
  return LOCKED.skills.baseSharedCooldownMs - LOCKED.upgrades.sharedCooldownReductionMsPerStack * u.command_cooldown;
}

export function swordBonusPercent(u: UpgradeStacks): number {
  return 15 * u.sword;
}

export const UPGRADE_INFO: Record<UpgradeId, { name: string; describe: (stacks: number) => string }> = {
  sword: { name: '검술 강화', describe: (n) => `검술 피해 +${15 * n}%` },
  parry: { name: '패링 강화', describe: (n) => `패링 판정 ${200 + 50 * n}ms` },
  command_cooldown: { name: '지휘 숙련', describe: (n) => `지휘 공유 쿨타임 ${(20000 - 3000 * n) / 1000}초` },
};
