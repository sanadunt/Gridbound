import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { withBrowser } from './browser-harness.mjs';
const url='http://127.0.0.1:5184/'; let server; let output='';
try {
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5184','--strictPort'],{stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>output+=d); server.stderr.on('data',d=>output+=d);
  const deadline=Date.now()+15000; while(!output.includes(url)){if(server.exitCode!==null)throw Error(output);if(Date.now()>deadline)throw Error('server timeout');await new Promise(r=>setTimeout(r,50));}
  assert.equal((await fetch(url)).status,200);
  await withBrowser(async({send,wait,evaluate,click,errors})=>{
    await send('Page.navigate',{url}); await wait('window.gridbound?.profile?.()');
    assert.equal(await evaluate('document.querySelector("#wallet")?.textContent?.includes("g")'),true);
    await click('[data-view="raid"]');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-raid-tier]"))'),true);
    assert.equal(await evaluate('document.querySelector(".mission-brief")?.textContent?.includes("REWARDED CONTRACT")'),true);
    await click('[data-facility="challenge-shop"]');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-bank-buy]"))'),true);
    assert.equal(await evaluate('document.querySelector(".challenge-shop-grid")?.textContent?.includes("CRYSTAL")'),true);
    await click('[data-view="endless"]');
    assert.equal(await evaluate('document.body.textContent.includes("Run purse")'),true);
    await click('[data-depart="endless"]'); await wait('window.gridbound?.battle?.mode === "endless"');
    assert.equal(await evaluate('document.querySelector("#loot")?.textContent?.includes("RUN")'),true);
    assert.equal(await evaluate('document.querySelector("#loot")?.textContent?.includes("g")'),false);
    assert.deepEqual(errors,[]);
    console.log('PASS D2 browser smoke: bank shop, raid contract, roguelike run purse, no console errors');
  });
} finally { if(server?.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;} }
