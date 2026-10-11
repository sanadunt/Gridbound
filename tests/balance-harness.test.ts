import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLICIES, RUNS, shop, coverageParty, branchOf, safeTile } from '../scripts/balance';
import { createProfile, completeZone } from '../src/game/profile';
import { storyPartyCap } from '../src/game/story-party';
import { xpForLevel } from '../src/game/levels';
import { JOBS } from '../src/game/jobs';
import { ROSTER, KITS } from '../src/game/content';
import { Battle } from '../src/game/simulation';

// WP8: the CI/calibration players spend and deploy like real players, so the difficulty tables fit a realistic party.
const lateProfile = () => { const p = createProfile(); for (let i = 0; i < 13; i++) completeZone(p, i); p.gold = p.economy.gold = 99999; for (const id of p.roster) p.loadouts[id].xp = xpForLevel(20); return p; };

test('the harness promotes first and fights with the job skill it paid for', () => {
  for (const run of [RUNS.expert, RUNS.casual]) {
    const p = lateProfile(); shop(p, run);
    for (const id of p.storyActive) {
      const l = p.loadouts[id], job = JOBS[l.job ?? ''];
      assert.ok(job && job.tier === 3, `${ROSTER[id].name} reached a tier-3 job`);
      const kind = (i: number) => KITS[ROSTER[id].classId].skills[i].kind;
      // A job skill that does not heal never replaces the last healer's heal: it moves to the second slot instead.
      if (l.skills[0] !== job.index) assert.ok(['heal', 'regen'].includes(kind(l.skills[0])) && l.skills[1] === job.index, `${ROSTER[id].name} equips ${job.id}'s skill`);
    }
  }
});

test('promotions come first: with gold for the promotions only, every deployed hero is promoted and no talent is bought', () => {
  const p = createProfile(); for (let i = 0; i < 3; i++) completeZone(p, i); for (const id of p.roster) p.loadouts[id].xp = xpForLevel(10);
  const party = coverageParty(p, RUNS.casual), tier2 = (id: number) => Object.values(JOBS).filter(j => j.base === ROSTER[id].classId && j.tier === 2)[branchOf(RUNS.casual, id)];
  p.gold = p.economy.gold = party.reduce((sum, id) => sum + tier2(id).cost, 0);
  const talents = Object.fromEntries(p.roster.map(id => [id, p.loadouts[id].talents.length]));
  shop(p, RUNS.casual);
  for (const id of party) { assert.equal(p.loadouts[id].job, tier2(id).id, `${ROSTER[id].name} is promoted`); assert.ok(p.loadouts[id].skills.includes(tier2(id).index), 'and equips the job skill'); }
  for (const id of p.roster) assert.equal(p.loadouts[id].talents.length, talents[id], `${ROSTER[id].name} bought no talent before the promotions`);
  assert.equal(p.gold, 0);
});

test('branches rotate per run, so the two CI players field both tier-2 branches of every class', () => {
  const p = lateProfile(), seen: Record<string, Set<string>> = {};
  for (const run of [RUNS.expert, RUNS.casual]) { const q = structuredClone(p); shop(q, run); for (const id of q.roster) { const parent = JOBS[q.loadouts[id].job ?? '']?.parent ?? q.loadouts[id].job; if (parent) (seen[ROSTER[id].classId] ??= new Set()).add(parent); } }
  for (const classId of Object.keys(KITS)) assert.equal(seen[classId]?.size, 2, `${classId} fields both branches`);
  assert.notEqual(branchOf(RUNS.expert, 0), branchOf(RUNS.casual, 0));
});

test('the party covers one hero per class before doubles, with a warrior or monk on the claw tile', () => {
  const p = lateProfile(), party = coverageParty(p, RUNS.casual), classes = party.map(id => ROSTER[id].classId);
  assert.equal(party.length, storyPartyCap(p.cleared));
  assert.equal(new Set(classes).size, party.length, 'no class doubles while another class sits out');
  assert.ok(classes.includes('healer') && (classes.includes('warrior') || classes.includes('monk')));
  for (const run of [RUNS.expert, RUNS.casual]) {
    const q = structuredClone(p); shop(q, run);
    const front = [...q.storyActive].sort((a, b) => q.loadouts[a].slot! - q.loadouts[b].slot!)[0];
    assert.ok(['warrior', 'monk'].includes(ROSTER[front].classId), 'the lowest tile (the claw target) holds a front-liner');
    assert.ok(q.storyActive.some(id => ['bard', 'hexer', 'engineer'].includes(ROSTER[id].classId)), 'the newer classes are fielded');
  }
});

test('the novice policy is slower and misses more than the casual one; dodges go to the nearest free tile', () => {
  assert.deepEqual(POLICIES.novice, { name: 'novice', every: 1.5, tapShare: .5, dodge: .3, guard: .3, react: .45, potionAt: .25 });
  for (const k of ['every'] as const) assert.ok(POLICIES.novice[k] > POLICIES.casual[k]);
  for (const k of ['tapShare', 'dodge', 'guard'] as const) assert.ok(POLICIES.novice[k] < POLICIES.casual[k]);
  const b = new Battle('raid', 1, undefined, { roster: [0, 4, 3], loadouts: { 0: { skills: [0, 1], talents: [], slot: 6 }, 4: { skills: [0, 1], talents: [], slot: 7 }, 3: { skills: [0, 1], talents: [], slot: 0 } } });
  // From tile 6 the nearest free tiles are 3 (one row up); the back row is preferred among equals, never the claw's front row.
  assert.equal(safeTile(b, 6), 3);
  b.threats.push({ id: 99, name: 'x', type: 'meteor', slots: [3], left: 3, total: 3 });
  assert.equal(safeTile(b, 6), 8, 'a marked tile is never a refuge');
});
