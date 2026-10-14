// The navigation contract, screen by screen (scratch NAV-CONTRACT §10/§11): on every screen the top-most layer shows a visible, labelled exit
// ([data-nav-exit] with a word, ≥ 44px, on screen, not covered); Escape and the browser/phone Back (history.back()) perform the same one Back
// step (navState() before/after) without leaving the page (same URL, same document, no history growth); the bare title screen is the only
// place where Back leaves. Runs at 390×844 (touch) and 1280×900, then once with navigator.webdriver spoofed for the title, the chapter intro
// and the unlock card (automation skips them). Screenshots of failures go to artifacts/nav-browser/.
import assert from 'node:assert/strict';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const URL = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const OUT = 'artifacts/nav-browser';
const SPOOF = "Object.defineProperty(navigator, 'webdriver', { get: () => false })";
// Saves fail while localStorage['qa.failPut'] is set (the 'Not saved' result dialog).
const FAIL_PUT = "{ const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (localStorage.getItem('qa.failPut')) throw new DOMException('QA quota exceeded', 'QuotaExceededError'); return put.apply(this, args); }; }";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const only = process.env.NAV_ONLY; // 'phone' | 'desktop' | 'spoof'
const VIEWPORTS = [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'desktop', width: 1280, height: 900, mobile: false }];
let checked = 0;

/** The top layer's exit controls, measured: [{text, sel, ok, why}]. `selector` overrides the layer's own [data-nav-exit] set (the camp's MENU). */
const EXITS = selector => `(() => {
  const s = window.gridbound.navState();
  const root = { scene: document.querySelector('.dialogue-scene:not(.closing)'), modal: document.querySelector('#modal'), picker: document.querySelector('#battle-screen'), result: document.querySelector('#result-screen'), battle: document.querySelector('#battle-screen'), town: document.body, title: document.querySelector('#title-screen') }[s.layer];
  const list = ${selector ? `[...document.querySelectorAll(${JSON.stringify(selector)})]` : `[...root.querySelectorAll('[data-nav-exit]')]`};
  return list.map(el => {
    const r = el.getBoundingClientRect(), style = getComputedStyle(el), text = (el.innerText || '').trim();
    const shown = r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && !el.closest('[hidden],[inert]') && !el.disabled;
    const hit = shown && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const why = [!shown && 'hidden', !/\\p{L}{2,}/u.test(text) && 'no word', (r.width < 44 || r.height < 44) && 'under 44px', (r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) && 'off screen', shown && !(hit && (hit === el || el.contains(hit))) && 'covered', parseFloat(style.fontSize) < 12 && 'under 12px'].filter(Boolean);
    return { text: text.slice(0, 40), exit: el.dataset.navExit ?? el.id, why };
  });
})()`;

async function run(viewport, { spoof = false } = {}) {
  await withBrowser(async ({ send, evaluate, wait, click, key, screenshot, errors }) => {
    const tag = spoof ? `spoof-${viewport.name}` : viewport.name;
    if (spoof) await send('Page.addScriptToEvaluateOnNewDocument', { source: SPOOF });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: FAIL_PUT });
    await seedSave(send, ACT_TWO_SAVE, 'en');
    // The page the player came from: history.back() at the bare title lands here.
    await send('Page.navigate', { url: 'data:text/html,previous-page' }); await sleep(300);
    await send('Page.navigate', { url: URL });
    await wait('Boolean(window.gridbound?.navState)', 20000);
    await evaluate('window.__navProbe = 1');
    const nav = () => evaluate('window.gridbound.navState()');
    const route = () => evaluate('document.querySelector(".town-game-shell")?.dataset.townRoute ?? ""');
    const shot = async name => { await screenshot(`${OUT}/${tag}-${name.replace(/[^\w-]+/g, '-')}.png`).catch(() => {}); };
    const fail = async (name, message) => { await shot(name); throw new Error(`[${tag}] ${name}: ${message}`); };
    /** Wait for navState to satisfy `expect` (a predicate source over `s`). */
    // A skipped scene fades for a moment and a battle opens with a wipe: wait until nothing is left over the screen.
    const waitNav = async (name, expect, what) => { try { await wait(`(s => ${expect})(window.gridbound.navState()) && !document.querySelector('.dialogue-scene.closing, .battle-wipe')`, 6000); } catch { await fail(name, `${what} gave ${JSON.stringify(await nav())}, expected ${expect}`); } };
    const exitsOk = async (name, selector) => {
      const exits = await evaluate(EXITS(selector));
      if (!exits.some(e => !e.why.length)) await fail(name, `no usable labelled exit: ${JSON.stringify(exits)}`);
      if (await evaluate('document.documentElement.scrollWidth > innerWidth + 1')) await fail(name, 'horizontal page scroll');
    };
    const tclick = async (name, selector) => { try { await click(selector); } catch (error) { await fail(name, `cannot click ${selector}: ${error.message}`); } };
    /**
     * One screen: reach it (`enter`, from where the previous Back left), check its exits, press Escape and expect the Back step's result;
     * reach it again and expect history.back() to do the same, in the same document, with the same URL and history length.
     * `at`: the screen is already showing (enter is skipped). `exit`: a selector for the root (the camp's MENU).
     */
    const screen = async (name, { at, enter, expect, exit, esc = true, history = true }) => {
      const reach = async () => { if (at && await evaluate(`(s => ${at})(window.gridbound.navState())`)) return; await enter(); await sleep(250); if (at) await waitNav(name, at, 'reaching the screen'); };
      await reach();
      await exitsOk(name, exit);
      if (esc) { await key('Escape'); await waitNav(name, expect, 'Escape'); await sleep(150); await reach(); }
      if (history) {
        const before = await evaluate('[location.href, history.length]');
        await evaluate('history.back(), true');
        await waitNav(name, expect, 'history.back()');
        await sleep(150);
        const after = await evaluate('[location.href, history.length, window.__navProbe]');
        if (after[0] !== before[0] || after[1] !== before[1] || after[2] !== 1) await fail(name, `history.back() left the game or grew the history: ${JSON.stringify([before, after])}`);
      }
      checked++;
    };
    const kill = async (who) => { await evaluate(who === 'boss' ? 'window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)' : 'window.gridbound.battle.heroes.forEach(h => { h.hp = 0; }); window.gridbound.step(.1)'); };
    const resultReady = 'document.querySelector("#result-screen:not([hidden]) [data-nav-exit=return]") && !document.querySelector("#result-screen [data-nav-exit=return]").disabled';
    const closeModal = async () => { if (await evaluate('document.querySelector("#modal").open')) { await evaluate('document.querySelector("#modal [data-close]:not(.modal-close)")?.click() ?? document.querySelector("#modal").close()'); await sleep(200); } };
    const toMenu = async () => { if (await route() !== 'more') { await click('#menu-button'); await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "more"'); } };
    const toGate = async tab => {
      if (await route() !== 'campaign' && await route() !== tab) { await click.nav('camp'); await click('.town-spot[data-facility="campaign"]'); await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "campaign"'); }
      if (tab !== 'campaign' && await route() !== tab) await click(`.expedition-mode-nav [data-facility="${tab}"]`);
      await wait(`document.querySelector(".town-game-shell")?.dataset.townRoute === ${JSON.stringify(tab)}`);
    };

    if (spoof) {
      // ---- The front door, the chapter intro and the unlock card, as a real player meets them.
      await wait('document.querySelector("#title-screen.press-phase") !== null');
      let s = await nav();
      assert.equal(s.layer, 'title'); assert.equal(s.guard.armed, false, 'no guard before the player has interacted');
      await click('#title-screen'); await wait('!document.querySelector("#title-screen").classList.contains("press-phase")');
      await sleep(200);
      assert.equal((await nav()).guard.armed, false, 'the bare title wants no guard');
      await key('Escape'); await sleep(300);
      assert.equal((await nav()).layer, 'title', 'Escape on the title screen does nothing');
      for (const [name, button] of [['title Save files', '#title-profiles'], ['title Journal', '#title-journal'], ['title Config', '#title-settings']])
        await screen(name, { at: 's.layer === "modal"', enter: () => tclick(name, button), expect: 's.layer === "title"' });
      // A Journal replay from the title: Back skips the scene, the Journal reopens on its own (no tap) and the next Back closes it — never the page.
      assert.equal((await nav()).guard.armed, false, 'the bare title again: no guard');
      await tclick('title Journal', '#title-journal'); await wait('Boolean(document.querySelector("#modal .journal-entry-card[data-chapter=\\"1\\"]"))');
      await evaluate('document.querySelector("#modal .journal-entry-card[data-chapter=\\"1\\"]").open = true');
      await tclick('title Journal replay', '#modal .journal-entry-card[data-chapter="1"] [data-replay-chapter]');
      await waitNav('title Journal replay', 's.layer === "scene"', 'a replay');
      await evaluate('history.back(), true');
      await waitNav('title Journal replay', 's.layer === "modal" && s.guard.armed', 'history.back() during the replay');
      await evaluate('history.back(), true');
      await waitNav('title Journal (reopened)', 's.layer === "title" && !s.modal', 'history.back() on the reopened Journal');
      if (await evaluate('window.__navProbe') !== 1) await fail('title Journal (reopened)', 'Back on the reopened Journal left the game');
      checked++;
      await tclick('enter', '#title-enter'); await wait('document.querySelector("#title-screen").hidden', 5000);
      // Entering the camp arms the guard although the title only fades out after the tap: the very first Back shows the title, not the previous page.
      await waitNav('camp after Enter', 's.layer === "town" && s.guard.armed', 'Enter Emberhollow');
      await evaluate('history.back(), true'); await waitNav('camp after Enter', 's.layer === "title"', 'history.back() right after Enter Emberhollow');
      if (await evaluate('window.__navProbe') !== 1) await fail('camp after Enter', 'Back right after Enter Emberhollow left the game');
      checked++;
      await tclick('enter', '#title-enter'); await wait('document.querySelector("#title-screen").hidden', 5000);
      // The unlock card (Undercroft, Raids, Bell Trials): Later is its text exit, Escape and Back mean Later.
      await screen('unlock card', { at: 's.layer === "modal"', enter: async () => { await evaluate('window.gridbound.unlockIntro(true)'); }, expect: 's.layer === "town" && s.route === "camp"' });
      // A first departure plays the chapter intro: Skip, Escape and Back skip it, onto a ready window whose Back is free.
      await toGate('campaign'); await tclick('dossier', '.map-selected [data-mission]'); await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "mission"');
      // ACT_TWO_SAVE deploys 3 of 6 heroes: a real player is asked about the free slots first (Fill party, Depart anyway, Cancel);
      // Escape and Back cancel it and stay on the dossier.
      await screen('empty party slots', { at: 's.layer === "modal"', enter: () => tclick('depart', '[data-depart="adventure"]'), expect: 's.layer === "town" && s.route === "mission"' });
      await tclick('depart', '[data-depart="adventure"]'); await wait('Boolean(document.querySelector("dialog[open] #empty-go"))');
      await tclick('depart anyway', '#empty-go');
      await wait('Boolean(document.querySelector(".dialogue-scene"))', 5000);
      await exitsOk('chapter intro');
      await key('Escape'); await waitNav('chapter intro', 's.layer === "battle" && s.battle.status === "ready" && s.battle.freeBack', 'Escape');
      await screen('chapter intro (replay)', { at: 's.layer === "scene"', enter: () => evaluate('void window.gridbound.chapterIntro(4)'), expect: 's.layer === "battle" && s.battle.status === "ready"', esc: false });
      await shot('ready-after-intro');
      // Back twice after a departure: the dossier, nothing spent.
      await evaluate('history.back(), true'); await waitNav('ready free', 's.layer === "town" && s.route === "mission"', 'history.back() on the ready window');
      await evaluate('history.back(), true'); await waitNav('dossier', 's.layer === "town" && s.route === "campaign"', 'history.back() on the dossier');
      // Camp → Back is the title screen; Back on the bare title leaves the page (to the page the player came from).
      await click.nav('camp');
      await evaluate('history.back(), true'); await waitNav('camp', 's.layer === "title"', 'history.back() at the camp');
      await evaluate('history.back(), true');
      await wait('location.protocol === "data:"', 6000).catch(() => fail('bare title', 'history.back() on the bare title did not leave the game'));
      checked++;
      return;
    }

    // ---- The history guard: none before a real activation, exactly one after it.
    const first = await nav();
    assert.equal(first.layer, 'town'); assert.equal(first.guard.armed, false, 'no guard before a user activation');
    await tclick('menu', '#menu-button'); await wait('window.gridbound.navState().guard.armed');
    const armedLength = (await nav()).guard.length;
    assert.equal(armedLength, first.guard.length + 1, 'one guard entry after the first activation');
    await click('#menu-button'); await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "camp"');

    // ---- Town routes.
    const leaveTitle = async () => { if ((await nav()).layer === 'title') await tclick('camp', '#title-enter'); await wait('document.querySelector("#title-screen").hidden'); };
    await screen('camp', { at: 's.layer === "town" && s.route === "camp" && !s.modal', enter: leaveTitle, expect: 's.layer === "title"', exit: '#menu-button' });
    await leaveTitle();
    await screen('MENU', { at: 's.route === "more"', enter: () => tclick('MENU', '#menu-button'), expect: 's.route === "camp" && s.layer === "town"' });
    for (const [name, facility] of [['Quests', 'quests'], ['Bestiary', 'bestiary'], ['Party', 'party'], ['Jobs', 'party-advanced'], ['Crystal Exchange', 'challenge-shop']])
      await screen(name, { at: `s.route === ${JSON.stringify(facility)}`, enter: async () => { await toMenu(); await tclick(name, `.more-scene [data-facility="${facility}"]`); }, expect: 's.route === "more" && s.layer === "town"' });
    await screen('Bestiary detail', { at: 's.route === "bestiary"', enter: async () => { await toMenu(); await tclick('Bestiary', '.more-scene [data-facility="bestiary"]'); await wait('Boolean(document.querySelector("[data-bestiary-pick]"))'); await evaluate('document.querySelector("[data-bestiary-pick]").click()'); }, expect: 's.route === "more"' });
    await screen('Party → Jobs switch', { at: 's.route === "party-advanced"', enter: async () => { await toMenu(); await tclick('Party', '.more-scene [data-facility="party"]'); await tclick('Jobs', '.party-advanced-link'); }, expect: 's.route === "more"' });
    await screen('Config (town)', { at: 's.layer === "modal"', enter: () => tclick('Config', '#settings'), expect: 's.layer === "town" && !s.modal' });
    await screen('Save files', { at: 's.layer === "modal"', enter: async () => { await toMenu(); await tclick('Save', '.more-scene [data-open-action="profiles"]'); await wait('Boolean(document.querySelector("#modal [data-load-slot]"))'); }, expect: 's.layer === "town" && !s.modal' });
    await screen('Save files → load preview', { at: 's.layer === "modal" && !!document.querySelector("#load-confirm")', enter: async () => { if (!await evaluate('document.querySelector("#modal").open')) { await toMenu(); await tclick('Save', '.more-scene [data-open-action="profiles"]'); } await wait('Boolean(document.querySelector("#modal [data-load-slot=auto]:not([disabled])"))'); await tclick('load', '#modal [data-load-slot="auto"]'); }, expect: 's.layer === "modal" && !!document.querySelector("#modal [data-load-slot]")' });
    await closeModal();
    await screen('Journal', { at: 's.layer === "modal"', enter: async () => { await toMenu(); await tclick('Journal', '.more-scene [data-open-action="journal"]'); }, expect: 's.layer === "town" && !s.modal' });
    // A replay from the Journal comes back to the Journal as it was (the same chapter open), not to the MENU.
    await toMenu(); await tclick('Journal', '.more-scene [data-open-action="journal"]');
    await wait('Boolean(document.querySelector("#modal .journal-entry-card[data-chapter=\\"1\\"]"))');
    await evaluate('document.querySelector("#modal .journal-entry-card[data-chapter=\\"1\\"]").open = true');
    await tclick('Journal replay', '#modal .journal-entry-card[data-chapter="1"] [data-replay-chapter]');
    await waitNav('Journal replay', 's.layer === "scene"', 'a replay');
    await exitsOk('Journal replay');
    await key('Escape');
    await waitNav('Journal replay', 's.layer === "modal" && !!document.querySelector("#modal .journal-entry-card[data-chapter=\\"1\\"][open]")', 'skipping the replay');
    checked++;
    await closeModal();
    await click.nav('camp');
    await screen('unlock card', { at: 's.layer === "modal"', enter: () => evaluate('window.gridbound.unlockIntro(true)'), expect: 's.layer === "town" && !s.modal' });
    await screen('join scene', { at: 's.layer === "scene"', enter: () => evaluate('void window.gridbound.recruitScene(1)'), expect: 's.layer === "town"' });
    await screen('Story map', { at: 's.route === "campaign"', enter: () => toGate('campaign'), expect: 's.route === "camp"' });
    await screen('dossier', { at: 's.route === "mission"', enter: async () => { await toGate('campaign'); await tclick('dossier', '.map-selected [data-mission]'); }, expect: 's.route === "campaign"' });
    for (const tab of ['raid', 'endless', 'dungeon']) await screen(`${tab} setup`, { at: `s.route === ${JSON.stringify(tab)}`, enter: () => toGate(tab), expect: 's.route === "camp"' });

    // ---- Story battle.
    const toDossier = async () => { if (await route() !== 'mission') { await toGate('campaign'); await tclick('dossier', '.map-selected [data-mission]'); await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "mission"'); } };
    const departStory = async () => { if (!(await nav()).battle) { await toDossier(); await tclick('depart', '[data-depart="adventure"]'); await wait('!window.gridbound.inTown'); } };
    await screen('Story ready (free)', { at: 's.layer === "battle" && s.battle.status === "ready"', enter: departStory, expect: 's.layer === "town" && s.route === "mission"' });
    // A free Back dropped the departure: the next one is fresh (not 'Resuming…'), from the current party.
    await departStory();
    assert.equal(await evaluate('document.querySelector("#ready-copy").textContent.startsWith("Resuming")'), false, 'a free Back leaves no checkpoint to resume');
    const fighting = async () => { await departStory(); await closeModal(); if ((await nav()).battle.status === 'ready') await tclick('fight', '#start'); await wait('window.gridbound.battle.status === "fighting"'); };
    await screen('Story fighting', { at: 's.layer === "battle" && s.battle.status === "fighting"', enter: fighting, expect: 's.layer === "modal" && s.modal === "PAUSE"' });
    await screen('pause menu', { at: 's.modal === "PAUSE"', enter: () => tclick('pause', '#pause'), expect: 's.layer === "battle" && s.battle.status === "fighting"' });
    for (const [name, button] of [['Pause → Controls', '#pause-help'], ['Pause → Config', '#pause-settings']])
      await screen(name, { at: 's.layer === "modal" && s.modal !== "PAUSE"', enter: async () => { if (!(await nav()).modal) await tclick('pause', '#pause'); await tclick(name, button); }, expect: 's.modal === "PAUSE" && s.battle.status === "paused"' });
    await closeModal();
    await screen('Story leave dialog', { at: 's.layer === "modal" && /^Leave CH/.test(s.modal)', enter: async () => { if (!(await nav()).modal) await tclick('pause', '#pause'); await tclick('leave', '#pause-retreat'); }, expect: 's.layer === "battle" && !s.modal' });
    for (const [name, view] of [['Status view', 'hero'], ['Log view', 'log']])
      await screen(name, { at: `s.battle.view === ${JSON.stringify(view)}`, enter: async () => { await closeModal(); await tclick(name, `.battle-view-tabs [data-battle-view="${view}"]`); }, expect: 's.layer === "battle" && s.battle.view === "arena"' });
    await screen('move mode', { at: 's.layer === "picker"', enter: async () => { if ((await nav()).battle.view !== 'hero') await tclick('Status', '.battle-view-tabs [data-battle-view="hero"]'); await tclick('move', '#move-selected'); }, expect: 's.layer === "battle" && s.battle.view === "hero"', exit: '#pause' });
    await key('Escape'); await waitNav('Status view', 's.battle.view === "arena"', 'Escape');
    // Battle 1 won: Return on the wave result opens the won-wave dialog (Save & suspend, Leave the chapter, Cancel).
    await kill('boss'); await wait(resultReady, 15000);
    await screen('wave clear', { at: 's.layer === "result"', enter: closeModal, expect: 's.layer === "modal" && s.modal === "Leave for now?"' });
    await screen('won-wave dialog', { at: 's.modal === "Leave for now?"', enter: () => tclick('wave leave', '#result-town'), expect: 's.layer === "result" && !s.modal' });
    await tclick('next', '#next-wave'); await wait('window.gridbound.battle.status === "ready"');
    await screen('Story ready (guarded)', { at: 's.layer === "battle" && s.battle.status === "ready" && !s.battle.freeBack', enter: closeModal, expect: 's.layer === "modal" && /^Leave CH/.test(s.modal)' });
    // Save & suspend at battle 2: the paused chapter's dossier shows its resume card; another chapter's Enter asks first (Resume focused).
    await closeModal(); await tclick('leave', '#ready-back'); await wait('Boolean(document.querySelector("#modal #suspend-run"))'); await tclick('suspend', '#suspend-run'); await wait('window.gridbound.inTown');
    await screen('dossier (paused chapter)', { at: 's.route === "mission" && !!document.querySelector(".resume-card[data-suspended-run=story]")', enter: toDossier, expect: 's.route === "campaign"' });
    const otherDossier = async () => { await toGate('campaign'); await tclick('act I', '[data-act="0"]'); await tclick('CH 4', '[data-zone="3"]'); await wait('Boolean(document.querySelector(".world-map-dossier [data-paused-note]"))'); };
    await screen('paused-chapter prompt', { at: 's.layer === "modal" && !!document.querySelector("#paused-resume")', enter: async () => { if (await route() !== 'mission') await otherDossier(); await tclick('enter', '.world-map-dossier [data-depart="adventure"]'); }, expect: 's.layer === "town" && s.route === "mission" && !s.modal' });
    assert.equal(await evaluate('(document.querySelector(".world-map-dossier [data-depart=adventure]").click(), document.activeElement?.id)'), 'paused-resume', 'the prompt focuses Resume');
    await tclick('resume', '#paused-resume'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready" && window.gridbound.battle.stage === 1');
    await tclick('fight', '#start'); await kill('heroes'); await wait(resultReady, 15000);
    await screen('Story defeat', { at: 's.layer === "result"', enter: async () => { await fighting(); await kill('heroes'); await wait(resultReady, 15000); }, expect: 's.layer === "town" && s.route === "mission"' });

    // ---- Raid: free Back to the setup, the raid leave dialog, a victory returning to the Raids setup, an unsaved outcome.
    const departRaid = async () => { if (!(await nav()).battle) { await toGate('raid'); await tclick('raid depart', '[data-depart="raid"]'); await wait('!window.gridbound.inTown'); } };
    await screen('Raid ready (free)', { at: 's.layer === "battle" && s.battle.status === "ready"', enter: departRaid, expect: 's.layer === "town" && s.route === "raid"' });
    await departRaid(); await tclick('fight', '#start'); await wait('window.gridbound.battle.status === "fighting"');
    await screen('Raid leave dialog', { at: 's.layer === "modal" && s.modal === "Leave this raid?"', enter: async () => { if (!(await nav()).modal) await tclick('pause', '#pause'); await tclick('leave', '#pause-retreat'); }, expect: 's.layer === "battle" && !s.modal' });
    // The outcome cannot be saved: the dialog blocks (no ×; Escape and Back keep it), its buttons are the way on.
    await evaluate('localStorage.setItem("qa.failPut", "1")'); await kill('boss');
    await wait('document.querySelector("#modal").open && window.gridbound.navState().blocking', 15000);
    await exitsOk('Not saved', '#modal #retry-save');
    for (const press of [() => key('Escape'), () => evaluate('history.back(), true')]) { await press(); await sleep(400); const s = await nav(); if (!s.blocking || s.layer !== 'modal' || await evaluate('location.protocol') === 'data:') await fail('Not saved', `a Back closed the blocking dialog: ${JSON.stringify(s)}`); }
    checked++;
    await evaluate('localStorage.removeItem("qa.failPut")'); await tclick('retry save', '#retry-save'); await wait(resultReady, 15000);
    await screen('Raid victory', { at: 's.layer === "result"', enter: async () => { await departRaid(); await closeModal(); if ((await nav()).battle.status === 'ready') await tclick('fight', '#start'); await kill('boss'); await wait(resultReady, 15000); }, expect: 's.layer === "town" && s.route === "raid"' });

    // ---- Bell Trials: the boon draft's 'Leave for now…' opens the run's leave dialog; Save & suspend keeps the draft for the setup's resume card.
    const draft = async () => { if (!(await nav()).battle) { await toGate('endless'); await tclick('trials depart', '[data-depart="endless"]'); await wait('!window.gridbound.inTown'); await tclick('fight', '#start'); await kill('boss'); await wait(resultReady, 15000); } };
    await screen('Bell Trials ready (free)', { at: 's.layer === "battle" && s.battle.status === "ready"', enter: async () => { await toGate('endless'); await tclick('trials depart', '[data-depart="endless"]'); }, expect: 's.layer === "town" && s.route === "endless"' });
    await screen('boon draft', { at: 's.layer === "result"', enter: async () => { await closeModal(); await draft(); }, expect: 's.layer === "modal" && s.modal === "Leave this Bell Trials run?"' });
    await screen('Bell Trials leave dialog', { at: 's.modal === "Leave this Bell Trials run?"', enter: () => tclick('draft leave', '#result-town'), expect: 's.layer === "result" && !s.modal' });
    await tclick('draft leave', '#result-town'); await wait('Boolean(document.querySelector("#modal #abandon-run"))');
    assert.equal(await evaluate('document.activeElement?.id'), 'suspend-run', 'the draft suspends like a battle: Save & suspend is focused');
    await tclick('suspend', '#suspend-run'); await wait('window.gridbound.inTown');
    await screen('Bell Trials setup (pending boon draft)', { at: 's.route === "endless" && !!document.querySelector(".resume-card[data-suspended-run=roguelike]")', enter: () => toGate('endless'), expect: 's.route === "camp"' });
    await toGate('endless'); await tclick('resume draft', '[data-depart="endless"][data-resume-run]'); await wait(resultReady, 15000);
    await tclick('draft leave', '#result-town'); await wait('Boolean(document.querySelector("#modal #abandon-run"))');
    await tclick('abandon', '#abandon-run'); await wait('window.gridbound.inTown');

    // ---- Undercroft: the run map's free 'Back to Emberhollow (run saved)', a room's free Back, the flee dialog.
    await toGate('dungeon'); await tclick('depth', '[data-dungeon-start="1"]'); await wait('Boolean(document.querySelector(".dungeon-run-exit"))');
    await screen('Undercroft run map', { at: 's.route === "dungeon"', enter: () => toGate('dungeon'), expect: 's.route === "camp"' });
    const room = async () => { if (!(await nav()).battle) { await toGate('dungeon'); if (!await evaluate('Boolean(document.querySelector("[data-dungeon-fight]"))')) await tclick('room', '.room.room-battle.open'); await tclick('fight room', '[data-dungeon-fight]'); await wait('!window.gridbound.inTown'); } };
    await screen('Undercroft room ready (free)', { at: 's.layer === "battle" && s.battle.status === "ready"', enter: room, expect: 's.layer === "town" && s.route === "dungeon"' });
    await room(); await tclick('fight', '#start'); await wait('window.gridbound.battle.status === "fighting"');
    assert.equal(await evaluate('(document.querySelector("#pause").click(), document.querySelector("#pause-retreat").textContent)'), 'Flee the room…');
    await screen('Undercroft flee dialog', { at: 's.layer === "modal" && s.modal === "Flee the room?"', enter: async () => { if (!(await nav()).modal) await tclick('pause', '#pause'); await tclick('flee', '#pause-retreat'); }, expect: 's.layer === "battle" && !s.modal && s.battle.status === "fighting"' });

    // ---- Another tab saves this Commander (a second repository commits it): this tab is read-only, and says so in a blocking dialog whose
    // labelled buttons (Reload, Download save backup, Keep viewing) are the way on; Escape and Back keep it.
    await evaluate(`(async () => { const { openCommanderRepository } = await import('/src/game/commander.ts'); const repository = await openCommanderRepository(); const doc = (await repository.list()).sort((a, b) => b.lastPlayed - a.lastPlayed)[0]; await repository.commit({ ...doc, name: 'Other tab' }, doc.revision); repository.close(); })()`);
    await wait('document.querySelector("#modal").open && window.gridbound.navState().blocking && Boolean(document.querySelector("#modal #stale-reload"))', 10000).catch(() => fail('stale dialog', 'another tab\'s save opened no blocking dialog'));
    await exitsOk('stale dialog', '#modal .leave-actions .btn');
    for (const press of [() => key('Escape'), () => evaluate('history.back(), true')]) { await press(); await sleep(400); const s = await nav(); if (!s.blocking || s.modal !== 'Opened in another tab' || await evaluate('location.protocol') === 'data:') await fail('stale dialog', `a Back closed the blocking dialog: ${JSON.stringify(s)}`); }
    await shot('stale-dialog');
    checked++;

    // ---- No history growth across all of that, and a reload keeps the one guard.
    const end = await nav();
    assert.equal(end.guard.length, armedLength, 'dozens of Backs never grew the history'); assert.equal(end.guard.armed, true);
    await send('Page.reload'); await wait('Boolean(window.gridbound?.navState)', 20000);
    const reloaded = await nav();
    assert.deepEqual([reloaded.guard.armed, reloaded.guard.length], [true, armedLength], 'a reload keeps the one guard it finds');
    const pageErrors = errors.filter(e => !/QA quota exceeded|Commander storage/.test(JSON.stringify(e)));
    assert.deepEqual(pageErrors.map(e => e.text ?? e.description ?? JSON.stringify(e).slice(0, 200)), [], 'no console errors');
  }, { width: viewport.width, height: viewport.height, mobile: viewport.mobile });
}

for (const viewport of VIEWPORTS) if (!only || only === viewport.name) await run(viewport);
if (!only || only === 'spoof') await run(VIEWPORTS[0], { spoof: true });
console.log(`navigation contract: ${checked} screens checked`);
