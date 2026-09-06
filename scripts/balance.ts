import { Battle } from '../src/game/simulation';
import { CAMPAIGN } from '../src/game/world';
import { createProfile,completeZone,profileModifiers,buyTalent,equipGear,promote,equipSkill } from '../src/game/profile';
import { JOBS } from '../src/game/jobs';
import { ROSTER } from '../src/game/content';
import { mkdirSync,writeFileSync } from 'node:fs';
export function play(b:Battle,active=true,cap=600){
 b.start();let input=0,cursor=0;
 while(b.status==='fighting'&&b.stageTime<cap){
  if(active&&b.time>=input){input=b.time+.22;
   const alive=b.living(),next=alive[cursor++%alive.length];if(next)b.tap(next.id);
   const ritual=b.threats.find(t=>t.type==='all'&&t.left<1.5);if(ritual)b.guard();
   if(b.resolve>=100)b.ultimate();
   if(alive.some(h=>h.hp/h.maxHp<.35))b.potion();
   for(const threat of b.threats.filter(t=>t.type!=='target'&&t.type!=='all'&&t.left<.8)){
    for(const h of alive.filter(h=>threat.slots.includes(h.slot))){const occupied=new Set(b.heroes.map(h=>h.slot));const safe=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i)&&!b.threats.some(t=>t.slots.includes(i)));if(safe!==undefined)b.move(h.id,safe);}
   }
  }
  b.tick(1/60);b.drain();
 }
 return {status:b.status,seconds:Math.round(b.stageTime*10)/10,standing:b.living().length,hp:Math.round(b.living().reduce((s,h)=>s+h.hp,0)),taps:b.taps};
}
const p=createProfile(),rows:object[]=[];
for(let zone=0;zone<CAMPAIGN.length;zone++){
 for(const talent of ['focus','vigor','mastery','focus-2','momentum','fortitude','recovery','mastery-2'])for(const id of p.roster)buyTalent(p,id,talent);
 for(const gear of ['iron-edge','oak-plate','tempo-charm'])for(const id of p.roster)equipGear(p,id,gear);
 for(const id of p.roster){const base=ROSTER[id].classId,j=Object.values(JOBS).find(j=>j.base===base&&j.tier===2);if(j)promote(p,id,j.id);const third=Object.values(JOBS).find(j=>j.parent===p.loadouts[id].job);if(third)promote(p,id,third.id);}
 const b=new Battle('adventure',zone+1,profileModifiers(p),{roster:p.roster,loadouts:p.loadouts});
 let victory=true;
 for(let stage=0;stage<b.stageCount;stage++){
  const result=play(b);rows.push({chapter:zone+1,stage:stage+1,...result});if(result.status!=='victory'){victory=false;break;}if(stage+1<b.stageCount)b.nextWave();
 }
 if(!victory)break;p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);
}
const raidOptions={roster:[0,4,3]};
const idle=play(new Battle('raid',1,undefined,raidOptions),false),active=play(new Battle('raid',1,undefined,raidOptions));
const result={cleared:p.cleared.length,chapters:CAMPAIGN.length,stageResults:rows,raid:{idle,active},earnedBuild:p.loadouts,remainingGold:p.gold};
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/balance.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({cleared:result.cleared,chapters:result.chapters,stages:rows.length,last:rows.at(-1),raid:result.raid,gold:p.gold}));
if(p.cleared.length!==CAMPAIGN.length)process.exitCode=1;
