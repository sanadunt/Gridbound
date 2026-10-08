import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

for (const [width, height] of [[1440, 900], [390, 844], [360, 640]]) {
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
    assert.ok(camp.nav.every(button => button.width >= 44 && button.height >= 44), `Building targets remain at least 44×44: ${JSON.stringify(camp.nav)}`);
    const settings = await evaluate(`(() => {
      const rect = document.querySelector('#settings').getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    })()`);
    assert.ok(settings.width > 0 && settings.height > 0 && settings.left >= 0 && settings.right <= width,
      `Settings remains visible inside the ${width}×${height} header: ${JSON.stringify(settings)}`);
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
    assert.deepEqual(errors, []);
    console.log(`PASS Town entry and navigation ${width}×${height}`);
  }, { width, height, mobile: width < 500 });
}
