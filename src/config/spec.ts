// Typed entry point for the spec/*.json data. Locked rules always win over runtime defaults.
import lockedJson from '../../spec/locked_rules.json';
import defaultsJson from '../../spec/runtime_defaults.json';
import levelsJson from '../../spec/levels.json';
import inputMapJson from '../../spec/input_map.json';
import bossPatternsJson from '../../spec/boss_patterns.json';
import enemyPatternsJson from '../../spec/enemy_patterns.json';
import storyJson from '../../spec/story_ko.json';
import bindingsJson from '../../spec/animation_bindings.json';
import runtimeAssetsJson from '../../spec/runtime_assets.json';

export const LOCKED = lockedJson;
export const DEFAULTS = defaultsJson;
export const INPUT_MAP = inputMapJson;
export const STORY = storyJson;
export const ANIMATION_BINDINGS = bindingsJson;
export const RUNTIME_ASSETS = runtimeAssetsJson;

export type EnemyKind = 'infantry' | 'archer' | 'spearman' | 'shieldman' | 'cavalry';
export type BossId = 'vanguard' | 'spear_captain' | 'so_bae_ap';
export type SkillId = 'command_buff' | 'spear_support' | 'shield_guard';
export type UpgradeId = 'sword' | 'parry' | 'command_cooldown';

export interface WaveSpec {
  id: string;
  composition: Partial<Record<EnemyKind, number>>;
  spawnOrder: EnemyKind[];
  count: number;
}
export interface ArenaSpec {
  id: string;
  left: number;
  right: number;
  lockAtPlayerX: number;
  floorY: number;
  nominalSpawnSlotsX: number[];
  waves: WaveSpec[];
}
export interface RoundSpec {
  id: number;
  name: string;
  bossId: BossId;
  worldWidth: number;
  worldHeight: number;
  groundY: number;
  playerStart: { x: number; y: number };
  bossArena: { left: number; width: number; playerEntryX: number; bossSpawnX: number };
  traversalProps: { x: number; kind: 'crate' | 'step' }[];
  arenas: ArenaSpec[];
  normalEnemyCount: number;
}
export const LEVELS = levelsJson as unknown as { rounds: RoundSpec[]; totals: Record<string, number> };

export interface BossPatternSpec {
  id: string;
  phases: number[];
  distanceMinPx?: number;
  distanceMaxPx?: number;
  startupMs: number;
  activeMsPerHit?: number;
  recoveryMs: number;
  damagePerHit: number;
  parryable?: boolean;
  cooldownMs: number;
  hitCount?: number;
  hitSpacingMs?: number;
  telegraph: string;
  maxLivingAndPending?: number;
  slots?: EnemyKind[];
}
export const BOSS_PATTERNS = bossPatternsJson.bosses as unknown as Record<BossId, BossPatternSpec[]>;

export interface EnemyPatternSpec {
  attackRange?: number;
  preferredDistance?: [number, number];
  chargeTriggerDistance?: [number, number];
  startupMs: number;
  activeMs?: number;
  activeMsMax?: number;
  recoveryMs: number;
  projectiles?: number;
}
export const ENEMY_PATTERNS = enemyPatternsJson.enemies as unknown as Record<EnemyKind, EnemyPatternSpec>;

export type AttackKind =
  | 'weak1' | 'weak2' | 'weak3' | 'heavy' | 'finisher'
  | 'charge1' | 'charge2' | 'charge3' | 'air_attack' | 'dash';

export interface AttackTiming { startupMs: number; activeMs: number; recoveryMs: number; reachPx: number; heightPx: number }

const T = DEFAULTS.attackTimings;
export const ATTACK_TIMINGS: Record<Exclude<AttackKind, 'dash'>, AttackTiming> = {
  weak1: T.weak1, weak2: T.weak2, weak3: T.weak3, heavy: T.heavy, finisher: T.finisher,
  charge1: T.charge1, charge2: T.charge2, charge3: T.charge3, air_attack: T.air_attack,
};

/** Locked base damage per attack kind. air_attack 15 is an implementation default. */
export const BASE_DAMAGE: Record<AttackKind, number> = {
  weak1: LOCKED.player.weakDamage[0],
  weak2: LOCKED.player.weakDamage[1],
  weak3: LOCKED.player.weakDamage[2],
  heavy: LOCKED.player.heavyDamage,
  finisher: LOCKED.player.finisherDamage,
  charge1: LOCKED.player.chargeDamage[0],
  charge2: LOCKED.player.chargeDamage[1],
  charge3: LOCKED.player.chargeDamage[2],
  air_attack: DEFAULTS.attackTimings.air_attack.damage,
  dash: LOCKED.player.dashDamage,
};

export const ENEMY_HP: Record<EnemyKind, number> = {
  infantry: LOCKED.enemies.infantry.hp,
  archer: LOCKED.enemies.archer.hp,
  spearman: LOCKED.enemies.spearman.hp,
  shieldman: LOCKED.enemies.shieldman.hp,
  cavalry: LOCKED.enemies.cavalry.hp,
};
export const ENEMY_DAMAGE = DEFAULTS.enemy.damage as Record<EnemyKind, number>;
export const ENEMY_SPEED = DEFAULTS.enemy.speed as Record<EnemyKind, number>;

export const BOSS_HP: Record<BossId, number> = {
  vanguard: LOCKED.bosses.vanguard.hp,
  spear_captain: LOCKED.bosses.spear_captain.hp,
  so_bae_ap: LOCKED.bosses.so_bae_ap.hp,
};

export const BOSS_NAMES: Record<BossId, string> = {
  vanguard: '거란군 선봉대장',
  spear_captain: '정예 창병장',
  so_bae_ap: '소배압',
};

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  infantry: '거란 보병',
  archer: '거란 궁병',
  spearman: '거란 창병',
  shieldman: '거란 방패병',
  cavalry: '거란 기병',
};

export const SKILL_CYCLE = LOCKED.skills.cycle as SkillId[];
export const SKILL_NAMES: Record<SkillId, string> = {
  command_buff: '지휘 강화',
  spear_support: '창병 공격',
  shield_guard: '방패병 막기',
};
export const UPGRADE_IDS = LOCKED.upgrades.choices as UpgradeId[];

export const VIEW_W = LOCKED.tech.resolution[0];
export const VIEW_H = LOCKED.tech.resolution[1];
export const SIM_STEP_MS = 1000 / DEFAULTS.time.simulationHz;
