// Fits CHAPTER_HP / CHAPTER_DMG so the balance harness's casual player sees ~TARGET_BOSS_S boss fights
// and ends each chapter with ~TARGET_END_HP% party HP. Prints tables to paste into simulation.ts.
import { Battle, CHAPTER_HP, CHAPTER_DMG } from '../src/game/simulation';
import { CAMPAIGN } from '../src/game/world';
import { createProfile,completeZone,profileModifiers,settleProgress,claimQuest,type Profile } from '../src/game/profile';
import { storyBattleOptions } from '../src/game/story-party';
import { QUESTS } from '../src/game/quests';
import { heroProgress } from '../src/game/levels';
import { play,shop,POLICIES } from './balance';
const TARGET_BOSS_S=Number(process.env.BOSS_S??85),TARGET_END_HP=Number(process.env.END_HP??40),SEEDS=[11,23,37,51];
function runChapter(p:Profile,zone:number,seed:number,policy=POLICIES.casual){
 const b=new Battle('adventure',zone+1,profileModifiers(p),storyBattleOptions(p));const rows=[];
 for(let stage=0;stage<b.stageCount;stage++){const r=play(b,policy,seed*100+stage);rows.push(r);if(r.status!=='victory')break;if(stage+1<b.stageCount)b.nextWave();}
 return {b,rows,won:rows.length===b.stageCount&&rows.at(-1)!.status==='victory'};
}
function measure(p:Profile,zone:number){
 let end=0,boss=0,wins=0;
 for(const seed of SEEDS){const {rows,won}=runChapter(structuredClone(p),zone,seed);if(won){wins++;end+=rows.at(-1)!.hpPct;boss+=rows.at(-1)!.seconds;}}
 return {wins,end:wins?end/wins:0,boss:wins?boss/wins:999};
}
const p=createProfile();const out:string[]=[];
for(let zone=0;zone<CAMPAIGN.length;zone++){
 shop(p);
 for(let round=0;round<3;round++){
  // Damage: bisect in log space; a defeat counts as -30% so the response is monotone.
  let lo=Math.log(.1),hi=Math.log(40);
  for(let i=0;i<14;i++){const mid=(lo+hi)/2;CHAPTER_DMG[zone]=Math.exp(mid);const m=measure(p,zone);const score=m.wins<SEEDS.length?-30:m.end;if(score>TARGET_END_HP)lo=mid;else hi=mid;}
  CHAPTER_DMG[zone]=Math.exp(lo);
  const m=measure(p,zone);if(m.wins)CHAPTER_HP[zone]*=Math.max(.6,Math.min(1.6,TARGET_BOSS_S/m.boss));
 }
 {let lo=Math.log(.1),hi=Math.log(40);for(let i=0;i<14;i++){const mid=(lo+hi)/2;CHAPTER_DMG[zone]=Math.exp(mid);const m=measure(p,zone);const score=m.wins<SEEDS.length?-30:m.end;if(score>TARGET_END_HP)lo=mid;else hi=mid;}CHAPTER_DMG[zone]=Math.exp(lo);}
 const m=measure(p,zone);
 const {b,won}=runChapter(p,zone,SEEDS[0]);
 out.push(`ch${zone+1} lv${heroProgress(p.loadouts[p.roster[0]].xp).level} party${b.heroes.length} hp${CHAPTER_HP[zone].toFixed(2)} dmg${CHAPTER_DMG[zone].toFixed(2)} wins${m.wins}/${SEEDS.length} end${m.end.toFixed(0)}% boss${m.boss.toFixed(0)}s`);
 console.log(out.at(-1));
 if(!won){console.log('casual seed 1 lost; advancing anyway');}
 p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);if(won)settleProgress(p,b);
 for(const q of QUESTS)claimQuest(p,q.id,p.roster[zone%p.roster.length]);
}
console.log('CHAPTER_HP=['+CHAPTER_HP.map(v=>+v.toFixed(2)).join(',')+']');
console.log('CHAPTER_DMG=['+CHAPTER_DMG.map(v=>+v.toFixed(2)).join(',')+']');
