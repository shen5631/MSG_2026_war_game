import { FRAMES, SHIELD_ENEMY, frameForState, assertSnapshot, type ShieldSnapshot } from "./core.js";
// Structural interfaces accept a Phaser 3 Scene without a second runtime dependency.
export interface ShieldSprite {
 active:boolean;
 setOrigin(x:number,y:number):unknown;setScale(n:number):unknown;
 setPosition(x:number,y:number):unknown;setFlipX(v:boolean):unknown;
 setFrame(name:string):unknown;setVisible(v:boolean):unknown;destroy():void;
}
export interface ShieldScene {
 load:{atlas(key:string,png:string,json:string):unknown};
 textures:{exists(key:string):boolean;get(key:string):{has(frame:string):boolean;setFilter?(mode:number):unknown}};
 add:{sprite(x:number,y:number,key:string,frame:string):ShieldSprite};
}
export const ATLAS_KEY="khitan-shield-enemy-v2";
/** Call inside Scene.preload(). Pass import.meta.env.BASE_URL for subfolder deployment. */
export function preloadKhitanShieldEnemy(scene:ShieldScene,baseUrl="/"):void {
 const base=baseUrl.endsWith("/")?baseUrl:baseUrl+"/";
 const p=base+"assets/khitan_shield_enemy_v2/atlas/khitan_shield_enemy";
 scene.load.atlas(ATLAS_KEY,p+".png",p+".json");
}
/** Host AI / HP / collisions remain authoritative. sync() does not deal damage. */
export class PhaserShieldEnemyView {
 readonly sprite:ShieldSprite;private destroyed=false;private lastFrame="";
 constructor(scene:ShieldScene,x:number,feetY:number,scale=1){
  if(!Number.isFinite(x)||!Number.isFinite(feetY)||!Number.isFinite(scale)||scale<=0)throw new TypeError("Invalid position or scale");
  if(!scene.textures.exists(ATLAS_KEY))throw new Error("Missing shield atlas: preload in Scene.preload, create view in Scene.create");
  const tex=scene.textures.get(ATLAS_KEY);
  for(const list of Object.values(FRAMES))for(const f of list)if(!tex.has(f))throw new Error("Missing frame: "+f);
  tex.setFilter?.(1); // Phaser.Textures.FilterMode.NEAREST
  this.sprite=scene.add.sprite(x,feetY,ATLAS_KEY,FRAMES.idle[0]);
  this.sprite.setOrigin(SHIELD_ENEMY.anchorX/192,SHIELD_ENEMY.anchorY/192);
  this.sprite.setScale(scale);
 }
 sync(s:ShieldSnapshot):void{
  if(this.destroyed||!this.sprite.active)return;
  assertSnapshot(s);
  const name=frameForState(s.state,s.stateElapsedMs);
  if(name!==this.lastFrame){this.sprite.setFrame(name);this.lastFrame=name;}
  this.sprite.setPosition(Math.round(s.x),Math.round(s.feetY));
  this.sprite.setFlipX(s.facing===-1);this.sprite.setVisible(s.visible!==false);
 }
 destroy():void{if(!this.destroyed){this.destroyed=true;if(this.sprite.active)this.sprite.destroy();}}
}
