// Town and first-session UX (WP10): the camp's one-tap Continue story, staged unlocks (locked hotspots and gate tabs say which
// chapter opens them, a one-time intro card and NEW flags), the HUD ◀ route stack, the Quest Board as one list with ready rewards
// first and Claim all, the Bestiary grid with silhouettes, badges, per-hero sprites, the coached first battle, and result/defeat
// screens whose actions stay on screen and lead to a fix. Screenshots at 390×844 and 1280×900 go to artifacts/.
import assert from 'node:assert/strict';
import { withBrowser, seedSave } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const route = 'document.querySelector(".town-game-shell")?.dataset.townRoute';
const ids = [0, 4, 3, 2, 7, 1, 5, 6, 8, 9, 10, 11, 12];
const midSave = {
  version: 3, gold: 3000, economy: { gold: 3000, commanderCrystal: 50, materials: {} }, challengeUnlocks: [], claimedQuests: [],
  ledger: { raids: 0, victories: 20, enemies: { wolf: 3, goblin: 3, spider: 2, shaman: 2, golem: 2, wraith: 2, treant: 1, dragon: 1, moth: 1, revenant: 1 } },
  roster: ids, cleared: [0, 1, 2, 3, 4, 5], storyActive: [0, 4, 3, 2, 7, 1, 5, 6],
  loadouts: Object.fromEntries(ids.map((id, i) => [id, { skills: [0, 1], talents: [], xp: 2500, slot: i % 9 }])),
  bestFloor: 0, wins: 20, sound: false, motion: false,
};

// 1. A fresh save on a phone: Continue story, locked modes, the route stack, the Bestiary's silhouettes and the coached first battle.
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await wait(`window.gridbound && ${route} === "camp"`);
  assert.equal(await evaluate('document.querySelector(".camp-copy .guide-go")?.dataset.continueStory'), '0', 'the guide is the one-tap Continue story');
  await click('[data-continue-story="0"]');
  await wait(`${route} === "mission" && Boolean(document.querySelector(".world-map-dossier"))`);
  assert.match(await evaluate('document.querySelector(".world-map-dossier h3").textContent'), /Ashwood/, 'one tap from camp to the chapter dossier');
  await click('#home');
  await wait(`${route} === "camp"`);

  // A locked hotspot explains itself and goes nowhere.
  await click('.town-spot[data-spot="lodge"]');
  await wait('document.querySelector("#town-notice:not([hidden])")?.textContent.includes("Chapter 2")');
  assert.equal(await evaluate(route), 'camp');
  assert.equal(await evaluate('document.querySelector(".town-spot[data-spot=lodge]").getAttribute("aria-label")'), "Hunters' Lodge · Raids · Clear Chapter 2");

  // ◀ returns to the previous route; on the camp the title opens the MENU.
  await click.nav('quests');
  await click('#home');
  await wait(`${route} === "more"`);
  await click('#home');
  await wait(`${route} === "camp"`);
  await click('#home');
  await wait(`${route} === "more"`);
  assert.equal(await evaluate('document.querySelector("#title-screen").hidden'), true, 'the camp title is not a hidden Title button');
  await click('.more-scene [data-facility="party-advanced"]');
  await wait(`${route} === "party-advanced"`);
  assert.deepEqual(await evaluate('(() => { const t = document.querySelector("#hud-title"); return [t.textContent, t.scrollWidth <= t.clientWidth + 1]; })()'), ['Jobs', true], 'the HUD names the route in full');
  await click.nav('more');
  assert.ok(await evaluate('document.querySelector(".more-grid").getBoundingClientRect().top < document.querySelector(".menu-party").getBoundingClientRect().top'), 'on a phone the MENU lists its commands first');

  await click.nav('bestiary');
  assert.equal(await evaluate('document.querySelectorAll(".bestiary-cell.unseen b").length'), 18);
  assert.equal(await evaluate('document.querySelector(".bestiary-cell.unseen b").textContent'), '???', 'an unseen enemy is a ??? silhouette');

  // The coached first battle (forced on: automation skips it otherwise).
  await evaluate('window.gridbound.coach(true)');
  await click.nav('campaign');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready"');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('window.gridbound.step(0.1)');
  await wait('window.gridbound.coachStep === "tap" && !document.querySelector("#coach").hidden');
  assert.match(await evaluate('document.querySelector("#coach .coach-text").textContent'), /^Tap Aldric/);
  await screenshot('artifacts/town-ux-coach-tap-390.png');
  // Two taps on the same hero need 0.11 s of battle time between them (tap cooldown): step past it instead of relying on a slow page.
  await click('#unit-layer [data-tap="0"]'); await evaluate('window.gridbound.step(0.12)'); await click('#unit-layer [data-tap="0"]');
  await evaluate('window.gridbound.step(0.05)');
  await wait('window.gridbound.coachStep !== "tap"');
  for (let i = 0; i < 120 && await evaluate('window.gridbound.coachStep') !== 'drag'; i++) await evaluate('window.gridbound.step(0.25)');
  assert.equal(await evaluate('window.gridbound.coachStep'), 'drag', 'the first ground telegraph on a hero gets the drag tip');
  assert.match(await evaluate('document.querySelector("#coach .coach-text").textContent'), /^Drag .+ off the red tiles!$/);
  assert.equal(await evaluate('window.gridbound.scene.timeScale'), 0.3, 'time slows while the drag is explained');
  await screenshot('artifacts/town-ux-coach-drag-390.png');
  await evaluate(`(() => { const b = window.gridbound.battle, t = b.threats.find(v => ['front', 'breath', 'meteor'].includes(v.type)), h = b.living().find(h => t.slots.includes(h.slot)); b.move(h.id, [0,1,2,3,4,5,6,7,8].find(s => !t.slots.includes(s) && !b.heroes.some(x => x.slot === s))); window.gridbound.step(0.05); })()`);
  await wait('window.gridbound.coachStep !== "drag" && window.gridbound.scene.timeScale === 1');
  // The spider (battle 3) has an all-grid ritual: the Guard tip appears with the GUARD NOW window.
  await evaluate('window.gridbound.boot("adventure", 1, { stage: 2 })');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  for (let i = 0; i < 200 && await evaluate('window.gridbound.coachStep') !== 'guard'; i++) await evaluate('window.gridbound.step(0.2)');
  assert.equal(await evaluate('window.gridbound.coachStep'), 'guard');
  assert.equal(await evaluate('document.querySelector("#guard").classList.contains("ready-window")'), true, 'the Guard tip shows with the GUARD NOW cue');
  await click('#guard');
  await evaluate('window.gridbound.step(0.05)');
  await wait('window.gridbound.coachStep !== "guard"');
  await evaluate('window.gridbound.battle.resolve = 100; window.gridbound.step(0.05)');
  await wait('window.gridbound.coachStep === "ult"');
  await click('#coach .coach-skip');
  await evaluate('window.gridbound.step(0.05)');
  assert.deepEqual(await evaluate('window.gridbound.coach(false).done'), ['tap', 'drag', 'guard', 'ult'], 'Skip tips marks the coach done');
  assert.equal(await evaluate('document.querySelector("#coach").hidden'), true);
  assert.deepEqual(errors, []);
  console.log('PASS fresh phone: Continue story, locked modes, route stack, Bestiary silhouettes, coached first battle');
}, { width: 390, height: 844, mobile: true });

// 2. A mid-game save at 390×844 and 1280×900: badges, the Quest Board, the unlock card, per-hero sprites, defeat help and sticky result actions.
for (const [width, height] of [[390, 844], [1280, 900]]) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
    await seedSave(send, midSave);
    await send('Page.navigate', { url });
    await wait(`window.gridbound && ${route} === "camp" && window.gridbound.profile().cleared.length === 6`);
    const ready = await evaluate('Number(document.querySelector(".town-spot[data-spot=guild] .spot-flag")?.textContent)');
    assert.ok(ready > 0, 'the Guild shows how many rewards wait');
    assert.equal(await evaluate('Number(document.querySelector("#menu-button").dataset.badge)'), ready, 'the MENU button carries the waiting rewards');
    assert.ok(await evaluate('Number(document.querySelector(".town-spot[data-spot=hall] .spot-flag")?.textContent)') > 0, 'the Training Hall badge counts heroes with something to buy');
    assert.equal(await evaluate('document.querySelector(".town-spot[data-spot=well] .spot-new")?.textContent'), 'NEW', 'a mode opened but not visited is NEW');
    const story = await evaluate('(() => { const b = document.querySelector("[data-continue-story]"), r = b.getBoundingClientRect(); return { zone: b.dataset.continueStory, inside: r.top >= 0 && r.bottom <= innerHeight }; })()');
    assert.deepEqual(story, { zone: '6', inside: true }, 'Continue story points at the next chapter and is on screen');
    await screenshot(`artifacts/town-ux-camp-${width}x${height}.png`);

    // The one-time unlock card (forced: automation skips it) opens the mode; the visit clears NEW.
    await evaluate('window.gridbound.unlockIntro()');
    await wait('Boolean(document.querySelector("dialog[open] .unlock-card"))');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".unlock-entry")].map(e => e.dataset.unlock)'), ['dungeon', 'raid', 'endless']);
    await click('dialog[open] [data-unlock-go="endless"]');
    await wait(`${route} === "endless"`);
    await click.nav('camp');
    assert.equal(await evaluate('Boolean(document.querySelector(".town-spot[data-spot=well] .spot-new"))'), false, 'visited: no longer NEW');
    await evaluate('window.gridbound.unlockIntro()');
    assert.equal(await evaluate('Boolean(document.querySelector("dialog[open] .unlock-card"))'), false, 'the card plays once');

    // Quest Board: ready rewards first, Claim all.
    await click.nav('quests');
    assert.equal(await evaluate('document.querySelector(".quest-entry").dataset.questState'), 'ready', 'the first card is a ready quest');
    assert.equal(await evaluate('Boolean(document.querySelector(".page-controls"))'), false, 'one list, no pager');
    await screenshot(`artifacts/town-ux-quests-${width}x${height}.png`);
    const gold = await evaluate('window.gridbound.profile().gold');
    await click('[data-claim-all]');
    await wait('!document.querySelector("[data-claim-all]") && document.querySelector("#town-notice:not([hidden])")?.textContent.includes("claimed")');
    assert.ok(await evaluate('window.gridbound.profile().gold') > gold);
    assert.equal(await evaluate('document.querySelectorAll(".quest-entry[data-quest-state=ready]").length'), 0, 'nothing is left to claim');
    assert.equal(await evaluate('document.querySelector("#menu-button").dataset.badge'), '', 'the MENU badge clears');

    await click.nav('bestiary');
    assert.equal(await evaluate('document.querySelectorAll(".bestiary-cell:not(.unseen)").length'), 10, 'met families fill in');
    await screenshot(`artifacts/town-ux-bestiary-${width}x${height}.png`);
    await click.nav('party');
    // Same-class heroes look different (Aldric and Bran, Rowan and Kestrel).
    const faces = await evaluate('Object.fromEntries([0, 1, 3, 5].map(id => [id, document.querySelector(`[data-town-hero="${id}"] img`).src]))');
    assert.notEqual(faces[0], faces[1], 'Aldric and Bran have their own sprites'); assert.notEqual(faces[3], faces[5], 'Rowan and Kestrel have their own sprites');
    await screenshot(`artifacts/town-ux-party-${width}x${height}.png`);

    // A defeat explains itself: power vs the recommendation, who fell first, the enemy counter, and one-tap fixes.
    await evaluate('window.gridbound.boot("adventure", 7)');
    await wait('window.gridbound.battle.status === "ready"');
    assert.ok(await evaluate('window.gridbound.scene.textures.exists("warrior-h1-0") && window.gridbound.scene.textures.exists("archer-h5-0")'), 'the battle grid draws Bran and Kestrel with their own textures');
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    await evaluate('(() => { const b = window.gridbound.battle; b.heroes.forEach(h => { h.hp = 1; h.shield = 0; }); })()');
    for (let i = 0; i < 120 && await evaluate('window.gridbound.battle.status') === 'fighting'; i++) await evaluate('window.gridbound.step(0.5)');
    await wait('document.querySelector("#result-screen:not([hidden]) .result-ceremony-modal.defeat") && !document.querySelector("#result-town").disabled', 15000);
    const help = await evaluate('document.querySelector(".defeat-help").innerText');
    assert.match(help, /Party power [\d,]+ · recommended \d{1,3}(,\d{3})*\b/, "numbers carry the language's digit grouping");
    assert.match(help, /fell first/);
    assert.match(help, /How to beat [^:]+:/);
    const fixes = await evaluate('[...document.querySelectorAll("[data-defeat-fix]")].map(b => b.dataset.defeatFix)');
    assert.ok(fixes.length >= 1 && fixes.length <= 2, JSON.stringify(fixes));
    const actions = await evaluate('[...document.querySelectorAll(".ceremony-actions button")].map(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })');
    assert.ok(actions.length >= 3 && actions.every(Boolean), `defeat actions on screen: ${JSON.stringify(actions)}`);
    await screenshot(`artifacts/town-ux-defeat-${width}x${height}.png`);
    if (fixes.includes('gear')) assert.ok(await evaluate('Boolean(document.querySelector("[data-defeat-fix=gear][data-fix-slot][data-fix-gear]"))'), 'the gear fix names the slot and piece it found');
    const fixKind = fixes.includes('jobs') ? 'jobs' : fixes[0], fixHero = await evaluate(`document.querySelector('[data-defeat-fix="${fixKind}"]').dataset.fixHero ?? null`);
    await click(`[data-defeat-fix="${fixKind}"]`);
    await wait(`["party-advanced", "party", "dungeon"].includes(${route})`);
    if (fixes.includes('jobs')) assert.equal(await evaluate('document.querySelector("[data-training-panel]").dataset.trainingPanel'), 'talents', 'the Jobs fix opens the talents');
    if (fixHero !== null) assert.equal(await evaluate('document.querySelector(".party-roster .active")?.dataset.townHero'), fixHero, 'the fix opens the Training Hall on the hero it names');

    // A victory with a full party and a bench: the actions stay on screen (sticky), the EXP is a compact grid.
    await evaluate('window.gridbound.boot("adventure", 7)');
    await wait('window.gridbound.battle.status === "ready"');
    await click('#start');
    const count = await evaluate('window.gridbound.battle.stageCount');
    for (let stage = 0; stage < count; stage++) {
      await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
      await wait('document.querySelector("#result-screen:not([hidden]) button") && !document.querySelector("#result-screen button:disabled")', 15000);
      if (stage < count - 1) { await click('#next-wave'); await wait('window.gridbound.battle.status === "ready"'); await click('#start'); }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    const result = await evaluate('({ actions: [...document.querySelectorAll(".ceremony-actions button")].map(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44; }), cards: document.querySelectorAll(".xp-grid .xp-card").length, party: window.gridbound.battle.heroes.length, bench: document.querySelector(".xp-bench")?.textContent ?? "" })');
    assert.ok(result.actions.length >= 3 && result.actions.every(Boolean), `victory actions visible at ${width}×${height}: ${JSON.stringify(result)}`);
    assert.equal(result.cards, result.party, 'one portrait card per party hero');
    assert.match(result.bench, /^Bench \(\d+\)/, 'the bench is one line');
    await screenshot(`artifacts/town-ux-victory-${width}x${height}.png`);
    assert.deepEqual(errors, []);
    console.log(`PASS mid-game ${width}×${height}: badges, unlock card, Quest Board, Bestiary, hero sprites, defeat help, sticky result actions`);
  }, { width, height, mobile: width < 500 });
}
console.log('ALL TOWN UX BROWSER TESTS PASSED');
