import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, completeZone, normalizeProfile } from '../src/game/profile';
import { ROSTER } from '../src/game/content';
import { QUESTS, questProgress } from '../src/game/quests';
import { boardQuests, claimAllQuests, questGroup } from '../src/ui/quests';
import { UNLOCKS, featureOpen, routeLocked, pendingIntros, isNew, markIntro, markVisited, noteModesInUse, resetUnlockFlags } from '../src/ui/unlocks';
import { pushRoute, backRoute } from '../src/ui/route-stack';
import { affordableUpgrade, heroNeeds, trainingBadge, menuBadge, dungeonBadge } from '../src/ui/badges';
import { GEAR } from '../src/game/jobs';
import { gearReason } from '../src/game/profile';
import { defeatFixes } from '../src/ui/result-help';
import { nextObjective, promotion } from '../src/ui/town';
import { HERO_LOOKS, heroKey } from '../src/art/pixels';
import { COACH_STEPS, coachDone, coachEnabled, markCoach, resetCoach, setCoachEnabled, skipCoach } from '../src/ui/coach';

/** A mid-game save: chapters cleared, kills in the ledger, gold to spend. */
const midGame = (cleared = 6) => {
  const p = createProfile();
  for (let i = 0; i < cleared; i++) completeZone(p, i);
  p.gold = 5000; p.ledger.enemies = { wolf: 2, goblin: 2, spider: 1, shaman: 1, golem: 1 };
  for (const id of p.roster) p.loadouts[id].xp = 2500;
  return normalizeProfile(p);
};

test('WP10 the Quest Board lists ready rewards first, then tracked, open, locked and claimed (QUESTS order inside a group)', () => {
  const p = midGame();
  const open = QUESTS.find(q => questGroup(p, q) === 'open')!;
  p.trackedQuest = open.id;
  const all = boardQuests(p, 'all'), rank = ['ready', 'tracked', 'open', 'locked', 'claimed'];
  assert.ok(all.some(q => questProgress(p, q).ready), 'the mid-game save has rewards to claim');
  assert.equal(questGroup(p, all[0]), 'ready', 'the first card is a ready quest');
  for (let i = 1; i < all.length; i++) {
    const a = rank.indexOf(questGroup(p, all[i - 1])), b = rank.indexOf(questGroup(p, all[i]));
    assert.ok(a < b || a === b && QUESTS.indexOf(all[i - 1]) < QUESTS.indexOf(all[i]), `${all[i - 1].id} before ${all[i].id}`);
  }
  assert.equal(all.length, QUESTS.length);
  assert.ok(boardQuests(p, 'available').every(q => { const s = questProgress(p, q); return s.unlocked && !s.claimed; }));
  assert.equal(boardQuests(p, 'available').find(q => q.id === open.id) && questGroup(p, open), 'tracked');
});

test('WP10 Claim all claims every ready quest (chains included) for the chosen hero and reports the gold', () => {
  const p = midGame(), ready = QUESTS.filter(q => questProgress(p, q).ready).length, gold = p.gold;
  const out = claimAllQuests(p, 0);
  assert.ok(out.claimed.length >= ready && ready > 0, `${out.claimed.length} claimed of ${ready} ready`);
  assert.equal(out.gold, p.gold - gold);
  assert.equal(QUESTS.filter(q => questProgress(p, q).ready).length, 0, 'nothing is left to claim');
  assert.deepEqual(out.gear.map(g => g.gear), out.claimed.map(id => QUESTS.find(q => q.id === id)?.gear).filter(Boolean), 'each gear reward is listed (the notice names who got it)');
  assert.ok(out.gear.every(g => g.hero === (QUESTS.find(q => q.gear === g.gear)?.heroId ?? 0)), 'gear goes to the quest hero or the chosen recipient');
  assert.deepEqual(claimAllQuests(p, 0), { claimed: [], gold: 0, gear: [] });
});

test('WP10 modes open with the story: Undercroft after chapter 1, Raids after 2, Bell Trials after 4; saves that used a mode keep it', () => {
  assert.deepEqual(UNLOCKS, { dungeon: 1, raid: 2, endless: 4 });
  const fresh = createProfile();
  assert.deepEqual((['dungeon', 'raid', 'endless'] as const).map(f => featureOpen(fresh, f)), [false, false, false]);
  assert.equal(routeLocked(fresh, 'raid'), true); assert.equal(routeLocked(fresh, 'campaign'), false); assert.equal(routeLocked(fresh, 'quests'), false);
  const two = midGame(2);
  assert.deepEqual((['dungeon', 'raid', 'endless'] as const).map(f => featureOpen(two, f)), [true, true, false]);
  assert.equal(featureOpen(midGame(4), 'endless'), true);
  const veteran = createProfile(); veteran.ledger.raids = 1; veteran.bestFloor = 2;
  assert.equal(featureOpen(veteran, 'raid'), true); assert.equal(featureOpen(veteran, 'endless'), true);
  // A Commander with a run in progress keeps that mode reachable (a suspended Trials run that never won a floor, an unfinished raid).
  noteModesInUse({ rogue: { activeRun: { runId: 'r' } }, encounters: { raid: { settled: false } } });
  assert.deepEqual((['raid', 'endless'] as const).map(f => featureOpen(fresh, f)), [true, true]);
  noteModesInUse({ encounters: { raid: { settled: true } } });
  assert.deepEqual((['raid', 'endless'] as const).map(f => featureOpen(fresh, f)), [false, false], 'a settled raid is no run in progress');
  noteModesInUse(undefined);
});

test('WP10 an unlock intro plays once and NEW shows until the mode is visited (never for a mode the save already used)', () => {
  resetUnlockFlags();
  const p = midGame(2);
  assert.deepEqual(pendingIntros(p), ['dungeon', 'raid']);
  markIntro('dungeon');
  assert.deepEqual(pendingIntros(p), ['raid']);
  assert.equal(isNew(p, 'raid'), true); markVisited('raid'); assert.equal(isNew(p, 'raid'), false);
  assert.equal(isNew(p, 'endless'), false, 'a locked mode is not new');
  const veteran = midGame(2); veteran.ledger.raids = 3; resetUnlockFlags();
  assert.equal(pendingIntros(veteran).includes('raid'), false); assert.equal(isNew(veteran, 'raid'), false);
  resetUnlockFlags();
});

test('WP10 the HUD back button walks a route stack: MENU → Quests → ◀ returns to MENU, gate tabs swap, the camp is the root', () => {
  let stack = pushRoute(['camp'], 'more'); stack = pushRoute(stack, 'quests');
  assert.deepEqual(stack, ['camp', 'more', 'quests']); assert.equal(backRoute(stack), 'more');
  stack = pushRoute(stack, backRoute(stack)); assert.deepEqual(stack, ['camp', 'more']); assert.equal(backRoute(stack), 'camp');
  stack = pushRoute(['camp'], 'campaign'); stack = pushRoute(stack, 'raid'); stack = pushRoute(stack, 'endless');
  assert.deepEqual(stack, ['camp', 'endless'], 'the gate tabs replace each other'); assert.equal(backRoute(stack), 'camp');
  stack = pushRoute(['camp', 'campaign'], 'mission'); assert.equal(backRoute(stack), 'campaign', 'the dossier returns to the map');
  assert.deepEqual(pushRoute(stack, 'raid'), ['camp', 'raid'], 'a gate tab opened from the dossier replaces the map and the dossier');
  assert.deepEqual(pushRoute(['camp'], 'mission'), ['camp', 'mission'], 'Continue story opens the dossier straight from camp');
  assert.deepEqual(pushRoute(['camp', 'more', 'party'], 'party-advanced'), ['camp', 'more', 'party-advanced']);
  assert.deepEqual(pushRoute(stack, 'camp'), ['camp']);
  let deep: ReturnType<typeof pushRoute> = ['camp'];
  for (const tab of ['more', 'quests', 'raid', 'party', 'bestiary', 'challenge-shop', 'dungeon', 'more'] as const) deep = pushRoute(deep, tab);
  assert.equal(deep[0], 'camp'); assert.ok(deep.length <= 8);
  assert.equal(backRoute([]), 'camp');
});

test('WP10 heroes who share a class get their own look, cached by look', () => {
  const pairs = Object.entries(ROSTER.reduce<Record<string, number[]>>((map, r, id) => { (map[r.classId] ??= []).push(id); return map; }, {})).filter(([, ids]) => ids.length > 1);
  assert.ok(pairs.length >= 6);
  for (const [cls, ids] of pairs) assert.equal(new Set(ids.map(id => heroKey(ROSTER[id].classId, id))).size, ids.length, `${cls}: ${ids.map(id => ROSTER[id].name).join('/')}`);
  assert.equal(heroKey('warrior', 0), 'warrior', 'a hero without accents shares the class sprite');
  assert.equal(heroKey('warrior'), 'warrior', 'Roguelike recruits use the class sprite');
  assert.notEqual(heroKey('archer', 1), heroKey('warrior', 1), 'a Raid class swap keeps the hero colours on the new class');
  for (const look of Object.values(HERO_LOOKS)) assert.ok(look.cloth && look.dark, 'every accent recolours the outfit');
});

test('WP10 badges: the Training Hall counts heroes with something to learn or buy, MENU counts rewards, the Undercroft a new depth', () => {
  const p = midGame(2);
  assert.ok(trainingBadge(p) > 0 && heroNeeds(p, 0).length > 0, 'rich heroes have something to do');
  const poor = midGame(2); poor.gold = 0;
  for (const id of poor.roster) assert.ok(!heroNeeds(poor, id).includes('job') && !heroNeeds(poor, id).includes('gear'), 'nothing affordable without gold');
  assert.equal(menuBadge(p), QUESTS.filter(q => questProgress(p, q).ready).length + 0);
  assert.equal(dungeonBadge(createProfile()), false); assert.equal(dungeonBadge(p), true, 'depth 1 is open and unbeaten');
});

test('WP10 a Story defeat suggests at most two fixes: the Undercroft when under-powered, then talents/jobs, then gear', () => {
  const weak = midGame(4); for (const id of weak.roster) weak.loadouts[id].xp = 0; weak.gold = 0;
  const fixes = defeatFixes(weak, 10);
  assert.equal(fixes[0]?.kind, 'dungeon');
  assert.ok(fixes.length <= 2);
  const rich = midGame(4);
  const richFixes = defeatFixes(rich, 4);
  assert.ok(richFixes.some(f => f.kind === 'jobs' && rich.storyActive.includes(f.hero!)), JSON.stringify(richFixes));
  assert.ok(richFixes.length <= 2);
  const first = createProfile(); first.gold = 0;
  assert.deepEqual(defeatFixes(first, 0).filter(f => f.kind === 'dungeon'), [], 'no Undercroft before chapter 1 is cleared');
});

test('the defeat gear fix names the slot and piece it found, so it opens on an affordable upgrade (not the Weapon list)', () => {
  const p = createProfile(); p.gold = 60; // 60G: a charm is affordable, no weapon is
  const fix = defeatFixes(p, 0).find(f => f.kind === 'gear');
  const up = affordableUpgrade(p, fix?.hero ?? 0);
  assert.ok(fix && up, JSON.stringify(defeatFixes(p, 0)));
  assert.equal(fix.slot, up.slot); assert.equal(fix.gearId, up.gearId);
  assert.equal(GEAR.find(g => g.id === fix.gearId)?.slot, fix.slot);
  assert.equal(gearReason(p, fix.hero!, fix.gearId!), undefined, 'the piece can be equipped now');
  assert.ok(GEAR.filter(g => g.slot === 'weapon').every(g => gearReason(p, fix.hero!, g.id)) ? fix.slot !== 'weapon' : true, 'no unaffordable slot is suggested');
  p.gold = 0; assert.equal(affordableUpgrade(p, 0), undefined);
});

test('WP10 the first-battle coach remembers each tip, can be skipped, and turning tips back on replays them', () => {
  resetCoach(); setCoachEnabled(true);
  assert.equal(coachEnabled(), true); assert.equal(coachDone('tap'), false);
  markCoach('tap'); assert.equal(coachDone('tap'), true); assert.equal(coachDone('drag'), false);
  skipCoach(); assert.ok(COACH_STEPS.every(coachDone));
  setCoachEnabled(false); assert.equal(coachEnabled(), false);
  setCoachEnabled(true); assert.equal(coachEnabled(), true); assert.ok(COACH_STEPS.every(step => !coachDone(step)), 'tips replay');
});

test('an under-powered party with a promotion in reach is pointed at the Training Hall before training or gear', () => {
  const p = createProfile(); for (let i = 0; i < 3; i++) completeZone(p, i); p.gold = p.economy.gold = 600;
  const n = normalizeProfile(p); n.claimedQuests = QUESTS.filter(q => questProgress(n, q).ready).map(q => q.id);
  const goal = nextObjective(n), promo = promotion(n);
  assert.ok(promo && promo.job.tier === 2 && n.storyActive.includes(promo.hero));
  assert.deepEqual({ facility: goal.facility, tab: goal.tab }, { facility: 'party-advanced', tab: 'jobs' });
  assert.match(goal.text, new RegExp(`${ROSTER[promo.hero].name} can become a ${promo.job.name}`));
  n.gold = n.economy.gold = 0;
  assert.equal(promotion(n), undefined); assert.match(nextObjective(n).text, /^Party power .* Promote heroes/, 'without gold the guide still names promotion first');
});
