import assert from 'node:assert/strict';
import {withBrowser} from './browser-harness.mjs';
const url=process.env.GRIDBOUND_URL||'http://127.0.0.1:5193/';
for(const [width,height] of [[390,844],[360,740],[1440,900]]) await withBrowser(async({send,wait,click,evaluate,errors})=>{
 await send('Page.navigate',{url});await wait('Boolean(window.gridbound?.scene)');
 const rows=[];const measure=async(name)=>{const m=await evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})');assert.ok(m.w<=width+1);rows.push({name,...m,overflow:Math.max(0,m.h-height)});};
 await measure('campaign');
 await click('[data-facility="party"]');
 for(const tab of ['overview','skills','jobs','talents','gear','formation']){await click(`[data-training-tab="${tab}"]`);await measure(tab);}
 for(const tab of ['quests','bestiary']){await click(`[data-facility="${tab}"]`);await measure(tab);}
 console.log(JSON.stringify({width,height,rows}));assert.deepEqual(errors,[]);
},{width,height,mobile:width<500});
