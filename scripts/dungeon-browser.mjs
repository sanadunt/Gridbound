// Undercroft, progress and Heroic: the camp guide, party power and chapter stars on the map, the
// Heroic toggle, a dungeon run (map, rooms, a fight and its result) and forge refinement.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const loadout = slot => ({ skills: [0, 1], talents: [], xp: 600, slot, gear: { weapon: 'iron-edge' }, inventory: ['iron-edge'] });
const qaProfile = {
  version: 3, gold: 3000, economy: { gold: 3000, commanderCrystal: 0, materials: { 'ember-shard': 6 } },
  challengeUnlocks: [], claimedQuests: [], ledger: { raids: 0, victories: 0, enemies: {} },
  roster: [0, 4, 3, 2], cleared: [0, 1, 2], storyActive: [0, 4, 3, 2],
  loadouts: { 0: loadout(1), 4: loadout(7), 3: loadout(6), 2: loadout(4) },
  journey: { stars: { 0: 3, 1: 3, 2: 2 }, chests: 0, heroic: [], depth: 0 },
  bestFloor: 0, wins: 3, sound: false, motion: false,
};

for (const viewport of [{ width: 1280, height: 900, mobile: false, tag: 'desktop' }, { width: 390, height: 844, mobile: true, tag: 'mobile' }]) {
  console.log(`--- Undercroft & progress (${viewport.tag}) ---`);
  await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("canvas")');
    await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(qaProfile)}))`);
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');

    // Camp: the next-step guide and the Undercroft entrance.
    const guide = await evaluate('document.querySelector(".camp-copy .guide-label")?.parentElement.textContent ?? ""');
    assert.ok(guide.length > 20, 'camp shows a next-step guide');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-copy .guide-go[data-facility]"))'), true, 'guide has a Go button');
    assert.equal(await evaluate('document.querySelector(\'.town-spot[data-facility="dungeon"] .town-sign\')?.textContent'), 'Undercroft');
    await screenshot(`artifacts/progress-camp-${viewport.tag}.png`);

    // World map: party power vs recommendation, stars on cleared nodes, star bar, Heroic toggle on a cleared chapter.
    await click.nav('campaign');
    await wait('Boolean(document.querySelector(".power-line"))');
    assert.match(await evaluate('document.querySelector(".power-line").className'), /power-(ready|close|under)/);
    assert.ok(await evaluate('document.querySelectorAll(".map-node-stars").length') >= 3, 'cleared chapters show stars');
    assert.match(await evaluate('document.querySelector(".star-bar").textContent'), /8/, 'star total is shown');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-star-chest]"))'), true, '8 stars open a chest');
    await click('[data-star-chest]');
    await wait('window.gridbound.profile().journey.chests === 1');
    assert.ok(await evaluate('window.gridbound.profile().gold') > 3000, 'chest pays gold');
    await screenshot(`artifacts/progress-map-${viewport.tag}.png`);
    await click('.map-node-pin[data-zone="0"]');
    await wait('Boolean(document.querySelector(".heroic-toggle"))');
    await click('[data-heroic="1"]');
    await wait('Boolean(document.querySelector(".heroic-note")) && Boolean(document.querySelector(".heroic-depart"))');
    await screenshot(`artifacts/progress-heroic-${viewport.tag}.png`);
    await click('[data-heroic="0"]');
    await wait('!document.querySelector(".heroic-note")');

    // Undercroft: depth picker → run.
    await click.nav('camp');
    await click('.town-spot[data-facility="dungeon"]');
    await wait('document.querySelectorAll(".depth-card").length === 8');
    assert.equal(await evaluate('document.querySelectorAll(".depth-card:not(.locked)").length'), 1, 'only depth 1 is open after chapter 3');
    await screenshot(`artifacts/dungeon-depths-${viewport.tag}.png`);
    await click('[data-dungeon-start="1"]');
    await wait('Boolean(document.querySelector(".dungeon-map .room.open"))');
    assert.ok(await evaluate('document.querySelectorAll(".dungeon-map .room").length') >= 12, 'map has rooms');
    await screenshot(`artifacts/dungeon-map-${viewport.tag}.png`);

    // Walk rooms until a fight has been won (resolving events, treasure and camps on the way).
    let fights = 0;
    for (let step = 0; step < 12 && fights < 2; step++) {
      const state = await evaluate('window.gridbound.profile().journey.run?.status');
      if (state !== 'active') break;
      if (await evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))')) {
        await click('[data-dungeon-fight]');
        await wait('window.gridbound.battle.mode === "dungeon" && ["ready", "fighting"].includes(window.gridbound.battle.status)', 15000);
        if (await evaluate('window.gridbound.battle.status === "ready"')) { await wait('Boolean(document.querySelector("#start:not([hidden]):not(:disabled)"))'); await click('#start'); }
        await wait('window.gridbound.battle.status === "fighting"');
        if (fights === 0) await screenshot(`artifacts/dungeon-fight-${viewport.tag}.png`);
        await evaluate('for (const e of window.gridbound.battle.enemies ?? []) e.hp = 0; window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
        await wait('Boolean(document.querySelector("#result-dungeon")) && !document.querySelector("#result-dungeon").disabled', 15000);
        if (fights === 0) await screenshot(`artifacts/dungeon-result-${viewport.tag}.png`);
        await click('#result-dungeon');
        await wait('Boolean(document.querySelector(".dungeon-scene"))');
        fights++;
        continue;
      }
      for (const sel of ['[data-dungeon-choice]', '[data-dungeon-open]', '[data-dungeon-camp="rest"]']) {
        if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(sel)}))`)) { await click(sel); await wait('Boolean(document.querySelector(".room-outcome")) || Boolean(document.querySelector("[data-dungeon-fight]"))', 5000).catch(() => {}); break; }
      }
      if (await evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))')) continue;
      const before = await evaluate('window.gridbound.profile().journey.run?.at');
      if (await evaluate('Boolean(document.querySelector(".dungeon-map .room.open"))')) {
        await click('.dungeon-map .room.open');
        await wait(`window.gridbound.profile().journey.run?.at !== ${before}`);
      }
    }
    assert.ok(fights >= 1, 'won at least one dungeon fight');
    const run = await evaluate('window.gridbound.profile().journey.run');
    assert.ok(run.pouch.gold > 0, 'fights fill the pouch');
    assert.ok(Object.values(run.hp).every(v => v > 0 && v <= 1), 'carried HP is a ratio');
    await screenshot(`artifacts/dungeon-progress-${viewport.tag}.png`);

    // Abandon keeps nothing from the pouch.
    const gold = await evaluate('window.gridbound.profile().gold');
    await click('[data-dungeon-leave]');
    await wait('Boolean(document.querySelector("#dungeon-abandon"))');
    await click('#dungeon-abandon');
    await wait('document.querySelectorAll(".depth-card").length === 8');
    assert.equal(await evaluate('window.gridbound.profile().gold'), gold, 'abandoning banks nothing');

    // Forge: refine the equipped weapon with Ember Shards.
    await click.nav('party');
    await click('[data-training-tab="gear"]');
    await wait('Boolean(document.querySelector("[data-gear-open]"))');
    await click('[data-gear-open="weapon"]');
    await wait('Boolean(document.querySelector("[data-refine]"))');
    await screenshot(`artifacts/forge-refine-${viewport.tag}.png`);
    await click('[data-refine]');
    await wait('Object.values(window.gridbound.profile().loadouts).some(l => (l.refine?.["iron-edge"] ?? 0) === 1)');
    assert.match(await evaluate('document.querySelector(".refine-row b").textContent'), /\+1/);
    assert.deepEqual(errors, [], 'no console errors');
  }, viewport);
}
console.log('PASS dungeon browser');
