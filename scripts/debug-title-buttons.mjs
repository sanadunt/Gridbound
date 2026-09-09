import { withBrowser } from './browser-harness.mjs';

await withBrowser(async ({ send, evaluate, click, wait }) => {
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await wait('window.gridbound');
  await evaluate('window.gridbound.showTitle()');
  
  // Click profiles
  await click('#title-profiles');
  const json1 = await evaluate(`JSON.stringify({
    modalOpen: document.querySelector('#modal').open,
    modalZ: window.getComputedStyle(document.querySelector('#modal')).zIndex,
    titleZ: window.getComputedStyle(document.querySelector('#title-screen')).zIndex,
    modalText: document.querySelector('#modal').textContent.slice(0, 50)
  })`);
  console.log('PROFILES CLICK RESULT:', json1);

  await evaluate('document.querySelector("#modal").close()');

  // Click journal
  await click('#title-journal');
  const json2 = await evaluate(`JSON.stringify({
    modalOpen: document.querySelector('#modal').open,
    modalText: document.querySelector('#modal').textContent.slice(0, 50)
  })`);
  console.log('JOURNAL CLICK RESULT:', json2);

  await evaluate('document.querySelector("#modal").close()');

  // Click settings
  await click('#title-settings');
  const json3 = await evaluate(`JSON.stringify({
    modalOpen: document.querySelector('#modal').open,
    modalText: document.querySelector('#modal').textContent.slice(0, 50)
  })`);
  console.log('SETTINGS CLICK RESULT:', json3);
});
