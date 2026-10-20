// Safe Commander onboarding: a pre-Commander save is backed up and migrated into a Commander on boot, 'New
// Commander' asks before starting from zero and keeps the existing file, 'Download save backup' always writes
// an importable file that 'Import save' restores (fresh id, bank kept only when it cannot duplicate one, three
// files max), a reload keeps the progress, re-rendering the town does not commit revisions or flash the unsaved
// warning, a Journal choice re-renders the Journal, and another tab's commit makes this tab read-only. On a phone (390×844, touch) Save
// files offers Copy backup as text and Paste backup on the web build too, notes the backup time, and the backup reminder closes with 'Not now'.
import assert from 'node:assert/strict';
// Every Page.reload marks the old document first and waits for a new one: under load the old page stays live until the reload commits.
// Only backup (JSON) blobs are counted: the town art's PNG blob (townSceneURL) may land after the stub on a freshly loaded page.
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const loadout = slot => ({ skills: [0, 1], talents: [], xp: 900, slot, gear: {}, inventory: [] });
const seed = {
  version: 3, gold: 4321, economy: { gold: 4321, commanderCrystal: 40, materials: {} }, challengeUnlocks: [], claimedQuests: [],
  ledger: { raids: 0, victories: 5, enemies: {} }, roster: [0, 4, 3, 2], cleared: [0, 1, 2, 3, 4], storyActive: [0, 4, 3, 2],
  loadouts: { 0: loadout(1), 4: loadout(7), 3: loadout(6), 2: loadout(4) }, bestFloor: 0, wins: 5, sound: false, motion: false,
};
const docs = `(async () => {
  const { openCommanderRepository } = await import('/src/game/commander.ts');
  const repository = await openCommanderRepository();
  const list = await repository.list();
  repository.close();
  return list.map(doc => ({ id: doc.commanderId, name: doc.name, revision: doc.revision, cleared: doc.story.slots[3].state?.cleared.length, gold: doc.story.slots[3].state?.gold, crystal: doc.shared.bankCrystal, legacy: typeof doc.legacySource === 'string' }));
})()`;
const progress = () => '(() => { const p = window.gridbound.profile(); return { cleared: p.cleared.length, gold: p.gold, roster: p.roster.length }; })()';
const status = () => 'document.querySelector("#storage-status").textContent';
const revision = () => 'document.querySelector("#storage-status").dataset.revision';

await withBrowser(async ({ send, wait, evaluate, click, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  const raw = await evaluate("localStorage.getItem('gridbound.v3')");
  const reload = async () => {
    await evaluate('window.__beforeReload = true'); await send('Page.reload');
    await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
    await wait(`${status()}.startsWith("Saved")`, 15000);
  };

  // (i) Boot migrates the legacy save into a Commander, after backing it up; the legacy key is left as it was.
  await reload();
  let files = await evaluate(docs);
  assert.equal(files.length, 1, 'a Commander is created on boot');
  assert.deepEqual({ cleared: files[0].cleared, gold: files[0].gold, crystal: files[0].crystal, legacy: files[0].legacy, name: files[0].name }, { cleared: 5, gold: 4321, crystal: 40, legacy: true, name: 'Commander' }, 'it holds the legacy progress and bank');
  const baseline = await evaluate(progress());
  assert.deepEqual({ cleared: baseline.cleared, gold: baseline.gold }, { cleared: 5, gold: 4321 });
  const backups = await evaluate('Object.keys(localStorage).filter(k => k.startsWith("gridbound.v3.backup-"))');
  assert.equal(backups.length, 1, 'a backup of the legacy save exists');
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(backups[0])})`), raw, 'the backup is the raw legacy save');
  assert.equal(await evaluate("localStorage.getItem('gridbound.v3')"), raw, 'gridbound.v3 is not rewritten once a Commander holds the progress');

  // (ii) New Commander is a secondary action that asks first; cancelling keeps everything.
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #new-commander"))');
  assert.equal(await evaluate('document.querySelector("#new-commander").classList.contains("primary")'), false, 'New Commander is not the primary button');
  assert.equal(await evaluate('Boolean(document.querySelector("#continue-mine"))'), false, 'the progress already has a Commander');
  await screenshot('artifacts/save-safety-dialog.png');
  await click('#new-commander');
  await wait('Boolean(document.querySelector("dialog[open] #new-confirm"))');
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /starts from zero/);
  await screenshot('artifacts/save-safety-confirm.png');
  await click('#new-cancel');
  await wait('Boolean(document.querySelector("dialog[open] #new-commander"))');
  assert.deepEqual(await evaluate(progress()), baseline, 'cancelling changes nothing');
  assert.equal((await evaluate(docs)).length, 1, 'no Commander was created');

  // (iii) The backup download is real JSON that Import save restores as a new Commander.
  await evaluate('window.__blobs = []; const create = URL.createObjectURL; URL.createObjectURL = blob => { if (blob.type === "application/json") window.__blobs.push(blob); return create(blob); }');
  await evaluate('document.querySelector("dialog[open]").close()');
  await click('#settings');
  await wait('Boolean(document.querySelector("dialog[open] #export-save"))');
  await click('#export-save');
  await wait('window.__blobs.length === 1');
  const exported = await evaluate('window.__blobs[0].text()');
  assert.notEqual(exported.trim(), 'undefined');
  const parsed = JSON.parse(exported);
  assert.equal(parsed.commanderId, files[0].id, 'the export is the Commander document');
  await evaluate('document.querySelector("dialog[open]").close()');
  const importFile = text => evaluate(`(() => { const input = document.querySelector('#import-save'); const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(text)}], 'backup.json', { type: 'application/json' })); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #import-save"))');
  await importFile('undefined');
  await wait('document.querySelector("#profile-error").textContent.includes("not a Gridbound save")');
  await importFile(exported);
  await wait(`${docs}.then(list => list.length === 2)`, 10000);
  // The copy is named as one and the dialog says where the bank stayed (restoring a backup never looks like losing the Crystal).
  await wait('Boolean(document.querySelector("dialog[open] [data-import-note]"))');
  assert.match(await evaluate('document.querySelector("[data-import-note]").textContent'), /0 ◆.*"Commander"/, 'the import names the file that keeps the bank');
  await click('dialog[open] [data-close].btn');
  await wait('!document.querySelector("dialog[open]")');
  files = await evaluate(docs);
  const copy = files.find(file => file.id !== parsed.commanderId);
  assert.deepEqual({ cleared: copy.cleared, gold: copy.gold, crystal: copy.crystal, name: copy.name }, { cleared: 5, gold: 4321, crystal: 0, name: 'Commander (imported)' }, 'a second copy of a loaded file keeps the progress but not a second bank');
  await wait(`${status()}.startsWith("Saved")`);
  assert.deepEqual(await evaluate(progress()), baseline, 'the imported Commander is active');
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #import-save-button"))');
  await importFile(exported);
  await wait(`${docs}.then(list => list.length === 3)`, 10000);
  await wait('Boolean(document.querySelector("dialog[open] [data-import-note]"))');
  await click('dialog[open] [data-close].btn');
  await wait('!document.querySelector("dialog[open]")');
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #import-save-button"))');
  assert.equal(await evaluate('document.querySelector("#import-save-button").disabled && document.querySelector("#new-commander").disabled'), true, 'three files is the limit');
  await evaluate('document.querySelector("dialog[open]").close()');

  // (iv) A reload keeps the progress.
  await reload();
  assert.deepEqual(await evaluate(progress()), baseline, 'still 5 chapters after a reload');
  assert.equal(await evaluate("localStorage.getItem('gridbound.v3')"), raw);

  // Re-rendering the town (hero tabs) commits nothing and never flashes the unsaved warning.
  await click.nav('party');
  await wait(`${status()}.startsWith("Saved")`);
  const before = await evaluate(revision());
  await evaluate(`window.__statuses = []; new MutationObserver(() => window.__statuses.push(document.querySelector('#storage-status').dataset.level + ':' + document.querySelector('#storage-status').textContent)).observe(document.querySelector('#storage-status'), { childList: true, characterData: true, subtree: true, attributes: true })`);
  for (let i = 0; i < 10; i++) {
    const heroes = await evaluate('[...document.querySelectorAll("[data-town-hero]")].map(button => button.dataset.townHero)');
    await click(`[data-town-hero="${heroes[i % heroes.length]}"]`);
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await evaluate(revision()), before, 'ten hero taps keep the same revision');
  assert.equal(await evaluate(status()), 'Saved', 'the status names no revision number');
  assert.deepEqual(await evaluate('window.__statuses.filter(text => text.startsWith("warn"))'), [], 'no unsaved warning while saving');

  // A real change still saves, quietly (the sound setting lives in the Story save; with five chapters no story choice is open yet).
  const sound = await evaluate('window.gridbound.profile().sound');
  await click('#settings');
  await wait('Boolean(document.querySelector("#setting-sound"))');
  await click('#setting-sound');
  await wait(`window.gridbound.profile().sound === ${!sound}`);
  await wait(`${status()}.startsWith("Saved") && ${revision()} !== ${JSON.stringify(before)}`);
  assert.deepEqual(await evaluate('window.__statuses.filter(text => text.startsWith("warn"))'), [], 'a real save never shows the warning');
  await screenshot('artifacts/save-safety-quiet-save.png');
  await click('#modal [data-close]');
  await wait('!document.querySelector("#modal[open]")');

  // The default path now has multi-tab protection: another tab committing this Commander makes this tab read-only.
  await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const doc = (await repository.list()).sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
    await repository.commit({ ...doc, name: 'Other tab' }, doc.revision);
    repository.close();
  })()`);
  await wait(`${status()}.includes("Another tab")`);
  assert.equal(await evaluate('document.querySelector("#storage-status").dataset.level'), 'warn');
  assert.equal(await evaluate("localStorage.getItem('gridbound.v3')"), raw, 'a read-only tab never falls back to the legacy key');
  assert.deepEqual(errors, [], 'no console errors');
}, { width: 390, height: 844, mobile: true });

// When no Commander can be created (here: IndexedDB writes fail), the progress stays on the legacy save, the
// backup is a legacy envelope, and the Save dialog's primary action keeps the live progress in a Commander.
await withBrowser(async ({ send, wait, evaluate, click, screenshot }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `{ const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (localStorage.getItem('qa.failPut')) throw new DOMException('QA quota exceeded', 'QuotaExceededError'); return put.apply(this, args); }; }` });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('qa.failPut', '1'); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  await evaluate('window.__beforeReload = true'); await send('Page.reload');
  await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
  assert.equal((await evaluate(docs)).length, 0, 'the migration could not be written');
  assert.match(await evaluate(status()), /quota/i, 'the failure is shown');
  const baseline = await evaluate(progress());
  assert.deepEqual({ cleared: baseline.cleared, gold: baseline.gold }, { cleared: 5, gold: 4321 }, 'the live progress is the legacy save');

  await evaluate('window.__blobs = []; const create = URL.createObjectURL; URL.createObjectURL = blob => { if (blob.type === "application/json") window.__blobs.push(blob); return create(blob); }');
  await click('#settings');
  await wait('Boolean(document.querySelector("dialog[open] #export-save"))');
  await click('#export-save');
  await wait('window.__blobs.length === 1');
  const backup = await evaluate('window.__blobs[0].text()');
  const envelope = JSON.parse(backup);
  assert.equal(envelope.kind, 'gridbound-legacy'); assert.deepEqual(envelope.profile.cleared, [0, 1, 2, 3, 4]); assert.equal(envelope.profile.gold, 4321);
  await evaluate('document.querySelector("dialog[open]").close()');

  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #continue-mine"))');
  assert.equal(await evaluate('document.querySelector("#continue-mine").classList.contains("primary") && !document.querySelector("#new-commander").classList.contains("primary")'), true, 'Continue my progress is the primary action');
  assert.match(await evaluate('document.querySelector("#continue-summary").textContent'), /chapter 5 · 4,321 gold/);
  await screenshot('artifacts/save-safety-continue.png');
  await click('#new-commander');
  await wait('Boolean(document.querySelector("dialog[open] #new-confirm"))');
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /not in a Commander file yet/);
  await click('#new-cancel');
  await wait('Boolean(document.querySelector("dialog[open] #continue-mine"))');
  // While writes still fail, Continue keeps its dialog open and says why instead of closing silently.
  await click('#continue-mine');
  await wait('/quota/i.test(document.querySelector("dialog[open] #profile-error")?.textContent ?? "")', 10000);
  assert.equal(await evaluate('document.querySelector("dialog[open] #creating-status").textContent'), 'Not saved');
  await click('dialog[open] .btn[data-close]');
  await wait('!document.querySelector("dialog[open]")');
  await evaluate("localStorage.removeItem('qa.failPut')");
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #continue-mine"))');
  await click('#continue-mine');
  await wait(`${docs}.then(list => list.length === 1)`, 10000);
  await wait(`${status()}.startsWith("Saved")`);
  const [file] = await evaluate(docs);
  assert.deepEqual({ cleared: file.cleared, gold: file.gold, crystal: file.crystal }, { cleared: 5, gold: 4321, crystal: 40 }, 'Continue keeps the live progress and bank');
  assert.equal(await evaluate('Object.keys(localStorage).filter(k => k.startsWith("gridbound.v3.backup-")).length'), 1, 'backed up first');

  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #import-save"))');
  await evaluate(`(() => { const input = document.querySelector('#import-save'); const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(backup)}], 'Gridbound-Save.json')); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(`${docs}.then(list => list.length === 2)`, 10000);
  await wait('Boolean(document.querySelector("dialog[open] [data-import-note]"))');
  await click('dialog[open] [data-close].btn');
  await wait('!document.querySelector("dialog[open]")');
  const copy = (await evaluate(docs)).find(doc => doc.id !== file.id);
  assert.deepEqual({ cleared: copy.cleared, gold: copy.gold, crystal: copy.crystal }, { cleared: 5, gold: 4321, crystal: 0 }, 'the legacy backup imports; next to a Commander it brings no second bank');

  // Deleting files: the next one takes over, and deleting the last starts a fresh Commander without touching gridbound.v3.
  const legacy = await evaluate("localStorage.getItem('gridbound.v3')");
  for (const remaining of [1, 1]) {
    await wait(`${status()}.startsWith("Saved")`);
    await click('.town-spot[data-open-action="profiles"]');
    await wait('Boolean(document.querySelector("dialog[open] #delete-commander"))');
    await click('#delete-commander');
    await wait('Boolean(document.querySelector("dialog[open] #delete-word"))');
    await evaluate(`(() => { const input = document.querySelector('#delete-word'); input.value = 'DELETE'; input.dispatchEvent(new Event('input')); })()`);
    await click('#delete-confirm');
    await wait(`Boolean(document.querySelector("dialog[open] #new-commander")) && ${docs}.then(list => list.length === ${remaining})`, 10000);
    await evaluate('document.querySelector("dialog[open]").close()');
  }
  const [fresh] = await evaluate(docs);
  assert.deepEqual({ cleared: fresh.cleared, name: fresh.name }, { cleared: 0, name: 'Commander' }, 'deleting the last file starts a fresh Commander');
  await wait(`${status()}.startsWith("Saved")`);
  assert.equal((await evaluate(progress())).cleared, 0);
  assert.equal(await evaluate("localStorage.getItem('gridbound.v3')"), legacy, 'the legacy save is not overwritten by the fresh profile');
}, { width: 390, height: 844, mobile: true });

// After a failed save, leaving the screen or resuming a suspended battle offers retry/export instead of doing
// nothing, and a successful retry resumes the checkpoint.
await withBrowser(async ({ send, wait, evaluate, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `{ const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (localStorage.getItem('qa.failPut')) throw new DOMException('QA quota exceeded', 'QuotaExceededError'); return put.apply(this, args); }; }` });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`indexedDB.deleteDatabase('gridbound.commanders.r1'); localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  await evaluate('window.__beforeReload = true'); await send('Page.reload');
  await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
  await wait(`${status()}.startsWith("Saved")`);
  const toChapter = async () => {
    await click.nav('campaign');
    await click('.map-act-tab[data-act="1"]');
    await wait('Boolean(document.querySelector(\'.map-node-pin[data-zone="5"]\'))');
    await click('.map-node-pin[data-zone="5"]');
    await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
  };
  await toChapter();
  await click('[data-depart=adventure]');
  await wait('window.gridbound.battle.mode === "adventure" && window.gridbound.battle.status === "ready"');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await click.retreat();
  await wait('Boolean(document.querySelector("#suspend-run"))');
  await click('#suspend-run');
  await wait('window.gridbound.inTown === true');
  await wait(`${status()}.startsWith("Saved")`);
  await toChapter();
  // The next save fails (storage full): leaving the screen and resuming the checkpoint both explain and offer retry/export.
  await evaluate("localStorage.setItem('qa.failPut', '1')");
  await click('#settings');
  await wait('Boolean(document.querySelector("dialog[open] #setting-sound"))');
  await click('#setting-sound');
  await wait(`document.querySelector("#storage-status").dataset.level === "warn"`);
  await evaluate('document.querySelector("dialog[open]").close()');
  await click('#home');
  await wait('Boolean(document.querySelector("dialog[open] #retry-save"))');
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /before you leave this screen/, 'a blocked navigation explains itself');
  await click('dialog[open] .btn[data-close]');
  await wait('!document.querySelector("dialog[open]")');
  await click('[data-depart=adventure]');
  await wait('Boolean(document.querySelector("dialog[open] #retry-save"))');
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /cannot be resumed/, 'Depart explains why it cannot resume');
  assert.equal(await evaluate('window.gridbound.inTown'), true);
  await evaluate("localStorage.removeItem('qa.failPut')");
  await click('#retry-save');
  await wait('window.gridbound.inTown === false && window.gridbound.battle.status === "ready"');
  assert.equal(await evaluate('window.gridbound.battle.floor'), 6, 'the suspended chapter resumes');
  await wait(`${status()}.startsWith("Saved")`);
  // A wave result that could not be saved: a successful Retry closes the 'Not saved' dialog, so Next is not covered.
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await wait(`${status()}.startsWith("Saved")`);
  await evaluate("localStorage.setItem('qa.failPut', '1')");
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
  await wait('Boolean(document.querySelector("dialog[open] #retry-save"))', 15000);
  await evaluate("localStorage.removeItem('qa.failPut')");
  await click('#retry-save');
  await wait('Boolean(document.querySelector("#result-screen:not([hidden]) #next-wave")) && !document.querySelector("#next-wave").disabled', 15000);
  assert.equal(await evaluate('document.querySelector("#modal").open'), false, 'a successful retry closes the Not saved dialog');
  await click('#next-wave');
  await wait('window.gridbound.battle.status === "ready" && window.gridbound.battle.stage === 1');
  // The battle-start save fails: Retreat offers retry/export (never a silent dead button); after a retry it asks Suspend or Abandon.
  await evaluate("localStorage.setItem('qa.failPut', '1')");
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await wait(`document.querySelector("#storage-status").dataset.level === "warn"`);
  await click.retreat();
  await wait('Boolean(document.querySelector("dialog[open] #retry-save"))');
  assert.match(await evaluate('document.querySelector("dialog[open]").textContent'), /before you leave this screen/, 'Retreat after a failed save explains itself');
  assert.equal(await evaluate('window.gridbound.inTown'), false);
  await evaluate("localStorage.removeItem('qa.failPut')");
  await click('#retry-save');
  await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
  await click('dialog[open] .leave-actions [data-close]');
  await wait('!document.querySelector("dialog[open]") && window.gridbound.battle.status === "fighting"');
  await click.retreat();
  await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
  await click('#suspend-run');
  await wait('window.gridbound.inTown === true');
}, { width: 390, height: 844, mobile: true });

// Without IndexedDB the Commander is session-only, so gridbound.v3 mirrors its Story progress and bank: a
// challenge tab (whose profile has 0 gold) never writes 0 gold there, and the next visit migrates it again.
await withBrowser(async ({ send, wait, evaluate, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `indexedDB.open = () => { throw new Error('QA: IndexedDB blocked'); };` });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  const legacy = () => evaluate("(() => { const p = JSON.parse(localStorage.getItem('gridbound.v3')); return { cleared: p.cleared.length, gold: p.gold, crystal: p.economy.commanderCrystal }; })()");
  for (let visit = 0; visit < 2; visit++) {
    await evaluate('window.__beforeReload = true'); await send('Page.reload');
    await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
    await wait(`${status()}.startsWith("Browser storage limited")`);
    const live = await evaluate(progress());
    assert.deepEqual({ cleared: live.cleared, gold: live.gold }, { cleared: 5, gold: 4321 }, `visit ${visit + 1} migrates the mirrored save`);
    await click.nav('raid');
    await wait('document.querySelector("#bank-wallet")?.textContent.includes("40")');
    assert.equal(await evaluate('window.gridbound.profile().gold'), 0, 'the Raid profile cannot spend Story gold');
    assert.deepEqual(await legacy(), { cleared: 5, gold: 4321, crystal: 40 }, 'the legacy mirror keeps Story gold and the bank');
    await click.nav('camp');
  }
  // Switching language would reload a session-only Commander away; its Export button downloads the real document.
  await evaluate('window.__blobs = []; const create = URL.createObjectURL; URL.createObjectURL = blob => { if (blob.type === "application/json") window.__blobs.push(blob); return create(blob); }');
  await click('#settings');
  await wait('Boolean(document.querySelector(\'dialog[open] [data-lang="id"]\'))');
  await click('dialog[open] [data-lang="id"]');
  await wait('Boolean(document.querySelector("dialog[open] #lang-export"))');
  await click('#lang-export');
  await wait('window.__blobs.length === 1');
  const exported = JSON.parse(await evaluate('window.__blobs[0].text()'));
  assert.equal(typeof exported.commanderId, 'string', 'the language-switch export is the Commander document');
  assert.deepEqual(exported.story.slots[3].state.cleared, [0, 1, 2, 3, 4]);
}, { width: 390, height: 844, mobile: true });

// A Commander lookup that never answers (stalled IndexedDB) cannot leave progress only in RAM: once the boot
// check times out, the raw legacy save is backed up and the live profile is written to gridbound.v3 again.
await withBrowser(async ({ send, wait, evaluate, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (localStorage.getItem('qa.hang')) indexedDB.open = () => ({});` });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`localStorage.clear(); localStorage.setItem('qa.hang', '1'); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  const raw = await evaluate("localStorage.getItem('gridbound.v3')");
  await evaluate('window.__beforeReload = true'); await send('Page.reload');
  await wait('!window.__beforeReload && Boolean(document.querySelector("#town-screen:not([hidden]) .town-spot") && document.querySelector("canvas"))', 20000);
  await wait('Object.keys(localStorage).some(k => k.startsWith("gridbound.v3.backup-"))', 10000);
  assert.equal(await evaluate('localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith("gridbound.v3.backup-")))'), raw, 'the raw save is backed up before it is rewritten');
  // (The HUD sound button is hidden on phone widths, so toggle it in Settings.)
  await click('#settings');
  await wait('Boolean(document.querySelector("dialog[open] #setting-sound"))');
  await click('#setting-sound');
  await wait("JSON.parse(localStorage.getItem('gridbound.v3')).sound === true", 5000);
  const kept = await evaluate("(() => { const p = JSON.parse(localStorage.getItem('gridbound.v3')); return { cleared: p.cleared.length, gold: p.gold }; })()");
  assert.deepEqual(kept, { cleared: 5, gold: 4321 }, 'the legacy save keeps the progress while no Commander answers');
}, { width: 390, height: 844, mobile: true });

// A corrupt legacy save stays read-only and is not migrated at boot, but the Save dialog still offers to keep
// the live progress in a Commander, which never writes gridbound.v3.
await withBrowser(async ({ send, wait, evaluate, click }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`new Promise(resolve => { const request = indexedDB.deleteDatabase('gridbound.commanders.r1'); request.onsuccess = request.onerror = request.onblocked = () => resolve(); })`);
  await evaluate("localStorage.clear(); localStorage.setItem('gridbound.v3', '{invalid')");
  await evaluate('window.__beforeReload = true'); await send('Page.reload');
  await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
  assert.equal((await evaluate(docs)).length, 0, 'a corrupt save is not migrated at boot');
  await click('.town-spot[data-open-action="profiles"]');
  await wait('Boolean(document.querySelector("dialog[open] #continue-mine"))');
  assert.equal(await evaluate('document.querySelector("#continue-mine").classList.contains("primary")'), true);
  await click('#continue-mine');
  await wait(`${docs}.then(list => list.length === 1)`, 10000);
  await wait('!document.querySelector("dialog[open]")');
  assert.equal(await evaluate("localStorage.getItem('gridbound.v3')"), '{invalid', 'the corrupt save is left as it was');
}, { width: 390, height: 844, mobile: true });

// Two tabs that boot together on a pre-Commander save (a restored browser session) migrate it once: one
// Commander, one Crystal bank.
await withBrowser(async ({ send, wait, evaluate }) => {
  await send('Page.navigate', { url: `${url}src/game/save.ts` });
  await wait('document.readyState === "complete"');
  await evaluate(`new Promise(resolve => { const request = indexedDB.deleteDatabase('gridbound.commanders.r1'); request.onsuccess = request.onerror = request.onblocked = () => resolve(); })`);
  await evaluate(`localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)})); for (let i = 0; i < 2; i++) { const frame = document.createElement('iframe'); frame.src = ${JSON.stringify(url)}; frame.width = 390; frame.height = 844; document.body.append(frame); }`);
  await wait('[...document.querySelectorAll("iframe")].every(frame => frame.contentWindow.gridbound)', 60000);
  await wait('[...document.querySelectorAll("iframe")].every(frame => frame.contentDocument.querySelector("#storage-status").textContent.startsWith("Saved"))', 15000);
  const files = await evaluate(docs);
  assert.equal(files.length, 1, 'the save is migrated once');
  assert.equal(files[0].crystal, 40, 'with its one bank');
}, { width: 900, height: 900 });
// Phone contract I5/I6 (SAFE): backups on every build, on a phone (390×844, touch, Android Chrome, the normal web build). Save files says
// where the saves live and offers Download, Copy backup as text and Paste backup; a copy or a download notes the backup time per viewer
// (gridbound.ui.backupAt); the pasted text restores the file as a second Commander; the backup reminder opens on request and 'Not now' closes it.
await withBrowser(async ({ send, wait, evaluate, click, touch }) => {
  await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
  await evaluate(`new Promise(resolve => { const request = indexedDB.deleteDatabase('gridbound.commanders.r1'); request.onsuccess = request.onerror = request.onblocked = () => resolve(); })`);
  await evaluate(`localStorage.clear(); localStorage.setItem('gridbound.v3', JSON.stringify(${JSON.stringify(seed)}))`);
  await evaluate('window.__beforeReload = true'); await send('Page.reload');
  await wait('!window.__beforeReload && window.gridbound && document.querySelector("#town-screen:not([hidden]) .town-spot")', 20000);
  await wait(`${status()}.startsWith("Saved")`, 15000);
  const saveFiles = async () => { await click('#menu-button'); await wait('Boolean(document.querySelector(".more-scene"))'); await touch.tap('.more-scene [data-open-action="profiles"]'); await wait('Boolean(document.querySelector("dialog[open] #import-text-button"))'); };
  await saveFiles();
  assert.ok(await evaluate('Boolean(document.querySelector("dialog[open] #export-text-commander")) && Boolean(document.querySelector("dialog[open] #export-commander"))'), 'Save files offers Download and Copy backup as text on the web build');
  assert.match(await evaluate('document.querySelector("#storage-note")?.textContent ?? ""'), /\S/, 'Save files says where the saves live');
  assert.equal(await evaluate("localStorage.getItem('gridbound.ui.backupAt')"), null, 'no backup yet');
  await touch.tap('#export-text-commander');
  await wait('Boolean(document.querySelector("dialog[open] #backup-text"))');
  const text = await evaluate('document.querySelector("#backup-text").value');
  assert.equal(typeof JSON.parse(text).commanderId, 'string', 'the text is the Commander document');
  assert.match(await evaluate('document.querySelector("dialog[open] .hint").textContent'), /Paste backup/, 'the copy view says how to restore it');
  await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await touch.tap('#backup-copy');
  await wait('document.querySelector("#backup-note").textContent.length > 0');
  if (await evaluate('document.querySelector("#backup-note").textContent.startsWith("Copied")')) assert.ok(Number(await evaluate("localStorage.getItem('gridbound.ui.backupAt')")) > 0, 'a copy notes the backup time');
  await touch.tap('#backup-back');
  await wait('Boolean(document.querySelector("dialog[open] #export-commander"))');
  await evaluate("localStorage.removeItem('gridbound.ui.backupAt')");
  await touch.tap('#export-commander');
  await wait("Number(localStorage.getItem('gridbound.ui.backupAt')) > 0");
  // Paste backup restores the copied text as a second file.
  await touch.tap('#import-text-button');
  await wait('Boolean(document.querySelector("dialog[open] #import-text"))');
  await touch.tap('#import-text');
  await send('Input.insertText', { text });
  await wait('!document.querySelector("#import-text-confirm").disabled');
  await touch.tap('#import-text-confirm');
  await wait('Boolean(document.querySelector("dialog[open] [data-import-note]"))', 15000);
  await wait(`${docs}.then(list => list.length === 2)`, 10000);
  await evaluate('document.querySelector("dialog[open] [data-close]").click()');
  await wait('!document.querySelector("dialog[open]")');
  // The reminder (forced: automation skips it) offers Copy backup first and focuses 'Not now', which closes it.
  await evaluate('window.gridbound.backupReminder(true)');
  await wait('Boolean(document.querySelector("dialog[open] #reminder-copy"))');
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Not now', "'Not now' takes the focus");
  await touch.tap('dialog[open] [data-close]:not(.modal-close)');
  await wait('!document.querySelector("dialog[open]")');
}, { phone: { width: 390, height: 844, dpr: 3, ua: 'android' } });
console.log('PASS save safety browser: boot migration with backup, guarded New Commander, importable export and import, reload, quiet saves, legacy fallback and Continue my progress, session-only mirror, retry prompts after a failed save, stalled-IndexedDB fallback, Continue for a protected save, one migration across tabs, phone backups (copy, download, paste, reminder)');
