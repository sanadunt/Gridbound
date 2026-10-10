import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, completeZone, normalizeProfile, settleProgress, moveFormation } from '../src/game/profile';
import { heroProgress, xpForLevel } from '../src/game/levels';
import { storyPartyCap, setStoryParty, storyBattleOptions, benchExperience } from '../src/game/story-party';
import { Battle } from '../src/game/simulation';
import { loadSave, saveProfile, SAVE_KEY } from '../src/game/save';

const progressed = () => { const p=createProfile(); for(let i=0;i<4;i++)completeZone(p,i); return p; };
function victory(b:Battle) { do { b.start(); b.bossHp=0; b.tick(.05); } while(b.nextWave()); return b; }

test('D3 authored progression caps, recruited nine distinct from selected party', () => {
  const p=createProfile();
  assert.deepEqual(p.storyActive,[0,4,3]);
  assert.equal(storyPartyCap(p.cleared),3);
  for(const [chapter,cap] of [3,4,5,6].entries()) { completeZone(p,chapter); assert.equal(storyPartyCap(p.cleared),cap); }
  assert.equal(p.roster.length,9);
  assert.deepEqual(p.storyActive.slice(0,3),[0,4,3], 'recruitment never replaces a deployed hero');
  assert.equal(storyPartyCap([3]),3,'noncontiguous progress cannot unlock caps');
});

test('WP5 recruits fill the grown party, new recruits first, then benched heroes in roster order', () => {
  const p=createProfile();
  for(let i=0;i<4;i++) {
    const before=[...p.storyActive];completeZone(p,i);
    assert.equal(p.storyActive.length,storyPartyCap(p.cleared),`chapter ${i+1} fills the party`);
    assert.deepEqual(p.storyActive.slice(0,before.length),before,'deployed heroes stay deployed, in order');
    assert.equal(new Set(p.storyActive.map(id=>p.loadouts[id].slot)).size,p.storyActive.length,'deployed tiles are unique');
  }
  assert.deepEqual(p.storyActive,[0,4,3,7,1,6],'each new recruit takes a free slot before the bench');
  const small=progressed();setStoryParty(small,[0]);completeZone(small,4);
  assert.deepEqual(small.storyActive,[0,9,4,3,2,7],'the new recruit first, then benched heroes in roster order');
  const replay=structuredClone(small);assert.equal(completeZone(replay,4),false);assert.deepEqual(replay,small,'a replay changes nothing');
});

test('WP5 tiles follow roles: fragile recruits start at the back, warriors and monks at the front', () => {
  const p=createProfile();completeZone(p,0);
  assert.ok(p.loadouts[2].slot>=6,'Sable (rogue) never lands on claw tile 0');
  completeZone(p,1);completeZone(p,2);
  assert.ok(p.loadouts[1].slot<=2,'Bran (warrior) takes a front tile');
  assert.ok(p.loadouts[7].slot>=3,'Orin (wizard) stays off the front row');
  const q=progressed();setStoryParty(q,[0,4,3]);q.loadouts[6].slot=q.loadouts[0].slot;
  assert.ok(setStoryParty(q,[0,4,3,6]));assert.ok(q.loadouts[6].slot>=3,'a deployed rogue whose tile is taken moves to the back or middle');
  assert.equal(new Set(q.storyActive.map(id=>q.loadouts[id].slot)).size,4);
});

test('WP5 a saved formation survives normalization: deployed heroes keep their tiles even when a benched hero shares one', () => {
  const p=createProfile();for(let i=0;i<8;i++)completeZone(p,i);
  assert.ok(setStoryParty(p,[9,10,11]));
  const shared=p.roster.find(id=>!p.storyActive.includes(id)&&p.loadouts[id].slot===0)??2;p.loadouts[shared].slot=0;
  assert.ok(moveFormation(p,9,0));
  const tiles=p.storyActive.map(id=>p.loadouts[id].slot);
  const reloaded=normalizeProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(reloaded.loadouts[9].slot,0);
  assert.deepEqual(reloaded.storyActive.map(id=>reloaded.loadouts[id].slot),tiles,'every deployed hero keeps its tile');
  assert.equal(reloaded.loadouts[shared].slot,0,'a benched hero keeps its preferred tile, even a shared one');
  assert.deepEqual(normalizeProfile(reloaded),reloaded);
  const crowded=createProfile();for(let i=0;i<12;i++)completeZone(crowded,i);
  crowded.storyActive=crowded.roster.slice(-7);crowded.storyActive.forEach((id,i)=>{crowded.loadouts[id].slot=i;});
  const again=normalizeProfile(JSON.parse(JSON.stringify(crowded)));
  assert.deepEqual(again.storyActive.map(id=>again.loadouts[id].slot),[0,1,2,3,4,5,6]);
  const broken=JSON.parse(JSON.stringify(crowded));broken.loadouts[crowded.storyActive[1]].slot=0;broken.loadouts[crowded.storyActive[2]].slot='x';
  const fixed=normalizeProfile(broken);assert.equal(new Set(fixed.storyActive.map(id=>fixed.loadouts[id].slot)).size,7,'clashing or invalid deployed tiles are resolved');
  assert.equal(fixed.loadouts[crowded.storyActive[0]].slot,0,'the earlier deployed hero keeps the contested tile');
});

test('WP5 a benched hero picks a preferred tile without displacing anyone; deployed heroes still swap', () => {
  const p=createProfile();completeZone(p,0);completeZone(p,1);
  const deployedTiles=()=>p.storyActive.map(id=>p.loadouts[id].slot);
  assert.ok(!p.storyActive.includes(2),'Sable is benched');
  const aldric=p.loadouts[0].slot,before=deployedTiles();
  assert.ok(moveFormation(p,2,aldric));
  assert.equal(p.loadouts[2].slot,aldric);assert.equal(p.loadouts[0].slot,aldric,'Aldric keeps his tile');
  assert.deepEqual(deployedTiles(),before,'no deployed hero moves');assert.equal(new Set(before).size,before.length);
  const lyra=p.loadouts[4].slot;assert.ok(moveFormation(p,0,lyra));
  assert.equal(p.loadouts[0].slot,lyra);assert.equal(p.loadouts[4].slot,aldric,'deployed heroes swap tiles');
  assert.equal(new Set(deployedTiles()).size,p.storyActive.length);
});

test('WP5 a recruit the save predates joins at the saved heroes\' median level', () => {
  const p=createProfile();for(let i=0;i<5;i++)completeZone(p,i);
  p.roster.forEach((id,i)=>{p.loadouts[id].xp=xpForLevel(18+i%5);});
  const old=JSON.parse(JSON.stringify(p));old.cleared=[0,1,2,3,4,5,6,7];
  const levels=p.roster.map(id=>heroProgress(p.loadouts[id].xp).level).sort((a,b)=>a-b),median=levels[Math.floor(levels.length/2)];
  const q=normalizeProfile(old);
  for(const id of [10,11])assert.equal(heroProgress(q.loadouts[id].xp).level,median,`hero ${id}`);
  assert.equal(heroProgress(q.loadouts[0].xp).level,18,'saved heroes keep their own XP');
  assert.equal(heroProgress(normalizeProfile(createProfile()).loadouts[0].xp).level,1);
});

test('D3 party validation and swapping are atomic and retain every loadout', () => {
  const p=progressed(),loads=structuredClone(p.loadouts);
  for(const ids of [[],[0,0],[99],[0,4,3,2,7,1,5],[0,1.5]]) {
    const before=structuredClone(p); assert.equal(setStoryParty(p,ids),false); assert.deepEqual(p,before);
  }
  assert.equal(setStoryParty(createProfile(),[2]),false);
  const unique=()=>assert.equal(new Set(p.storyActive.map(id=>p.loadouts[id].slot)).size,p.storyActive.length,'deployed tiles stay unique');
  const kept=p.storyActive.filter(id=>[0,4,3,2,7,1].includes(id)).map(id=>[id,p.loadouts[id].slot]);
  assert.equal(setStoryParty(p,[0,4,3,2,7,1]),true);unique();
  for(const [id,slot] of kept)assert.equal(p.loadouts[id].slot,slot,'heroes already deployed keep their tiles');
  assert.equal(setStoryParty(p,[8,4,3,2,7,1]),true);unique();
  const builds=(l:typeof loads)=>Object.fromEntries(Object.entries(l).map(([id,{slot:_,...build}])=>[id,build]));
  assert.deepEqual(builds(p.loadouts),builds(loads),'swapping keeps every build');
  assert.equal(setStoryParty(p,[8]),true);
});

test('D3 save reload preserves selection and all recruited builds; old/malformed selections default safely', () => {
  const p=progressed();setStoryParty(p,[8,6,5,1,7,2]);
  const values=new Map<string,string>();const store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  saveProfile(store,p);const restored=loadSave(store);assert.equal(restored.readOnly,false);
  assert.deepEqual(restored.profile.storyActive,p.storyActive);assert.equal(Object.keys(restored.profile.loadouts).length,9);
  const old=JSON.parse(values.get(SAVE_KEY)!);delete old.storyActive;
  const clean=normalizeProfile(old);assert.deepEqual(clean.storyActive,clean.roster.slice(0,6));
  for(const value of [[],[99],null,[0,0,4,3,2,7,1,5]]) {
    const fixed=normalizeProfile({...old,storyActive:value});assert.ok(fixed.storyActive.length>=1&&fixed.storyActive.length<=6);
    assert.equal(new Set(fixed.storyActive).size,fixed.storyActive.length);assert.equal(fixed.roster.length,9);
  }
});

test('D3 Story constructor/reset/replay caps use progression, never requested chapter; other modes unchanged', () => {
  const p=progressed();setStoryParty(p,[8,6,5,1,7,2]);
  const b=new Battle('adventure',1,undefined,storyBattleOptions(p));assert.deepEqual(b.heroes.map(h=>h.id),p.storyActive);
  b.reset('adventure',16,undefined,{roster:p.roster});assert.equal(b.heroes.length,3);
  b.reset('adventure',1,undefined,{...storyBattleOptions(p),roster:p.roster});assert.equal(b.heroes.length,6);
  assert.equal(new Battle('raid',1,undefined,{roster:p.roster}).heroes.length,9);
  assert.equal(new Battle('endless',1,undefined,{roster:p.roster}).heroes.length,3,'D4 replaces the old Rogue roster');
});

test('D3 bench formula: half XP, underlevel bonus bounded by active median, no wrong-mode rewards', () => {
  assert.deepEqual(benchExperience('adventure',400,0,1000),{base:200,bonus:200,total:400});
  assert.deepEqual(benchExperience('adventure',400,900,1000),{base:200,bonus:0,total:200});
  assert.deepEqual(benchExperience('adventure',400,750,1000),{base:200,bonus:50,total:250});
  assert.deepEqual(benchExperience('adventure',400,1100,1000),{base:200,bonus:0,total:200});
  for(const mode of ['raid','endless'] as const)assert.equal(benchExperience(mode,400,0,1000),null);
});

test('D3 terminal settlement pays frozen bench once, excludes recruits, survives receipt reload', () => {
  const p=progressed();setStoryParty(p,[0,4,3,2,7,1]);
  for(const id of p.storyActive)p.loadouts[id].xp=1000;
  const options={...storyBattleOptions(p),settlementId:'d3-once'};
  const b= new Battle('adventure',1,undefined,options);
  assert.equal(settleProgress(p,b),null);
  b.start();b.bossHp=0;b.tick(.05);assert.equal(settleProgress(p,b),null);
  b.nextWave();victory(b);b.heroes[0].hp=0;
  const rewards=settleProgress(p,b)!;
  assert.equal(rewards.filter(r=>r.kind==='active').length,6);
  assert.equal(rewards.filter(r=>r.kind==='bench').length,3);
  assert.ok(rewards.filter(r=>r.kind==='bench').every(r=>r.xp>0));
  const snapshot=structuredClone(p);assert.equal(settleProgress(p,b),null);assert.deepEqual(p,snapshot);
  const reloaded=normalizeProfile(p);const before=structuredClone(reloaded);
  assert.equal(settleProgress(reloaded,victory(new Battle('adventure',1,undefined,options))),null);assert.deepEqual(reloaded,before);
  const fresh=createProfile(),first=new Battle('adventure',1,undefined,storyBattleOptions(fresh));
  victory(first);completeZone(fresh,0);const recruitXP=fresh.loadouts[2].xp;
  assert.equal(settleProgress(fresh,first)!.some(r=>r.id===2),false);assert.equal(fresh.loadouts[2].xp,recruitXP);
});

test('D3 non-Story settlement cannot pay bench even with Story snapshot options', () => {
  for(const mode of ['raid','endless'] as const) {
    const p=progressed();const b=victory(new Battle(mode,1,undefined,storyBattleOptions(p)));
    const bench=p.roster.filter(id=>!p.storyActive.includes(id));const xp=bench.map(id=>p.loadouts[id].xp);
    const rewards=settleProgress(p,b)!;assert.ok(rewards.every(r=>r.kind==='active'));
    assert.deepEqual(bench.map(id=>p.loadouts[id].xp),xp);
  }
});
