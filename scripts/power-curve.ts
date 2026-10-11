// Prints the casual scripted player's party power at the start of each chapter (paste into RECOMMENDED_POWER in
// src/game/power.ts; it never falls: a chapter's recommendation is at least the one before, since the scripted party may swap
// a hero for a weaker one of a newly recruited class), then a Heroic run: after each first clear the casual player tries that chapter on Heroic and, while it
// wins fewer than half its attempts, grinds (one level for every hero and some gold, as Undercroft runs give). The power it
// needed over the Normal recommendation gives HEROIC_POWER_FACTOR (src/game/power.ts). The levels it needed per act are what
// HEROIC_ACT (src/game/simulation.ts) is tuned by: Act IV should open a few levels after its first clear, as Acts II-III do.
// HEROIC=0 skips the Heroic run.
import { CAMPAIGN } from '../src/game/world';
import { completeZone,settleProgress,claimQuest,createProfile,type Profile } from '../src/game/profile';
import { QUESTS } from '../src/game/quests';
import { heroProgress,xpForLevel } from '../src/game/levels';
import { storyBattleOptions } from '../src/game/story-party';
import { partyPower } from '../src/game/power';
import { chapterAttempt,shop,POLICIES,RUNS } from './balance';
const SEEDS=[11,23,37,51],median=(p:Profile)=>{const l=storyBattleOptions(p).roster!.map(id=>heroProgress(p.loadouts[id].xp).level).sort((a,b)=>a-b);return l[l.length>>1];};
const p=createProfile(),out:number[]=[],cleared:Profile[]=[];let seed=1;
for(let zone=0;zone<CAMPAIGN.length;zone++){
 shop(p,RUNS.casual);out.push(Math.max(partyPower(p),out.at(-1)??0));
 for(let attempt=0;attempt<2;attempt++){
  const {b,won}=chapterAttempt(p,zone,POLICIES.casual,seed++);
  if(won){p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);settleProgress(p,b);break;}
 }
 if(!p.cleared.includes(zone))throw new Error(`casual player cannot clear chapter ${zone+1}`);
 for(const q of QUESTS)claimQuest(p,q.id,p.roster[zone%p.roster.length]);
 cleared.push(structuredClone(p));
}
console.log('RECOMMENDED_POWER='+JSON.stringify(out));
if(process.env.HEROIC!=='0'){
 const factors:number[]=[];
 for(let zone=0;zone<CAMPAIGN.length;zone++){
  const q=structuredClone(cleared[zone]);shop(q,RUNS.casual);const start=median(q);let steps=0,wins=0;
  for(;steps<=24;steps++){
   wins=SEEDS.filter(s=>chapterAttempt(structuredClone(q),zone,POLICIES.casual,s,true).won).length;
   if(wins*2>=SEEDS.length)break;
   const gain=xpForLevel(median(q)+1)-xpForLevel(median(q));for(const id of q.roster)q.loadouts[id].xp=(q.loadouts[id].xp??0)+gain;q.gold+=150;shop(q,RUNS.casual);
  }
  const power=partyPower(q),factor=power/out[zone];factors.push(factor);
  console.log(`heroic ch${zone+1}: first clear lv${start} -> wins ${wins}/${SEEDS.length} at lv${median(q)} (+${steps} levels), power ${power} = ${factor.toFixed(2)} x recommended ${out[zone]}`);
 }
 const sorted=[...factors].sort((a,b)=>a-b);
 console.log(`HEROIC_POWER_FACTOR (median) = ${sorted[sorted.length>>1].toFixed(2)}`);
}
