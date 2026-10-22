/**
 * Round 1 Khitan Vanguard Commander. Pure TypeScript; no renderer/React dependency.
 * x/y are body-root / ground coordinates in the 640x360 logical world.
 * All times are milliseconds of GAME TIME. Pass 0 / pause the host while paused.
 */
export type Facing = -1 | 1;
export type Action = 'idle'|'walk'|'slash'|'dash_slash'|'combo_3hit'|'heavy_smash'|'phase2_transition'|'parry_stagger'|'death';
export type PatternId = 'slash'|'dash_slash'|'combo_3hit'|'heavy_smash';
export type State = 'intro'|'idle'|'walk'|'attack'|'phase_transition'|'stagger'|'dead';
export interface Rect {x:number; y:number; width:number; height:number;}
export interface Target {id:string; x:number; y:number; hurtbox:Rect; alive?:boolean;}
export interface AttackWindow {start:number; duration:number; damage:number; range:number; height:number; parryable:boolean;}
export interface Pattern {id:PatternId; minDistance:number; maxDistance:number; minimumPhase:1|2; windup:number; recovery:number; cooldown:number; windows:readonly AttackWindow[];}
export const FRAME_COUNTS:Readonly<Record<Action,number>> = Object.freeze({idle:4, walk:6, slash:6, dash_slash:6, combo_3hit:9, heavy_smash:6, phase2_transition:4, parry_stagger:4, death:6});
export const BOSS_TEXTURE_KEY = 'khitan-vanguard-v2';
export const BOSS_ORIGIN = Object.freeze({x:0.5, y:176/192});
export const BOSS_RULES = Object.freeze({maxHp:350, phaseThreshold:175, introMs:800, transitionMs:900, staggerMs:650, deathMs:900, walkSpeed:86, dashSpeed:320, phase2RecoveryMultiplier:0.85});
export const PATTERNS: Readonly<Record<PatternId,Pattern>> = Object.freeze({
 slash:{id:'slash',minDistance:0,maxDistance:90,minimumPhase:1,windup:450,recovery:650,cooldown:0,windows:[{start:450,duration:100,damage:15,range:90,height:85,parryable:true}]},
 dash_slash:{id:'dash_slash',minDistance:140,maxDistance:320,minimumPhase:1,windup:650,recovery:800,cooldown:0,windows:[{start:650,duration:300,damage:15,range:90,height:85,parryable:true}]},
 combo_3hit:{id:'combo_3hit',minDistance:0,maxDistance:110,minimumPhase:2,windup:450,recovery:900,cooldown:5000,windows:[450,700,950].map(start=>({start,duration:80,damage:15,range:100,height:90,parryable:true}))},
 heavy_smash:{id:'heavy_smash',minDistance:0,maxDistance:130,minimumPhase:2,windup:850,recovery:1100,cooldown:7000,windows:[{start:850,duration:140,damage:25,range:110,height:100,parryable:false}]},
});
export type BossEvent =
 | {type:'attack-start'; pattern:PatternId; sequence:number}
 | {type:'attack-contact';pattern:PatternId; token:string;targetId:string;damage:number;parryable:boolean;rect:Rect}
 | {type:'attack-finished';pattern:PatternId}
 | {type:'damaged';amount:number;hp:number}
 | {type:'phase-start';phase:2}
 | {type:'phase-end';phase:2}
 | {type:'stagger';durationMs:number}
 | {type:'defeated'}
 | {type:'death-finished'};
export interface BossOptions {
 x:number; y:number; minX?:number; maxX?:number; skipIntro?:boolean;
 /** Hook ground collision. Return the allowed root X; do not move the view separately. */
 resolveMove?:(fromX:number,toX:number,y:number)=>number;
 onEvent?:(event:BossEvent)=>void;
}
export interface BossSnapshot {
 x:number;y:number;facing:Facing;hp:number;maxHp:number;phase:1|2;state:State;
 action:Action;frame:string;stateElapsedMs:number;gameTimeMs:number;pattern:PatternId|null;
 invulnerable:boolean;unblockableWarning:boolean;hitFlash:boolean;attackRects:Rect[];
}
export function overlaps(a:Rect,b:Rect):boolean {
 return a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
}
export function frameKey(action:Action,index:number):string {
 const i=Math.min(FRAME_COUNTS[action]-1,Math.max(0,Math.floor(index)));
 return `${action}_${String(i+1).padStart(2,'0')}`;
}
function choose(frames:readonly number[],u:number):number {
 return frames[Math.min(frames.length-1,Math.max(0,Math.floor(u*frames.length)))];
}
export function attackEnd(pattern:Pattern):number {return Math.max(...pattern.windows.map(w=>w.start+w.duration));}
/** Visual timing only. Combat windows above are authoritative, not animation FPS. */
export function attackFrame(id:PatternId,elapsed:number,recovery:number):string {
 const p=PATTERNS[id],end=attackEnd(p);let i=0;
 if(id==='combo_3hit') {
  i=elapsed<150?0:elapsed<450?1:elapsed<530?2:elapsed<600?3:elapsed<700?4:elapsed<780?5:elapsed<950?6:elapsed<1030?7:8;
 } else if(id==='slash') {
  i=elapsed<p.windup?choose([0,1],elapsed/p.windup):elapsed<end?choose([2,3],(elapsed-p.windup)/(end-p.windup)):choose([4,5],(elapsed-end)/recovery);
 } else if(id==='dash_slash') {
  i=elapsed<p.windup?choose([0,2],elapsed/p.windup):elapsed<end?choose([1,3,4],(elapsed-p.windup)/(end-p.windup)):choose([4,5],(elapsed-end)/recovery);
 } else {
  i=elapsed<p.windup?choose([0,1],elapsed/p.windup):elapsed<end?2:choose([3,4,5],(elapsed-end)/recovery);
 }
 return frameKey(id,i);
}
export class VanguardBossController {
 public x:number;public y:number;public facing:Facing=-1;public hp:number=BOSS_RULES.maxHp;
 public phase:1|2=1; public state:State; public elapsed=0;public gameTime=0;
 public paused=false;public autoAI=true;
 private pattern:PatternId|null=null;private attackSequence=0;private attackRecovery=0;
 private minX:number;private maxX:number;private onEvent:(e:BossEvent)=>void;
 private movement?:BossOptions['resolveMove'];
 private lastUsed:Record<PatternId,number>={slash:-Infinity,dash_slash:-Infinity,combo_3hit:-Infinity,heavy_smash:-Infinity};
 private lastPattern:PatternId|null=null;private consecutive=0;private contacted=new Set<string>();
 private seenIncoming=new Set<string>();private deathEmitted=false;private flash=0;
 private aiWait=0;
 constructor(options:BossOptions){
  this.x=options.x;this.y=options.y;this.minX=options.minX??48;this.maxX=options.maxX??592;
  if(this.minX>this.maxX)throw new Error('minX must not exceed maxX');
  this.onEvent=options.onEvent??(()=>{});this.movement=options.resolveMove;
  this.state=options.skipIntro?'idle':'intro';
 }
 setEventHandler(fn:(e:BossEvent)=>void):void{this.onEvent=fn;}
 get alive():boolean{return this.hp>0;}
 get invulnerable():boolean{return this.state==='intro'||this.state==='phase_transition'||!this.alive;}
 get hurtbox():Rect{return{x:this.x-24,y:this.y-90,width:48,height:90};}
 private transition(state:State):void{this.state=state;this.elapsed=0;}
 private moveTo(x:number):void{
  let allowed=Math.min(this.maxX,Math.max(this.minX,x));
  if(this.movement)allowed=this.movement(this.x,allowed,this.y);
  this.x=Math.min(this.maxX,Math.max(this.minX,Number.isFinite(allowed)?allowed:this.x));
 }
 /** Call once per host update. Substeps preserve short active windows and dash collision. */
 update(deltaMs:number,target:Target):void {
  if(!Number.isFinite(deltaMs)||deltaMs<0)throw new Error('deltaMs must be finite and non-negative');
  if(this.paused||deltaMs===0)return;
  // A very long frame usually means a hidden tab. Do not silently simulate minutes of combat.
  if(deltaMs>1000){this.paused=true;return;}
  let remaining=deltaMs;
  while(remaining>1e-7){const dt=Math.min(1000/120,remaining);this.step(dt,target);remaining-=dt;}
 }
 private step(dt:number,target:Target):void{
  this.flash=Math.max(0,this.flash-dt);
  if(this.state==='dead'){
   this.elapsed+=dt;
   if(this.elapsed>=BOSS_RULES.deathMs&&!this.deathEmitted){this.deathEmitted=true;this.onEvent({type:'death-finished'});}
   return;
  }
  if(this.state==='intro'||this.state==='phase_transition'){
   this.elapsed+=dt;
   const limit=this.state==='intro'?BOSS_RULES.introMs:BOSS_RULES.transitionMs;
   if(this.elapsed+1e-6>=limit){const wasPhase=this.state==='phase_transition';this.transition('idle');this.aiWait=120;if(wasPhase)this.onEvent({type:'phase-end',phase:2});}
   return;
  }
  this.gameTime+=dt;this.aiWait=Math.max(0,this.aiWait-dt);
  if(this.state==='stagger'){this.elapsed+=dt;if(this.elapsed+1e-6>=BOSS_RULES.staggerMs)this.transition('idle');return;}
  if(this.state==='attack'&&this.pattern){
   const id=this.pattern,p=PATTERNS[id],old=this.elapsed,newT=old+dt;this.elapsed=newT;
   const oldX=this.x;
   if(id==='dash_slash'){
    const activeMs=Math.max(0,Math.min(newT,950)-Math.max(old,650));
    if(activeMs>0)this.moveTo(this.x+this.facing*BOSS_RULES.dashSpeed*activeMs/1000);
   }
   for(let wi=0;wi<p.windows.length;wi++){
    const w=p.windows[wi];
    if(newT<=w.start||old>=w.start+w.duration)continue;
    const token=`${this.attackSequence}:${wi}`,unique=token+':'+target.id;
    const a=this.attackRect(w,oldX),b=this.attackRect(w,this.x);
    // Swept horizontal envelope, only during this <=8.34ms simulation interval.
    const box={x:Math.min(a.x,b.x),y:a.y,width:Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x),height:a.height};
    if(target.alive!==false&&!this.contacted.has(unique)&&overlaps(box,target.hurtbox)){
     this.contacted.add(unique);
     this.onEvent({type:'attack-contact',pattern:id,token,targetId:target.id,damage:w.damage,parryable:w.parryable,rect:box});
     if(this.state!=='attack'||this.pattern!==id)return; // handler can parry/kill immediately
    }
   }
   if(newT+1e-6>=attackEnd(p)+this.attackRecovery){this.pattern=null;this.transition('idle');this.aiWait=70;this.onEvent({type:'attack-finished',pattern:id});}
   return;
  }
  this.elapsed+=dt;
  if(!this.autoAI||target.alive===false)return;
  if(Math.abs(target.x-this.x)>.5)this.facing=target.x<this.x?-1:1;
  const distance=Math.abs(target.x-this.x);
  if(this.aiWait<=0){
   const candidate=this.selectPattern(distance,target);
   if(candidate){this.startPattern(candidate,target);return;}
  }
  if(distance>78){
   if(this.state!=='walk')this.transition('walk');
   this.moveTo(this.x+this.facing*BOSS_RULES.walkSpeed*dt/1000);
  } else if(this.state==='walk')this.transition('idle');
 }
 private selectPattern(distance:number,target:Target):PatternId|null {
  if(Math.abs(target.y-this.y)>130)return null;
  const ids=(Object.keys(PATTERNS) as PatternId[]).filter(id=>{
   const p=PATTERNS[id];return this.phase>=p.minimumPhase&&distance>=p.minDistance&&distance<=p.maxDistance&&this.gameTime-this.lastUsed[id]>=p.cooldown&&!(this.lastPattern===id&&this.consecutive>=2);
  });
  ids.sort((a,b)=>{
   const sa=PATTERNS[a].minimumPhase===2?0:1,sb=PATTERNS[b].minimumPhase===2?0:1;
   if(sa!==sb)return sa-sb;
   const ta=this.lastUsed[a],tb=this.lastUsed[b];return ta===tb?a.localeCompare(b):ta<tb?-1:1;
  });
  if(ids.length)return ids[0];
  // No eligible alternative after two identical attacks: insert a readable idle beat.
  if(this.consecutive>=2&&distance<=130&&this.aiWait<=0){this.aiWait=300;this.consecutive=0;}
  return null;
 }
 /** Manual testing/integration hook; never interrupts attack/stagger/transition/death. */
 startPattern(id:PatternId,target:Target):boolean {
  if(!this.alive||this.paused||!['idle','walk'].includes(this.state)||this.phase<PATTERNS[id].minimumPhase)return false;
  const p=PATTERNS[id];if(this.gameTime-this.lastUsed[id]<p.cooldown)return false;
  this.facing=target.x<this.x?-1:1;this.pattern=id;this.attackSequence++;
  this.contacted.clear();this.lastUsed[id]=this.gameTime;
  this.consecutive=this.lastPattern===id?this.consecutive+1:1;this.lastPattern=id;
  // Original basic patterns accelerate only their recovery in phase 2.
  this.attackRecovery=p.recovery*(this.phase===2&&p.minimumPhase===1?BOSS_RULES.phase2RecoveryMultiplier:1);
  this.transition('attack');this.onEvent({type:'attack-start',pattern:id,sequence:this.attackSequence});return true;
 }
 private attackRect(w:AttackWindow,x:number=this.x):Rect{
  return{x:this.facing===1?x+6:x-6-w.range,y:this.y-w.height,width:w.range,height:w.height};
 }
 /** A token is generated on contact; callers validate their own 0.2s player parry window. */
 parry(token:string):boolean {
  if(this.state!=='attack'||!this.pattern)return false;
  const parts=token.split(':').map(Number),wi=parts[1];
  if(parts[0]!==this.attackSequence||!Number.isInteger(wi))return false;
  const w=PATTERNS[this.pattern].windows[wi];
  if(!w||!w.parryable||this.elapsed<w.start||this.elapsed>w.start+w.duration+9)return false;
  this.pattern=null;this.transition('stagger');this.onEvent({type:'stagger',durationMs:BOSS_RULES.staggerMs});return true;
 }
 /** Same attackId may hit this boss once. Increment IDs per swing, not per render frame. */
 takeDamage(amount:number,attackId:string):number{
  if(!Number.isFinite(amount)||amount<0)throw new Error('Damage must be non-negative');
  if(!attackId)throw new Error('A unique attackId is required');
  if(this.invulnerable||this.paused||this.seenIncoming.has(attackId))return 0;
  const value=Math.floor(amount+0.5);if(value===0)return 0;
  this.seenIncoming.add(attackId);const applied=Math.min(this.hp,value);this.hp-=applied;this.flash=65;
  this.onEvent({type:'damaged',amount:applied,hp:this.hp});
  if(this.hp<=0){this.pattern=null;this.transition('dead');this.onEvent({type:'defeated'});return applied;}
  if(this.phase===1&&this.hp<=BOSS_RULES.phaseThreshold){this.phase=2;this.pattern=null;this.transition('phase_transition');this.onEvent({type:'phase-start',phase:2});}
  return applied;
 }
 get snapshot():BossSnapshot{
  let action:Action='idle',frame=frameKey('idle',Math.floor(this.elapsed/200)%4);
  if(this.state==='walk'){action='walk';frame=frameKey(action,Math.floor(this.elapsed/125)%6);}
  if(this.state==='attack'&&this.pattern){action=this.pattern;frame=attackFrame(this.pattern,this.elapsed,this.attackRecovery);}
  if(this.state==='phase_transition'){action='phase2_transition';frame=frameKey(action,Math.floor(this.elapsed/BOSS_RULES.transitionMs*4));}
  if(this.state==='stagger'){action='parry_stagger';frame=frameKey(action,Math.floor(this.elapsed/BOSS_RULES.staggerMs*4));}
  if(this.state==='dead'){action='death';frame=frameKey(action,Math.floor(this.elapsed/BOSS_RULES.deathMs*6));}
  const attackRects:Rect[]=[];
  if(this.state==='attack'&&this.pattern)for(const w of PATTERNS[this.pattern].windows)if(this.elapsed>=w.start&&this.elapsed<w.start+w.duration)attackRects.push(this.attackRect(w));
  return{x:this.x,y:this.y,facing:this.facing,hp:this.hp,maxHp:BOSS_RULES.maxHp,phase:this.phase,state:this.state,action,frame,stateElapsedMs:this.elapsed,gameTimeMs:this.gameTime,pattern:this.pattern,invulnerable:this.invulnerable,unblockableWarning:this.state==='attack'&&this.pattern==='heavy_smash'&&this.elapsed<990,hitFlash:this.flash>0,attackRects};
 }
}
