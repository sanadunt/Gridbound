import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITS,ROSTER } from '../src/game/content';
import { JOBS,legalSkill,GEAR } from '../src/game/jobs';
import { CAMPAIGN,ENEMIES,boonChoices } from '../src/game/world';
import { TALENTS,createProfile,completeZone,normalizeProfile,equipGear,equipSkill,promote } from '../src/game/profile';
import { Battle } from '../src/game/simulation';
for(const job of Object.values(JOBS))test(`${job.name}: signature skill is equip-gated and executes real mechanics`,()=>{
 const id=ROSTER.findIndex(h=>h.classId===job.base),b=new Battle('raid',1,undefined,{roster:[id,4],loadouts:{[id]:{skills:[job.index,0],talents:[],job:job.id}}});
 const h=b.hero(id)!;assert.ok(b.availableSkills(id).includes(job.index));
 b.heroes.forEach(h=>h.hp*=.5);b.threats=[{id:9,type:'all',name:'ritual',slots:[0,1,2,3,4,5,6,7,8],left:3,total:3,damage:90}];
 const hp=b.bossHp,party=b.heroes.reduce((n,h)=>n+h.hp+h.shield,0);b.start();b.act(h);
 const kind=KITS[job.base].skills[job.index].kind;
 if(['attack','aoe','interrupt','mark'].includes(kind))assert.ok(b.bossHp<hp);
 if(['heal','partyshield','shield'].includes(kind))assert.ok(b.heroes.reduce((n,h)=>n+h.hp+h.shield,0)>party);
 if(kind==='regen')assert.ok(b.heroes.some(h=>h.regen>0));if(kind==='buff')assert.ok(b.heroes.every(h=>h.buff>0));
 if(kind==='interrupt')assert.equal(b.threats.length,0);
 assert.equal(legalSkill(job.index,[]),false);
});
test('database references are complete and all 32 enemy variants produce valid intents',()=>{
 assert.equal(Object.keys(ENEMIES).length,32);for(const c of CAMPAIGN)for(const s of c.stages){assert.ok(ENEMIES[s.enemy]);assert.ok(s.hp>0);}
 for(const enemy of Object.values(ENEMIES)){const b=new Battle('raid',1,undefined,{enemyId:enemy.id});for(let i=0;i<enemy.patterns.length;i++){b.telegraph();const t=b.threats.at(-1)!;assert.ok(t.counter);assert.ok(t.slots.every(s=>s>=0&&s<9));}}
 assert.equal(TALENTS.length,15);for(const t of TALENTS)if(t.requires)assert.ok(TALENTS.find(x=>x.id===t.requires));
 for(const g of GEAR)assert.ok(['weapon','armor','charm'].includes(g.slot));
});
test('save normalization rejects impossible jobs, wrong-branch skills, unowned equipment and talent cycles',()=>{
 const p=createProfile();p.loadouts[0].job='aegis';p.loadouts[0].skills=[6,7];p.loadouts[0].gear={weapon:'iron-edge'};p.loadouts[0].inventory=[];p.loadouts[0].talents=['mastery-2'];
 const safe=normalizeProfile(p);assert.equal(safe.loadouts[0].job,undefined);assert.deepEqual(safe.loadouts[0].skills,[0,1]);assert.equal(safe.loadouts[0].gear?.weapon,undefined);assert.deepEqual(safe.loadouts[0].talents,[]);
 p.gold=NaN;assert.equal(normalizeProfile(p).gold,60);
});
test('max-level jobs survive migration; the other branch remains unequippable',()=>{
 const p=createProfile();for(let i=0;i<9;i++)completeZone(p,i);p.gold=9999;assert.ok(promote(p,0,'paladin'));assert.ok(promote(p,0,'aegis'));assert.ok(equipSkill(p,0,0,6));assert.equal(equipSkill(p,0,1,7),false);assert.ok(equipGear(p,0,'iron-edge'));
 const roundtrip=normalizeProfile(JSON.parse(JSON.stringify(p)));assert.deepEqual(roundtrip,normalizeProfile(p)); assert.deepEqual(roundtrip.loadouts[0].skills,[6,1]);assert.equal(roundtrip.loadouts[0].job,'aegis');
});
test('boon draft is seeded, unique, nonduplicating and exhaustible',()=>{
 const a=boonChoices([],12);assert.deepEqual(a,boonChoices([],12));assert.equal(new Set(a.map(b=>b.id)).size,3);
 const taken:string[]=[];for(let i=0;i<12;i++){const b=boonChoices(taken,i);assert.ok(b.length);assert.ok(!taken.includes(b[0].id));taken.push(b[0].id);}assert.deepEqual(boonChoices(taken,3),[]);
});
