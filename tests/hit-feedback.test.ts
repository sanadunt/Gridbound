import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation';
import { HitStats, isRelativeCrit, allowedShake, CRIT_SAMPLE, SHAKE_PER_SECOND } from '../src/render/hit-feedback';

// Mid-game power: every hit clears the old absolute 110 threshold, so the old rule showed nearly every hit as a crit.
const hitsOf=(floor:number,power:number)=>{const b=new Battle('raid',floor,{power,vitality:1,tempo:1});b.start();const hits:{amount:number;source:number;kind:string}[]=[];
  for(let i=0;i<60*90&&b.status==='fighting';i++){if(i%20===0)for(const h of b.living())b.tap(h.id);for(const h of b.heroes)if(h.hp>0)h.hp=h.maxHp;b.tick(1/60);for(const e of b.drain())if(e.type==='projectile')hits.push({amount:e.amount!,source:e.source!,kind:e.kind!});}return hits;};
test('crits are relative to the encounter, not an absolute damage number',()=>{for(const [floor,power] of [[8,4.8],[14,8.4]]){const hits=hitsOf(floor,power).filter(h=>!['ultimate','curse','thorn'].includes(h.kind));assert.ok(hits.length>=30);
  assert.ok(hits.filter(h=>Math.round(h.amount)>=110).length/hits.length>.9,'the old rule saturates at this power');const stats=new HitStats(),crits=hits.filter(h=>stats.crit(h.amount,h.source,h.kind)).length;assert.ok(crits>0&&crits/hits.length<.2,`relative crits stay rare: ${crits}/${hits.length}`);}});
test('a crit needs a sample or a big jump over its source average; ticks and the ultimate never crit',()=>{assert.equal(isRelativeCrit(500,Array(CRIT_SAMPLE-1).fill(100)),false);assert.equal(isRelativeCrit(101,Array(CRIT_SAMPLE).fill(100)),true);assert.equal(isRelativeCrit(100,Array(CRIT_SAMPLE).fill(100)),false);assert.equal(isRelativeCrit(250,[],{avg:100,n:4}),true);assert.equal(isRelativeCrit(250,[],{avg:100,n:3}),false);
  const stats=new HitStats();for(let i=0;i<20;i++)stats.crit(100,1);assert.equal(stats.crit(9999,1,'ultimate'),false);assert.equal(stats.crit(9999,1,'curse'),false);assert.equal(stats.crit(300,1),true);stats.reset();assert.equal(stats.crit(300,1),false);});
test('screen shake has a per-second budget that big moments may ignore',()=>{assert.equal(allowedShake(.3,0),.3);assert.ok(Math.abs(allowedShake(.3,SHAKE_PER_SECOND-.1)-.1)<1e-9);assert.equal(allowedShake(.3,SHAKE_PER_SECOND),0);assert.equal(allowedShake(.55,SHAKE_PER_SECOND,true),.55);});
