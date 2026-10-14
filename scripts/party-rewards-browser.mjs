// Party, rewards and Heroic flow: the camp guide points at empty party slots and the party panel opens,
// the level hint quotes the real growth, the skill book offers only skills the hero can equip (and names
// the missing job), the gear inspector says Equip for owned items and compares refined stats, the dossier
// shows the real payout (first clear, Normal replay, Heroic) and a Heroic recommendation, the Heroic toggle
// does not follow you to another chapter, result screens show exactly the gold credited, a cap increase
// says the party grew, the star bar says when every chest is open, and a short-handed defeat offers Deploy a benched hero first.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const loadout = (slot, extra = {}) => ({ skills: [0, 1], talents: [], xp: 2000, slot, ...extra });
const base = { version: 3, gold: 3000, economy: { gold: 3000, commanderCrystal: 0, materials: {} }, challengeUnlocks: [], claimedQuests: [], ledger: { raids: 0, victories: 3, enemies: {} }, bestFloor: 0, wins: 3, sound: false, motion: false };
const seed = profile => `if (!sessionStorage.getItem('qa.seeded')) { sessionStorage.setItem('qa.seeded', '1'); localStorage.clear(); localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(profile))}); }`;
const text = selector => `document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`;

await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  const profile = { ...base, roster: [0, 4, 3, 2, 7, 1, 5], cleared: [0, 1, 2], storyActive: [0, 4, 3],
    loadouts: { 0: loadout(1, { job: 'paladin', inventory: ['iron-edge', 'oath-edge'], gear: { weapon: 'iron-edge' }, refine: { 'iron-edge': 2 } }), 4: loadout(7), 3: loadout(6), 2: loadout(8), 7: loadout(5), 1: loadout(0), 5: loadout(3) },
    journey: { stars: { 0: 2, 1: 2, 2: 2 }, chests: 0, heroic: [], depth: 0 } };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed(profile) });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');

  // Camp guide: two free slots (cap 5, three deployed) → Go opens the party formation with the party panel open.
  assert.match(await evaluate(text('.camp-copy p')), /Party slots free: 2\./);
  await click('.camp-copy .guide-go');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "party" && Boolean(document.querySelector("details.story-party"))');
  assert.equal(await evaluate('document.querySelector("details.story-party").open && document.querySelector(\'[data-training-panel="formation"]\') !== null'), true, 'the formation tab shows the party panel already open');
  await screenshot('artifacts/party-empty-slots.png');

  // A benched hero (Sable) picks Aldric's tile as her preferred tile: Aldric stays put, no deployed tiles clash, the grid still shows him.
  await click('[data-town-hero="2"]');
  await wait('Boolean(document.querySelector(\'[data-formation="1"]\')) && document.querySelector(".formation-grid + .hint")?.textContent.includes("Sable")');
  await click('[data-formation="1"]');
  await wait('window.gridbound.profile().loadouts[2].slot === 1');
  assert.deepEqual(await evaluate('(() => { const p = window.gridbound.profile(); return p.storyActive.map(id => p.loadouts[id].slot); })()'), [1, 7, 6], 'no deployed hero moves when a benched hero picks a tile');
  assert.match(await evaluate(text('[data-formation="1"]')), /Aldric/, 'the tile still shows the deployed Aldric');
  await click('[data-town-hero="0"]');
  await wait('document.querySelector(".formation-grid + .hint")?.textContent.includes("Sable") === false');

  // Skill book: a Paladin can equip Consecration; the other path's skills say which job they need.
  await click('[data-training-tab="skills"]');
  await wait('Boolean(document.querySelector(".skill-book"))');
  assert.equal(await evaluate('Boolean(document.querySelector(\'[data-equip-skill="4"]\'))'), true, 'Consecration (the Paladin skill) can be equipped');
  for (const [index, job] of [[5, 'Berserker'], [6, 'Aegis Sovereign'], [7, 'Crimson Warlord']]) {
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-equip-skill="${index}"]'))`), false, `skill ${index} has no equip buttons`);
    assert.equal(await evaluate(text(`[data-skill-card="${index}"] .skill-lock`)), `Requires the ${job} job.`);
  }
  await screenshot('artifacts/party-skill-book.png');

  // Gear inspector: owned → Equip with no price; the comparison and the current line use the +2 refine.
  await click('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector(\'[data-gear-item="oath-edge"]\'))');
  await click('[data-gear-item="oath-edge"]');
  await wait('Boolean(document.querySelector(\'[data-gear-preview="oath-edge"]\'))');
  assert.equal(await evaluate(text('[data-confirm-gear]')), 'Equip');
  assert.equal((await evaluate(text('.gear-preview'))).includes('180G'), false, 'an owned item shows no price');
  assert.equal(await evaluate(text('.gear-current')), 'Equipped now: Forged Edge +2');
  const expected = await evaluate(`(async () => { const { gearStats } = await import('/src/game/jobs.ts'); const a = gearStats({ weapon: 'oath-edge' }), b = gearStats({ weapon: 'iron-edge' }, { 'iron-edge': 2 }); const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%'; return [pct(a.power - b.power), pct(a.hp - b.hp), pct(a.tempo - b.tempo)].join(' '); })()`);
  assert.equal(await evaluate('[...document.querySelectorAll(".gear-comparison dd")].map(dd => dd.textContent).join(" ")'), expected, 'the comparison uses refined stats');
  assert.match(await evaluate(text('.gear-preview small')), /· Common$/, 'rarity is translated, not the raw id');
  await screenshot('artifacts/party-gear-owned.png');
  await click('[data-gear-item="scout-weapon"]');
  await wait('Boolean(document.querySelector(\'[data-gear-preview="scout-weapon"]\'))');
  assert.match(await evaluate(text('.gear-preview small')), /· Uncommon$/);
  assert.equal(await evaluate(text('[data-confirm-gear]')), 'Buy & equip');

  // Level hint quotes LEVEL_HP / LEVEL_POWER.
  await click.nav('party-advanced');
  await wait('Boolean(document.querySelector(".hero-progression .hint"))');
  assert.match(await evaluate(text('.hero-progression .hint')), /\+6% base HP and \+5% power/);

  // Dossier: a Normal replay pays 30% gold and less EXP; no recruit row on replays.
  await click.nav('campaign');
  await click('.map-node-pin[data-zone="0"]');
  await wait('Boolean(document.querySelector(".mission-facts"))');
  assert.equal(await evaluate(text('.reward-row')), 'Replay reward29G · EXP 70%');
  assert.equal((await evaluate(text('.mission-facts'))).includes('Recruit'), false);
  // Heroic: own recommendation, Heroic payout, no star goals.
  await click('.mission-map-return');
  await click('.map-node-pin[data-zone="1"]');
  await wait('Boolean(document.querySelector(".heroic-toggle"))');
  await click('[data-heroic="1"]');
  await wait('Boolean(document.querySelector(".heroic-depart"))');
  const heroicRec = await evaluate(`(async () => (await import('/src/game/power.ts')).recommendedHeroicPower(1))()`);
  assert.ok((await evaluate(text('.world-map-dossier .power-line'))).includes(`Heroic recommended power ${heroicRec}`));
  assert.match(await evaluate(text('.reward-row')), /^Heroic first clear185G \+ /);
  assert.equal(await evaluate('Boolean(document.querySelector(".world-map-dossier .heroic-stars")) && !document.querySelector(".world-map-dossier .star-goals ul")'), true);
  await screenshot('artifacts/dossier-heroic.png');
  // The toggle belongs to that chapter: another chapter starts Normal, and so does coming back.
  await click('.mission-map-return');
  await click('.map-node-pin[data-zone="2"]');
  await wait('Boolean(document.querySelector(".heroic-toggle"))');
  assert.equal(await evaluate('document.querySelector(\'[data-heroic="1"]\').getAttribute("aria-pressed")'), 'false');
  assert.equal(await evaluate('Boolean(document.querySelector(".heroic-depart"))'), false);

  const winChapter = async (zone, heroic) => {
    await click.nav('campaign');
    await click(`.map-node-pin[data-zone="${zone}"]`);
    await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
    if (heroic) { await click('[data-heroic="1"]'); await wait('Boolean(document.querySelector(".heroic-depart"))'); }
    await click('[data-depart=adventure]');
    await wait('window.gridbound.battle.mode === "adventure" && window.gridbound.battle.status === "ready"');
    const before = await evaluate('window.gridbound.profile().gold');
    const count = await evaluate('window.gridbound.battle.stageCount');
    for (let stage = 0; stage < count; stage++) {
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
      await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
      await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")', 15000);
      if (stage < count - 1) { await click('#next-wave'); await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden'); }
    }
    const shown = Number((await evaluate(text('[data-result-reward]'))).replace('G', ''));
    return { shown, credited: await evaluate('window.gridbound.profile().gold') - before, battleGold: await evaluate('window.gridbound.battle.gold') };
  };
  // Heroic first clear: battle gold + the Heroic pouch, and a note instead of chapter stars.
  const heroicWin = await winChapter(1, true);
  assert.equal(heroicWin.shown, heroicWin.credited, 'Heroic: the result shows the gold actually credited');
  assert.equal(heroicWin.shown, heroicWin.battleGold + 185);
  assert.equal(await evaluate(text('.result-stars')), 'Stars come from Normal clears.');
  assert.equal(await evaluate('window.gridbound.profile().journey.stars[1]'), 2, 'Heroic leaves Normal stars alone');
  await screenshot('artifacts/result-heroic-reward.png');
  // Return leads back to the dossier the chapter departed from (a replay queues no camp scenes), and says so.
  assert.equal(await evaluate(text('#result-town')), 'Return to Story');
  await click('#result-town');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "mission"');
  // Normal replay: battle gold + 30% of the chapter reward.
  const replay = await winChapter(0, false);
  assert.equal(replay.shown, replay.credited, 'replay: the result shows the gold actually credited');
  assert.equal(replay.shown, replay.battleGold + 29);
  await click('#result-town');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "mission"');
  // First clear of chapter 4 raises the cap to 6: the recruits deploy and the result says the party grew.
  const first = await winChapter(3, false);
  assert.equal(first.shown, first.credited);
  assert.equal(first.shown, first.battleGold + 320, 'a first clear pays the full chapter reward');
  assert.equal(await evaluate(text('.party-grew')), 'Party grew to 6!');
  assert.equal(await evaluate('window.gridbound.profile().storyActive.length'), 6, 'the new slots are filled');
  await screenshot('artifacts/result-party-grew.png');
  // A first clear queues camp scenes (recruits, a story choice): Return goes to the camp.
  assert.equal(await evaluate(text('#result-town')), 'Return to Emberhollow');
  await click('#result-town');
  await wait('Boolean(document.querySelector(".camp-scene"))');
  assert.doesNotMatch(await evaluate(text('.camp-copy p')), /Party slots free/);
  // Raid result: the bank Crystal actually credited, not the battle's (never credited) gold.
  await click.nav('raid');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]"))');
  await click('.secondary-scene [data-depart=raid]');
  await wait('window.gridbound.battle.mode === "raid" && window.gridbound.battle.status === "ready"');
  const bank = await evaluate('window.gridbound.profile().economy.commanderCrystal');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('document.querySelector("#result-screen:not([hidden]) [data-result-reward]") && !document.querySelector("#result-screen button:disabled")', 15000);
  const gained = await evaluate('window.gridbound.profile().economy.commanderCrystal') - bank;
  assert.ok(gained > 0, 'a certified raid pays bank Crystal');
  assert.equal(await evaluate(text('.stat-plaque.gold dt')), 'Crystal');
  assert.equal(await evaluate(text('[data-result-reward]')), `+${gained}`);
  await click('#result-town');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "raid"');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ party, skill book, gear, dossier and result rewards');
}, { width: 1280, height: 900 });

await withBrowser(async ({ send, wait, evaluate, click }) => {
  const cleared = Array.from({ length: 16 }, (_, i) => i);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed({ ...base, roster: [0, 4, 3], cleared, storyActive: [0, 4, 3], loadouts: { 0: loadout(1), 4: loadout(7), 3: loadout(6) }, journey: { stars: Object.fromEntries(cleared.map(i => [i, 3])), chests: 6, heroic: [], depth: 0 } }) });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".star-bar"))');
  assert.equal(await evaluate(text('.star-bar small')), 'All star chests opened');
  console.log('✓ star bar after the last chest');
}, { width: 1280, height: 900 });

// A Story defeat with a free party slot and a benched hero: the first fix deploys one. It opens Party → Formation on the benched
// hero with the story party list open, and its toggle deploys them (phone).
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed({ ...base, roster: [0, 4, 3], cleared: [0], storyActive: [0, 4], loadouts: { 0: loadout(1), 4: loadout(7), 3: loadout(6) }, journey: { stars: { 0: 1 }, chests: 0, heroic: [], depth: 0 } }) });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');
  await click.nav('campaign');
  await click('[data-zone="1"]');
  await wait('Boolean(document.querySelector(\'[data-depart="adventure"]\'))');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && Boolean(document.querySelector("#start:not([hidden]):not(:disabled)"))', 15000);
  assert.deepEqual(await evaluate('window.gridbound.battle.heroes.map(h => h.id)'), [0, 4], 'the party departs one hero short');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('window.gridbound.battle.heroes.forEach(h => { h.hp = 0; }); window.gridbound.step(.1)');
  await wait('document.querySelector("#result-screen:not([hidden]) .defeat-help") && !document.querySelector("#result-town").disabled', 15000);
  const fixes = await evaluate('[...document.querySelectorAll("[data-defeat-fix]")].map(b => [b.dataset.defeatFix, b.textContent, b.dataset.fixHero ?? null])');
  assert.deepEqual(fixes[0], ['deploy', 'Deploy a benched hero (1 empty slot) ▶', '3'], JSON.stringify(fixes));
  assert.ok(fixes.length <= 2, 'still at most two fixes');
  await screenshot('artifacts/party-defeat-deploy.png');
  await click('[data-defeat-fix="deploy"]');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "party" && Boolean(document.querySelector(\'[data-training-panel="formation"]\'))');
  const view = await evaluate(`(() => { const toggle = document.querySelector('[data-story-toggle="3"]'), r = toggle.getBoundingClientRect();
    return { open: document.querySelector('details.story-party').open, hero: document.querySelector('.party-roster .active')?.dataset.townHero, hint: document.querySelector('.formation-grid + .hint')?.textContent ?? '', bench: toggle.textContent, onScreen: r.top >= 0 && r.bottom <= innerHeight }; })()`);
  assert.equal(view.open, true, 'the story party list is open'); assert.equal(view.hero, '3', 'Formation opens on the benched hero');
  assert.match(view.hint, /on the bench/); assert.match(view.bench, /Benched/); assert.ok(view.onScreen, `the bench toggle is on screen: ${JSON.stringify(view)}`);
  await screenshot('artifacts/party-deploy-fix.png');
  await click('[data-story-toggle="3"]');
  await wait('window.gridbound.profile().storyActive.includes(3)');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('✓ a short-handed defeat offers Deploy a benched hero first, and it opens Formation on the bench');
}, { width: 390, height: 844, mobile: true });

console.log('PARTY & REWARDS BROWSER TESTS PASSED');
