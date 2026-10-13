import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftPending, pausedStory, resumableEncounter, resumesPaused, unplayedStart, type RunDoc, type SavedEncounter } from '../src/ui/runs';
import { featureOpen, noteModesInUse } from '../src/ui/unlocks';
import { Battle } from '../src/game/simulation';
import { normalizeProfile } from '../src/game/profile';

const enc = (mode: string, battle: Partial<SavedEncounter['battle']>, settled = false, runId = 'run-1', played = true): SavedEncounter => ({ runId, settled, ...(played ? { played } : {}), battle: { mode, status: 'ready', floor: 1, stage: 0, stageCount: 1, ...battle } });
const trials = (e: SavedEncounter, active?: string): RunDoc => ({ encounters: { roguelike: e }, rogue: active ? { activeRun: { runId: active } } : {} });

test('RUNS: an unsettled encounter is what Depart resumes, in every mode', () => {
  for (const [mode, battle] of [['story', 'adventure'], ['raid', 'raid'], ['roguelike', 'endless']] as const) assert.ok(resumableEncounter({ encounters: { [mode]: enc(battle, {}) } }, mode), mode);
  assert.equal(resumableEncounter({}, 'story'), undefined); assert.equal(resumableEncounter(undefined, 'raid'), undefined);
});
test('RUNS: a Story departure\'s unplayed start (a reload at battle 1\'s ready window, before FIGHT!) pins no party and is no paused chapter', () => {
  const start = enc('adventure', { floor: 6, stageCount: 4 }, false, 'run-1', false), doc = { encounters: { story: start } };
  assert.equal(unplayedStart(start), true);
  assert.equal(resumableEncounter(doc, 'story'), undefined, 'Depart builds a fresh battle with the current party');
  assert.equal(pausedStory(doc), undefined, 'no resume card, no prompt on other chapters');
  assert.ok(resumableEncounter({ encounters: { story: { ...start, played: true } } }, 'story'), 'FIGHT! pressed: battle 1 is paused');
  for (const battle of [{ stage: 1 }, { status: 'victory' }]) assert.ok(resumableEncounter({ encounters: { story: { ...start, battle: { ...start.battle, ...battle } } } }, 'story'), 'a later battle or a won wave was played');
  // A raid or Bell Trials departure keeps its start (a Bell Tonic paid for it is in that battle).
  assert.ok(resumableEncounter({ encounters: { raid: enc('raid', {}, false, 'run-1', false) } }, 'raid'));
});
test('RUNS: a Bell Trials floor clear waiting at its boon draft stays resumable (active or suspended run), nothing else that is settled does', () => {
  const clear = enc('endless', { status: 'victory', floor: 2 }, true);
  assert.equal(draftPending(trials(clear, 'run-1'), clear), true);
  assert.equal(resumableEncounter(trials(clear, 'run-1'), 'roguelike'), clear, 'Save & suspend at the draft, a reload or a closed tab keep the run');
  assert.equal(resumableEncounter(trials(enc('endless', { status: 'victory', runFinalClear: true }, true), 'run-1'), 'roguelike'), undefined, 'the final clear ends the run');
  assert.equal(resumableEncounter(trials(enc('endless', { status: 'defeat' }, true), 'run-1'), 'roguelike'), undefined, 'a defeat ends the run');
  assert.equal(resumableEncounter(trials(clear, 'run-2'), 'roguelike'), undefined, 'another run is active: this clear is not it');
  assert.equal(resumableEncounter(trials(clear), 'roguelike'), undefined, 'no active run (abandoned or finished)');
  assert.equal(resumableEncounter({ encounters: { story: enc('adventure', { status: 'victory' }, true) } }, 'story'), undefined, 'a settled Story clear is over');
  assert.equal(resumableEncounter({ encounters: { raid: enc('raid', { status: 'victory' }, true) }, rogue: { activeRun: { runId: 'run-1' } } }, 'raid'), undefined, 'a settled raid is over');
});
test('RUNS: the Bell Trials stay open while a draft is pending (one predicate for Depart, the setup and the unlock rule)', () => {
  const fresh = normalizeProfile({ version: 3, cleared: [], roster: [0], storyActive: [0] });
  noteModesInUse({ encounters: { roguelike: enc('endless', { status: 'victory' }, true) }, rogue: { activeRun: { runId: 'run-1' } } });
  assert.equal(featureOpen(fresh, 'endless'), true);
  noteModesInUse({ encounters: { roguelike: enc('endless', { status: 'victory' }, true) }, rogue: {} });
  assert.equal(featureOpen(fresh, 'endless'), false, 'an ended run does not keep the mode open');
  noteModesInUse(undefined);
});
test('RUNS: a paused Story chapter names where it resumes (the next battle after a won wave)', () => {
  const doc = (battle: Partial<SavedEncounter['battle']>, settled = false): RunDoc => ({ encounters: { story: enc('adventure', { floor: 6, stageCount: 4, gold: 37, ...battle }, settled) } });
  assert.deepEqual(pausedStory(doc({ stage: 0, gold: 0 })), { chapter: 5, battle: 1, total: 4, heroic: false, won: false, gold: 0 }, 'battle 1 suspended after FIGHT!');
  assert.deepEqual(pausedStory(doc({ stage: 1 })), { chapter: 5, battle: 2, total: 4, heroic: false, won: false, gold: 37 });
  assert.deepEqual(pausedStory(doc({ stage: 0, status: 'victory' })), { chapter: 5, battle: 2, total: 4, heroic: false, won: true, gold: 37 }, 'a won wave resumes at the next battle');
  assert.equal(pausedStory(doc({ stage: 2, heroic: true }))?.heroic, true);
  assert.equal(pausedStory(doc({ stage: 3, status: 'defeat' }, true)), undefined, 'a lost or finished chapter is settled');
  // A real checkpoint of a Story battle carries the fields read here.
  const b = new Battle('adventure', 6, undefined, { heroic: true }); b.stage = 2; b.gold = 12;
  assert.deepEqual(pausedStory({ encounters: { story: { runId: 'x', settled: false, battle: b.checkpoint() } } }), { chapter: 5, battle: 3, total: b.stageCount, heroic: true, won: false, gold: 12 });
});
test('RUNS: Depart resumes the paused chapter only at its own chapter and difficulty', () => {
  const paused = pausedStory({ encounters: { story: enc('adventure', { floor: 6, stage: 1, stageCount: 4 }) } })!;
  assert.equal(resumesPaused(paused, 5, false), true);
  assert.equal(resumesPaused(paused, 4, false), false, 'another chapter asks first');
  assert.equal(resumesPaused(paused, 5, true), false, 'the same chapter on Heroic asks first');
  assert.equal(resumesPaused({ ...paused, heroic: true }, 5, true), true);
});
