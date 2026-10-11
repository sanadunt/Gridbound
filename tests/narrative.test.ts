import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_CHOICES, narrativeChoice, epilogue, pendingChoices, storyOutro, chapterHasScene, choiceOpen } from '../src/game/narrative';
import { CAMPAIGN } from '../src/game/world';
import { localizeContent, restoreContent } from '../src/i18n/content';

const upTo = (n: number) => Array.from({ length: n }, (_, i) => i);

test('D7 exposes authored Story choices with chapter gates', () => {
 assert.deepEqual(STORY_CHOICES.map(scene => scene.id), ['school', 'archive', 'cooperative']);
 assert.ok(STORY_CHOICES.every(scene => scene.title && scene.text && scene.options.length >= 2));
 const state: Record<string, string> = {};
 assert.equal(narrativeChoice(state, 'school', 'restore', []), false);
 assert.equal(narrativeChoice(state, 'school', 'restore', upTo(12)), false, 'the school bell waits for A City Without Bells');
 assert.equal(narrativeChoice(state, 'school', 'restore', upTo(13)), true);
 assert.equal(state.school, 'restore');
});

test('WP9: the school choice opens after Chapter 13, where the town learns about its children', () => {
 const school = STORY_CHOICES.find(s => s.id === 'school')!;
 assert.equal(school.chapter, 13);
 assert.equal(CAMPAIGN[school.chapter - 1].id, 'city-without-bells');
 assert.match(school.text, /Blackbriar/);
 assert.ok(!choiceOpen(school, upTo(3)), 'no longer open after Act I');
 assert.deepEqual(pendingChoices({}, upTo(6)).map(s => s.id), ['archive']);
 assert.deepEqual(pendingChoices({ archive: 'public' }, upTo(13)).map(s => s.id), ['school', 'cooperative']);
 assert.deepEqual(pendingChoices({ archive: 'public', school: 'memorial', cooperative: 'routes' }, upTo(16)), []);
 // Camp scenes are owed only by chapters that open a choice, and by the finale.
 assert.deepEqual(CAMPAIGN.map((_, i) => i).filter(chapterHasScene), [5, 12, 15]);
});

test('D7 decisions are immutable and idempotent once selected', () => {
 const state: Record<string, string> = {};
 assert.equal(narrativeChoice(state, 'school', 'restore', upTo(13)), true);
 const snapshot = { ...state };
 assert.equal(narrativeChoice(state, 'school', 'memorial', upTo(13)), false);
 assert.deepEqual(state, snapshot);
 assert.equal(narrativeChoice(state, 'school', 'restore', upTo(13)), false);
 assert.deepEqual(state, snapshot);
});

test('D7 has one canonical main ending and flags-based epilogue cards (no hard-coded lead line)', () => {
 const state: Record<string, string> = { school: 'restore', archive: 'public', cooperative: 'clinic' };
 assert.equal(epilogue(state, upTo(15)).length, 0);
 const ending = epilogue(state, upTo(16));
 assert.equal(ending.length, 3, 'one card per decided choice; the lead line is journal.epilogue.lead');
 assert.ok(!ending.some(card => card.includes('Mesin berhenti.')));
 assert.ok(ending.some(card => card.includes('sekolah')));
 assert.ok(ending.some(card => card.includes('arsip')));
 assert.ok(ending.some(card => card.includes('klinik')));
});

test('D7 epilogue cards are optional and follow selected flags', () => {
 const ending = epilogue({ school: 'restore' }, upTo(16));
 assert.equal(ending.length, 1);
 assert.ok(ending.some(card => card.includes('sekolah')));
 assert.ok(!ending.some(card => card.includes('arsip')));
 assert.ok(!ending.some(card => card.includes('klinik')));
});

test('WP9: the finale outro follows the archive and cooperative choices in both languages', () => {
 const last = CAMPAIGN.length - 1;
 for (const lang of ['id', 'en'] as const) {
  localizeContent(lang);
  const base = storyOutro(last, {});
  assert.equal(base, CAMPAIGN[last].outro, 'undecided: the authored outro');
  assert.equal(storyOutro(3, { archive: 'private' }), CAMPAIGN[3].outro, 'other chapters never change');
  for (const scene of STORY_CHOICES.filter(s => s.line)) {
   assert.ok(base.includes(scene.line!), `${lang}: the outro holds the ${scene.id} line`);
   for (const option of scene.options) {
    const text = storyOutro(last, { [scene.id]: option.id });
    if (option.line) { assert.ok(text.includes(option.line) && !text.includes(scene.line!), `${lang}: ${scene.id}=${option.id} rewrites the line`); }
    else assert.equal(text, base);
   }
  }
  const privateArchive = STORY_CHOICES.find(s => s.id === 'archive')!.options.find(o => o.id === 'private')!.line!;
  assert.match(privateArchive, lang === 'en' ? /register she never opens/ : /daftar yang tidak pernah ia buka/);
 }
 restoreContent();
 assert.doesNotMatch(CAMPAIGN[last].outro, /Campaign complete/, 'the postgame note is a UI string, not story prose');
});
