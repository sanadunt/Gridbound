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
