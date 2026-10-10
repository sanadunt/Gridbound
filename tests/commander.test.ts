import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile } from '../src/game/profile';
import { Battle } from '../src/game/simulation';
import { createCommanderDocument, copyLegacyToCommander, materializeProfile, applyRuntimeToDocument, normalizeCommanderDocument, CommanderRepository, StaleCommanderError } from '../src/game/commander';

test('D6 has four slots per mode and isolates Story from shared Challenge wallet', () => {
  const doc=createCommanderDocument(createProfile(),'A');
  doc.shared.bankCrystal=77; doc.shared.settlementReceipts=['paid'];
  for (const mode of [doc.story,doc.raid,doc.rogue]) assert.deepEqual(mode.slots.map(slot=>slot.slotId),['manual-1','manual-2','manual-3','auto']);
  const story=materializeProfile(doc,'story');
  assert.equal(story.economy.commanderCrystal,0);
  applyRuntimeToDocument(doc,{mode:'story',slotId:'manual-1',profile:story});
  assert.equal(doc.shared.bankCrystal,77);
  assert.deepEqual(doc.shared.settlementReceipts,['paid']);
  assert.equal(materializeProfile(doc,'raid').economy.commanderCrystal,77);
});

test('legacy copy is detached and does not mint a Challenge bank', () => {
  const original=createProfile(); original.economy.commanderCrystal=800;
  const before=structuredClone(original);
  const copy=copyLegacyToCommander(original,'copy');
  assert.equal(copy.shared.bankCrystal,0);
  assert.deepEqual(original,before);
  assert.notEqual(copy.story.slots[3].state?.loadouts,original.loadouts);
});

test('D7 narrative persists in Story slots and stays isolated from Challenge modes', async () => {
  const doc=createCommanderDocument(createProfile(),'story');
  const profile=materializeProfile(doc,'story');
  profile.narrative={school:'restore'};
  applyRuntimeToDocument(doc,{mode:'story',slotId:'manual-1',profile});
  assert.deepEqual(materializeProfile(doc,'story').narrative,{school:'restore'});
  assert.deepEqual(materializeProfile(doc,'raid').narrative,{});
  assert.deepEqual(materializeProfile(doc,'roguelike').narrative,{});
  assert.equal(doc.shared.bankCrystal,0);
});

test('memory repository enforces revision and three-profile limit', async () => {
  const repository=new CommanderRepository(undefined,'session only');
  const first=await repository.commit(createCommanderDocument(createProfile(),'one'));
  await repository.commit({...first,name:'renamed'},first.revision);
  await assert.rejects(repository.commit(first,first.revision),StaleCommanderError);
  await repository.commit(createCommanderDocument(createProfile(),'two'));
  await repository.commit(createCommanderDocument(createProfile(),'three'));
  await assert.rejects(repository.commit(createCommanderDocument(createProfile(),'four')));
  assert.equal((await repository.list()).length,3);
});

test('encounter boundary restore preserves exact deterministic start, rejects mid-frame', () => {
  const battle=new Battle('endless');
  const boundary=battle.checkpoint();
  const expected=battle.random();
  battle.restoreCheckpoint(boundary);
  assert.equal(battle.random(),expected);
  battle.status='fighting';
  assert.throws(()=>battle.checkpoint());
});

test('unsupported and incomplete Commander documents remain protected', () => {
  const doc=createCommanderDocument(createProfile(),'safe');
  assert.ok(normalizeCommanderDocument(doc));
  assert.equal(normalizeCommanderDocument({...doc,schema:999}),undefined);
  assert.equal(normalizeCommanderDocument({...doc,shared:undefined}),undefined);
  assert.equal(normalizeCommanderDocument({...doc,unrecognizedFutureState:{}}),undefined);
});

// WP1: every Story field survives a Commander load, and challenge runs never rewrite Story slots.
import { buyTalent, promote, equipGear, refineGear, completeZone, normalizeProfile, settleProgress, claimStarChest, type Profile } from '../src/game/profile';
import { storyStateFromProfile, mergeLedger, mergeChallengeXp, type CommanderDocument } from '../src/game/commander';
import { CommanderSession } from '../src/game/commander-session';
import { setStoryParty } from '../src/game/story-party';
import { xpForLevel } from '../src/game/levels';
import { startRun } from '../src/game/dungeon';
import { QUESTS, questProgress } from '../src/game/quests';
const quest=(id:string)=>QUESTS.find(q=>q.id===id)!;
const roundTrip=(doc:CommanderDocument)=>normalizeCommanderDocument(JSON.parse(JSON.stringify(doc)))!;
/** A Story profile with a non-default value in every field. */
function richProfile():Profile {
  const p=createProfile(); p.gold=p.economy.gold=6000;
  for(let i=0;i<6;i++)completeZone(p,i);
  p.loadouts[0].xp=xpForLevel(12); p.loadouts[4].xp=xpForLevel(9);
  assert.ok(buyTalent(p,0,'vigor')&&buyTalent(p,0,'active-2')&&promote(p,0,'paladin')&&equipGear(p,0,'oath-edge')&&equipGear(p,0,'bell-plate'));
  p.economy.materials={'ember-shard':9,'bell-bronze':2};
  assert.ok(refineGear(p,0,'oath-edge'));
  assert.ok(setStoryParty(p,[0,3,p.roster[3]]));
  p.journey.stars={0:3,1:3,2:2,3:1}; p.journey.heroic=[0,2]; p.journey.depth=2; p.journey.run=startRun(3,11,[0,4,3]);
  assert.ok(claimStarChest(p));
  p.narrative={school:'memorial'}; p.claimedQuests=['hunt-wolf','hunt-goblin']; p.trackedQuest='hunt-spider';
  p.ledger={raids:2,victories:9,enemies:{wolf:3,goblin:2,golem:1}}; p.wins=9; p.settlementReceipts=['r1','r2'];
  p.bestFloor=4; p.economy.commanderCrystal=33; p.challengeUnlocks=['bank-relic-ward']; p.sound=false; p.motion=false;
  return normalizeProfile(JSON.parse(JSON.stringify(p)));
}

/** Every Profile key, optional ones included: tsc fails here when Profile gains a field, so the round-trip test below must cover it. */
const PROFILE_KEYS:Record<keyof Profile,true>={narrative:true,journey:true,version:true,gold:true,economy:true,settlementReceipts:true,challengeUnlocks:true,claimedQuests:true,trackedQuest:true,ledger:true,roster:true,storyActive:true,cleared:true,loadouts:true,bestFloor:true,wins:true,sound:true,motion:true};

test('WP1: every Profile field survives create → JSON → normalize → materialize (Story)', () => {
  const p=richProfile(), blank=createProfile() as Record<string,unknown>;
  for(const key of Object.keys(PROFILE_KEYS))if(key!=='version')assert.notDeepEqual((p as Record<string,unknown>)[key],blank[key],`fixture must give ${key} a non-default value`);
  assert.equal(p.loadouts[0].refine?.['oath-edge'],1); assert.equal(p.loadouts[0].job,'paladin'); assert.equal(p.journey.chests,1);
  const back=materializeProfile(roundTrip(createCommanderDocument(p,'QA')),'story') as Record<string,unknown>;
  // Story never holds the challenge wallet: Crystal and challenge unlocks live in document.shared.
  const expected={...structuredClone(p),challengeUnlocks:[],economy:{...p.economy,commanderCrystal:0}} as Record<string,unknown>;
  for(const key of new Set([...Object.keys(PROFILE_KEYS),...Object.keys(expected),...Object.keys(back)]))assert.deepEqual(back[key],expected[key],`Profile.${key} is lost on a Commander load`);
});

test('WP1: every key storyStateFromProfile writes survives normalizeStoryState', () => {
  const p=richProfile(), doc=createCommanderDocument(p,'QA'), state=storyStateFromProfile(p);
  doc.story.slots[0]={slotId:'manual-1',state:structuredClone(state),savedAt:1,status:'valid'};
  const back=roundTrip(doc);
  for(const slot of [back.story.slots[0],back.story.slots[3]])for(const key of Object.keys(state) as (keyof typeof state)[])assert.deepEqual(slot.state?.[key],state[key],`StoredStoryState.${key} is dropped in ${slot.slotId}`);
});

test('WP1: journey and narrative survive the memory repository commit and list', async () => {
  const p=richProfile(), repository=new CommanderRepository(undefined,'session only');
  const committed=await repository.commit(createCommanderDocument(p,'QA'));
  const listed=(await repository.list())[0];
  for(const doc of [committed,listed]){const back=materializeProfile(doc,'story');assert.deepEqual(back.journey,p.journey);assert.deepEqual(back.narrative,{school:'memorial'});}
});

test('WP1: mergeLedger keeps the larger count per key, the larger win total and every receipt once', () => {
  const a={ledger:{raids:2,victories:5,enemies:{wolf:3,golem:1}},wins:5,settlementReceipts:['r1','r2']};
  const b={ledger:{raids:1,victories:7,enemies:{wolf:1,dragon:2}},wins:7,settlementReceipts:['r2','r3']};
  const before=structuredClone([a,b]);
  assert.deepEqual(mergeLedger(a,b),{ledger:{raids:2,victories:7,enemies:{wolf:3,golem:1,dragon:2}},wins:7,settlementReceipts:['r1','r2','r3']});
  assert.deepEqual(mergeLedger(b,a).ledger,mergeLedger(a,b).ledger);
  assert.deepEqual([a,b],before,'inputs are not mutated');
});

test('WP1: the shared ledger only keeps known enemy archetypes', () => {
  const raw=JSON.parse(JSON.stringify(createCommanderDocument(createProfile(),'ids'))); raw.shared.ledger.enemies={wolf:2,'not-an-enemy':5,'wolf-ash':1};
  const doc=normalizeCommanderDocument(raw)!;
  assert.deepEqual(doc.shared.ledger.enemies,{wolf:2}); assert.deepEqual(materializeProfile(doc,'story').ledger.enemies,{wolf:2});
});

test('WP1: a challenge checkpoint keeps the Story ledger, hunt progress and receipts', () => {
  const doc=createCommanderDocument(createProfile(),'ledger');
  const story=materializeProfile(doc,'story'); story.ledger={raids:0,victories:5,enemies:{wolf:3}}; story.wins=5; story.settlementReceipts=['r1'];
  applyRuntimeToDocument(doc,{mode:'story',slotId:'auto',profile:story});
  const hunt=questProgress(materializeProfile(doc,'story'),quest('hunt-wolf'));
  const raid=materializeProfile(doc,'raid');
  assert.deepEqual(raid.ledger,story.ledger,'a challenge run starts from the account ledger');
  raid.ledger.raids++; raid.ledger.victories++; raid.ledger.enemies.golem=1; raid.wins++; raid.settlementReceipts.push('raid-1');
  applyRuntimeToDocument(doc,{mode:'raid',slotId:'auto',profile:raid});
  const after=materializeProfile(roundTrip(doc),'story');
  assert.deepEqual(after.ledger,{raids:1,victories:6,enemies:{wolf:3,golem:1}});
  assert.equal(after.wins,6);
  assert.deepEqual(after.settlementReceipts,['r1','raid-1']);
  assert.ok(questProgress(after,quest('hunt-wolf')).value>=hunt.value&&questProgress(after,quest('hunt-wolf')).ready);
  assert.deepEqual(doc.shared.ledger,after.ledger,'the ledger is kept once, in document.shared');
});

test('WP1: Raid XP reaches the Story party; gear, jobs and manual slots stay as stored', () => {
  const p=createProfile(); p.cleared=[0,1,2]; const doc=createCommanderDocument(normalizeProfile(p),'xp');
  const raid=materializeProfile(doc,'raid'), before=materializeProfile(doc,'story');
  const battle=new Battle('raid',1,undefined,{roster:raid.roster,loadouts:raid.loadouts,settlementId:'wp1-raid'});
  battle.start(); battle.bossHp=0; battle.tick(0.05); assert.equal(battle.status,'victory');
  assert.ok(settleProgress(raid,battle)?.length);
  raid.loadouts[0].job='paladin'; raid.loadouts[0].talents=['vigor'];
  applyRuntimeToDocument(doc,{mode:'raid',slotId:'auto',profile:raid});
  const after=materializeProfile(roundTrip(doc),'story');
  for(const id of raid.roster)assert.ok((after.loadouts[id].xp??0)>(before.loadouts[id].xp??0),`hero ${id} keeps the raid XP`);
  assert.equal(after.loadouts[0].job,undefined); assert.deepEqual(after.loadouts[0].talents,[]);
  mergeChallengeXp(doc,{0:{...raid.loadouts[0],xp:0}});
  assert.equal(doc.story.slots[3].state?.loadouts[0].xp,after.loadouts[0].xp,'XP never goes down');
});

test('WP1: a manual Story slot stays a frozen snapshot through a challenge checkpoint', async () => {
  const session=new CommanderSession(); session.repository=new CommanderRepository(undefined,'session only');
  const p=createProfile(); p.gold=p.economy.gold=3000; for(let i=0;i<6;i++)completeZone(p,i); p.loadouts[0].xp=xpForLevel(12);
  let profile=session.select(await session.create('slots',createCommanderDocument(normalizeProfile(p),'slots')),'story');
  assert.ok(await session.save({mode:'story',slotId:'manual-1',profile}));
  const snapshot=structuredClone({gold:profile.gold,loadouts:profile.loadouts});
  assert.ok(equipGear(profile,0,'oath-edge')&&equipGear(profile,0,'bell-plate'));
  assert.ok(await session.save({mode:'story',slotId:'auto',profile}));
  session.mode='raid'; const raid=session.select(session.document!,'raid');
  raid.loadouts[0].xp=(raid.loadouts[0].xp??0)+500;
  assert.ok(await session.save({mode:'raid',slotId:'auto',profile:raid}));
  assert.deepEqual(session.document!.story.slots[0].state?.loadouts,snapshot.loadouts,'challenge saves do not write manual slots');
  session.mode='story'; profile=session.select(session.document!,'story');
  assert.equal(profile.loadouts[0].xp,raid.loadouts[0].xp,'the live Story slot keeps the raid XP');
  assert.equal(profile.loadouts[0].gear?.weapon,'oath-edge');
  const loaded=await session.loadSlot('manual-1');
  assert.equal(loaded.gold,3000);
  assert.deepEqual(loaded.loadouts,snapshot.loadouts,'loading the slot restores its gear and XP');
});

test('WP1: the deepest Roguelike floor is kept once, survives loading an older preset and completes descent quests in Story', async () => {
  const session=new CommanderSession(); session.repository=new CommanderRepository(undefined,'session only');
  const p=createProfile(); for(let i=0;i<9;i++)completeZone(p,i);
  let rogue=session.select(await session.create('descent',createCommanderDocument(normalizeProfile(p),'descent')),'roguelike');
  assert.ok(await session.save({mode:'roguelike',slotId:'manual-1',profile:rogue}),'a preset saved before any run');
  rogue.bestFloor=6; assert.ok(await session.save({mode:'roguelike',slotId:'auto',profile:rogue}),'a run reaches floor 6; only the live slot is written');
  assert.equal(session.document!.rogue.slots[0].state?.bestFloor,0); assert.equal(session.document!.encounters?.roguelike,undefined);
  rogue=await session.loadSlot('manual-1');
  assert.equal(session.document!.rogue.slots[3].state?.bestFloor,0,'the preset is restored as saved');
  assert.equal(rogue.bestFloor,6,'loading an older preset does not lower the best floor');
  assert.equal(session.document!.shared.bestFloor,6);
  const story=materializeProfile(roundTrip(session.document!),'story');
  assert.equal(story.bestFloor,6); assert.equal(questProgress(story,quest('descent-3')).ready,true);
  assert.equal(materializeProfile(session.document!,'raid').bestFloor,6);
  applyRuntimeToDocument(session.document!,{mode:'story',slotId:'auto',profile:{...story,bestFloor:0}});
  assert.equal(session.document!.shared.bestFloor,6,'a lower value from any mode never lowers it');
  // Documents saved before document.shared kept the floor fall back to the deepest rogue slot.
  const old=JSON.parse(JSON.stringify(session.document)); delete old.shared.bestFloor; old.rogue.slots[1]={slotId:'manual-2',state:{build:old.rogue.slots[3].state.build,bestFloor:8},savedAt:1,status:'valid'};
  const migrated=normalizeCommanderDocument(old)!;
  assert.equal(migrated.shared.bestFloor,8); assert.equal(materializeProfile(migrated,'story').bestFloor,8);
});
