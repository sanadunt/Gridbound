import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { withBrowser, seedSave } from './browser-harness.mjs';
const port=Number(process.env.D2_PORT)||5184,url=`http://127.0.0.1:${port}/`; let server; let output='';
try {
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>output+=d); server.stderr.on('data',d=>output+=d);
  const deadline=Date.now()+15000; while(!output.includes(url)){if(server.exitCode!==null)throw Error(output);if(Date.now()>deadline)throw Error('server timeout');await new Promise(r=>setTimeout(r,50));}
  assert.equal((await fetch(url)).status,200);
  await withBrowser(async({send,wait,evaluate,click,errors})=>{
    await seedSave(send); // Raids and the Bell Trials open with Chapters 2 and 4
    await send('Page.navigate',{url}); await wait('window.gridbound?.profile?.()');
    const gold = await evaluate(`(() => {
      const amount = document.querySelector("#wallet .currency-amount");
      const expected = Math.floor(window.gridbound.profile().gold).toLocaleString("en-US");
      return { label: amount?.getAttribute("aria-label"), value: amount?.querySelector("span")?.textContent, expected };
    })()`);
    assert.equal(gold.value, gold.expected);
    assert.equal(gold.label, `Gold: ${gold.expected}`);
    await click.nav('campaign');
    await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
    await click('.world-map-wrapper .expedition-mode-nav [data-facility="raid"]');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-raid-tier]"))'),true);
    assert.equal(await evaluate('document.querySelector(".mission-brief")?.textContent?.includes("CONTRACT ·")'),true);
    await click.nav('more');
    await click.nav('challenge-shop');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-bank-buy]"))'),true);
    assert.equal(await evaluate('document.querySelector(".challenge-shop-grid")?.textContent?.includes("◆")'),true);
    await click.nav('campaign');
    await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
    await click('.world-map-wrapper .expedition-mode-nav [data-facility="endless"]');
    assert.equal(await evaluate('document.body.textContent.includes("Run purse")'),true);
    await click('[data-depart="endless"]'); await wait('window.gridbound?.battle?.mode === "endless"');
    assert.equal(await evaluate('document.querySelector("#loot")?.textContent?.includes("◇")'),true);
    await evaluate('window.gridbound.battle.runWallet.crystal = 30; window.gridbound.setRunBoons([])');
    await click('[data-battle-view="log"]');
    // The Ember Upgrade multiplies party power by 1.15 for the room (derived from the power before the purchase, so it cannot go stale).
    const before=await evaluate('window.gridbound.battle.power');
    await click('#run-shop-host [data-run-buy="run-upgrade"]');
    assert.ok(Math.abs(await evaluate('window.gridbound.battle.power')-before*1.15)<1e-9, 'Journey shop purchase applies during a run');
    assert.equal(await evaluate('window.gridbound.battle.runWallet.crystal'), 12, 'Journey shop spends journey Crystal');
    assert.deepEqual(errors,[]);
    console.log('PASS D2 browser smoke: bank shop, raid contract, roguelike run purse, no console errors');
  });
} finally { if(server?.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;} }
