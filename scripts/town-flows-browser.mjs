// Town flows never spend, lose or misfire on one tap (TOWN package), at 390×844 (touch) unless noted:
// - benching and deploying keep the bench buttons where they were (the notice is a toast over the screen, the party list stays open);
// - a fresh Story departure with free party slots asks first (Fill party → Formation with the list open; Depart anyway; Cancel);
// - a job card only opens its inspector (no gold moves); Promote there spends it, then offers to equip the signature skill; Close closes it;
//   the camp guide's promotion Go opens on that job's inspector;
// - Reset asks first (Cancel focused, nothing changes) and is no longer under the formation grid;
// - Claim all after Chapter 1 equips the hunt gear on deployed heroes with empty slots, and its count is what it claims;
// - the MENU shows its commands first and all on screen at the 540×900 itch embed (8 heroes);
// - the Journal's companion buttons line up;
// - no 'GSAP target … not found' warning during a real (webdriver spoofed) town walk, where the free-slot question also shows unforced.
// - a quick double tap on Promote or on Buy & equip (Pixel 7, real touches) acts once (phone contract G7);
// - phone contract L8/L9/G8 (TOWN, part `phone`): at 375×553 a tapped job card's Promote and a tapped item's Buy & equip are on screen and hit
//   at their centre above the sticky Depart bar; at 390×844 a tab switch starts at the top while an equip keeps the scroll; at 852×393
//   (landscape) Party scrolls as one page and Depart is hit-testable at its end; a Crystal Exchange ware only opens its inspector (nothing
//   spent) and its Buy spends once;
// TOWN_ONLY=party|depart|jobs|doubletap|claim|menu|journal|gsap|phone|shots runs one part; screenshots go to artifacts/town-flows/.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const only = process.env.TOWN_ONLY;
const runs = part => !only || only.split(',').includes(part);
const out = 'artifacts/town-flows';
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const route = 'document.querySelector(".town-game-shell")?.dataset.townRoute';
const loadout = (slot, extra = {}) => ({ skills: [0, 1], talents: [], xp: 900, slot, ...extra });
// After Chapter 1: Aldric, Lyra and Rowan deployed (cap 3), Sable benched, the three hunt quests ready.
const AFTER_CH1 = { version: 3, gold: 1361, claimedQuests: [], ledger: { raids: 0, victories: 3, enemies: { wolf: 2, goblin: 1, spider: 1 } }, roster: [0, 4, 3, 2], cleared: [0], storyActive: [0, 4, 3], loadouts: { 0: loadout(1, { talents: ['foundation-1'] }), 4: loadout(7), 3: loadout(6), 2: loadout(8) }, bestFloor: 0, wins: 3, sound: false, motion: true };
// Chapter 4 reached: jobs open (rank 4), gold for one.
const JOBS_SAVE = { ...AFTER_CH1, gold: 1361, cleared: [0, 1, 2], roster: [0, 4, 3, 2, 7], storyActive: [0, 4, 3, 2, 7], loadouts: { ...AFTER_CH1.loadouts, 0: loadout(1, { xp: 4000, talents: ['vigor', 'focus'] }), 7: loadout(5) } };
// Late game: eight heroes deployed (the MENU's longest party), companions to replay in the Journal.
const LATE = { ...AFTER_CH1, gold: 4000, cleared: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], roster: [0, 4, 3, 2, 7, 1, 5, 6, 8], storyActive: [0, 4, 3, 2, 7, 1, 5, 6], loadouts: Object.fromEntries([0, 4, 3, 2, 7, 1, 5, 6, 8].map((id, i) => [id, loadout(i, { xp: 20000 })])) };

const boot = async ({ send, wait }, profile, lang) => {
  await seedSave(send, profile, lang);
  await send('Page.navigate', { url });
  await wait(`window.gridbound && ${route} === "camp"`, 20000);
};
/** The centre of a control as it is on screen now (no scrolling: a finger taps where the button is). */
const centre = (evaluate, selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top }; })()`);
const tapAt = async (send, point) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: point.x, y: point.y });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x, y: point.y });
};
const gold = evaluate => evaluate('window.gridbound.profile().gold');

if (runs('party') || runs('depart')) await withBrowser(async tools => {
  const { send, wait, evaluate, click, key, screenshot, errors } = tools;
  await boot(tools, AFTER_CH1);
  // Under automation the free-slot question is skipped (seeded saves rarely fill the party) unless a test asks for it.
  await evaluate('window.gridbound.emptySlotPrompt()');
  await click.nav('party');
  await click('[data-training-tab="formation"]');
  await wait('Boolean(document.querySelector("details.story-party"))');
  // A full party: the list starts closed; the player opens it and scrolls to the bench buttons near the sticky Depart bar.
  if (!await evaluate('document.querySelector("details.story-party").open')) await click('details.story-party summary');
  await wait('document.querySelector("details.story-party").open');
  await evaluate('document.querySelector(\'[data-story-toggle="2"]\').scrollIntoView({ block: "end" }); document.querySelector(".party-scene").scrollTop += 60;');
  await sleep(200);
  const rowan = await centre(evaluate, '[data-story-toggle="3"]'), sable = await centre(evaluate, '[data-story-toggle="2"]');
  const deploy = await evaluate('document.querySelector(".party-deploy").getBoundingClientRect().top');
  assert.ok(sable.y < deploy, `Sable's button is above the Depart bar (${sable.y} < ${deploy})`);
  // Bench Rowan: the notice is a toast, the list stays open and the buttons stay under the finger.
  await tapAt(send, rowan);
  await wait('window.gridbound.profile().storyActive.length === 2 && document.querySelector("#town-notice:not([hidden])")');
  const notice = await evaluate('(() => { const n = document.querySelector("#town-notice"), s = getComputedStyle(n); return { position: s.position, events: s.pointerEvents }; })()');
  assert.deepEqual(notice, { position: 'absolute', events: 'none' }, 'the notice overlays the screen and lets taps through');
  assert.equal(await evaluate('document.querySelector("details.story-party").open'), true, 'the party list stays open');
  const afterBench = await centre(evaluate, '[data-story-toggle="2"]');
  assert.ok(Math.abs(afterBench.y - sable.y) <= 8, `benching moved Sable's button by ${afterBench.y - sable.y}px`);
  if (runs('party')) await screenshot(`${out}/party-bench-390.png`);
  // The next tap lands where Sable's button was: it deploys her (np-04: it used to hit Depart and start the chapter with two heroes).
  await tapAt(send, sable);
  await wait('window.gridbound.profile().storyActive.includes(2)');
  assert.equal(await evaluate('window.gridbound.inTown'), true, 'still in town: no departure');
  assert.equal(await evaluate('document.querySelector("details.story-party").open'), true, 'the full party keeps the list open');
  const afterDeploy = await centre(evaluate, '[data-story-toggle="2"]');
  assert.ok(Math.abs(afterDeploy.y - sable.y) <= 8, `deploying moved Sable's button by ${afterDeploy.y - sable.y}px`);
  // Closing the list is remembered too.
  await click('details.story-party summary');
  await wait('!document.querySelector("details.story-party").open');
  await click('[data-formation="4"]');
  await wait('document.querySelector("#town-notice:not([hidden])")');
  assert.equal(await evaluate('document.querySelector("details.story-party").open'), false, 'a closed list stays closed across a re-render');
  // The toast steps aside at the player's next input (a tap on the HUD title, plain text), so it never hides controls for its whole reading time.
  await sleep(500);
  await tapAt(send, await centre(evaluate, '#hud-title'));
  await wait('getComputedStyle(document.querySelector("#town-notice")).visibility === "hidden"');
  console.log('PASS party: bench/deploy keep controls in place, the notice overlays and steps aside at the next tap, the list keeps its state');

  if (!runs('depart')) return;
  // Bench Sable again: one free slot, Rowan and Sable benched.
  await click('details.story-party summary');
  await click('[data-story-toggle="2"]');
  await wait('window.gridbound.profile().storyActive.length === 2');
  const depart = async () => { await click('.party-deploy-button'); await wait('document.querySelector("#modal")?.open && Boolean(document.querySelector("#empty-fill"))'); };
  await depart();
  assert.equal(await evaluate('document.activeElement?.id'), 'empty-fill', 'Fill party is focused');
  assert.match(await evaluate('document.querySelector("#modal-title").textContent'), /Depart with 1 empty slot\?/);
  assert.match(await evaluate('document.querySelector("#modal").textContent'), /Rowan.*Sable|Sable.*Rowan/);
  assert.ok(await evaluate('Boolean(document.querySelector("#modal [data-nav-exit=close]:not(.modal-close)"))'), 'a text Cancel');
  await screenshot(`${out}/depart-empty-390.png`);
  await key('Escape');
  await wait('!document.querySelector("#modal").open');
  assert.equal(await evaluate('window.gridbound.inTown'), true, 'Escape cancels the departure');
  // Fill party: Formation with the list open.
  await click('[data-training-tab="skills"]');
  await depart();
  await click('#empty-fill');
  await wait(`${route} === "party" && document.querySelector('[data-training-panel="formation"]') && document.querySelector("details.story-party")?.open`);
  // From the dossier too, then Depart anyway starts the chapter with two heroes, and its free Back returns to the dossier.
  await click.nav('campaign');
  await click('[data-mission="1"], [data-zone="1"]');
  await wait(`${route} === "mission"`);
  await click('[data-depart="adventure"]');
  await wait('Boolean(document.querySelector("#empty-go"))');
  await click('#empty-go');
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"', 15000);
  assert.equal(await evaluate('window.gridbound.battle.heroes.length'), 2, 'Depart anyway keeps the smaller party');
  await click('#ready-back');
  await wait(`window.gridbound.inTown && ${route} === "mission"`, 10000);
  // A full party departs without asking.
  await click.nav('party');
  await click('[data-training-tab="formation"]');
  if (!await evaluate('document.querySelector("details.story-party").open')) await click('details.story-party summary');
  await click('[data-story-toggle="2"]');
  await wait('window.gridbound.profile().storyActive.length === 3');
  await click('.party-deploy-button');
  await wait('!window.gridbound.inTown', 15000);
  assert.equal(await evaluate('document.querySelector("#modal").open'), false, 'no question for a full party');
  assert.deepEqual(errors, [], 'no console errors');
  console.log('PASS depart: free slots ask first (Fill party, Depart anyway, Cancel); a full party departs at once');
}, { width: 390, height: 844, mobile: true });

if (runs('jobs')) await withBrowser(async tools => {
  const { wait, evaluate, click, key, screenshot, errors } = tools;
  await boot(tools, JOBS_SAVE);
  await click.nav('party-advanced');
  await click('[data-training-tab="jobs"]');
  await wait('Boolean(document.querySelector(".job-paths"))');
  const before = await gold(evaluate);
  // One tap on a card inspects it: no gold moves, nothing is learned.
  await click('[data-promote="paladin"]');
  await wait('Boolean(document.querySelector(\'[data-job-inspector="paladin"]\'))');
  assert.equal(await gold(evaluate), before, 'a tap on a job card spends nothing');
  assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'), undefined);
  assert.equal(await evaluate('document.querySelector(\'[data-promote="paladin"]\').getAttribute("aria-pressed")'), 'true');
  assert.match(await evaluate('document.querySelector("[data-job-inspector]").textContent'), /Consecration/, 'the inspector names the signature skill');
  assert.equal(await evaluate('document.querySelector("[data-confirm-job]").disabled'), false);
  assert.equal(await evaluate('document.querySelector("[data-cancel-job]").dataset.navExit'), 'close', 'the inspector button only closes the panel (Back walks the route: R5)');
  assert.equal(await evaluate('document.querySelector("[data-job-inspector]").getAttribute("aria-live")'), null, 'the re-rendered inspector is not a live region');
  await screenshot(`${out}/job-inspect-390.png`);
  // Close closes it.
  await click('[data-cancel-job]');
  await wait('!document.querySelector("[data-job-inspector]")');
  assert.equal(await evaluate('document.querySelector(\'[data-promote="paladin"]\').getAttribute("aria-pressed")'), 'false');
  // A locked job explains itself and cannot be bought.
  await click('[data-promote="aegis"]');
  await wait('Boolean(document.querySelector(\'[data-job-inspector="aegis"]\'))');
  assert.equal(await evaluate('document.querySelector("[data-confirm-job]").disabled'), true);
  assert.match(await evaluate('document.querySelector(".job-inspector-status").textContent'), /Requires Paladin/);
  // Promote spends the gold once, then offers to equip the signature skill.
  await click('[data-promote="paladin"]');
  await click('[data-confirm-job]');
  await wait('window.gridbound.profile().loadouts[0].job === "paladin"');
  assert.equal(await gold(evaluate), before - 180, 'Promote spends the job cost');
  await wait('Boolean(document.querySelector("[data-job-inspector] [data-equip-skill]"))');
  await click('[data-job-inspector] [data-equip-skill]');
  await wait('window.gridbound.profile().loadouts[0].skills.includes(4)');
  assert.equal(await evaluate(route), 'party-advanced', 'equipping stays on Jobs');
  assert.match(await evaluate('document.querySelector("[data-job-inspector]").textContent'), /equipped in slot 1/);
  assert.match(await evaluate('document.querySelector(\'[data-promote="berserker"]\').textContent'), /Other path/);
  // From the keyboard: Enter on a card opens its inspector and puts the focus on its safe exit (Close), not on the lost card.
  await evaluate('document.querySelector(\'[data-promote="aegis"]\').focus()');
  await key('Enter');
  await wait('Boolean(document.querySelector(\'[data-job-inspector="aegis"]\'))');
  assert.equal(await evaluate('document.activeElement?.hasAttribute("data-cancel-job")'), true, 'keyboard focus lands on Close');
  // Another hero clears the selection.
  await click('[data-town-hero="4"]');
  await wait('!document.querySelector("[data-job-inspector]")');
  await click('[data-town-hero="0"]');
  // Reset asks first; Cancel (focused) changes nothing.
  const promoted = await gold(evaluate);
  await click('[data-respec]');
  await wait('document.querySelector("#modal").open && Boolean(document.querySelector("#respec-confirm"))');
  assert.equal(await evaluate('document.activeElement?.dataset.navExit'), 'close', 'Cancel is focused');
  const body = await evaluate('document.querySelector("#modal").textContent');
  assert.match(body, /Reset Aldric\?/); assert.match(body, /Job removed: Paladin/); assert.match(body, /2 talents removed/); assert.match(body, /Refund: 250G/);
  await screenshot(`${out}/respec-confirm-390.png`);
  await key('Escape');
  await wait('!document.querySelector("#modal").open');
  assert.equal(await gold(evaluate), promoted); assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'), 'paladin', 'Cancel keeps the build');
  await click('[data-respec]');
  await wait('Boolean(document.querySelector("#respec-confirm"))');
  await click('#respec-confirm');
  await wait('window.gridbound.profile().loadouts[0].job === undefined');
  assert.equal(await gold(evaluate), promoted + 250, 'the refund the dialog named');
  assert.equal(await evaluate(route), 'party-advanced', 'the reset stays on Jobs');
  // Formation no longer has a Reset under the grid.
  await click.nav('party');
  await click('[data-training-tab="formation"]');
  await wait('Boolean(document.querySelector(".formation-grid"))');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-respec]"))'), false, 'no Reset on Formation');
  assert.deepEqual(errors, [], 'no console errors');
  console.log('PASS jobs: inspect, then Promote; Equip now; Back; Reset asks first and is gone from Formation');
}, { width: 390, height: 844, mobile: true });

// The camp guide's promotion step: Go opens on that job's inspector, and nothing is spent until Promote there.
if (runs('jobs')) await withBrowser(async tools => {
  const { wait, evaluate, click, errors } = tools;
  // Chapter 4 reached with 600G, no skill points to spend and the one ready quest claimed: the guide names a promotion.
  await boot(tools, { ...JOBS_SAVE, gold: 600, claimedQuests: ['first-road'], ledger: { raids: 0, victories: 3, enemies: {} }, loadouts: Object.fromEntries(Object.entries(JOBS_SAVE.loadouts).map(([id, l]) => [id, { ...l, xp: 0, talents: [] }])) });
  assert.match(await evaluate('document.querySelector(".camp-copy p").textContent'), /Aldric can become a Paladin/);
  await click('.camp-copy .guide-go[data-pick-job="paladin"]');
  await wait(`${route} === "party-advanced" && Boolean(document.querySelector('[data-job-inspector="paladin"] [data-confirm-job]:not([disabled])'))`);
  assert.equal(await evaluate('document.querySelector(\'[data-promote="paladin"]\').getAttribute("aria-pressed")'), 'true');
  assert.equal(await gold(evaluate), 600, 'Go spends nothing');
  assert.deepEqual(errors, [], 'no console errors');
  console.log('PASS guide: the promotion step opens on that job\'s inspector');
}, { width: 390, height: 844, mobile: true });

// Phone contract G7 (SAFE), on a Pixel 7 with real touches: a quick double tap on Promote learns the job once and leaves the skills alone
// (the re-rendered inspector's 'Equip … now' sits where Promote was), and one on 'Buy & equip' buys once and opens no other item.
if (runs('doubletap')) await withBrowser(async tools => {
  const { wait, evaluate, touch, screenshot, errors } = tools;
  await boot(tools, JOBS_SAVE);
  await tools.click.nav('party-advanced');
  await touch.tap('[data-training-tab="jobs"]');
  await wait('Boolean(document.querySelector(\'[data-promote="paladin"]\'))');
  await touch.tap('[data-promote="paladin"]');
  await wait('Boolean(document.querySelector("[data-confirm-job]:not([disabled])"))');
  const before = await evaluate('(() => { const p = window.gridbound.profile(); return { gold: p.gold, skills: p.loadouts[0].skills.join("/") }; })()');
  await touch.rapidDoubleTap('[data-confirm-job]', 120);
  await wait('window.gridbound.profile().loadouts[0].job === "paladin"');
  await sleep(900);
  const after = await evaluate('(() => { const p = window.gridbound.profile(); return { gold: p.gold, skills: p.loadouts[0].skills.join("/") }; })()');
  assert.equal(after.gold, before.gold - 180, 'Promote spent its cost once');
  assert.equal(after.skills, before.skills, 'the second tap did not press Equip now');
  assert.ok(await evaluate('Boolean(document.querySelector("[data-job-inspector] [data-equip-skill]"))'), 'Equip now waits for its own tap');
  await screenshot(`${out}/promote-double-tap-p7.png`);
  // Gear: the first piece the hero can buy, then a double tap on Buy & equip.
  await tools.click.nav('party');
  await touch.tap('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector("[data-gear-item]"))');
  let bought;
  for (const id of await evaluate('[...document.querySelectorAll("[data-gear-item]:not(.equipped):not(.unavailable)")].map(b => b.dataset.gearItem)')) {
    await touch.tap(`[data-gear-item="${id}"]`);
    await wait(`document.querySelector("[data-gear-preview]")?.dataset.gearPreview === ${JSON.stringify(id)}`);
    if (await evaluate('!document.querySelector("[data-confirm-gear]").disabled')) { bought = id; break; }
  }
  assert.ok(bought, 'a piece to buy');
  const gold0 = await gold(evaluate);
  await touch.rapidDoubleTap('[data-confirm-gear]', 120);
  await wait(`!document.querySelector("[data-gear-preview]")`);
  await sleep(900);
  const owned = await evaluate('(() => { const l = window.gridbound.profile().loadouts[0]; return { gear: l.gear, inventory: l.inventory ?? [] }; })()');
  assert.ok(Object.values(owned.gear).includes(bought), 'the piece is equipped');
  assert.ok(await gold(evaluate) < gold0, 'it was paid for');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-gear-preview]"))'), false, 'the second tap opened no other item');
  assert.deepEqual(errors, [], 'no console errors');
  console.log('PASS double tap: Promote learns once and equips nothing; Buy & equip buys once and opens nothing');
}, { phone: { width: 412, height: 915, dpr: 2.625, ua: 'android' } });

if (runs('claim')) await withBrowser(async tools => {
  const { wait, evaluate, click, screenshot, errors } = tools;
  await boot(tools, AFTER_CH1);
  await click.nav('quests');
  const label = await evaluate('document.querySelector("[data-claim-all]").textContent');
  const promised = Number(label.match(/\((\d+)\)/)[1]);
  await click('[data-claim-all]');
  await wait('document.querySelector("#town-notice:not([hidden])")?.textContent.includes("claimed")');
  const notice = await evaluate('document.querySelector("#town-notice").textContent');
  assert.equal(Number(notice.match(/^(\d+)/)[1]), promised, `the button promised ${promised}: ${notice}`);
  const gear = await evaluate('(() => { const p = window.gridbound.profile(); return Object.fromEntries(p.storyActive.map(id => [id, p.loadouts[id].gear ?? {}])); })()');
  const worn = Object.values(gear).flatMap(g => Object.values(g));
  assert.deepEqual(worn.sort(), ['ember-charm', 'iron-edge', 'oak-plate'], 'the three hunt rewards are worn');
  assert.ok(Object.values(gear).every(g => Object.keys(g).length === 1), 'one piece each: spread over the party');
  assert.match(notice, /equipped on/);
  await screenshot(`${out}/claim-all-390.png`);
  // A chain that opens on the way is counted on the button too (late save: more quests than the ready ones).
  assert.deepEqual(errors, [], 'no console errors');
  console.log(`PASS claim: Claim all (${promised}) claims ${promised}, the gear is equipped across the party`);
}, { width: 390, height: 844, mobile: true });

if (runs('menu')) for (const [width, height, mobile] of [[540, 900, false], [390, 844, true], [360, 640, true]]) await withBrowser(async tools => {
  const { wait, evaluate, click, screenshot } = tools;
  await boot(tools, LATE);
  await click.nav('more');
  const m = await evaluate('(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const cards = [...document.querySelectorAll(".more-grid .more-card")].map(c => c.getBoundingClientRect()); return { grid: r(".more-grid").top, party: r(".menu-party").top, first: cards[0].top, last: cards.at(-1).bottom, viewport: innerHeight, title: document.querySelector("[data-open-action=title]").getBoundingClientRect().bottom }; })()');
  assert.ok(m.grid < m.party, `commands come before the party at ${width}px (${m.grid} < ${m.party})`);
  if (height >= 844) assert.ok(m.last <= m.viewport, `every command is on screen at ${width}×${height} (${m.last} ≤ ${m.viewport})`);
  else assert.ok(m.first < m.viewport / 2, 'the first commands are on screen');
  await screenshot(`${out}/menu-${width}x${height}.png`);
  console.log(`PASS menu ${width}×${height}: commands first`, m);
}, { width, height, mobile });

if (runs('journal')) await withBrowser(async tools => {
  const { wait, evaluate, click, screenshot } = tools;
  await boot(tools, LATE);
  await click.nav('more');
  await click('[data-open-action="journal"]');
  await wait('Boolean(document.querySelector(".journal-companions .btn"))');
  const rows = await evaluate('[...document.querySelectorAll(".journal-companions .btn")].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })');
  const byTop = new Map(); for (const [top, bottom] of rows) byTop.set(top, [...(byTop.get(top) ?? []), bottom]);
  assert.ok([...byTop.values()].every(bottoms => new Set(bottoms).size === 1), `companion buttons line up: ${JSON.stringify(rows)}`);
  assert.ok(new Set(rows.map(([top, bottom]) => bottom - top)).size === 1, 'and share one height');
  await evaluate('document.querySelector(".journal-companions").scrollIntoView({ block: "center" })');
  await screenshot(`${out}/journal-companions-390.png`);
  console.log('PASS journal: companion buttons line up', rows.length);
}, { width: 390, height: 844, mobile: true });

if (runs('gsap')) await withBrowser(async tools => {
  const { send, wait, evaluate, click, key, on, errors } = tools;
  const warnings = [];
  on(m => { if (m.method === 'Runtime.consoleAPICalled' && JSON.stringify(m.params.args).includes('GSAP')) warnings.push(m.params.args.map(a => a.value ?? a.description).join(' ')); });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator,'webdriver',{get:()=>false})" });
  await seedSave(send, { ...ACT_TWO_SAVE, gold: 3000 });
  await send('Page.navigate', { url });
  await wait('window.gridbound && !document.querySelector("#title-screen").hidden', 20000);
  const dismiss = async () => { for (let i = 0; i < 12; i++) { if (await evaluate('Boolean(document.querySelector(".dialogue-scene")) || document.querySelector("#modal").open')) await key('Escape'); else break; await sleep(500); } };
  const enter = async () => { await wait('Boolean(document.querySelector("#title-enter"))'); await click('#title-enter'); await wait('document.querySelector("#title-screen").hidden', 5000); await sleep(1500); await dismiss(); };
  await click('#title-screen'); await sleep(400);
  await enter();
  for (const f of ['more', 'party', 'party-advanced', 'quests', 'bestiary', 'challenge-shop', 'camp', 'campaign', 'raid', 'endless', 'dungeon', 'camp']) { await dismiss(); await click.nav(f); await sleep(700); }
  // MENU → Title → Enter lands on the MENU (no camp map to fade in): this used to log '.town-map' / '.camp-copy not found'.
  await click.nav('more'); await click('[data-open-action="title"]');
  await wait('!document.querySelector("#title-screen").hidden'); await sleep(800);
  await enter();
  await click.nav('bestiary'); await click('.bestiary-cell'); await sleep(600);
  await click.nav('party-advanced'); await click('[data-training-tab="talents"]'); await sleep(600);
  // A real player (no forcing) is asked before departing with free slots (ACT_TWO_SAVE deploys 3 of 6); Escape cancels.
  await click.nav('party');
  await click('.party-deploy-button');
  await wait('Boolean(document.querySelector("dialog[open] #empty-fill"))');
  await key('Escape');
  await wait('!document.querySelector("#modal").open && window.gridbound.inTown');
  assert.deepEqual(warnings, [], 'no GSAP target warnings');
  assert.deepEqual(errors, [], 'no console errors');
  console.log('PASS gsap: a real town walk logs no GSAP target warnings');
}, { width: 390, height: 844, mobile: true });

// Screenshots for review: EN and ID, phone and desktop.
if (runs('shots')) for (const lang of ['en', 'id']) for (const [width, height, mobile] of [[390, 844, true], [1280, 900, false]]) await withBrowser(async tools => {
  const { wait, evaluate, click, screenshot } = tools;
  const tag = `${lang}-${width}`;
  await boot(tools, JOBS_SAVE, lang);
  await evaluate('window.gridbound.emptySlotPrompt()');
  await click.nav('party-advanced');
  await click('[data-training-tab="jobs"]');
  await click('[data-promote="paladin"]');
  await wait('Boolean(document.querySelector("[data-job-inspector]"))');
  await screenshot(`${out}/jobs-${tag}.png`);
  await click('[data-respec]');
  await wait('Boolean(document.querySelector("#respec-confirm"))');
  await screenshot(`${out}/respec-${tag}.png`);
  await click('#modal [data-close]:not(.modal-close)');
  await click.nav('party');
  await click('[data-training-tab="formation"]');
  if (!await evaluate('document.querySelector("details.story-party").open')) await click('details.story-party summary');
  await click('[data-story-toggle="7"]');
  await wait('document.querySelector("#town-notice:not([hidden])")');
  await screenshot(`${out}/party-notice-${tag}.png`);
  await click('.party-deploy-button');
  await wait('Boolean(document.querySelector("#empty-fill"))');
  await screenshot(`${out}/depart-empty-${tag}.png`);
  await click('#empty-fill');
  await wait(`${route} === "party"`);
  await click.nav('quests');
  await screenshot(`${out}/quests-${tag}.png`);
  console.log('shots', tag);
}, { width, height, mobile });

/** The control is fully on screen and the element at its centre is it (or inside it): not under the sticky Depart bar or header. */
const hitAtCentre = (evaluate, selector) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'missing'; const r = el.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= innerHeight && Boolean(h && el.contains(h)) || ('covered by ' + (h?.className || h?.tagName) + ' at ' + Math.round(r.top)); })()`);
const phoneSave = { ...JOBS_SAVE, gold: 4000, economy: { gold: 4000, commanderCrystal: 60, materials: {} } };
if (runs('phone')) await withBrowser(async tools => {
  const { wait, evaluate, click, touch, screenshot, errors } = tools;
  await boot(tools, phoneSave);
  // Jobs: a tapped card's inspector brings its Promote on screen, above Depart.
  await click.nav('party-advanced');
  await touch.tap('[data-training-tab="jobs"]');
  await wait('Boolean(document.querySelector("[data-promote]"))');
  await touch.tap('[data-promote]');
  await wait('Boolean(document.querySelector("[data-confirm-job]"))');
  await sleep(150);
  assert.equal(await hitAtCentre(evaluate, '[data-confirm-job]'), true, '375×553: Promote is on screen above Depart after the tap');
  await screenshot(`${out}/job-inspector-375x553.png`);
  // Gear: the same for Buy & equip.
  await click.nav('party');
  await touch.tap('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector("[data-gear-item]:not(.equipped)"))');
  await touch.tap('[data-gear-item]:not(.equipped)');
  await wait('Boolean(document.querySelector("[data-confirm-gear]"))');
  await sleep(150);
  assert.equal(await hitAtCentre(evaluate, '[data-confirm-gear]'), true, '375×553: Buy & equip is on screen above Depart after the tap');
  await screenshot(`${out}/gear-inspector-375x553.png`);
  // The Crystal Exchange: a tap on a ware selects it and spends nothing; its Buy spends once.
  await click.nav('challenge-shop');
  const crystal = () => evaluate('window.gridbound.profile().economy.commanderCrystal');
  const before = await crystal();
  await touch.tap('[data-bank-buy="bank-relic-ward"]');
  await wait('Boolean(document.querySelector("[data-confirm-bank=\\"bank-relic-ward\\"]"))');
  assert.equal(await crystal(), before, 'a tap on a ware spends no Crystal');
  assert.equal(await evaluate('document.querySelector("[data-bank-buy=\\"bank-relic-ward\\"]").getAttribute("aria-pressed")'), 'true');
  assert.equal(await hitAtCentre(evaluate, '[data-confirm-bank]'), true, 'its Buy is on screen');
  await touch.tap('[data-confirm-bank]');
  await wait('window.gridbound.profile().challengeUnlocks.includes("bank-relic-ward")');
  assert.equal(await crystal(), before - 24, 'Buy spends the ware\'s price once');
  assert.equal(await evaluate('document.querySelector("[data-bank-buy=\\"bank-relic-ward\\"]").disabled'), true, 'an owned ware is no longer offered');
  assert.deepEqual(errors, []);
  console.log('PASS phone: inspector confirms in view and the Crystal Exchange asks first (375×553)');
}, { phone: { width: 375, height: 553, dpr: 2, ua: 'iphone' } });

if (runs('phone')) await withBrowser(async tools => {
  const { wait, evaluate, click, touch, errors } = tools;
  await boot(tools, phoneSave);
  await click.nav('party');
  const scene = '.town-scene > .party-scene';
  // Equip is the longest tab: scrolled down to its item list, a tap on Skills starts Skills at the top (np-05).
  await touch.tap('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector("[data-training-panel=\\"gear\\"]"))');
  await evaluate(`document.querySelector('${scene}').scrollTop = 500, true`);
  await sleep(100);
  assert.ok(await evaluate(`document.querySelector('${scene}').scrollTop`) > 100, 'Equip scrolled');
  await touch.tap('[data-training-tab="skills"]');
  await wait('Boolean(document.querySelector("[data-training-panel=\\"skills\\"]"))');
  assert.equal(await evaluate(`document.querySelector('${scene}').scrollTop`), 0, 'np-05: Skills starts at the top, not at Equip\'s scroll');
  await touch.tap('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector("[data-training-panel=\\"gear\\"]"))');
  assert.equal(await evaluate(`document.querySelector('${scene}').scrollTop`), 0, 'Equip starts at the top too');
  // An equip keeps the scroll (an in-tab re-render).
  await evaluate(`document.querySelector('[data-gear-item]:not(.equipped)').scrollIntoView({ block: 'center' }), true`);
  const kept = await evaluate(`document.querySelector('${scene}').scrollTop`);
  await touch.tap('[data-gear-item]:not(.equipped)');
  await wait('Boolean(document.querySelector("[data-confirm-gear]:not(:disabled)"))');
  await touch.tap('[data-confirm-gear]');
  await wait('!document.querySelector("[data-confirm-gear]")');
  assert.ok(Math.abs(await evaluate(`document.querySelector('${scene}').scrollTop`) - kept) < 200, 'equipping keeps the Equip tab where it was');
  assert.deepEqual(errors, []);
  console.log('PASS phone: a tab switch starts at the top, an equip keeps the scroll (390×844)');
}, { phone: { width: 390, height: 844, dpr: 2, ua: 'android' } });

if (runs('phone')) await withBrowser(async tools => {
  const { wait, evaluate, click, touch, screenshot, errors } = tools;
  await boot(tools, phoneSave);
  for (const [route, tab] of [['party', 'gear'], ['party-advanced', 'jobs']]) {
    await click.nav(route);
    await touch.tap(`[data-training-tab="${tab}"]`);
    await wait(`Boolean(document.querySelector('[data-training-panel="${tab}"]'))`);
    // Landscape: the route scrolls as one page (no nested panel), and Depart stays reachable at its end.
    assert.deepEqual(await evaluate(`(() => { const s = document.querySelector('.town-scene > .party-scene'), p = document.querySelector('[data-training-panel]'); return [getComputedStyle(s).overflowY, getComputedStyle(p).overflowY]; })()`), ['auto', 'visible'], `852×393 ${tab}: the route scrolls as one`);
    await evaluate(`document.querySelector('.town-scene > .party-scene').scrollTop = 1e6, true`);
    await sleep(150);
    assert.equal(await hitAtCentre(evaluate, '.party-deploy-button'), true, `852×393 ${tab}: Depart is reachable`);
  }
  await screenshot(`${out}/party-landscape-852x393.png`);
  assert.deepEqual(errors, []);
  console.log('PASS phone: Party and Jobs scroll as one page in landscape, Depart reachable (852×393)');
}, { phone: { width: 852, height: 393, dpr: 2, ua: 'iphone', landscape: true, insets: { left: 59, right: 59, bottom: 21 } } });
console.log('PASS town flows');
