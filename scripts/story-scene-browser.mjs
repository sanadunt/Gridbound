import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const camp = 'Boolean(window.gridbound && document.querySelector(".camp-scene"))';
const nameplate = 'document.querySelector(".dialogue-speaker b").textContent';
const portraitShown = '!document.querySelector(".dialogue-speaker img").hidden';
/** Seed a legacy save with `chapters` cleared (journey queues and choices patched by `patch`) and boot it as a fresh Commander. */
const seed = (chapters, patch = '') => `(async()=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('gridbound.commanders.r1');q.onsuccess=q.onerror=q.onblocked=()=>r();});const {createProfile,completeZone}=await import('/src/game/profile.ts');const p=createProfile();p.motion=false;for(let i=0;i<${chapters};i++)completeZone(p,i);${patch}localStorage.setItem('gridbound.v3',JSON.stringify(p));})()`;
/** Picks are ignored for a moment after the choices appear (CHOICE_INPUT_DELAY_MS in dialogue.ts). */
const settle = () => new Promise(resolve => setTimeout(resolve, 700));
const guideText = 'document.querySelector(".camp-copy")?.textContent ?? ""';
const openJournal = async (click, wait) => {
  await click('#menu-button');
  await wait('Boolean(document.querySelector(".more-scene"))');
  await click('.more-scene [data-open-action="journal"]');
  await wait('Boolean(document.querySelector("#modal .journal-scene, #modal .journal-chronicle"))');
};

for (const [width, height] of [[390, 844], [1440, 900]]) {
  await withBrowser(async ({ send, wait, evaluate, click, key, screenshot, errors }) => {
    await send('Page.navigate', { url });
    await wait(camp);
    await evaluate('void window.gridbound.chapterIntro(4)');
    await wait('Boolean(document.querySelector(".dialogue-scene .dialogue-card h2"))');
    assert.equal(await evaluate('document.querySelector(".dialogue-card h2").textContent'), 'The Empty Census');
    await click('.dialogue-scene');
    await wait('!document.querySelector(".dialogue-box").hidden');
    // Narration carries the chronicle nameplate and the place, never the speaker's portrait.
    assert.equal(await evaluate(nameplate), 'CHRONICLE', 'narration has a narrator nameplate');
    assert.equal(await evaluate('document.querySelector(".dialogue-speaker small").textContent'), 'THE SCHOOLHOUSE', 'the place comes from the chapter data');
    assert.equal(await evaluate(portraitShown), false, 'no portrait on narration');
    await click('.dialogue-box');
    await wait('document.querySelector(".dialogue-box").classList.contains("ready")');
    const page = await evaluate('document.querySelector(".dialogue-text").textContent');
    assert.ok(page.length > 20 && page.length <= 230, `Pages fit the message box: ${page.length}`);
    assert.match(await evaluate('document.querySelector(".dialogue-count").textContent'), /^1\/\d+$/);
    await screenshot(`artifacts/story-scene-${width}.png`);
    await key('Enter');
    await wait('document.querySelector(".dialogue-count").textContent.startsWith("2/")');
    await key('Escape');
    await wait('!document.querySelector(".dialogue-scene")');
    assert.equal(await evaluate('Boolean(document.querySelector(".camp-scene"))'), true, 'Skipping returns to the town untouched');
    // Chapter 7: narration under CHRONICLE, then Lyra's quoted line under her own nameplate and portrait.
    await evaluate('void window.gridbound.chapterIntro(6)');
    await wait('Boolean(document.querySelector(".dialogue-scene .dialogue-card h2"))');
    await click('.dialogue-scene');
    await wait('!document.querySelector(".dialogue-box").hidden');
    assert.equal(await evaluate(nameplate), 'CHRONICLE');
    await wait('/^Lyra/.test(document.querySelector(".dialogue-text").textContent)');
    for (let i = 0; i < 8; i++) {
      if (!(await evaluate('document.querySelector(".dialogue-box").classList.contains("ready")'))) await key('Enter');
      await wait('document.querySelector(".dialogue-box").classList.contains("ready")');
      if (await evaluate('/^[“"]/.test(document.querySelector(".dialogue-text").textContent)')) break;
      const count = await evaluate('document.querySelector(".dialogue-count").textContent');
      await key('Enter');
      await wait(`document.querySelector(".dialogue-count").textContent !== ${JSON.stringify(count)}`);
    }
    assert.equal(await evaluate(nameplate), 'LYRA', 'quoted speech shows the speaker');
    assert.equal(await evaluate(portraitShown), true, 'and their portrait');
    await key('Escape');
    await wait('!document.querySelector(".dialogue-scene")');
    // Recruit scene: a new hero's title card and first words.
    await evaluate('void window.gridbound.recruitScene(9)');
    await wait('Boolean(document.querySelector(".dialogue-scene .dialogue-card h2"))');
    assert.match(await evaluate('document.querySelector(".dialogue-card h2").textContent'), /Tamsin/);
    await click('.dialogue-scene');
    await wait('!document.querySelector(".dialogue-box").hidden');
    assert.equal(await evaluate(nameplate).then(s => s.toUpperCase()), 'TAMSIN');
    await click('.dialogue-box');
    await wait('document.querySelector(".dialogue-box").classList.contains("ready")');
    assert.ok((await evaluate('document.querySelector(".dialogue-text").textContent')).length > 30, 'join line is shown');
    await new Promise(resolve => setTimeout(resolve, 600));
    await screenshot(`artifacts/recruit-scene-${width}.png`);
    await key('Escape');
    await wait('!document.querySelector(".dialogue-scene")');
    assert.deepEqual(errors, []);
    console.log(`PASS story scene ${width}×${height}: title card, narrator nameplate, quoted speaker, pagination, keyboard advance and skip`);
  }, { width, height, mobile: width < 500 });
}

// Scenes owed after a clear survive a reload and play when the camp opens: the join scene, then the story choice.
await withBrowser(async ({ send, wait, evaluate, click, key, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait(camp);
  await evaluate(seed(6, 'p.journey.pendingRecruitScenes=[10];'));
  await send('Page.reload');
  await wait(camp);
  assert.deepEqual(await evaluate('window.gridbound.profile().journey.pendingRecruitScenes'), [10], 'the queue is part of the save');
  assert.deepEqual(await evaluate('window.gridbound.profile().journey.pendingChapterScenes'), [5]);
  await evaluate('void window.gridbound.campScenes()');
  await wait('/Vesper/.test(document.querySelector(".dialogue-card h2")?.textContent ?? "")');
  await key('Escape');
  // Chapter 6 opens the archive choice: its options plus 'Decide later'.
  await wait('Boolean(document.querySelector(".dialogue-choices:not([hidden]) .dialogue-choice"))');
  assert.equal(await evaluate('document.querySelector(".dialogue-card h2").textContent'), 'Names upon copper');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".dialogue-choice")].map(b => b.textContent)'), ["Open the archive with the townsfolk's consent", 'Return the records to their families', 'Decide later']);
  assert.equal(await evaluate('document.activeElement.textContent'), 'Decide later', 'the safe choice has the focus');
  await screenshot('artifacts/story-choice-390.png');
  await click('.dialogue-text');
  assert.equal(await evaluate('Boolean(document.querySelector(".dialogue-choice"))'), true, 'a click elsewhere does not skip the question');
  await settle();
  await click('.dialogue-choice[data-choice="1"]');
  await wait('/register without revealing/.test(document.querySelector(".dialogue-text").textContent)');
  await click('.dialogue-box');
  await wait('!document.querySelector(".dialogue-scene")');
  await wait('!window.gridbound.profile().journey.pendingChapterScenes');
  assert.deepEqual(await evaluate('window.gridbound.profile().narrative'), { archive: 'private' });
  assert.equal(await evaluate('window.gridbound.profile().journey.pendingRecruitScenes'), undefined, 'played scenes are dropped');
  await send('Page.reload');
  await wait(camp);
  assert.deepEqual(await evaluate('window.gridbound.profile().narrative'), { archive: 'private' }, 'the choice is saved');
  assert.equal(await evaluate('window.gridbound.profile().journey.pendingChapterScenes'), undefined, 'and is not offered again');

  // 'Decide later' leaves the choice open; the camp guide points to the Journal, which offers 'Decide later' instead of a silent default.
  // (The ready first-road quest is claimed so the guide reaches the choice line, which ranks below chests and quests.)
  await evaluate(seed(6, "p.claimedQuests.push('first-road');"));
  await send('Page.reload');
  await wait(camp);
  await evaluate('void window.gridbound.campScenes()');
  // Eight join scenes (chapters 1-6) come first: skip each one.
  for (let i = 0; i < 12; i++) {
    await wait('Boolean(document.querySelector(".dialogue-scene:not([data-seen])"))');
    if (await evaluate('Boolean(document.querySelector(".dialogue-choices:not([hidden])"))')) break;
    await evaluate('document.querySelector(".dialogue-scene").dataset.seen = "1"');
    await key('Escape');
    await wait('!document.querySelector(".dialogue-scene[data-seen]")');
  }
  await wait('Boolean(document.querySelector(".dialogue-choices:not([hidden])"))');
  await key('ArrowUp');
  assert.equal(await evaluate('document.activeElement.textContent'), 'Return the records to their families', 'arrow keys move between choices');
  await key('ArrowDown');
  assert.equal(await evaluate('document.activeElement.textContent'), 'Decide later');
  await settle();
  await key('Enter');
  await wait('!document.querySelector(".dialogue-scene")');
  await wait(`/A choice is waiting in the Journal/.test(${guideText})`);
  assert.deepEqual(await evaluate('window.gridbound.profile().narrative'), {});
  await click('.camp-copy .guide-go[data-open-action="journal"]');
  await wait('Boolean(document.querySelector("#modal .journal-scene"))');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#modal .journal-scene .menu-item")].map(b => b.textContent)'), ["Open the archive with the townsfolk's consent", 'Return the records to their families', 'Decide later']);
  assert.ok(await evaluate('Boolean(document.querySelector("#modal [data-replay-recruit=\\"10\\"]"))'), 'the Journal replays join scenes');
  await screenshot('artifacts/journal-choice-390.png');
  await click('#modal [data-replay-recruit="10"]');
  await wait('/Vesper/.test(document.querySelector(".dialogue-card h2")?.textContent ?? "")');
  await key('Escape');
  await wait('!document.querySelector(".dialogue-scene")');
  assert.deepEqual(errors, []);
  console.log('PASS camp scenes: saved join scene + story choice play on camp, choice saved, Decide later keeps it open, guide → Journal, join scene replay');
}, { width: 390, height: 844, mobile: true });

// Mashing Enter through a join scene into the story choice never answers it: the safe 'Decide later' has the focus and early picks are ignored.
await withBrowser(async ({ send, wait, evaluate, key, errors }) => {
  await send('Page.navigate', { url });
  await wait(camp);
  for (const motion of [false, true]) {
    await evaluate(seed(6, `p.motion=${motion};p.journey.pendingRecruitScenes=[10];p.claimedQuests.push('first-road');`));
    await send('Page.reload');
    await wait(camp);
    await evaluate('void window.gridbound.campScenes()');
    await wait('Boolean(document.querySelector(".dialogue-scene"))');
    for (let i = 0; i < 16; i++) { await key('Enter'); await new Promise(resolve => setTimeout(resolve, 250)); }
    await wait('!document.querySelector(".dialogue-scene")');
    await wait('!window.gridbound.profile().journey.pendingChapterScenes');
    assert.deepEqual(await evaluate('window.gridbound.profile().narrative ?? {}'), {}, `mashed Enter leaves the choice open (motion ${motion})`);
    await wait(`/A choice is waiting in the Journal/.test(${guideText})`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS mashed Enter: join scene into the archive choice leaves it open, guide → Journal (motion off and on)');
}, { width: 390, height: 844, mobile: true });

// A real player (no webdriver) with scenes queued in the boot-time save: nothing plays over the title screen; Enter Emberhollow starts them.
await withBrowser(async ({ send, wait, evaluate, click, key, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });" });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound) && !document.querySelector("#title-screen").hidden');
  await evaluate(seed(6, "p.journey.pendingRecruitScenes=[10];"));
  await send('Page.reload');
  await wait('Boolean(window.gridbound) && !document.querySelector("#title-screen").hidden');
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(await evaluate('Boolean(document.querySelector(".dialogue-scene"))'), false, 'no scene plays over the title screen');
  assert.deepEqual(await evaluate('window.gridbound.profile().journey.pendingRecruitScenes'), [10], 'the scene is still owed');
  await click('#title-screen');
  await wait('!document.querySelector("#title-screen").classList.contains("press-phase")');
  await click('#title-enter');
  await wait('document.querySelector("#title-screen").hidden');
  await wait('/Vesper/.test(document.querySelector(".dialogue-card h2")?.textContent ?? "")');
  await key('Escape');
  await wait('Boolean(document.querySelector(".dialogue-choices:not([hidden])"))');
  await key('Escape');
  await wait('!document.querySelector(".dialogue-scene")');
  assert.deepEqual(await evaluate('window.gridbound.profile().narrative ?? {}'), {}, 'Escape leaves the choice open');
  assert.deepEqual(errors, []);
  console.log('PASS title screen: queued camp scenes wait behind the title and play after Enter Emberhollow');
}, { width: 390, height: 844, mobile: true });

// The finished campaign: English Journal epilogue, the ending scene, then the Indonesian Journal.
await withBrowser(async ({ send, wait, evaluate, click, key, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait(camp);
  await evaluate(seed(16, "p.journey={stars:{},chests:0,heroic:[],depth:0};p.narrative={archive:'private',cooperative:'clinic',school:'memorial'};"));
  await send('Page.reload');
  await wait(camp);
  await openJournal(click, wait);
  const lead = await evaluate('document.querySelector("#modal .journal-epilogue p").textContent');
  assert.equal(lead, 'The machine stops. Vharok is free. Eda chooses a name of their own. The town builds its protection together; they do not get back everything that was lost.', 'the epilogue lead line is English');
  const cards = await evaluate('[...document.querySelectorAll("#modal .journal-epilogue p")].map(p => p.textContent)');
  assert.equal(cards.length, 4);
  assert.ok(cards.every(text => !/\b(yang|dan|tidak)\b/.test(text)), `no Indonesian in the English epilogue: ${cards}`);
  const finale = await evaluate('[...document.querySelectorAll("#modal .journal-entry-card")].at(-1).textContent');
  assert.match(finale, /Sable guards a register she never opens\./, 'the finale outro follows the archive choice');
  assert.match(finale, /Lyra opens a clinic with Mira and the townsfolk/, 'and the cooperative choice');
  assert.doesNotMatch(finale, /Campaign complete/);
  await evaluate('document.querySelector("#modal .journal-epilogue").scrollIntoView({block:"end"})');
  await screenshot('artifacts/journal-epilogue-en.png');
  await click('#modal [data-replay-ending]');
  await wait('Boolean(document.querySelector(".dialogue-scene"))');
  let fate = false;
  for (let i = 0; i < 60 && !(await evaluate('!document.querySelector(".dialogue-end").hidden')); i++) {
    if (!fate && await evaluate('document.querySelector(".dialogue-speaker small")?.textContent === "AFTERWARD" && document.querySelector(".dialogue-speaker b").textContent === "Tamsin"')) { fate = true; assert.equal(await evaluate(portraitShown), true); await screenshot('artifacts/ending-fate-390.png'); }
    await key('Enter'); await new Promise(r => setTimeout(r, 60));
  }
  assert.ok(fate, 'each hero gets a finale line with a portrait');
  assert.equal(await evaluate('document.querySelector(".dialogue-end h2").textContent'), 'Emberhollow', 'the ending closes on a title card');
  await screenshot('artifacts/ending-card-390.png');
  await key('Enter');
  await wait('!document.querySelector(".dialogue-scene")');
  // Indonesian Journal.
  await evaluate("localStorage.setItem('gridbound.lang','id')");
  await send('Page.reload');
  await wait(camp);
  await openJournal(click, wait);
  assert.equal(await evaluate('document.querySelector("#modal .journal-epilogue p").textContent'), 'Mesin berhenti. Vharok bebas. Eda memilih namanya sendiri. Kota membangun perlindungan bersama; mereka tidak mendapatkan kembali semua yang hilang.');
  assert.match(await evaluate('[...document.querySelectorAll("#modal .journal-entry-card")].at(-1).textContent'), /Sable menjaga daftar yang tidak pernah ia buka\./);
  await evaluate('document.querySelector("#modal .journal-epilogue").scrollIntoView({block:"end"})');
  await screenshot('artifacts/journal-epilogue-id.png');
  await evaluate("localStorage.setItem('gridbound.lang','en')");
  assert.deepEqual(errors, []);
  console.log('PASS finished campaign: English epilogue lead, choice-shaped finale, ending scene with fate lines and title card, Indonesian Journal');
}, { width: 390, height: 844, mobile: true });

// The last chapter: the boss is named for what rides Vharok, the result keeps the postgame note out of the story, and the camp owes the finale.
await withBrowser(async ({ send, wait, evaluate, click, key, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait(camp);
  await evaluate(seed(15, "p.journey={stars:{},chests:0,heroic:[],depth:0};p.narrative={archive:'private'};"));
  await send('Page.reload');
  await wait(camp);
  await click.nav('campaign');
  await click('[data-zone="15"]');
  await wait('document.querySelector(".dossier-boss-card h4")?.textContent === "The Last Machine"');
  assert.equal(await evaluate('document.querySelector(".dossier-boss-title").textContent'), 'WINGED WITH VHAROK', 'the map dossier names what rides Vharok');
  await click('[data-depart="adventure"]');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  const count = await evaluate('window.gridbound.battle.stageCount');
  for (let stage = 0; stage < count; stage += 1) {
    if (stage === count - 1) assert.equal(await evaluate('document.querySelector("#boss-name").textContent'), 'The Last Machine', 'the HP bar is not Vharok');
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
    await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")');
    if (stage < count - 1) {
      await click('#next-wave');
      await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden');
      await click('#start');
      await wait('window.gridbound.battle.status === "fighting"');
    }
  }
  const desc = await evaluate('document.querySelector(".ceremony-desc").textContent');
  assert.match(desc, /Sable guards a register she never opens\./, 'the result outro follows the archive choice');
  assert.doesNotMatch(desc, /Campaign complete/, 'the postgame note is not story prose');
  assert.match(await evaluate('document.querySelector(".campaign-complete").textContent'), /^Campaign complete\. Emberhollow stays open/);
  await screenshot('artifacts/finale-result-390.png');
  await click('#result-town');
  await wait('document.querySelector(".town-game-shell")?.dataset.townRoute === "camp"');
  assert.deepEqual(await evaluate('window.gridbound.profile().journey.pendingChapterScenes'), [15], 'the finale is owed (automation skips it on its own)');
  await evaluate('void window.gridbound.campScenes()');
  await wait('document.querySelector(".dialogue-card h2")?.textContent === "The Unwritten Dawn"');
  await key('Escape');
  await wait('!document.querySelector(".dialogue-scene")');
  await wait('!window.gridbound.profile().journey.pendingChapterScenes');
  assert.deepEqual(errors, []);
  console.log('PASS finale: renamed boss on map and HP bar, choice-shaped result outro, postgame note as UI text, finale owed and played at camp');
}, { width: 390, height: 844, mobile: true });
