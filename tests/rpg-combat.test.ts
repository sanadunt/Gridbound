import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation';
const step = (b: Battle, seconds: number) => { for (let i = 0; i < seconds * 60; i++) b.tick(1 / 60); };

test('campaign begins with exactly warrior healer archer and four staged encounters', () => {
  const b = new Battle('adventure');
  assert.deepEqual(b.heroes.map(h => h.classId), ['warrior', 'healer', 'archer']);
  assert.equal(b.stageCount, 4);
  assert.equal(b.enemyId, 'wolf');
});
test('fresh tap noticeably removes cooldown but repeats remain rate capped', () => {
  const b = new Battle(); b.start(); const h = b.hero(7)!; h.remaining = 5;
  assert.equal(b.tap(h.id), true); assert.ok(h.remaining <= 4.4);
  assert.equal(b.tap(h.id), false);
});
test('two loadout slots reject unlearned or unequipped stance switching', () => {
  const b = new Battle('adventure', 1, { power: 1, vitality: 1, tempo: 1 }, { roster: [0,4,3], loadouts: { 0: { skills: [1,2], talents: ['active-2'], slot: 1 } } });
  assert.deepEqual(b.availableSkills(0), [1,2]); assert.equal(b.hero(0)!.stance,1);
  assert.equal(b.stance(0,0),false); assert.equal(b.stance(0,2),true);
});
test('tracking weakest and strongest AI chooses living heroes and follows relocation', () => {
  const b = new Battle('raid',1,undefined,{roster:[0,4,3],enemyId:'wolf'}); b.start(); b.hero(4)!.hp=80;
  b.telegraph(); const threat=b.threats[0]; assert.equal(threat.targetId,4);
  b.move(4,8); step(b,.1); assert.deepEqual(threat.slots,[8]);
  b.threats=[]; b.enemyId='goblin'; b.telegraph(); assert.ok(b.threats[0].targetId !== undefined);
});
test('all-grid pressure has a real guard mitigation counter', () => {
  const a=new Battle('raid',1,undefined,{roster:[0,4,3],enemyId:'shaman'});
  const b=new Battle('raid',1,undefined,{roster:[0,4,3],enemyId:'shaman'});
  for(const x of [a,b]) {x.start(); x.telegraph(); x.heroes.forEach(h=>h.remaining=100);}
  assert.equal(a.threats[0].slots.length,9); assert.ok(a.threats[0].counter);
  step(a,2); step(b,2); assert.equal(b.guard(),true); assert.equal(b.guard(),false);
  step(a,2.4); step(b,2.4); assert.ok(b.hero(0)!.hp > a.hero(0)!.hp); assert.ok(b.blocked>0);
});
test('wave transition preserves attrition, cannot duplicate or skip rewards', () => {
  const b=new Battle('adventure'); assert.equal(b.nextWave(),false); b.start(); b.hero(0)!.hp=230; b.potions=1; b.bossHp=0; step(b,.02);
  const gold=b.gold; assert.equal(b.nextWave(),true); assert.equal(b.stage,1); assert.equal(b.status,'ready');
  assert.equal(b.hero(0)!.hp,230); assert.equal(b.potions,1); assert.equal(b.gold,gold); assert.equal(b.nextWave(),false);
});
test('boons change mechanics: overheal makes barrier and fleet reduces swap penalty', () => {
  const b=new Battle('endless',1,undefined,{roster:[0,4,3],boons:['tide','fleet']});
  const h=b.hero(0)!; b.heal(h,100); assert.ok(h.shield>0); b.start(); const before=h.remaining; b.move(0,8); assert.ok(h.remaining-before<.5);
});
test('invalid numeric combat inputs do not corrupt simulation state', () => {
  const b=new Battle(); b.start(); const before=b.snapshot(); b.tick(NaN); b.tick(-1); assert.deepEqual(b.snapshot(),before);
  assert.equal(b.move(0,1.5),false); assert.equal(b.stance(0,NaN),false);
});
test('Expose marks minion hits too, split volleys deal 1.7× power to a lone minion, and a full field summons nothing',()=>{
  const b=new Battle('raid',1,undefined,{roster:[0,4,3]});b.start();b.summon();const m=b.minions[0];m.hp=m.maxHp=1e5;
  b.hitMinion(m,100,0,'slash');assert.equal(1e5-m.hp,100);b.markLeft=4;b.hitMinion(m,100,0,'slash');assert.equal(1e5-m.hp,220);
  b.markLeft=0;m.hp=1e5;const archer=b.hero(3)!;archer.stance=0;archer.remaining=99;b.act(archer);assert.ok(Math.abs(1e5-m.hp-62*1.7*(b as any).skillPower(archer))<1e-6);
  b.drain();assert.equal(b.summon(),0);assert.equal(b.drain().filter(e=>e.type==='summon').length,0);
});
test('Chorus gives a 1s hymn at most once per hero per 4s; Frost delays the intent and adds Resolve',()=>{
  const b=new Battle('raid',1,undefined,{roster:[0,4,3],boons:['chorus','frost']});b.start();const a=b.hero(0)!,c=b.hero(4)!;
  b.tap(0);assert.equal(a.buff,1);b.time+=.2;b.tap(4);assert.equal(c.buff,1);b.time+=.2;a.buff=0;b.tap(0);assert.equal(a.buff,0,'Aldric is still on the 4s Chorus cooldown');
  b.time+=4;b.tap(4);assert.equal(c.buff,1);
  const x=b as any;x.attackIn=5;const resolve=b.resolve;a.stance=1;b.act(a);assert.ok(Math.abs(x.attackIn-5.16)<1e-9);assert.equal(b.resolve,resolve+1);
});
test('healing-given bonuses raise drain and leech heals (hexer weapons)',()=>{
  const heal=(gear?:Record<string,string>)=>{const b=new Battle('raid',1,undefined,{roster:[10,0],loadouts:{10:{skills:[1,0],talents:[],gear,job:'soulbinder',xp:1e6}}});b.start();b.bossHp=b.bossMax=1e7;const h=b.hero(10)!,ally=b.hero(0)!;ally.hp=10;h.hp=Math.round(h.maxHp/2);const self=h.hp,boss=b.bossHp;b.act(h);const dmg=boss-b.bossHp;return {drain:(ally.hp-10)/dmg,leech:(h.hp-self)/dmg,bonus:h.equipment.heal};};
  const plain=heal(),weapon=heal({weapon:'hexer-weapon-3'});assert.equal(weapon.bonus,.12);
  assert.ok(Math.abs(plain.drain-.5)<.01&&Math.abs(weapon.drain-.56)<.01,`drain ${plain.drain} → ${weapon.drain}`);
  assert.ok(Math.abs(plain.leech-.12)<.01&&Math.abs(weapon.leech-.12*1.12)<.01,`leech ${plain.leech} → ${weapon.leech}`);
});
