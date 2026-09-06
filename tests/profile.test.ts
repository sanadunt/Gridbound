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
