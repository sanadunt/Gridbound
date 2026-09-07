import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation';
import { BASIC_JOBS, createRogueBuild, setRogueJobs, promoteRogue, rewardRogueRoom, normalizeRogueBuild } from '../src/game/roguelike-build';
import { createProfile, completeZone, settleProgress, normalizeProfile } from '../src/game/profile';
import { storyBattleOptions } from '../src/game/story-party';
import { JOBS } from '../src/game/jobs';

const win = (b: Battle) => { b.start(); b.bossHp=0; b.tick(.05); };
test('D4 fresh Roguelike has exactly three custom recruits, deterministic and detached', () => {
  const a=new Battle('endless'), b=new Battle('endless');
  assert.equal(a.heroes.length,3);
  assert.deepEqual(a.heroes.map(h=>h.name),['Recruit 1','Recruit 2','Recruit 3']);
  assert.deepEqual(a.snapshot(),b.snapshot());
  a.snapshot().rogueBuild!.recruits[0].classId='wizard';
  assert.equal(a.heroes[0].classId,'warrior');
});
test('D4 all five basic jobs including triples are valid; invalid selections are atomic', () => {
  const build=createRogueBuild(); assert.equal(BASIC_JOBS.length,5);
  for(const job of BASIC_JOBS) {
    assert.equal(setRogueJobs(build,[job,job,job]),true);
    const b=new Battle('endless',1,undefined,{rogueBuild:build});
    assert.deepEqual(b.heroes.map(h=>h.classId),[job,job,job]);
    assert.equal(new Set(b.heroes.map(h=>h.id)).size,3);
    assert.equal(new Set(b.heroes.map(h=>h.slot)).size,3);
  }
  for(const value of [[],['warrior'],['warrior','rogue'],['warrior','rogue','archer','healer'],['paladin','wizard','wizard'],['toString','wizard','wizard'],null]) {
    const before=structuredClone(build); assert.equal(setRogueJobs(build,value),false); assert.deepEqual(build,before);
  }
});
test('D4 promotion is earned once per room, follows base and parent, and rejects atomically', () => {
  const build=createRogueBuild();
  assert.equal(promoteRogue(build,0,'paladin'),false);
  assert.equal(rewardRogueRoom(build,1),true); assert.equal(rewardRogueRoom(build,1),false);
  for(const [id,job] of [[0,'aegis'],[0,'chronist'],[99,'paladin'],[.5,'paladin'],[0,'toString']] as const) {
    const before=structuredClone(build);assert.equal(promoteRogue(build,id,job),false);assert.deepEqual(build,before);
  }
  assert.equal(promoteRogue(build,0,'paladin'),true);
  assert.equal(setRogueJobs(build,['wizard','wizard','wizard']),false);
  rewardRogueRoom(build,2);assert.equal(promoteRogue(build,0,'berserker'),false);
  assert.equal(promoteRogue(build,0,'aegis'),true);
});
test('D4 every authored job path is playable with its signature skill and passive', () => {
  for(const base of BASIC_JOBS)for(const job of Object.values(JOBS).filter(j=>j.base===base&&j.tier===2)) {
    const build=createRogueBuild([base,base,base]);const b=new Battle('endless',1,undefined,{rogueBuild:build});
    assert.equal(b.upgradeRogue(0,job.id),false);win(b);
    assert.equal(b.upgradeRogue(0,job.id),true);assert.deepEqual(b.hero(0)!.skills,[0,job.index]);
    const next=new Battle('endless',2,undefined,{rogueBuild:b.snapshot().rogueBuild!});
    assert.equal(next.hero(0)!.job,job.id);assert.equal(next.stance(0,job.index),true);
    win(next);const third=Object.values(JOBS).find(j=>j.parent===job.id)!;
    assert.equal(next.upgradeRogue(0,third.id),true);
  }
});
test('D4 resets, defeat and abandon clear temporary state; invalid reset preserves whole battle', () => {
  const b=new Battle('endless');win(b);b.upgradeRogue(0,'paladin');
  const before=b.snapshot();
  assert.throws(()=>b.reset('endless',1,undefined,{rogueBuild:{recruits:[]} as any}));assert.deepEqual(b.snapshot(),before);
  b.reset('endless');assert.deepEqual(b.rogueBuild,createRogueBuild());assert.ok(b.heroes.every(h=>!h.job));
  win(b);b.upgradeRogue(0,'paladin');b.abandonRogue();assert.equal(b.rogueBuild,undefined);assert.ok(b.heroes.every(h=>!h.job));
  b.reset('endless',2,undefined,{rogueBuild:before.rogueBuild!});b.start();b.heroes.forEach(h=>h.hp=0);b.tick(.05);
  assert.equal(b.status,'defeat');assert.equal(b.rogueBuild,undefined);assert.ok(b.heroes.every(h=>!h.job));
});
test('D4 Story/Raid inputs and persisted Story loadouts cannot receive temporary jobs or XP', () => {
  const p=createProfile();for(let i=0;i<4;i++)completeZone(p,i);
  p.loadouts[0].job='paladin';p.loadouts[0].skills=[0,4];const before=structuredClone(p.loadouts);
  const rogue=new Battle('endless',1,undefined,{...storyBattleOptions(p),rogueBuild:createRogueBuild(['wizard','wizard','wizard'])});
  assert.ok(rogue.heroes.every(h=>!h.job&&h.level===1&&h.talents.length===0&&Object.keys(h.gear).length===0));
  win(rogue);rogue.upgradeRogue(0,'chronist');assert.deepEqual(settleProgress(p,rogue),[]);assert.deepEqual(p.loadouts,before);
  for(const mode of ['raid','adventure'] as const) {
    const b=new Battle(mode,1,undefined,{...storyBattleOptions(p),rogueBuild:rogue.rogueBuild});
    assert.equal(b.rogueBuild,undefined);assert.equal(b.hero(0)!.job,'paladin');assert.equal(b.upgradeRogue(0,'berserker'),false);
  }
  assert.deepEqual(normalizeProfile({...p,rogueBuild:rogue.rogueBuild}).loadouts,normalizeProfile(p).loadouts);
});
test('D4 malformed and missing run snapshots default safely without partially accepting upgrades', () => {
  for(const raw of [undefined,null,{}, {recruits:[]}, {recruits:[{classId:'paladin'},{classId:'wizard'},{classId:'wizard'}]}, {...createRogueBuild(),points:Infinity}])
    assert.deepEqual(normalizeRogueBuild(raw),createRogueBuild());
  const build=createRogueBuild();rewardRogueRoom(build,1);promoteRogue(build,0,'paladin');
  assert.deepEqual(normalizeRogueBuild(JSON.parse(JSON.stringify(build))),build);
  const b=new Battle('endless',2,undefined,{rogueBuild:build});b.start();const before=b.snapshot();
  assert.equal(b.upgradeRogue(1,'priest'),false);assert.deepEqual(b.snapshot(),before);
});
