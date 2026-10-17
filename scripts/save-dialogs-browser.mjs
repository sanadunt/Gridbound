// Storage problems never leave dead controls (SAVE package, navigation contract R6, §5.3, §5.5):
// - another tab saving this Commander opens a blocking 'Opened in another tab' dialog (Reload focused, Download save backup, Keep viewing);
//   Escape and the browser's Back keep it, every refused action (◀ Back, MENU, a town button, FIGHT!) opens it again, Reload brings the
//   game back, and a battle is left after a 'Leave without saving' confirmation with nothing written (the file's revision is unchanged);
// - a backup imported (or a Delete that activates a file) that still owes a camp scene never starts the scene under the open dialog: the
//   dialog's Close works, and the scene plays once it is closed;
// - Save files says what it did: Rename is offered once the name changed and confirms the new name, a slot save says where it went, an empty
//   slot reads 'Empty' once, and Continue latest is disabled with its reason when there is nothing to continue.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const OUT = 'artifacts/save-dialogs';
const SPOOF = "Object.defineProperty(navigator, 'webdriver', { get: () => false })";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Every Commander file in IndexedDB, newest first: id, name, revision and its Story progress. */
const docs = `(async () => {
  const { openCommanderRepository } = await import('/src/game/commander.ts');
  const repository = await openCommanderRepository();
  const list = await repository.list();
  repository.close();
  return list.sort((a, b) => b.lastPlayed - a.lastPlayed).map(doc => ({ id: doc.commanderId, name: doc.name, revision: doc.revision, cleared: doc.story.slots[3].state?.cleared.length }));
})()`;
await mkdir(OUT, { recursive: true });
const route = '(document.querySelector(".town-game-shell")?.dataset.townRoute ?? "")';
const staleUp = 'document.querySelector("#modal").open && Boolean(document.querySelector("#modal #stale-reload")) && window.gridbound.navState().blocking';

// ---- 1. Another tab saves: town, ready window and a fight (390×844, touch).
await withBrowser(async ({ send, evaluate, wait, click, key, screenshot, errors }) => {
  await seedSave(send, ACT_TWO_SAVE, 'en');
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector(".town-game-shell")', 20000);
  const nav = () => evaluate('window.gridbound.navState()');
  const revision = async () => (await evaluate(docs))[0].revision;
  const settled = () => wait('document.querySelector("#storage-status").textContent.startsWith("Saved")', 10000);
  /** A second tab of the game (same browser profile) toggles the sound: it commits this Commander, so this tab goes read-only. */
  const otherTab = async () => {
    await settled(); await sleep(300);
    const before = await revision();
    const { targetId } = await send('Target.createTarget', { url, background: true });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const other = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
    for (let i = 0; i < 200 && !(await other('Boolean(window.gridbound) && document.querySelector("#storage-status")?.textContent.startsWith("Saved")')); i++) await sleep(100);
    await other('document.querySelector("#sound").click()');
    for (let i = 0; i < 100 && await revision() === before; i++) await sleep(100);
    await send('Target.closeTarget', { targetId });
    const after = await revision();
    assert.ok(after > before, 'the other tab committed');
    return after;
  };
  /** The stale dialog is up: blocking, Reload focused, Escape and the browser's Back keep it. */
  const staleDialog = async (name, { backs = false } = {}) => {
    await wait(staleUp, 10000).catch(async () => { await screenshot(`${OUT}/fail-${name.replace(/\W+/g, '-')}.png`); throw new Error(`${name}: no stale dialog: ${JSON.stringify(await nav())}`); });
    const s = await nav();
    assert.equal(s.modal, 'Opened in another tab', `${name}: the stale dialog`);
    assert.equal(await evaluate('document.activeElement?.id'), 'stale-reload', `${name}: Reload is focused`);
    assert.deepEqual(await evaluate('[...document.querySelectorAll("#modal button")].map(b => b.textContent)'), ['Reload', 'Download save backup', 'Keep viewing (read-only)'], `${name}: its three labelled ways out (no ×)`);
    if (!backs) return;
    for (const press of [() => key('Escape'), () => evaluate('history.back(), true')]) {
      await press(); await sleep(400);
      assert.equal(await evaluate(staleUp), true, `${name}: a Back keeps the blocking dialog`);
    }
    assert.equal(await evaluate('location.protocol.startsWith("http")'), true, `${name}: still in the game`);
  };
  const keepViewing = async () => { await click('#stale-view'); await wait('!document.querySelector("#modal").open'); };

  // Town: the Quest Board. Every refused action explains itself again; nothing is written.
  await click.nav('quests');
  const town = await otherTab();
  await staleDialog('town', { backs: true });
  await screenshot(`${OUT}/stale-town-390.png`);
  await keepViewing();
  for (const control of ['#home', '#menu-button', '#town-screen .town-scene button:not([disabled])']) {
    await click(control);
    await staleDialog(`town ${control}`);
    await keepViewing();
  }
  assert.equal(await evaluate(route), 'quests', 'a read-only tab stays where it is');
  assert.equal(await revision(), town, 'a read-only tab writes nothing');
  // Reload: the game comes back on the latest save, and navigation works again.
  await click('#home'); await staleDialog('town reload'); await click('#stale-reload');
  await wait('window.gridbound && document.querySelector(".town-game-shell") && !document.querySelector("#modal").open', 20000);
  await settled();
  assert.equal((await nav()).modal, null, 'no stale dialog after the reload');
  await click.nav('quests'); await click('#home'); await wait(`${route} === "more"`);

  // The ready window: FIGHT! explains itself, ◀ Back leaves without saving after a confirmation.
  const toDossier = async () => { await click.nav('campaign'); await click('.map-selected [data-mission]'); await wait(`${route} === "mission"`); };
  await toDossier(); await click('.world-map-dossier [data-depart="adventure"]');
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
  const ready = await otherTab();
  await staleDialog('ready window', { backs: true });
  await keepViewing();
  await click('#start'); await staleDialog('FIGHT!');
  assert.equal(await evaluate('window.gridbound.battle.status'), 'ready', 'FIGHT! does not start a fight that could not be saved');
  await keepViewing();
  await click('#ready-back');
  await wait('Boolean(document.querySelector("#modal #stale-leave"))');
  assert.equal(await evaluate('document.activeElement?.textContent'), 'Cancel', 'the leave confirmation focuses Cancel');
  assert.match(await evaluate('document.querySelector("#modal").textContent'), /will not be saved/);
  await screenshot(`${OUT}/stale-leave-390.png`);
  await click('#stale-leave');
  await wait(`window.gridbound.inTown && ${route} === "mission"`);
  assert.equal(await revision(), ready, 'leaving a read-only battle writes nothing');
  await click('#home'); await staleDialog('town after leaving'); await click('#stale-reload');
  await wait('window.gridbound && document.querySelector(".town-game-shell") && !document.querySelector("#modal").open', 20000);

  // A fight: the dialog pauses it, Keep viewing goes on (unsaved); its victory cannot be saved, and Ⅱ Menu still leads out.
  await settled();
  await toDossier(); await click('.world-map-dossier [data-depart="adventure"]');
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
  await click('#start'); await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('window.gridbound.step(2)');
  const fight = await otherTab();
  await staleDialog('fight', { backs: true });
  assert.equal(await evaluate('window.gridbound.battle.status'), 'paused', 'the dialog pauses the fight');
  await screenshot(`${OUT}/stale-battle-390.png`);
  await keepViewing();
  await wait('window.gridbound.battle.status === "fighting"', 3000).catch(() => { throw new Error('Keep viewing goes on with the fight'); });
  const before = await evaluate('window.gridbound.profile().cleared.length');
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await staleDialog('victory');
  await keepViewing();
  assert.equal(await evaluate('document.querySelector("#result-screen").hidden && !document.querySelector("#start-overlay").hidden'), true, 'the arena offers its result again');
  await click('#pause'); await wait('Boolean(document.querySelector("#modal #pause-retreat"))');
  assert.equal(await evaluate('document.querySelector("#pause-retreat").textContent'), 'Leave battle…');
  await click('#pause-retreat'); await wait('Boolean(document.querySelector("#modal #stale-leave"))');
  await click('#stale-leave');
  await wait(`window.gridbound.inTown && ${route} === "mission"`);
  assert.equal(await revision(), fight, 'nothing of the fight was written');
  assert.equal(await evaluate('window.gridbound.profile().cleared.length'), before, 'the town shows the file as saved, not the unsaved fight');
  const pageErrors = errors.filter(e => !/Commander storage/.test(JSON.stringify(e)));
  assert.deepEqual(pageErrors.map(e => e.text ?? e.description ?? JSON.stringify(e).slice(0, 200)), [], 'no console errors');
}, { width: 390, height: 844, mobile: true });

// ---- 2. A real player (webdriver hidden) imports a backup that owes a join scene, deletes a file whose successor owes one, renames and saves.
const seed = { ...structuredClone(ACT_TWO_SAVE), roster: [0, 4, 3, 2], loadouts: { ...structuredClone(ACT_TWO_SAVE.loadouts), 2: { skills: [0, 1], talents: [], xp: 0, slot: 4 } } };
// Taken after a first clear, before the camp scenes played: it still owes Sable's join scene.
const backup = JSON.stringify({ kind: 'gridbound-legacy', version: 3, profile: { ...structuredClone(seed), journey: { stars: {}, chests: 0, heroic: [], depth: 0, pendingRecruitScenes: [2] } } });
await withBrowser(async ({ send, evaluate, wait, click, key, screenshot, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SPOOF });
  await seedSave(send, seed, 'en');
  await send('Page.navigate', { url });
  await wait('window.gridbound && !document.querySelector("#title-screen").hidden', 20000);
  await click('#title-screen'); await sleep(300);
  await click('#title-enter'); await wait('document.querySelector("#title-screen").hidden', 5000);
  await sleep(800);
  const saveFiles = async () => { if (await evaluate(`${route} !== "more"`)) { await click('#menu-button'); await wait('Boolean(document.querySelector(".more-scene"))'); } await click('.more-scene [data-open-action="profiles"]'); await wait('Boolean(document.querySelector("#modal #import-save"))'); };
  const sceneState = () => evaluate('({ scene: Boolean(document.querySelector(".dialogue-scene:not(.closing)")), open: document.querySelector("#modal").open, inert: document.querySelector("#modal").inert })');
  /** A scene that waited for the dialog plays once it is closed (a real tap on its Close), and Skip ends it. */
  const closeThenScene = async name => {
    await click('#modal > .btn[data-close]');
    await wait('Boolean(document.querySelector(".dialogue-scene:not(.closing)"))', 5000).catch(async () => { throw new Error(`${name}: the owed scene did not play after the dialog closed: ${JSON.stringify(await sceneState())}`); });
    assert.equal(await evaluate('document.querySelector("#modal").open'), false, `${name}: the dialog is gone`);
    await click('.dialogue-scene .dialogue-skip');
    await wait('!document.querySelector(".dialogue-scene")');
    // After the camp's scenes comes its unlock card (once per viewer): Later.
    await sleep(500);
    if (await evaluate('Boolean(document.querySelector("#modal[open] .unlock-card"))')) { await click('#modal .unlock-card ~ [data-close]'); await wait('!document.querySelector("#modal").open'); }
  };

  // Import: 'Backup imported' stays usable (never inert), the join scene waits for its Close.
  await saveFiles();
  await evaluate(`(() => { const input = document.querySelector('#import-save'); const data = new DataTransfer(); data.items.add(new File([${JSON.stringify(backup)}], 'owed-scene.json')); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait('Boolean(document.querySelector("#modal [data-import-note]"))', 15000);
  await sleep(600);
  assert.deepEqual(await sceneState(), { scene: false, open: true, inert: false }, 'no scene under the import dialog, which stays usable');
  await screenshot(`${OUT}/import-done-390.png`);
  await closeThenScene('import');
  assert.equal(await evaluate('window.gridbound.profile().journey.pendingRecruitScenes'), undefined, 'the join scene played once');

  // Delete: the next file takes over; it owes a join scene, which waits for the Save files dialog to close.
  const [imported, original] = await evaluate(docs);
  await evaluate(`(async () => {
    const { openCommanderRepository } = await import('/src/game/commander.ts');
    const repository = await openCommanderRepository();
    const doc = (await repository.list()).find(d => d.commanderId === ${JSON.stringify(original.id)}), next = structuredClone(doc);
    next.story.slots.find(slot => slot.slotId === 'auto').state.journey.pendingRecruitScenes = [2];
    await repository.commit(next, doc.revision);
    repository.close();
  })()`);
  await saveFiles();
  await click('#delete-commander'); await wait('Boolean(document.querySelector("#delete-word"))');
  await click('#delete-word'); await send('Input.insertText', { text: 'DELETE' });
  await click('#delete-confirm');
  await wait(`Boolean(document.querySelector("#modal #import-save")) && document.querySelector("#profiles-notice")?.textContent === ${JSON.stringify(`Deleted ${imported.name}.`)}`, 15000);
  await sleep(600);
  assert.deepEqual(await sceneState(), { scene: false, open: true, inert: false }, 'no scene under Save files after a Delete');
  await closeThenScene('delete');

  // Rename: offered once the name changed, and it says so; then the field matches again and Rename rests.
  await saveFiles();
  assert.equal(await evaluate('document.querySelector("#rename-commander").disabled'), true, 'Rename waits for a new name');
  await click('#commander-name');
  await evaluate('document.querySelector("#commander-name").select()');
  await send('Input.insertText', { text: 'Ember Keeper' });
  assert.equal(await evaluate('document.querySelector("#rename-commander").disabled'), false, 'a new name offers Rename');
  await click('#rename-commander');
  await wait('document.querySelector("#profiles-notice")?.textContent === "Renamed to Ember Keeper."', 10000);
  assert.equal(await evaluate('document.querySelector("#modal .save-file.current b").textContent'), 'Ember Keeper');
  assert.equal(await evaluate('document.querySelector("#profiles-notice").getAttribute("role")'), 'status');
  assert.equal(await evaluate('document.querySelector("#rename-commander").disabled'), true, 'the saved name rests Rename again');

  // Slots: an empty one reads 'Empty' once; a save says where it went; Continue latest without a checkpoint is disabled with its reason.
  const slotText = id => evaluate(`document.querySelector('[data-load-slot="${id}"]').closest('.save-file').querySelector('small').textContent`);
  assert.equal(await slotText('manual-2'), 'Empty', 'an empty slot says Empty once');
  assert.equal(await evaluate('document.querySelector("#continue-latest").disabled'), true, 'nothing to continue: disabled');
  assert.match(await evaluate('document.querySelector("#continue-hint").textContent'), /No saved battle in this mode yet/);
  // Brought into view, the reason and the button sit inside the dialog and above its sticky Close (never under it).
  const shown = await evaluate(`[...['#continue-hint', '#continue-latest']].map(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(), d = document.querySelector('#modal').getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { sel, inside: r.top >= d.top && r.bottom <= d.bottom, uncovered: hit === el || el.contains(hit) }; })`);
  assert.ok(shown.every(e => e.inside && e.uncovered), `Continue latest and its reason are visible: ${JSON.stringify(shown)}`);
  await screenshot(`${OUT}/save-files-390.png`);
  // The note is part of the re-render: from the first frame the new list is up nothing moves (a Load tapped right after the save lands on Load).
  await evaluate(`(() => { document.querySelector('[data-load-slot="manual-1"]').dataset.before = '1'; window.__loadTops = []; const t0 = performance.now(); const tick = () => { const b = document.querySelector('[data-load-slot="manual-1"]:not([data-before])'); if (b) window.__loadTops.push(Math.round(b.getBoundingClientRect().top)); if (performance.now() - t0 < 8000 && window.__loadTops.length < 30) requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
  await click('[data-save-slot="manual-1"]');
  await wait('window.__loadTops.length >= 30', 10000);
  assert.equal(new Set(await evaluate('window.__loadTops')).size, 1, `the Save files note never pushes the controls down after the re-render: ${await evaluate('JSON.stringify(window.__loadTops)')}`);
  assert.equal(await evaluate('document.querySelector("#modal .profiles-notice").textContent'), 'Saved to Slot 1.');
  await wait('document.querySelector("#profiles-notice")?.textContent === "Saved to Slot 1."', 10000);
  assert.match(await slotText('manual-1'), /^Saved · /);
  await click('#modal > .btn[data-close]'); await wait('!document.querySelector("#modal").open');
  assert.deepEqual(errors.map(e => e.text ?? e.description ?? JSON.stringify(e).slice(0, 200)), [], 'no console errors');
}, { width: 390, height: 844, mobile: true });
console.log('SAVE DIALOG BROWSER TESTS PASSED');
