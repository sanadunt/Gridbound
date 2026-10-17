import assert from 'node:assert/strict';
import { withBrowser, seedSave, ACT_TWO_SAVE } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

for (const [width, height] of [[1440, 900], [540, 900], [390, 844], [360, 640]]) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, click, key, errors }) => {
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
    await evaluate('window.gridbound.showTitle()');
    await wait('!document.querySelector("#title-screen").hidden');
    await click('#title-enter');
    await wait('document.querySelector("#title-screen").hidden && document.querySelector("#town-screen:not([hidden]) .camp-scene")', 5000);

    const camp = await evaluate(`(() => {
      const nav = [...document.querySelectorAll('.town-spot')].map(button => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      return {
        title: document.querySelector('.camp-scene h1')?.firstChild?.textContent.trim(),
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        nav
      };
    })()`);
    assert.equal(camp.title, 'Emberhollow');
    assert.ok(camp.document.width <= width + 1 && camp.document.height <= height + 1, `Camp must fit ${width}×${height}: ${JSON.stringify(camp)}`);
    assert.equal(camp.nav.length, 9, 'Camp exposes nine tappable buildings');
    // The guide's call to action sits fully inside its window and the viewport (on a fresh save it is the one-tap Continue story).
    const go = await evaluate(`(() => { const r = document.querySelector('.camp-copy .guide-go').getBoundingClientRect(), w = document.querySelector('.camp-copy').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, win: [w.top, w.bottom], story: document.querySelector('.camp-copy .guide-go').dataset.continueStory }; })()`);
    assert.ok(go.top >= 0 && go.bottom <= height && go.left >= 0 && go.right <= width && go.height >= 44, `Guide Go is fully on screen at ${width}×${height}: ${JSON.stringify(go)}`);
    assert.ok(go.top >= go.win[0] && go.bottom <= go.win[1], `Guide Go stays inside its window: ${JSON.stringify(go)}`);
    assert.equal(go.story, '0', 'a fresh camp offers Chapter 1 in one tap');
    // Modes the story has not reached are locked and say which chapter opens them.
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.town-spot[data-locked]')].map(b => b.dataset.locked + ':' + b.querySelector('.town-sign small').textContent)`), ['dungeon:Clear Chapter 1', 'endless:Clear Chapter 4', 'raid:Clear Chapter 2']);
    assert.ok(camp.nav.every(button => button.width >= 44 && button.height >= 44), `Building targets remain at least 44×44: ${JSON.stringify(camp.nav)}`);
    const settings = await evaluate(`(() => {
      const rect = document.querySelector('#settings').getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    })()`);
    assert.ok(settings.width > 0 && settings.height > 0 && settings.left >= 0 && settings.right <= width,
      `Settings remains visible inside the ${width}×${height} header: ${JSON.stringify(settings)}`);
    // The guide window fades in 0.25 s after the map (animateTownEntrance): let it land before the screenshot.
    await new Promise(resolve => setTimeout(resolve, 700));
    await screenshot(`artifacts/camp-gridbound-${width}x${height}.png`);
    await key('Tab');
    const focused = await evaluate(`(() => {
      const element = document.activeElement;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { focusVisible: element.matches(':focus-visible'), visible: rect.width > 0 && rect.height > 0,
        outline: style.outlineStyle, outlineWidth: style.outlineWidth };
    })()`);
    assert.ok(focused.focusVisible && focused.visible && focused.outline !== 'none' && focused.outlineWidth !== '0px',
      `Keyboard focus stays visible on an actionable control: ${JSON.stringify(focused)}`);

    await evaluate('document.querySelector(".town-spot[data-facility=campaign]").focus()');
    await key('Enter');
    await wait('document.querySelector(".world-map-wrapper.map-view")');
    await evaluate(`document.querySelector('[data-zone="0"]').focus()`);
    await key(' ', 'Space');
    await wait('document.querySelector(".world-map-wrapper.mission-view .world-map-dossier")');
    const deploy = await evaluate(`(() => {
      const rect = document.querySelector('.mission-brief [data-depart="adventure"]').getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    })()`);
    assert.ok(deploy.width >= 44 && deploy.height >= 44 && deploy.left >= 0 && deploy.right <= width && deploy.top >= 0 && deploy.bottom <= height,
      `Mission Deploy remains visible at ${width}×${height}: ${JSON.stringify(deploy)}`);
    assert.ok(await evaluate('document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1'),
      'Mission selection does not create document scrolling');
    // On a route the HUD shows the framed Back, the route title and the tools side by side (a long title shortens with an ellipsis instead).
    const hud = await evaluate(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(), back = r('#home'), title = r('#hud-title'), tools = r('.header-tools'); return { back: [back.left, back.right, back.height], title: [title.left, title.right], tools: [tools.left, tools.right], text: document.querySelector('#home').innerText.trim() }; })()`);
    assert.ok(hud.back[0] >= 0 && hud.back[2] >= 44 && hud.back[1] <= hud.title[0] + 1 && hud.title[1] <= hud.tools[0] + 1 && hud.tools[1] <= width + 1, `HUD Back, title and tools do not overlap at ${width}: ${JSON.stringify(hud)}`);
    assert.equal(hud.text, '◀ Back');

    await click('.mission-map-return');
    await click.nav('more');
    await wait('document.querySelector(".more-scene")');
    const menu = await evaluate(`(() => ({
      journal: Boolean(document.querySelector('.more-scene [data-open-action="journal"]')),
      profiles: Boolean(document.querySelector('.more-scene [data-open-action="profiles"]')),
      challengeShop: Boolean(document.querySelector('.more-scene [data-facility="challenge-shop"]')),
      settings: Boolean(document.querySelector('.more-scene [data-open-action="settings"]'))
    }))()`);
    assert.ok(menu.journal && menu.profiles && menu.challengeShop && menu.settings, `More exposes journal, profile, challenge shop, and settings actions: ${JSON.stringify(menu)}`);
    // Up to the 600px column (phones and the 540×900 itch embed) the commands come first, above the party row.
    if (width <= 600) assert.ok(await evaluate('document.querySelector(".more-grid").getBoundingClientRect().top < document.querySelector(".menu-party").getBoundingClientRect().top'), `MENU commands first at ${width}px`);
    assert.deepEqual(errors, []);
    console.log(`PASS Town entry and navigation ${width}×${height}`);
  }, { width, height, mobile: width < 500 });
}

// Camp signs never cover each other or leave the map: on a narrow map (small phones) each drops to one line. Their text is never under
// 11px and a badge never under 10px (on a narrow map it is a 10px dot), also with the browser bars shown (360×640, 375×553, 393×659).
// Checked on a fresh save (padlocks) and an Act II save (every NEW flag and count badge shown), in English and Indonesian.
const signLayout = `(() => {
  const map = document.querySelector('.town-map').getBoundingClientRect();
  const signs = [...document.querySelectorAll('.town-sign')].map(sign => ({ id: sign.closest('.town-spot').dataset.spot, r: sign.getBoundingClientRect() }));
  const problems = [];
  signs.forEach((a, i) => {
    if (a.r.left < map.left - 1 || a.r.right > map.right + 1 || a.r.top < map.top - 1 || a.r.bottom > map.bottom + 1) problems.push(a.id + ' leaves the map');
    for (const b of signs.slice(i + 1)) {
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 2 && y > 2) problems.push(a.id + '/' + b.id + ' ' + Math.round(x) + 'x' + Math.round(y));
    }
  });
  const font = el => parseFloat(getComputedStyle(el).fontSize);
  const small = [...document.querySelectorAll('.town-sign b, .town-sign small')].filter(el => el.getClientRects().length && font(el) < 11).map(el => el.textContent + ' ' + font(el));
  const badges = [...document.querySelectorAll('.spot-flag')].filter(el => font(el) ? font(el) < 10 : el.getBoundingClientRect().width < 9.5).map(el => el.textContent + ' ' + font(el));
  return { map: Math.round(map.width), small, badges, gate: document.querySelector('[data-spot=gate] .town-sign b').textContent, fresh: document.querySelectorAll('.spot-new').length, locked: document.querySelectorAll('.town-spot.locked').length, problems };
})()`;
for (const lang of ['en', 'id']) for (const save of [null, ACT_TWO_SAVE]) for (const [width, height] of [[360, 640], [375, 553], [375, 667], [393, 659], [390, 844]]) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, errors }) => {
    await seedSave(send, save, lang);
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector(".town-game-shell")?.dataset.townRoute === "camp" && document.querySelector(".town-sign")');
    await new Promise(resolve => setTimeout(resolve, 300));
    const layout = await evaluate(signLayout), label = `${lang} ${save ? 'Act II' : 'fresh'} ${width}×${height}`;
    assert.ok(layout.gate.startsWith(lang === 'id' ? 'Gerbang' : 'Gate'), `${label}: the camp is in the seeded language (${layout.gate})`);
    assert.equal(save ? layout.fresh : layout.locked, 3, `${label}: ${save ? 'three NEW flags' : 'three locked modes'} are on the map`);
    assert.deepEqual(layout.problems, [], `${label}: camp signs stay apart and inside the ${layout.map}px map`);
    assert.deepEqual([layout.small, layout.badges], [[], []], `${label}: signs at 11px or more, badges at 10px or more (a dot on a narrow map)`);
    if (width === 360) await screenshot(`artifacts/camp-signs-${lang}-${save ? 'act2' : 'fresh'}-${width}x${height}.png`);
    assert.deepEqual(errors, []);
  }, { width, height, mobile: true });
}
console.log('PASS Camp signs stay apart on small phones (EN/ID, fresh and Act II)');

// The HUD on a route at phone widths: the framed Back, the route title and the tools never overlap, and the title reads in full (on
// ≤ 420px it switches to the text font, up to two lines, and the wallets stack) — 'Undercroft', 'Bursa Crystal', 'Ujian Lonceng'.
const hudLayout = `(() => {
  const r = s => document.querySelector(s).getBoundingClientRect(), back = r('#home'), title = r('#hud-title'), tools = r('.header-tools'), t = document.querySelector('#hud-title');
  return { text: t.textContent, cut: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1, overlap: back.right > title.left + 1 || title.right > tools.left + 1 || tools.right > innerWidth + 1, back: Math.round(back.height) };
})()`;
for (const lang of ['en', 'id']) for (const [width, height] of [[360, 640], [390, 844]]) {
  await withBrowser(async ({ send, wait, evaluate, click, screenshot, errors }) => {
    await seedSave(send, { ...ACT_TWO_SAVE, gold: 12345, cleared: [0, 1, 2, 3, 4] }, lang);
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector(".town-game-shell")?.dataset.townRoute === "camp"');
    for (const route of ['dungeon', 'quests', 'challenge-shop', 'endless', 'bestiary', 'raid']) {
      await click.nav(route);
      await wait(`document.querySelector(".town-game-shell")?.dataset.townRoute === ${JSON.stringify(route)}`);
      const hud = await evaluate(hudLayout);
      assert.ok(!hud.cut && !hud.overlap && hud.back >= 44, `${lang} ${width}×${height} ${route}: the HUD title reads in full beside the Back: ${JSON.stringify(hud)}`);
      if (width === 360 && route === 'challenge-shop') await screenshot(`artifacts/hud-title-${lang}-${width}x${height}.png`);
    }
    assert.deepEqual(errors, []);
  }, { width, height, mobile: true });
}
console.log('PASS The HUD names every route in full at 360 and 390 px (EN/ID)');
