import {CAVALRY,frameForState,type CavalryState,type Facing} from './core.js';
/** Narrow structural interfaces: compatible with Phaser Scene/Image; no second animation clock. */
export interface SpriteLike {
 setOrigin(x:number,y:number):unknown;setPosition(x:number,y:number):unknown;
 setFrame(frame:string):unknown;setFlipX(flip:boolean):unknown;setScale(s:number):unknown;
 setDepth(d:number):unknown;setVisible(v:boolean):unknown;setTint(c:number):unknown;clearTint():unknown;destroy():void;
}
export interface SceneLike {
 load:{atlas(key:string,textureURL:string,atlasURL:string):unknown};
 textures:{exists(key:string):boolean};
 add:{image(x:number,y:number,key:string,frame:string):SpriteLike};
}
export interface ViewState {x:number;feetY:number;facing:Facing;state:CavalryState;elapsedMs:number;durationMs?:number;visible?:boolean;flash?:boolean;}
export function preloadCavalry(scene:SceneLike,baseUrl='assets/khitan_cavalry_enemy_v1'):void {
 if(scene.textures.exists(CAVALRY.atlasKey))return;
 const base=baseUrl.replace(/\/$/,'');
 scene.load.atlas(CAVALRY.atlasKey,`${base}/atlas/khitan_cavalry.png`,`${base}/atlas/khitan_cavalry.json`);
}
export class PhaserCavalryView {
 readonly sprite:SpriteLike;private dead=false;private frame='';
 constructor(scene:SceneLike,depth=20){
   if(!scene.textures.exists(CAVALRY.atlasKey))throw new Error('Cavalry atlas is not loaded. Call preloadCavalry in Scene.preload; construct view in Scene.create.');
   this.sprite=scene.add.image(0,0,CAVALRY.atlasKey,frameForState('idle',0));
   this.sprite.setOrigin(CAVALRY.anchorX/CAVALRY.frameWidth,CAVALRY.anchorY/CAVALRY.frameHeight);
   this.sprite.setScale(1);this.sprite.setDepth(depth);
 }
 sync(s:ViewState):void{
   if(this.dead)return;
   this.sprite.setPosition(Math.round(s.x),Math.round(s.feetY));this.sprite.setFlipX(s.facing<0);
   const f=frameForState(s.state,s.elapsedMs,s.durationMs);if(f!==this.frame){this.sprite.setFrame(f);this.frame=f;}
   this.sprite.setVisible(s.visible!==false);
   if(s.flash)this.sprite.setTint(0xffffff);else this.sprite.clearTint();
 }
 destroy():void{if(this.dead)return;this.dead=true;this.sprite.destroy();}
}
