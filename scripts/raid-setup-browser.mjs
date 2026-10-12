// Raid setup and Crystal sinks on the shipped UI path: raid heroes bring their Story level and gear,
// locked quarries show as '???' until the story reaches them, the job picker lists all nine classes,
// each slot has a unique hero picker that survives a party-size change, variants are chips, unbuilt pacts are disabled, the payout total
// is shown, a ticked Bell Tonic is paid at departure for +1 potion, and the Ward/Fate relics change a
// Roguelike run (extra potion and opening barrier, a fourth boon card).
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const seed = (bank, unlocks) => `(async () => {
  const { createProfile, completeZone, equipGear, normalizeProfile } = await import('/src/game/profile.ts');
  const { xpForLevel } = await import('/src/game/levels.ts');
  const { createCommanderDocument, openCommanderRepository } = await import('/src/game/commander.ts');
  const raw = createProfile();
  for (let i = 0; i < 8; i++) completeZone(raw, i);
  raw.gold = 20000; raw.economy.gold = 20000; raw.sound = false; raw.motion = false;
  raw.ledger = { raids: 0, victories: 8, enemies: { wolf: 1 } };
  for (const id of raw.roster) { raw.loadouts[id].xp = xpForLevel(14); equipGear(raw, id, 'iron-edge'); equipGear(raw, id, 'oak-plate'); }
  const document = createCommanderDocument(normalizeProfile(JSON.parse(JSON.stringify(raw))), 'Raid setup');
  document.shared.bankCrystal = ${bank};
  document.shared.challengeUnlocks = ${JSON.stringify(unlocks)};
  const repository = await openCommanderRepository();
  await repository.commit(document);
  repository.close();
  return document.commanderId;
})()`;
const bankOf = id => `(async () => {
  const { openCommanderRepository } = await import('/src/game/commander.ts');
  const repository = await openCommanderRepository();
  const document = (await repository.list()).find(candidate => candidate.commanderId === ${JSON.stringify(id)});
  repository.close();
  return document?.shared.bankCrystal;
})()`;
const boot = async ({ send, wait, evaluate }, bank, unlocks) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
  const id = await evaluate(seed(bank, unlocks));
  await send('Page.reload');
  await wait('window.gridbound && document.querySelector(".camp-scene")', 30000);
  await evaluate('window.gridbound.hideTitle()');
  await wait('document.querySelector("#title-screen").hidden');
  return id;
};
const fits = async (evaluate, label) => assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), `${label}: horizontal overflow`);
const change = (evaluate, selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
const tick = (evaluate, selector) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);

await withBrowser(async browser => {
  const { wait, evaluate, click, screenshot, errors } = browser;
  const id = await boot(browser, 40, []);
  await click.nav('raid');
  await wait('Boolean(document.querySelector(".secondary-scene [data-depart=raid]")) && document.querySelector(".town-game-shell")?.dataset.townRoute === "raid"');
  await fits(evaluate, 'raid setup');

  assert.equal(await evaluate('document.querySelectorAll("[data-raid]").length'), 18, 'every archetype has a tile');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-raid].locked")].map(b => b.dataset.raid)'), ['colossus', 'choir'], 'quarries past chapter 8 stay locked');
  assert.ok(await evaluate('[...document.querySelectorAll("[data-raid].locked")].every(b => b.disabled && b.textContent.includes("???"))'), 'locked tiles hide the boss');
  assert.equal(await evaluate('document.querySelectorAll("[data-raid-job=\\"0\\"] option").length'), 9, 'all nine basic classes');
  assert.equal(await evaluate('document.querySelectorAll("[data-raid-hero]").length'), 3, 'a hero picker per slot');
  const roster = await evaluate('window.gridbound.profile().roster');
  assert.equal(await evaluate('document.querySelectorAll("[data-raid-hero=\\"0\\"] option").length'), roster.length);
  assert.equal(await evaluate('document.querySelectorAll("[data-raid-variant]").length'), 4, 'variant chips for the chosen archetype');
  assert.equal(await evaluate('document.querySelectorAll("select[data-raid-variant]").length'), 0, 'the 72-option variant select is gone');
  assert.ok(await evaluate('document.querySelector("[data-raid-modifier=\\"RM06\\"]").disabled'), 'unbuilt pacts cannot be ticked');
  assert.match(await evaluate('document.querySelector("[data-raid-modifier=\\"RM06\\"]").closest("label").textContent'), /Not yet available/);
  assert.match(await evaluate('document.querySelector("[data-raid-total]").textContent'), /Payout 12 Crystal · Bronze · Pacts 0/);

  await change(evaluate, '[data-raid-tier]', 'gold');
  await wait('/Gold/.test(document.querySelector("[data-raid-total]")?.textContent ?? "")');
  await click('[data-raid-modifier="RM01"]');
  await wait('/Pacts 1/.test(document.querySelector("[data-raid-total]")?.textContent ?? "")');
  assert.match(await evaluate('document.querySelector("[data-raid-total]").textContent'), /Payout 45 Crystal · Gold · Pacts 1/);
  // Which pacts pay is shown before ticking: RM02 keeps RM01 certified, RM03 would make it practice. The payout repeats under the pacts.
  assert.equal(await evaluate('Boolean(document.querySelector("[data-raid-modifier=\\"RM02\\"]").closest("label").querySelector("[data-pact-practice]"))'), false, 'a pact that keeps the contract paid has no practice tag');
  assert.match(await evaluate('document.querySelector("[data-raid-modifier=\\"RM03\\"]").closest("label").textContent'), /practice only/, 'a pact that would make the raid unpaid says so');
  assert.match(await evaluate('document.querySelector("[data-raid-total-pacts]").textContent'), /Payout 45 Crystal · Gold · Pacts 1/);
  // Three pacts at most: the fourth is disabled, and an uncertified combo is practice (it still plays its pacts).
  await click('[data-raid-modifier="RM03"]');
  await wait('document.querySelector("[data-raid-modifier=\\"RM03\\"]")?.checked === true');
  await click('[data-raid-modifier="RM05"]');
  await wait('document.querySelector("[data-raid-modifier=\\"RM05\\"]")?.checked === true');
  assert.ok(await evaluate('document.querySelector("[data-raid-modifier=\\"RM02\\"]").disabled'), 'a fourth pact cannot be ticked');
  assert.doesNotMatch(await evaluate('document.querySelector("[data-raid-total]").textContent'), /Payout/);
  await click('[data-raid-modifier="RM03"]');
  await wait('document.querySelector("[data-raid-modifier=\\"RM03\\"]")?.checked === false');
  await click('[data-raid-modifier="RM05"]');
  await wait('/Payout 45 Crystal · Gold · Pacts 1/.test(document.querySelector("[data-raid-total]")?.textContent ?? "")');
  await click('[data-raid-variant="golem-ash"]');
  await wait('document.querySelector("[data-raid-variant=\\"golem-ash\\"]")?.classList.contains("chosen")');

  // Swap the second raid hero for another recruit; that hero cannot be picked twice.
  const swapIn = roster.find(id => ![0, 4, 3].includes(id));
  await change(evaluate, '[data-raid-hero="1"]', swapIn);
  await wait(`document.querySelector('[data-raid-hero="1"]')?.value === "${swapIn}"`);
  assert.ok(await evaluate(`document.querySelector('[data-raid-hero="0"] option[value="${swapIn}"]').disabled`), 'a hero already in the party is disabled elsewhere');
  await change(evaluate, '[data-raid-job="2"]', 'bard');
  await wait('document.querySelector("[data-raid-job=\\"2\\"]")?.value === "bard"');
  // Swap the leader too (the new hero inherits tile 0), then grow the party: picks, classes and tiles survive.
  const lead = roster.find(id => ![0, 4, 3, swapIn].includes(id));
  await change(evaluate, '[data-raid-hero="0"]', lead);
  await wait(`document.querySelector('[data-raid-hero="0"]')?.value === "${lead}"`);
  await change(evaluate, '[data-raid-party-size]', 4);
  await wait('document.querySelectorAll("[data-raid-hero]").length === 4');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-raid-hero]")].map(s => Number(s.value))'), [lead, swapIn, 3, 0], 'raising the party size keeps the hero picks');
  assert.equal(await evaluate('document.querySelector("[data-raid-job=\\"2\\"]").value'), 'bard', 'and their raid classes');
  assert.equal(await evaluate('document.querySelector("[data-raid-party-size]").value'), '4');

  await tick(evaluate, '[data-bell-tonic]');
  await wait('document.querySelector("[data-bell-tonic]")?.checked === true');
  await evaluate('window.scrollTo(0, 0); document.querySelector(".secondary-content")?.scrollTo?.(0, 0)');
  await screenshot('artifacts/raid-setup-390.png');
  await evaluate('document.querySelector(".raid-variants").scrollIntoView({ block: "center" })');
  await screenshot('artifacts/raid-setup-quarry-390.png');
  await evaluate('document.querySelector(".raid-party-grid").scrollIntoView({ block: "center" })');
  await screenshot('artifacts/raid-setup-party-390.png');

  await click('.secondary-scene [data-depart=raid]');
  await wait('window.gridbound.battle.mode === "raid" && window.gridbound.battle.status === "ready"');
  const fight = await evaluate('(() => { const b = window.gridbound.battle; return { floor: b.floor, enemy: b.enemyId, potions: b.potions, tier: b.raidContract.tier, mods: [...b.raidContract.modifiers], heroes: b.heroes.map(h => ({ id: h.id, level: h.level, classId: h.classId, power: h.gearPower })) }; })()');
  assert.equal(fight.floor, 9, 'raid floor follows the story (8 chapters cleared)');
  assert.equal(fight.enemy, 'golem-ash');
  assert.deepEqual([fight.tier, fight.mods], ['gold', ['RM01']]);
  assert.equal(fight.potions, 3, 'the Bell Tonic adds a potion');
  assert.deepEqual(fight.heroes.map(h => h.id), [lead, swapIn, 3, 0]);
  assert.equal(new Set(await evaluate('window.gridbound.battle.heroes.map(h => h.slot)')).size, 4, 'every raid hero has its own tile');
  assert.equal(fight.heroes[2].classId, 'bard');
  assert.ok(fight.heroes.every(h => h.level === 14), `raid heroes keep their Story level: ${JSON.stringify(fight.heroes)}`);
  assert.ok(fight.heroes.every(h => h.power > 1.5), 'level and gear power carry into the raid');
  assert.equal(await evaluate('window.gridbound.profile().economy.commanderCrystal'), 34, 'the tonic costs 6 bank Crystal');
  await wait(`${bankOf(id)}.then(bank => bank === 34)`);
  // The ready window's free Back: the raid setup again, the tonic refunded and still ticked (nothing is spent until FIGHT!).
  await click('#ready-back');
  await wait('window.gridbound.inTown && document.querySelector(".town-game-shell")?.dataset.townRoute === "raid"');
  assert.equal(await evaluate('window.gridbound.profile().economy.commanderCrystal'), 40, 'a free Back returns the tonic');
  await wait(`${bankOf(id)}.then(bank => bank === 40)`);
  assert.equal(await evaluate('document.querySelector("[data-bell-tonic]")?.checked'), true, 'and keeps it ticked for the next departure');
  await click('.secondary-scene [data-depart=raid]');
  await wait('window.gridbound.battle.mode === "raid" && window.gridbound.battle.status === "ready" && window.gridbound.battle.potions === 3');
  await wait(`${bankOf(id)}.then(bank => bank === 34)`);
  // A suspended raid: the setup names it, locks its controls, and Depart resumes it; Abandon (confirmed) opens the setup again.
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
  await click.retreat();
  await wait('Boolean(document.querySelector("dialog[open] #suspend-run"))');
  await click('#suspend-run');
  await wait('window.gridbound.inTown === true');
  await click.nav('raid');
  await wait('Boolean(document.querySelector("[data-suspended-run=raid]"))');
  assert.match(await evaluate('document.querySelector("[data-suspended-run=raid]").textContent'), /Gold hunt against .* is suspended/);
  assert.match(await evaluate('document.querySelector(".secondary-scene [data-depart=raid]").textContent'), /Resume hunt: .* · Gold/);
  assert.equal(await evaluate('[...document.querySelectorAll(".setup-lock select, .setup-lock input")].every(el => el.matches(":disabled"))'), true, 'the setup controls are locked');
  await click('[data-abandon-run="raid"]');
  await wait('Boolean(document.querySelector("dialog[open] #abandon-suspended"))');
  await click('#abandon-suspended');
  await wait('!document.querySelector("[data-suspended-run]") && /Hunt /.test(document.querySelector(".secondary-scene [data-depart=raid]")?.textContent ?? "")');
  assert.equal(await evaluate('Boolean(document.querySelector(".setup-lock"))'), false, 'the setup opens again');
  assert.deepEqual(errors, [], 'no uncaught errors');
  console.log('PASS raid setup: story heroes, locked quarries, 9 jobs, hero picker, variant chips, pact total, practice tags, Bell Tonic, suspended run');
}, { width: 390, height: 844, mobile: true });

for (const view of [{ width: 390, height: 844, mobile: true }, { width: 1440, height: 900 }]) await withBrowser(async browser => {
  const { wait, evaluate, click, screenshot, errors } = browser;
  await boot(browser, 10, ['bank-relic-ward', 'bank-relic-fate']);
  await click.nav('endless');
  await wait('Boolean(document.querySelector("[data-depart=endless]")) && Boolean(document.querySelector("[data-relics]"))');
  assert.match(await evaluate('document.querySelector("[data-relics]").textContent'), /Ward Relic, Fate Relic/);
  await click.nav('challenge-shop');
  await wait('Boolean(document.querySelector("[data-bank-consumable=\\"bell-tonic\\"]"))');
  assert.equal(await evaluate('document.querySelectorAll("[data-bank-buy]:disabled").length'), 2, 'owned relics');
  await screenshot(`artifacts/bank-shop-${view.width}.png`);
  await click.nav('endless');
  await wait('Boolean(document.querySelector("[data-depart=endless]"))');
  await click('[data-depart="endless"]');
  await wait('window.gridbound.battle.mode === "endless" && window.gridbound.battle.status === "ready"');
  const start = await evaluate('(() => { const b = window.gridbound.battle; return { potions: b.potions, barrier: b.heroes.every(h => h.shield >= h.maxHp * .15 - 1e-6) }; })()');
  assert.deepEqual(start, { potions: 3, barrier: true }, 'the Ward Relic adds a potion and a 15% barrier');
  await click('#start');
  await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.1)');
  await wait('document.querySelector("[data-boon]") && !document.querySelector("[data-boon]").disabled', 15000);
  assert.equal(await evaluate('document.querySelectorAll("[data-boon]").length'), 4, 'the Fate Relic adds a fourth boon card');
  await wait('window.getComputedStyle(document.querySelector(".boon-card:last-child")).opacity === "1"');
  await fits(evaluate, 'four-card draft');
  await evaluate('document.querySelector(".boon-draft-grid").scrollIntoView({ block: "center" })');
  await screenshot(`artifacts/boon-draft-fate-${view.width}.png`);
  await click('[data-boon]');
  await wait('window.gridbound.battle.floor === 2 && window.gridbound.battle.status === "ready"');
  assert.equal(await evaluate('window.gridbound.battle.potions'), 3, 'the Ward Relic applies on every floor');
  assert.deepEqual(errors, [], 'no uncaught errors');
  console.log(`PASS relics @${view.width}: Ward potion + barrier on every floor, Fate 4-card draft, Bell Tonic listed in the bank`);
}, view);
