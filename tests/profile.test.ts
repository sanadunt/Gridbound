import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as profiles from '../src/game/profile';

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
