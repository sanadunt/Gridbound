// Undercroft, progress and Heroic: the camp guide, party power and chapter stars on the map, the
// Heroic toggle, a dungeon run (map, rooms, a fight and its result) and forge refinement. Room results are
// saved the moment they appear: a reload on the result screen keeps a win and cannot undo a wipe, and a failed
// save there offers retry/export and the retry saves the same outcome once. The run's party is locked; fleeing a
// fight keeps the wounds and drops half the pouch, and a reload mid-fight counts as a flee, unless the OS closed the game in the background
// (phone contract C4: the room then waits at the HP noted when the page was hidden, with the pouch intact). The mode tabs keep
// their height on the depth picker (fresh and mid-game saves), and on a phone a tapped room's action is on screen.
// A tap on a depth opens its dossier first (foes as silhouettes until met, the party's power, the party-lock warning):
// Escape and the browser Back close it without starting a run, Descend starts one (on a phone a double tap on the depth, whose second tap
// lands on Descend as the dossier opens, starts nothing). The camp's Rest says what it heals
// and that it closes the way out; a cleared depth whose next stair is behind a chapter says so on the map.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  await withBrowser(async ({ send, wait, evaluate, screenshot, click, key, errors }) => {
    // QA switch: while localStorage['qa.failPut'] is set, IndexedDB writes fail as if storage were full.
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `{ const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (localStorage.getItem('qa.failPut')) throw new DOMException('QA quota exceeded', 'QuotaExceededError'); return put.apply(this, args); }; }` });
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("canvas")');
    // A fresh save has not opened the Undercroft yet (it opens with Chapter 1): the Bell Tower is locked and says why.
    assert.equal(await evaluate('document.querySelector(\'.town-spot[data-spot="chapel"]\')?.dataset.locked'), 'dungeon', 'the Undercroft is locked on a fresh save');
    await click('.town-spot[data-spot="chapel"]');
    await wait('document.querySelector("#town-notice:not([hidden])")?.textContent.includes("Chapter 1")');
    // The mode tabs on the depth picker keep their height whatever the content: a save that just opened it (short) here, a mid-game one below.
    await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify({ ...qaProfile, cleared: [0], journey: { stars: { 0: 1 }, chests: 0, heroic: [], depth: 0 } })}))`);
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');
    const navHeight = 'document.querySelector(".dungeon-scene .expedition-mode-nav")?.getBoundingClientRect().height ?? 0';
    await click.nav('dungeon');
    await wait('Boolean(document.querySelector(".dungeon-scene .expedition-mode-nav"))');
    assert.ok(await evaluate(navHeight) >= 40, `short save: mode tabs ${await evaluate(navHeight)}px tall`);
    assert.ok(await evaluate('Math.max(...[...document.querySelectorAll(".dungeon-scene .expedition-mode-nav button")].map(b => b.getBoundingClientRect().height))') < 70, 'short save: mode tabs are not stretched');
    await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(qaProfile)}))`);
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")');

    // Camp: the next-step guide and the Undercroft entrance.
    const guide = await evaluate('document.querySelector(".camp-copy .guide-label")?.parentElement.textContent ?? ""');
    assert.ok(guide.length > 20, 'camp shows a next-step guide');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-copy .guide-go[data-facility]"))'), true, 'guide has a Go button');
    assert.equal(await evaluate('document.querySelector(\'.town-spot[data-facility="dungeon"] .town-sign small\')?.textContent'), 'Undercroft', 'the sign names the destination as the HUD and the gate tab do');
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
    assert.match(await evaluate('document.querySelector(".heroic-note").textContent'), /60%[^]*45%/, 'the Heroic note names the chapter\'s HP and damage bonus (heroicScale)');
    await screenshot(`artifacts/progress-heroic-${viewport.tag}.png`);
    await click('[data-heroic="0"]');
    await wait('!document.querySelector(".heroic-note")');

    // Undercroft: depth picker → run.
    await click.nav('camp');
    await click('.town-spot[data-facility="dungeon"]');
    await wait('document.querySelectorAll(".depth-card").length === 8');
    assert.equal(await evaluate('document.querySelectorAll(".depth-card:not(.locked)").length'), 1, 'only depth 1 is open after chapter 3');
    assert.ok(await evaluate(navHeight) >= 40, `mid-game save: mode tabs ${await evaluate(navHeight)}px tall`);
    assert.ok(await evaluate('document.querySelector(".dungeon-rules[open]") && document.querySelector(".dungeon-rules").compareDocumentPosition(document.querySelector(".depth-list")) & Node.DOCUMENT_POSITION_FOLLOWING'), 'How it works (with the pouch rule) comes before the depths');
    assert.equal(await evaluate('document.querySelectorAll(".dungeon-rules .dungeon-legend li").length'), 6, 'room key lists the six room kinds');
    await screenshot(`artifacts/dungeon-depths-${viewport.tag}.png`);
    // A depth opens its dossier: nothing starts (the story party stays free) until Descend; Back is focused, Escape and the browser Back close it.
    const dossier = 'Boolean(document.querySelector("#modal[open] [data-depth-dossier=\\"1\\"]"))', noModal = '!document.querySelector("#modal").open';
    assert.deepEqual(await evaluate('(s => [s.firstChild.textContent, s.querySelector("[aria-hidden=true]")?.textContent, s.querySelector(".sr-only")?.textContent])(document.querySelector(".depth-card:not(.locked) small"))'), ['Guardian: ', '???', 'Unknown enemy'], 'a guardian the Bestiary has not met stays a secret on the depth card (read as Unknown enemy)');
    await click('[data-dungeon-pick="1"]');
    await wait(dossier);
    const card = await evaluate('document.querySelector("#modal").innerText');
    for (const part of [/Undercroft · Depth 1/, /The Cistern Stair/, /Guardian/, /In the rooms/, /This depth drops Ember Shard/, /Party power [\d,]+/, /Rec\. [\d,]+ · (Ready|A little under|Under-powered)/, /Wounds carry over/, /Your story party is locked to this run until you extract, beat the guardian or abandon\./, /Descend ▶/, /◀ Back/])
      assert.match(card, part, `the dossier shows ${part}`);
    assert.equal(await evaluate('document.querySelectorAll("#modal .dossier-foe.unseen").length'), 6, 'unmet foes are silhouettes (guardian, three room foes, two elites)');
    assert.equal(await evaluate('[...document.querySelectorAll("#modal .dossier-foe.unseen b")].every(b => b.querySelector("[aria-hidden=true]")?.textContent === "???" && b.querySelector(".sr-only")?.textContent === "Unknown enemy")'), true, 'an unmet foe reads ??? on screen and Unknown enemy to a screen reader');
    assert.equal(await evaluate('document.querySelectorAll("#modal .dossier-party img").length'), 4, 'the party that would go');
    assert.equal(await evaluate('document.activeElement?.dataset.navExit'), 'close', 'Back is focused: a second Enter never starts a run');
    assert.equal(await evaluate('window.gridbound.profile().journey.run ?? null'), null, 'opening the dossier starts no run');
    await screenshot(`artifacts/dungeon-dossier-${viewport.tag}.png`);
    await key('Escape');
    await wait(noModal);
    assert.equal(await evaluate('window.gridbound.navState().route'), 'dungeon', 'Escape closes the dossier onto the depth list');
    await click('[data-dungeon-pick="1"]');
    await wait(dossier);
    const history = await evaluate('history.length');
    await evaluate('history.back(), true');
    await wait(noModal);
    assert.deepEqual(await evaluate('[window.gridbound.navState().route, history.length, window.gridbound.profile().journey.run ?? null]'), ['dungeon', history, null], 'the browser Back closes it too, in the game');
    if (viewport.mobile) {
      // A double tap on a depth: on a phone Descend can open right under the finger, and the second tap lands on it. It is ignored
      // (the dossier stays open, no run, the party stays free); a Descend tap a moment later still starts the run.
      const touch = async point => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
      const centre = selector => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await evaluate('document.querySelector("[data-dungeon-pick=\\"1\\"]").scrollIntoView({ block: "center" }), true');
      await touch(await centre('[data-dungeon-pick="1"]'));
      await sleep(150);
      await wait(dossier, 2000);
      const descend = await centre('#modal [data-dungeon-start="1"]');
      assert.equal(await evaluate(`Boolean(document.elementFromPoint(${descend.x}, ${descend.y})?.closest("[data-dungeon-start]"))`), true, 'Descend is on screen, under the second tap');
      await touch(descend);
      await sleep(300);
      assert.deepEqual(await evaluate(`[${dossier}, window.gridbound.profile().journey.run ?? null]`), [true, null], 'a second tap on Descend as the dossier opens starts no run');
      await sleep(400);
      await touch(descend);
      await wait('window.gridbound.profile().journey.run?.status === "active"');
      // Abandon it: the walk below starts its own run after visiting Party with a free story party.
      await wait('Boolean(document.querySelector("[data-dungeon-leave]"))');
      await click('[data-dungeon-leave]');
      await wait('Boolean(document.querySelector("#dungeon-abandon"))');
      await click('#dungeon-abandon');
      await wait('document.querySelectorAll(".depth-card").length === 8 && !window.gridbound.profile().journey.run');
    }
    await click.nav('party');
    await wait('Boolean(document.querySelector("details.story-party:not(.locked)"))');
    await click.nav('camp');
    await click('.town-spot[data-facility="dungeon"]');
    await wait('document.querySelectorAll(".depth-card").length === 8');
    await click('[data-dungeon-pick="1"]');
    await wait(dossier);
    // Descend ignores a tap that lands as the dossier appears (a double tap on the depth): a real press comes after a moment.
    await sleep(650);
    await click('[data-dungeon-start="1"]');
    await wait('Boolean(document.querySelector(".dungeon-map .room.open"))');
    assert.equal(await evaluate('document.querySelector("#modal").open'), false, 'Descend closes the dossier');
    assert.equal(await evaluate('document.activeElement?.matches(".dungeon-scene .room.open")'), true, 'the keyboard lands on the map\'s first open room');
    assert.ok(await evaluate('document.querySelectorAll(".dungeon-map .room").length') >= 12, 'map has rooms');
    await screenshot(`artifacts/dungeon-map-${viewport.tag}.png`);

    // The run's party is locked: the party screen marks the heroes below and a toggle only explains why.
    const runParty = await evaluate('window.gridbound.profile().journey.run.party');
    await click.nav('party');
    await wait('Boolean(document.querySelector(".story-party.locked[open] [data-story-toggle]"))');
    assert.ok(await evaluate('[...document.querySelectorAll("[data-story-toggle]")].filter(b => b.textContent.includes("In the Undercroft")).length') === runParty.length, 'run heroes are marked In the Undercroft');
    const storyActive = await evaluate('window.gridbound.profile().storyActive');
    await click(`[data-story-toggle="${runParty[0]}"]`);
    await wait('document.querySelector("#town-notice")?.textContent.includes("The party is in the Undercroft")');
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'), storyActive, 'the story party did not change mid-run');
    await click.nav('camp');
    await click('.town-spot[data-facility="dungeon"]');
    await wait('Boolean(document.querySelector(".dungeon-map .room.open"))');

    // Walk rooms until a fight has been won (resolving events, treasure and camps on the way).
    const saveState = '(() => { const p = window.gridbound.profile(), run = p.journey.run; return { xp: p.loadouts[0].xp, wins: p.wins, pouch: run?.pouch.gold, materials: run?.pouch.materials, at: run?.at, status: run?.status, pending: Boolean(run?.pendingFight) }; })()';
    const reloadToDungeon = async () => {
      await send('Page.reload');
      await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
      await click('.town-spot[data-facility="dungeon"]');
      await wait('Boolean(document.querySelector(".dungeon-scene"))');
    };
    // Resolve events, treasure and camps until a fight is pending; false when the run ends first.
    let roomShot = false;
    const walkToFight = async () => {
      for (let step = 0; step < 12; step++) {
        if (await evaluate('window.gridbound.profile().journey.run?.status') !== 'active') return false;
        if (await evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))')) return true;
        for (const sel of ['[data-dungeon-choice]:not(:disabled)', '[data-dungeon-open]', '[data-dungeon-camp="rest"]']) {
          if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(sel)}))`)) {
            if (sel.includes('camp')) assert.match(await evaluate(`document.querySelector('[data-dungeon-camp="rest"]').textContent`), /25%/, 'the camp says its rest heals 25% (CAMP_REST)');
            await click(sel); await wait('Boolean(document.querySelector(".room-outcome")) || Boolean(document.querySelector("[data-dungeon-fight]"))', 5000).catch(() => {}); break; }
        }
        if (await evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))')) return true;
        const before = await evaluate('window.gridbound.profile().journey.run?.at');
        if (await evaluate('Boolean(document.querySelector(".dungeon-map .room.open"))')) {
          await click('.dungeon-map .room.open');
          await wait(`window.gridbound.profile().journey.run?.at !== ${before}`);
          // A tapped room's action (Fight, a choice, Open, Rest) is scrolled on screen, also on a phone.
          const action = await evaluate('(() => { const b = document.querySelector(".room-panel .btn"); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; })()');
          if (action) assert.ok(action.top >= 0 && action.bottom <= action.vh, `the room action is inside the viewport (${JSON.stringify(action)})`);
          if (!roomShot) { roomShot = true; await screenshot(`artifacts/dungeon-room-${viewport.tag}.png`); }
        }
      }
      return false;
    };
    const resultReady = 'Boolean(document.querySelector("#result-dungeon")) && !document.querySelector("#result-dungeon").disabled';
    const fight = async (win, shot, failSave = false) => {
      await click('[data-dungeon-fight]');
      await wait('window.gridbound.battle.mode === "dungeon" && ["ready", "fighting"].includes(window.gridbound.battle.status)', 15000);
      if (await evaluate('window.gridbound.battle.status === "ready"')) { await wait('Boolean(document.querySelector("#start:not([hidden]):not(:disabled)"))'); await click('#start'); }
      await wait('window.gridbound.battle.status === "fighting"');
      if (shot) await screenshot(`artifacts/dungeon-fight-${viewport.tag}.png`);
      if (failSave) { await wait('document.querySelector("#storage-status").textContent.startsWith("Saved")'); await evaluate("localStorage.setItem('qa.failPut', '1')"); }
      await evaluate(win ? 'for (const e of window.gridbound.battle.enemies ?? []) e.hp = 0; window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)' : 'for (const h of window.gridbound.battle.heroes) h.hp = 0; window.gridbound.step(.05)');
      await wait(failSave ? 'Boolean(document.querySelector("dialog[open] #retry-save"))' : resultReady, 15000);
    };
    let fights = 0;
    const startXp = await evaluate('window.gridbound.profile().loadouts[0].xp');
    while (fights < 2 && await walkToFight()) {
      // On mobile the first result's save fails: retry/export is offered, and the retry saves the outcome without settling the fight twice.
      const failSave = fights === 0 && viewport.mobile;
      await fight(true, fights === 0, failSave);
      if (failSave) {
        const pending = await evaluate(saveState);
        await screenshot(`artifacts/dungeon-unsaved-${viewport.tag}.png`);
        assert.equal(await evaluate('Boolean(document.querySelector("dialog[open] #pending-export"))'), true, 'the unsaved result can be exported');
        await evaluate("localStorage.removeItem('qa.failPut')");
        await click('#retry-save');
        await wait(resultReady, 15000);
        assert.deepEqual(await evaluate(saveState), pending, 'a retry saves the same outcome once');
      }
      if (fights === 0) {
        assert.ok(await evaluate('document.querySelectorAll(".dungeon-hp-list li").length') >= 1, 'the result lists each hero\'s HP before → after');
        assert.match(await evaluate('document.querySelector(".dungeon-hp-list li small").textContent'), /\d+% → \d+%/);
        await screenshot(`artifacts/dungeon-result-${viewport.tag}.png`);
        // The room's outcome is saved the moment its result appears: reloading on the result screen keeps the XP, pouch and win.
        const won = await evaluate(saveState);
        assert.ok(won.xp > startXp && won.wins === 4 && won.pouch > 0 && !won.pending, 'the win is settled');
        await reloadToDungeon();
        assert.deepEqual(await evaluate(saveState), won, 'a reload on the dungeon result keeps the XP, pouch and win');
      } else {
        await click('#result-dungeon');
        await wait('Boolean(document.querySelector(".dungeon-scene"))');
      }
      fights++;
    }
    assert.ok(fights >= 1, 'won at least one dungeon fight');
    const run = await evaluate('window.gridbound.profile().journey.run');
    assert.ok(run.pouch.gold > 0, 'fights fill the pouch');
    assert.ok(Object.values(run.hp).every(v => v > 0 && v <= 1), 'carried HP is a ratio');
    await screenshot(`artifacts/dungeon-progress-${viewport.tag}.png`);

    // Fleeing a fight in progress: confirm, wounds and potions used are kept, half the pouch is lost, the fight waits, back on the Undercroft.
    assert.ok(await walkToFight(), 'a fight to flee from');
    const runState = 'window.gridbound.profile().journey.run';
    const enterFight = async () => {
      await click('[data-dungeon-fight]');
      await wait('window.gridbound.battle.mode === "dungeon" && window.gridbound.battle.status === "ready"', 15000);
      await wait('Boolean(document.querySelector("#start:not([hidden]):not(:disabled)"))'); await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
    };
    const preFlee = await evaluate(runState);
    await enterFight();
    assert.deepEqual((await evaluate('window.gridbound.battle.heroes.map(h => h.id)')).sort(), [...preFlee.party].sort(), 'the fight fields the run party');
    assert.equal(await evaluate('document.querySelector("#retreat").textContent'), 'Flee the room…', 'the retreat button says what it does here');
    await evaluate('for (const h of window.gridbound.battle.heroes) if (h.hp > 0) h.hp = Math.max(1, Math.round(h.maxHp * .5)); window.gridbound.battle.potions = Math.max(0, window.gridbound.battle.potions - 1)');
    await click.retreat();
    await wait('Boolean(document.querySelector("dialog[open] #dungeon-flee"))');
    await screenshot(`artifacts/dungeon-flee-${viewport.tag}.png`);
    const atFlee = await evaluate('({ hp: Object.fromEntries(window.gridbound.battle.heroes.map(h => [h.id, h.hp / h.maxHp])), potions: window.gridbound.battle.potions })');
    await click('#dungeon-flee');
    await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "dungeon" && Boolean(document.querySelector("[data-dungeon-fight]"))');
    const fled = await evaluate(runState);
    assert.deepEqual(fled.hp, atFlee.hp, 'wounds carry over'); assert.equal(fled.potions, atFlee.potions, 'potions used stay used');
    assert.equal(fled.pouch.gold, Math.floor(preFlee.pouch.gold / 2), 'half the pouch is lost');
    assert.deepEqual(fled.pendingFight, { kind: preFlee.pendingFight.kind, enemy: preFlee.pendingFight.enemy }, 'the fight waits, no longer in progress');
    assert.match(await evaluate('document.querySelector("#town-notice").textContent'), /You fled the room/);

    // A reload mid-fight is a flee too: the saved in-progress flag resolves with a wound and half the pouch when the
    // Undercroft opens (not at boot, so a second tab cannot flee this one's fight). A hero who fell before the reload
    // was noted and saved, so the reload cannot bring them back.
    await enterFight();
    await wait('window.gridbound.profile().journey.run.pendingFight?.started === true');
    const fallen = await evaluate('(() => { const h = window.gridbound.battle.heroes.find(h => h.hp > 0); h.hp = 0; window.gridbound.step(.05); return h.id; })()');
    await wait(`window.gridbound.profile().journey.run.pendingFight?.seen?.hp[${fallen}] === 0`);
    await evaluate('window.gridbound.battle.pause()');
    await new Promise(resolve => setTimeout(resolve, 600));
    await wait('document.querySelector("#storage-status").textContent.startsWith("Saved")', 10000);
    const seen = (await evaluate(runState)).pendingFight.seen;
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
    assert.equal(await evaluate(`${runState}.pendingFight?.started`), true, 'booting alone does not settle the fight');
    await click('.town-spot[data-facility="dungeon"]');
    await wait('Boolean(document.querySelector(".dungeon-scene"))');
    const interrupted = await evaluate(runState);
    assert.equal(interrupted.pendingFight?.started, undefined, 'the interrupted fight is resolved');
    assert.equal(interrupted.pouch.gold, Math.floor(fled.pouch.gold / 2), 'a reload costs half the pouch');
    assert.equal(interrupted.hp[fallen], 0, 'a hero who fell before the reload stays down');
    assert.equal(interrupted.potions, Math.min(fled.potions, seen.potions), 'potions used before the reload stay used');
    for (const id of fled.party) assert.ok(Math.abs(interrupted.hp[id] - Math.min(fled.hp[id] > 0 ? Math.max(.05, fled.hp[id] - .25) : 0, seen.hp[id] ?? 1)) < 1e-9, `hero ${id} takes the worse of the noted HP and the interrupted-fight wound`);
    assert.match(await evaluate('document.querySelector(".room-outcome")?.textContent ?? ""'), /cut short/, 'the Undercroft says why');
    await screenshot(`artifacts/dungeon-interrupted-${viewport.tag}.png`);

    // Phone contract C1/C4: the page going to the background (another app, a locked screen) pauses the fight and saves its state at once with
    // a background stamp; when the OS then discards the tab (the next load comes a minute or more after the hide), the room waits at the
    // noted HP and potions and the pouch stays: no flee. (The hide is stamped 61 s in the past, as if the phone had sat that long.)
    await enterFight();
    await wait('window.gridbound.profile().journey.run.pendingFight?.started === true');
    await evaluate('for (const h of window.gridbound.battle.heroes) if (h.hp > 0) h.hp = Math.max(1, Math.round(h.maxHp * .6))');
    const beforeHide = await evaluate(runState);
    await evaluate(`(() => { const now = Date.now; Date.now = () => now() - 61000; Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return true; })()`);
    await wait('window.gridbound.battle.status === "paused" && Boolean(window.gridbound.profile().journey.run.pendingFight?.hiddenAt)');
    await wait('document.querySelector("#storage-status").textContent.startsWith("Saved")', 10000);
    const atHide = (await evaluate(runState)).pendingFight;
    for (const id of beforeHide.party) if (beforeHide.hp[id] > 0) assert.ok(Math.abs(atHide.seen.hp[id] - .6) < .02, `hero ${id}'s HP was noted at the hide`);
    await send('Page.reload');
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
    await click('.town-spot[data-facility="dungeon"]');
    await wait('Boolean(document.querySelector(".dungeon-scene"))');
    const discarded = await evaluate(runState);
    assert.deepEqual(discarded.pouch, beforeHide.pouch, 'a background discard keeps the whole pouch');
    for (const id of beforeHide.party) assert.equal(discarded.hp[id], atHide.seen.hp[id], `hero ${id} keeps the HP noted at the hide, with no extra wound`);
    assert.equal(discarded.potions, atHide.seen.potions, 'potions as noted');
    assert.deepEqual(discarded.pendingFight, { kind: beforeHide.pendingFight.kind, enemy: beforeHide.pendingFight.enemy }, 'the fight waits in the room');
    assert.match(await evaluate('document.querySelector(".room-outcome")?.textContent ?? ""'), /closed in the background/, 'the Undercroft says the game closed in the background');
    await screenshot(`artifacts/dungeon-background-${viewport.tag}.png`);

    // Abandon keeps nothing from the pouch.
    const gold = await evaluate('window.gridbound.profile().gold');
    await click('[data-dungeon-leave]');
    await wait('Boolean(document.querySelector("#dungeon-abandon"))');
    await click('#dungeon-abandon');
    await wait('document.querySelectorAll(".depth-card").length === 8');
    assert.equal(await evaluate('window.gridbound.profile().gold'), gold, 'abandoning banks nothing');

    // A wipe is saved with its result too: reloading cannot bring the run or the pouch back.
    await click('[data-dungeon-pick="1"]');
    await wait(dossier);
    await sleep(650);
    await click('[data-dungeon-start="1"]');
    await wait('Boolean(document.querySelector(".dungeon-map .room.open"))');
    assert.ok(await walkToFight(), 'the new run reaches a fight');
    const wipePouch = await evaluate(`${runState}.pouch`);
    await fight(false, false);
    if (wipePouch.gold > 0 || Object.keys(wipePouch.materials).length) assert.match(await evaluate('document.querySelector(".dungeon-lost")?.textContent ?? ""'), /^Lost: /, 'a wipe says what the pouch lost');
    else assert.equal(await evaluate('Boolean(document.querySelector(".dungeon-lost"))'), false, 'an empty pouch loses nothing worth a line');
    const wiped = await evaluate(saveState);
    assert.deepEqual({ status: wiped.status, pouch: wiped.pouch, pending: wiped.pending }, { status: 'wiped', pouch: 0, pending: false });
    await reloadToDungeon();
    assert.deepEqual(await evaluate(saveState), wiped, 'the run stays wiped after a reload');
    assert.equal(await evaluate('Boolean(document.querySelector(".dungeon-result.wiped [data-dungeon-close]"))'), true, 'the Undercroft shows the wipe');
    await click('[data-dungeon-close]');
    await wait('document.querySelectorAll(".depth-card").length === 8');

    // The camp: Rest names its heal, says it closes the way out and Extract ends the run; after Rest the outcome says what it did.
    // A run walked to the room before the camp row (seeded), one hero down.
    const campSeed = `(async () => { const { startRun, CAMP_ROW } = await import('/src/game/dungeon.ts'); const run = startRun(1, 4242, [0, 4, 3]);
      let at = run.nodes.find(n => n.row === 0); run.visited.push(at.id); at.done = true;
      while (at.row < CAMP_ROW - 1) { at = run.nodes[at.next[0]]; run.visited.push(at.id); at.done = true; }
      run.at = at.id; run.hp = { 0: .5, 4: 0, 3: .8 }; run.pouch = { gold: 120, materials: { 'ember-shard': 2 } };
      indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify({ ...${JSON.stringify(qaProfile)}, journey: { ...${JSON.stringify(qaProfile.journey)}, run } })); return run; })()`;
    const campRun = await evaluate(campSeed);
    await reloadToDungeon();
    await click('.dungeon-map .room.room-camp.open');
    await wait('Boolean(document.querySelector("[data-dungeon-camp=rest]"))');
    assert.equal(await evaluate('document.querySelector("[data-dungeon-camp=rest]").textContent'), 'Rest: heal 25% and wake the fallen');
    assert.equal(await evaluate('document.querySelector("[data-dungeon-camp=extract]").textContent'), 'Extract now with the pouch (ends the run)');
    assert.match(await evaluate('document.querySelector(".room-panel").innerText'), /serves one choice[^]*no climbing out until the guardian falls/, 'the camp says Rest closes the way out');
    await screenshot(`artifacts/dungeon-camp-${viewport.tag}.png`);
    await click('[data-dungeon-camp="rest"]');
    await wait('Boolean(document.querySelector(".room-outcome"))');
    assert.equal(await evaluate('document.querySelectorAll(".dungeon-hud .dungeon-hero.down").length'), 0, 'nobody is down after the rest');
    const rested = await evaluate('window.gridbound.profile().journey.run.hp');
    assert.deepEqual(rested, { 0: .75, 4: .25, 3: 1 }, 'the rest heals 25% (capped at full) and wakes the fallen at 25%');
    assert.match(await evaluate('document.querySelector(".room-outcome").textContent'), /^The party rests by the fire: \+25% HP each, up to full\. \S+ stands again at 25% HP\.$/, 'the outcome names the heal and who got up');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-dungeon-camp]"))'), false, 'the fire served its one choice');
    await screenshot(`artifacts/dungeon-camp-rested-${viewport.tag}.png`);

    // A cleared depth whose next stair waits behind a chapter says so on the map (as its result did), not that the stair opens.
    const clearedSave = { ...qaProfile, cleared: [0, 1], journey: { ...qaProfile.journey, depth: 1, run: { ...campRun, status: 'cleared' } } };
    await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(clearedSave))})`);
    await reloadToDungeon();
    await wait('Boolean(document.querySelector(".dungeon-result.cleared"))');
    assert.equal(await evaluate('document.querySelector(".dungeon-end-text").textContent'), 'The guardian falls. The next stair waits behind Chapter 3. Everything in the pouch is yours.');
    await screenshot(`artifacts/dungeon-cleared-wait-${viewport.tag}.png`);
    await click('[data-dungeon-close]');
    await wait('document.querySelectorAll(".depth-card").length === 8');

    // A run whose party differs from the story party (late recruits join storyActive mid-run): the fight fields the
    // run's party, and its wipe names what the pouch lost.
    const drifted = { ...qaProfile, storyActive: [0, 4, 3, 2], journey: { ...qaProfile.journey, run: { depth: 1, seed: 4242, rng: 7, party: [0, 4, 3], hp: { 0: 1, 4: .6, 3: 1 }, potions: 2, pouch: { gold: 80, materials: { 'ember-shard': 2 } }, blessing: { power: 1, vitality: 1 }, status: 'active', layout: 2, at: 0, visited: [0] } } };
    await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', ${JSON.stringify(JSON.stringify(drifted))})`);
    await reloadToDungeon();
    await wait('Boolean(document.querySelector("[data-dungeon-fight]"))');
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'), [0, 4, 3, 2]);
    await enterFight();
    assert.deepEqual(await evaluate('window.gridbound.battle.heroes.map(h => h.id).sort()'), [0, 3, 4], 'the fight fields the run party, not the story party');
    await evaluate('for (const h of window.gridbound.battle.heroes) h.hp = 0; window.gridbound.step(.05)');
    await wait(resultReady, 15000);
    assert.equal(await evaluate('document.querySelector(".dungeon-lost")?.textContent'), 'Lost: 80G, Ember Shard ×2', 'a wipe names what the pouch lost');
    await screenshot(`artifacts/dungeon-wipe-${viewport.tag}.png`);
    await click('#result-dungeon');
    await wait('Boolean(document.querySelector(".dungeon-result.wiped [data-dungeon-close]"))');
    await click('[data-dungeon-close]');
    await wait('document.querySelectorAll(".depth-card").length === 8');

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
