import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../src/i18n/en';
import { ID } from '../src/i18n/id';
import { t, setLang, errorText, lockText, fmtInt, fmtDec, fmtSec, fmtList, type StringKey } from '../src/i18n';
import { CONTENT_TEXT } from '../src/i18n/content-text';
import { EVENT_TEXT_ENTRIES, eventText, localizeContent, restoreContent } from '../src/i18n/content';
import { ID_GLOSSARY } from '../src/i18n/glossary';
import { CommanderError, CommanderRepository, ERROR_CODES, commanderError, createCommanderDocument, errorCode, openCommanderRepository, StaleCommanderError } from '../src/game/commander';
import { CommanderSession } from '../src/game/commander-session';
import { loadSave } from '../src/game/save';
import { createProfile, talentReason, gearReason, FALLEN_XP, TALENTS } from '../src/game/profile';
import { ENEMIES, type Intent } from '../src/game/world';
import { Battle, threatName, threatKind, HEROIC_HP, HEROIC_DMG, MOVE_PENALTY, MARK_DAMAGE, WEAKEN_DAMAGE, BREAK_DAMAGE, GUARD_REDUCTION } from '../src/game/simulation';
import { REFINE_STEP } from '../src/game/jobs';
import { CAMP_REST, EVENT_EFFECTS, LEAVE_HEAL } from '../src/game/dungeon';
import { STAR_PAR_SECONDS } from '../src/game/journey';
import { intentChips } from '../src/ui/intent';

afterEach(() => { setLang('en'); restoreContent(); });
const keys = Object.keys(EN) as StringKey[];
const englishWords = /\b(the|and|with|your|every|is|are|not|before|after|to|of)\b/i;

test('WP12 storage and save failures are codes: every code has EN and ID text, raw messages never reach the player', async () => {
  const errorKeys = keys.filter(key => key.startsWith('error.')).map(key => key.slice(6)).sort();
  assert.deepEqual(errorKeys, [...ERROR_CODES, 'unknown'].sort(), 'error.* keys match ERROR_CODES one to one');
  for (const code of ERROR_CODES) {
    const error = new CommanderError(code, `raw English detail for ${code}`);
    assert.equal(errorText(error), EN[`error.${code}` as StringKey]);
    setLang('id');
    assert.equal(errorText(error), ID[`error.${code}` as StringKey]);
    assert.doesNotMatch(errorText(error), englishWords, `ID error text reads Indonesian: ${code}`);
    setLang('en');
  }
  assert.equal(errorText(new Error('IndexedDB open failed.')), EN['error.unknown'], 'an unknown error shows the generic text, never its message');
  assert.equal(errorText('not-a-code'), EN['error.unknown']);
  assert.equal(errorText(new StaleCommanderError('Commander save is stale; refresh before writing.')), EN['error.stale']);
  assert.equal(errorCode(commanderError(new DOMException('QA quota exceeded', 'QuotaExceededError'), 'idb-write')), 'storage-full');
  assert.match(errorText(commanderError(new DOMException('x', 'QuotaExceededError'), 'idb-write')), /quota/i);
  assert.equal(errorCode(commanderError('Unable to read Commander saves.', 'idb-read')), 'idb-read');
  // The repository, the session and the legacy save report codes.
  assert.equal((await openCommanderRepository()).warning, 'idb-unavailable', 'no IndexedDB in node: a session-only repository with a code');
  assert.equal(loadSave({ getItem: () => '{bad', setItem: () => {} }).warning, 'save-corrupt');
  assert.equal(loadSave({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} }).warning, 'storage-blocked');
  const session = new CommanderSession(); session.repository = new CommanderRepository(undefined, 'idb-unavailable');
  const profile = session.select(await session.create('codes', createCommanderDocument(createProfile(), 'codes')), 'story');
  const commit = session.repository.commit.bind(session.repository);
  session.repository.commit = async () => { throw new DOMException('QA quota exceeded', 'QuotaExceededError'); };
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), false);
  assert.equal(session.error, 'storage-full'); assert.equal(session.errorDetail, 'QA quota exceeded');
  session.repository.commit = async () => { throw new DOMException('QA write failed', 'UnknownError'); };
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), false);
  assert.equal(session.error, 'idb-write', 'a browser storage failure is a write failure');
  session.repository.commit = commit;
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }, () => { throw new TypeError('QA bug in an edit'); }), false);
  assert.equal(session.error, 'unknown', 'a bug in the save path is not reported as a storage failure'); assert.equal(session.errorDetail, 'QA bug in an edit');
  await assert.rejects(session.loadSlot('manual-1'), (error: unknown) => errorCode(error) === 'unsaved', 'unsaved work blocks a load');
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), true);
  await assert.rejects(session.loadSlot('manual-1'), (error: unknown) => errorCode(error) === 'slot-empty');
  session.stale = true;
  assert.equal(await session.save({ mode: 'story', slotId: 'auto', profile }), false);
  assert.equal(session.error, 'stale');
  setLang('id');
  assert.match(errorText(session.error), /^Tab lain menyimpan Commander ini/);
});

test('WP12 talent and gear lock reasons are codes rendered in the chosen language', () => {
  const p = createProfile(), keystone = TALENTS.find(talent => talent.level)!;
  p.gold = 0;
  const reasons = [talentReason(p, 0, keystone), gearReason(p, 0, 'no-such-item'), talentReason(p, 99, keystone)];
  assert.deepEqual(reasons.map(reason => reason?.code), [keystone.requires ? 'requires' : 'level', 'unavailable', 'unrecruited']);
  for (const reason of reasons) {
    const en = lockText(reason!);
    setLang('id');
    const id = lockText(reason!);
    setLang('en');
    assert.notEqual(en, id, `${reason!.code} is translated`);
    assert.doesNotMatch(id, /\b(not|needs|requires|hero not)\b/i);
  }
  assert.equal(lockText({ code: 'level', n: 12 }), 'Needs hero LV 12');
  setLang('id');
  assert.equal(lockText({ code: 'level', n: 12 }), 'Perlu hero LV 12');
  assert.equal(lockText({ code: 'requires', name: 'Mastery' }), 'Perlu Mastery');
  assert.equal(talentReason(createProfile(), 0, TALENTS.find(talent => !talent.requires && !talent.level && !talent.classId && !talent.points)!), undefined, 'an open talent has no reason');
});

test('WP12 numbers, seconds and plurals follow the game language, not the browser', () => {
  assert.equal(fmtInt(3000), '3,000'); assert.equal(fmtDec(4.25, 1), '4.3'); assert.equal(fmtSec(4.2), '4.2s'); assert.equal(fmtSec(4.2, 2), '4.20s');
  assert.equal(t('dungeon.out.revive', { names: fmtList(['Lyra', 'Rowan']), count: 2, n: 25 }), 'Lyra and Rowan stand again at 25% HP.');
  assert.equal(t('quest.obj.chapters', { n: 1 }), 'Clear 1 chapter');
  assert.equal(t('quest.obj.chapters', { n: 16 }), 'Clear 16 chapters');
  assert.equal(t('journal.chronicle', { n: 1 }), 'Chronicle · 1 chapter');
  assert.equal(t('profiles.legacy.copy', { ch: 3, gold: 3000, roster: 1 }).split('.')[0], 'Chapter 3 · 3,000 gold · 1 hero');
  assert.equal(t('a11y.seconds', { s: 1 }), '1 second'); assert.equal(t('a11y.seconds', { s: 4 }), '4 seconds');
  assert.equal(t('town.spot.state.quests', { n: 1 }), '1 quest reward ready');
  assert.equal(t('town.msg.quests', { n: 2 }), '2 quest rewards wait on the Quests board.');
  setLang('id');
  assert.equal(fmtInt(3000), '3.000'); assert.equal(fmtDec(4.25, 1), '4,3'); assert.equal(fmtSec(4.2), '4,2d');
  assert.equal(fmtList(['Lyra', 'Rowan']), 'Lyra dan Rowan');
  assert.equal(t('quest.obj.chapters', { n: 1 }), 'Selesaikan 1 chapter');
  assert.equal(t('quest.obj.chapters', { n: 16 }), 'Selesaikan 16 chapter');
  assert.equal(t('party.overview.hint', { hp: 4.5, power: 3 }).slice(0, 40), 'Tiap level memberi +4,5% HP dasar dan +3');
  for (const key of keys) {
    assert.doesNotMatch(EN[key], /\(s\)/, `no '(s)' plural hack: ${key}`);
    assert.doesNotMatch(ID[key], /\{\w+\|/, `ID uses the base word, not plural forms: ${key}`);
  }
});

test('WP12 every UI string key is used, and the ID guide names the buildings as the town map does', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.ts$/.test(name) && !/src\/i18n\/(en|id)\.ts$/.test(path)) files.push(path); } };
  walk('src');
  const source = files.map(file => readFileSync(file, 'utf8')).join('\n');
  const prefixes = [...source.matchAll(/`([a-z][\w-]*(?:\.[\w-]+)*)\.\$\{/g)].map(match => `${match[1]}.`);
  const dead = keys.filter(key => !source.includes(`'${key}'`) && !source.includes(`"${key}"`) && !prefixes.some(prefix => key.startsWith(prefix)));
  assert.deepEqual(dead, [], 'unused UI keys');
  setLang('id');
  assert.equal(t('guide.points', { name: 'Aldric', n: 2, place: t('town.spot.hall') }), 'Aldric punya 2 skill point — kunjungi Aula Latihan.');
  setLang('en');
  assert.equal(t('guide.points', { name: 'Aldric', n: 1, place: t('town.spot.hall') }), 'Aldric has 1 unspent skill point — visit the Training Hall.');
});

test('WP12 the Indonesian glossary holds in UI strings, content text and runtime text', () => {
  localizeContent('id');
  const strings: [string, string][] = [...Object.entries(ID), ...Object.entries(CONTENT_TEXT).map(([key, text]) => [key, text.id] as [string, string]), ...EVENT_TEXT_ENTRIES.map((text, i) => [`event.${i}:${text.en}`, text.id] as [string, string])];
  const broken = ID_GLOSSARY.flatMap(rule => strings.filter(([key, text]) => rule.banned.test(text) && !rule.allow?.test(key)).map(([key, text]) => `${rule.term} → ${rule.use}: ${key}: ${text.slice(0, 80)}`));
  assert.deepEqual(broken, []);
  // A rule that would never fire is not a rule: every banned form is still caught.
  for (const [rule, sample] of [[0, 'ACT 2'], [1, '+1 Potion'], [2, 'Ninefold Dawn'], [3, 'Tampilan battle'], [9, 'ritual all-grid'], [11, 'kalian kabur'], [12, 'per hero per floor'], [13, 'Power party 5.834']] as const) assert.match(sample, ID_GLOSSARY[rule].banned);
  assert.doesNotMatch('Battle Hymn seluruh party', ID_GLOSSARY[3].banned, 'skill names stay English');
});

test('WP12 one threat vocabulary: map and bestiary chips name what the battle telegraphs, counter tags match the chip families', () => {
  const seen = new Map<string, string>();
  for (const enemyId of ['wolf', 'spider', 'golem', 'dragon', 'shaman', 'crab']) {
    const battle = new Battle('raid', 1, undefined, { enemyId });
    battle.start();
    for (const intent of ENEMIES[enemyId].patterns) { battle.telegraph(); const threat = battle.threats.at(-1)!; seen.set(threat.name, threatName(enemyId, intent)); assert.equal(threat.name, threatName(enemyId, intent), `${enemyId} ${intent}`); if (threat.counter) assert.equal(threat.counter.split(':')[0], t(`intent.kind.${threatKind(intent)}` as StringKey), `${enemyId} ${intent}: the counter tag is the chip family`); battle.threats.length = 0; }
  }
  assert.ok(seen.size >= 5);
  const tag = (counter: string) => counter.split(':')[0];
  for (const [intent, en] of [['weakest', 'MARKED'], ['front', 'GROUND'], ['all', 'ALL GRID'], ['mend', 'CHANNEL']] as [Intent, string][]) {
    assert.equal(t(`intent.kind.${threatKind(intent)}` as StringKey), en);
    setLang('id');
    const id = t(`intent.kind.${threatKind(intent)}` as StringKey);
    setLang('en');
    const entry = EVENT_TEXT_ENTRIES.find(text => tag(text.en) === en)!;
    assert.equal(tag(entry.id), id, `ID counter tag ${entry.id} matches the chip family ${id}`);
  }
  assert.match(intentChips('wolf', ['weakest', 'front']), /1\. HUNT THE WOUNDED <small>MARKED<\/small>.*2\. CRUSHING FRONT <small>GROUND<\/small>/);
  setLang('id');
  assert.match(intentChips('wolf', ['weakest']), /BURU YANG TERLUKA <small>DITANDAI<\/small>/);
  assert.equal(eventText(threatName('spider', 'meteor'), 'id'), 'JARING BISA');
});

test('WP12 numeric claims come from game constants: no stale literal in UI text, runtime banners match the numbers', () => {
  const pct = (share: number) => Math.round(share * 100);
  const constants: Record<string, number> = { HEROIC_HP: pct(HEROIC_HP - 1), HEROIC_DMG: pct(HEROIC_DMG - 1), REFINE_STEP: pct(REFINE_STEP), CAMP_REST: pct(CAMP_REST), LEAVE_HEAL: pct(LEAVE_HEAL), FALLEN_XP: pct(FALLEN_XP), MARK_DAMAGE: pct(MARK_DAMAGE - 1), WEAKEN_DAMAGE: pct(1 - WEAKEN_DAMAGE) };
  for (const [key, fx] of Object.entries(EVENT_EFFECTS)) for (const [name, value] of Object.entries(fx)) constants[`${key}.${name}`] = pct(value!);
  const literals = new Set(Object.values(constants));
  for (const key of keys) for (const table of [EN, ID]) for (const match of table[key].matchAll(/(?<![{\w])(\d+)\s?%/g)) assert.ok(!literals.has(Number(match[1])), `${key} states ${match[0]} literally; pass it as a {var} from its constant`);
  for (const key of keys) for (const table of [EN, ID]) {
    assert.doesNotMatch(table[key], new RegExp(`\\b${STAR_PAR_SECONDS}\\s?(s|detik)\\b`), `${key}: STAR_PAR_SECONDS literal`);
    assert.doesNotMatch(table[key], /\b0[.,]9\s?(s|d|detik)\b/, `${key}: move penalty literal`);
  }
  assert.match(t('help.drag', { move: fmtSec(MOVE_PENALTY) }), /Moving adds 0\.9s/);
  assert.equal(t('battle.status.mark', { n: constants.MARK_DAMAGE }), 'MARK +20%');
  assert.equal(t('dungeon.event.shrine.pray', { heal: constants['shrine:pray.heal'] }), 'Pray (heal 30%)');
  // The simulation's own banners state the same numbers as its constants.
  const battle = new Battle('adventure', 1); battle.start(); battle.tick(.1); battle.drain(); battle.guard();
  assert.ok(battle.drain().some(event => event.text === `PARTY GUARD · ${pct(GUARD_REDUCTION)}% REDUCTION`));
  const content = readFileSync('src/game/simulation.ts', 'utf8');
  for (const text of [`'MARK +${constants.MARK_DAMAGE}%'`, `'WEAKEN -${constants.WEAKEN_DAMAGE}%'`, `'ARMOR BREAK · +${pct(BREAK_DAMAGE - 1)}% DMG'`]) assert.ok(content.includes(text), `simulation emits ${text}`);
});
