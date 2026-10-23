/** Visual adapter data for the Gang Gam-chan game. All positions are logical pixels. */
export type Facing = -1 | 1;
export type CavalryState = 'idle'|'walk'|'run'|'windup'|'charge'|'recovery'|'hurt'|'death';
export type CavalryAction = 'idle'|'walk'|'run'|'attack'|'charge'|'hurt'|'death';

export const CAVALRY = Object.freeze({
 enemyId: 'cavalry',
 maxHp: 70, damage: 18, chargeSpeed: 260,
 attackMinRange: 160, attackMaxRange: 320,
 windupMs: 850, chargeMaxMs: 600, recoveryMs: 1000,
 // These are rendering-only defaults, not new balancing changes.
 hurtMs: 220, deathMs: 900,
 frameWidth: 448, frameHeight: 256, anchorX: 224, anchorY: 220,
 atlasKey: 'khitan-cavalry-v6',
});

export const ANIMATIONS: Record<CavalryAction,{count:number;fps:number;loop:boolean}> = {
 idle:{count:4,fps:5,loop:true}, walk:{count:6,fps:9,loop:true},
 run:{count:6,fps:12,loop:true}, attack:{count:6,fps:10,loop:false},
 charge:{count:2,fps:10,loop:true}, hurt:{count:4,fps:10,loop:false},
 death:{count:6,fps:8,loop:false}
};

export function frameName(action:CavalryAction,index:number):string {
 const a=ANIMATIONS[action];
 if (!a || !Number.isInteger(index) || index<1 || index>a.count) throw new RangeError('Invalid cavalry frame');
 return `khitan_cavalry_${action}_${String(index).padStart(2,'0')}.png`;
}
export function frameForAction(action:CavalryAction,timeMs:number):string {
 if (!Number.isFinite(timeMs)) throw new RangeError('timeMs must be finite');
 const a=ANIMATIONS[action];
 if(!a) throw new RangeError('Invalid cavalry action');
 const step=Math.floor(Math.max(0,timeMs)*a.fps/1000);
 const idx=a.loop?step%a.count:Math.min(a.count-1,step);
 return frameName(action,idx+1);
}
/** Call with state-relative elapsed time from the EXISTING AI, not a second timer. */
export function frameForState(state:CavalryState,elapsedMs:number,stateDurationMs?:number):string {
 if(!Number.isFinite(elapsedMs))throw new RangeError('elapsedMs must be finite');
 const t=Math.max(0,elapsedMs);
 if(state==='windup') return frameName('attack',1+Math.min(2,Math.floor(t/CAVALRY.windupMs*3)));
 if(state==='recovery') return frameName('attack',4+Math.min(2,Math.floor(t/CAVALRY.recoveryMs*3)));
 if(state==='hurt') {
  const duration=Math.max(1,stateDurationMs??CAVALRY.hurtMs);
  return frameName('hurt',1+Math.min(3,Math.floor(t/duration*4)));
 }
 if(state==='death')return frameName('death',1+Math.min(5,Math.floor(t/CAVALRY.deathMs*6)));
 return frameForAction(state,t);
}

export interface Rect {x:number;y:number;width:number;height:number}
export function cavalryHurtBox(x:number,feetY:number):Rect {
 return {x:x-50,y:feetY-126,width:100,height:126};
}
export function cavalryLanceBox(x:number,feetY:number,facing:Facing):Rect {
 return {x:facing>0?x+38:x-126,y:feetY-105,width:88,height:24};
}
export function sweptLanceBox(fromX:number,toX:number,feetY:number,facing:Facing):Rect {
 const a=cavalryLanceBox(fromX,feetY,facing),b=cavalryLanceBox(toX,feetY,facing);
 return {x:Math.min(a.x,b.x),y:a.y,width:Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x),height:a.height};
}
