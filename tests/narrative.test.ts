import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_CHOICES, narrativeChoice, epilogue } from '../src/game/narrative';

test('D7 exposes authored Story choices with chapter gates', () => {
 assert.deepEqual(STORY_CHOICES.map(scene => scene.id), ['school', 'archive', 'cooperative']);
 assert.ok(STORY_CHOICES.every(scene => scene.title && scene.text && scene.options.length >= 2));
 const state: Record<string, string> = {};
 assert.equal(narrativeChoice(state, 'school', 'restore', []), false);
 assert.equal(narrativeChoice(state, 'school', 'restore', [0, 1, 2]), true);
 assert.equal(state.school, 'restore');
});

test('D7 decisions are immutable and idempotent once selected', () => {
 const state: Record<string, string> = {};
 assert.equal(narrativeChoice(state, 'school', 'restore', [0, 1, 2]), true);
 const snapshot = { ...state };
 assert.equal(narrativeChoice(state, 'school', 'memorial', [0, 1, 2]), false);
 assert.deepEqual(state, snapshot);
 assert.equal(narrativeChoice(state, 'school', 'restore', [0, 1, 2]), false);
 assert.deepEqual(state, snapshot);
});

test('D7 has one canonical main ending and flags-based epilogue', () => {
 const state: Record<string, string> = { school: 'restore', archive: 'public', cooperative: 'clinic' };
 assert.equal(epilogue(state, Array.from({ length: 15 }, (_, i) => i)).length, 0);
 const ending = epilogue(state, Array.from({ length: 16 }, (_, i) => i));
 assert.equal(ending[0], 'Mesin berhenti. Vharok bebas. Eda memilih namanya sendiri. Kota membangun perlindungan bersama; mereka tidak mendapatkan kembali semua yang hilang.');
 assert.equal(ending.filter(card => card.includes('Mesin berhenti.')).length, 1);
 assert.ok(ending.some(card => card.includes('sekolah')));
 assert.ok(ending.some(card => card.includes('arsip')));
 assert.ok(ending.some(card => card.includes('klinik')));
});

test('D7 epilogue cards are optional and follow selected flags', () => {
 const ending = epilogue({ school: 'restore' }, Array.from({ length: 16 }, (_, i) => i));
 assert.equal(ending.length, 2);
 assert.ok(ending.some(card => card.includes('sekolah')));
 assert.ok(!ending.some(card => card.includes('arsip')));
 assert.ok(!ending.some(card => card.includes('klinik')));
});
