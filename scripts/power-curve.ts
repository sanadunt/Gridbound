// Prints the casual scripted player's party power at the start of each chapter (paste into RECOMMENDED_POWER in src/game/power.ts).
import { Battle } from '../src/game/simulation';
import { CAMPAIGN } from '../src/game/world';
import { createProfile,completeZone,profileModifiers,settleProgress,claimQuest } from '../src/game/profile';
import { storyBattleOptions } from '../src/game/story-party';
import { QUESTS } from '../src/game/quests';
import { partyPower } from '../src/game/power';
import { play,shop,POLICIES } from './balance';
const p=createProfile(),out:number[]=[];let seed=1;
for(let zone=0;zone<CAMPAIGN.length;zone++){
 shop(p);out.push(partyPower(p));
 for(let attempt=0;attempt<2;attempt++){
  const b=new Battle('adventure',zone+1,profileModifiers(p),storyBattleOptions(p));let won=true;
  for(let stage=0;stage<b.stageCount;stage++){const r=play(b,POLICIES.casual,seed++);if(r.status!=='victory'){won=false;break;}if(stage+1<b.stageCount)b.nextWave();}
  if(won){p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);settleProgress(p,b);break;}
 }
 for(const q of QUESTS)claimQuest(p,q.id,p.roster[zone%p.roster.length]);
}
console.log(JSON.stringify(out));
