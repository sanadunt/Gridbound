import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
await withBrowser(async ({ send, evaluate, wait, click, screenshot, errors }) => {
  await send('Page.navigate', { url });
  await wait('window.gridbound?.scene?.textures?.exists("dragon-auric-0")', 25000);
  const textures = await evaluate(`Object.keys(window.gridbound.scene.textures.list).filter(k=>/^(wolf|goblin|spider|shaman|golem|wraith|treant|dragon|moth|basilisk|crab|revenant)(-ash|-frost|-auric)?-0$/.test(k)).map(k=>window.gridbound.scene.textures.get(k).getSourceImage().toDataURL())`);
  assert.equal(textures.length, 48);
  assert.equal(new Set(textures).size, 48, 'each monster variant is actually visually distinct');
  await click.nav('campaign');

  for (let chapter = 0; chapter < 16; chapter += 1) {
    if (!(await evaluate(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`))) {
      const page = Math.floor(chapter / 4);
      while (!(await evaluate(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`))) {
        await click('[data-campaign-page="1"]');
        await wait(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`);
      }
      assert.equal(await evaluate('document.querySelectorAll("[data-zone]").length'), 4);
    }

    if (chapter === 3 || chapter === 9) {
      await click.nav('party');
      await click.nav('party-advanced');
      await click('[data-training-tab="jobs"]');
      const job = chapter === 3 ? 'paladin' : 'aegis';
      await wait(`Boolean(document.querySelector('[data-promote="${job}"]'))`);
      await click(`[data-promote="${job}"]`);
      assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'), job);
      await click.nav('party');
      await click('[data-training-tab="skills"]');
      const skill = chapter === 3 ? 4 : 6;
      await click(`[data-equip-skill="${skill}"][data-skill-slot="0"]`);
      assert.ok(await evaluate(`window.gridbound.profile().loadouts[0].skills.includes(${skill})`));
      await screenshot(`artifacts/${chapter === 3 ? 'advanced' : 'third'}-class.png`);
      await click.nav('campaign');
    }

    if (!(await evaluate(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`))) {
      const page = Math.floor(chapter / 4);
      while (!(await evaluate(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`))) {
        await click('[data-campaign-page="1"]');
        await wait(`Boolean(document.querySelector('[data-zone="${chapter}"]'))`);
      }
      assert.equal(await evaluate('document.querySelectorAll("[data-zone]").length'), 4);
    }
    await click.nav('campaign');
    await click(`[data-zone="${chapter}"]`);
    await click('[data-depart="adventure"]');
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    const count = await evaluate('window.gridbound.battle.stageCount');
    for (let stage = 0; stage < count; stage += 1) {
      await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
      try {
        await wait('document.querySelector("#result-screen:not([hidden])")?.dataset.result === "true" && document.querySelector("#result-screen button:disabled")', 15000);
        await wait('document.querySelector("#result-screen:not([hidden])") && !document.querySelector("#result-screen").dataset.result && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")', 15000);
      } catch (error) {
        const state = await evaluate(`(() => {
          const scene = window.gridbound.scene;
          return {
            visibilityState: document.visibilityState,
            performanceNow: performance.now(),
            status: window.gridbound.battle.status,
            stage: window.gridbound.battle.stage,
            bossHp: window.gridbound.battle.bossHp,
            resultHidden: document.querySelector("#result-screen").hidden,
            resultGate: document.querySelector("#result-screen").dataset.result,
            sceneActive: scene?.sys?.isActive?.(),
            sceneStatus: scene?.sys?.settings?.status,
            documentHidden: document.hidden,
            pageHasFocus: document.hasFocus(),
            gameHasFocus: scene?.game?.hasFocus,
            gamePaused: scene?.game?.isPaused,
            loop: {
              started: scene?.game?.loop?.started,
              running: scene?.game?.loop?.running,
              inFocus: scene?.game?.loop?.inFocus,
              actualFps: scene?.game?.loop?.actualFps
            },
            loopFrame: scene?.game?.loop?.frame,
            deathAnimation: {
              started: scene?.enemyDeathStarted,
              complete: scene?.enemyDeathComplete,
              elapsed: scene?.enemyDeathElapsed,
              duration: scene?.enemyDeathDuration,
              waiters: scene?.enemyDeathWaiters?.length
            },
            buttons: [...document.querySelectorAll("#result-screen button")].map(button => ({ id: button.id, disabled: button.disabled })),
            modal: document.querySelector("#modal").textContent
          };
        })()`);
        console.error(`Campaign result input did not unlock at chapter ${chapter}, stage ${stage + 1}/${count}: ${JSON.stringify(state)}`);
        console.error('Campaign browser console errors:', JSON.stringify(errors));
        throw error;
      }
      if (stage < count - 1) {
        await click('#next-wave');
        await wait('window.gridbound.battle.status === "ready" && document.querySelector("#result-screen").hidden');
        await click('#start');
        await wait('window.gridbound.battle.status === "fighting"');
      }
    }
    await click('#result-town');
    await wait('document.querySelector("#town-screen:not([hidden])")');
    assert.equal((await evaluate('window.gridbound.profile().cleared')).length, chapter + 1);
    await click.nav('campaign');
  }

  await screenshot('artifacts/campaign-complete.png');
  assert.equal(await evaluate('window.gridbound.profile().roster.length'), 9);
  await click.nav('more');
  await click('.more-scene [data-open-action="journal"]');
  await wait('document.querySelectorAll("#modal[open] .journal-entry-card").length === 16');
  await click('#modal [data-close]');
  await send('Page.reload');
  await wait('window.gridbound?.profile().cleared.length === 16');
  assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'), 'aegis');
  assert.ok((await evaluate('window.gridbound.profile().loadouts[0].skills')).includes(6));

  await click.nav('campaign');
  await click.nav('endless');
  await click('[data-depart="endless"]');
  for (let floor = 1; floor <= 13; floor += 1) {
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
    try {
      await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")', 15000);
    } catch (error) {
      const state = await evaluate(`(() => {
        const scene = window.gridbound.scene;
        return {
          floor: window.gridbound.battle.floor,
          status: window.gridbound.battle.status,
          visibilityState: document.visibilityState,
          documentHidden: document.hidden,
          pageHasFocus: document.hasFocus(),
          gameHasFocus: scene?.game?.hasFocus,
          gamePaused: scene?.game?.isPaused,
          sceneActive: scene?.sys?.isActive?.(),
          loop: {
            frame: scene?.game?.loop?.frame,
            started: scene?.game?.loop?.started,
            running: scene?.game?.loop?.running,
            inFocus: scene?.game?.loop?.inFocus,
            actualFps: scene?.game?.loop?.actualFps
          },
          deathAnimation: {
            started: scene?.enemyDeathStarted,
            complete: scene?.enemyDeathComplete,
            elapsed: scene?.enemyDeathElapsed,
            duration: scene?.enemyDeathDuration,
            waiters: scene?.enemyDeathWaiters?.length
          },
          resultHidden: document.querySelector("#result-screen").hidden
        };
      })()`);
      console.error(`Roguelike result did not unlock at floor ${floor}: ${JSON.stringify(state)}`);
      console.error('Campaign browser console errors:', JSON.stringify(errors));
      throw error;
    }
    if (floor === 1) {
      const returnAction = await evaluate(`(() => {
        const button = document.querySelector('#result-town');
        const rect = button.getBoundingClientRect();
        return { height: rect.height, bottom: rect.bottom, viewport: innerHeight };
      })()`);
      assert.ok(returnAction.height >= 43.5 && returnAction.bottom <= returnAction.viewport,
        `Roguelike return action remains a visible 44px target: ${JSON.stringify(returnAction)}`);
    }
    if (floor <= 12) await click('[data-boon]');
    else await click('#next-floor');
  }
  assert.equal(await evaluate('window.gridbound.battle.floor'), 14);
  assert.equal(await evaluate('new Set(window.gridbound.battle.boons).size'), 12);
  await screenshot('artifacts/twelve-boon-build.png');
  assert.deepEqual(errors, []);
  console.log('PASS browser 16 chapters / 76 stage transitions, advanced+third promotion/equip/reload, ending journal, 48 unique textures, 12 boons + exhaustion continuation');
});
