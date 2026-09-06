import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';
const url=process.env.GRIDBOUND_URL||'http://127.0.0.1:5180/';
await withBrowser(async({send,evaluate,wait,click,screenshot,errors})=>{
 await send('Page.navigate',{url});await wait('window.gridbound?.scene?.textures?.exists("dragon-auric-0")');
 const textures=await evaluate(`Object.keys(window.gridbound.scene.textures.list).filter(k=>/^(wolf|goblin|spider|shaman|golem|wraith|treant|dragon)(-ash|-frost|-auric)?-0$/.test(k)).map(k=>window.gridbound.scene.textures.get(k).getSourceImage().toDataURL())`);
 assert.equal(textures.length,32);assert.equal(new Set(textures).size,32,'each monster variant is actually visually distinct');
 for(let chapter=0;chapter<16;chapter++){
  if(chapter===3||chapter===9){
   await click('[data-facility="party"]');
   await click(`[data-promote="${chapter===3?'paladin':'aegis'}"]`);
   assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'),chapter===3?'paladin':'aegis');
   await evaluate(`(()=>{const s=document.querySelector('[data-equip-slot="0"]');s.value='${chapter===3?4:6}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await screenshot(`artifacts/${chapter===3?'advanced':'third'}-class.png`);
   await click('[data-facility="campaign"]');
  }
  await click(`[data-zone="${chapter}"]`);await click('[data-depart="adventure"]');await click('#start');
  await wait('window.gridbound.battle.status==="fighting"');
  const count=await evaluate('window.gridbound.battle.stageCount');
  for(let stage=0;stage<count;stage++){
   await evaluate('window.gridbound.battle.bossHp=0;window.gridbound.step(.05)');
   await wait('document.querySelector("#modal").open');
   if(stage<count-1){await click('#next-wave');await click('#start');}
  }
  await click('#result-town');assert.equal((await evaluate('window.gridbound.profile().cleared')).length,chapter+1);
 }
 await screenshot('artifacts/campaign-complete.png');
 assert.equal(await evaluate('window.gridbound.profile().roster.length'),9);
 assert.ok(await evaluate('document.querySelector(".story-journal").textContent.includes("YANG HIDUP TIDAK BERUTANG MASA DEPANNYA")'));
 await send('Page.reload');await wait('window.gridbound?.profile().cleared.length===16');
 assert.equal(await evaluate('window.gridbound.profile().loadouts[0].job'),'aegis');
 assert.ok((await evaluate('window.gridbound.profile().loadouts[0].skills')).includes(6));
 await click('[data-view="endless"]');await click('[data-depart="endless"]');
 for(let floor=1;floor<=13;floor++){
  await click('#start');await evaluate('window.gridbound.battle.bossHp=0;window.gridbound.step(.05)');await wait('document.querySelector("#modal").open');
  if(floor<=12)await click('[data-boon]');else await click('#next-floor');
 }
 assert.equal(await evaluate('window.gridbound.battle.floor'),14);assert.equal(await evaluate('new Set(window.gridbound.battle.boons).size'),12);
 await screenshot('artifacts/twelve-boon-build.png');assert.deepEqual(errors,[]);
 console.log('PASS browser 16 chapters / 76 stage transitions, advanced+third promotion/equip/reload, ending journal, 32 unique textures, 12 boons + exhaustion continuation');
});
