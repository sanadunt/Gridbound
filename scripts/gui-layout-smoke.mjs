import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const viewports = [[360, 640], [360, 740], [390, 844], [430, 932], [768, 1024], [1280, 720], [1440, 900]];

const layoutIssues = [];
for (const [width, height] of viewports) {
  await withBrowser(async ({ send, wait, click, evaluate, screenshot, errors }) => {
    await send('Page.navigate', { url });
    await wait('window.gridbound?.scene && document.querySelector("#town-screen:not([hidden])")');
    const rows = [];

    const measure = async (name, actionSelector = '') => {
      const result = await evaluate(`(() => {
        const selector = ${JSON.stringify(actionSelector)};
        const action = selector ? document.querySelector(selector) : null;
        const rect = action?.getBoundingClientRect();
        const scene = document.querySelector('.town-scene');
        const sceneRect = scene.getBoundingClientRect();
        const visible = element => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const closedDetails = element.closest('details:not([open])');
          return bounds.width > 0 && bounds.height > 0 && style.display !== 'none'
            && style.visibility === 'visible' && Number(style.opacity) > 0 && (!closedDetails || element.closest('summary'));
        };
        const targetSelector = [
          '#app > .site-header #sound', '#app > .site-header #settings',
          '#app > .site-header .mode-tabs button', '#app > .site-header #story-journal', '#app > .site-header #profiles',
          '#app > .site-header #menu-button', '.town-spot', '.expedition-mode-nav button', '.training-tabs button',
          '.back-link', '.party-advanced-link', '.map-stepper-btn', '.map-act-tab'
        ].join(',');
        const touchTargets = [...document.querySelectorAll(targetSelector)].filter(visible).map(element => {
          const bounds = element.getBoundingClientRect();
          return { name: element.getAttribute('aria-label') || element.id || element.textContent.trim().slice(0, 36), width: bounds.width, height: bounds.height };
        });
        const clipped = [...scene.querySelectorAll('h1,h2,h3,p,button,input,select,textarea,summary,[role="status"]')]
          .filter(visible).flatMap(element => {
            const bounds = element.getBoundingClientRect();
            const label = element.getAttribute('aria-label') || element.id || element.textContent.trim().slice(0, 36);
            const clippedBy = new Set();
            const canScroll = axis => {
              for (let parent = element.parentElement; parent && parent !== scene; parent = parent.parentElement) {
                const style = getComputedStyle(parent);
                const overflow = axis === 'x' ? style.overflowX : style.overflowY;
                const range = axis === 'x' ? parent.scrollWidth - parent.clientWidth : parent.scrollHeight - parent.clientHeight;
                if ((overflow === 'auto' || overflow === 'scroll') && range > 1) return true;
              }
              return false;
            };
            for (let parent = element.parentElement; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              const parentRect = parent.getBoundingClientRect();
              const left = parentRect.left + parent.clientLeft;
              const top = parentRect.top + parent.clientTop;
              if (['hidden', 'clip'].includes(style.overflowX)
                && (bounds.left < left - 0.5 || bounds.right > left + parent.clientWidth + 0.5) && !canScroll('x')) clippedBy.add(parent.className || parent.id || parent.tagName);
              if (['hidden', 'clip'].includes(style.overflowY)
                && (bounds.top < top - 0.5 || bounds.bottom > top + parent.clientHeight + 0.5) && !canScroll('y')) clippedBy.add(parent.className || parent.id || parent.tagName);
            }
            return clippedBy.size ? [{ name: label, clippedBy: [...clippedBy] }] : [];
          });
        const notice = document.querySelector('.town-notice:not([hidden])');
        const noticeRect = notice?.getBoundingClientRect();
        const noticeOverlaps = notice ? [...scene.querySelectorAll('h1,h2,h3,button,select,summary')]
          .filter(element => element !== notice && visible(element))
          .filter(element => {
            const bounds = element.getBoundingClientRect();
            return noticeRect.left < bounds.right && noticeRect.right > bounds.left
              && noticeRect.top < bounds.bottom && noticeRect.bottom > bounds.top;
          }).map(element => element.getAttribute('aria-label') || element.textContent.trim().slice(0, 36)) : [];
        const storageRect = document.querySelector('#storage-status').getBoundingClientRect();
        return {
          viewport: { width: innerWidth, height: innerHeight },
          document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
          scene: { left: sceneRect.left, right: sceneRect.right, top: sceneRect.top, bottom: sceneRect.bottom,
            width: scene.clientWidth, height: scene.clientHeight, scrollWidth: scene.scrollWidth, scrollHeight: scene.scrollHeight },
          navigation: (() => { const bounds = document.querySelector('#app > .site-header')?.getBoundingClientRect(); return bounds ? { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom } : null; })(),
          action: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
          touchTargets, clipped, noticeOverlaps,
          storage: { left: storageRect.left, right: storageRect.right, top: storageRect.top, bottom: storageRect.bottom, width: storageRect.width, height: storageRect.height }
        };
      })()`);
      assert.ok(result.document.width <= width + 1, `${name} horizontal document overflow at ${width}×${height}: ${JSON.stringify(result)}`);
      assert.ok(result.document.height <= height + 1, `${name} vertical document overflow at ${width}×${height}: ${JSON.stringify(result)}`);
      if (actionSelector) {
        const overlapsNavigation = result.action && result.navigation
          && result.action.left < result.navigation.right && result.action.right > result.navigation.left
          && result.action.top < result.navigation.bottom && result.action.bottom > result.navigation.top;
        const outsideScene = result.action && (result.action.left < result.scene.left || result.action.right > result.scene.right
          || result.action.top < result.scene.top || result.action.bottom > result.scene.bottom);
        assert.ok(result.action && result.action.width >= 44 && result.action.height >= 44
          && result.action.left >= 0 && result.action.right <= width
          && result.action.top >= 0 && result.action.bottom <= height && !overlapsNavigation && !outsideScene,
        `${name} primary action must remain a visible 44px target inside its scene at ${width}×${height}: ${JSON.stringify(result)}`);
      }
      const storageCoversAction = result.storage && result.action && result.storage.left < result.action.right
        && result.storage.right > result.action.left && result.storage.top < result.action.bottom && result.storage.bottom > result.action.top;
      const storageCoversNavigation = result.storage && result.navigation && result.storage.left < result.navigation.right
        && result.storage.right > result.navigation.left && result.storage.top < result.navigation.bottom && result.storage.bottom > result.navigation.top;
      assert.ok(!storageCoversAction && !storageCoversNavigation,
        `${name} status must not cover primary action or navigation at ${width}×${height}: ${JSON.stringify({ storage: result.storage, action: result.action, navigation: result.navigation })}`);
      if (result.storage?.width && result.storage?.height) {
        assert.ok(result.storage.left >= 0 && result.storage.right <= width && result.storage.top >= 0 && result.storage.bottom <= height,
          `${name} storage status must stay inside ${width}×${height}: ${JSON.stringify(result.storage)}`);
      }
      const shortTargets = result.touchTargets.filter(target => target.width < 43.5 || target.height < 43.5);
      const sceneOverflow = result.scene.scrollWidth > result.scene.width + 1 || result.scene.scrollHeight > result.scene.height + 1;
      if (shortTargets.length || result.clipped.length || result.noticeOverlaps.length || sceneOverflow) {
        layoutIssues.push({ name, viewport: result.viewport, shortTargets, clipped: result.clipped, noticeOverlaps: result.noticeOverlaps,
          ...(sceneOverflow ? { scene: result.scene } : {}) });
      }
      rows.push({ name, document: result.document, scene: result.scene, action: result.action, storage: result.storage });
      if (width === 360 || width === 1440) {
        const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        await screenshot(`artifacts/gui-${slug}-${width}x${height}.png`);
      }
    };

    await measure('camp', '.town-spot[data-facility="campaign"]');
    await click.nav('campaign');
    await measure('expedition-map', '[data-zone="0"]');
    await click('[data-zone="0"]');
    await measure('mission-dossier', '.mission-brief [data-depart="adventure"]');
    await click('.mission-map-return');
    await click('.expedition-mode-nav [data-facility="raid"]');
    await measure('raid-contract', '.secondary-deploy [data-depart="raid"]');
    await click('.expedition-mode-nav [data-facility="endless"]');
    await measure('roguelike-setup', '.secondary-deploy [data-depart="endless"]');

    await click.nav('party');
    await measure('party-formation', '.party-deploy-button');
    await click('[data-training-tab="skills"]');
    await measure('party-skills', '.party-deploy-button');
    await click('[data-training-tab="gear"]');
    await measure('party-gear', '.party-deploy-button');
    await click.nav('party-advanced');
    await measure('party-overview', '.party-deploy-button');
    await click('[data-training-tab="jobs"]');
    await measure('party-jobs', '.party-deploy-button');
    await click('[data-training-tab="talents"]');
    await measure('party-talents', '.party-deploy-button');

    await click.nav('party');
    await click('.formation-grid [data-formation="0"]');
    await wait('Boolean(document.querySelector(".town-notice:not([hidden])"))');
    await measure('party-notice');

    await click.nav('more');
    await measure('more-menu', '.more-card[data-facility="quests"]');
    await click('.more-card[data-facility="quests"]');
    await measure('quests');
    await click.nav('more');
    await click('.more-card[data-facility="bestiary"]');
    await measure('bestiary');
    await click.nav('more');
    await click('.more-card[data-facility="challenge-shop"]');
    await measure('challenge-shop');

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, height, rows }));
  }, { width, height, mobile: width < 500 });
}
await withBrowser(async ({ send, wait, evaluate, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound?.scene && document.querySelector("#town-screen:not([hidden])")');
  await evaluate('window.gridbound.hideTitle()');
  await wait('document.querySelector(".camp-scene")');
  const header = await evaluate(`(() => {
    const element = document.querySelector('#app > .site-header');
    const bounds = element.getBoundingClientRect();
    const visible = node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible';
    };
    return {
      bounds: { top: bounds.top, bottom: bounds.bottom, height: bounds.height },
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflow: getComputedStyle(element).overflow,
      controls: [...element.querySelectorAll('#sound,#settings,#menu-button,#wallet,#bank-wallet')]
        .filter(visible).map(node => {
          const rect = node.getBoundingClientRect();
          return { name: node.id || node.textContent.trim(), tag: node.tagName, left: rect.left, right: rect.right,
            top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        })
    };
  })()`);
  const clipped = header.controls.filter(control => control.left < 0 || control.right > 180
    || control.top < header.bounds.top || control.bottom > header.bounds.bottom);
  const undersized = header.controls.filter(control => control.tag === 'BUTTON' && (control.width < 44 || control.height < 44));
  assert.equal(header.overflow, 'visible', `Narrow header must allow its content to remain visible at 180×370: ${JSON.stringify(header)}`);
  assert.deepEqual(clipped, [], `Narrow header controls remain visible at 180×370: ${JSON.stringify(clipped)}`);
  assert.deepEqual(undersized, [], `Narrow header touch targets remain at least 44px at 180×370: ${JSON.stringify(undersized)}`);
  const camp = await evaluate(`(() => {
    const bounds = node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      scene: bounds(document.querySelector('.town-scene')),
      camp: bounds(document.querySelector('.camp-scene')),
      action: bounds(document.querySelector('.town-spot[data-facility="campaign"]')),
      navigation: bounds(document.querySelector('#app > .site-header')),
      storage: bounds(document.querySelector('#storage-status'))
    };
  })()`);
  const inside = (outer, inner) => inner.left >= outer.left && inner.right <= outer.right
    && inner.top >= outer.top && inner.bottom <= outer.bottom;
  const overlapsNavigation = camp.action.left < camp.navigation.right && camp.action.right > camp.navigation.left
    && camp.action.top < camp.navigation.bottom && camp.action.bottom > camp.navigation.top;
  const overlapsStorage = camp.action.left < camp.storage.right && camp.action.right > camp.storage.left
    && camp.action.top < camp.storage.bottom && camp.action.bottom > camp.storage.top;
  assert.ok(camp.action.width >= 44 && camp.action.height >= 44 && inside(camp.scene, camp.action)
    && inside(camp.camp, camp.action) && !overlapsNavigation && !overlapsStorage
    && camp.document.width <= 180 && camp.document.height <= 370,
  `Camp expedition action remains visible at 180×370: ${JSON.stringify(camp)}`);
  assert.deepEqual(errors, []);
  await screenshot('artifacts/gui-header-narrow-180x370.png');
  console.log(`PASS narrow header remains reachable at 180×370: ${JSON.stringify(header)}`);
}, { width: 180, height: 370, mobile: true });
assert.deepEqual(layoutIssues, [], `Visible Town controls and content must meet touch-target and clipping limits: ${JSON.stringify(layoutIssues)}`);
