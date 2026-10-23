/** Enemy shieldman. Values mirror the project spec; not the allied shield skill. */
export const SHIELD_ENEMY = Object.freeze({
  id: "shieldman", hp: 80, damage: 10, speed: 42, attackRange: 62,
  windupMs: 650, activeMs: 120, recoveryMs: 900, guardBreakMs: 800,
  hurtMs: 180, deathMs: 800, blockMs: 165,
  width: 192, height: 192, anchorX: 96, anchorY: 160,
});
export type Facing = 1 | -1;
export type ShieldState = "idle" | "walk" | "guard" | "block" | "attack" | "guard_break" | "hurt" | "death";
export type HitKind = "light" | "air_light" | "dash" | "heavy" | "finisher" | "charged" | "support_spear" | "other";
const seq = (a:string,n:number):string[] => Array.from({length:n},(_,i)=>`${a}/${a}_${String(i+1).padStart(2,"0")}.png`);
export const FRAMES = Object.freeze({
 idle:seq("idle",4),walk:seq("walk",6),guard:seq("guard",4),attack:seq("attack",6),
 guard_break:seq("guard_break",4),hurt:seq("hurt",4),death:seq("death",5),
});
export const ANIMATION_ORDER = ["idle","walk","guard","attack","guard_break","hurt","death"] as const;
export function finiteNonNegative(value:number,name:string):number {
 if(!Number.isFinite(value)||value<0) throw new TypeError(`${name} must be finite and >= 0`);
 return value;
}
function at(list:readonly string[],elapsed:number,frameMs:number,loop=false):string {
 const n=Math.floor(elapsed/frameMs);return list[loop?n%list.length:Math.min(n,list.length-1)];
}
/** Presentation time is supplied by host simulation; no wall-clock timers. */
export function frameForState(state:ShieldState,elapsedMs:number):string {
 finiteNonNegative(elapsedMs,"elapsedMs");const t=elapsedMs;
 switch(state){
  case "idle":return at(FRAMES.idle,t,180,true);
  case "walk":return at(FRAMES.walk,t,115,true);
  case "guard":return at(FRAMES.guard,t,160,true);
  case "block":return at([FRAMES.guard[1],FRAMES.guard[2],FRAMES.guard[0]],t,55);
  case "guard_break":return at(FRAMES.guard_break,t,200);
  case "hurt":return at(FRAMES.hurt,t,45);
  case "death":return at(FRAMES.death,t,160);
  case "attack":
   // 650 ms windup / 120 ms active / 900 ms recovery. Single shield strike.
   if(t<650)return t<220?FRAMES.attack[0]:t<480?FRAMES.attack[1]:t<570?FRAMES.attack[2]:FRAMES.attack[3];
   if(t<770)return FRAMES.attack[4];
   return t<1000?FRAMES.attack[5]:t<1350?FRAMES.guard[1]:FRAMES.guard[0];
  default:throw new TypeError(`Unknown shield state: ${String(state)}`);
 }
}
export function attackIsActive(t:number):boolean {return Number.isFinite(t)&&t>=650&&t<770;}
export function isGuardingState(s:ShieldState):boolean{return s==="idle"||s==="walk"||s==="guard"||s==="block";}
export function isFront(sourceX:number,enemyX:number,facing:Facing):boolean {
 if(!Number.isFinite(sourceX)||!Number.isFinite(enemyX)||(facing!==1&&facing!==-1))throw new TypeError("Invalid position/facing");
 return (sourceX-enemyX)*facing>=0;
}
export interface HitInput { finalDamage:number; kind:HitKind; fromFront:boolean; guarding:boolean; immune?:boolean; }
export interface HitResult { hpDamage:number; blocked:boolean; guardBroken:boolean; stunMs:number; }
/** Call AFTER host parry / immunity checks. Do not use alongside an existing guard resolver. */
export function resolveShieldHit(h:HitInput):HitResult {
 finiteNonNegative(h.finalDamage,"finalDamage");
 const base:HitResult={hpDamage:h.finalDamage,blocked:false,guardBroken:false,stunMs:0};
 if(h.immune||h.finalDamage===0)return {...base,hpDamage:0};
 if(!h.guarding||!h.fromFront||h.kind==="support_spear")return base;
 if(h.kind==="light"||h.kind==="air_light"||h.kind==="dash")return {...base,hpDamage:0,blocked:true};
 if(h.kind==="heavy"||h.kind==="finisher"||h.kind==="charged")return {...base,guardBroken:true,stunMs:800};
 return base;
}
export interface ShieldSnapshot {x:number;feetY:number;facing:Facing;state:ShieldState;stateElapsedMs:number;visible?:boolean;}
export function assertSnapshot(s:ShieldSnapshot):void {
 if(!Number.isFinite(s.x)||!Number.isFinite(s.feetY)||(s.facing!==1&&s.facing!==-1))throw new TypeError("Invalid shield snapshot");
 frameForState(s.state,s.stateElapsedMs);
}
