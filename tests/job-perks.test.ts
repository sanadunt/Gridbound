import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, SUPPORT_KINDS, CONTROL_MIN, CONTROL_SHARE, type Hero } from '../src/game/simulation';
import { JOBS, type Job } from '../src/game/jobs';
import { KITS, ROSTER } from '../src/game/content';
import { CONTENT_TEXT } from '../src/i18n/content-text';
import { createRogueBuild } from '../src/game/roguelike-build';

const step=(b:Battle,s:number)=>{for(let i=0;i<Math.round(s*60);i++)b.tick(1/60);};
// No intents, claws, summons or auto-casts: only the casts a test makes happen.
const quiet=(b:Battle)=>{const x=b as any;x.attackIn=x.clawIn=x.summonIn=999;for(const h of b.heroes)h.remaining=999;};
const offensiveSkill=(h:Hero)=>h.skills.find(i=>!SUPPORT_KINDS.includes(KITS[h.classId].skills[i].kind))!;
const bossHits=(b:Battle,h:Hero)=>b.drain().filter(e=>e.type==='projectile'&&e.source===h.id&&e.lane===-1).length;
const TIER3=Object.values(JOBS).filter(j=>j.tier===3);
// A raid whose first hero has the job's base class, the job and its signature skill in slot 0; one ally beside it.
function promoted(job:Job){const id=ROSTER.findIndex(h=>h.classId===job.base),b=new Battle('raid',1,undefined,{roster:[id,...[4,0].filter(x=>x!==id)],enemyId:'dragon',loadouts:{[id]:{skills:[job.index,0],talents:[],job:job.id}}});return {b,h:b.hero(id)!,ally:b.heroes.find(a=>a.id!==id)!};}

test('every tier-3 job declares a perk and no tier-2 job does',()=>{
  assert.equal(TIER3.length,18);
  for(const j of TIER3)assert.ok(j.perk&&Object.values(j.perk).every(v=>typeof v==='number'&&v>0)&&Object.keys(j.perk).length,j.id);
  for(const j of Object.values(JOBS).filter(j=>j.tier===2))assert.equal(j.perk,undefined,j.id);
});
for(const job of TIER3)test(`${job.name}: tier-3 perk fires in battle`,()=>{
  const perk=job.perk!,{b,h,ally}=promoted(job);b.start();quiet(b);b.bossHp=b.bossMax=1e7;
  if(perk.barrier)assert.ok(h.shield>=h.maxHp*perk.barrier-1e-9,'opening barrier');
  if(perk.intentDelay){const x=b as any;x.attackIn=5;b.act(h);assert.ok(Math.abs(x.attackIn-5-perk.intentDelay)<1e-9,'intent delay');}
  if(perk.echo){h.stance=offensiveSkill(h);h.offensiveActs=0;for(let i=0;i<3;i++)b.act(h);b.drain();b.act(h);const fourth=bossHits(b,h);b.act(h);assert.equal(h.offensiveActs,5);assert.equal(bossHits(b,h),fourth+1,'echo on the 5th offensive cast');}
  if(perk.castLeech){h.stance=0;h.hp=Math.round(h.maxHp*.6);const hp=h.hp,boss=b.bossHp;b.act(h);assert.ok(Math.abs(h.hp-hp-(boss-b.bossHp)*perk.castLeech)<1,'heals castLeech × power');}
  if(perk.minionHeal){b.summon();ally.hp=100;b.hitMinion(b.minions[0],1e6,ally.id,'slash');assert.equal(ally.hp,100,'only this job heals on a kill');b.summon();b.hitMinion(b.minions.find(m=>m.hp>0)!,1e6,h.id,'slash');assert.equal(ally.hp,100+perk.minionHeal);}
  if(perk.overhealBarrier){for(const a of b.heroes)a.shield=0;h.stance=job.index;b.act(h);step(b,1);assert.ok(ally.shield>0,'ally barrier from the caster’s overheal');}
});
test('Roguelike promotion to a barrier job grants the opening barrier at once',()=>{
  const win=(b:Battle)=>{b.start();b.bossHp=0;b.tick(.05);};
  for(const job of TIER3.filter(j=>j.perk?.barrier)){
    const b=new Battle('endless',1,undefined,{rogueBuild:createRogueBuild([job.base,job.base,job.base])});win(b);assert.equal(b.upgradeRogue(0,job.parent!),true);
    const next=new Battle('endless',2,undefined,{rogueBuild:b.snapshot().rogueBuild!});win(next);const h=next.hero(0)!;h.shield=0;
    assert.equal(next.upgradeRogue(0,job.id),true,job.id);assert.ok(h.shield>=h.maxHp*job.perk!.barrier!-1e-9,job.id);
  }
});
test('Ember Seraph overheal on allies becomes their barrier; a Dawn Priest’s does not',()=>{
  for(const [job,index,expect] of [['seraph',0,true],['priest',0,false]] as const){
    const b=new Battle('raid',1,undefined,{roster:[4,0],loadouts:{4:{skills:[index,1],talents:[],job}}});b.start();quiet(b);for(const a of b.heroes)a.shield=0;
    b.act(b.hero(4)!);assert.equal(b.hero(0)!.shield>0,expect,job);
  }
  const b=new Battle('raid',1,undefined,{roster:[0,4],loadouts:{4:{skills:[0,1],talents:[],job:'seraph'}}});b.start();quiet(b);const seraph=b.hero(4)!;seraph.shield=0;b.heal(seraph,100,b.hero(0));assert.equal(seraph.shield,0,'heals the Seraph receives from others are not her perk');
});
test('tier-3 descriptions state their perk numbers in Indonesian and English',()=>{
  const number:Record<string,(v:number)=>[string,string]>={barrier:v=>[`${v*100}%`,`${v*100}%`],echo:v=>[`${v*100}%`,`${v*100}%`],castLeech:v=>[`${v*100}%`,`${v*100}%`],overhealBarrier:v=>[`${v*100}%`,`${v*100}%`],intentDelay:v=>[String(v).replace('.',','),String(v)],minionHeal:v=>[`${v} HP`,`${v} HP`]};
  for(const j of TIER3)for(const [key,v] of Object.entries(j.perk!)){const [id,en]=number[key](v),text=CONTENT_TEXT[`job.${j.id}.description`];assert.ok(j.description.includes(id),`${j.id} source: ${id}`);assert.ok(text.id.includes(id),`${j.id} id: ${id}`);assert.ok(text.en.includes(en),`${j.id} en: ${en}`);}
});
test('AoE skill text matches the minion share the simulation uses',()=>{
  let checked=0;
  for(const [cls,kit] of Object.entries(KITS))kit.skills.forEach((s,i)=>{if(s.kind!=='aoe')return;checked++;
    const job=Object.values(JOBS).find(j=>j.base===cls&&j.index===i),text=CONTENT_TEXT[job?`job.${job.id}.skill.description`:`kit.${cls}.skills.${i}.description`];
    if(cls==='wizard'||cls==='warrior')for(const t of [s.description,text.id,text.en])assert.ok(t.includes('60%'),`${s.name}: ${t}`);
    else{const split=Math.round(s.power*1.7);assert.ok(s.description.startsWith(`${split} damage dibagi rata`)&&s.description.includes(`${s.power} damage ke boss`),s.name);assert.equal(text.id,s.description);assert.ok(text.en.startsWith(`${split} damage shared evenly`)&&text.en.includes(`${s.power} damage hits the boss`),s.name);}
  });
  assert.equal(checked,9);
});
test('overlapping regen and Battle Hymn keep the stronger effect',()=>{
  const b=new Battle('raid',1,undefined,{roster:[4,8],loadouts:{4:{skills:[6,0],talents:[],job:'seraph',xp:1e6},8:{skills:[3,0],talents:['active-2','active-3']}}});b.start();quiet(b);
  const seraph=b.hero(4)!,mira=b.hero(8)!;b.act(seraph);const strong=seraph.regenPower;b.act(mira);
  for(const a of b.heroes){assert.equal(a.regenPower,strong);assert.equal(a.regenSource,4);assert.equal(a.regen,6);}
  step(b,6.5);b.act(mira);const weak=mira.regenPower;assert.ok(weak<strong);assert.equal(mira.regenSource,8,'a weaker regen applies when none is running');
  b.act(seraph);assert.equal(mira.regenPower,strong,'a stronger regen replaces a weaker one');
  const hymn=new Battle('raid',1,undefined,{roster:[9,4],loadouts:{9:{skills:[4,0],talents:[],job:'troubadour'},4:{skills:[1,0],talents:[]}}});hymn.start();quiet(hymn);
  hymn.act(hymn.hero(9)!);hymn.act(hymn.hero(4)!);assert.ok(hymn.heroes.every(a=>a.buff===10),'Battle Hymn keeps the longer Troubadour hymn');
  step(hymn,4);hymn.act(hymn.hero(4)!);assert.ok(hymn.heroes.every(a=>a.buff===7));
});
test('two hexers keep separate curses; a recast refreshes only its own',()=>{
  const b=new Battle('raid',1,undefined,{roster:[10,0,4],raidBuild:{slots:[{heroId:10,classId:'hexer'},{heroId:0,classId:'hexer'},{heroId:4,classId:'healer'}]}});b.start();quiet(b);b.bossHp=b.bossMax=1e7;
  const a=b.hero(10)!,c=b.hero(0)!;b.act(a);b.act(c);assert.deepEqual(b.snapshot().curses.map(x=>x.source),[10,0]);
  step(b,.5);b.act(a);const curses=b.snapshot().curses;assert.equal(curses.length,2);assert.ok(Math.abs(curses.find(x=>x.source===0)!.left-5.5)<1e-6);assert.equal(curses.find(x=>x.source===10)!.left,6);
  b.drain();const hp=b.bossHp;step(b,6.2);const ticks=b.drain().filter(e=>e.kind==='curse');
  assert.equal(ticks.filter(e=>e.source===10).length,6);assert.ok(ticks.filter(e=>e.source===0).length>=5);assert.equal(hp-b.bossHp,ticks.reduce((n,e)=>n+e.amount!,0));assert.deepEqual(b.snapshot().curses,[]);
});
test('restoring a checkpoint from before per-caster curses drops the old single curse slot',()=>{
  const b=new Battle('raid',1,undefined,{roster:[10,4]});const old={...b.checkpoint(),curse:{left:0,power:0,source:-1,tick:1}} as any;delete old.curses;
  const next=new Battle('raid',1,undefined,{roster:[10,4]});next.restoreCheckpoint(old);assert.equal('curse' in next,false);assert.deepEqual(next.curses,[]);assert.equal('curse' in next.checkpoint(),false);
});
test('Precision and echoes count offensive casts only; threat ranking ignores the precision proc',()=>{
  const b=new Battle('raid',1,undefined,{roster:[12,4],loadouts:{12:{skills:[4,1],talents:[],job:'ascetic'}}});b.start();quiet(b);b.bossHp=b.bossMax=1e7;const h=b.hero(12)!;
  const gates:number[]=[],counters:number[]=[];
  for(let i=0;i<6;i++){h.stance=i%2?1:4;h.combo=0;const hp=b.bossHp;b.act(h);if(i%2)counters.push(h.counterPower);else gates.push(hp-b.bossHp);}
  assert.equal(h.acts,6);assert.equal(h.offensiveActs,3);assert.ok(counters.every(c=>c===counters[0]),'counter never procs');
  assert.equal(gates[0],gates[1]);assert.ok(Math.abs(gates[2]-gates[0]*1.6)<=1,`3rd offensive cast procs: ${gates}`);
  h.stance=4;const threat=(b as any).threatPower(h);h.offensiveActs=2;h.acts=2;assert.equal((b as any).threatPower(h),threat);h.offensiveActs=3;h.acts=3;assert.equal((b as any).threatPower(h),threat);
});
test('a counter that kills the boss on the hit that downs the last hero is a victory and that hero stays at 1 HP',()=>{
  const b=new Battle('raid',1,undefined,{roster:[12],loadouts:{12:{skills:[1,0],talents:[]}}});b.start();const h=b.hero(12)!;b.act(h);
  b.bossHp=1;h.hp=1;h.shield=0;b.hurt(h,1000);assert.equal(b.bossHp,0);assert.equal(h.hp,1);assert.ok(!b.drain().some(e=>e.type==='down'));step(b,.1);assert.equal(b.status,'victory');
});
test('control has a budget per intent cycle: stacked delays cannot stop boss intents',()=>{
  const b=new Battle('raid',1,undefined,{roster:[9,4],enemyId:'dragon',loadouts:{9:{skills:[2,0],talents:['active-2']}}});b.start();quiet(b);const x=b as any;
  b.telegraph();x.attackIn=5;const budget=Math.max(CONTROL_MIN,CONTROL_SHARE*b.intentInterval());
  b.act(b.hero(9)!);assert.ok(Math.abs(x.attackIn-7.2)<1e-9);b.act(b.hero(9)!);assert.ok(Math.abs(x.attackIn-5-budget)<1e-9,'second Lullaby is capped by the budget');
  b.act(b.hero(9)!);assert.ok(Math.abs(x.attackIn-5-budget)<1e-9);b.telegraph();b.act(b.hero(9)!);assert.ok(Math.abs(x.attackIn-5-budget-2.2)<1e-9,'a new intent cycle refills the budget');
  // 2× Lullaby + 2× Flash Mine with expert tapping still lets the dragon act.
  const ids=['Tamsin','Ilse','Pell','Hale','Aldric','Lyra'].map(n=>ROSTER.findIndex(r=>r.name===n));
  const lock=new Battle('raid',1,undefined,{roster:ids,enemyId:'dragon',loadouts:{[ids[0]]:{skills:[2,0],talents:['active-2']},[ids[1]]:{skills:[2,0],talents:['active-2']},[ids[2]]:{skills:[1,0],talents:[]},[ids[3]]:{skills:[1,0],talents:[]}}});
  lock.start();lock.bossHp=lock.bossMax=1e8;let intents=0,next=0;
  while(lock.time<120&&lock.status==='fighting'){if(lock.time>=next){next+=.22;for(const h of lock.living()){lock.tap(h.id);h.hp=h.maxHp;}}lock.tick(1/60);intents+=lock.drain().filter(e=>e.type==='warning'&&e.text!=='AFTERSHOCK').length;}
  assert.ok(intents>=8,`intents in 120s: ${intents}`);
});
