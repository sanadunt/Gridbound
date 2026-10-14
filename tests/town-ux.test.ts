import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, completeZone, normalizeProfile } from '../src/game/profile';
import { ROSTER } from '../src/game/content';
import { QUESTS, questProgress } from '../src/game/quests';
import { boardQuests, claimAllQuests, claimAllCount, gearOwner, questGroup } from '../src/ui/quests';
import { normalizeStoryParty, storyPartyCap } from '../src/game/story-party';
import { UNLOCKS, featureOpen, routeLocked, pendingIntros, isNew, markIntro, markVisited, noteModesInUse, resetUnlockFlags } from '../src/ui/unlocks';
import { pushRoute, backRoute } from '../src/ui/route-stack';
import { affordableUpgrade, emptySlots, heroNeeds, trainingBadge, menuBadge, dungeonBadge } from '../src/ui/badges';
import { GEAR } from '../src/game/jobs';
import { gearReason } from '../src/game/profile';
import { defeatFixes } from '../src/ui/result-help';
import { nextObjective, promotion, jobSkillSlot, noticeSeconds } from '../src/ui/town';
import { startRun } from '../src/game/dungeon';
import { clearedText } from '../src/ui/dungeon';
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
  const p = midGame(), ready = QUESTS.filter(q => questProgress(p, q).ready).length, gold = p.gold, count = claimAllCount(p, 0), copy = structuredClone(p);
  assert.deepEqual(p, copy, 'the button count is worked out on a copy');
  const out = claimAllQuests(p, 0);
  assert.ok(out.claimed.length >= ready && ready > 0, `${out.claimed.length} claimed of ${ready} ready`);
  assert.equal(out.claimed.length, count, 'Claim all (n) names what it really claims, chains included');
  assert.equal(out.gold, p.gold - gold);
  assert.equal(QUESTS.filter(q => questProgress(p, q).ready).length, 0, 'nothing is left to claim');
  assert.deepEqual(out.gear.map(g => g.gear), out.claimed.map(id => QUESTS.find(q => q.id === id)?.gear).filter(Boolean), 'each gear reward is listed (the notice names who got it)');
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  assert.ok(out.gear.every(g => g.hero === QUESTS.find(q => q.gear === g.gear)?.heroId || party.includes(g.hero) || g.hero === 0), 'gear goes to the quest hero, a deployed hero, or the chosen recipient');
  assert.deepEqual(claimAllQuests(p, 0), { claimed: [], gold: 0, gear: [] });
});

test('TOWN Claim all after chapter 1 spreads the hunt gear over the deployed party, equipped in empty slots; EXP stays with the recipient', () => {
  const p = createProfile(); completeZone(p, 0); p.ledger.enemies = { wolf: 1, goblin: 1, spider: 1 };
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared), xp = Object.fromEntries(p.roster.map(id => [id, p.loadouts[id].xp ?? 0]));
  const count = claimAllCount(p, 0), out = claimAllQuests(p, 0);
  assert.equal(out.claimed.length, count);
  assert.deepEqual(out.gear.map(g => g.gear).sort(), ['ember-charm', 'iron-edge', 'oak-plate']);
  assert.ok(out.gear.every(g => g.equipped && party.includes(g.hero)), 'every piece is equipped on a deployed hero');
  assert.equal(new Set(out.gear.map(g => g.hero)).size, 3, 'three pieces, three heroes: nobody gets all of it');
  for (const g of out.gear) assert.equal(p.loadouts[g.hero].gear?.[GEAR.find(x => x.id === g.gear)!.slot], g.gear);
  assert.ok((p.loadouts[0].xp ?? 0) > xp[0] && p.roster.filter(id => id !== 0).every(id => (p.loadouts[id].xp ?? 0) === xp[id]), 'quest EXP goes to the recipient');
});
test('TOWN gearOwner picks a deployed hero with the slot free and the fewest pieces, else nobody (the recipient keeps it)', () => {
  const p = createProfile(); completeZone(p, 0);
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  assert.equal(gearOwner(p, 'iron-edge'), party[0]);
  p.loadouts[party[0]].gear = { armor: 'oak-plate' }; p.loadouts[party[0]].inventory = ['oak-plate'];
  assert.equal(gearOwner(p, 'iron-edge'), party[1], 'a hero already wearing a piece comes after one wearing none');
  for (const id of party) { p.loadouts[id].gear = { ...p.loadouts[id].gear, weapon: 'oath-edge' }; }
  assert.equal(gearOwner(p, 'iron-edge'), undefined, 'every weapon slot is taken');
  assert.equal(gearOwner(p, 'nope'), undefined);
});

test('TOWN Equip {skill} now fills slot I, except it never pushes a healer\'s heal out for a skill that does not heal', () => {
  const l = (skills: number[]) => ({ skills, talents: [], slot: 0 });
  assert.equal(jobSkillSlot(l([0, 1]), 'warrior', 4), 0, 'a warrior job skill becomes the opening skill');
  assert.equal(jobSkillSlot(l([0, 1]), 'healer', 4), 0, 'a heal replaces the heal');
  assert.equal(jobSkillSlot(l([0, 1]), 'healer', 5), 1, 'a buff (War Cantor) goes to slot II, the heal stays');
  assert.equal(jobSkillSlot(l([1, 0]), 'healer', 7), 0, 'with no heal in slot I the job skill takes it');
});
test('TOWN the notice toast stays long enough to read: 4 s for a short line, longer for a gear list, never past 12 s', () => {
  assert.equal(noticeSeconds('Saved.'), 4);
  assert.ok(noticeSeconds('x'.repeat(120)) > 8);
  assert.equal(noticeSeconds('x'.repeat(1000)), 12);
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
  const raid = (settled: boolean) => ({ runId: 'q', settled, battle: { mode: 'raid', status: settled ? 'victory' : 'ready', floor: 3, stage: 0, stageCount: 1 } });
  noteModesInUse({ rogue: { activeRun: { runId: 'r' } }, encounters: { raid: raid(false) } });
  assert.deepEqual((['raid', 'endless'] as const).map(f => featureOpen(fresh, f)), [true, true]);
  noteModesInUse({ encounters: { raid: raid(true) } });
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
test('NAV the route stack follows the navigation contract: the MENU is a hub, Back never replays routes from before it', () => {
  const walk = (...tabs: Parameters<typeof pushRoute>[1][]) => tabs.reduce((stack, tab) => pushRoute(stack, tab), ['camp'] as ReturnType<typeof pushRoute>);
  /** The routes Back visits from the end of `tabs` down to the camp. */
  const backs = (...tabs: Parameters<typeof pushRoute>[1][]) => { let stack = walk(...tabs); const seen: string[] = []; while (stack.length > 1) { const to = backRoute(stack); seen.push(to); stack = pushRoute(stack, to); } return seen; };
  assert.deepEqual(backs('more', 'quests'), ['more', 'camp']);
  assert.deepEqual(backs('campaign', 'mission'), ['campaign', 'camp']);
  assert.deepEqual(backs('mission'), ['camp'], 'Next: CH n → the dossier → Back is the camp');
  assert.deepEqual(backs('campaign', 'mission', 'party'), ['mission', 'campaign', 'camp'], 'Prepare party → Back is the dossier');
  assert.deepEqual(backs('more', 'bestiary', 'more', 'challenge-shop'), ['more', 'camp'], 'the Bestiary is never replayed');
  assert.deepEqual(backs('campaign', 'raid'), ['camp'], 'a departure from Raids returns there; Back is the camp');
  assert.deepEqual(walk('campaign', 'mission', 'more'), ['camp', 'more'], 'opening the MENU always gives camp → MENU');
  assert.deepEqual(backs('party'), ['camp'], 'a MENU child opened from a camp sign returns to the camp');
  assert.deepEqual(backs('more', 'party', 'party-advanced'), ['more', 'camp'], 'Party and Jobs swap in place');
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

test('POLISH a defeat with a free party slot and a benched hero suggests deploying one first (still at most two fixes), and never otherwise', () => {
  const short = midGame(1); short.roster = [0, 4, 3]; short.storyActive = [0, 4];
  assert.equal(normalizeStoryParty(short.storyActive, short.roster, short.cleared).length < storyPartyCap(short.cleared), true);
  const fixes = defeatFixes(short, 1);
  assert.deepEqual(fixes[0], { kind: 'deploy', n: 1, hero: 3 }, JSON.stringify(fixes));
  assert.ok(fixes.length <= 2 && fixes.slice(1).every(f => ['dungeon', 'jobs', 'gear'].includes(f.kind)), 'the existing kinds follow, in their order');
  const two = midGame(3); two.storyActive = two.roster.slice(0, 3);
  assert.equal(defeatFixes(two, 3)[0]?.kind, 'deploy'); assert.equal(defeatFixes(two, 3)[0]?.n, emptySlots(two));
  // A full party, or free slots with nobody on the bench: no deploy fix.
  const full = midGame(1); full.roster = [0, 4, 3]; full.storyActive = [0, 4, 3];
  assert.ok(!defeatFixes(full, 1).some(f => f.kind === 'deploy'), 'a full party gets no deploy fix');
  const alone = midGame(1); alone.roster = [0, 4]; alone.storyActive = [0, 4];
  assert.ok(!defeatFixes(alone, 1).some(f => f.kind === 'deploy'), 'nobody on the bench: no deploy fix');
  // An Undercroft run locks the story party, so the fix (which could not be followed) is not offered.
  short.journey.run = startRun(1, 5, [0, 4]);
  assert.ok(!defeatFixes(short, 1).some(f => f.kind === 'deploy'), 'no deploy fix while an Undercroft run locks the party');
});

test('POLISH a cleared depth names the next stair the same way on the map and on the result: open, behind a chapter, or the deepest', () => {
  const p = midGame(2);
  assert.equal(clearedText(p, 1), 'The guardian falls. The next stair waits behind Chapter 3. Everything in the pouch is yours.', 'depth 2 needs Chapter 3');
  completeZone(p, 2);
  assert.equal(clearedText(p, 1), 'The guardian falls and the next stair opens. Everything in the pouch is yours.');
  assert.equal(clearedText(p, 8), 'The deepest guardian falls. Everything in the pouch is yours.');
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
  assert.deepEqual({ facility: goal.facility, tab: goal.tab, job: goal.job }, { facility: 'party-advanced', tab: 'jobs', job: { hero: promo.hero, job: promo.job.id } }, 'Go opens that job\'s inspector');
  assert.match(goal.text, new RegExp(`${ROSTER[promo.hero].name} can become a ${promo.job.name}`));
  n.gold = n.economy.gold = 0;
  assert.equal(promotion(n), undefined); assert.match(nextObjective(n).text, /^Party power .* Promote heroes/, 'without gold the guide still names promotion first');
});

test('RUNS: a paused Story chapter is the camp guide step (its Resume), right after an Undercroft run in progress', () => {
  const paused = { chapter: 5, battle: 2, total: 5, heroic: false, won: false, gold: 30 };
  for (const p of [midGame(5), createProfile()]) assert.deepEqual(nextObjective(p, paused), { text: 'CH 6 is paused at battle 2/5', resume: 5 }, 'before empty slots, chests, quests or the next chapter (even CH 1)');
  assert.equal(nextObjective(midGame(5), { ...paused, heroic: true }).text, 'CH 6 is paused at battle 2/5 · Heroic');
  const run = midGame(5); run.journey.run = startRun(1, 7, run.storyActive);
  assert.equal(nextObjective(run, paused).facility, 'dungeon', 'an Undercroft run in progress still comes first');
});
