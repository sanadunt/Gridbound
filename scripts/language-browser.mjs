import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';

await withBrowser(async ({ send, wait, evaluate, click, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (!sessionStorage.getItem('lang-test')) { sessionStorage.setItem('lang-test', '1'); localStorage.setItem('gridbound.lang', 'en'); }` });
  await send('Page.navigate', { url });
  await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
  const read = () => evaluate(`({ lang: document.documentElement.lang, spot: document.querySelector('.town-spot[data-facility="campaign"]').getAttribute('aria-label'),
    enemy: (window.gridbound.boot('adventure', 1), document.querySelector('#boss-title').textContent) })`);
  const english = await read();
  assert.deepEqual(english, { lang: 'en', spot: 'Gate · Story · the next chapter waits', enemy: 'CINDER WOLF' }); // the building, its destination's one name and its badge
  await send('Page.reload');
  await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');

  for (const [code, expected] of [['id', { lang: 'id', spot: 'Gerbang · Cerita · chapter berikutnya menunggu', enemy: 'SERIGALA BARA' }], ['en', english]]) {
    await click('#settings');
    await wait(`Boolean(document.querySelector('#modal [data-lang="${code}"]'))`);
    await evaluate('window.__beforeSwitch = true');
    await click(`#modal [data-lang="${code}"]`);
    await wait('!window.__beforeSwitch && Boolean(window.gridbound && document.querySelector(".camp-scene"))', 15000);
    assert.equal(await evaluate('localStorage.getItem("gridbound.lang")'), code);
    assert.deepEqual(await read(), expected, `UI and content switch to ${code}`);
    await send('Page.reload');
    await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
  }
  assert.deepEqual(errors, []);
  console.log('PASS language switch EN → ID → EN (UI strings, town buildings, enemy content)');
}, { width: 390, height: 844, mobile: true });

// PRESS START on a phone: the tap that leaves the press phase must not also press the menu item or language button that appears
// under the finger (the touch's compatibility click). The real title screen plays (navigator.webdriver reads false).
await withBrowser(async ({ send, wait, evaluate, errors }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); if (!sessionStorage.getItem('press-test')) { sessionStorage.setItem('press-test', '1'); localStorage.clear(); localStorage.setItem('gridbound.lang', 'en'); }` });
  const tap = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await new Promise(r => setTimeout(r, 60)); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await new Promise(r => setTimeout(r, 700)); };
  // Where a control will appear once the menu shows (measured with the press phase lifted for a moment).
  const spot = selector => evaluate(`(() => { const t = document.querySelector('#title-screen'); t.classList.remove('press-phase'); const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); t.classList.add('press-phase'); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  for (const selector of ['.title-lang [data-lang="id"]', '#title-journal']) {
    await send('Page.navigate', { url });
    await wait('Boolean(window.gridbound) && document.querySelector("#title-screen.press-phase") && !document.querySelector("#title-screen").hidden', 20000);
    await evaluate('window.__samePage = true');
    const { x, y } = await spot(selector);
    await tap(x, y);
    assert.deepEqual(await evaluate(`({ same: window.__samePage === true, lang: localStorage.getItem('gridbound.lang'), press: document.querySelector('#title-screen').classList.contains('press-phase'), modal: document.querySelector('#modal').open })`),
      { same: true, lang: 'en', press: false, modal: false }, `the PRESS START tap does not also press ${selector}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS PRESS START tap on a phone opens only the title menu');
}, { width: 390, height: 844, mobile: true });

// WP12 leak sweep: a finished campaign walked in both languages. The visible text of each screen must not carry the
// other language's function words once proper names (which stay English by policy) are taken out.
const WORDS = { en: '\\b(yang|dan|untuk|dengan|tidak|setiap|pada|kita|ini)\\b', id: '\\b(the|and|with|your|every)\\b' };
const seedFinished = lang => `(async()=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('gridbound.commanders.r1');q.onsuccess=q.onerror=q.onblocked=()=>r();});localStorage.clear();localStorage.setItem('gridbound.lang','${lang}');const {createProfile,completeZone}=await import('/src/game/profile.ts');const p=createProfile();p.motion=false;p.sound=false;for(let i=0;i<16;i++)completeZone(p,i);p.journey={...p.journey,depth:3,pendingRecruitScenes:undefined,pendingChapterScenes:undefined};p.narrative={archive:'private',cooperative:'clinic',school:'memorial'};p.gold=p.economy.gold=4321;p.economy.commanderCrystal=12345;localStorage.setItem('gridbound.v3',JSON.stringify(p));})()`;
/** Every proper name the content uses (live objects, so the active language), plus the act names; sorted longest first. */
const NAMES = `(async()=>{const mods=await Promise.all(['/src/game/world.ts','/src/game/content.ts','/src/game/jobs.ts','/src/game/talents.ts','/src/game/characters.ts','/src/game/d8-content.ts','/src/economy/challenge.ts'].map(m=>import(m)));const {EN}=await import('/src/i18n/en.ts');const names=new Set([0,1,2,3].map(i=>EN['act.'+i+'.name']));const walk=(n,d)=>{if(d>6||!n||typeof n!=='object')return;for(const [k,v] of Object.entries(n)){if((k==='name'||k==='enemyName')&&typeof v==='string')names.add(v);else walk(v,d+1);}};for(const m of mods)walk(m,0);window.__names=[...names].filter(n=>n.length>2).sort((a,b)=>b.length-a.length);})()`;
const leaks = lang => `(()=>{let text=document.body.innerText;for(const name of window.__names)text=text.split(name).join(' ').split(name.toUpperCase()).join(' ');const re=new RegExp(${JSON.stringify(WORDS[lang])},'gi');return [...text.matchAll(new RegExp('.{0,30}'+re.source+'.{0,30}','gi'))].map(m=>m[0].replace(/\\s+/g,' '));})()`;

for (const lang of ['en', 'id']) {
  await withBrowser(async ({ send, wait, evaluate, click, screenshot, errors }) => {
    await send('Page.navigate', { url });
    await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
    await evaluate(seedFinished(lang));
    await send('Page.reload');
    await wait('Boolean(window.gridbound && document.querySelector(".camp-scene"))');
    assert.equal(await evaluate('document.documentElement.lang'), lang);
    await evaluate(NAMES);
    // The sweep bites: a line in the other language is reported.
    await evaluate(`document.body.insertAdjacentHTML('beforeend', '<p id="qa-leak">${lang === 'en' ? 'Hero belum siap dan menunggu' : 'Leave the room with your party'}</p>')`);
    assert.equal((await evaluate(leaks(lang))).length, 1, 'a planted leak is caught');
    await evaluate('document.querySelector("#qa-leak").remove()');
    const screens = [];
    const check = async (screen, shot) => { const found = await evaluate(leaks(lang)); screens.push(screen); assert.deepEqual(found, [], `${lang.toUpperCase()} ${screen} shows the other language: ${found.join(' | ')}`); if (shot) await screenshot(`artifacts/lang-${lang}-${screen}.png`); };
    // Numbers follow the chosen language: the wallet groups thousands with ',' in EN and '.' in ID.
    assert.match(await evaluate('document.querySelector("#wallet").textContent'), lang === 'en' ? /4,321/ : /4\.321/);
    assert.match(await evaluate('document.querySelector("#bank-wallet").textContent'), lang === 'en' ? /12,345/ : /12\.345/);
    await check('camp', true);
    await click.nav('campaign');
    await click('[data-zone="15"]');
    await wait('Boolean(document.querySelector(".world-map-dossier"))');
    await check('map', true);
    for (const facility of ['party', 'party-advanced']) {
      await click.nav(facility);
      for (const tab of await evaluate('[...document.querySelectorAll("[data-training-tab]")].map(b => b.dataset.trainingTab)')) {
        await click(`[data-training-tab="${tab}"]`);
        await wait(`document.querySelector("[data-training-panel]")?.dataset.trainingPanel === ${JSON.stringify(tab)}`);
        await check(`party-${tab}`, tab === 'formation' || tab === 'overview');
      }
    }
    await click.nav('quests'); await check('quests');
    await click.nav('bestiary'); await check('bestiary');
    await click.nav('dungeon'); await wait('Boolean(document.querySelector(".dungeon-scene"))'); await check('undercroft');
    // The depth dossier (a tap on a depth; nothing starts until Descend).
    await click('[data-dungeon-pick="4"]'); await wait('Boolean(document.querySelector("#modal[open] [data-depth-dossier]"))'); await check('undercroft-dossier', true);
    await evaluate('document.querySelector("dialog[open]").close()');
    await click.nav('more');
    await click('.more-scene [data-open-action="journal"]');
    await wait('Boolean(document.querySelector("#modal .journal-epilogue"))');
    await check('journal');
    await evaluate('document.querySelector("dialog[open]").close()');
    await click.nav('campaign');
    await click('[data-zone="15"]');
    await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
    await click('[data-depart="adventure"]');
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    await evaluate('window.gridbound.step(4)');
    await wait('window.gridbound.battle.threats.length > 0', 15000);
    await check('battle', true);
    await evaluate('window.gridbound.battle.bossHp = 0; window.gridbound.step(.05)');
    await wait('document.querySelector("#result-screen:not([hidden])") && document.querySelector("#result-screen button") && !document.querySelector("#result-screen button:disabled")');
    await check('result');
    assert.deepEqual(errors, []);
    console.log(`PASS ${lang.toUpperCase()} leak sweep: ${screens.join(', ')}`);
  }, { width: 390, height: 844, mobile: true });
}
