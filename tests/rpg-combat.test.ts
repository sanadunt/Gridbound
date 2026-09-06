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
