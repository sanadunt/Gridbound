import assert from 'node:assert/strict';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';
import { MID, LATE } from './phone-saves.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

console.log('--- TESTING HADES COMBAT HUD & BOSS INTENT / HEALTH BAR ---');

async function enterCampaignBattle({ click, wait, evaluate }) {
  await wait('Boolean(window.gridbound && document.querySelector(\'[data-facility="campaign"]\'))');
  await evaluate('document.fonts.ready');
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(\'[data-zone="0"]\'))');
  await click('[data-zone="0"]');
  await wait('Boolean(document.querySelector(\'[data-depart="adventure"]\'))');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  await click('#start');
  await wait('window.gridbound.battle.status === "fighting"');
}

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });
  // 1. Verify Gilded Boss HUD Structure
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-hud"))'), true, 'Boss HUD must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-hud.win"))'), true, 'Boss HUD uses the JRPG window frame');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp"))'), true, '#boss-hp must exist');
  assert.equal(await evaluate('Boolean(document.querySelector("#boss-hp-ghost"))'), true, '#boss-hp-ghost must exist');
  assert.equal(await evaluate('document.querySelectorAll(".boss-phase-notch").length'), 2, 'Phase notches must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".boss-phase-badge"))'), true, 'Phase badge must exist');

  // 2. Test Boss Damage & Ghost HP Reaction
  await evaluate('window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.65); window.gridbound.step(.1)');
  const bossHealth = await evaluate(`(() => {
    const battle = window.gridbound.battle;
    return {
      expected: battle.bossHp / battle.bossMax * 100,
      // The bars are full-width fills drawn with transform: scaleX (no layout per frame).
      health: parseFloat(document.querySelector("#boss-hp").style.transform.replace("scaleX(", "")) * 100,
      ghost: parseFloat(document.querySelector("#boss-hp-ghost").style.transform.replace("scaleX(", "")) * 100
    };
  })()`);
  assert.ok(Math.abs(bossHealth.health - bossHealth.expected) < 0.05, `Boss HP bar must track the current health ratio: ${JSON.stringify(bossHealth)}`);
  assert.equal(bossHealth.ghost, bossHealth.health, 'Ghost bar must follow the current health ratio');

  // 3. Test Threat / Intent Danger Mode
  await evaluate(`(() => {
    window.gridbound.battle.threats = [{
      id: 999,
      name: 'Sunken Cataclysm',
      type: 'all',
      slots: [0, 1, 2],
      left: 3.5,
      total: 5,
      counter: '⚡ GUARD RITUAL · Cooldown party aman.',
      targetId: 0
    }];
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#intent.danger"))'), true, 'Intent must have .danger class');
  const intentText = await evaluate('document.querySelector("#intent b").textContent');
  assert.ok(intentText.includes('Sunken Cataclysm'), 'Intent title must display threat name');

  // 4. Test Ninefold Dawn God Gauge (100% Resolve)
  await evaluate('window.gridbound.battle.resolve = 100; window.gridbound.step(0)');
  await wait('Boolean(document.querySelector("#ultimate.ready"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#ultimate.ready"))'), true, 'Ultimate button must have .ready class');
  assert.equal(await evaluate('document.querySelector("#ultimate").disabled'), false, 'Ultimate button must be enabled at 100%');

  // 5. Test Party Guard Active Aura
  await evaluate('window.gridbound.battle.guardLeft = 2.1; window.gridbound.step(0)');
  await wait('Boolean(document.querySelector("#guard.guarding"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#guard.guarding"))'), true, 'Guard must have .guarding class when active');

  await screenshot('artifacts/combat-hud-hades-desktop.png');
  console.log('✓ Captured artifacts/combat-hud-hades-desktop.png');

  // 6. WP7 readability: the idle intent teaches the basics between threats.
  await evaluate('window.gridbound.battle.threats = []; window.gridbound.battle.guardLeft = 0; window.gridbound.step(0)');
  await wait('!document.querySelector("#intent").classList.contains("danger") && !document.querySelector("#intent").classList.contains("guarding")');
  const idle = await evaluate(`({ opacity: Number(getComputedStyle(document.querySelector('#intent')).opacity), hint: document.querySelector('#intent span').textContent })`);
  assert.ok(idle.opacity > 0.5 && /Tap heroes/.test(idle.hint), `Idle intent hint is visible: ${JSON.stringify(idle)}`);

  // 7. GUARD NOW: only once an all-grid hit is inside the Guard duration (2.8s).
  await evaluate(`(() => { const b = window.gridbound.battle; b.guardLeft = 0; b.guardCooldown = 0; b.threats = [{ id: 990, name: 'WORLDLESS RITUAL', type: 'all', slots: [0,1,2,3,4,5,6,7,8], left: 4.1, total: 4.2 }]; window.gridbound.step(0); })()`);
  assert.equal(await evaluate('document.querySelector("#guard").classList.contains("ready-window")'), false, 'No Guard cue while pressing now would expire before impact');
  await evaluate('window.gridbound.battle.threats[0].left = 2.6; window.gridbound.step(0)');
  await wait('document.querySelector("#guard").classList.contains("ready-window")');
  assert.equal(await evaluate('document.querySelector("#guard-label").textContent'), 'GUARD NOW');
  await evaluate('window.gridbound.battle.guard(); window.gridbound.step(0)');
  assert.equal(await evaluate('document.querySelector("#guard").classList.contains("ready-window")'), false, 'The cue clears once Guard is up');

  // 8. Boss status chips (with the enrage countdown) and a stun's DELAYED note, all in the never-covered status strip.
  await evaluate(`(() => { const b = window.gridbound.battle; b.threats = []; b.markLeft = 3; b.weakenLeft = 4; b.curses = [{ source: 0, left: 5, power: 1, tick: 1 }]; b.stageTime = 140; window.gridbound.step(0); })()`);
  await wait('document.querySelectorAll("#boss-status .status-chip").length === 4');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#boss-status .status-chip")].map(chip => chip.dataset.status)'), ['mark', 'weaken', 'curse', 'enrage']);
  assert.match(await evaluate('document.querySelector("#boss-status [data-status=enrage]").textContent'), /^ENRAGE \d+s$/);
  await evaluate('window.gridbound.battle.stageTime = 151; window.gridbound.step(0)');
  await wait('document.querySelector("#boss-status [data-status=enrage]")?.textContent === "ENRAGED"');
  assert.equal(await evaluate('document.querySelector("#boss-status [data-status=enrage]").classList.contains("on")'), true);
  await evaluate(`(() => { const b = window.gridbound.battle, h = b.heroes.find(x => x.hp > 0); b.emit({ type: 'stun', source: h.id, kind: 'stun', amount: 1.6, text: 'DELAYED +1.6s' }); })()`);
  await wait('document.querySelector("#boss-status [data-status=delay]")?.textContent === "DELAYED +1.6s"');
  await wait('[...document.querySelectorAll("#combat-log .log-entry")].some(p => /: DELAYED \\+1\\.6s$/.test(p.textContent))');

  // 9. KO moment: danger banner and a log line with the cause; impacts are logged with who they hit.
  await evaluate(`(() => { const b = window.gridbound.battle; b.stageTime = 20; const h = b.heroes[1]; h.hp = 1; h.shield = 0; h.counterLeft = 0; b.weakenLeft = 0; b.guardLeft = 0; b.hurt(h, 500, { kind: 'claw' }); })()`);
  await wait('/DOWN$/.test(document.querySelector("#banner").textContent)');
  assert.equal(await evaluate('document.querySelector("#banner").classList.contains("danger")'), true);
  await wait('[...document.querySelectorAll("#combat-log .log-entry")].some(p => /fell to the boss/.test(p.textContent))');
  await evaluate(`(() => { const b = window.gridbound.battle, h = b.heroes.find(x => x.hp > 0); b.threats = [{ id: 991, name: 'FALLING SHARDS', type: 'meteor', slots: [h.slot], left: .01, total: 3.2, damage: 10 }]; window.gridbound.step(.05); })()`);
  await wait('[...document.querySelectorAll("#combat-log .log-entry")].some(p => /FALLING SHARDS hit .+ for \\d+/.test(p.textContent))');
  // A finished channel heals the boss (its own banner) and is not logged as a miss.
  await evaluate(`(() => { const b = window.gridbound.battle; b.threats = [{ id: 992, name: 'MENDING RITE', type: 'channel', slots: [], effect: 'mend', left: .01, total: 4.2 }]; window.gridbound.step(.05); })()`);
  await wait('[...document.querySelectorAll("#combat-log .log-entry")].some(p => /THE WOUND CLOSES/.test(p.textContent))');
  assert.equal(await evaluate('[...document.querySelectorAll("#combat-log .log-entry")].some(p => /MENDING RITE hit nobody/.test(p.textContent))'), false, 'A finished channel is not logged as a miss');
  await evaluate('for (let i = 0; i < 40; i++) window.dispatchEvent(new CustomEvent("battle-banner", { detail: { type: "banner", text: "REINFORCEMENTS" } }))');
  assert.equal(await evaluate('document.querySelectorAll("#combat-log .log-entry").length'), 30, 'The log keeps 30 entries');
  assert.equal(await evaluate('document.querySelector("#battle-screen .run-boons").hidden && document.querySelector("#battle-screen .run-shop-panel").hidden'), true, 'Roguelike-only panels are hidden in Story');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#guard .key-hint")).display !== "none"'), true, 'Desktop shows the keyboard letters');
  await screenshot('artifacts/combat-hud-wp7-desktop.png');

  console.log('✓ Desktop Combat HUD test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });
  const mobileBounds = await evaluate(`(() => {
    const bounds = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const column = document.querySelector('#battle-screen .arena-column');
    const targets = Array.from(document.querySelectorAll(
      '#battle-screen .battle-view-tabs button, #battle-screen .arena-heading-controls button, #battle-screen .lane-targets button, #battle-screen #focus-bar, #battle-screen .action-bar button, #battle-screen [data-tap]'
    )).filter(button => {
      const r = button.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    }).map(button => {
      const r = button.getBoundingClientRect();
      return { height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      column: { clientHeight: column.clientHeight, scrollHeight: column.scrollHeight },
      content: ['.battle-top', '.threat-band', '.battle-banner', '.arena', '#focus-bar', '.action-bar'].map(bounds),
      targets
    };
  })()`);
  assert.ok(mobileBounds.page.width <= mobileBounds.viewport.width + 1, 'Combat screen must not overflow horizontally');
  assert.ok(mobileBounds.page.height <= mobileBounds.viewport.height + 1, 'Combat screen must not overflow vertically');
  assert.ok(mobileBounds.column.scrollHeight <= mobileBounds.column.clientHeight + 1, 'Phone combat content must fit without an internal scroll');
  assert.ok(mobileBounds.content.every(box => box.left >= 0 && box.right <= mobileBounds.viewport.width && box.top >= 0 && box.bottom <= mobileBounds.viewport.height), 'Required combat regions must remain in the viewport');
  assert.ok(mobileBounds.targets.length > 0 && mobileBounds.targets.every(target => target.height >= 44 && target.left >= 0 && target.right <= mobileBounds.viewport.width && target.top >= 0 && target.bottom <= mobileBounds.viewport.height), 'Mobile combat targets must be 44px and fully visible');


  // Each grid cell carries its own HP bar and skill chip; the chip switches skills in place.
  assert.equal(await evaluate('document.querySelectorAll("#unit-layer .unit-card .unit-hp").length'), await evaluate('window.gridbound.battle.heroes.length'));
  // K2/K4 (phone contract): the chip's tap zone is at least 24px tall and stays inside its own card (from the HP bar to 2px under the card),
  // so the card's middle stays the hero and a chip never takes a tap meant for the card below; each card carries its hero's name.
  const chipHit = await evaluate(`(() => {
    const chip = document.querySelector('[data-skill-switch="0"]'), card = chip.closest('.unit-card'), r = chip.getBoundingClientRect(), c = card.getBoundingClientRect(), hp = card.querySelector('.unit-hp').getBoundingClientRect();
    let top = Infinity, bottom = -Infinity;
    for (let y = r.bottom + 12; y > c.top; y -= .5) if (document.elementFromPoint(r.left + r.width / 2, y)?.closest('.unit-skill') === chip) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return { height: r.height, hit: bottom - top, belowCard: bottom - c.bottom, aboveHp: hp.top - top, center: Boolean(document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)?.closest('[data-tap="0"]')), name: card.querySelector('.unit-name').getBoundingClientRect().width > 0 };
  })()`);
  assert.ok(chipHit.hit >= 24 && chipHit.belowCard <= 2.5 && chipHit.aboveHp <= 1 && chipHit.height < 30 && chipHit.center && chipHit.name, `Skill chip hit area is >= 24px inside its card without covering the hero: ${JSON.stringify(chipHit)}`);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#guard .key-hint")).display'), 'none', 'Touch screens hide the keyboard letters');
  // A chip tap right after a hero tap is a slipped mash: ignored.
  const stanceGuarded = await evaluate('window.gridbound.battle.hero(0).stance');
  await click('[data-tap="0"]');
  await click('[data-skill-switch="0"]');
  assert.equal(await evaluate('window.gridbound.battle.hero(0).stance'), stanceGuarded, 'Chip taps within 300ms of a hero tap do not switch skills');
  await new Promise(resolve => setTimeout(resolve, 350));
  const stanceBefore = await evaluate('window.gridbound.battle.hero(0).stance');
  await click('[data-skill-switch="0"]');
  assert.notEqual(await evaluate('window.gridbound.battle.hero(0).stance'), stanceBefore, 'Grid skill chip switches a two-skill hero in one tap');
  assert.match(await evaluate('document.querySelector("#skill-toast").hidden ? "" : document.querySelector("#skill-toast").textContent'), /Skill: .+\(tap again to undo\)/, 'A switch shows the undo toast');
  await evaluate('window.gridbound.battle.hero(0).skills.push(2); window.gridbound.step(0)');
  await click('[data-skill-switch="0"]');
  await wait('!document.querySelector("#skill-picker").hidden && document.querySelectorAll("#skill-picker [data-pick-skill]").length === 3');
  await click('#skill-picker [data-pick-skill="2"]');
  assert.equal(await evaluate('window.gridbound.battle.hero(0).stance'), 2, 'Skill picker sets the chosen skill');
  assert.equal(await evaluate('document.querySelector("#skill-picker").hidden'), true, 'Skill picker closes after choosing');
  await evaluate('window.gridbound.battle.hero(0).skills.pop(); window.gridbound.battle.stance(0, window.gridbound.battle.hero(0).skills[0])');

  // Trigger damage, threat, and ultimate on mobile
  await evaluate(`(() => {
    window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.52);
    window.gridbound.battle.threats = [{
      id: 998,
      name: 'Emerald Pyre',
      type: 'lane',
      slots: [3, 4, 5],
      left: 2.8,
      total: 4,
      counter: '🏃 RELOCATE HERO · Hindari tile terbakar.',
      targetId: 0
    }];
    window.gridbound.battle.resolve = 100;
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');

  // Capture Mobile Combat HUD (two animation frames first: a capture taken right after a DOM change can come back blank under mobile emulation)
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await settle();
  await screenshot('artifacts/combat-hud-hades-mobile-390.png');
  // WP7 phone readability: an all-grid ritual inside the Guard window, boss statuses and the enrage countdown, all above the grid.
  await evaluate(`(() => { const b = window.gridbound.battle; b.resolve = 40; b.guardLeft = 0; b.guardCooldown = 0; b.markLeft = 3; b.weakenLeft = 4; b.stageTime = 140;
    b.threats = [{ id: 997, name: 'WORLDLESS RITUAL', type: 'all', slots: [0,1,2,3,4,5,6,7,8], left: 2.4, total: 4.2, counter: 'ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Pindah tile tidak membantu.' }]; window.gridbound.step(0); })()`);
  await wait('document.querySelector("#guard").classList.contains("ready-window") && document.querySelectorAll("#boss-status .status-chip").length === 3 && Boolean(document.querySelector("#boss-status [data-status=enrage]"))');
  assert.match(await evaluate('document.querySelector("#intent span").textContent'), /^ALL GRID: Guard just before impact/, 'The simulation\'s counter text reaches the HUD in English');
  const intel = await evaluate(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(), card = r('#unit-layer .unit-card'), intent = r('#intent'), status = r('#boss-status');
    return { intentBottom: intent.bottom, statusBottom: status.bottom, frontRow: card.top }; })()`);
  assert.ok(intel.intentBottom <= intel.frontRow && intel.statusBottom <= intel.frontRow, `Intent panel and boss statuses stay above the front row: ${JSON.stringify(intel)}`);
  await settle();
  await screenshot('artifacts/combat-hud-wp7-mobile-390.png');
  console.log('✓ Captured artifacts/combat-hud-hades-mobile-390.png');

  console.log('✓ Mobile Combat HUD test passed');
}, { width: 390, height: 844, mobile: true });

// 3. Ready phase (390x844): the ready sheet leaves the grid visible and heroes can be dragged into formation.
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector(\'[data-facility="campaign"]\'))');
  await evaluate('document.fonts.ready');
  await click.nav('campaign');
  await click('[data-zone="0"]');
  await click('[data-depart="adventure"]');
  await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');
  const drag = await evaluate(`(() => {
    const b = window.gridbound.battle, h = b.heroes[0], arena = document.querySelector('#arena-stage').getBoundingClientRect();
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(slot => !b.heroes.some(x => x.slot === slot) && slot !== h.slot);
    const at = slot => ({ x: arena.left + (72 + (slot % 3) * 156 + 72) / 600 * arena.width, y: arena.top + (367 + Math.floor(slot / 3) * 124 + 40) / 760 * arena.height });
    const from = at(h.slot), hit = document.elementFromPoint(from.x, from.y);
    return { id: h.id, slot: h.slot, free, from, to: at(free), hitsHero: hit?.closest('[data-tap]')?.dataset.tap === String(h.id) };
  })()`);
  assert.ok(drag.hitsHero, `The ready sheet leaves the front row reachable: ${JSON.stringify(drag)}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...drag.from });
  for (let i = 1; i <= 6; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: drag.from.x + (drag.to.x - drag.from.x) * i / 6, y: drag.from.y + (drag.to.y - drag.from.y) * i / 6 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...drag.to });
  await wait(`window.gridbound.battle.hero(${drag.id}).slot === ${drag.free}`);
  assert.equal(await evaluate('window.gridbound.battle.status'), 'ready', 'Formation moves happen before the fight');
  await screenshot('artifacts/combat-hud-ready-formation-390.png');
  console.log('✓ Ready-phase formation drag passed');
}, { width: 390, height: 844, mobile: true });

// 4. Small-phone Viewport (360x640)
await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
  await send('Page.navigate', { url });
  await enterCampaignBattle({ click, wait, evaluate });

  await evaluate(`(() => {
    window.gridbound.battle.bossHp = Math.round(window.gridbound.battle.bossMax * 0.52);
    window.gridbound.battle.threats = [{
      id: 997,
      name: 'Emerald Pyre',
      type: 'lane',
      slots: [3, 4, 5],
      left: 2.8,
      total: 4,
      counter: 'RELOCATE HERO · Avoid the burning tile before impact.',
      targetId: 0
    }];
    window.gridbound.step(0);
  })()`);
  await wait('Boolean(document.querySelector("#intent.danger"))');
  const bounds = await evaluate(`(() => {
    const box = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const column = document.querySelector('#battle-screen .arena-column');
    const targets = Array.from(document.querySelectorAll(
      '#battle-screen .battle-view-tabs button, #battle-screen .arena-heading-controls button, #battle-screen .lane-targets button, #battle-screen #focus-bar, #battle-screen .action-bar button, #battle-screen [data-tap]'
    )).filter(button => {
      const r = button.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    }).map(button => {
      const r = button.getBoundingClientRect();
      return { height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      column: { clientHeight: column.clientHeight, scrollHeight: column.scrollHeight },
      content: ['.battle-top', '.threat-band', '.battle-banner', '.arena', '#focus-bar', '.action-bar'].map(box),
      targets
    };
  })()`);
  assert.equal(bounds.viewport.width, 360);
  assert.equal(bounds.viewport.height, 640);
  assert.ok(bounds.page.width <= bounds.viewport.width + 1, 'Small-phone combat must not overflow horizontally');
  assert.ok(bounds.page.height <= bounds.viewport.height + 1, 'Small-phone combat must not overflow vertically');
  assert.ok(bounds.column.scrollHeight <= bounds.column.clientHeight + 1,
    `Small-phone threat state must fit without internal scrolling: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.content.every(box => box.left >= 0 && box.right <= bounds.viewport.width && box.top >= 0 && box.bottom <= bounds.viewport.height), 'Required combat regions must remain in the viewport');
  assert.ok(bounds.targets.length > 0 && bounds.targets.every(target => target.height >= 44 && target.left >= 0 && target.right <= bounds.viewport.width && target.top >= 0 && target.bottom <= bounds.viewport.height), 'Small-phone combat targets must be 44px and fully visible');
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await screenshot('artifacts/combat-hud-360x640.png');

  // WP7 on a short phone: the intel band (statuses + intent) overlays the arena top. A warning banner must land below it
  // (its counter text is what the player needs right then) and above the front row; the enrage countdown must not crush the ARMOR meter.
  await evaluate(`(() => { const b = window.gridbound.battle; b.markLeft = 3; b.weakenLeft = 4; b.curses = [{ source: 0, left: 5, power: 1, tick: 1 }]; b.stageTime = 140; b.guardCooldown = 0; b.guardLeft = 0;
    b.threats = [{ id: 998, name: 'TOLLING SILENCE', type: 'all', slots: [0,1,2,3,4,5,6,7,8], left: 2.4, total: 4.2, effect: 'silence', counter: 'ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Tanpa itu, semua cooldown hero mundur 1,5 detik.' }];
    b.emit({ type: 'warning', text: 'TOLLING SILENCE', targets: b.threats[0].slots }); })()`);
  await wait('document.querySelector("#banner").classList.contains("visible") && document.querySelector("#banner").textContent === "TOLLING SILENCE" && Boolean(document.querySelector("#boss-status [data-status=enrage]"))');
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const shortPhone = await evaluate(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(), row = document.querySelector('.stagger-row');
    return { intentBottom: r('#intent').bottom, bannerTop: r('#banner').top, bannerBottom: r('#banner').bottom, frontRow: Math.min(...[...document.querySelectorAll('#unit-layer .unit-card')].map(c => c.getBoundingClientRect().top)),
      track: r('.stagger-track').width, rowScroll: row.scrollWidth, rowClient: row.clientWidth, counter: document.querySelector('#intent span').textContent }; })()`);
  assert.ok(shortPhone.bannerTop >= shortPhone.intentBottom && shortPhone.bannerBottom <= shortPhone.frontRow, `The warning banner sits between the intent panel and the front row: ${JSON.stringify(shortPhone)}`);
  assert.ok(shortPhone.track >= 40 && shortPhone.rowScroll <= shortPhone.rowClient, `The enrage countdown leaves the ARMOR meter alone: ${JSON.stringify(shortPhone)}`);
  assert.ok(!/\(G\)/.test(shortPhone.counter), `Touch players do not see keyboard letters in counter texts: ${shortPhone.counter}`);
  await screenshot('artifacts/combat-hud-360x640-threat.png');
  // Skill chips keep a >= 24px tap target inside their own card on a 360px phone; the card's middle and the hero's body (~30% down) stay the
  // hero's tap area, and so does the top strip (name tag) of a card right under another. Stack a hero directly under another.
  await evaluate(`(() => { const b = window.gridbound.battle, top = b.heroes.find(h => h.slot < 3), below = b.heroes.find(h => h.slot >= 6); b.threats = []; if (top && below) b.move(below.id, top.slot + 3); window.gridbound.step(0); })()`);
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const chips360 = await evaluate(`[...document.querySelectorAll('[data-skill-switch]')].filter(chip => !chip.disabled).map(chip => {
    const card = chip.closest('.unit-card'), r = chip.getBoundingClientRect(), c = card.getBoundingClientRect(); let top = Infinity, bottom = -Infinity;
    for (let y = r.bottom + 12; y > c.top; y -= .5) if (document.elementFromPoint(r.left + r.width / 2, y)?.closest('.unit-skill') === chip) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const hero = (frac) => document.elementFromPoint(c.left + c.width / 2, c.top + c.height * frac)?.closest('[data-tap]')?.dataset.tap === card.dataset.hero;
    return { height: r.height, hit: bottom - top, topFrac: (top - c.top) / c.height, below: bottom - c.bottom, center: hero(.5), body: hero(.3), nameTag: hero(.04) };
  })`);
  assert.ok(chips360.length > 0 && chips360.every(chip => chip.hit >= 24 && chip.below <= 2.5 && chip.height < 30 && chip.topFrac > .5 && chip.center && chip.body && chip.nameTag), `Skill chips keep a 24px target inside their card on a 360px phone: ${JSON.stringify(chips360)}`);
  assert.deepEqual(errors, []);
  console.log('✓ 360x640 combat fit and target-size test passed');
}, { width: 360, height: 640, mobile: true });

// vet-08: a long variant subtitle (CH16 'Frostbound Hollow Choir': 'FROSTBOUND · PADUAN LONCENG' in Indonesian) never runs under the phase
// badge or the name: when the header row is too narrow it wraps under the name. The HP/clock row stays one row; desktop keeps one line.
for (const [width, height, lang] of [[360, 640, 'id'], [390, 844, 'id'], [390, 844, 'en'], [540, 900, 'id'], [1280, 900, 'id'], [1280, 900, 'en']]) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, errors }) => {
    await seedSave(send, { ...ACT_TWO_SAVE, cleared: Array.from({ length: 15 }, (_, i) => i) }, lang);
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")', 20000);
    await evaluate('document.fonts.ready');
    for (let chapter = 1; chapter <= 16; chapter++) {
      await evaluate(`window.gridbound.boot("adventure", ${chapter})`);
      await wait('window.gridbound.battle.status === "ready" && document.querySelector("#boss-title").textContent.length > 0');
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      // The subtitle is measured by its text (a Range), not its box: the bug was an unbreakable word overflowing a 43px box under the phase.
      const h = await evaluate(`(() => { const box = b => ({ l: b.left, r: b.right, t: b.top, b: b.bottom }), r = sel => box(document.querySelector(sel).getBoundingClientRect());
        const title = document.querySelector('#boss-title'), range = document.createRange(); range.selectNodeContents(title);
        return { name: r('#boss-name'), title: box(range.getBoundingClientRect()), phase: r('#phase'), health: r('#boss-health'), clock: r('#clock'), hud: r('.boss-hud'), text: title.textContent, overflow: title.scrollWidth - title.clientWidth, scroll: document.documentElement.scrollWidth - innerWidth }; })()`);
      const meet = (a, b) => a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b - .5 && b.t < a.b - .5, where = `CH${chapter} ${lang} ${width}×${height}: ${JSON.stringify(h)}`;
      assert.ok(!meet(h.title, h.phase) && !meet(h.name, h.title) && !meet(h.name, h.phase), `the boss name, subtitle and phase never overlap (${where})`);
      assert.ok(h.title.r <= h.hud.r + .5 && h.phase.r <= h.hud.r + .5 && h.overflow <= 1 && h.scroll <= 1, `the header stays inside its window (${where})`);
      assert.ok(Math.abs(h.health.t - h.clock.t) < 2, `boss HP and the clock share their row (${where})`);
      if (width >= 1280) assert.ok(h.title.t < h.name.b && h.phase.t < h.name.b, `desktop keeps name, subtitle and phase on one line (${where})`);
      if (chapter === 16) await screenshot(`artifacts/boss-header-${lang}-${width}x${height}.png`);
    }
    assert.deepEqual(errors, []);
    console.log(`✓ boss header ${lang} ${width}×${height}: chapters 1-16 without overlap`);
  }, { width, height, mobile: width < 500 });
}

// ── The fight on a phone (phone contract K2, K5, L10, T1/T3, G5–G7; emulated phones, the browser bars shown where noted) ──
const PHONES = {
  'a360-bars': { width: 360, height: 640, dpr: 3, ua: 'android' },
  'se-bars': { width: 375, height: 553, dpr: 2, ua: 'iphone' },
  'i15-bars': { width: 393, height: 659, dpr: 3, ua: 'iphone' },
  // Portrait only (L6): a desktop or laptop window, itch's inline embed held wide, shows the same one 600px column, the arena sized by height.
  'desk-1280': { width: 1280, height: 720, desktop: true },
  'desk-1366': { width: 1366, height: 768, desktop: true },
  'desk-960': { width: 960, height: 600, desktop: true },
  'i15': { width: 393, height: 852, dpr: 3, ua: 'iphone', insets: { top: 59, bottom: 34 } },
  'p7': { width: 412, height: 915, dpr: 2.625, ua: 'android', insets: { bottom: 24 } },
};
const frames = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))';
async function phoneChapter({ wait, evaluate }, chapter) {
  await evaluate(`window.gridbound.boot('adventure', ${chapter})`);
  await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready" && !document.querySelector("#start-overlay").hidden');
  await evaluate(frames); await new Promise(resolve => setTimeout(resolve, 300));
}
async function phoneOpen({ send, wait, evaluate }, save, lang) {
  await seedSave(send, save, lang);
  await send('Page.navigate', { url });
  await wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 30000);
  await evaluate('document.fonts.ready');
}
const GRID = `(() => { const cards = [...document.querySelectorAll('#unit-layer .unit-card')].map(c => c.getBoundingClientRect());
  const names = [...document.querySelectorAll('#unit-layer .unit-skill-name, #unit-layer .unit-name')].filter(n => n.getBoundingClientRect().width > 0);
  return { heroes: cards.length, cell: [Math.min(...cards.map(r => r.width)), Math.min(...cards.map(r => r.height))].map(Math.round),
    cut: names.filter(n => n.scrollWidth > n.clientWidth + .5).map(n => n.textContent), fonts: Math.min(...names.map(n => parseFloat(getComputedStyle(n).fontSize))), scroll: document.documentElement.scrollWidth - innerWidth }; })()`;
// L10/K5: during the ready window every hero card is hit at its centre (the sheet ends above the front row), and FIGHT! with its ◀ Back sit in
// the tray, in the bottom 40% of the screen (of #app on a wide window) and hit-testable. 8 heroes (the late save) in chapters 1, 5 and 11; the
// grid, chips and name tags (K2: cells >= 75px wide; T1/T3: 12px, never cut) in the fight that follows; 6 heroes (the mid save) too. On the
// desktop windows (1280×720, 1366×768, 960×600) the battle is one portrait column: #app at most 600px wide, centred, the arena and the tray
// sharing a left edge.
for (const [name, lang] of [['se-bars', 'en'], ['se-bars', 'id'], ['a360-bars', 'en'], ['a360-bars', 'id'], ['i15-bars', 'en'], ['desk-1280', 'en'], ['desk-1366', 'en'], ['desk-960', 'en'], ['desk-960', 'id']]) {
  const phone = PHONES[name], minCell = 75;
  for (const save of [LATE, MID]) await withBrowser(async h => {
    const { wait, evaluate, screenshot, errors } = h, heroes = save === LATE ? 8 : 6;
    await phoneOpen(h, save, lang);
    for (const chapter of save === LATE ? [1, 5, 11] : [5]) {
      await phoneChapter(h, chapter);
      const ready = await evaluate(`(() => { const H = innerHeight, cover = [];
        for (const c of document.querySelectorAll('#unit-layer .unit-card')) { const r = c.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!c.contains(e)) cover.push(c.dataset.hero + '→' + (e?.id || e?.className)); }
        const app = document.getElementById('app').getBoundingClientRect(), H0 = app.top, AH = app.height;
        const at = sel => { const e = document.querySelector(sel), r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: (r.top - H0) / AH, hit: e.contains(hit), shown: r.height > 0 }; };
        const slot = document.querySelector('.arena-slot').getBoundingClientRect(), tray = document.querySelector('.action-bar').getBoundingClientRect();
        return { cover, start: at('#start'), back: at('#ready-back'), cmds: [...document.querySelectorAll('.action-bar > .cmd')].filter(c => c.getBoundingClientRect().height > 0).length,
          app: [Math.round(app.left), Math.round(app.width), Math.round(innerWidth - app.right)], column: Math.abs(slot.left - tray.left) <= 1 && tray.top >= slot.bottom - 1 }; })()`);
      const where = `${name} ${lang} CH${chapter} ${heroes} heroes: ${JSON.stringify(ready)}`;
      assert.deepEqual(ready.cover, [], `L10: nothing covers a hero card before FIGHT! (${where})`);
      assert.ok(ready.start.shown && ready.start.hit && ready.back.shown && ready.back.hit, `FIGHT! and ◀ Back are on screen and hit-testable (${where})`);
      assert.ok(ready.start.top >= .6 && ready.back.top >= .6, `K5: FIGHT! and ◀ Back sit in the bottom 40% (${where})`);
      assert.ok(ready.column, `L6: one column, the tray under the arena on the same left edge (${where})`);
      if (phone.desktop) assert.ok(ready.app[1] <= 600 && Math.abs(ready.app[0] - ready.app[2]) <= 1, `L6: #app is one centred column at most 600px wide (${where})`);
      assert.equal(ready.cmds, 0, `the tray shows only FIGHT! and its Back before the fight (${where})`);
    }
    await screenshot(`artifacts/combat-hud-phone-${name}-${lang}-${heroes}-ready.png`);
    await evaluate('document.querySelector("#start").click()');
    await wait('window.gridbound.battle.status === "fighting"');
    await evaluate(frames); await new Promise(resolve => setTimeout(resolve, 300));
    const grid = await evaluate(GRID), where = `${name} ${lang} ${heroes} heroes: ${JSON.stringify(grid)}`;
    assert.equal(grid.heroes, heroes, where);
    assert.ok(grid.cell[0] >= minCell && grid.cell[1] >= 56, `K2: hero cards at least ${minCell}px wide (${where})`);
    assert.deepEqual(grid.cut, [], `T3: no skill chip or name tag is cut (${where})`);
    assert.ok(grid.fonts >= 12 && grid.scroll <= 1, `T1: chips and name tags are 12px or more, no sideways scroll (${where})`);
    assert.equal(await evaluate('[...document.querySelectorAll(".action-bar > .cmd")].filter(c => c.getBoundingClientRect().height > 0).length'), 3, 'Guard, Potion and Ninefold Dawn are back in the tray after FIGHT!');
    await screenshot(`artifacts/combat-hud-phone-${name}-${lang}-${heroes}-fight.png`);
    assert.deepEqual(errors, []);
    console.log(`✓ phone ${name} ${lang}, ${heroes} heroes: ready window clear of the grid, FIGHT! in the tray, cells ${grid.cell.join('×')}, labels whole`);
  }, phone.desktop ? { width: phone.width, height: phone.height } : { phone });
}

// G5/G6/G7 with real touches on the iPhone 15 and Pixel 7 profiles: the card's zones, drags from the chip, a slid tap, two thumbs, Potion.
for (const name of ['i15', 'p7']) await withBrowser(async h => {
  const { send, wait, evaluate, touch, key, errors } = h, sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  await phoneOpen(h, LATE, 'en');
  await phoneChapter(h, 13);
  await evaluate('document.querySelector("#start").click()');
  await wait('window.gridbound.battle.status === "fighting"');
  // The battle clock stands still (the HUD keeps drawing), so taps, moves and Guard are read without the boss interfering.
  await evaluate('window.gridbound.scene.timeScale = 0; window.gridbound.battle.threats = []');
  const finger = (x, y, id = 1) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 });
  const T = (type, touchPoints) => send('Input.dispatchTouchEvent', { type, touchPoints });
  const rect = id => evaluate(`(() => { const r = document.querySelector('#unit-layer [data-hero="${id}"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const hero = id => evaluate(`(() => { const h = window.gridbound.battle.hero(${id}); return { slot: h.slot, stance: h.stance }; })()`);
  const taps = () => evaluate('window.gridbound.battle.taps');
  // Taps and moves wait on the battle clock (tap repeat, move lock): the stopped clock is reset between steps.
  const rest = async () => { await evaluate('window.gridbound.battle.heroes.forEach(h => { h.fatigue = 0; h.lastTap = -99; h.moveLock = 0; })'); await sleep(350); };
  const [A, B] = await evaluate(`(() => { const b = window.gridbound.battle, hs = b.heroes; const a = hs.find(h => h.slot >= 3 && h.slot < 6 && hs.some(x => x.slot === h.slot + 3) && b.availableSkills(h.id).length === 2); return [a.id, hs.find(x => x.slot === a.slot + 3).id]; })()`);
  // K2: a touch at 55% and 60% of a card charges its hero (the chip starts lower).
  for (const frac of [.55, .6]) {
    await rest(); const c = await rect(A), t0 = await taps(), s0 = (await hero(A)).stance;
    await touch.tap({ x: c.x + c.w / 2, y: c.y + c.h * frac }); await sleep(150);
    assert.deepEqual([await taps() - t0, (await hero(A)).stance], [1, s0], `${name}: a touch at ${frac * 100}% of the card charges the hero`);
  }
  // K4: a touch at 6% into the card under another (its name tag) is that card's own, never the chip above.
  { await rest(); const c = await rect(B), t0 = await taps(), s0 = (await hero(A)).stance;
    const hit = await evaluate(`document.elementFromPoint(${c.x + c.w / 2}, ${c.y + c.h * .06})?.closest('.unit-tap')?.dataset.tap`);
    await touch.tap({ x: c.x + c.w / 2, y: c.y + c.h * .06 }); await sleep(150);
    assert.deepEqual([hit, await taps() - t0, (await hero(A)).stance, await evaluate('window.gridbound.battle.selected')], [String(B), 1, s0, B], `${name}: the top strip of a lower card belongs to its own hero`); }
  // G5: a drag that starts on the chip moves the hero (to the tile above); a chip tap without movement still switches the skill.
  { await rest(); const c = await rect(A), h0 = await hero(A), from = { x: c.x + c.w / 2, y: c.y + c.h * .85 };
    await touch.drag(from, { x: from.x, y: from.y - c.h * 1.1 }, 10); await sleep(200);
    const h1 = await hero(A);
    assert.deepEqual([h1.slot, h1.stance], [h0.slot - 3, h0.stance], `${name}: a drag from the skill chip moves the hero and keeps its skill`); }
  { await rest(); const c = await rect(A), s0 = (await hero(A)).stance;
    await touch.tap({ x: c.x + c.w / 2, y: c.y + c.h * .85 }); await sleep(200);
    assert.notEqual((await hero(A)).stance, s0, `${name}: a tap on the chip switches the skill`);
    assert.match(await evaluate('document.querySelector("#skill-toast").textContent'), /Skill: .+\(tap again to undo\)/); }
  // G5: a thumb that slides 14px and lifts on its own tile within 300 ms taps (the four touch events queued like a quick finger).
  { await rest(); const c = await rect(A), t0 = await taps(), slot = (await hero(A)).slot, p = { x: c.x + c.w / 2, y: c.y + c.h * .3 };
    const queued = [T('touchStart', [finger(p.x, p.y)])]; for (const dx of [5, 10, 14]) { await sleep(16); queued.push(T('touchMove', [finger(p.x + dx, p.y)])); }
    await sleep(16); queued.push(T('touchEnd', [])); await Promise.all(queued); await sleep(150);
    assert.deepEqual([await taps() - t0, (await hero(A)).slot], [1, slot], `${name}: a slid tap on the hero's own tile is a tap`); }
  // G6: finger 1 rests on a hero card while finger 2 taps Guard, Potion, Ninefold Dawn, Ⅱ Menu.
  const thumbs = async sel => {
    const c = await rect(B), a = { x: c.x + c.w / 2, y: c.y + c.h * .3 }, b = await touch.point(sel);
    await T('touchStart', [finger(a.x, a.y, 1)]); await sleep(60); await T('touchStart', [finger(a.x, a.y, 1), finger(b.x, b.y, 2)]); await sleep(60);
    await T('touchEnd', [finger(a.x, a.y, 1)]); await sleep(60); await T('touchEnd', []); await sleep(250);
  };
  await rest(); await thumbs('#guard');
  assert.ok(await evaluate('window.gridbound.battle.guardLeft > 0'), `${name}: Guard works while another finger is on a hero`);
  await evaluate('window.gridbound.battle.heroes.forEach(h => { h.hp = h.maxHp * .5; }); window.gridbound.battle.potions = 2'); await sleep(200);
  await thumbs('#potion');
  assert.equal(await evaluate('window.gridbound.battle.potions'), 1, `${name}: Potion works while another finger is on a hero`);
  await evaluate('window.gridbound.battle.resolve = 100'); await sleep(250);
  await thumbs('#ultimate');
  assert.ok(await evaluate('window.gridbound.battle.resolve < 100'), `${name}: Ninefold Dawn works while another finger is on a hero`);
  await thumbs('#pause');
  assert.ok(await evaluate('window.gridbound.battle.status === "paused" && Boolean(document.querySelector("dialog[open] #pause-retreat"))'), `${name}: Ⅱ Menu works while another finger is on a hero`);
  await evaluate('document.querySelector("dialog[open]").close(); if (window.gridbound.battle.status === "paused") window.gridbound.battle.pause();'); await sleep(300);
  // G6: a keyboard Enter on Guard guards exactly once (its click has detail 0).
  await evaluate(`(() => { const b = window.gridbound.battle, guard = b.guard.bind(b); window.__guards = 0; b.guardCooldown = 0; b.guardLeft = 0; b.guard = () => { window.__guards++; return guard(); }; document.querySelector('#guard').disabled = false; document.querySelector('#guard').focus(); })()`);
  await key('Enter'); await sleep(200);
  assert.equal(await evaluate('window.__guards'), 1, `${name}: Enter on Guard guards once`);
  // G7: a quick double tap on Potion at full HP spends nothing and says why; hurt, it spends exactly one.
  await evaluate('window.gridbound.battle.potions = 2; window.gridbound.battle.heroes.forEach(h => { h.hp = h.maxHp; })'); await sleep(700);
  await touch.rapidDoubleTap('#potion', 150); await sleep(250);
  assert.equal(await evaluate('window.gridbound.battle.potions'), 2, `${name}: Potion at full HP spends nothing`);
  assert.equal(await evaluate('document.querySelector("#skill-toast").hidden ? "" : document.querySelector("#skill-toast").textContent'), 'Party is healthy');
  await evaluate('window.gridbound.battle.heroes.forEach(h => { h.hp = h.maxHp * .3; })'); await sleep(700);
  await touch.rapidDoubleTap('#potion', 150); await sleep(250);
  assert.equal(await evaluate('window.gridbound.battle.potions'), 1, `${name}: a double tap on Potion spends one`);
  assert.deepEqual(errors, []);
  console.log(`✓ phone ${name}: card zones, chip drag and tap, slid tap, two thumbs, Enter on Guard, Potion double tap`);
}, { phone: PHONES[name] });

// G9: on a touch screen the Controls help names the gestures, not the keys.
await withBrowser(async h => {
  const { wait, evaluate } = h;
  await phoneOpen(h, MID, 'id');
  await phoneChapter(h, 2);
  await evaluate('document.querySelector("#start").click()'); await wait('window.gridbound.battle.status === "fighting"');
  await evaluate('document.querySelector("#pause").click()'); await wait('Boolean(document.querySelector("dialog[open] #pause-help"))');
  await evaluate('document.querySelector("dialog[open] #pause-help").click()'); await wait('Boolean(document.querySelector("dialog[open] .help-rows"))');
  const titles = await evaluate('[...document.querySelectorAll("dialog[open] .help-rows b")].map(b => b.textContent)');
  assert.ok(titles.includes('Ketuk hero') && titles.some(t => /chip skill/.test(t)) && titles.includes('Jeda · Ⅱ Menu') && titles.some(t => t.startsWith('Kembali · tombol Kembali ponsel')), `touch help titles: ${JSON.stringify(titles)}`);
  assert.ok(!titles.some(t => /Esc|Spasi|1–9|Q \/ E| · [GHR]\b/.test(t)), `no key names on a touch screen: ${JSON.stringify(titles)}`);
  console.log('✓ phone Controls help names touch gestures (ID)');
}, { phone: PHONES['a360-bars'] });
