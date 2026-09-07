import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEAR, GEAR_SETS, gearStats } from '../src/game/jobs';
import { createProfile, awardExperience, equipGear, normalizeProfile } from '../src/game/profile';
import { xpForLevel } from '../src/game/levels';
import { loadSave, saveProfile, SAVE_KEY } from '../src/game/save';
import { Battle } from '../src/game/simulation';
import { TALENTS, talentStats } from '../src/game/talents';
import { QUESTS } from '../src/game/quests';
import { ENEMIES } from '../src/game/world';

test('42 gear pieces and six distinct sets preserve slot, level, class and quest gates',()=>{
 assert.equal(GEAR.length,42);assert.equal(new Set(GEAR.map(g=>g.id)).size,42);assert.equal(GEAR_SETS.length,6);
 const p=createProfile();p.gold=99999;
 assert.equal(equipGear(p,0,'scout-weapon'),false);awardExperience(p,0,xpForLevel(20));
 assert.equal(equipGear(p,0,'healer-weapon-1'),false);assert.equal(equipGear(p,0,'unbound-weapon'),false);
 for(const set of GEAR_SETS){const items=GEAR.filter(g=>g.setId===set.id);assert.equal(items.length,3);assert.equal(new Set(items.map(g=>g.slot)).size,3);
  const worn=Object.fromEntries(items.map(g=>[g.slot,g.id]));const stats=gearStats(worn);
  for(const key of Object.keys({...set.two,...set.three}))assert.ok(stats[key as keyof typeof stats]>0);
  const only=gearStats({weapon:items[0].id,armor:items[0].id,charm:items[0].id});
  assert.equal(only.tapBonus,0);assert.equal(only.openingBarrier,0);
 }
 assert.ok(equipGear(p,0,'warrior-weapon-1'));const gold=p.gold;assert.equal(equipGear(p,0,'warrior-weapon-1'),false);assert.equal(p.gold,gold);
 p.loadouts[0].inventory!.push('healer-weapon-1');p.loadouts[0].gear!.weapon='healer-weapon-1';assert.equal(normalizeProfile(p).loadouts[0].gear!.weapon,undefined);
});
test('50 talent definitions expose 34 class-appropriate choices and no dangling links',()=>{
 assert.equal(TALENTS.length,50);
 for(const base of ['warrior','rogue','archer','healer','wizard'])assert.equal(TALENTS.filter(t=>!t.classId||t.classId===base).length,34);
 for(const t of TALENTS)for(const id of [t.requires,...t.requiresAll??[]].filter(Boolean))assert.ok(TALENTS.some(n=>n.id===id));
 assert.equal(QUESTS.length,30);assert.equal(new Set(QUESTS.map(q=>q.id)).size,30);
 for(const q of QUESTS){if(q.enemy)assert.ok(ENEMIES[q.enemy]);if(q.gear)assert.ok(GEAR.find(g=>g.id===q.gear));if(q.requires)assert.ok(QUESTS.find(n=>n.id===q.requires));}
});
test('new talent effects alter real casts, healing, shield damage and minion pressure',()=>{
 const make=(talents:string[]=[])=>new Battle('raid',1,undefined,{roster:[0],loadouts:{0:{skills:[0,1],talents}}});
 const plain=make(),echo=make(['assault-echo']);plain.start();echo.start();
 for(let i=0;i<5;i++){(plain as any).act(plain.hero(0));(echo as any).act(echo.hero(0));}
 assert.ok(echo.bossHp<plain.bossHp);
 const leech=make(['tempo-echo']);leech.start();const h=leech.hero(0)!;h.hp/=2;const hp=h.hp;(leech as any).act(h);assert.ok(h.hp>hp);
 const wall=make(['guard-wall']);wall.start();const w=wall.hero(0)!;w.shield=100;const boss=wall.bossHp;wall.hurt(w,50);assert.ok(wall.bossHp<boss);
 const thief=new Battle('raid',1,undefined,{roster:[4],loadouts:{4:{skills:[0,1],talents:['healer-3']}}});const healer=thief.hero(4)!;thief.heal(healer,100);assert.ok(healer.shield>0);
 const hunt=make(['assault-hunt']),normal=make();(hunt as any).summon();(normal as any).summon();const before=hunt.minions[0].hp;
 hunt.hitMinion(hunt.minions[0],50,0,'slash');normal.hitMinion(normal.minions[0],50,0,'slash');assert.ok(before-hunt.minions[0].hp>before-normal.minions[0].hp);
 assert.equal(talentStats(['assault-crown'],'warrior').hp,.92);assert.equal(talentStats(['guard-crown'],'warrior').tempo,.95);
});
test('equipment heal/shield and set opening barrier are applied in combat',()=>{
 const make=(gear:Record<string,string>)=>new Battle('raid',1,undefined,{roster:[4,0],loadouts:{4:{skills:[0,1],talents:[],gear}}});
 const base=make({}),enhanced=make({weapon:'healer-weapon-1'});base.hero(0)!.hp=10;enhanced.hero(0)!.hp=10;(base as any).act(base.hero(4));(enhanced as any).act(enhanced.hero(4));assert.ok(enhanced.hero(0)!.hp>base.hero(0)!.hp);
 const scout=make({weapon:'scout-weapon',armor:'scout-armor',charm:'scout-charm'});assert.ok(scout.hero(4)!.shield>0);
});
test('v2 save stays byte-identical; v3 corruption, future formats and blocked storage are protected',()=>{
 const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
 const original=JSON.stringify({version:2,gold:87,cleared:[0],loadouts:{0:{talents:['focus'],skills:[0,1]}}});map.set('gridbound.v2',original);
 const read=loadSave(store);assert.equal(read.profile.version,3);saveProfile(store,read.profile,read.readOnly);assert.equal(map.get('gridbound.v2'),original);assert.deepEqual(loadSave(store).profile,read.profile);
 for(const damaged of ['{bad',JSON.stringify({version:999,gold:54321}),JSON.stringify({version:3})]){map.set(SAVE_KEY,damaged);const protectedSave=loadSave(store);assert.equal(protectedSave.readOnly,true);assert.throws(()=>saveProfile(store,protectedSave.profile,protectedSave.readOnly));assert.equal(map.get(SAVE_KEY),damaged);assert.equal(protectedSave.profile.gold,87);}
 const blocked=loadSave({getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});assert.ok(blocked.readOnly);
});
