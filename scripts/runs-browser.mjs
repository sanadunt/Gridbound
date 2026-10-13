// Suspended runs keep what Save & suspend promises and never hijack a departure:
// - Story: a chapter left at battle 2 shows a resume card (camp guide, its dossier, a note on the Party screen and on every other dossier);
//   entering another chapter asks first (Resume focused, Abandon & enter, Cancel); Resume keeps the party it started with, Abandon & enter
//   starts the chosen chapter with the current party; Abandon on a card ends it. A reload at a fresh battle 1 ready window (before FIGHT!)
//   pauses nothing; a won wave left with Save & suspend resumes at the next battle's ready window.
// - Bell Trials: a boon draft left with Save & suspend or a reload is resumable from the setup with the same boons (also after a Fate Reroll),
//   the next floor keeps the boons and purse; Abandon on the card gives a fresh setup.
// Runs at 390×844 (touch) and 1280×900 in English, the Story checks again in Indonesian at 390×844 (screenshots of the camp guide, the dossiers
// and the prompt in artifacts/runs-browser/), and once with navigator.webdriver spoofed: Abandon & enter into a first visit plays its intro.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const URL = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const OUT = 'artifacts/runs-browser';
const SPOOF = "Object.defineProperty(navigator, 'webdriver', { get: () => false })";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const only = process.env.RUNS_ONLY; // 'phone' | 'desktop' | 'id' | 'spoof'
// Act II with a replayed chapter to pause (CH 2 cleared, CH 5 is the next first visit).
const SAVE = { ...ACT_TWO_SAVE, sound: false, motion: false };
// The saved Story checkpoint as 'chapter:stage:status:played' (read from IndexedDB), or null.
const STORY_CHECKPOINT = `(async () => {
  const { openCommanderRepository } = await import('/src/game/commander.ts');
  const repository = await openCommanderRepository();
  try { const e = (await repository.list()).map(doc => doc.encounters?.story).find(Boolean); return e ? [e.battle.floor, e.battle.stage, e.battle.status, Boolean(e.played)].join(':') : null; } finally { repository.close(); }
})()`;
const TEXT = {
  en: { resume: /^Resume CH 5 · battle 2 ▶$/, paused: 'CH 5 is paused at battle 2/5', dossier: /^Resume battle 2\/5 ▶$/, note: 'CH 5 is paused — entering here asks first.', abandonEnter: 'Abandon CH 5 and enter CH 2', draft: /^Resume · choose a boon \(floor 2\) ▶$/, leave: 'Leave for now…' },
  id: { resume: /^Lanjutkan CH 5 · pertarungan 2 ▶$/, paused: 'CH 5 dijeda di pertarungan 2/5', dossier: /^Lanjutkan pertarungan 2\/5 ▶$/, note: 'CH 5 sedang dijeda — masuk ke sini akan ditanyakan dulu.', abandonEnter: 'Tinggalkan CH 5 dan masuk ke CH 2', draft: /^Lanjutkan · pilih boon \(lantai 2\) ▶$/, leave: 'Tinggalkan dulu…' },
};

async function run(name, { width, height, mobile, lang = 'en', spoof = false, trials = true }) {
  await withBrowser(async browser => {
    try { await checks(name, { lang, spoof, trials }, browser); } catch (error) { await browser.screenshot(`${OUT}/${name}-FAILED.png`).catch(() => {}); console.log(JSON.stringify(await browser.evaluate('window.gridbound?.navState()').catch(() => null))); throw error; }
  }, { width, height, mobile });
  console.log(`PASS runs ${name}`);
}
async function checks(name, { lang, spoof, trials }, { send, evaluate, wait, click, key, screenshot, errors }) {
  {
    const text = TEXT[lang], shot = file => screenshot(`${OUT}/${name}-${file}.png`);
    if (spoof) await send('Page.addScriptToEvaluateOnNewDocument', { source: SPOOF });
    await seedSave(send, SAVE, lang);
    await send('Page.navigate', { url: URL });
    await wait('Boolean(window.gridbound?.navState)', 30000);
    if (spoof) {
      // A real player: the title screen, then the camp's one-time unlock card (Later).
      await wait('!document.querySelector("#title-screen").hidden'); await click('#title-screen'); await sleep(300); await click('#title-enter'); await wait('document.querySelector("#title-screen").hidden', 5000);
      await sleep(1200); if (await evaluate('document.querySelector("#modal").open')) { await click('#modal [data-close]:not(.modal-close)'); await sleep(300); }
    }
    const route = () => evaluate('document.querySelector(".town-game-shell")?.dataset.townRoute ?? ""');
    const nav = () => evaluate('window.gridbound.navState()');
    const visible = sel => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden]'); })()`);
    const label = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g, ' ').trim() ?? null`);
    const resultReady = 'document.querySelector("#result-screen:not([hidden]) [data-nav-exit=return]") && !document.querySelector("#result-screen [data-nav-exit=return]").disabled';
    const kill = () => evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
    const battleAt = () => evaluate('({ ch: window.gridbound.battle.floor, battle: window.gridbound.battle.stage + 1, status: window.gridbound.battle.status, heroes: window.gridbound.battle.heroes.map(h => h.id).sort((a, b) => a - b), inTown: window.gridbound.inTown, freeBack: window.gridbound.navState().battle?.freeBack ?? null })');
    const dossier = async zone => {
      await click.nav('campaign');
      const act = Math.floor(zone / 4);
      if (!await evaluate(`Boolean(document.querySelector('[data-zone="${zone}"]'))`)) { await click(`[data-act="${act}"]`); await wait(`Boolean(document.querySelector('[data-zone="${zone}"]'))`); }
      await click(`[data-zone="${zone}"]`);
      await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "mission" && Boolean(document.querySelector(".world-map-dossier"))');
    };
    // Depart CH 5 from its dossier, win battle 1, and at battle 2's ready window: Leave… → Save & suspend.
    const pauseCh5AtBattle2 = async () => {
      await dossier(4);
      await click('.world-map-dossier [data-depart="adventure"]');
      await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 10000);
      await click('#start'); await wait('window.gridbound.battle.status === "fighting"');
      await kill(); await wait(resultReady, 15000);
      await click('#next-wave'); await wait('window.gridbound.battle.status === "ready" && window.gridbound.battle.stage === 1');
      assert.equal(await evaluate('window.gridbound.navState().battle.freeBack'), false, 'battle 2 has a guarded Back');
      await click('#ready-back'); await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
      await click('#suspend-run'); await wait('window.gridbound.inTown', 10000); await sleep(300);
    };

    const leaveSuspend = async () => { await click('#ready-back'); await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))'); await click('#suspend-run'); await wait('window.gridbound.inTown', 10000); await sleep(300); };
    if (spoof) {
      // A real player (no automation shortcuts): pause CH 2 (a replay) at battle 2; the camp guide resumes it without replaying any intro;
      // then Abandon & enter CH 5, a first visit, plays CH 5's intro before its battle 1.
      await dossier(1);
      await click('.world-map-dossier [data-depart="adventure"]'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 10000);
      await click('#start'); await wait('window.gridbound.battle.status === "fighting"'); await kill(); await wait(resultReady, 15000);
      // Save & suspend from the won wave's result (its Return opens the won-wave dialog).
      await click('#result-town'); await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
      await click('#suspend-run'); await wait('window.gridbound.inTown', 10000); await sleep(300);
      await click.nav('camp');
      // The camp's one-time unlock card (Undercroft, Raids, Bell Trials) comes first for a real player: Later.
      await sleep(800); if (await evaluate('Boolean(document.querySelector("#modal[open] .unlock-card"))')) { await click('#modal .unlock-card [data-close]'); await wait('!document.querySelector("#modal").open'); }
      assert.match(await label('.camp-copy [data-resume-story]'), /^Resume CH 2 · battle 2 ▶$/);
      await click('.camp-copy [data-resume-story]'); await wait('!window.gridbound.inTown', 10000); await sleep(400);
      assert.equal(await evaluate('Boolean(document.querySelector(".dialogue-scene"))'), false, 'a resumed battle never replays a chapter intro');
      let at = await battleAt(); assert.deepEqual([at.ch, at.battle, at.status], [2, 2, 'ready'], 'the camp guide resumes the won wave at battle 2\'s ready window, as its label says');
      await leaveSuspend();
      assert.equal(await route(), 'camp', 'resumed from the camp: leaving returns to the camp');
      await dossier(4);
      await click('.world-map-dossier [data-depart="adventure"]'); await wait('Boolean(document.querySelector("#paused-abandon"))');
      await click('#paused-abandon');
      await wait('Boolean(document.querySelector(".dialogue-scene"))', 8000);
      await shot('abandon-enter-intro');
      await key('Escape'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 8000);
      at = await battleAt(); assert.deepEqual([at.ch, at.battle, at.freeBack], [5, 1, true], 'the intro leads to CH 5 battle 1, whose Back is free');
      assertNoErrors(errors);
      return;
    }

    // ---- Story 1: Save & suspend at battle 2 of CH 5; every place names the paused battle.
    await pauseCh5AtBattle2();
    assert.equal(await route(), 'mission', 'Save & suspend returns to the dossier it departed from');
    assert.equal(await label('.world-map-dossier .resume-card h3'), text.paused, 'the paused chapter\'s dossier shows its resume card');
    assert.match(await label('.world-map-dossier [data-depart="adventure"]'), text.dossier, 'its Enter names the resume');
    assert.equal(await evaluate('document.querySelector(".world-map-dossier [data-depart=adventure]").hasAttribute("data-resume-run")'), true);
    await shot('dossier-paused');
    await click.nav('camp');
    assert.match(await label('.camp-copy [data-resume-story]'), text.resume, 'the camp guide resumes the paused chapter instead of Next: CH n');
    assert.equal(await evaluate('document.querySelector(".camp-copy [data-continue-story]")'), null);
    assert.equal(await label('.camp-guide p'), `${await evaluate(`document.querySelector(".guide-label").textContent`)} ${text.paused}`, 'the guide names the paused battle');
    assert.equal(await visible('.camp-copy [data-abandon-run="story"]'), true, 'the guide offers Abandon…');
    await shot('camp-guide');
    // Another chapter's dossier says entering asks first; Enter opens the prompt with Resume focused; Cancel and Escape stay on that dossier.
    await dossier(1);
    assert.equal(await label('.world-map-dossier [data-paused-note]'), text.note);
    assert.equal(await evaluate('document.querySelector(".world-map-dossier [data-depart=adventure]").hasAttribute("data-resume-run")'), false);
    await shot('dossier-other');
    const other = await label('.world-map-dossier h3');
    for (const close of ['cancel', 'escape']) {
      await click('.world-map-dossier [data-depart="adventure"]');
      await wait('document.querySelector("#modal").open && Boolean(document.querySelector("#paused-resume"))');
      assert.equal(await label('#modal-title'), text.paused, 'the prompt names the paused battle');
      assert.equal(await evaluate('document.activeElement?.id'), 'paused-resume', 'Resume (the safe choice) has the focus');
      assert.equal(await label('#paused-abandon'), text.abandonEnter);
      assert.equal(await evaluate('document.querySelector("#paused-abandon").classList.contains("danger") && Boolean(document.querySelector("#modal [data-close][data-nav-exit=close]:not(.modal-close)"))'), true, 'the destructive choice is red, Cancel is a labelled exit');
      if (close === 'cancel') { await shot('prompt'); await click('#modal [data-close]:not(.modal-close)'); } else await key('Escape');
      await wait('!document.querySelector("#modal").open'); await sleep(200);
      const s = await nav();
      assert.deepEqual([s.layer, s.route, await evaluate('window.gridbound.inTown')], ['town', 'mission', true], `${close} keeps the player on the dossier`);
      assert.equal(await label('.world-map-dossier h3'), other, 'the same dossier');
    }
    // Resume from the prompt: CH 5 battle 2, the party it started with; leaving again lands on CH 5's dossier.
    await click('.world-map-dossier [data-depart="adventure"]'); await wait('Boolean(document.querySelector("#paused-resume"))');
    await click('#paused-resume'); await wait('!window.gridbound.inTown', 10000);
    let at = await battleAt();
    assert.deepEqual([at.ch, at.battle, at.status, at.freeBack], [5, 2, 'ready', false], 'Resume opens CH 5 at battle 2 (guarded Back)');
    await leaveSuspend();
    assert.equal(await label('.world-map-dossier .resume-card h3'), text.paused, 'suspended again: back on CH 5\'s dossier');
    // Abandon & enter: CH 2 starts at battle 1 with the current party, nothing is paused any more.
    await dossier(1);
    await click('.world-map-dossier [data-depart="adventure"]'); await wait('Boolean(document.querySelector("#paused-abandon"))');
    await click('#paused-abandon'); await wait('!window.gridbound.inTown', 10000);
    at = await battleAt();
    assert.deepEqual([at.ch, at.battle, at.status, at.freeBack, at.heroes], [2, 1, 'ready', true, [0, 3, 4]], 'Abandon & enter starts CH 2 fresh (free Back)');
    await click('#ready-back'); await wait('window.gridbound.inTown', 10000); await sleep(300);
    assert.equal(await evaluate('Boolean(document.querySelector("[data-paused-note], .resume-card"))'), false, 'nothing is paused after the abandon');
    await click.nav('camp');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-copy [data-continue-story=\\"4\\"]"))'), true, 'the guide is Next: CH 5 again');

    if (lang === 'id') { assertNoErrors(errors); return; }

    // ---- Story 2: the paused battle keeps its party; the note says so; Abandon from the Party screen frees the new party.
    await pauseCh5AtBattle2();
    await click.nav('party');
    assert.equal(await visible('[data-paused-note]'), true, 'the Party screen notes the paused battle');
    await evaluate('document.querySelector("[data-training-tab=formation]")?.click()'); await sleep(200);
    await click('[data-story-toggle="3"]'); await sleep(300);
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive.slice().sort((a, b) => a - b)'), [0, 4], 'Rowan benched');
    await shot('party-note');
    // The Party deploy (CH 5 selected) resumes with the party the battle started with.
    assert.equal(await evaluate('document.querySelector(".party-deploy-button").hasAttribute("data-resume-run")'), true);
    assert.match(await evaluate('document.querySelector(".party-deploy-button").getAttribute("aria-label")'), / · Resume battle 2\/5$/, 'its accessible name says it resumes');
    await click('.party-deploy-button'); await wait('!window.gridbound.inTown', 10000);
    at = await battleAt();
    assert.deepEqual([at.ch, at.battle, at.heroes], [5, 2, [0, 3, 4]], 'Resume keeps the old party');
    await leaveSuspend();
    assert.equal(await route(), 'party', 'leaving returns to the Party screen it departed from');
    await click('[data-paused-note] [data-abandon-run="story"]'); await wait('Boolean(document.querySelector("#abandon-suspended"))');
    assert.equal(await evaluate('document.activeElement?.dataset.navExit'), 'close', 'the abandon confirmation focuses Cancel');
    await click('#abandon-suspended'); await wait('!document.querySelector("[data-paused-note]")', 8000);
    assert.equal(await route(), 'party', 'the abandon stays on the Party screen');
    await click('.party-deploy-button'); await wait('!window.gridbound.inTown', 10000);
    at = await battleAt();
    assert.deepEqual([at.ch, at.battle, at.heroes, at.freeBack], [5, 1, [0, 4], true], 'Abandon then Depart uses the new party, from battle 1');
    // A reload (or a closed tab) at that fresh ready window, before FIGHT!: nothing was played, so nothing is paused and the party stays free.
    let saved = null;
    for (let i = 0; i < 40 && saved !== '5:0:ready:false'; i++) { saved = await evaluate(STORY_CHECKPOINT); if (saved !== '5:0:ready:false') await sleep(250); }
    assert.equal(saved, '5:0:ready:false', 'the departure checkpoint is saved, not played');
    await send('Page.reload'); await wait('Boolean(window.gridbound?.navState) && window.gridbound.inTown', 30000); await sleep(300);
    await click.nav('camp');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-resume-story], [data-paused-note], .resume-card"))'), false, 'a reload at a fresh ready window pauses nothing');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-copy [data-continue-story=\\"4\\"]"))'), true, 'the guide is Next: CH 5');
    await dossier(4);
    assert.equal(await evaluate('Boolean(document.querySelector(".world-map-dossier .resume-card, .world-map-dossier [data-paused-note]"))'), false);
    await click('.world-map-dossier [data-depart="adventure"]'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 10000);
    at = await battleAt();
    assert.deepEqual([at.ch, at.battle, at.heroes, at.freeBack], [5, 1, [0, 4], true], 'the next departure is fresh, with the current party');
    await click('#ready-back'); await wait('window.gridbound.inTown', 10000);

    if (trials) {
      // ---- Bell Trials: the boon draft survives Save & suspend, a reload, and resumes with the same boons; Abandon gives a fresh setup.
      const toTrials = () => click.nav('endless');
      const clearFloor = async () => { await click('#start'); await wait('window.gridbound.battle.status === "fighting"'); await kill(); await wait(`${resultReady} && document.querySelectorAll("[data-boon]").length > 0`, 15000); };
      const draft = () => evaluate('[...document.querySelectorAll("[data-boon]")].map(b => b.dataset.boon)');
      const purse = () => evaluate('window.gridbound.battle.runWallet?.crystal ?? null');
      await toTrials(); await click('[data-depart="endless"]'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
      await clearFloor();
      const first = await draft(), firstPurse = await purse();
      assert.equal(first.length, 3);
      assert.equal(await label('#result-town'), text.leave, 'the draft\'s exit reads Leave for now…');
      await click('#result-town'); await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
      assert.equal(await evaluate('document.activeElement?.id'), 'suspend-run', 'Save & suspend is offered and focused at the draft');
      await shot('draft-leave');
      await click('#suspend-run'); await wait('window.gridbound.inTown', 10000); await sleep(300);
      assert.equal(await route(), 'endless');
      assert.match(await label('[data-depart="endless"]'), text.draft, 'the setup resumes the draft');
      assert.equal(await evaluate('document.querySelector("[data-depart=endless]").hasAttribute("data-resume-run") && Boolean(document.querySelector(".resume-card[data-suspended-run=roguelike] [data-abandon-run]"))'), true);
      await shot('trials-draft-card');
      await click('[data-depart="endless"]'); await wait(`${resultReady} && document.querySelectorAll("[data-boon]").length > 0`, 15000);
      assert.deepEqual(await draft(), first, 'the resumed draft offers the same boons');
      assert.equal(await purse(), firstPurse, 'and the same run purse');
      await click(`[data-boon="${first[0]}"]`); await wait('window.gridbound.battle.floor === 2 && window.gridbound.battle.status === "ready"');
      assert.deepEqual(await evaluate('window.gridbound.runBoons'), [first[0]], 'floor 2 boots with the boon taken');
      assert.equal(await purse(), firstPurse, 'and the purse intact');
      // A Fate Reroll bought for floor 2 travels with the run; a reload at the draft keeps it.
      // (QA top-up: one floor's purse does not cover it yet.)
      await evaluate('window.gridbound.battle.runWallet.crystal = Math.max(window.gridbound.battle.runWallet.crystal, 40); window.gridbound.setRunBoons(window.gridbound.runBoons)');
      const purseBefore = await purse();
      await evaluate('document.querySelector("[data-run-buy=run-reroll]").click()');
      assert.ok(await purse() < purseBefore, 'the Fate Reroll is bought');
      await clearFloor();
      const second = await draft(), secondPurse = await purse();
      await send('Page.reload'); await wait('Boolean(window.gridbound?.navState)', 30000); await sleep(300);
      await toTrials();
      assert.match(await label('[data-depart="endless"]'), lang === 'en' ? /^Resume · choose a boon \(floor 3\) ▶$/ : /lantai 3/, 'a reload at the draft keeps the run');
      await click('[data-depart="endless"]'); await wait(`${resultReady} && document.querySelectorAll("[data-boon]").length > 0`, 15000);
      assert.deepEqual(await draft(), second, 'the same boons after a reload, the Fate Reroll included');
      assert.equal(await purse(), secondPurse);
      assert.deepEqual(await evaluate('window.gridbound.runBoons'), [first[0]]);
      // Back at the draft is its Return: the leave dialog (Save & suspend focused), then Abandon on the card gives a fresh setup.
      await key('Escape'); await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
      await click('#suspend-run'); await wait('window.gridbound.inTown', 10000); await sleep(300);
      await click('.resume-card [data-abandon-run="roguelike"]'); await wait('Boolean(document.querySelector("#abandon-suspended"))');
      await click('#abandon-suspended'); await wait('!document.querySelector(".resume-card")', 8000);
      assert.equal(await evaluate('document.querySelector("[data-depart=endless]").hasAttribute("data-resume-run")'), false, 'Abandon: a fresh setup');
      await click('[data-depart="endless"]'); await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
      assert.deepEqual([await evaluate('window.gridbound.battle.floor'), await evaluate('window.gridbound.runBoons.length')], [1, 0], 'a new run starts on floor 1 with no boons');
      await click('#ready-back'); await wait('window.gridbound.inTown', 10000);
    }
    assertNoErrors(errors);
  }
}
function assertNoErrors(errors) {
  assert.deepEqual(errors.map(e => e.text ?? e.description ?? JSON.stringify(e).slice(0, 200)), [], 'no console errors');
}

await mkdir(OUT, { recursive: true });
const RUNS = [
  ['phone', { width: 390, height: 844, mobile: true }],
  ['desktop', { width: 1280, height: 900, mobile: false }],
  ['id', { width: 390, height: 844, mobile: true, lang: 'id', trials: false }],
  ['spoof', { width: 390, height: 844, mobile: true, spoof: true, trials: false }],
];
for (const [name, options] of RUNS) if (!only || only === name) await run(name, options);
