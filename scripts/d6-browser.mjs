import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { withBrowser } from './browser-harness.mjs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort'],{stdio:'pipe'});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
try {
 const deadline=Date.now()+15000;
 while(!output.includes('http://127.0.0.1:5186/')){if(server.exitCode!==null||Date.now()>deadline)throw Error(output);await new Promise(r=>setTimeout(r,100));}
 await withBrowser(async({send,evaluate,wait,click,errors,screenshot})=>{
  await send('Page.navigate',{url:'http://127.0.0.1:5186/'});
  await wait('window.gridbound && (document.querySelector(".town-game-shell") || document.querySelector("#title-screen"))',15000);
  const openProfiles=async()=>{
   if(await evaluate('Boolean(document.querySelector("dialog[open] #new-commander"))')) return;
   if(await evaluate('Boolean(document.querySelector("#title-screen:not([hidden])"))')) await click('#title-profiles');
   else {
    if(!await evaluate('Boolean(document.querySelector(".more-scene"))')) { await click.nav('more'); await wait('Boolean(document.querySelector(".more-scene"))'); }
    await click('.more-scene [data-open-action="profiles"]');
   }
   await wait('Boolean(document.querySelector("#new-commander"))',15000);
  };
  await openProfiles();
  const name=async value=>evaluate(`document.querySelector('#commander-name').value=${JSON.stringify(value)}`);
  await name('Smoke Alpha');await click('#new-commander');
  await wait('!document.querySelector("dialog[open]")');
  await openProfiles();await wait('Boolean(document.querySelector("#rename-commander"))');
  assert.equal(await evaluate('document.querySelectorAll("[data-save-slot]").length'),3);
  assert.equal(await evaluate('document.querySelectorAll("[data-load-slot]").length'),4);
  await click('[data-save-slot="manual-1"]');
  await wait('document.querySelector("[data-load-slot=manual-1]")?.disabled===false');
  await click('[data-load-slot="manual-1"]');await wait('Boolean(document.querySelector("#load-confirm"))');
  await click('#load-confirm');await wait('!document.querySelector("dialog[open]")');
  for(const n of ['Smoke Beta','Smoke Gamma']) { await openProfiles(); await name(n); await click('#new-commander'); await wait('!document.querySelector("dialog[open]")'); }
  await openProfiles();await wait('document.querySelectorAll("[data-commander]").length===3');
  assert.equal(await evaluate('document.querySelector("#new-commander").disabled'),true);
  await screenshot('artifacts/d6-profiles.png');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'mobile horizontal overflow');
  await screenshot('artifacts/d6-profiles-mobile.png');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:500,deviceScaleFactor:1,mobile:true});
  const profileField=await evaluate(`(() => {
   const input=document.querySelector('#commander-name');
   input.focus();input.scrollIntoView({block:'center',inline:'nearest'});
   const field=input.getBoundingClientRect(),dialog=document.querySelector('dialog[open]').getBoundingClientRect();
   return {active:document.activeElement===input,field:{left:field.left,right:field.right,top:field.top,bottom:field.bottom,width:field.width,height:field.height},dialog:{top:dialog.top,bottom:dialog.bottom,height:dialog.height}};
  })()`);
  assert.ok(profileField.active && profileField.field.width>=44 && profileField.field.height>=44 && profileField.field.left>=0 && profileField.field.right<=390 && profileField.field.top>=profileField.dialog.top && profileField.field.bottom<=profileField.dialog.bottom && profileField.dialog.top>=0 && profileField.dialog.bottom<=500 && profileField.dialog.height<=468,
   `Commander input remains reachable in a 390×500 reduced-height viewport: ${JSON.stringify(profileField)}`);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth && document.documentElement.scrollHeight<=window.innerHeight+1'),true,'short profile viewport document overflow');
  await screenshot('artifacts/d6-profiles-short-viewport.png');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('window.__d6BeforeReload=true');
  await send('Page.reload');
  await wait('window.__d6BeforeReload===undefined && !document.querySelector("dialog[open]")',15000);
  await wait('window.gridbound && document.querySelector(".town-game-shell")',15000);
  await openProfiles();
  await wait('document.querySelectorAll("[data-commander]").length===3',15000);
  const alpha=await evaluate(`Array.from(document.querySelectorAll('[data-commander]')).find(el=>el.parentElement.textContent.includes('Smoke Alpha')).dataset.commander`);
  await click(`[data-commander="${alpha}"]`);await wait('!document.querySelector("dialog[open]")');
  await openProfiles();await wait('Boolean(document.querySelector("#commander-name"))');
  assert.equal(await evaluate('document.querySelector("#commander-name").value'),'Smoke Alpha');
  assert.equal(await evaluate('document.querySelector("[data-load-slot=manual-1]").disabled'),false);
  await click('[data-close]');
  for(const mode of ['raid','endless']) {
   await click.nav('campaign');
   await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
   await click(`.world-map-wrapper .expedition-mode-nav [data-facility="${mode}"]`);
   await wait(`Boolean(document.querySelector('[data-depart="${mode}"]'))`);
   await wait('document.querySelector("#storage-status")?.textContent.startsWith("Saved")');
   await click(`[data-depart="${mode}"]`);try { await wait(`window.gridbound?.battle?.mode===${JSON.stringify(mode)} && window.gridbound?.inTown===false`); } catch(e) { console.log(await evaluate('document.body.innerText'),JSON.stringify(errors));throw e; }
   const before=await evaluate('window.gridbound.battle.snapshot()');
   await click('#pause');await wait('Boolean(document.querySelector("#modal #pause-retreat"))');
   await click('#pause-retreat');await wait('Boolean(document.querySelector("#suspend-run"))');
   await click('#suspend-run');await wait('window.gridbound.inTown===true');
   await click.nav('campaign');
   await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
   await click(`.world-map-wrapper .expedition-mode-nav [data-facility="${mode}"]`);
   await openProfiles();await wait('Boolean(document.querySelector("#continue-latest"))');
   await click('#continue-latest');
   try { await wait('window.gridbound.inTown===false',15000); } catch(error) {
    const state=await evaluate(`(() => ({mode:${JSON.stringify(mode)},inTown:window.gridbound.inTown,status:window.gridbound.battle.status,battleMode:window.gridbound.battle.mode,profileError:document.querySelector("#profile-error")?.textContent,storageStatus:document.querySelector("#storage-status")?.textContent,modal:document.querySelector("dialog[open]")?.textContent,continueDisabled:document.querySelector("#continue-latest")?.disabled}))()`);
    console.error('Commander checkpoint restore did not leave Town:',JSON.stringify(state),JSON.stringify(errors));
    throw error;
   }
   const after=await evaluate('window.gridbound.battle.snapshot()');
   assert.deepEqual(after.heroes,before.heroes,mode+' resume heroes');
   assert.equal(after.bossHp,before.bossHp,mode+' resume boss');
   await click('#pause');await wait('Boolean(document.querySelector("#modal #pause-retreat"))');
   await click('#pause-retreat');await wait('Boolean(document.querySelector("#abandon-run"))');await click('#abandon-run');await wait('window.gridbound.inTown===true');
   await click.nav('campaign');
   await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
   await click(`.world-map-wrapper .expedition-mode-nav [data-facility="${mode}"]`);
   await openProfiles();await wait('Boolean(document.querySelector("#continue-latest"))');await click('#continue-latest');
   await wait('document.querySelector("#profile-error")?.textContent.includes("No checkpoint")');await click('[data-close]');
  }
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="raid"]');
  await wait('Boolean(document.querySelector("[data-depart=raid]")) && document.querySelector("#storage-status")?.textContent.startsWith("Saved")');
  await click('[data-depart="raid"]');await wait('window.gridbound.inTown===false');
  const initialBank=await evaluate('window.gridbound.profile().economy.commanderCrystal');
  await click('#start');
  await evaluate('window.gridbound.battle.bossHp=0');
  await wait('Boolean(document.querySelector("#result-town")) && !document.querySelector("#result-town").disabled',15000);
  const paid=await evaluate('window.gridbound.profile()');
  assert.ok(paid.economy.commanderCrystal>initialBank,'certified Raid must actually bank reward');
  await click('#result-town');await wait('window.gridbound.inTown===true');
  await openProfiles();await wait('Boolean(document.querySelector("#continue-latest"))');await click('#continue-latest');
  await wait('Boolean(document.querySelector("#result-town")) && !document.querySelector("#result-town").disabled',15000);
  assert.equal(await evaluate('window.gridbound.profile().economy.commanderCrystal'),paid.economy.commanderCrystal,'terminal replay never recredits');
  await click('#result-town');await wait('window.gridbound.inTown===true');
  await click.nav('campaign');
  await wait('Boolean(document.querySelector(".world-map-wrapper .expedition-mode-nav"))');
  await click('.world-map-wrapper .expedition-mode-nav [data-facility="endless"]');
  await wait('Boolean(document.querySelector("[data-depart=endless]")) && document.querySelector("#storage-status")?.textContent.startsWith("Saved")');
  await click('[data-depart="endless"]');await wait('window.gridbound.inTown===false');await click('#start');
  const beforeDefeat=await evaluate('window.gridbound.profile().economy.commanderCrystal');
  await evaluate('window.gridbound.battle.heroes.forEach(h=>h.hp=0)');
  await wait('Boolean(document.querySelector("#result-town")) && !document.querySelector("#result-town").disabled',15000);
  assert.equal(await evaluate('window.gridbound.profile().economy.commanderCrystal'),beforeDefeat,'defeat pays no bank');
  await click('#result-town');await wait('window.gridbound.inTown===true');
  const walletChecks=await evaluate(`(async()=>{
   const {openCommanderRepository,materializeProfile}=await import('/src/game/commander.ts');
   const {CommanderSession}=await import('/src/game/commander-session.ts');
   const repo=await openCommanderRepository();
   try{
    const doc=(await repo.list()).find(d=>d.name==='Smoke Alpha');
    const candidate=structuredClone(doc);candidate.shared.bankCrystal=57;candidate.shared.settlementReceipts=['paid-once'];
    const committed=await repo.commit(candidate,doc.revision);
    const session=new CommanderSession();session.repository=repo;session.select(committed,'story');
    await session.loadSlot('manual-1');
    const rogueSession=new CommanderSession();rogueSession.repository=repo;rogueSession.select(session.document,'roguelike');
    let blocked=false;try{await rogueSession.loadSlot('auto');}catch(e){blocked=e.message.includes('bookmarks');}
    if(!blocked)throw Error('Terminal Rogue bookmark should be blocked from rewind');
    const saved=(await repo.list()).find(d=>d.commanderId===doc.commanderId);
    return {bank:saved.shared.bankCrystal,receipts:saved.shared.settlementReceipts,storyBank:materializeProfile(saved,'story').economy.commanderCrystal};
   }finally{repo.close();}
  })()`);
  assert.deepEqual(walletChecks,{bank:57,receipts:['paid-once'],storyBank:0});
  const transactionChecks=await evaluate(`(async()=>{
   const {openCommanderRepository}=await import('/src/game/commander.ts');
   const a=await openCommanderRepository(),b=await openCommanderRepository();
   try {
    const original=(await a.list())[0];
    const candidate=structuredClone(original);candidate.shared.bankCrystal=57;candidate.shared.settlementReceipts=['smoke-paid'];
    const committed=await a.commit(candidate,original.revision);
    let stale=false;try{await b.commit(original,original.revision);}catch(e){stale=e.name==='StaleCommanderError';}
    const restored=(await b.list()).find(x=>x.commanderId===original.commanderId);
    const put=IDBObjectStore.prototype.put;
    let failed=false;
    try{IDBObjectStore.prototype.put=function(){throw new DOMException('Injected failure','QuotaExceededError');};const next=structuredClone(committed);next.shared.bankCrystal=999;await a.commit(next,committed.revision);}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
    const after=(await b.list()).find(x=>x.commanderId===original.commanderId);
    return {stale,failed,balance:restored.shared.bankCrystal,after:after.shared.bankCrystal,revision:after.revision,expectedRevision:committed.revision};
   }finally{a.close();b.close();}
  })()`);
  assert.equal(transactionChecks.stale,true);assert.equal(transactionChecks.failed,true);assert.equal(transactionChecks.balance,57);assert.equal(transactionChecks.after,57);assert.equal(transactionChecks.revision,transactionChecks.expectedRevision);
  assert.deepEqual(errors,[]);
  console.log('PASS D6 browser: create three Commanders, slot counts, Story save/load, limit, reload persistence, switch; zero console errors');
 });
} finally {
 if(server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}
}
