import { BOSS_RULES, PATTERNS, type Action, type PatternId } from './config.js';
export type Facing = 1 | -1;
export interface TargetPosition { x: number; y: number; alive?: boolean }
export interface Rect { x: number; y: number; width: number; height: number }
export interface AttackWindow {
  attackId: string; hitIndex: number; bossId: string; pattern: PatternId;
  damage: number; parryable: boolean; facing: Facing; rect: Rect;
}
export interface Snapshot {
  x: number; y: number; groundY: number; facing: Facing; hp: number; phase: 1|2;
  action: Action; elapsedMs: number; pattern: PatternId|null; recoveryMs: number;
  isInvulnerable: boolean; redWarning: boolean; dead: boolean;
  jumpTargetX: number|null; pauseWorld: boolean; visible: boolean;
}
export type BossEvent = {type:'phase-start'|'phase-end'|'defeated'|'parried'|'attack-start'|'landed'; pattern?:PatternId};
export interface ControllerOptions {
  x?: number; groundY?: number; minX?: number; maxX?: number;
  instanceId?: string; autoAI?: boolean;
}
function finite(v: number, label: string): number {
  if (!Number.isFinite(v)) throw new TypeError(`${label} must be finite`); return v;
}
export function intersects(a: Rect,b: Rect): boolean {
  return a.x < b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
}
/** No Phaser timers, no direct damage to player, no dependency on animation frame rate. */
export class EliteSpearmanController {
  private hp = BOSS_RULES.maxHp as number;
  private phase: 1|2 = 1;
  private action: Action = 'idle';
  private elapsed = 0;
  private pattern: PatternId|null = null;
  private facing: Facing = -1;
  private x: number;
  private y: number;
  private readonly groundY: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly initialX: number;
  private readonly id: string;
  private readonly autoAI: boolean;
  private serial = 0;
  private paused = false;
  private disposed = false;
  private events: BossEvent[] = [];
  private hitTargets = new Set<string>();
  private incomingHits = new Set<string>();
  private cooldowns: Record<PatternId,number> = {long_thrust:0,sweep:0,double_thrust:0,red_jump_slam:0};
  private jumpTargetX: number|null = null;
  private jumpFromX = 0;
  private recoveryMs = 0;
  constructor(options: ControllerOptions = {}) {
    this.minX = finite(options.minX ?? BOSS_RULES.arenaMinX,'minX');
    this.maxX = finite(options.maxX ?? BOSS_RULES.arenaMaxX,'maxX');
    if(this.minX>=this.maxX)throw new RangeError('minX must be smaller than maxX');
    this.initialX=this.clampX(finite(options.x ?? 440,'x'));this.x=this.initialX;
    this.groundY=finite(options.groundY ?? 304,'groundY');this.y=this.groundY;
    this.id=options.instanceId ?? 'r2-spear-boss';this.autoAI=options.autoAI ?? true;
  }
  private clampX(x:number){return Math.max(this.minX,Math.min(this.maxX,x));}
  setPaused(value: boolean):void { this.paused=value; }
  dispose():void { this.disposed=true;this.events=[];this.hitTargets.clear(); }
  reset():void {
    this.hp=500;this.phase=1;this.action='idle';this.elapsed=0;this.pattern=null;
    this.x=this.initialX;this.y=this.groundY;this.facing=-1;this.serial++;
    this.jumpTargetX=null;this.jumpFromX=this.x;this.recoveryMs=0;
    this.cooldowns={long_thrust:0,sweep:0,double_thrust:0,red_jump_slam:0};
    this.paused=false;this.disposed=false;this.events=[];this.hitTargets.clear();this.incomingHits.clear();
  }
  drainEvents(): BossEvent[] { const out=this.events;this.events=[];return out; }
  snapshot(): Snapshot {
    return {x:this.x,y:this.y,groundY:this.groundY,facing:this.facing,hp:this.hp,phase:this.phase,action:this.action,
      elapsedMs:this.elapsed,pattern:this.pattern,recoveryMs:this.recoveryMs,isInvulnerable:this.action==='phase2',
      redWarning:this.action==='attack'&&this.pattern==='red_jump_slam'&&this.elapsed<900,
      dead:this.hp<=0,jumpTargetX:this.jumpTargetX,pauseWorld:this.action==='phase2',visible:!this.disposed};
  }
  /** Incoming attack ID deduplication is optional; the host combat system can own it instead. */
  receiveDamage(amount:number, attackId?:string):number {
    finite(amount,'damage');if(amount<0)throw new RangeError('damage must not be negative');
    if(this.disposed||this.paused||this.hp<=0||this.action==='phase2'||amount===0)return 0;
    if(attackId&&this.incomingHits.has(attackId))return 0;
    if(attackId)this.incomingHits.add(attackId);
    const applied=Math.min(this.hp,amount);this.hp-=applied;
    if(this.hp<=0){
      this.changeAction('death');this.pattern=null;this.y=this.groundY;this.hitTargets.clear();
      // Logical defeat occurs NOW; do not postpone round-clear behind the death animation.
      this.events.push({type:'defeated'});
    } else if(this.phase===1 && this.hp<=250){
      this.phase=2;this.changeAction('phase2');this.pattern=null;this.y=this.groundY;
      this.hitTargets.clear();this.events.push({type:'phase-start'});
    }
    return applied;
  }
  parry(attackId?:string):boolean {
    if(this.disposed||this.paused||this.action!=='attack'||!this.pattern)return false;
    const windows=this.activeWindows();
    if(!windows.some(w=>w.parryable&&(!attackId||w.attackId===attackId)))return false;
    this.changeAction('parry_stagger');this.pattern=null;this.y=this.groundY;this.hitTargets.clear();
    this.events.push({type:'parried'});return true;
  }
  /** Call ONLY after an actual overlap. Whiffs must not consume the hit. */
  confirmHit(attackId:string,targetId:string):boolean {
    if(!this.activeWindows().some(w=>w.attackId===attackId))return false;
    const key=JSON.stringify([attackId,targetId]);if(this.hitTargets.has(key))return false;
    this.hitTargets.add(key);return true;
  }
  requestAttack(id:PatternId,target:TargetPosition):boolean {
    finite(target.x,'target.x');finite(target.y,'target.y');
    if(this.disposed||this.paused||target.alive===false||!['idle','walk'].includes(this.action))return false;
    const p=PATTERNS[id];if(!p)throw new Error(`Unknown pattern ${id}`);
    if((p.phase2Only&&this.phase===1)||this.cooldowns[id]>0)return false;
    const distance=Math.abs(target.x-this.x);
    if(distance<p.minDistance||distance>p.maxDistance)return false;
    this.facing=target.x>=this.x?1:-1;this.pattern=id;this.serial++;this.hitTargets.clear();
    this.jumpTargetX=null;this.jumpFromX=this.x;
    this.recoveryMs=p.recoveryMs*(this.phase===2&&!p.phase2Only?0.85:1);
    this.cooldowns[id]=p.cooldownMs;this.changeAction('attack');
    this.events.push({type:'attack-start',pattern:id});return true;
  }
  private changeAction(next:Action):void {this.action=next;this.elapsed=0;}
  private attackStart():number {return this.pattern ? PATTERNS[this.pattern].startupMs+(this.pattern==='red_jump_slam'?BOSS_RULES.jumpAirMs:0):0;}
  activeWindows():AttackWindow[] {
    if(this.disposed||this.paused||this.action!=='attack'||!this.pattern)return [];
    const p=PATTERNS[this.pattern], start=this.attackStart(), out:AttackWindow[]=[];
    for(let i=0;i<p.hitCount;i++){
      const from=start+i*p.hitSpacingMs;
      if(this.elapsed>=from&&this.elapsed<from+p.activeMs){
        let rect:Rect;
        if(this.pattern==='red_jump_slam')rect={x:this.x-96,y:this.groundY-48,width:192,height:48};
        else {const reach=this.pattern==='sweep'?110:180;const height=this.pattern==='sweep'?90:42;
          rect={x:this.facing>0?this.x+12:this.x-reach,y:this.y-(this.pattern==='sweep'?90:84),width:reach-12,height};}
        out.push({attackId:`${this.id}:${this.serial}:${i}`,hitIndex:i,bossId:this.id,pattern:this.pattern,
          damage:p.damage,parryable:p.parryable,facing:this.facing,rect});
      }
    }return out;
  }
  /** Small substeps make window crossings observable even on a slower display.
   * Host should call its shared combat resolver in onWindow; do not run a second AI. */
  step(deltaMs:number,target:TargetPosition,onWindow?:(w:AttackWindow)=>void):void {
    finite(deltaMs,'deltaMs');finite(target.x,'target.x');finite(target.y,'target.y');
    if(deltaMs<0||deltaMs>10000)throw new RangeError('deltaMs outside 0..10000; pause on hidden tabs');
    if(this.paused||this.disposed||deltaMs===0)return;
    let remaining=deltaMs;
    while(remaining>1e-7){
      const dt=Math.min(remaining,8);remaining-=dt;
      this.tick(dt,target);
      if(onWindow)for(const w of this.activeWindows())onWindow(w);
    }
  }
  private tick(dt:number,target:TargetPosition):void {
    if(this.action==='death'){this.elapsed=Math.min(900,this.elapsed+dt);return;}
    if(this.action==='phase2'){
      this.elapsed+=dt;
      if(this.elapsed>=900){this.changeAction('idle');this.events.push({type:'phase-end'});}return;
    }
    for(const k of Object.keys(this.cooldowns) as PatternId[])this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
    if(this.action==='parry_stagger'){
      this.elapsed+=dt;if(this.elapsed>=650)this.changeAction('idle');return;
    }
    if(this.action==='attack'&&this.pattern){
      const prev=this.elapsed;this.elapsed+=dt;const p=PATTERNS[this.pattern];
      if(this.pattern==='red_jump_slam'){
        if(prev<900&&this.elapsed>=900){this.jumpFromX=this.x;this.jumpTargetX=this.clampX(target.x);}
        if(this.jumpTargetX!==null){
          const t=Math.min(1,Math.max(0,(this.elapsed-900)/BOSS_RULES.jumpAirMs));
          this.x=this.jumpFromX+(this.jumpTargetX-this.jumpFromX)*t;
          this.y=this.groundY-4*BOSS_RULES.jumpHeight*t*(1-t);
          if(prev<1550&&this.elapsed>=1550)this.events.push({type:'landed',pattern:this.pattern});
        }
      }
      const end=this.attackStart()+(p.hitCount-1)*p.hitSpacingMs+p.activeMs+this.recoveryMs;
      if(this.elapsed>=end){this.changeAction('idle');this.pattern=null;this.y=this.groundY;this.jumpTargetX=null;}
      return;
    }
    this.elapsed+=dt;if(!this.autoAI||target.alive===false)return;
    const dist=Math.abs(target.x-this.x);this.facing=target.x>=this.x?1:-1;
    if(this.phase===2){
      if(this.cooldowns.red_jump_slam===0&&dist<=320&&this.requestAttack('red_jump_slam',target))return;
      if(this.cooldowns.double_thrust===0&&dist<=180&&this.requestAttack('double_thrust',target))return;
    }
    if(dist<=110&&this.requestAttack('sweep',target))return;
    if(dist>=100&&dist<=180&&this.requestAttack('long_thrust',target))return;
    if(this.action!=='walk')this.changeAction('walk');
    this.x=this.clampX(this.x+this.facing*BOSS_RULES.moveSpeed*dt/1000);
  }
}
