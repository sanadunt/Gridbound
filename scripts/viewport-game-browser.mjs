import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const viewports = [[360, 640], [360, 740], [390, 844], [430, 932], [721, 500], [768, 1024], [1280, 720], [1440, 900]];

for (const [width, height] of viewports) {
  await withBrowser(async ({ send, wait, evaluate, screenshot, click, errors }) => {
    await send('Page.navigate', { url });
    await wait('window.gridbound && document.querySelector("#town-screen:not([hidden])")');
    await evaluate('document.fonts.ready');
    await click.nav('campaign');
    await click('[data-zone="0"]');
    await click('[data-depart="adventure"]');
    await wait('window.gridbound.battle.status === "ready" && document.querySelector("#start")');

    const ready = await evaluate(`(() => {
      const rect = document.querySelector('#start').getBoundingClientRect();
      const arena = document.querySelector('#battle-screen .arena').getBoundingClientRect();
      return {
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        arena: { width: arena.width, height: arena.height },
        action: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
      };
    })()`);
    assert.ok(ready.document.width <= width + 1 && ready.document.height <= height + 1, `Ready screen must fit ${width}×${height}: ${JSON.stringify(ready)}`);
    if (width > 720) assert.ok(ready.arena.width >= 240, `Tablet combat arena remains playable at ${width}×${height}: ${JSON.stringify(ready.arena)}`);
    if (width >= 1280) {
      const minimum = width >= 1400 ? 420 : 320;
      assert.ok(ready.arena.width >= minimum, `Desktop combat arena fills its scene instead of shrinking to phone scale at ${width}×${height}: ${JSON.stringify(ready.arena)}`);
    }
    assert.ok(ready.action.width >= 43.9 && ready.action.height >= 43.9 && ready.action.left >= 0 && ready.action.right <= width
      && ready.action.top >= 0 && ready.action.bottom <= height, `Begin encounter remains visible: ${JSON.stringify(ready.action)}`);
    const battleTabs = await evaluate(`(() => [...document.querySelectorAll('#battle-screen .battle-view-tabs button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height };
    }))()`);
    assert.equal(battleTabs.length, 3, `Arena, Hero, and Log tabs are present at ${width}×${height}`);
    const unusableTabs = battleTabs.filter(tab => tab.width < 43.5 || tab.height < 43.5
      || tab.left < 0 || tab.right > width || tab.top < 0 || tab.bottom > height);
    assert.deepEqual(unusableTabs, [], `Battle view tabs remain 44px targets inside ${width}×${height}: ${JSON.stringify(unusableTabs)}`);
    await screenshot(`artifacts/ready-gridbound-${width}x${height}.png`);

    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    // Freeze simulation during HUD checks; resume before testing the details view.
    await evaluate('window.gridbound.battle.pause()');
    await wait('window.gridbound.battle.status === "paused"');
    await evaluate("document.querySelector('#battle-arena-panel').scrollTop = 0");
    const active = await evaluate(`(() => {
      const label = parent => parent.id ? \`#\${parent.id}\` : parent.className
        ? \`.\${String(parent.className).trim().split(/\\s+/).join('.')}\` : parent.tagName.toLowerCase();
      const measure = (name, element) => {
        const rect = element.getBoundingClientRect();
        const clippedBy = new Set();
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          const parentRect = parent.getBoundingClientRect();
          const clipLeft = parentRect.left + parent.clientLeft;
          const clipTop = parentRect.top + parent.clientTop;
          if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
            && (rect.left < clipLeft - 0.5 || rect.right > clipLeft + parent.clientWidth + 0.5)) clippedBy.add(label(parent));
          if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)
            && (rect.top < clipTop - 0.5 || rect.bottom > clipTop + parent.clientHeight + 0.5)) clippedBy.add(label(parent));
        }
        const style = getComputedStyle(element);
        return {
          name, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height,
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0,
          withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          clippedBy: [...clippedBy]
        };
      };
      const controlElements = [
        ['boss HUD', document.querySelector('#battle-screen .boss-hud')],
        ['boss name', document.querySelector('#battle-screen #boss-name')],
        ['boss health', document.querySelector('#battle-screen #boss-health')],
        ...[...document.querySelectorAll('#battle-screen .lane-targets button')].map((element, index) => [\`target lane \${index + 1}\`, element]),
        ...[...document.querySelectorAll('#battle-screen #party-health-tray .party-health-card')].map((element, index) => [\`party health \${index + 1}\`, element]),
        ...[...document.querySelectorAll('#battle-screen .action-bar > button')].map(element => [element.id, element])
      ];
      const bounds = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        intent: bounds('#intent'),
        actions: bounds('#battle-screen .action-bar'),
        controls: controlElements.map(([name, element]) => measure(name, element)),
        standing: document.querySelector('#standing').textContent.trim(),
        health: [...document.querySelectorAll('#battle-screen #party-health-tray .party-health-card')]
          .map(card => card.querySelector('.party-hp-value')?.textContent.trim()).filter(Boolean),
        bossHealthLines: (() => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector('#battle-screen #boss-health'));
          return range.getClientRects().length;
        })(),
        threat: document.querySelector('#intent').textContent.trim()
      };
    })()`);
    assert.ok(active.document.width <= width + 1 && active.document.height <= height + 1, `Active battle must fit ${width}×${height}: ${JSON.stringify(active)}`);
    for (const [name, rect] of [['intent', active.intent], ['action bar', active.actions]]) {
      assert.ok(rect.width >= 1 && rect.height >= 1 && rect.left >= 0 && rect.right <= width && rect.top >= 0 && rect.bottom <= height,
        `${name} remains visible at ${width}×${height}: ${JSON.stringify(rect)}`);
    }
    assert.deepEqual(active.controls.map(control => control.name), [
      'boss HUD', 'boss name', 'boss health', 'target lane 1', 'target lane 2', 'target lane 3',
      'party health 1', 'party health 2', 'party health 3', 'guard', 'potion', 'ultimate'
    ], `Every boss, lane, party, and action control is present at ${width}×${height}`);
    const clipped = active.controls.filter(control => !control.visible || !control.withinViewport || control.clippedBy.length);
    assert.deepEqual(clipped, [], `Every combat control remains visible without scrolling at ${width}×${height}: ${JSON.stringify(clipped)}`);
    assert.match(active.standing, /^\d+\/\d+ standing$/);
    assert.ok(active.health.length === 3 && active.health.every(value => /^\d+$/.test(value)),
      `Every party health value remains visible and numeric at ${width}×${height}: ${JSON.stringify(active.health)}`);
    assert.equal(active.bossHealthLines, 1, `Boss health remains on one readable line at ${width}×${height}`);
    assert.ok(active.threat.length > 0, 'Active battle retains a readable threat/counter cue');
    const lanePoint = await evaluate(`(() => {
      const lane = document.querySelector('#battle-screen [data-lane="0"]');

      const rect = lane.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x, y, hitsButton: hit === lane || lane.contains(hit),
        target: hit?.id || String(hit?.className || hit?.tagName),
        disabled: lane.disabled,
        pointerEvents: getComputedStyle(lane).pointerEvents
      };
    })()`);
    assert.ok(lanePoint.hitsButton, `Target lane receives pointer input at ${width}×${height}: ${JSON.stringify(lanePoint)}`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: lanePoint.x, y: lanePoint.y });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: lanePoint.x, y: lanePoint.y });
    await wait('window.gridbound.battle.targetLane === 0');
    const laneState = await evaluate(`({
      targetLane: window.gridbound.battle.targetLane,
      pressed: document.querySelector('#battle-screen [data-lane="0"]').getAttribute('aria-pressed'),
      status: window.gridbound.battle.status
    })`);
    assert.deepEqual({ targetLane: laneState.targetLane, pressed: laneState.pressed }, { targetLane: 0, pressed: 'true' },
      `Target lane interaction works at ${width}×${height}: ${JSON.stringify({ lanePoint, laneState })}`);
    await evaluate('window.gridbound.battle.pause()');
    await wait('window.gridbound.battle.status === "fighting"');
    const liveActions = await evaluate(`(() => {
      const bounds = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height };
      };
      return {
        actions: bounds('#battle-screen .action-bar'),
        buttons: [...document.querySelectorAll('#battle-screen .action-bar > button')].map(button => ({
          id: button.id, ...bounds('#battle-screen .action-bar > #' + button.id)
        }))
      };
    })()`);
    assert.ok(liveActions.actions.top >= 0 && liveActions.actions.bottom <= height
      && liveActions.buttons.every(button => button.top >= 0 && button.bottom <= height),
      `Combat actions remain visible while fighting at ${width}×${height}: ${JSON.stringify(liveActions)}`);
    await screenshot(`artifacts/combat-gridbound-${width}x${height}.png`);

    await click('[data-battle-view="hero"]');
    await wait('window.gridbound.battle.status === "paused"');
    assert.equal(await evaluate(`document.querySelector('#battle-detail-pause-note').hidden === false
      && document.querySelector('#battle-screen').dataset.battleView === 'hero'`), true, 'Hero details pause combat and expose Resume');
    await click('#battle-detail-resume');
    await wait('window.gridbound.battle.status === "fighting" && document.querySelector("#battle-screen").dataset.battleView === "arena"');
    assert.deepEqual(errors, []);
    console.log(`PASS ready, battle HUD, Hero pause/resume ${width}×${height}`);
  }, { width, height, mobile: width < 500 });
}
