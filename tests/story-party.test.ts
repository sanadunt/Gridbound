import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, completeZone, normalizeProfile, settleProgress } from '../src/game/profile';
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
  assert.deepEqual(p.storyActive,[0,4,3], 'recruitment never silently replaces or activates heroes');
  assert.equal(storyPartyCap([3]),3,'noncontiguous progress cannot unlock caps');
});

test('D3 party validation and swapping are atomic and retain every loadout', () => {
  const p=progressed(),loads=structuredClone(p.loadouts);
  for(const ids of [[],[0,0],[99],[0,4,3,2,7,1,5],[0,1.5]]) {
    const before=structuredClone(p); assert.equal(setStoryParty(p,ids),false); assert.deepEqual(p,before);
  }
  assert.equal(setStoryParty(createProfile(),[2]),false);
  assert.equal(setStoryParty(p,[0,4,3,2,7,1]),true);
  assert.equal(setStoryParty(p,[8,4,3,2,7,1]),true);
  assert.deepEqual(p.loadouts,loads);
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
