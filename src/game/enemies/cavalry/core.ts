/** Pure data and presentation helpers. Units: logical pixels, milliseconds, HP. */
export type Facing = -1 | 1;
export type CavalryState = 'idle'|'walk'|'run'|'windup'|'charge'|'recovery'|'hurt'|'death';
export type CavalryAction = 'idle'|'walk'|'run'|'attack'|'charge'|'hurt'|'death';
export interface Rect { x:number; y:number; width:number; height:number; }
export const CAVALRY = Object.freeze({
  enemyId:'cavalry', maxHp:70, damage:18, chargeSpeed:260,
  attackMinRange:160, attackMaxRange:320, windupMs:850, chargeMaxMs:600, recoveryMs:1000,
  // Following values are implementation defaults, not newly confirmed game balance.
  walkSpeed:60, hurtMs:220, parryStunMs:650, deathMs:900,
  frameWidth:320, frameHeight:224, anchorX:160, anchorY:192,
  atlasKey:'khitan-cavalry-v1',
});
export const ANIMATIONS: Record<CavalryAction,{count:number;fps:number;loop:boolean}> = {
  idle:{count:4,fps:5,loop:true}, walk:{count:6,fps:8,loop:true}, run:{count:6,fps:12,loop:true},
  attack:{count:6,fps:6,loop:false}, charge:{count:2,fps:10,loop:true},
  hurt:{count:4,fps:8,loop:false}, death:{count:6,fps:6/0.9,loop:false},
};
export function finite(value:number,name='value'):number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}
export function elapsed(value:number):number { finite(value,'elapsedMs'); return Math.max(0,value); }
export function frameName(action:CavalryAction,index:number):string {
  const def=ANIMATIONS[action];
  if (!def || !Number.isInteger(index) || index<1 || index>def.count) throw new RangeError('Invalid frame');
  return `khitan_cavalry_${action}_${String(index).padStart(2,'0')}.png`;
}
export function actionFrame(action:CavalryAction,timeMs:number):string {
  const d=ANIMATIONS[action]; const step=Math.floor(elapsed(timeMs)*d.fps/1000);
  return frameName(action, (d.loop?step%d.count:Math.min(step,d.count-1))+1);
}
export function frameForState(state:CavalryState,timeMs:number,stateDurationMs?:number):string {
  const t=elapsed(timeMs);
  if(state==='windup') return frameName('attack',Math.min(2,Math.floor(t/CAVALRY.windupMs*3))+1);
  if(state==='recovery')return frameName('attack',Math.min(2,Math.floor(t/CAVALRY.recoveryMs*3))+4);
  if(state==='hurt') {
    const d=Math.max(1,stateDurationMs??CAVALRY.hurtMs);
    return frameName('hurt',Math.min(3,Math.floor(t/d*4))+1);
  }
  if(state==='death')return frameName('death',Math.min(5,Math.floor(t/CAVALRY.deathMs*6))+1);
  return actionFrame(state,t);
}
export function overlaps(a:Rect,b:Rect):boolean {
  return a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
}
export function hurtbox(x:number,feetY:number):Rect { return {x:x-48,y:feetY-116,width:96,height:116}; }
export function lanceBox(x:number,feetY:number,facing:Facing):Rect {
  // Only the weapon, never the entire horse or transparent image canvas, deals damage.
  return {x:facing===1?x+32:x-112,y:feetY-98,width:80,height:24};
}
export function sweptLanceBox(fromX:number,toX:number,feetY:number,facing:Facing):Rect {
  const a=lanceBox(fromX,feetY,facing),b=lanceBox(toX,feetY,facing);
  return {x:Math.min(a.x,b.x),y:a.y,width:a.width+Math.abs(toX-fromX),height:a.height};
}
