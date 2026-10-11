import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

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
      health: document.querySelector("#boss-hp").style.width,
      ghost: document.querySelector("#boss-hp-ghost").style.width
    };
  })()`);
  assert.ok(Math.abs(Number.parseFloat(bossHealth.health) - bossHealth.expected) < 0.001, 'Boss HP bar must track the current health ratio');
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
  // The chip looks the same but takes taps across >=36px (never past the card's middle, which stays the hero); each card carries its hero's name.
  const chipHit = await evaluate(`(() => {
    const chip = document.querySelector('[data-skill-switch="0"]'), card = chip.closest('.unit-card'), r = chip.getBoundingClientRect(), c = card.getBoundingClientRect();
    let top = Infinity, bottom = -Infinity;
    for (let y = r.bottom + 12; y > c.top; y -= .5) if (document.elementFromPoint(r.left + r.width / 2, y)?.closest('.unit-skill') === chip) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return { height: r.height, hit: bottom - top, center: Boolean(document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)?.closest('[data-tap="0"]')), name: card.querySelector('.unit-name').getBoundingClientRect().width > 0 };
  })()`);
  assert.ok(chipHit.hit >= 36 && chipHit.height < 30 && chipHit.center && chipHit.name, `Skill chip hit area is ~36px without growing or covering the hero: ${JSON.stringify(chipHit)}`);
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
    const b = window.gridbound.battle, h = b.heroes[0], arena = document.querySelector('#arena').getBoundingClientRect();
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
  // Skill chips keep a >=36px tap target on a 360px phone; the card's middle and the hero's body (~30% down) stay the hero's tap area.
  // Stack a hero directly under another, so one chip's tap area meets the card below it.
  await evaluate(`(() => { const b = window.gridbound.battle, top = b.heroes.find(h => h.slot < 3), below = b.heroes.find(h => h.slot >= 6); b.threats = []; if (top && below) b.move(below.id, top.slot + 3); window.gridbound.step(0); })()`);
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const chips360 = await evaluate(`[...document.querySelectorAll('[data-skill-switch]')].filter(chip => !chip.disabled).map(chip => {
    const card = chip.closest('.unit-card'), r = chip.getBoundingClientRect(), c = card.getBoundingClientRect(); let top = Infinity, bottom = -Infinity;
    for (let y = r.bottom + 12; y > c.top; y -= .5) if (document.elementFromPoint(r.left + r.width / 2, y)?.closest('.unit-skill') === chip) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const hero = (frac) => document.elementFromPoint(c.left + c.width / 2, c.top + c.height * frac)?.closest('[data-tap]')?.dataset.tap === card.dataset.hero;
    return { height: r.height, hit: bottom - top, topFrac: (top - c.top) / c.height, center: hero(.5), body: hero(.3) };
  })`);
  assert.ok(chips360.length > 0 && chips360.every(chip => chip.hit >= 36 && chip.height < 30 && chip.topFrac > .5 && chip.center && chip.body), `Skill chips keep a 36px target on a 360px phone: ${JSON.stringify(chips360)}`);
  assert.deepEqual(errors, []);
  console.log('✓ 360x640 combat fit and target-size test passed');
}, { width: 360, height: 640, mobile: true });
