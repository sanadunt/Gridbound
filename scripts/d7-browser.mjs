import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';
await withBrowser(async ({ wait, evaluate, click, errors, screenshot }) => {
  await evaluate("location.href='http://127.0.0.1:5187/'");
  await wait('Boolean(window.gridbound && (document.querySelector(".game-nav") || document.querySelector("#title-screen:not([hidden])")))', 15000);
  if (await evaluate('Boolean(document.querySelector("#title-screen:not([hidden])"))')) await click('#title-profiles');
  else {
    await click('.game-nav [data-facility="more"]');
    await wait('Boolean(document.querySelector(".more-scene"))');
    await click('.more-scene [data-open-action="profiles"]');
  }
  await wait('Boolean(document.querySelector("#commander-name"))', 15000);
  await evaluate(`document.querySelector('#commander-name').value='D7 QA'`);
  await click('#new-commander');
  await wait('document.querySelectorAll("dialog[open]").length===0');
  await wait('Boolean(document.querySelector("#story-journal"))');
  await click('#story-journal');
  await wait('Boolean(document.querySelector("dialog[open]"))');
  const locked = await evaluate(`({text:document.querySelector('dialog[open]')?.textContent||'', choices:document.querySelectorAll('[data-story-choice]').length})`);
  assert.match(locked.text, /Chapter 3/);
  assert.equal(locked.choices, 0);
  await screenshot('artifacts/d7-journal-locked.png');
  assert.equal(errors.length, 0);
  console.log(JSON.stringify({ locked }));
}, { width: 768, height: 900 });
