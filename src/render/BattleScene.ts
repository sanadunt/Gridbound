import Phaser from 'phaser';
import { Battle, ENRAGE_AT, type BattleEvent } from '../game/simulation';
import { installArt, heroCanvas, heroKey } from '../art/pixels';
import { monsterCanvas } from '../art/monsters';
import { KITS, type ClassId } from '../game/content';
import { Sound } from '../audio/sound';
import { t, lang, fmtInt } from '../i18n';
import { eventText } from '../i18n/content';
import { HitStats, allowedShake, SHAKE_PER_SECOND, HIT_STOP_GAP } from './hit-feedback';
import { ARENA, cell, center } from './arena';
export { ARENA, cell, center } from './arena';
/** Floating numbers follow the game language (3,000 / 3.000); seconds texts like '−0.6s' are localized by eventText(). */
const num = (value: number | string) => typeof value === 'number' ? fmtInt(value) : value;

type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;color:number;size:number;gravity:number};
type BossCue={color:number;kind:'threat'|'phase'|'break'|'summon'|'ultimate'|'victory';left:number;total:number};
// Heroes stand in the upper part of their cell; the DOM unit card puts HP and the skill chip below them.
const HERO_SCALE=2,HERO_LIFT=18;
export const ENEMY_DEATH_ANIMATION_MS=780;
export const ENEMY_DEATH_ANIMATION_REDUCED_MS=120;
export class BattleScene extends Phaser.Scene {
 battle:Battle; soundBox:Sound; onFrame:(dt:number)=>void;
 reducedMotion=false;hoverSlot=-1;dragId=-1;dragPoint?:{x:number;y:number};
 private heroes=new Map<number,Phaser.GameObjects.Image>();private enemies=new Map<number,Phaser.GameObjects.Image>();
 private particles:Particle[]=[];private age=0;private accumulator=0;/** Battle speed against the wall clock (the first-battle coach slows the fight to 0.3 while it explains a move): each frame feeds dt × timeScale into the fixed 1/60 s tick loop, so determinism is unchanged. */public timeScale=1;private pulse=0;private shake=0;private bossCue?:BossCue;
 private flashes=new Map<number,number>();private attacks=new Map<number,number>();private bg!:Phaser.GameObjects.Image;
 private floor!:Phaser.GameObjects.Graphics;
 private dragon!:Phaser.GameObjects.Image;
 private threats!:Phaser.GameObjects.Graphics;
 private fx!:Phaser.GameObjects.Graphics;
 private hits=new HitStats();private shakeUsed=0;private lastStop=-9;
 private hitStop=0;private bossKick=0;private flashRect!:Phaser.GameObjects.Rectangle;private introLeft=0;private victoryAge=0;
 private enemyDeathElapsed=0;private enemyDeathDuration=ENEMY_DEATH_ANIMATION_MS;private enemyDeathEnemyId:string|null=null;private enemyDeathStarted=false;private enemyDeathComplete=true;private enemyDeathWaiters:Array<()=>void>=[];
 constructor(battle:Battle,sound:Sound,onFrame:(dt:number)=>void){super('battle');this.battle=battle;this.soundBox=sound;this.onFrame=onFrame;}
 private setBossCue(kind:BossCue['kind'],color:number,duration:number){
  const priority:Record<BossCue['kind'],number>={threat:1,summon:1,break:3,phase:4,ultimate:4,victory:5};
  if(this.bossCue&&this.bossCue.left>0&&priority[this.bossCue.kind]>priority[kind])return;
  this.bossCue={kind,color,left:duration,total:duration};
 }
 private soundKind(e:BattleEvent){
  if(e.type==='warning')return 'threat';
  if(e.type==='defeat')return ''; // the result screen plays the defeat cue once
  if(e.type==='buff'&&e.text)return ''; // status announcements ride on the cast cue
  if(e.type==='minionAttack')return 'minion-attack';
  if(e.type==='minionDown')return 'minion-down';
  if(e.type==='cast')return `cast-${e.kind??'attack'}`;
  if(e.type==='projectile'){
   if(e.kind==='nova'||e.kind==='burst'||e.kind==='ultimate')return 'hit-heavy';
   if(e.kind==='magic')return 'hit-magic';
   return 'hit';
  }
  if(e.type==='hurt')return e.text==='PACT'?'pact':e.amount?'hurt':'blocked';
  if(e.type==='shield')return e.text?'guard':'shield';
  return e.type;
 }
 create(){
  installArt(this);
  this.bg=this.add.image(300,380,'ruins').setScale(2);this.floor=this.add.graphics().setDepth(2);
  this.dragon=this.add.image(300,200,'dragon-0').setScale(2.28).setDepth(5);
  this.threats=this.add.graphics().setDepth(7);this.fx=this.add.graphics().setDepth(20);this.flashRect=this.add.rectangle(300,380,600,760,0xffffff,0).setDepth(45);this.resetEnemyDeathAnimation();this.syncHeroes();
 }
 /** create() has run (the engine's first step): from then on a new battle goes through replace(), which builds its hero sprites. */
 get created(){return Boolean(this.floor);}
 replace(battle:Battle){this.tweens.killAll();for(const child of [...this.children.list])if('depth' in child && Number(child.depth)>=17)child.destroy();this.fx=this.add.graphics().setDepth(20);this.flashRect=this.add.rectangle(300,380,600,760,0xffffff,0).setDepth(45);this.hitStop=0;this.bossKick=0;this.introLeft=0;this.victoryAge=0;this.pulse=0;this.shake=0;this.bossCue=undefined;this.dragId=-1;this.dragPoint=undefined;this.hoverSlot=-1;this.battle=battle;this.heroes.forEach(s=>s.destroy());this.heroes.clear();this.enemies.forEach(s=>s.destroy());this.enemies.clear();this.particles=[];this.flashes.clear();this.attacks.clear();this.accumulator=0;this.timeScale=1;this.resetHitStats();this.resetEnemyDeathAnimation();this.syncHeroes();}
 private resetHitStats(){this.hits.reset();this.shakeUsed=0;this.lastStop=-9;}
 /** Add screen shake within a per-second budget so dense fights do not shake constantly; `force` (ultimate, KO, break) ignores the budget. */
 private addShake(amount:number,force=false){const use=allowedShake(amount,this.shakeUsed,force);if(use<=0)return;this.shake=Math.max(this.shake,use);this.shakeUsed+=use;}

 /** Battle start: boss lunges in, white flash and a FIGHT cue between the boss and the front row (the stage name stays on the ready window). */
 encounterStart(){this.resetHitStats();this.introLeft=this.reducedMotion?0:.45;this.screenFlash(0xffffff,.55);this.floating(300,300,t('battle.begin'),'#ffe082',true,true);}
 private screenFlash(color:number,alpha=.45){if(this.reducedMotion)return;this.flashRect.setFillStyle(color,alpha);this.tweens.add({targets:this.flashRect,fillAlpha:0,duration:220,ease:'Quad.easeOut'});}
 private freeze(seconds:number,gap=false){if(this.reducedMotion||gap&&this.age-this.lastStop<HIT_STOP_GAP)return;this.lastStop=this.age;this.hitStop=Math.max(this.hitStop,seconds);}

 /** True when the current victory's boss sequence has finished, or no victory is active. */
 public isEnemyDeathAnimationComplete(): boolean {this.ensureEnemyDeathAnimation();return this.enemyDeathComplete;}

 /** Resolve when the current boss has finished dying. A replacement encounter cancels the old wait. */
 public waitForEnemyDeathAnimation(): Promise<void> {this.ensureEnemyDeathAnimation();if(this.enemyDeathComplete)return Promise.resolve();return new Promise(resolve=>this.enemyDeathWaiters.push(resolve));}

 private resetEnemyDeathAnimation(){
  this.enemyDeathWaiters.splice(0).forEach(resolve=>resolve());
  this.enemyDeathElapsed=0;this.enemyDeathDuration=ENEMY_DEATH_ANIMATION_MS;this.enemyDeathEnemyId=this.battle.enemyId;this.enemyDeathStarted=false;this.enemyDeathComplete=true;
  if(this.dragon?.active){const scale=this.battle.enemyId==='dragon'?2.28:1.95;this.dragon.setTexture(this.enemyTexture(this.battle.enemyId,0));this.dragon.setPosition(300,194).setScale(scale).setAlpha(1).setRotation(0).clearTint();}
 }

 private ensureEnemyDeathAnimation(){
  if(this.enemyDeathEnemyId!==this.battle.enemyId){this.resetEnemyDeathAnimation();}
  if(this.enemyDeathStarted&&this.battle.status!=='victory'){this.resetEnemyDeathAnimation();}
  if(this.battle.status==='victory'&&!this.enemyDeathStarted)this.startEnemyDeathAnimation();
 }

 private startEnemyDeathAnimation(){
  if(this.enemyDeathStarted)return;
  this.enemyDeathStarted=true;this.enemyDeathComplete=false;this.enemyDeathElapsed=0;this.enemyDeathDuration=this.reducedMotion?ENEMY_DEATH_ANIMATION_REDUCED_MS:ENEMY_DEATH_ANIMATION_MS;this.enemyDeathEnemyId=this.battle.enemyId;
  if(!this.reducedMotion){
   const colors=[0xeed694,0xf4c77f,0x9bd1a1];
   for(let i=0;i<36;i++){const angle=Math.random()*Math.PI*2,radius=Math.random()*42;this.particle(300+Math.cos(angle)*radius,194+Math.sin(angle)*radius*.72,colors[i%colors.length],Math.random()>.65?4:2,.38+Math.random()*.24,Math.cos(angle)*(35+Math.random()*70),-18-Math.random()*55,65+Math.random()*45);}
  }
 }

 private advanceEnemyDeathAnimation(dt:number){
  this.ensureEnemyDeathAnimation();
  if(!this.enemyDeathStarted||this.enemyDeathComplete)return;
  this.enemyDeathElapsed=Math.min(this.enemyDeathDuration,this.enemyDeathElapsed+dt*1000);
  if(this.enemyDeathElapsed>=this.enemyDeathDuration){this.enemyDeathComplete=true;this.enemyDeathWaiters.splice(0).forEach(resolve=>resolve());}
 }

 private deathProgress(){return Math.min(1,this.enemyDeathDuration>0?this.enemyDeathElapsed/this.enemyDeathDuration:1);}

 /** An enemy's sprite frame (`${id}-${frame}`). Enemy art is registered on first use, all 8 frames at once so the idle loop never stalls mid-fight: boot no longer builds every enemy and variant. */
 enemyTexture(id:string,frame:number){const key=`${id}-${frame}`;if(!this.textures.exists(key))for(let f=0;f<8;f++)if(!this.textures.exists(`${id}-${f}`))this.textures.addCanvas(`${id}-${f}`,monsterCanvas(id,f));return key;}
 /** A hero's sprite frame: roster heroes with accents get their own texture (made on first use); Roguelike recruits use the class sprite. */
 private heroTexture(h:{id:number;classId:ClassId},frame:number){const look=this.battle.mode==='endless'?undefined:h.id,key=`${heroKey(h.classId,look)}-${frame}`;if(!this.textures.exists(key))this.textures.addCanvas(key,heroCanvas(h.classId,frame,look));return key;}
 private syncHeroes(){if(!this.floor)return;for(const h of this.battle.heroes){if(this.heroes.has(h.id))continue;const p=center(h.slot);this.heroes.set(h.id,this.add.image(p.x,p.y-HERO_LIFT,this.heroTexture(h,0)).setScale(HERO_SCALE).setDepth(9));}}
 update(_time:number,delta:number){
  let dt=Math.min(delta/1000,.1);
  if(this.hitStop>0){this.hitStop-=dt;dt*=.08;}
  this.age+=dt;
  if(this.battle.status==='fighting'){this.accumulator+=dt*this.timeScale;while(this.accumulator>=1/60){this.battle.tick(1/60);this.accumulator-=1/60;}}
  this.shakeUsed=Math.max(0,this.shakeUsed-dt*SHAKE_PER_SECOND);
  const events=this.battle.drain();events.forEach(e=>{const cue=this.event(e)??this.soundKind(e);if(cue)this.soundBox.play(cue);});
  this.advanceEnemyDeathAnimation(dt);
  this.draw(dt);this.onFrame(dt);
 }
 private draw(dt:number){
  const b=this.battle,t=this.age;this.floor.clear();this.threats.clear();this.fx.clear();
  if(this.bossCue){const cue=this.bossCue,alpha=this.reducedMotion?.72:Math.min(.72,(cue.left/cue.total)*1.25),width=cue.kind==='threat'?150:cue.kind==='phase'?188:cue.kind==='break'?164:142;this.fx.lineStyle(2,cue.color,alpha).lineBetween(300-width/2,276,300+width/2,276);this.fx.fillStyle(cue.color,alpha).fillTriangle(300,268,292,280,308,280);if(cue.kind==='phase'||cue.kind==='victory'){this.fx.lineStyle(1,cue.color,alpha*.8).lineBetween(300-width/2,282,300+width/2,282);}cue.left-=dt;if(cue.left<=0)this.bossCue=undefined;}
  const death=this.enemyDeathStarted&&b.status==='victory',progress=death?this.deathProgress():0,collapse=this.reducedMotion?progress:progress*progress,baseScale=b.enemyId==='dragon'?2.28:1.95,charging=b.threats.some(v=>v.left<1);
  if(this.introLeft>0)this.introLeft-=dt;if(this.bossKick>0)this.bossKick-=dt;if(b.status==='victory')this.victoryAge+=dt;else this.victoryAge=0;
  const intro=this.introLeft>0?this.introLeft/.45:0,kick=this.bossKick>0?this.bossKick/.14:0;
  const bossFrame=death&&this.enemyDeathComplete?0:this.reducedMotion?0:Math.floor(t*7)%8,idleBob=death||this.reducedMotion?0:Math.sin(t*1.8)*5,shakeScale=charging&&!this.reducedMotion?Math.sin(t*16)*.035:0;
  this.dragon.setTexture(this.enemyTexture(b.enemyId,bossFrame)).setY(194+idleBob-intro*intro*70-kick*10+(death&&!this.reducedMotion?collapse*34:0)).setX(300+(kick>0?Math.sin(t*90)*4*kick:0)).setScale(baseScale*(1+(!this.reducedMotion?collapse*.08:0)+shakeScale),baseScale*(1-(death&&!this.reducedMotion?collapse*.72:0)));
  this.dragon.setAlpha(death?Math.max(0,1-progress):1).setRotation(death&&!this.reducedMotion?collapse*.18:0);if(this.pulse>0){this.pulse-=dt;this.dragon.setTintFill(0xffffff);}else if(death)this.dragon.setTint(0xf1c77f);else if(b.stageTime>ENRAGE_AT)this.dragon.setTint(0xffb0a4);else this.dragon.clearTint();
  if(this.shake>0&&!this.reducedMotion){this.shake-=dt;this.cameras.main.setScroll(Math.sin(t*80)*this.shake*9,Math.cos(t*70)*this.shake*7);}else this.cameras.main.setScroll(0,0);
  // Slot borders remain visible beneath effects and communicate the legal drop area.
  for(let i=0;i<9;i++){
   const p=cell(i),h=b.heroes.find(a=>a.slot===i),selected=h?.id===b.selected;
   this.floor.fillStyle(selected?0x244c43:0x152923,.78).fillRect(p.x,p.y,144,112);
   this.floor.lineStyle(1,selected?0xd9bd7c:0x4e6650,selected?1:.62).strokeRect(p.x+.5,p.y+.5,143,111);
   for(const dx of [0,137])for(const dy of [0,105])this.floor.fillStyle(selected?0xdfc486:0x70836a).fillRect(p.x+dx,p.y+dy,7,2).fillRect(p.x+dx,p.y+dy,2,7);
   if(this.hoverSlot===i){this.floor.fillStyle(0xe1ce93,.22).fillRect(p.x,p.y,144,112);this.floor.lineStyle(2,0xefdeb0).strokeRect(p.x,p.y,144,112);}
   if(h){
    // A hero without a sprite (a battle handed over without replace()) gets one here instead of breaking the frame.
    if(!this.heroes.has(h.id))this.syncHeroes();
    const pos=center(i),image=this.heroes.get(h.id)!;let x=pos.x,y=pos.y-HERO_LIFT;
    const attack=this.attacks.get(h.id)??0;if(attack>0){this.attacks.set(h.id,attack-dt);if(!this.reducedMotion)y-=Math.sin(Math.min(1,attack/.34)*Math.PI)*26;}
    if(this.victoryAge>0&&h.hp>0&&!this.reducedMotion)y-=Math.abs(Math.sin((this.victoryAge*2.6+h.id*.37)*Math.PI))*18;
    if(this.dragId===h.id&&this.dragPoint){x=this.dragPoint.x;y=this.dragPoint.y;image.setDepth(30);}else image.setDepth(9);
    image.x=Phaser.Math.Linear(image.x,x,Math.min(1,dt*18));image.y=Phaser.Math.Linear(image.y,y,Math.min(1,dt*18));image.setTexture(this.heroTexture(h,Math.floor(t*4+h.id)%4));
    image.setAlpha(h.hp<=0?.2:1);const flash=this.flashes.get(h.id)??0;if(flash>0){this.flashes.set(h.id,flash-dt);image.setTint(0xff857e);}else image.clearTint();
    this.floor.fillStyle(0x050818,.55).fillEllipse(pos.x,pos.y+17,62,12);
    if(h.shield>0||b.guardLeft>0){const shieldAlpha=this.reducedMotion?.6:.6+Math.sin(t*3)*.15;this.threats.lineStyle(2,0x9bd8ef,shieldAlpha);this.threats.strokeEllipse(pos.x,pos.y-HERO_LIFT,72,74);this.threats.fillStyle(0x8acee8,.04).fillEllipse(pos.x,pos.y-HERO_LIFT,72,74);}
    if(h.buff>0){const buffWidth=this.reducedMotion?61:61+Math.sin(t*5)*4;this.threats.lineStyle(2,0x8bf3ca,.7);this.threats.strokeEllipse(pos.x,pos.y+14,buffWidth,13);}
    // Counter stance: a gold diamond that fades as the stance runs out.
    if(h.hp>0&&h.counterLeft>0){const r=40+(this.reducedMotion?0:Math.sin(t*6)*2),cy=pos.y-HERO_LIFT;this.threats.lineStyle(2,0xf2c46d,.35+.55*Math.min(1,h.counterLeft/3.5)).strokePoints([{x:pos.x,y:cy-r},{x:pos.x+r,y:cy},{x:pos.x,y:cy+r},{x:pos.x-r,y:cy}],true,true);}
    if(h.hp<=0){this.threats.lineStyle(2,0xa19788,.7).lineBetween(pos.x-8,pos.y-28,pos.x+8,pos.y-12).lineBetween(pos.x+8,pos.y-28,pos.x-8,pos.y-12);}
   }
  }
  for(const danger of b.threats){const blink=this.reducedMotion?.22:.22+Math.sin(t*5)*.065;for(const s of danger.slots){const p=cell(s),color=danger.type==='all'?0xd9b5ee:danger.type==='target'?0xffba78:danger.type==='breath'?0xeb9d5f:0xef786b;this.threats.fillStyle(color,blink).fillRect(p.x+3,p.y+3,138,106);this.threats.lineStyle(2,color,.85).strokeRect(p.x+3,p.y+3,138,106);
   this.threats.fillStyle(color,.7).fillRect(p.x+3,p.y+3,138*danger.left/danger.total,3);
   this.threats.lineStyle(1,color,.28);for(let stripe=0;stripe<6;stripe++)this.threats.lineBetween(p.x+8+stripe*24,p.y+111,p.x+30+stripe*20,p.y+5);
   this.threats.lineStyle(2,0xffd4a6,.8).strokeTriangle(p.x+119,p.y+15,p.x+111,p.y+29,p.x+127,p.y+29);
   if(danger.type==='target'){const marked=center(s);this.threats.lineStyle(3,0xffce91).strokeCircle(marked.x,marked.y-HERO_LIFT,33);this.threats.lineBetween(marked.x,marked.y-HERO_LIFT-42,marked.x,marked.y-HERO_LIFT-22);}
   if(b.status==='fighting'&&danger.type==='meteor'&&danger.left<.55&&!this.reducedMotion){const hit=center(s),yy=hit.y-230*(danger.left/.55);this.fx.fillStyle(0xfac589,.9).fillRect(hit.x-4,yy,8,13);this.fx.fillStyle(0xee9970,.5).fillRect(hit.x-2,yy-17,4,19);this.particle(hit.x,yy,0xfac589,3,.25,0,-20,0);}
  }}
  for(const m of b.minions){let spr=this.enemies.get(m.id);if(!spr){spr=this.add.image(144+m.lane*156,320,this.enemyTexture(m.enemyId??'goblin',0)).setScale(.42).setDepth(6);this.enemies.set(m.id,spr);}spr.y=321+(this.reducedMotion?0:Math.sin(t*4+m.lane)*3);this.threats.fillStyle(0x102621).fillRect(spr.x-23,348,46,3);this.threats.fillStyle(0xd6be78).fillRect(spr.x-23,348,46*m.hp/m.maxHp,3);}
  for(const [id,spr] of this.enemies){if(!b.minions.some(m=>m.id===id)){spr.destroy();this.enemies.delete(id);}}
  // Turrets: a brass marker in their lane that fades as the 6 s run out.
  b.turrets.forEach((tur,i)=>{const n=b.turrets.slice(0,i).filter(o=>o.lane===tur.lane).length,x=144+tur.lane*156-26+n*18,y=356,a=.3+.7*Math.max(0,Math.min(1,tur.left/6));this.threats.fillStyle(0x2a2212,a).fillRect(x-7,y,14,8);this.threats.fillStyle(0xe0b860,a).fillRect(x-6,y+1,12,6).fillRect(x-1,y-6,3,7);this.threats.fillStyle(0xe0b860,a*.8).fillRect(x-7,y+10,14*Math.max(0,Math.min(1,tur.left/6)),2);});
  // A channel (Mending Rite) fills an arc around the boss until it completes.
  for(const ch of b.threats.filter(v=>v.type==='channel')){const progress=Math.max(0,Math.min(1,1-ch.left/ch.total));this.threats.lineStyle(4,0x0e2a22,.75).strokeCircle(300,194,82);this.threats.lineStyle(4,0x7ee0c0,.9).beginPath().arc(300,194,82,-Math.PI/2,-Math.PI/2+progress*Math.PI*2,false).strokePath();}
  if(b.targetLane>=0){const x=144+b.targetLane*156;this.threats.lineStyle(1,0xf2d891,.7).strokeCircle(x,321,30);this.threats.lineBetween(x-36,321,x-24,321).lineBetween(x+24,321,x+36,321);}
  // Ambient embers stop at a terminal result so victory cannot keep feeding effects.
  if(!this.reducedMotion&&b.status!=='victory'&&b.status!=='defeat'&&Math.random()<dt*16)this.particle(35+Math.random()*530,320,0xe4c278,1,3,(Math.random()-.5)*15,-12,0);
  for(const x of [55,545]){const y=292,flicker=this.reducedMotion?0:Math.sin(t*9)*2;this.fx.fillStyle(0xe8ac59,.08).fillCircle(x,y,16);this.fx.fillStyle(0xf3cc7e,.8).fillRect(x-3,y-6+flicker,6,10);this.fx.fillStyle(0xffe6aa).fillRect(x-1,y-6,2,8);}
  for(const p of this.particles){p.life-=dt;p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;this.fx.fillStyle(p.color,Math.max(0,p.life/p.max));this.fx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,p.size,p.size);}
  this.particles=this.particles.filter(p=>p.life>0);
 }
 private particle(x:number,y:number,color:number,size=3,life=.7,vx=(Math.random()-.5)*170,vy=(Math.random()-.5)*150,gravity=70){if(this.particles.length>240)return;this.particles.push({x,y,vx,vy,life,max:life,color,size,gravity});}
 private burst(x:number,y:number,color:number,n=22){const count=Math.min(n,this.reducedMotion?4:18);for(let i=0;i<count;i++){const size=this.reducedMotion?3:Math.random()>.5?4:2,life=this.reducedMotion?.22:.4+Math.random()*.6;this.particle(x,y,color,size,life,this.reducedMotion?0:(Math.random()-.5)*170,this.reducedMotion?0:(Math.random()-.5)*150,this.reducedMotion?0:70);}}
 floating(x:number,y:number,text:string,color='#ffdfa0',big=false,crit=false){
  const size = crit ? '36px' : big ? '28px' : '22px';
  const strokeColor = crit ? '#5c3900' : '#122825';
  const strokeThickness = crit ? 7 : 5;
  const label=this.add.text(x,y,eventText(text,lang()),{fontFamily:'"Press Start 2P"',fontSize:size,color,stroke:strokeColor,strokeThickness}).setOrigin(.5).setDepth(40);
  if(this.reducedMotion){this.time.delayedCall(220,()=>label.destroy());return;}
  label.setScale(crit?1.6:1.3);this.tweens.add({targets:label,scale:1,y:y-8,duration:120,ease:'Back.easeOut'});
  this.tweens.add({targets:label,y:y-(crit?60:46),alpha:0,delay:crit?420:280,duration:crit?900:700,onComplete:()=>label.destroy()});
 }
 spawnDamageNumber(x: number, y: number, value: number | string, options: { isCrit?: boolean; isBreak?: boolean; isHeal?: boolean; isBlocked?: boolean } = {}) {
   if (options.isCrit) {
     this.floating(x, y, num(value), '#ffe082', true, true);
     this.ring(x, y, 0xffd54f, 14, 2.6);
     this.addShake(0.28);
   } else if (options.isBreak) {
     this.floating(x, y, num(value), '#ff80ab', true, true);
     this.ring(x, y, 0xff4081, 14, 2.4);
   } else if (options.isHeal) {
     this.floating(x, y, `+${num(value)} HP`, '#69f0ae');
   } else if (options.isBlocked) {
     this.floating(x, y, t('battle.blocked'), '#80deea', true);
   } else {
     this.floating(x, y, num(value), '#ffdfa0');
   }
 }
 spawnSlashArc(x: number, y: number, rotation = 0) {
   const slash = this.add.graphics().setDepth(19);
   slash.lineStyle(4, 0xf4e5b5, 0.9).beginPath().arc(x, y - 7, 33, -2.7 + rotation, 0.3 + rotation).strokePath();
   if(this.reducedMotion){this.time.delayedCall(120,()=>slash.destroy());return;}
   this.tweens.add({ targets: slash, alpha: 0, duration: 220, onComplete: () => slash.destroy() });
 }
 private ring(x:number,y:number,color:number,radius=16,expand?:number){
  const ring=this.add.circle(x,y,radius).setStrokeStyle(3,color).setDepth(21);
  if(this.reducedMotion){this.time.delayedCall(170,()=>ring.destroy());return;}
  this.tweens.add({targets:ring,scale:expand??4,alpha:0,duration:400,onComplete:()=>ring.destroy()});
 }
 private projectile(e:BattleEvent,isCrit:boolean){
  const h=this.battle.hero(e.source??-1);const from=h?center(h.slot):{x:300,y:620};const to=e.lane===-1?{x:300,y:215}:{x:144+(e.lane??1)*156,y:320};
  const color=e.kind==='nova'||e.kind==='magic'||e.kind==='burst'?0x9bcdf3:e.kind==='steal'?0xd2b0ed:0xf1d393;
  const bolt=this.add.rectangle(from.x,from.y,e.kind==='arrow'?4:11,e.kind==='arrow'?24:11,color).setDepth(18).setRotation(Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2);
  const isBig=e.kind==='nova'||e.kind==='burst'||e.kind==='ultimate';
  const amount=Math.round(e.amount??0),share=e.lane===-1?amount/Math.max(1,this.battle.bossMax):0;
  const finish=()=>{
   bolt.destroy();
   this.burst(to.x,to.y,color,isCrit?18:isBig?14:8);
   // Crits are relative to this encounter; shake and flash scale with the hit's share of the boss's HP, and only crits stop time.
   if(isCrit){this.floating(to.x,to.y,fmtInt(amount),'#ffe082',true,true);this.addShake(.1+Math.min(.18,share*4));this.ring(to.x,to.y,0xffd54f,14,2.6);this.freeze(.07,true);this.screenFlash(0xffffff,Math.min(.22,.08+share*3));}
   else this.floating(to.x,to.y,fmtInt(amount),e.kind==='nova'?'#b5dbff':'#f6dfab',isBig);
   if(e.lane===-1){this.pulse=.08;this.bossKick=.14;this.ring(to.x,to.y,color,12,2.2);}
   if(isBig&&!isCrit)this.addShake(.06+Math.min(.1,share*3));
  };
  if(this.reducedMotion){bolt.setPosition(to.x,to.y);finish();return;}
  this.tweens.add({targets:bolt,x:to.x,y:to.y,duration:e.kind==='slash'?150:370,ease:'Cubic.easeIn',onUpdate:()=>this.particle(bolt.x,bolt.y,color,2,.2,0,0,0),onComplete:finish});
 }
 /** Play an event's effects; returns a sound cue when it differs from soundKind (crits). */
 private event(e:BattleEvent):string|undefined{
  const pos=e.slot!==undefined?center(e.slot):{x:300,y:220};let cue:string|undefined;
  if(e.type==='tap'){this.attacks.set(e.source!,.13);this.ring(pos.x,pos.y,0xe8d49a,12,2.2);this.burst(pos.x,pos.y,0xf4d991,4);if(e.text)this.floating(pos.x,pos.y-20,e.text,'#ffeeac');}
  if(e.type==='cast'){
   this.attacks.set(e.source!,.34);
   const h=this.battle.hero(e.source??-1);
   if(h){
    const kind=e.kind??'attack',color=kind==='heal'||kind==='regen'?0x69f0ae:kind==='shield'||kind==='partyshield'?0x80deea:kind==='buff'?0x96f2be:KITS[h.classId].color;
    const castColor=typeof color==='number'?color:Number.parseInt(color.slice(1),16);
    const p=center(h.slot);this.ring(p.x,p.y,castColor,13,2.1);this.burst(p.x,p.y,castColor,4);
   }
  }
  if(e.type==='projectile'){
   const crit=this.hits.crit(e.amount??0,e.source??-1,e.kind);if(crit)cue='crit';
   this.projectile(e,crit);
   if(e.kind==='slash'){const h=this.battle.hero(e.source??-1);if(h){const p=center(h.slot);this.spawnSlashArc(p.x,p.y);}}
  }
  if(e.type==='bomb'){
   const rune=this.add.circle(300,210,26).setStrokeStyle(2,0xb9cef5).setDepth(17);
   if(this.reducedMotion)this.time.delayedCall(180,()=>rune.destroy());else this.tweens.add({targets:rune,scale:.2,angle:180,duration:900,onComplete:()=>rune.destroy()});
   if(e.lane!==undefined&&e.lane>=0)this.ring(144+e.lane*156,320,0xb9cef5,18,2.2);
  }
  if(e.type==='hurt'&&e.text==='PACT'){
   // Hollow Pact's self-cost is a price, not an enemy hit: its own colour, no shake or screen flash.
   this.floating(pos.x,pos.y-10,`${eventText('PACT',lang())} −${fmtInt(e.amount??0)}`,'#d7a6ff');this.ring(pos.x,pos.y,0xb98ae6,11,1.8);this.burst(pos.x,pos.y,0xb98ae6,4);
  }else if(e.type==='hurt'){
   const blocked=!e.amount,hero=this.battle.hero(e.source??-1),share=(e.amount??0)/Math.max(1,hero?.maxHp??1);this.flashes.set(e.source!,.16);
   // Shake and flash scale with the share of that hero's max HP the hit took.
   if(!blocked&&share>=.12)this.addShake(Math.min(.22,share*.6));if(!blocked&&share>=.2)this.screenFlash(0xff3030,Math.min(.2,share*.35));
   if(blocked){this.floating(pos.x,pos.y-10,t('battle.blocked'),'#80deea',true);this.ring(pos.x,pos.y,0x80deea,14,2.3);}
   else{this.floating(pos.x,pos.y-10,`−${fmtInt(e.amount??0)}`,'#ff8a80',share>=.3);this.ring(pos.x,pos.y,0xe99a8b,11,1.8);}
   this.burst(pos.x,pos.y,blocked?0x9ed6ed:0xe99a8b,blocked?4:6);
  }
  if(e.type==='down'){
   // A KO gets its own moment: grey burst, a falling ring, a short stop and the danger banner (main.ts).
   this.burst(pos.x,pos.y,0xa19788,20);this.ring(pos.x,pos.y,0xc9c1b4,16,2.6);this.ring(pos.x,pos.y,0x6b645a,10,1.6);this.floating(pos.x,pos.y-58,t('battle.down'),'#cfc6b8',true);
   this.freeze(.12);this.addShake(.22,true);this.screenFlash(0x3a3a3a,.25);
  }
  if(e.type==='heal'){
   this.floating(pos.x,pos.y-12,`+${fmtInt(e.amount??0)} HP`,'#69f0ae');
   this.ring(pos.x,pos.y,0x69f0ae,13,2.1);
   if(!this.reducedMotion)for(let i=0;i<4;i++)this.particle(pos.x+(i-1.5)*10,pos.y+20,0x69f0ae,3,.55,(i-1.5)*16,-42,-10);
  }
  if(e.type==='shield'){
   const slots=e.targets??(e.slot!==undefined?[e.slot]:[]);
   if(slots.length)for(const slot of slots){const p=center(slot);this.ring(p.x,p.y,0x80deea,15,2.2);}
   else this.ring(pos.x,pos.y,0x80deea,15,2.2);
  }
  if(e.type==='buff'){
   const color=e.kind==='mark'?0xffc46b:e.kind==='weaken'?0xc4b0ff:e.kind==='curse'?0xb07ae0:e.kind==='turret'?0xe0b860:e.kind==='counter'?0xf2c46d:0x96f2be;
   // Boss statuses (no slot) float between the boss and the grid: above the boss they would sit under the HUD's intel band on short phones.
   this.ring(pos.x,pos.y,color,13,2.1);if(e.text)this.floating(pos.x,e.slot===undefined?300:pos.y-30,e.text,`#${color.toString(16).padStart(6,'0')}`);
  }
  if(e.type==='stun')this.ring(300,200,0xb9cef5,16,2.2); // DELAYED/RESISTED goes to the HUD's boss status strip (battle-log)
  if(e.type==='interrupt'){this.setBossCue('break',0x7ee0c0,.5);this.ring(300,200,0x7ee0c0,18,2.6);this.burst(300,200,0x9ff0d6,14);} // the HUD banner carries the text
  if(e.type==='enrage'){this.setBossCue('phase',0xff6b5b,.6);this.ring(300,200,0xff6b5b,18,2.6);if(e.kind==='on'){this.addShake(.2,true);this.screenFlash(0xff3030,.22);}}
  if(e.type==='break'){this.setBossCue('break',0xffd54f,.52);this.freeze(.1);this.screenFlash(0xffe6a0,.4);this.floating(300,150,t('battle.break'),'#ffe082',true,true);this.burst(300,200,0xf5d378,20);this.ring(300,200,0x55e3c7,19,2.4);this.ring(300,200,0xffd54f,13,2.8);this.addShake(.3,true);}
  if(e.type==='coin'){this.floating(pos.x,pos.y-20,`+${fmtInt(e.amount??0)}g`);this.burst(pos.x,pos.y,0xe9c56d,5);}
  if(e.type==='move')this.floating(pos.x,pos.y-25,e.text??t('battle.fx.move'),'#eed69a');
  if(e.type==='impact'){
   for(const slot of e.targets??[]){const p=center(slot),color=e.kind==='breath'?0x8ceeaa:0xf49b70;this.burst(p.x,p.y,color,12);this.ring(p.x,p.y,0xf4c07e,12,1.9);if(e.kind==='breath'&&!this.reducedMotion)for(let n=0;n<8;n++){const ratio=n/8;this.particle(305+(p.x-305)*ratio,215+(p.y-215)*ratio,0xa6e1a0,5,.38,15,70,10);}}
   if(e.kind==='all'){this.addShake(.3,true);this.screenFlash(0xd9b5ee,.2);}else if(e.targets?.length)this.addShake(.18); // a finished channel hits no tile
  }
  if(e.type==='claw'){
   this.burst(pos.x,pos.y,0xf0c19a,7);
   const claw=this.add.graphics().setDepth(19);for(let i=0;i<3;i++)claw.lineStyle(2,0xf1d6af,.9).lineBetween(pos.x-20+i*12,pos.y-26,pos.x-3+i*12,pos.y+13);
   if(this.reducedMotion)this.time.delayedCall(120,()=>claw.destroy());else this.tweens.add({targets:claw,alpha:0,duration:280,onComplete:()=>claw.destroy()});
  }
  if(e.type==='minionAttack'){
   const from={x:144+(e.lane??1)*156,y:320},bolt=this.add.rectangle(from.x,from.y,5,5,0xd3e1a1).setDepth(17);
   if(this.reducedMotion){bolt.setPosition(pos.x,pos.y);bolt.destroy();}else this.tweens.add({targets:bolt,x:pos.x,y:pos.y,duration:210,onComplete:()=>bolt.destroy()});
  }
  if(e.type==='minionDown')this.burst(144+e.lane!*156,320,0xb9d58a,14);
  if(e.type==='ultimate'){this.setBossCue('ultimate',0xffe3a0,.65);this.addShake(.55,true);this.freeze(.12);this.screenFlash(0xfff3c0,.7);this.bossKick=.14;this.pulse=.12;this.ring(300,420,0xffe3a0,18,2.7);this.ring(300,220,0xffe3a0,14,2.4);this.burst(300,220,0xf3dda4,20);}
  if(e.type==='warning')this.setBossCue('threat',0xef786b,.34);
  if(e.type==='phase'){this.setBossCue('phase',0xffd54f,.56);this.ring(300,220,0xffd54f,18,2.5);}
  if(e.type==='summon'){this.setBossCue('summon',0x9bd1a1,.4);this.ring(300,320,0x9bd1a1,20,2.4);}
  if(e.type==='victory'){this.ensureEnemyDeathAnimation();this.screenFlash(0xffffff,.6);this.freeze(.15);this.setBossCue('victory',0xffe3a0,.72);this.ring(300,194,0xffe3a0,18,2.8);this.burst(300,194,0xf3dda4,18);}
  if(['banner','phase','warning','break','summon','ultimate','interrupt','down','enrage'].includes(e.type)||(e.type==='shield'&&e.text))window.dispatchEvent(new CustomEvent('battle-banner',{detail:e}));
  if(e.type==='impact'||e.type==='stun')window.dispatchEvent(new CustomEvent('battle-log',{detail:e}));
  return cue;
 }
}
