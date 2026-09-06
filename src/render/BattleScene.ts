import Phaser from 'phaser';
import { Battle, type BattleEvent } from '../game/simulation';
import { installArt } from '../art/pixels';
import { monsterCanvas } from '../art/monsters';
import { ENEMIES } from '../game/world';
import { KITS } from '../game/content';
import { Sound } from '../audio/sound';

export const ARENA={width:600,height:760,x:72,y:367,cw:144,ch:112,gap:12};
export function cell(slot:number){return {x:ARENA.x+(slot%3)*(ARENA.cw+ARENA.gap),y:ARENA.y+Math.floor(slot/3)*(ARENA.ch+ARENA.gap)};}
export function center(slot:number){const p=cell(slot);return {x:p.x+72,y:p.y+54};}
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;color:number;size:number;gravity:number};
export class BattleScene extends Phaser.Scene {
 battle:Battle; soundBox:Sound; onFrame:(dt:number)=>void;
 reducedMotion=false;hoverSlot=-1;dragId=-1;dragPoint?:{x:number;y:number};
 private heroes=new Map<number,Phaser.GameObjects.Image>();private enemies=new Map<number,Phaser.GameObjects.Image>();
 private dragon!:Phaser.GameObjects.Image;private floor!:Phaser.GameObjects.Graphics;private fx!:Phaser.GameObjects.Graphics;private threats!:Phaser.GameObjects.Graphics;
 private particles:Particle[]=[];private age=0;private accumulator=0;private pulse=0;private shake=0;
 private flashes=new Map<number,number>();private attacks=new Map<number,number>();private bg!:Phaser.GameObjects.Image;
 constructor(battle:Battle,sound:Sound,onFrame:(dt:number)=>void){super('battle');this.battle=battle;this.soundBox=sound;this.onFrame=onFrame;}
 create(){
  installArt(this);
  for(const id of Object.keys(ENEMIES).filter(id=>id!=='dragon'))for(let frame=0;frame<8;frame++)this.textures.addCanvas(`${id}-${frame}`,monsterCanvas(id,frame));
  this.bg=this.add.image(300,380,'ruins').setScale(2);this.floor=this.add.graphics().setDepth(2);
  this.dragon=this.add.image(300,200,'dragon-0').setScale(2.28).setDepth(5);
  this.threats=this.add.graphics().setDepth(7);this.fx=this.add.graphics().setDepth(20);this.syncHeroes();
 }
 replace(battle:Battle){this.tweens.killAll();for(const child of [...this.children.list])if('depth' in child && Number(child.depth)>=17)child.destroy();this.fx=this.add.graphics().setDepth(20);this.pulse=0;this.shake=0;this.dragId=-1;this.dragPoint=undefined;this.hoverSlot=-1;this.battle=battle;this.heroes.forEach(s=>s.destroy());this.heroes.clear();this.enemies.forEach(s=>s.destroy());this.enemies.clear();this.particles=[];this.flashes.clear();this.attacks.clear();this.accumulator=0;this.syncHeroes();}
 private syncHeroes(){if(!this.floor)return;for(const h of this.battle.heroes){if(this.heroes.has(h.id))continue;const p=center(h.slot);this.heroes.set(h.id,this.add.image(p.x,p.y-7,`${h.classId}-0`).setScale(1.65).setDepth(9));}}
 update(_time:number,delta:number){
  const dt=Math.min(delta/1000,.1);this.age+=dt;
  if(this.battle.status==='fighting'){this.accumulator+=dt;while(this.accumulator>=1/60){this.battle.tick(1/60);this.accumulator-=1/60;}}
  const events=this.battle.drain();events.forEach(e=>{this.event(e);this.soundBox.play(e.type);});this.soundBox.music(this.battle.status==='fighting');
  this.draw(dt);this.onFrame(dt);
 }
 private draw(dt:number){
  const b=this.battle,t=this.age;this.floor.clear();this.threats.clear();this.fx.clear();
  const charging=b.threats.some(v=>v.left<1);this.dragon.setTexture(`${b.enemyId}-${this.reducedMotion?0:Math.floor(t*7)%8}`).setY(194+(this.reducedMotion?0:Math.sin(t*1.8)*5)).setScale((b.enemyId==='dragon'?2.28:1.95)+(charging&&!this.reducedMotion?Math.sin(t*16)*.035:0));
  this.dragon.setAlpha(b.status==='victory'?.28:1);if(this.pulse>0){this.pulse-=dt;this.dragon.setTint(0xffe6af);}else this.dragon.clearTint();
  if(this.shake>0&&!this.reducedMotion){this.shake-=dt;this.cameras.main.setScroll(Math.sin(t*80)*this.shake*9,Math.cos(t*70)*this.shake*7);}else this.cameras.main.setScroll(0,0);
  // Slot borders remain visible beneath effects and communicate the legal drop area.
  for(let i=0;i<9;i++){
   const p=cell(i),h=b.heroes.find(a=>a.slot===i),selected=h?.id===b.selected;
   this.floor.fillStyle(selected?0x244c43:0x152923,.78).fillRect(p.x,p.y,144,112);
   this.floor.lineStyle(1,selected?0xd9bd7c:0x4e6650,selected?1:.62).strokeRect(p.x+.5,p.y+.5,143,111);
   for(const dx of [0,137])for(const dy of [0,105])this.floor.fillStyle(selected?0xdfc486:0x70836a).fillRect(p.x+dx,p.y+dy,7,2).fillRect(p.x+dx,p.y+dy,2,7);
   if(this.hoverSlot===i){this.floor.fillStyle(0xe1ce93,.22).fillRect(p.x,p.y,144,112);this.floor.lineStyle(2,0xefdeb0).strokeRect(p.x,p.y,144,112);}
   if(h){
    const pos=center(i),image=this.heroes.get(h.id)!;let x=pos.x,y=pos.y-10;
    const attack=this.attacks.get(h.id)??0;if(attack>0){this.attacks.set(h.id,attack-dt);if(!this.reducedMotion)y-=Math.sin(attack/.34*Math.PI)*13;}
    if(this.dragId===h.id&&this.dragPoint){x=this.dragPoint.x;y=this.dragPoint.y;image.setDepth(30);}else image.setDepth(9);
    image.x=Phaser.Math.Linear(image.x,x,Math.min(1,dt*18));image.y=Phaser.Math.Linear(image.y,y,Math.min(1,dt*18));image.setTexture(`${h.classId}-${Math.floor(t*4+h.id)%4}`);
    image.setAlpha(h.hp<=0?.2:1);const flash=this.flashes.get(h.id)??0;if(flash>0){this.flashes.set(h.id,flash-dt);image.setTint(0xff857e);}else image.clearTint();
    this.floor.fillStyle(0x081c19,.5).fillEllipse(pos.x,pos.y+21,55,12);
    if(h.shield>0||b.guardLeft>0){this.threats.lineStyle(2,0x9bd8ef,.6+Math.sin(t*3)*.15);this.threats.strokeEllipse(pos.x,pos.y-5,77,78);this.threats.fillStyle(0x8acee8,.04).fillEllipse(pos.x,pos.y-5,77,78);}
    if(h.buff>0){this.threats.lineStyle(2,0x8bf3ca,.7);this.threats.strokeEllipse(pos.x,pos.y+25,61+Math.sin(t*5)*4,15);}
    if(h.hp<=0){this.threats.lineStyle(2,0xa19788,.7).lineBetween(pos.x-8,pos.y-13,pos.x+8,pos.y+3).lineBetween(pos.x+8,pos.y-13,pos.x-8,pos.y+3);}
   }
  }
  for(const danger of b.threats){const blink=this.reducedMotion?.22:.22+Math.sin(t*5)*.065;for(const s of danger.slots){const p=cell(s),color=danger.type==='all'?0xd9b5ee:danger.type==='target'?0xffba78:danger.type==='breath'?0xeb9d5f:0xef786b;this.threats.fillStyle(color,blink).fillRect(p.x+3,p.y+3,138,106);this.threats.lineStyle(2,color,.85).strokeRect(p.x+3,p.y+3,138,106);
   this.threats.fillStyle(color,.7).fillRect(p.x+3,p.y+3,138*danger.left/danger.total,3);
   this.threats.lineStyle(1,color,.28);for(let stripe=0;stripe<6;stripe++)this.threats.lineBetween(p.x+8+stripe*24,p.y+111,p.x+30+stripe*20,p.y+5);
   this.threats.lineStyle(2,0xffd4a6,.8).strokeTriangle(p.x+119,p.y+15,p.x+111,p.y+29,p.x+127,p.y+29);
   if(danger.type==='target'){const marked=center(s);this.threats.lineStyle(3,0xffce91).strokeCircle(marked.x,marked.y-7,35);this.threats.lineBetween(marked.x,marked.y-49,marked.x,marked.y-28);}
   if(danger.type==='meteor'&&danger.left<.55&&!this.reducedMotion){const hit=center(s),yy=hit.y-230*(danger.left/.55);this.fx.fillStyle(0xfac589,.9).fillRect(hit.x-4,yy,8,13);this.fx.fillStyle(0xee9970,.5).fillRect(hit.x-2,yy-17,4,19);this.particle(hit.x,yy,0xfac589,3,.25,0,-20,0);}
  }}
  for(const m of b.minions){let spr=this.enemies.get(m.id);if(!spr){spr=this.add.image(144+m.lane*156,320,`${m.enemyId??'goblin'}-0`).setScale(.42).setDepth(6);this.enemies.set(m.id,spr);}spr.y=321+(this.reducedMotion?0:Math.sin(t*4+m.lane)*3);this.threats.fillStyle(0x102621).fillRect(spr.x-23,348,46,3);this.threats.fillStyle(0xd6be78).fillRect(spr.x-23,348,46*m.hp/m.maxHp,3);}
  for(const [id,spr] of this.enemies){if(!b.minions.some(m=>m.id===id)){spr.destroy();this.enemies.delete(id);}}
  if(b.targetLane>=0){const x=144+b.targetLane*156;this.threats.lineStyle(1,0xf2d891,.7).strokeCircle(x,321,30);this.threats.lineBetween(x-36,321,x-24,321).lineBetween(x+24,321,x+36,321);}
  // Ambient embers use the same bounded pool as combat effects.
  if(Math.random()<dt*(this.reducedMotion?4:16))this.particle(35+Math.random()*530,320,0xe4c278,1,3,(Math.random()-.5)*15,-12,0);
  for(const x of [55,545]){const y=292;this.fx.fillStyle(0xe8ac59,.08).fillCircle(x,y,16);this.fx.fillStyle(0xf3cc7e,.8).fillRect(x-3,y-6+Math.sin(t*9)*2,6,10);this.fx.fillStyle(0xffe6aa).fillRect(x-1,y-6,2,8);}
  for(const p of this.particles){p.life-=dt;p.vy+=p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;this.fx.fillStyle(p.color,Math.max(0,p.life/p.max));this.fx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,p.size,p.size);}
  this.particles=this.particles.filter(p=>p.life>0);
 }
 private particle(x:number,y:number,color:number,size=3,life=.7,vx=(Math.random()-.5)*170,vy=(Math.random()-.5)*150,gravity=70){if(this.particles.length>480)return;this.particles.push({x,y,vx,vy,life,max:life,color,size,gravity});}
 private burst(x:number,y:number,color:number,n=22){for(let i=0;i<(this.reducedMotion?Math.min(n,7):n);i++)this.particle(x,y,color,Math.random()>.5?4:2,.4+Math.random()*.6);}
 private floating(x:number,y:number,text:string,color='#ffdfa0',big=false){const label=this.add.text(x+(Math.random()-.5)*18,y,text,{fontFamily:'"Press Start 2P"',fontSize:big?'17px':'11px',color,stroke:'#122825',strokeThickness:4}).setOrigin(.5).setDepth(40);this.tweens.add({targets:label,y:y-(this.reducedMotion?12:40),alpha:0,delay:250,duration:800,onComplete:()=>label.destroy()});}
 private ring(x:number,y:number,color:number){const ring=this.add.circle(x,y,16).setStrokeStyle(3,color).setDepth(21);this.tweens.add({targets:ring,scale:this.reducedMotion?2:4,alpha:0,duration:400,onComplete:()=>ring.destroy()});}
 private projectile(e:BattleEvent){
  const h=this.battle.hero(e.source??-1);const from=h?center(h.slot):{x:300,y:620};const to=e.lane===-1?{x:300+(Math.random()-.5)*85,y:215}:{x:144+(e.lane??1)*156,y:320};
  const color=e.kind==='nova'||e.kind==='magic'||e.kind==='burst'?0x9bcdf3:e.kind==='steal'?0xd2b0ed:0xf1d393;
  const bolt=this.add.rectangle(from.x,from.y,e.kind==='arrow'?3:7,e.kind==='arrow'?18:7,color).setDepth(18).setRotation(Math.atan2(to.y-from.y,to.x-from.x)+Math.PI/2);
  this.tweens.add({targets:bolt,x:to.x,y:to.y,duration:e.kind==='slash'?150:370,ease:'Cubic.easeIn',onUpdate:()=>{if(!this.reducedMotion)this.particle(bolt.x,bolt.y,color,2,.2,0,0,0);},onComplete:()=>{bolt.destroy();this.burst(to.x,to.y,color,e.kind==='nova'?48:12);this.floating(to.x,to.y,String(Math.round(e.amount??0)),e.kind==='nova'?'#b5dbff':'#f6dfab',e.kind==='nova'||e.kind==='burst');if(e.lane===-1)this.pulse=.08;if(e.kind==='nova'||e.kind==='burst'){this.ring(to.x,to.y,color);this.shake=.2;}}});
 }
 private event(e:BattleEvent){
  const pos=e.slot!==undefined?center(e.slot):{x:300,y:220};
  if(e.type==='tap'){this.attacks.set(e.source!,.13);this.ring(pos.x,pos.y,0xe8d49a);this.burst(pos.x,pos.y,0xf4d991,5);if(e.text)this.floating(pos.x,pos.y-20,e.text,'#ffeeac');}
  if(e.type==='cast')this.attacks.set(e.source!,.34);
  if(e.type==='projectile'){
   this.projectile(e);
   if(e.kind==='slash'){const h=this.battle.hero(e.source??-1);if(h){const p=center(h.slot),slash=this.add.graphics().setDepth(19);slash.lineStyle(4,0xf4e5b5,.9).beginPath().arc(p.x,p.y-7,33,-2.7,.3).strokePath();this.tweens.add({targets:slash,alpha:0,duration:200,onComplete:()=>slash.destroy()});}}
  }
  if(e.type==='bomb'){const rune=this.add.circle(300,210,26).setStrokeStyle(2,0xb9cef5).setDepth(17);this.tweens.add({targets:rune,scale:.2,angle:180,duration:1500,onComplete:()=>rune.destroy()});this.floating(300,185,'ARCANE SEAL','#adc9ef');}
  if(e.type==='hurt'){this.flashes.set(e.source!,.16);if(e.amount)this.floating(pos.x,pos.y-10,`−${e.amount}`,'#ffada2');else this.floating(pos.x,pos.y-10,'BLOCK','#a4d8ef');this.burst(pos.x,pos.y,e.amount?0xe99a8b:0x9ed6ed,8);}
  if(e.type==='heal'){this.floating(pos.x,pos.y-12,`+${Math.round(e.amount??0)}`,'#9febc8');for(let i=0;i<6;i++)this.particle(pos.x+(Math.random()-.5)*35,pos.y+20,0x9fe9c0,3,.8,0,-40,-10);}
  if(e.type==='shield'||e.type==='buff')this.ring(pos.x,pos.y,e.type==='shield'?0xa2cee8:0x96f2be);
  if(e.type==='coin'){this.floating(pos.x,pos.y-20,`+${e.amount}g`);this.burst(pos.x,pos.y,0xe9c56d,7);}
  if(e.type==='move')this.floating(pos.x,pos.y-25,e.text??'MOVE','#eed69a');
  if(e.type==='impact'){for(const slot of e.targets??[]){const p=center(slot);this.burst(p.x,p.y,e.kind==='breath'?0x8ceeaa:0xf49b70,34);this.ring(p.x,p.y,0xf4c07e);if(e.kind==='breath')for(let n=0;n<24;n++){const ratio=n/24;this.particle(305+(p.x-305)*ratio,215+(p.y-215)*ratio,0xa6e1a0,6,.5,15,70,10);}}this.shake=.45;}
  if(e.type==='claw'){this.burst(pos.x,pos.y,0xf0c19a,10);const claw=this.add.graphics().setDepth(19);for(let i=0;i<3;i++)claw.lineStyle(2,0xf1d6af,.9).lineBetween(pos.x-20+i*12,pos.y-26,pos.x-3+i*12,pos.y+13);this.tweens.add({targets:claw,alpha:0,duration:280,onComplete:()=>claw.destroy()});}
  if(e.type==='minionAttack'){const from={x:144+(e.lane??1)*156,y:320};const bolt=this.add.rectangle(from.x,from.y,5,5,0xd3e1a1).setDepth(17);this.tweens.add({targets:bolt,x:pos.x,y:pos.y,duration:210,onComplete:()=>bolt.destroy()});}
  if(e.type==='minionDown'){this.burst(144+e.lane!*156,320,0xb9d58a,26);}
  if(e.type==='ultimate'){this.shake=.8;this.ring(300,420,0xffe3a0);this.ring(300,220,0xffe3a0);for(let i=0;i<180;i++)this.particle(Math.random()*600,Math.random()*760,0xf3dda4,4,1.7,(Math.random()-.5)*100,-60,0);}
  if(e.type==='victory'){for(let i=0;i<100;i++)this.particle(Math.random()*600,-Math.random()*300,0xeed694,4,5,10,80,0);}
  if(['banner','phase','warning','break','summon','ultimate'].includes(e.type)||(e.type==='shield'&&e.text))window.dispatchEvent(new CustomEvent('battle-banner',{detail:e}));
 }
}
