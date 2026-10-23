/** All times use the game's PAUSABLE simulation clock (milliseconds). */
export const BOSS_RULES = Object.freeze({
  id: 'spear_captain', name: '정예 창병장', maxHp: 500, phase2Hp: 250,
  transitionMs: 900, parryStaggerMs: 650, deathVisualMs: 900,
  moveSpeed: 62, jumpAirMs: 650, jumpHeight: 96,
  arenaMinX: 60, arenaMaxX: 580, phase2NormalRecoveryMultiplier: 0.85,
});
export type PatternId = 'long_thrust' | 'sweep' | 'double_thrust' | 'red_jump_slam';
export type Action = 'idle'|'walk'|'attack'|'phase2'|'parry_stagger'|'death';
export interface Pattern {
  startupMs: number; activeMs: number; recoveryMs: number; damage: number;
  hitCount: number; hitSpacingMs: number; cooldownMs: number;
  parryable: boolean; minDistance: number; maxDistance: number; phase2Only: boolean;
}
export const PATTERNS: Readonly<Record<PatternId, Readonly<Pattern>>> = Object.freeze({
  long_thrust: {startupMs:600,activeMs:140,recoveryMs:750,damage:15,hitCount:1,hitSpacingMs:0,cooldownMs:0,parryable:true,minDistance:100,maxDistance:180,phase2Only:false},
  sweep: {startupMs:550,activeMs:180,recoveryMs:850,damage:15,hitCount:1,hitSpacingMs:0,cooldownMs:0,parryable:true,minDistance:0,maxDistance:110,phase2Only:false},
  double_thrust: {startupMs:550,activeMs:120,recoveryMs:900,damage:15,hitCount:2,hitSpacingMs:300,cooldownMs:6000,parryable:true,minDistance:0,maxDistance:180,phase2Only:true},
  red_jump_slam: {startupMs:900,activeMs:180,recoveryMs:1200,damage:25,hitCount:1,hitSpacingMs:0,cooldownMs:8000,parryable:false,minDistance:0,maxDistance:320,phase2Only:true},
});
export const FRAME_COUNTS = Object.freeze({idle:4,walk:6,long_thrust:6,sweep:6,double_thrust:8,jump_slam:6,phase2:4,parry_stagger:4,death:6});
export type AnimationName = keyof typeof FRAME_COUNTS;
export const SPRITE = Object.freeze({width:320,height:192,anchorX:160,anchorY:176,textureKey:'elite_spearman_v2'});
