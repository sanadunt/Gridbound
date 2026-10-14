import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as profiles from '../src/game/profile';
import { JOBS, GEAR } from '../src/game/jobs';
import { xpForLevel } from '../src/game/levels';

test('talents enforce prerequisites, two slots, and exact one-time refund', () => {
  const p=profiles.createProfile(); p.gold=500;
  assert.equal(profiles.buyTalent(p,0,'active-3'),false);
  assert.equal(profiles.buyTalent(p,0,'active-2'),true);
  assert.equal(profiles.buyTalent(p,0,'active-2'),false);
  assert.equal(profiles.equipSkill(p,0,1,2),true);
  assert.equal(profiles.equipSkill(p,0,0,3),false);
  assert.equal(profiles.respecHero(p,0),true); assert.equal(p.gold,500);
  assert.equal(profiles.respecHero(p,0),false); assert.equal(p.gold,500);
});
test('campaign progression is contiguous, recruitment and formations stay unique', () => {
  const p=profiles.createProfile(); assert.equal(profiles.completeZone(p,1),false);
  assert.equal(profiles.completeZone(p,0),true); assert.equal(p.gold,60); assert.equal(profiles.completeZone(p,0),false);
  assert.ok(p.roster.includes(2)); assert.equal(profiles.canEnterZone(p,1),true);
  assert.equal(profiles.moveFormation(p,0,p.loadouts[4].slot),true);
  assert.equal(new Set(p.roster.map(id=>p.loadouts[id].slot)).size,p.roster.length);
});
test('normalize corrupt or legacy storage without unlocking campaign or duplicating tiles', () => {
  assert.deepEqual(profiles.normalizeProfile({version:2,gold:Infinity,cleared:[3],roster:[-1,100]},null).roster,[0,4,3]);
  const p=profiles.createProfile(); p.loadouts[4].slot=p.loadouts[0].slot;
  const normalized=profiles.normalizeProfile(p); assert.equal(new Set(normalized.roster.map(id=>normalized.loadouts[id].slot)).size,3);
  const legacy=profiles.normalizeProfile(null,{gold:90,chapter:4,sound:false});assert.equal(legacy.gold,90);assert.deepEqual(legacy.cleared,[]);assert.equal(legacy.sound,false);
});

test('fresh RPG profile starts in town with warrior healer and archer', async () => {
  const module = await import('../src/game/profile').catch(() => null);
  assert.ok(module?.createProfile, 'RPG profile creation must exist');
  const p = module.createProfile();
  assert.deepEqual(p.roster, [0, 4, 3]);
  assert.equal(p.gold, 60);
  assert.deepEqual(p.cleared, []);
  assert.deepEqual(p.loadouts[0].skills, [0, 1]);
});

test('WP5 replays pay the full chapter gold only once and less EXP the further behind the frontier', async () => {
  const { CAMPAIGN } = await import('../src/game/world');
  const { Battle } = await import('../src/game/simulation');
  const { storyBattleOptions } = await import('../src/game/story-party');
  const p=profiles.createProfile();
  assert.equal(profiles.chapterReward(p,0),CAMPAIGN[0].reward,'first clear pays in full');
  assert.equal(profiles.chapterReward(p,0,true),0,'Heroic pays battle gold only (its first clear banks heroicReward)');
  for(let i=0;i<8;i++)profiles.completeZone(p,i);
  assert.equal(profiles.chapterReward(p,0),Math.round(CAMPAIGN[0].reward*profiles.REPLAY_GOLD));
  assert.equal(profiles.chapterReward(p,8),CAMPAIGN[8].reward);
  assert.deepEqual([8,7,6,5,0].map(ch=>profiles.replayFactor(p,ch)),[1,1,.85,.7,.25]);
  const win=(q:typeof p,floor:number)=>{const b=new Battle('adventure',floor,undefined,{...storyBattleOptions(q),settlementId:`replay-${floor}`});do{b.start();b.bossHp=0;b.tick(.05);}while(b.nextWave());return profiles.settleProgress(q,b)!;};
  const front=win(structuredClone(p),8)[0].xp,old=win(structuredClone(p),1)[0].xp;
  assert.equal(old,Math.floor(Math.round((180+75+CAMPAIGN[0].stages.length*45)*.25)),'chapter 1 replay at chapter 8 pays a quarter');
  assert.equal(front,Math.round(180+8*75+CAMPAIGN[7].stages.length*45),'replaying the latest cleared chapter pays in full');
  const fresh=profiles.createProfile();assert.equal(win(fresh,1)[0].xp,180+75+CAMPAIGN[0].stages.length*45,'a first clear pays in full');
});
test('TOWN respecPreview names the job, its parent and the talent count, and refunds exactly what respecHero pays', () => {
  const p=profiles.createProfile();for(let i=0;i<9;i++)profiles.completeZone(p,i);p.gold=99999;p.loadouts[0].xp=xpForLevel(20);
  assert.deepEqual(profiles.respecPreview(p,0),{talents:0,gold:0});assert.equal(profiles.respecPreview(p,99),undefined);
  for(const id of ['focus','vigor','active-2'])assert.ok(profiles.buyTalent(p,0,id),id);
  assert.ok(profiles.promote(p,0,'paladin'));assert.ok(profiles.promote(p,0,'aegis'));
  const preview=profiles.respecPreview(p,0)!,gold=p.gold;
  assert.deepEqual({job:preview.job,parent:preview.parentJob,talents:preview.talents},{job:'aegis',parent:'paladin',talents:3});
  assert.ok(profiles.respecHero(p,0));assert.equal(p.gold-gold,preview.gold,'the confirmation shows the real refund');
  assert.deepEqual(profiles.respecPreview(p,0),{talents:0,gold:0});
  const second=profiles.createProfile();for(let i=0;i<3;i++)profiles.completeZone(second,i);second.gold=500;assert.ok(profiles.promote(second,0,'paladin'));
  assert.deepEqual(profiles.respecPreview(second,0),{job:'paladin',talents:0,gold:JOBS.paladin.cost},'a tier-2 job has no parent');
});
test('TOWN jobReason explains every refused promotion, and promote succeeds exactly when it has nothing to say', () => {
  const p=profiles.createProfile();p.gold=0;
  assert.deepEqual(profiles.jobReason(p,0,'paladin'),{code:'rank',n:JOBS.paladin.level});
  for(let i=0;i<3;i++)profiles.completeZone(p,i);
  assert.deepEqual(profiles.jobReason(p,0,'paladin'),{code:'gold'});assert.equal(profiles.jobReason(p,0,'paladin',true),undefined);
  assert.deepEqual(profiles.jobReason(p,0,'ranger'),{code:'class'});
  assert.deepEqual(profiles.jobReason(p,0,'aegis'),{code:'requires',name:'Paladin'});
  assert.deepEqual(profiles.jobReason(p,99,'paladin'),{code:'unrecruited'});
  p.gold=1000;assert.ok(profiles.promote(p,0,'paladin'));
  assert.deepEqual(profiles.jobReason(p,0,'paladin'),{code:'learned'});
  assert.deepEqual(profiles.jobReason(p,0,'berserker'),{code:'path'});assert.deepEqual(profiles.jobReason(p,0,'warlord'),{code:'path'});
  assert.deepEqual(profiles.jobReason(p,0,'aegis'),{code:'rank',n:JOBS.aegis.level});
  for(const cleared of [0,3,9])for(const gold of [0,200,5000]){
    const base=profiles.createProfile();for(let i=0;i<cleared;i++)profiles.completeZone(base,i);base.gold=gold;
    for(const id of base.roster)for(const job of Object.values(JOBS)){const c=structuredClone(base);assert.equal(profiles.promote(c,id,job.id),!profiles.jobReason(base,id,job.id),`${id} ${job.id} ${cleared} ${gold}`);}
  }
});
test('TOWN a quest gear reward is equipped at once into the owner\'s empty slot; a filled slot keeps its piece', () => {
  const p=profiles.createProfile();p.ledger.enemies.wolf=1;
  assert.deepEqual(profiles.claimQuest(p,'hunt-wolf',4),{hero:4,gear:'iron-edge',owner:4,equipped:true,refund:0});
  assert.equal(p.loadouts[4].gear?.weapon,'iron-edge');assert.deepEqual(p.loadouts[4].inventory,['iron-edge']);
  const full=profiles.createProfile();full.ledger.enemies.wolf=1;full.loadouts[0].inventory=['oath-edge'];full.loadouts[0].gear={weapon:'oath-edge'};
  assert.deepEqual(profiles.claimQuest(full,'hunt-wolf',0),{hero:0,gear:'iron-edge',owner:0,refund:0});
  assert.equal(full.loadouts[0].gear?.weapon,'oath-edge','an equipped piece is never swapped out');assert.ok(full.loadouts[0].inventory?.includes('iron-edge'));
  const other=profiles.createProfile();other.ledger.enemies.goblin=1;
  assert.deepEqual(profiles.claimQuest(other,'hunt-goblin',0,3),{hero:0,gear:'oak-plate',owner:3,equipped:true,refund:0},'gearTo hands the gear (not the EXP) to another hero');
  assert.equal(other.loadouts[3].gear?.armor,'oak-plate');assert.equal(other.loadouts[0].gear?.armor,undefined);
  // A piece the owner is too low-level for goes to the inventory unequipped.
  const g=GEAR.find(g=>g.source==='quest'&&g.minLevel)!;
  assert.equal(profiles.canWearGear(other,0,g.id),false);other.loadouts[0].xp=xpForLevel(g.minLevel!);assert.equal(profiles.canWearGear(other,0,g.id),true);
});
