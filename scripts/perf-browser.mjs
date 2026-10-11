// Performance budget report (raw CDP, not CI-gated yet): boot-to-interactive, long tasks, first-visit route renders and battle frame cost.
// Usage: node scripts/perf-browser.mjs [--strict]   (dev server on GRIDBOUND_URL, default port 5180; CHROME_PATH as for the other browser scripts)
// --strict exits non-zero when boot takes longer than 3 s or any long task exceeds 500 ms.
import { withBrowser, seedSave } from './browser-harness.mjs';
const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5180/';
const strict = process.argv.includes('--strict');
const BUDGET = { bootMs: 3000, longTaskMs: 500 };
// Installed before any page script: collects long tasks and notes when the dev hook, the canvas and the created scene exist.
const probe = `window.__perf={longTasks:[],interactive:0};
try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perf.longTasks.push({start:Math.round(e.startTime),ms:Math.round(e.duration)});}).observe({type:'longtask',buffered:true});}catch{}
const __poll=setInterval(()=>{const g=window.gridbound;if(g&&document.querySelector('#game-canvas canvas')&&g.scene?.sys?.settings?.status>=5&&g.scene.textures?.exists('ruins')){window.__perf.interactive=Math.round(performance.now());clearInterval(__poll);}},20);`;
const report = {};
await withBrowser(async ({ send, evaluate, wait, click }) => {
  await seedSave(send);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
  await send('Page.navigate', { url });
  await wait('window.__perf?.interactive>0', 60000);
  // Let the first frames settle so a long task that starts at the boundary is counted.
  await new Promise(resolve => setTimeout(resolve, 1000));
  const boot = await evaluate('structuredClone(window.__perf)');
  report.bootToInteractiveMs = boot.interactive;
  report.bootLongTasks = boot.longTasks.map(task => task.ms);
  // First visits: time from the click to the rendered route (next animation frame), measured in the page. Each visit starts once the previous
  // route's save has landed, so the number is the route's render cost rather than a wait for IndexedDB (navigation flushes pending saves first).
  const settled = async () => { await wait('document.querySelector("#storage-status")?.textContent.startsWith("Saved")', 15000).catch(() => {}); await new Promise(resolve => setTimeout(resolve, 400)); };
  const visit = async (selector, route) => (await settled(), evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing '+${JSON.stringify(selector)});const t0=performance.now();el.click();const end=t0+15000;while(document.querySelector('.town-game-shell')?.dataset.townRoute!==${JSON.stringify(route)}&&performance.now()<end)await new Promise(r=>setTimeout(r,0));await new Promise(r=>requestAnimationFrame(()=>r()));return Math.round(performance.now()-t0);})()`));
  report.routes = {};
  report.routes.campaign = await visit('.town-spot[data-facility="campaign"]', 'campaign');
  report.routes.raid = await visit('.expedition-mode-nav [data-facility="raid"]', 'raid');
  report.routes.dungeon = await visit('.expedition-mode-nav [data-facility="dungeon"]', 'dungeon');
  await click.nav('more');
  report.routes.party = await visit('.more-scene [data-facility="party"]', 'party');
  // Battle: the scene's update (simulation ticks, draw and HUD frame; Phaser calls it through sys.sceneUpdate) timed for 3 s of fighting, plus the rAF interval.
  await click.nav('campaign');
  const zone = await evaluate('document.querySelector("[data-zone]")?.dataset.zone');
  await click(`[data-zone="${zone}"]`);
  await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
  await click('[data-depart="adventure"]');
  await wait('document.querySelector("#battle-screen").hidden===false');
  await click('#start');
  await wait('window.gridbound.battle.status==="fighting"');
  report.battle = await evaluate(`(async()=>{const sys=window.gridbound.scene.sys,update=sys.sceneUpdate,updates=[],frames=[];sys.sceneUpdate=function(...args){const t0=performance.now();update.apply(this,args);updates.push(performance.now()-t0);};
    let last=performance.now();await new Promise(resolve=>{const end=last+3000;const step=now=>{frames.push(now-last);last=now;if(now<end)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});sys.sceneUpdate=update;
    const avg=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length*100)/100:0,p95=a=>{const s=[...a].sort((x,y)=>x-y);return Math.round((s[Math.floor(s.length*.95)]??0)*100)/100;};
    return {frames:frames.length,avgFrameMs:avg(frames),p95FrameMs:p95(frames),avgUpdateMs:avg(updates),p95UpdateMs:p95(updates)};})()`);
  const all = await evaluate('window.__perf.longTasks');
  report.longTasks = all.map(task => task.ms);
  report.maxLongTaskMs = Math.max(0, ...report.longTasks);
});
const failures = [];
if (report.bootToInteractiveMs > BUDGET.bootMs) failures.push(`boot ${report.bootToInteractiveMs} ms > ${BUDGET.bootMs} ms`);
if (report.maxLongTaskMs > BUDGET.longTaskMs) failures.push(`long task ${report.maxLongTaskMs} ms > ${BUDGET.longTaskMs} ms`);
report.budget = { ...BUDGET, failures };
console.log(JSON.stringify(report, null, 2));
if (strict && failures.length) process.exit(1);
