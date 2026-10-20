// Phone performance budgets (phone contract §8, P1–P11) over raw CDP. Not in CI: timings depend on the machine (WebGL is software-rendered
// here), so --strict gates only the GPU-independent figures: bytes, first pixels/title, input delay, main-thread ms/s, long tasks, style
// recalcs, the loop's sleep state, route and Depart times, the engine config and the heap.
// Usage: node scripts/perf-browser.mjs [--strict]
//   GRIDBOUND_URL   dev server (default http://127.0.0.1:5180/): every part runs there unless PERF_DIST is set (load figures then only inform).
//   PERF_DIST=1     load/tap/compression parts on the production dist/ served by server.js (npm run build first); the parts that read the dev
//                   hook (window.gridbound) on a production build with the hook compiled in (built to artifacts/perf-hook/), also via server.js.
//   PERF_RUNS=3     runs per figure (medians reported)          PERF_DEVICES=pixel7,lowend      PERF_NETS=slow4g,fast4g
//   PERF_ONLY=load,tap,gl,battle,idle,routes,leak               PERF_BATTLE_SECONDS=60          CHROME_PATH as for the other browser scripts
//   PERF_MUSIC=on   the score plays (the default, as for a player); off seeds Config → Music off; both runs the idle part (P6) twice
// Report: artifacts/perf-phone.json (and stdout); filmstrips of the first load in artifacts/perf-phone/.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { withBrowser, seedSave } from './browser-harness.mjs';
import { LATE } from './phone-saves.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const RUNS = Number(process.env.PERF_RUNS || 3);
const DEVICES = (process.env.PERF_DEVICES || 'pixel7,lowend').split(',');
const NETS = (process.env.PERF_NETS || 'slow4g,fast4g').split(',');
const ONLY = process.env.PERF_ONLY ? new Set(process.env.PERF_ONLY.split(',')) : null;
const part = name => !ONLY || ONLY.has(name);
const BATTLE_SECONDS = Number(process.env.PERF_BATTLE_SECONDS || 60);
const IDLE_SECONDS = 10;
const DIST = process.env.PERF_DIST === '1';
const MUSIC = process.env.PERF_MUSIC || 'on';
const MUSIC_OFF = "localStorage.setItem('gridbound.ui.music', 'off')";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { const s = a.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2 * 100) / 100; };
const r2 = x => Math.round(x * 100) / 100;

const DEVICE = {
  pixel7: { width: 412, height: 915, dpr: 2.625, cpu: 4, ua: 'android' },
  lowend: { width: 360, height: 740, dpr: 3, cpu: 6, ua: 'android' },
};
// Lighthouse's mobile "Slow 4G" and a fast 4G link (bytes/s, ms).
const NETWORK = { slow4g: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }, fast4g: { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 } };
// The contract's budgets (P1–P11). Device targets (P2's title, P4, P5, P7) gate on Pixel 7, the low-end phone only informs; load figures
// gate only on a production build.
const GATED = 'pixel7';
const BUDGET = {
  P1: { firstPixelsMs: 1000 }, P2: { titleMs: 4000, cachedTitleMs: 1500 }, P3: { jsBeforeTitleKB: 300, totalKB: 750 },
  P4: { titleTapDelayMs: 100, titleToCampMs: 2500 }, P5: { mainThreadMsPerSec: 450, longTasksPerMin: 60, maxTaskMs: 200, inputDelayMedianMs: 50, layoutsPerSec: 15 },
  P6: { townRecalcsPerSec: 10, idleMsPerSec: 20 }, P7: { routeMs: 200, departMs: 350 }, P9: { programs: 11, fpsLimit: 61 }, P10: { heapMB: 15 },
};

/** A free TCP port on 127.0.0.1. */
const freePort = async () => { const s = createServer().listen(0, '127.0.0.1'); await once(s, 'listening'); const { port } = s.address(); s.close(); await once(s, 'close'); return port; };
/** server.js serving `<dir>/dist` (it serves the dist/ next to itself); resolves to its URL and a stop function. */
async function serveDist(dir) {
  const port = await freePort();
  const child = spawn(process.execPath, [resolve(dir, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, fail) => { let out = ''; child.stdout.on('data', d => { out += d; if (/listening on port/.test(out)) ok(); }); child.once('exit', code => fail(new Error(`server.js exited ${code}`))); });
  return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
}
/** A production build with the dev hook compiled in (window.gridbound), next to a copy of server.js, for the parts that read game state. */
async function hookBuild() {
  const dir = resolve(ROOT, 'artifacts/perf-hook');
  await mkdir(dir, { recursive: true });
  const { build } = await import('vite');
  await build({ root: ROOT, configFile: resolve(ROOT, 'vite.config.ts'), logLevel: 'warn', define: { 'import.meta.env.DEV': 'true' }, build: { outDir: resolve(dir, 'dist'), emptyOutDir: true } });
  await copyFile(resolve(ROOT, 'server.js'), resolve(dir, 'server.js'));
  await writeFile(resolve(dir, 'package.json'), '{"type":"module","private":true}');
  return dir;
}

// Installed before any page script: long tasks, paint entries, input delay of every pointerdown, WebGL program counts, AudioContexts, and
// marks for the painted title (its PRESS START or menu shown, backdrop loaded or not) and the town (the poll stops then: it reads layout).
const PROBE = `(()=>{const P=window.__pp={lt:[],paint:{},taps:[],gl:{compile:0,link:0,draw:0},ac:0,marks:{}};
try{new PerformanceObserver(l=>{for(const e of l.getEntries())P.lt.push({s:Math.round(e.startTime),d:Math.round(e.duration)})}).observe({type:'longtask',buffered:true})}catch{}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())P.paint[e.name]=Math.round(e.startTime)}).observe({type:'paint',buffered:true})}catch{}
addEventListener('pointerdown',e=>P.taps.push({at:Math.round(e.timeStamp),delay:Math.round(performance.now()-e.timeStamp)}),{capture:true});
for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){const p=C.prototype;for(const [k,f] of [['compileShader','compile'],['linkProgram','link'],['drawElements','draw'],['drawArrays','draw']]){const o=p[k];p[k]=function(...a){P.gl[f]++;return o.apply(this,a)}}}
const A=window.AudioContext;if(A)window.AudioContext=class extends A{constructor(...a){super(...a);P.ac++}};
const raf=requestAnimationFrame.bind(window);const poll=()=>{const t=document.getElementById('title-screen');
if(!P.marks.title&&t&&!t.hidden&&(t.querySelector('.title-press')?.offsetHeight||t.querySelector('#title-enter')?.offsetHeight))P.marks.title=Math.round(performance.now());
if(!P.marks.town&&document.querySelector('.town-spot'))P.marks.town=Math.round(performance.now());
if(!(P.marks.title&&P.marks.town)&&performance.now()<60000)raf(poll);};raf(poll);})();`;
const SPOOF = "Object.defineProperty(navigator,'webdriver',{get:()=>false})";

/** A phone session: metrics, touch, user agent, CPU throttling, the network, the probe; `spoof` hides automation (the real title flow). */
async function phone(device, run, { net, spoof = false, save = LATE, music = MUSIC !== 'off' } = {}) {
  const d = DEVICE[device];
  return withBrowser(async tools => {
    const { send, evaluate } = tools;
    await send('Network.enable', { maxTotalBufferSize: 50e6 });
    if (net) await send('Network.emulateNetworkConditions', { offline: false, ...NETWORK[net] });
    await send('Performance.enable', { timeDomain: 'timeTicks' });
    if (spoof) await send('Page.addScriptToEvaluateOnNewDocument', { source: SPOOF });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
    await seedSave(send, save, 'en');
    if (!music) await send('Page.addScriptToEvaluateOnNewDocument', { source: MUSIC_OFF });
    await send('Emulation.setCPUThrottlingRate', { rate: d.cpu });
    tools.on(m => { if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
    tools.metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    tools.inPage = selector => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing '+${JSON.stringify(selector)});e.click();return true})()`);
    tools.route = () => evaluate('document.querySelector(".town-game-shell")?.dataset.townRoute ?? ""');
    tools.dev = d;
    return run(tools);
  }, { phone: { width: d.width, height: d.height, dpr: d.dpr, ua: d.ua } });
}
/** Main-thread cost over a window: ms/s of tasks, style recalcs/s, layouts/s, long tasks. */
async function windowCost(t, seconds, during) {
  const m0 = await t.metrics(), lt0 = await t.evaluate('window.__pp.lt.length');
  if (during) await during(); else await sleep(seconds * 1000);
  const m1 = await t.metrics(), lts = (await t.evaluate(`window.__pp.lt.slice(${lt0})`)).map(x => x.d), sec = seconds;
  return { msPerSec: r2((m1.TaskDuration - m0.TaskDuration) * 1000 / sec), recalcsPerSec: r2((m1.RecalcStyleCount - m0.RecalcStyleCount) / sec), layoutsPerSec: r2((m1.LayoutCount - m0.LayoutCount) / sec), longTasks: lts };
}
const loopState = t => t.evaluate('(()=>{const l=window.gridbound?.scene?.game?.loop;return l?{running:l.running,fpsLimit:l.fpsLimit}:null})()');

const report = { strict, runs: RUNS, devices: DEVICES, nets: NETS, production: DIST, budget: BUDGET, failures: [], notes: [] };
const fail = (key, text) => report.failures.push(`${key}: ${text}`);
const devUrl = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const servers = [];
let loadUrl = devUrl, hookUrl = devUrl;
try {
  if (DIST) {
    if (!existsSync(resolve(ROOT, 'dist/index.html'))) throw new Error('PERF_DIST=1 needs a production build: npm run build');
    const prod = await serveDist(ROOT); servers.push(prod); loadUrl = prod.url;
    if (['gl', 'battle', 'idle', 'routes', 'leak'].some(part)) { const hooked = await serveDist(await hookBuild()); servers.push(hooked); hookUrl = hooked.url; }
  } else report.notes.push('dev server: load, bytes and compression figures only inform (PERF_DIST=1 measures the production build)');
  await mkdir(resolve(ROOT, 'artifacts/perf-phone'), { recursive: true });

  // P1–P3, P8: a new player on a cold cache (first pixels = the splash's first contentful paint, title painted, bytes), then a cached reload.
  if (part('load')) {
    report.load = {};
    for (const device of DEVICES) for (const net of NETS) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) await phone(device, async t => {
        const encodings = new Map();
        t.on(m => { if (m.method === 'Network.responseReceived') { const h = m.params.response.headers; encodings.set(m.params.response.url.split('/').pop().split('?')[0], (h['content-encoding'] || h['Content-Encoding'] || '').toLowerCase()); } });
        await t.send('Page.navigate', { url: loadUrl });
        // Filmstrip of the first run: what a player sees before the title (a splash, never a blank screen).
        if (run === 0) for (const at of [500, 1000, 2000, 3000]) { await t.wait(`performance.now()>=${at}`, 60000).catch(() => {}); const shot = await t.send('Page.captureScreenshot', { format: 'jpeg', quality: 50 }); await writeFile(resolve(ROOT, `artifacts/perf-phone/film-${device}-${net}-${at}.jpg`), Buffer.from(shot.data, 'base64')); }
        await t.wait('window.__pp?.marks.title>0', 120000);
        await sleep(1500);
        const first = await t.evaluate(`(()=>{const P=window.__pp,title=P.marks.title,res=performance.getEntriesByType('resource'),nav=performance.getEntriesByType('navigation')[0];
          const kb=b=>Math.round(b/1024*10)/10,size=e=>e.transferSize||e.encodedBodySize||0;
          return {firstPixels:P.paint['first-contentful-paint']??null,title,totalKB:kb(size(nav)+res.reduce((s,e)=>s+size(e),0)),jsBeforeTitleKB:kb(res.filter(e=>e.initiatorType==='script'||/\\.js(\\?|$)/.test(e.name)).filter(e=>e.startTime<title).reduce((s,e)=>s+size(e),0)),
            engineAfterTitle:res.filter(e=>/engine-/.test(e.name)).every(e=>e.startTime>title),engineLoaded:res.some(e=>/engine-/.test(e.name)),longTasksBeforeTitle:P.lt.filter(x=>x.s<title).map(x=>x.d)}})()`);
        const text = [...encodings].filter(([name]) => /\.(js|css|html)$/.test(name) || name === '');
        first.uncompressed = text.filter(([, enc]) => !/^(br|gzip)$/.test(enc)).map(([name]) => name || 'index.html');
        await t.send('Page.reload', {});
        await sleep(100);
        await t.wait('window.__pp?.marks.title>0', 120000);
        first.cachedTitle = await t.evaluate('window.__pp.marks.title');
        rows.push(first);
      }, { net, spoof: true, save: null });
      const m = k => median(rows.map(r => r[k]));
      const row = report.load[`${device}-${net}`] = { firstPixelsMs: m('firstPixels'), titleMs: m('title'), cachedTitleMs: m('cachedTitle'), jsBeforeTitleKB: m('jsBeforeTitleKB'), totalKB: m('totalKB'), engineAfterTitle: rows.every(r => r.engineAfterTitle), uncompressed: rows[0].uncompressed, longTasksBeforeTitle: rows.map(r => r.longTasksBeforeTitle) };
      if (DIST) {
        if (row.firstPixelsMs > BUDGET.P1.firstPixelsMs && net === 'slow4g') fail('P1', `${device}-${net} first pixels ${row.firstPixelsMs} ms`);
        if (device === 'pixel7' && net === 'slow4g' && row.titleMs > BUDGET.P2.titleMs) fail('P2', `${device}-${net} title ${row.titleMs} ms`);
        if (row.cachedTitleMs > BUDGET.P2.cachedTitleMs && device === 'pixel7') fail('P2', `${device}-${net} cached title ${row.cachedTitleMs} ms`);
        if (row.jsBeforeTitleKB > BUDGET.P3.jsBeforeTitleKB) fail('P3', `${device}-${net} ${row.jsBeforeTitleKB} KB of JS before the title`);
        if (row.totalKB > BUDGET.P3.totalKB) fail('P3', `${device}-${net} ${row.totalKB} KB in total`);
        if (!row.engineAfterTitle) fail('P3', `${device}-${net} the engine chunk loaded before the title`);
        if (row.uncompressed.length) fail('P8', `${device}-${net} served uncompressed: ${row.uncompressed.join(', ')}`);
      }
    }
  }

  // P4: a player tapping the title as soon as it shows (cached reload, taps every 250 ms): input delay; then the fastest title → camp.
  if (part('tap')) {
    report.tap = {};
    for (const device of DEVICES) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) await phone(device, async t => {
        await t.send('Page.navigate', { url: loadUrl });
        await t.wait('window.__pp?.marks.title>0', 60000); await sleep(3000);
        await t.send('Page.reload', {});
        let stop = false;
        const taps = (async () => { while (!stop) { t.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: 8, id: 1 }] }).then(() => t.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })).catch(() => {}); await sleep(250); } })();
        await sleep(4000); stop = true; await taps; await sleep(800);
        const p = await t.evaluate('({taps:window.__pp.taps,title:window.__pp.marks.title})');
        const after = p.taps.filter(x => x.at >= p.title).map(x => x.delay);
        // The fastest way in: PRESS START at once, Enter as soon as the menu shows, until the camp is painted.
        await t.send('Page.reload', {});
        await t.wait('window.__pp?.marks.title>0', 60000);
        const title = await t.evaluate('window.__pp.marks.title');
        await t.touch.tap({ x: t.dev.width / 2, y: t.dev.height * .62 });
        await t.wait('Boolean(document.querySelector("#title-enter")?.offsetHeight)', 20000);
        await sleep(150);
        await t.touch.tap('#title-enter');
        const camp = await t.evaluate(`new Promise(res=>{const chk=()=>{if(document.getElementById('title-screen').hidden&&document.querySelector('.town-spot'))requestAnimationFrame(()=>res(Math.round(performance.now())));else requestAnimationFrame(chk)};chk()})`);
        rows.push({ maxDelay: Math.max(0, ...after), medianDelay: median(after), titleToCamp: camp - title });
      }, { net: 'fast4g', spoof: true });
      const row = report.tap[device] = { titleTapDelayMaxMs: median(rows.map(r => r.maxDelay)), titleTapDelayMedianMs: median(rows.map(r => r.medianDelay)), titleToCampMs: median(rows.map(r => r.titleToCamp)) };
      const over = device === GATED ? fail : (key, text) => report.notes.push(`${key} (low-end, informational): ${text}`);
      if (row.titleTapDelayMaxMs > BUDGET.P4.titleTapDelayMs) over('P4', `${device} title tap waited ${row.titleTapDelayMaxMs} ms`);
      if (row.titleToCampMs > BUDGET.P4.titleToCampMs) over('P4', `${device} title → camp ${row.titleToCampMs} ms`);
    }
  }

  // P9: the engine's GL programs, frame cap and drawing-buffer flag (automation starts the engine at boot).
  if (part('gl')) await phone(DEVICES[0], async t => {
    await t.send('Page.navigate', { url: hookUrl });
    await t.wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 60000); await sleep(1500);
    const gl = report.gl = await t.evaluate(`(()=>{const g=window.gridbound.scene.game,ctx=g.renderer.gl;return {programs:window.__pp.gl.link,shaders:window.__pp.gl.compile,fpsLimit:g.loop.fpsLimit,preserveDrawingBuffer:ctx?.getContextAttributes?.().preserveDrawingBuffer??null,renderer:g.renderer.type===2?'webgl':'canvas'}})()`);
    if (gl.programs > BUDGET.P9.programs) fail('P9', `${gl.programs} GL programs linked`);
    if (gl.fpsLimit !== BUDGET.P9.fpsLimit) fail('P9', `fps limit ${gl.fpsLimit}`);
    if (gl.preserveDrawingBuffer) fail('P9', 'preserveDrawingBuffer is on');
  });

  // P5: CH 13 on the late save (8 heroes), a hero tap every 1.4 s for PERF_BATTLE_SECONDS.
  if (part('battle')) {
    report.battle = {};
    for (const device of DEVICES) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) await phone(device, async t => {
        await t.send('Page.navigate', { url: hookUrl });
        await t.wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 60000); await sleep(1500);
        await t.inPage('.town-spot[data-facility="campaign"]'); await t.wait('document.querySelector(".town-game-shell")?.dataset.townRoute==="campaign"', 15000); await sleep(500);
        await t.inPage('[data-zone="12"]'); await t.wait('Boolean(document.querySelector("[data-depart=adventure]"))', 15000); await sleep(500);
        await t.inPage('[data-depart="adventure"]'); await t.wait('document.querySelector("#battle-screen").hidden===false && Boolean(document.querySelector("#start")?.offsetHeight)', 30000); await sleep(1000);
        await t.touch.tap('#start'); await t.wait('window.gridbound.battle.status==="fighting"', 10000); await sleep(500);
        const taps0 = await t.evaluate('window.__pp.taps.length');
        const cost = await windowCost(t, BATTLE_SECONDS, async () => {
          const end = Date.now() + BATTLE_SECONDS * 1000;
          while (Date.now() < end) {
            await sleep(1400);
            // Keep the fight going: the budget is about a long, heavy fight, not about winning it.
            const target = await t.evaluate(`(()=>{const b=window.gridbound.battle;if(b.status!=='fighting')return null;if(b.bossHp<b.bossMax*.3)b.bossHp=b.bossMax*.8;const al=b.living();const h=al[Math.floor(Math.random()*al.length)];const e=h&&document.querySelector('[data-tap="'+h.id+'"]');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/3}})()`);
            if (target) await t.touch.tap(target);
          }
        });
        const delays = (await t.evaluate(`window.__pp.taps.slice(${taps0})`)).map(x => x.delay);
        rows.push({ ...cost, longTasksPerMin: r2(cost.longTasks.length * 60 / BATTLE_SECONDS), maxTask: Math.max(0, ...cost.longTasks), inputDelayMedian: median(delays) });
      }, {});
      const m = k => median(rows.map(r => r[k]));
      const row = report.battle[device] = { mainThreadMsPerSec: m('msPerSec'), longTasksPerMin: m('longTasksPerMin'), maxTaskMs: m('maxTask'), inputDelayMedianMs: m('inputDelayMedian'), layoutsPerSec: m('layoutsPerSec'), recalcsPerSec: m('recalcsPerSec') };
      const over = device === GATED ? fail : (key, text) => report.notes.push(`${key} (low-end, informational): ${text}`);
      for (const [k, limit] of Object.entries(BUDGET.P5)) if (row[k] > limit) over('P5', `${device} ${k} ${row[k]} > ${limit}`);
    }
  }

  // P6: idle windows in the real player flow (automation hidden): town screens, a ready window (awake: its grid can be dragged), a paused fight,
  // the Status view and a result card (asleep).
  if (part('idle')) for (const musicOn of MUSIC === 'both' ? [true, false] : [MUSIC !== 'off']) {
    const key = MUSIC === 'both' && !musicOn ? 'idleMusicOff' : 'idle';
    report[key] = {};
    for (const device of DEVICES) await phone(device, async t => {
      const out = report[key][device] = { music: musicOn };
      const measure = async (label, town = true) => {
        const busy0 = musicOn ? (await t.evaluate('window.gridbound.music().busyMs')) : 0;
        const cost = await windowCost(t, IDLE_SECONDS);
        // The score's own share of the window (its scheduler's main-thread time, ms/s).
        if (musicOn) cost.musicMsPerSec = r2(((await t.evaluate('window.gridbound.music().busyMs')) - busy0) / IDLE_SECONDS);
        const loop = await loopState(t);
        out[label] = { ...cost, loopRunning: loop?.running ?? null };
        if (town && cost.recalcsPerSec > BUDGET.P6.townRecalcsPerSec) fail('P6', `${device} ${label}: ${cost.recalcsPerSec} style recalcs/s`);
        if (cost.msPerSec > BUDGET.P6.idleMsPerSec && label !== 'readyWindow') fail('P6', `${device} ${label}: ${cost.msPerSec} ms/s`);
        if (!town && label !== 'readyWindow' && loop?.running) fail('P6', `${device} ${label}: the battle loop is running`);
      };
      await t.send('Page.navigate', { url: hookUrl });
      await t.wait('window.__pp?.marks.title>0 && window.gridbound', 60000); await sleep(3000);
      await measure('title');
      await t.touch.tap({ x: t.dev.width / 2, y: t.dev.height * .62 });
      await t.wait('Boolean(document.querySelector("#title-enter")?.offsetHeight)', 20000); await sleep(600);
      await t.touch.tap('#title-enter');
      await t.wait('document.getElementById("title-screen").hidden && Boolean(document.querySelector(".town-spot"))', 20000);
      await t.wait('window.gridbound.scene?.game?.loop?.started', 20000).catch(() => {}); await sleep(3000);
      // A camp scene or the unlock card may greet the player: close what is open.
      for (let i = 0; i < 20 && await t.evaluate('Boolean(document.querySelector(".dialogue-scene, dialog[open]"))'); i++) { await t.evaluate('document.querySelector(".dialogue-skip")?.click(); document.querySelector("dialog[open] [data-close], dialog[open] [data-autofocus]")?.click()'); await sleep(600); }
      await sleep(1500);
      out.engineStartedAfterTitle = await t.evaluate('Boolean(window.gridbound.scene)');
      // P6 is measured with the score playing (as a player hears it) unless Music is off.
      out.campMusic = await t.evaluate('window.gridbound.music()');
      if (musicOn && !out.campMusic.scheduling) fail('P6', `${device}: the music is not playing in the camp`);
      await measure('camp');
      await t.click.nav('campaign'); await sleep(2500); await measure('map');
      await t.click.nav('more'); await sleep(2500); await measure('menu');
      await t.click.nav('party'); await sleep(2500); await measure('party');
      await t.click.nav('campaign'); await sleep(800);
      await t.click('[data-zone="12"]'); await t.wait('Boolean(document.querySelector("[data-depart=adventure]"))'); await sleep(800);
      await t.click('[data-depart="adventure"]');
      await t.wait('document.querySelector("#battle-screen").hidden===false && Boolean(document.querySelector("#start")?.offsetHeight)', 30000); await sleep(2500);
      await measure('readyWindow', false);
      await t.touch.tap('#start'); await t.wait('window.gridbound.battle.status==="fighting"'); await sleep(2000);
      await t.touch.tap('#pause'); await t.wait('window.gridbound.battle.status==="paused"'); await sleep(1500);
      await measure('paused', false);
      await t.evaluate('document.querySelector("dialog[open] [data-close]")?.click()'); await t.wait('window.gridbound.battle.status==="fighting"'); await sleep(800);
      await t.evaluate('document.querySelector(\'.battle-view-tabs [data-battle-view="hero"]\')?.click()'); await sleep(1500);
      await measure('status', false);
      await t.evaluate('document.querySelector(\'.battle-view-tabs [data-battle-view="arena"]\')?.click()'); await sleep(800);
      out.resumedLoopRunning = (await loopState(t))?.running ?? null;
      if (out.resumedLoopRunning === false) fail('P6', `${device}: the loop did not wake on the arena view`);
      await t.evaluate('(()=>{const b=window.gridbound.battle;if(b.status==="fighting")b.bossHp=1;})()');
      await t.wait('!document.getElementById("result-screen").hidden', 20000); await sleep(2500);
      await measure('resultCard', false);
      out.resultCard.state = await t.evaluate('({status:window.gridbound.battle.status,result:document.getElementById("result-screen").dataset.result??null,inTown:window.gridbound.inTown})');
      out.audioContexts = await t.evaluate('window.__pp.ac');
      // P11: one shared context at most (Sound effects and Music share it).
      if (out.audioContexts > 1) fail('P11', `${device}: ${out.audioContexts} AudioContexts`);
      // The perf saves have Sound effects off: with Music off too there is no context at all.
      if (!musicOn && out.audioContexts > 0) fail('P11', `${device}: an AudioContext with Sound effects and Music off`);
    }, { spoof: true, music: musicOn });
  }

  // P7: tap → next painted frame for each town route (first and repeat visits), and Depart → the ready window.
  if (part('routes')) {
    report.routes = {};
    const VISIT = (sel, route) => `(async()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)throw Error('missing '+${JSON.stringify(sel)});const t0=performance.now();el.click();const end=t0+20000;
      while(document.querySelector('.town-game-shell')?.dataset.townRoute!==${JSON.stringify(route)}&&performance.now()<end)await new Promise(r=>setTimeout(r,0));
      await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));return Math.round(performance.now()-t0);})()`;
    for (const device of DEVICES) {
      const rows = [];
      for (let run = 0; run < RUNS; run++) await phone(device, async t => {
        await t.send('Page.navigate', { url: hookUrl });
        await t.wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 60000); await sleep(3000);
        const res = {}, go = async (name, sel, route) => { await sleep(1200); res[name] = await t.evaluate(VISIT(sel, route)); };
        for (const pass of ['first', 'again']) {
          await go(`${pass}:map`, '.town-spot[data-facility="campaign"]', 'campaign');
          await go(`${pass}:undercroft`, '.expedition-mode-nav [data-facility="dungeon"]', 'dungeon');
          await go(`${pass}:raid`, '.expedition-mode-nav [data-facility="raid"]', 'raid');
          await go(`${pass}:menu`, '#menu-button', 'more');
          await go(`${pass}:party`, '.more-scene [data-facility="party"]', 'party');
          await go(`${pass}:menu2`, '#home', 'more');
          await go(`${pass}:quests`, '.more-scene [data-facility="quests"]', 'quests');
          await go(`${pass}:menu3`, '#home', 'more');
          await go(`${pass}:bestiary`, '.more-scene [data-facility="bestiary"]', 'bestiary');
          await go(`${pass}:menu4`, '#home', 'more');
          await go(`${pass}:camp`, '#home', 'camp');
        }
        await go('dossier', '.town-spot[data-facility="campaign"]', 'campaign');
        await t.inPage('[data-zone="12"]'); await t.wait('Boolean(document.querySelector("[data-depart=adventure]"))'); await sleep(2500);
        res.depart = await t.evaluate(`(async()=>{const t0=performance.now();document.querySelector('[data-depart="adventure"]').click();while(!(document.querySelector('#battle-screen').hidden===false&&document.querySelector('#start')?.offsetHeight))await new Promise(r=>setTimeout(r,0));await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));return Math.round(performance.now()-t0);})()`);
        rows.push(res);
      }, {});
      const keys = Object.keys(rows[0]).filter(k => !/menu\d|dossier/.test(k));
      const row = report.routes[device] = Object.fromEntries(keys.map(k => [k, median(rows.map(r => r[k]))]));
      const over = device === GATED ? fail : (key, text) => report.notes.push(`${key} (low-end, informational): ${text}`);
      for (const [k, ms] of Object.entries(row)) if (k === 'depart' ? ms > BUDGET.P7.departMs : ms > BUDGET.P7.routeMs) over('P7', `${device} ${k} ${ms} ms`);
    }
  }

  // P10: ten won battles in a row (1× CPU): the heap and the DOM stay flat.
  if (part('leak')) await phone(DEVICES[0], async t => {
    await t.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await t.send('Page.navigate', { url: hookUrl });
    await t.wait('window.gridbound?.scene?.textures?.exists("dragon-0")', 60000); await sleep(1500);
    const gc = async () => { await t.send('HeapProfiler.enable'); await t.send('HeapProfiler.collectGarbage'); await sleep(300); await t.send('HeapProfiler.collectGarbage'); return t.metrics(); };
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await t.evaluate('window.gridbound.boot("adventure", 1)'); await sleep(300);
      await t.evaluate('document.querySelector("#start")?.click()'); await t.wait('window.gridbound.battle.status==="fighting"', 10000);
      await t.evaluate('window.gridbound.battle.bossHp=1'); await t.wait('!document.getElementById("result-screen").hidden', 20000); await sleep(600);
      await t.evaluate('document.querySelector("#result-town, [data-nav-exit=return]")?.click()'); await t.wait('window.gridbound.inTown', 15000).catch(() => {}); await sleep(400);
      const m = await gc(); samples.push({ heapMB: r2(m.JSHeapUsedSize / 1048576), nodes: m.Nodes, listeners: m.JSEventListeners });
    }
    const last = samples.at(-1), first = samples[0];
    report.leak = { samples, heapMB: last.heapMB, nodesGrowth: last.nodes - first.nodes, listenersGrowth: last.listeners - first.listeners };
    if (last.heapMB > BUDGET.P10.heapMB) fail('P10', `heap ${last.heapMB} MB after 10 battles`);
    if (last.listeners - first.listeners > 50) fail('P10', `${last.listeners - first.listeners} event listeners more after 10 battles`);
  });
} finally {
  servers.forEach(s => s.stop());
}
await writeFile(resolve(ROOT, 'artifacts/perf-phone.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) console.log(`${strict ? 'FAIL' : 'over budget (informational)'}: ${report.failures.join('; ')}`);
if (strict && report.failures.length) process.exit(1);
