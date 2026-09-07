import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { withBrowser } from './browser-harness.mjs';

const url='http://127.0.0.1:5183/';
const report={checks:[],consoleErrors:[],serverStopped:false};
let server;
try {
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5183','--strictPort'],{stdio:['ignore','pipe','pipe']});
  let output='';let launchError;
  server.on('error',error=>{launchError=error;});
  server.stdout.on('data',data=>{output+=data;});server.stderr.on('data',data=>{output+=data;});
  const deadline=Date.now()+15000;
  while(!output.includes('http://127.0.0.1:5183/')) {
    if(launchError)throw launchError;
    if(server.exitCode!==null)throw Error(`Vite exited: ${output}`);
    if(Date.now()>deadline)throw Error(`Vite readiness timeout: ${output}`);
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal((await fetch(url)).status,200);
  await withBrowser(async ({send,evaluate,wait,click,screenshot,errors})=>{
    await send('Page.navigate',{url});
    await wait('window.gridbound?.scene?.textures?.exists("dragon-auric-0")');

    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'),[0,4,3]);
    await click('[data-depart="adventure"]');
    assert.deepEqual(await evaluate('window.gridbound.battle.heroes.map(h=>h.id)'),[0,4,3]);
    await click('#start');
    await evaluate('window.gridbound.step(2)');
    assert.ok(await evaluate('window.gridbound.battle.heroes.some(h=>h.acts>0)'));
    report.checks.push({name:'fresh3 real combat',ids:[0,4,3]});
    // Seed only this disposable origin, through the actual profile/recruitment functions.
    await evaluate(`(async()=>{const {createProfile,completeZone}=await import('/src/game/profile.ts');const p=createProfile();for(let i=0;i<4;i++)completeZone(p,i);p.storyActive=[0,4,3,2,7,1];for(const id of p.storyActive)p.loadouts[id].xp=1000;localStorage.setItem('gridbound.v3',JSON.stringify(p));})()`);
    await send('Page.reload');await wait('window.gridbound?.profile().roster.length===9');
    const originalLoads=await evaluate('window.gridbound.profile().loadouts');
    await click('[data-facility="party"]');
    assert.equal(await evaluate('document.querySelectorAll("[data-story-toggle]").length'),9);
    assert.equal(await evaluate('document.querySelectorAll("[data-story-toggle]")[8].disabled'),true);
    await click('[data-story-toggle="0"]');await click('[data-story-toggle="8"]');
    const selected=[4,3,2,7,1,8];
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'),selected);
    assert.deepEqual(await evaluate('window.gridbound.profile().loadouts'),originalLoads);
    await screenshot('artifacts/d3-town.png');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.ok(await evaluate('[...document.querySelectorAll("[data-story-toggle]")].every(el=>el.getBoundingClientRect().height>=44)'));
    await screenshot('artifacts/d3-town-mobile.png');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.reload');await wait('window.gridbound?.profile().storyActive.includes(8)');
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'),selected);
    report.checks.push({name:'progressed9 select6, capped controls, swap, reload, retained9 loadouts, mobile390',ids:selected});
    await click('[data-zone="0"]');await click('[data-depart="adventure"]');
    assert.deepEqual(await evaluate('window.gridbound.battle.heroes.map(h=>h.id)'),selected);
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".unit-card")].map(el=>Number(el.dataset.hero))'),selected);
    const before=await evaluate('window.gridbound.profile()');
    const count=await evaluate('window.gridbound.battle.stageCount');
    for(let stage=0;stage<count;stage++) {
      await click('#start');
      // Deterministic terminal fixture, not a balance or natural-victory claim.
      await evaluate('window.gridbound.battle.bossHp=0;window.gridbound.step(.05)');
      await wait('document.querySelector("#modal").open && !document.querySelector("#modal button:disabled")');
      if(stage<count-1)await click('#next-wave');
    }
    assert.equal(await evaluate('document.querySelectorAll("[data-xp-kind=active]").length'),6);
    assert.equal(await evaluate('document.querySelectorAll("[data-xp-kind=bench]").length'),3);
    const after=await evaluate('window.gridbound.profile()');
    const deltas=after.roster.map(id=>({id,kind:selected.includes(id)?'active':'bench',xp:after.loadouts[id].xp-before.loadouts[id].xp}));
    assert.ok(deltas.every(row=>row.xp>0));
    assert.ok(deltas.filter(row=>row.kind==='active').every(row=>row.xp===435));
    assert.deepEqual(deltas.filter(row=>row.kind==='bench').map(row=>row.xp),[217,434,434]);
    const duplicate=await evaluate(`(async()=>{const {settleProgress}=await import('/src/game/profile.ts');return settleProgress(window.gridbound.profile(),window.gridbound.battle);})()`);
    assert.equal(duplicate,null);
    await screenshot('artifacts/d3-results.png');
    report.checks.push({name:'replay chapter1 six active IDs, four wave transitions, active/bench result distinction, settlement once',deltas});
    await click('#retry');assert.deepEqual(await evaluate('window.gridbound.battle.heroes.map(h=>h.id)'),selected);
    await click('#battle-home');
    await send('Page.reload');await wait('window.gridbound?.inTown');
    assert.deepEqual(await evaluate('window.gridbound.profile().loadouts'),after.loadouts);
    assert.deepEqual(await evaluate('window.gridbound.profile().storyActive'),selected);
    for(const mode of ['raid','endless']) {
      await click(`[data-view="${mode}"]`);await click(`[data-depart="${mode}"]`);
      assert.equal(await evaluate('window.gridbound.battle.heroes.length'),9);
      await click('#battle-home');
    }
    report.checks.push({name:'retry/reload XP persistence; Raid and Rogue retain baseline nine'});
    assert.deepEqual(errors,[]);
    report.consoleErrors=[...errors];
  });
} finally {
  if(server?.pid&&server.exitCode===null) {
    const exited=once(server,'exit');server.kill('SIGTERM');await exited;
  }
  report.serverStopped=Boolean(server&&server.exitCode!==null||server?.signalCode);
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/d3-browser-report.json',JSON.stringify(report,null,2)+'\n');
}
assert.equal(report.serverStopped,true);
console.log(JSON.stringify(report,null,2));
console.log('PASS D3 isolated browser smoke; own strict loopback server terminated in finally');
