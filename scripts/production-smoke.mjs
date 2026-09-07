import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname,resolve } from 'node:path';
import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';
const root=resolve('dist'),prefix='/subdir/Gridbound/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!path.startsWith(prefix))throw Error('wrong prefix');const file=resolve(root,path.slice(prefix.length)||'index.html');if(!file.startsWith(root+'/'))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const target=process.env.GRIDBOUND_STATIC_URL || origin+prefix;
 const publicRoot=new URL('.',target).href;
 await withBrowser(async({send,wait,evaluate,click,screenshot,errors})=>{
  await send('Page.navigate',{url:target});
  try { await wait('document.querySelector("canvas") && document.querySelector("#town-screen:not([hidden])")'); }
  catch(error) { console.error('BOOT EVIDENCE', JSON.stringify({errors,page:await evaluate('({url:location.href,ready:document.readyState,text:document.body?.innerText.slice(0,200),resources:performance.getEntriesByType("resource").map(r=>r.name)})')}));throw error; }
  assert.equal(await evaluate('typeof window.gridbound'),'undefined','No QA API in production');
  await click('[data-facility="party"]');await click('[data-training-tab="talents"]');await click('[data-inspect-talent="active-2"]');await click('[data-talent="active-2"]');
  await click('[data-facility="campaign"]');await click('[data-depart="adventure"]');await click('#start');
  const before=await evaluate('document.querySelector("#boss-hp").style.width');
  await click('[data-tap="0"]');await click('[data-tap="3"]');
  await wait(`document.querySelector('#boss-hp').style.width!==${JSON.stringify(before)}`);
  const resources=await evaluate('performance.getEntriesByType("resource").map(r=>r.name)');
  assert.ok(resources.length>5);assert.ok(resources.every(url=>url.startsWith(publicRoot)||url.startsWith('data:')),JSON.stringify(resources));
  assert.deepEqual(errors,[]);await screenshot('artifacts/production-subpath.png');
  console.log('PASS production '+new URL(target).pathname+', all resources local, gameplay active, no dev QA API');
 });
}finally{await new Promise(resolve=>server.close(resolve));}
