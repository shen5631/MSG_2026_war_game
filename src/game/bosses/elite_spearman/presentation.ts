import { FRAME_COUNTS, PATTERNS, type AnimationName } from './config.js';
import type { Snapshot } from './EliteSpearmanController.js';
export interface VisualFrame { animation:AnimationName; frameIndex:number; frameName:string; tint:number|null }
function pick(animation:AnimationName,index:number,tint:number|null=null):VisualFrame{
  const frameIndex=Math.max(0,Math.min(FRAME_COUNTS[animation]-1,Math.floor(index)));
  return {animation,frameIndex,frameName:`${animation}_${String(frameIndex+1).padStart(2,'0')}`,tint};
}
/** This function is also usable with an existing boss AI: pass its state snapshot. */
export function visualFor(s:Snapshot):VisualFrame {
  const t=s.elapsedMs;
  if(s.action==='death')return pick('death',Math.floor(t/150));
  if(s.action==='phase2')return pick('phase2',Math.floor(t/225));
  if(s.action==='parry_stagger')return pick('parry_stagger',t/650*4);
  if(s.action==='walk')return pick('walk',Math.floor(t/100)%6);
  if(s.action!=='attack'||!s.pattern)return pick('idle',Math.floor(t/180)%4);
  const p=PATTERNS[s.pattern];
  if(s.pattern==='red_jump_slam'){
    const i=t<450?0:t<900?1:t<1550?2:t<1730?3:t<2330?4:5;
    return pick('jump_slam',i,t<900?0xff7777:null);
  }
  if(s.pattern==='double_thrust'){
    const i=t<275?0:t<550?1:t<670?2:t<760?3:t<850?4:t<970?5:t<1420?6:7;
    return pick('double_thrust',i);
  }
  const i=t<p.startupMs/2?0:t<p.startupMs?1:t<p.startupMs+p.activeMs/2?2:t<p.startupMs+p.activeMs?3:t<p.startupMs+p.activeMs+s.recoveryMs/2?4:5;
  return pick(s.pattern,i);
}
export function previewFrame(animation:AnimationName,elapsedMs:number):VisualFrame {
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw new RangeError('Invalid preview time');
  const count=FRAME_COUNTS[animation];return pick(animation,Math.floor(elapsedMs/140)%count);
}
