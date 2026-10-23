import {CAVALRY,frameForState,type Facing,type CavalryState} from './core.js';
/** Structural Phaser interfaces; compile without bundling another copy of Phaser. */
export interface SpriteLike {
 setOrigin(x:number,y:number):unknown;
 setPosition(x:number,y:number):unknown;
 setFrame(frame:string):unknown;
 setFlipX(flip:boolean):unknown;
 setScale(scale:number):unknown;
 setDepth(depth:number):unknown;
 setVisible(visible:boolean):unknown;
 setTint(color:number):unknown;
 clearTint():unknown;
 destroy():void;
}
export interface SceneLike {
 load:{atlas(key:string,textureURL:string,atlasURL:string):unknown};
 textures:{exists(key:string):boolean};
 add:{image(x:number,y:number,key:string,frame:string):SpriteLike};
}
export interface CavalryViewState {
 x:number;feetY:number;facing:Facing;state:CavalryState;
 elapsedMs:number;stateDurationMs?:number;visible?:boolean;flash?:boolean;
}
/** Call inside Scene.preload(), BEFORE Phaser starts loading. */
export function preloadCavalryV6(scene:SceneLike,baseUrl='assets/khitan_cavalry_v6'):void {
 if(scene.textures.exists(CAVALRY.atlasKey))return;
 const base=baseUrl.replace(/\/$/,'');
 scene.load.atlas(CAVALRY.atlasKey,`${base}/atlas/khitan_cavalry_atlas.png`,`${base}/atlas/khitan_cavalry_atlas.json`);
}
/** This class renders. Existing AI/physics remains the single authority for movement & damage. */
export class PhaserCavalryView {
 readonly sprite:SpriteLike;
 private frame=''; private destroyed=false;
 constructor(scene:SceneLike,depth=20){
  if(!scene.textures.exists(CAVALRY.atlasKey))throw new Error('Cavalry atlas not loaded. preloadCavalryV6() belongs in Scene.preload().');
  this.sprite=scene.add.image(0,0,CAVALRY.atlasKey,'khitan_cavalry_idle_01.png');
  this.sprite.setOrigin(CAVALRY.anchorX/CAVALRY.frameWidth,CAVALRY.anchorY/CAVALRY.frameHeight);
  this.sprite.setScale(1);
  this.sprite.setDepth(depth);
 }
 sync(s:CavalryViewState):void {
  if(this.destroyed)return;
  if(!Number.isFinite(s.x)||!Number.isFinite(s.feetY))throw new RangeError('position must be finite');
  this.sprite.setPosition(Math.round(s.x),Math.round(s.feetY));
  this.sprite.setFlipX(s.facing<0);
  const f=frameForState(s.state,s.elapsedMs,s.stateDurationMs);
  if(f!==this.frame){this.sprite.setFrame(f);this.frame=f;}
  this.sprite.setVisible(s.visible!==false);
  if(s.flash)this.sprite.setTint(0xffffff);else this.sprite.clearTint();
 }
 destroy():void {if(this.destroyed)return;this.destroyed=true;this.sprite.destroy();}
}
