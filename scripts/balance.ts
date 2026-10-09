// Campaign balance harness: plays the whole story with scripted players of different skill and
// reports fight length and damage taken per stage. CI gate: the casual and expert players clear
// every chapter (casual may retry a chapter once), and an idle player cannot coast past Act I.
import { Battle } from '../src/game/simulation';
import { CAMPAIGN,ENEMIES } from '../src/game/world';
import { createProfile,completeZone,profileModifiers,settleProgress,claimQuest,buyTalent,equipGear,promote,type Profile } from '../src/game/profile';
import { storyBattleOptions,storyPartyCap,setStoryParty } from '../src/game/story-party';
import { QUESTS } from '../src/game/quests';
import { heroProgress } from '../src/game/levels';
import { JOBS } from '../src/game/jobs';
import { ROSTER } from '../src/game/content';
import { mkdirSync,writeFileSync } from 'node:fs';

export type Policy={name:string;every:number;tapShare:number;dodge:number;guard:number;react:number;potionAt:number};
export const POLICIES:Record<string,Policy>={
 expert:{name:'expert',every:.22,tapShare:1,dodge:1,guard:1,react:.8,potionAt:.35},
 casual:{name:'casual',every:.5,tapShare:.6,dodge:.65,guard:.7,react:.55,potionAt:.3},
 idle:{name:'idle',every:Infinity,tapShare:0,dodge:0,guard:0,react:0,potionAt:0},
};
// Seeded per attempt so a retry plays differently but runs stay reproducible.
function rng(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function play(b:Battle,policy:Policy=POLICIES.expert,seed=1,cap=600){
 const roll=rng(seed),decided=new Map<number,boolean>();let input=0,cursor=0;
 b.start();
 while(b.status==='fighting'&&b.stageTime<cap){
  if(b.time>=input){input=b.time+policy.every;
   const alive=b.living();
   if(roll()<policy.tapShare){const next=alive[cursor++%alive.length];if(next)b.tap(next.id);}
   for(const t of b.threats){if(!decided.has(t.id))decided.set(t.id,roll()<(t.type==='all'?policy.guard:policy.dodge));}
   const ritual=b.threats.find(t=>t.type==='all'&&t.left<1.5&&decided.get(t.id));if(ritual)b.guard();
   if(b.resolve>=100)b.ultimate();
   if(alive.some(h=>h.hp/h.maxHp<policy.potionAt))b.potion();
   for(const threat of b.threats.filter(t=>t.type!=='target'&&t.type!=='all'&&t.left<policy.react&&decided.get(t.id))){
    for(const h of alive.filter(h=>threat.slots.includes(h.slot))){const occupied=new Set(b.heroes.map(h=>h.slot));const safe=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i)&&!b.threats.some(t=>t.slots.includes(i)));if(safe!==undefined)b.move(h.id,safe);}
   }
  }
  b.tick(1/60);b.drain();
 }
 const max=b.heroes.reduce((s,h)=>s+h.maxHp,0);
 return {status:b.status,seconds:Math.round(b.stageTime*10)/10,standing:b.living().length,party:b.heroes.length,hpPct:Math.round(b.living().reduce((s,h)=>s+h.hp,0)/max*100),taps:b.taps};
}
// A player who spends what they earn: talents, the cheapest useful gear, promotions when affordable.
export function shop(p:Profile){
 for(const talent of ['focus','vigor','mastery','momentum','fortitude','recovery','focus-2','mastery-2','vigor-2'])for(const id of p.roster)buyTalent(p,id,talent);
 for(const gear of ['iron-edge','oak-plate','tempo-charm'])for(const id of p.roster)equipGear(p,id,gear);
 for(const id of p.roster){const base=ROSTER[id].classId,j=Object.values(JOBS).find(j=>j.base===base&&j.tier===2);if(j)promote(p,id,j.id);const third=Object.values(JOBS).find(j=>j.parent===p.loadouts[id].job);if(third)promote(p,id,third.id);}
 setStoryParty(p,p.roster.slice(0,storyPartyCap(p.cleared)));
}
export function campaign(policy:Policy,retries=0){
 const p=createProfile(),rows:object[]=[];let seed=1;
 for(let zone=0;zone<CAMPAIGN.length;zone++){
  shop(p);
  let cleared=false;
  for(let attempt=0;attempt<=retries&&!cleared;attempt++){
   const b=new Battle('adventure',zone+1,profileModifiers(p),storyBattleOptions(p));cleared=true;
   for(let stage=0;stage<b.stageCount;stage++){
    const result=play(b,policy,seed++);rows.push({chapter:zone+1,stage:stage+1,attempt,kind:CAMPAIGN[zone].stages[stage].kind,...result});
    if(result.status!=='victory'){cleared=false;break;}if(stage+1<b.stageCount)b.nextWave();
   }
   if(cleared){p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);settleProgress(p,b);}
  }
  if(!cleared)break;
  for(const q of QUESTS)claimQuest(p,q.id,p.roster[zone%p.roster.length]);
 }
 return {profile:p,rows,cleared:p.cleared.length};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const expert=campaign(POLICIES.expert),casual=campaign(POLICIES.casual,1),idle=campaign(POLICIES.idle);
 const p=expert.profile;
 const expandedRaids=Object.keys(ENEMIES).map(enemyId=>({enemyId,...play(new Battle('raid',p.cleared.length+1,profileModifiers(p),{roster:p.storyActive,loadouts:p.loadouts,enemyId}),POLICIES.expert)}));
 const raidOptions={roster:[0,4,3]};
 const raid={idle:play(new Battle('raid',1,undefined,raidOptions),POLICIES.idle),active:play(new Battle('raid',1,undefined,raidOptions))};
 const summary=(rows:any[])=>({stages:rows.length,defeats:rows.filter(r=>r.status!=='victory').length,avgSeconds:Object.fromEntries(['wave','miniboss','boss'].map(k=>{const s=rows.filter(r=>r.kind===k&&r.status==='victory');return [k,Math.round(s.reduce((a,r)=>a+r.seconds,0)/Math.max(1,s.length))];})),avgHpPct:Math.round(rows.filter(r=>r.status==='victory').reduce((a,r)=>a+r.hpPct,0)/Math.max(1,rows.filter(r=>r.status==='victory').length))});
 const result={chapters:CAMPAIGN.length,expert:{cleared:expert.cleared,...summary(expert.rows),rows:expert.rows},casual:{cleared:casual.cleared,...summary(casual.rows),rows:casual.rows},idle:{cleared:idle.cleared,rows:idle.rows},raid,expandedRaids,heroLevels:p.roster.map(id=>({id,...heroProgress(p.loadouts[id].xp)})),remainingGold:p.gold};
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/balance.json',JSON.stringify(result,null,2));
 const brief=(r:any)=>({cleared:r.cleared,stages:r.stages,defeats:r.defeats,avgSeconds:r.avgSeconds,avgHpPct:r.avgHpPct});
 console.log(JSON.stringify({chapters:CAMPAIGN.length,expert:brief(result.expert),casual:brief(result.casual),idleCleared:idle.cleared,raid,expandedRaidWins:expandedRaids.filter(r=>r.status==='victory').length,raids:expandedRaids.length},null,1));
 const failures=[expert.cleared<CAMPAIGN.length&&'expert player cannot clear the campaign',casual.cleared<CAMPAIGN.length&&'casual player cannot clear the campaign with one retry per chapter',idle.cleared>=4&&'idle player clears Act I without input',expandedRaids.some(r=>r.status!=='victory')&&'expert player loses a raid'].filter(Boolean);
 for(const f of failures)console.error('BALANCE FAIL:',f);
 if(failures.length)process.exitCode=1;
}
