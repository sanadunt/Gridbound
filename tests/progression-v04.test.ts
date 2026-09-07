import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, normalizeProfile, awardExperience, availablePoints, buyTalent, respecHero, settleProgress, equipGear, claimQuest } from '../src/game/profile';
import { heroProgress, xpForLevel } from '../src/game/levels';
import { Battle } from '../src/game/simulation';
import { QUESTS, questProgress } from '../src/game/quests';
import { TALENTS } from '../src/game/profile';

test('independent hero XP caps safely and affects actual combat HP and power', () => {
  const p=createProfile();
  assert.equal(heroProgress(p.loadouts[0].xp).level,1);
  assert.equal(awardExperience(p,0,xpForLevel(10)),9);
  assert.equal(heroProgress(p.loadouts[0].xp).level,10);
  assert.equal(heroProgress(p.loadouts[4].xp).level,1);
  assert.equal(awardExperience(p,0,NaN),0);
  const a=new Battle('raid',1,undefined,{roster:p.roster});
  const b=new Battle('raid',1,undefined,{roster:p.roster,loadouts:p.loadouts});
  assert.ok(b.hero(0)!.maxHp>a.hero(0)!.maxHp);
  a.act(a.hero(0)!);b.act(b.hero(0)!);assert.ok(b.damage>a.damage);
  awardExperience(p,0,1e9);assert.equal(heroProgress(p.loadouts[0].xp).level,40);
});
test('legacy v2 migration preserves investment and assigns campaign-appropriate XP once', () => {
  const old={version:2,gold:321,cleared:[0,1,2],loadouts:{0:{skills:[0,1],slot:1,talents:['focus','mastery'],inventory:['iron-edge'],gear:{weapon:'iron-edge'},job:'paladin'}},bestFloor:4,wins:8};
  const p=normalizeProfile(old);assert.equal(p.version,3);assert.equal(p.gold,321);
  assert.equal(p.loadouts[0].gear?.weapon,'iron-edge');assert.equal(p.loadouts[0].job,'paladin');
  assert.equal(heroProgress(p.loadouts[0].xp).level,4);
  assert.deepEqual(normalizeProfile(p),p);
});
test('skill points, class restrictions, cross prerequisites and exclusive keystones are enforced', () => {
  const p=createProfile();p.gold=100000;awardExperience(p,0,xpForLevel(40));
  assert.equal(availablePoints(p,0),39);
  assert.equal(buyTalent(p,0,'rogue-1'),false);
  assert.equal(buyTalent(p,0,'assault-crown'),false);
  for(const id of ['focus','mastery','vigor','fortitude','assault-root','assault-break','assault-hunt','assault-echo','assault-crown','guard-root','guard-shell','guard-mend','guard-wall']) assert.ok(buyTalent(p,0,id),id);
  assert.equal(buyTalent(p,0,'guard-crown'),false);
  const gold=p.gold;const refund=TALENTS.filter(t=>p.loadouts[0].talents.includes(t.id)).reduce((s,t)=>s+t.cost,0);
  assert.ok(respecHero(p,0));assert.equal(p.gold,gold+refund);assert.equal(availablePoints(p,0),39);
  assert.equal(respecHero(p,0),false);assert.equal(heroProgress(p.loadouts[0].xp).level,40);
});
test('progress settlement only banks completed victories and cannot pay twice', () => {
  const p=createProfile(),b=new Battle('raid',1,undefined,{roster:p.roster,loadouts:p.loadouts,enemyId:'wolf'});
  assert.equal(settleProgress(p,b),null);b.start();b.bossHp=0;b.tick(.05);
  assert.ok(settleProgress(p,b));const saved=structuredClone(p);assert.equal(settleProgress(p,b),null);assert.deepEqual(p,saved);
  assert.equal(p.ledger.enemies.wolf,1);assert.ok(p.loadouts[0].xp!>0);
  const wave=new Battle('adventure',1);wave.start();wave.bossHp=0;wave.tick(.05);assert.equal(settleProgress(p,wave),null);
});
test('quests have measurable objectives, explicit claims, chain gates and no double rewards', () => {
  const p=createProfile(),q=QUESTS.find(q=>q.id==='hunt-wolf')!;
  assert.ok(q);assert.equal(claimQuest(p,q.id,0),false);
  p.ledger.enemies.wolf=1;assert.equal(questProgress(p,q).ready,true);
  const before=p.gold;assert.ok(claimQuest(p,q.id,0));assert.ok(p.gold>before);
  const saved=structuredClone(p);assert.equal(claimQuest(p,q.id,0),false);assert.deepEqual(p,saved);
  assert.equal(claimQuest(p,'unknown',0),false);
});
test('normalization drops impossible points, wrong-class nodes and invalid quest records', () => {
  const p=createProfile();p.loadouts[0].talents=['assault-crown','rogue-1'];
  p.claimedQuests=['unknown'];p.ledger.enemies['unknown']=1e20;p.loadouts[0].xp=NaN;
  const clean=normalizeProfile(p);assert.deepEqual(clean.loadouts[0].talents,[]);
  assert.deepEqual(clean.claimedQuests,[]);assert.equal(clean.loadouts[0].xp,0);
  assert.equal(clean.ledger.enemies.unknown,undefined);
  assert.equal(equipGear(clean,0,'not-an-item'),false);
});
