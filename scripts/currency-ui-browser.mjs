import assert from 'node:assert/strict';
import {withBrowser} from './browser-harness.mjs';
for(const width of [390,768,1440]) await withBrowser(async({send,wait,evaluate,screenshot,errors})=>{
 await send('Page.navigate',{url:'http://127.0.0.1:5187/'});
 await wait('Boolean(document.querySelector("#wallet"))');
 if (!await evaluate('Boolean(document.querySelector("#commander-name"))')) await evaluate('document.querySelector("#profiles")?.click()');
 await wait('Boolean(document.querySelector("#commander-name"))');
 await evaluate('document.fonts.ready');
 await evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');
 await screenshot(`artifacts/currency-${width}.png`);
 const state=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,wallets:[...document.querySelectorAll('.header-tools .wallet')].map(e=>({text:e.textContent,label:e.querySelector('[aria-label]')?.getAttribute('aria-label'),icon:!!e.querySelector('svg'),clipped:e.scrollWidth>e.clientWidth}))})`);
 console.log(JSON.stringify(state));
 if(process.env.VERIFY_CURRENCY){assert.ok(state.scroll<=width);for(const w of state.wallets){assert.ok(w.icon);assert.ok(w.label);assert.ok(!w.clipped);assert.match(w.text,/^\d[\d,]*$/);}}
 assert.equal(errors.length,0);
},{width,height:900});
