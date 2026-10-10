import test from 'node:test';
import assert from 'node:assert/strict';
import { backupLegacy, commanderFromBackup, legacyBackup, BACKUP_PREFIX, SAVE_KEY } from '../src/game/save';
import { createProfile, completeZone, normalizeProfile } from '../src/game/profile';
import { CommanderSession } from '../src/game/commander-session';
import { CommanderRepository, createCommanderDocument, materializeProfile, StaleCommanderError } from '../src/game/commander';

/** A Web Storage stand-in: getItem/setItem/removeItem/key/length over a Map, optionally failing writes. */
function fakeStorage(entries: Record<string, string> = {}, failWrites = false) {
  const values = new Map(Object.entries(entries));
  return { values, get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (failWrites) throw new Error('quota'); values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
}
const progressed = () => { const p = createProfile(); for (let i = 0; i < 5; i++) completeZone(p, i); p.gold = p.economy.gold = 4321; p.economy.commanderCrystal = 75; return normalizeProfile(JSON.parse(JSON.stringify(p))); };
const backups = (store: ReturnType<typeof fakeStorage>) => [...store.values.keys()].filter(k => k.startsWith(BACKUP_PREFIX)).sort();

test('WP2: backupLegacy copies the raw legacy save aside, keeps the newest three and skips identical copies', () => {
  const store = fakeStorage({ [SAVE_KEY]: 'v1', other: 'x' });
  assert.equal(backupLegacy(store, '2026-01-01T00:00:00.000Z'), `${BACKUP_PREFIX}2026-01-01T00:00:00.000Z`);
  assert.equal(store.values.get(`${BACKUP_PREFIX}2026-01-01T00:00:00.000Z`), 'v1');
  assert.equal(backupLegacy(store, '2026-01-02T00:00:00.000Z'), `${BACKUP_PREFIX}2026-01-01T00:00:00.000Z`, 'an unchanged save is not copied twice');
  for (const [i, raw] of ['v2', 'v3', 'v4'].entries()) { store.values.set(SAVE_KEY, raw); backupLegacy(store, `2026-01-0${i + 3}T00:00:00.000Z`); }
  assert.deepEqual(backups(store).map(k => store.values.get(k)), ['v2', 'v3', 'v4'], 'only the newest three backups are kept');
  assert.equal(store.values.get(SAVE_KEY), 'v4', 'the source is never modified');
  assert.equal(store.values.get('other'), 'x', 'unrelated keys are left alone');
});

test('WP2: backupLegacy never throws and does nothing without a legacy save', () => {
  assert.equal(backupLegacy(fakeStorage(), '2026-01-01T00:00:00.000Z'), undefined);
  assert.equal(backupLegacy(fakeStorage({ [SAVE_KEY]: 'v1' }, true), '2026-01-01T00:00:00.000Z'), undefined, 'a full storage quota is swallowed');
  const broken = { get length(): number { throw new Error('blocked'); }, key: () => null, getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} };
  assert.equal(backupLegacy(broken, '2026-01-01T00:00:00.000Z'), undefined);
});

test('WP2: a Commander export imports as a new Commander with a fresh id and every Story field', async () => {
  const doc = createCommanderDocument(progressed(), 'Exported'); doc.shared.bankCrystal = 75; doc.revision = 9;
  const imported = commanderFromBackup(JSON.stringify(doc, null, 2), { id: 'fresh-id', name: 'unused', timestamp: 1 })!;
  assert.equal(imported.sourceId, doc.commanderId);
  assert.equal(imported.document.commanderId, 'fresh-id'); assert.equal(imported.document.name, 'Exported');
  assert.deepEqual(materializeProfile(imported.document, 'story'), materializeProfile(doc, 'story'));
  assert.equal(imported.document.shared.bankCrystal, 75);
  const repository = new CommanderRepository(undefined, 'session only');
  await repository.commit(doc);
  const committed = await repository.commit(imported.document);
  assert.equal(committed.revision, 1, 'imported as a new file next to the original');
  assert.equal((await repository.list()).length, 2);
});

test('WP2: the legacy backup envelope and a recovery file import; anything else is rejected', () => {
  const profile = progressed();
  const legacy = commanderFromBackup(JSON.stringify(legacyBackup(profile)), { id: 'legacy-id', name: 'Old save copy', timestamp: 1 })!;
  assert.equal(legacy.sourceId, undefined); assert.equal(legacy.document.commanderId, 'legacy-id'); assert.equal(legacy.document.name, 'Old save copy');
  const story = materializeProfile(legacy.document, 'story');
  assert.deepEqual(story.cleared, [0, 1, 2, 3, 4]); assert.equal(story.gold, 4321); assert.equal(legacy.document.shared.bankCrystal, 75);
  assert.equal(typeof legacy.document.legacySource, 'string');

  const doc = createCommanderDocument(createProfile(), 'Pending');
  const recovery = commanderFromBackup(JSON.stringify({ kind: 'gridbound-recovery', mode: 'story', document: doc, pendingProfile: profile }), { id: 'r', name: 'x', timestamp: 2 })!;
  assert.deepEqual(materializeProfile(recovery.document, 'story').cleared, [0, 1, 2, 3, 4], 'the pending Story outcome is applied');
  assert.equal(recovery.sourceId, doc.commanderId);

  for (const text of ['undefined', '', 'null', '[]', '{}', '{invalid', JSON.stringify({ kind: 'gridbound-legacy', version: 3, profile: { version: 3 } }), JSON.stringify({ ...doc, schema: 99 })]) assert.equal(commanderFromBackup(text, { id: 'z', name: 'z', timestamp: 0 }), undefined, `rejects ${text.slice(0, 40)}`);
});

test('WP2: a save in flight is dirty but not failed; only a failed save is marked failed until one succeeds', async () => {
  const session = new CommanderSession(); session.repository = new CommanderRepository(undefined, 'session only');
  const profile = session.select(await session.create('flight', createCommanderDocument(createProfile(), 'flight')), 'story');
  const saving = session.save({ mode: 'story', slotId: 'auto', profile });
  assert.equal(session.dirty, true); assert.equal(session.failed, false, 'in flight is not a failure');
  assert.equal(await saving, true); assert.equal(session.dirty, false); assert.equal(session.failed, false);
  const commit = session.repository.commit.bind(session.repository);
  session.repository.commit = async () => { throw new Error('quota exceeded'); };
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), false);
  assert.equal(session.failed, true); assert.equal(session.dirty, true); assert.equal(await session.flush(), false);
  session.repository.commit = commit;
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), true);
  assert.equal(session.failed, false); assert.equal(await session.flush(), true);
  session.stale = true;
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), false);
  assert.equal(session.failed, true); assert.ok(session.error.length > 0); assert.ok(new StaleCommanderError() instanceof Error);
});
