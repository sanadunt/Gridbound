// Campaign balance harness: plays the whole story with scripted players of different skill and
// reports fight length and damage taken per stage. CI gate: the casual and expert players clear
// every chapter (casual may retry a chapter once), a novice clears at least 70% of chapters with one
// retry, and an idle player cannot coast past Act I: from a fresh profile, and on the casual player's chapter-start
// party it loses every Act I chapter (its result in every chapter is reported).
// Players spend like real ones: promotions first (the job skill is equipped as the stance), branches picked per run,
// one hero per class deployed before doubles, and a role formation (warriors and monks in front, so one of them takes the
// claw). In battle they drag a hero off a ground mark to the nearest free tile and walk it back once the mark has landed.
// Informational reports (artifacts/balance.json): break uptime, ultimates per minute, taps per second, dodges, minion hits,
// damage/healing per second of each job, the novice's per-chapter win rate, Undercroft wipe rate and guardian entry HP per
// depth, and Roguelike floors 1-9.
// Raids are built exactly like main.ts boot(): story loadouts, defaultRaidBuild and an authored contract;
// the expert must win every enemy at Bronze, every archetype at Silver and Gold, each certified pact combo,
// a six-hero party, and Bronze raids at the floors reached after chapters 2, 6 and 10.
import { Battle } from '../src/game/simulation';
import { CAMPAIGN,ENEMIES } from '../src/game/world';
import { createProfile,completeZone,profileModifiers,settleProgress,claimQuest,buyTalent,equipGear,equipSkill,promote,bankPouch,type Profile } from '../src/game/profile';
import { storyBattleOptions,storyPartyCap,setStoryParty,placeParty } from '../src/game/story-party';
import { QUESTS } from '../src/game/quests';
import { heroProgress } from '../src/game/levels';
import { JOBS } from '../src/game/jobs';
import { ROSTER,KITS } from '../src/game/content';
import { defaultRaidBuild } from '../src/game/raid-build';
import { DEPTHS,startRun,reachable,enterNode,dungeonBattleOptions,resolveFight,chooseEvent,choiceNeed,openTreasure,campChoice,DUNGEON_EVENTS,type DungeonRun } from '../src/game/dungeon';
import { createRogueBuild } from '../src/game/roguelike-build';
import { CERTIFIED_RAID_MODIFIER_COMBOS,getRaidContractForEnemy,type RaidModifierId,type RaidTier } from '../src/economy/challenge';
import { mkdirSync,writeFileSync } from 'node:fs';

export type Policy={name:string;every:number;tapShare:number;dodge:number;guard:number;react:number;potionAt:number};
export const POLICIES:Record<string,Policy>={
 expert:{name:'expert',every:.22,tapShare:1,dodge:1,guard:1,react:.8,potionAt:.35},
 casual:{name:'casual',every:.5,tapShare:.6,dodge:.65,guard:.7,react:.55,potionAt:.3},
 novice:{name:'novice',every:1.5,tapShare:.5,dodge:.3,guard:.3,react:.45,potionAt:.25},
 idle:{name:'idle',every:Infinity,tapShare:0,dodge:0,guard:0,react:0,potionAt:0},
};
/** Branch run seed of each scripted player (the novice plays on the casual player's profile). */
export const RUNS={expert:1,casual:2} as const;
// Seeded per attempt so a retry plays differently but runs stay reproducible.
export function rng(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export type Contribution=Record<string,{damage:number;healing:number;seconds:number}>;
const HOMES=new WeakMap<Battle,Map<number,number>>();
/** The free, unmarked tile a player drags a hero to: the nearest one, preferring the back rows (the claw hits the front). */
export function safeTile(b:Battle,from:number){
 const occupied=new Set(b.heroes.map(h=>h.slot)),dist=(i:number)=>Math.abs(Math.floor(i/3)-Math.floor(from/3))+Math.abs(i%3-from%3);
 return Array.from({length:9},(_,i)=>i).filter(i=>!occupied.has(i)&&!b.threats.some(t=>t.slots.includes(i))).sort((a,c)=>dist(a)-dist(c)||c-a)[0];
}
export function play(b:Battle,policy:Policy=POLICIES.expert,seed=1,cap=600){
 const roll=rng(seed),decided=new Map<number,boolean>(),contrib:Contribution={},key=(id:number)=>{const h=b.hero(id);return h?h.job??h.classId:'';};
 // Formation tiles are the ones the battle opened with (kept across the waves of a chapter).
 const home=HOMES.get(b)??new Map(b.heroes.map(h=>[h.id,h.slot]));HOMES.set(b,home);
 let input=0,cursor=0,breakS=0,ults=0,potions=0,minionHits=0,dodges=0;const taps=b.taps;
 // Healing is credited to the healer passed to heal(); restored on exit so the battle stays cloneable.
 const heal=b.heal;b.heal=(h,amount,source)=>{const before=h.hp;heal.call(b,h,amount,source);if(source){const c=contrib[key(source.id)]??={damage:0,healing:0,seconds:0};c.healing+=h.hp-before;}};
 b.start();
 while(b.status==='fighting'&&b.stageTime<cap){
  if(b.time>=input){input=b.time+policy.every;
   const alive=b.living();
   if(roll()<policy.tapShare){const next=alive[cursor++%alive.length];if(next)b.tap(next.id);}
   for(const t of b.threats){if(!decided.has(t.id))decided.set(t.id,roll()<(t.type==='all'?policy.guard:policy.dodge));}
   const ritual=b.threats.find(t=>t.type==='all'&&t.left<1.5&&decided.get(t.id));if(ritual)b.guard();
   if(b.resolve>=100&&b.ultimate())ults++;
   if(alive.some(h=>h.hp/h.maxHp<policy.potionAt)&&b.potion())potions++;
   for(const threat of b.threats.filter(t=>t.type!=='target'&&t.type!=='all'&&t.left<policy.react&&decided.get(t.id))){
    for(const h of alive.filter(h=>threat.slots.includes(h.slot))){const safe=safeTile(b,h.slot);if(safe!==undefined&&b.move(h.id,safe))dodges++;}
   }
   // Once no ground mark is live, a hero who stepped aside walks back to its formation tile (one per input).
   if(!b.threats.some(t=>t.type!=='target'&&t.type!=='all'&&t.type!=='channel')&&roll()<policy.dodge){const h=alive.find(h=>home.get(h.id)!==undefined&&h.slot!==home.get(h.id));if(h)b.move(h.id,home.get(h.id)!);}
  }
  b.tick(1/60);if(b.breakLeft>0)breakS+=1/60;
  for(const e of b.drain()){if(e.type==='minionAttack')minionHits++;else if(e.type==='projectile'&&(e.source??-1)>=0){const c=contrib[key(e.source!)]??={damage:0,healing:0,seconds:0};c.damage+=e.amount??0;}}
 }
 Reflect.deleteProperty(b,'heal');
 for(const h of b.heroes){const c=contrib[h.job??h.classId]??={damage:0,healing:0,seconds:0};c.seconds+=b.stageTime;}
 const max=b.heroes.reduce((s,h)=>s+h.maxHp,0),r1=(v:number)=>Math.round(v*10)/10;
 return {status:b.status,seconds:r1(b.stageTime),standing:b.living().length,party:b.heroes.length,hpPct:Math.round(b.living().reduce((s,h)=>s+h.hp,0)/max*100),taps:b.taps-taps,breakS:r1(breakS),ults,potions,minionHits,dodges,contrib};
}
export type Row=ReturnType<typeof play>;
/** Tier-2 branch (0 or 1) a run picks for a hero: a seeded mix per hero that flips between odd and even runs, so the expert
 *  (run 1) and casual (run 2) players together field both branches of every class. */
export const branchOf=(run:number,id:number)=>(run+(rng(id*104729+17)()<.5?0:1))%2;
/** One hero per class first (a healer and a warrior or monk always, then the other classes in a seeded order; of two heroes
 *  of a class the higher level, then the newer recruit), then the remaining heroes in recruit order, up to the party cap. */
export function coverageParty(p:Profile,run:number){
 const cap=storyPartyCap(p.cleared),level=(id:number)=>heroProgress(p.loadouts[id].xp).level,ranked=[...p.roster].reverse().sort((a,b)=>level(b)-level(a));
 const classes=[...new Set(ranked.map(id=>ROSTER[id].classId))],roll=rng(run*31+5);
 const tank=classes.find(c=>c==='warrior')??classes.find(c=>c==='monk'),rest=classes.filter(c=>c!=='healer'&&c!==tank).map(c=>({c,k:roll()})).sort((a,b)=>a.k-b.k).map(x=>x.c);
 const picks:number[]=[];
 for(const c of ['healer',tank,...rest]){const id=ranked.find(id=>ROSTER[id].classId===c);if(id!==undefined&&picks.length<cap)picks.push(id);}
 for(const id of p.roster)if(picks.length<cap&&!picks.includes(id))picks.push(id);
 return picks;
}
const HEALING=['heal','regen'];
// A player who spends what they earn: promotions as soon as they unlock (the new job skill becomes the stance), then
// talents and the cheapest useful gear; the deployed party is served first.
export function shop(p:Profile,run:number=RUNS.casual){
 const party=coverageParty(p,run),order=[...party,...p.roster.filter(id=>!party.includes(id))];
 for(const id of order){
  const base=ROSTER[id].classId,branches=Object.values(JOBS).filter(j=>j.base===base&&j.tier===2),j=branches[branchOf(run,id)%branches.length];
  if(j&&promote(p,id,j.id))equipSkill(p,id,0,j.index);
  const third=Object.values(JOBS).find(j=>j.parent===p.loadouts[id].job);if(third&&promote(p,id,third.id))equipSkill(p,id,0,third.index);
 }
 for(const talent of ['focus','vigor','mastery','momentum','fortitude','recovery','focus-2','mastery-2','vigor-2'])for(const id of order)buyTalent(p,id,talent);
 for(const gear of ['iron-edge','oak-plate','tempo-charm'])for(const id of order)equipGear(p,id,gear);
 // A job skill that does not heal (War Cantor, Bell Oracle) never takes the stance of the party's last healer: it moves to slot 2.
 const kind=(id:number,i:number)=>KITS[ROSTER[id].classId].skills[i].kind;
 if(!party.some(id=>HEALING.includes(kind(id,p.loadouts[id].skills[0])))){const healer=party.find(id=>p.loadouts[id].skills.some(i=>HEALING.includes(kind(id,i)))||ROSTER[id].classId==='healer');
  if(healer!==undefined){const l=p.loadouts[healer],job=l.skills[0],heal=l.skills.find(i=>HEALING.includes(kind(healer,i)))??0;equipSkill(p,healer,0,heal);if(job!==heal)equipSkill(p,healer,1,job);}}
 setStoryParty(p,party);
 // Role formation: warriors and monks hold the front row (the claw hits the lowest tile), healers then the others fill from the back.
 const role=(id:number)=>{const c=ROSTER[id].classId;return c==='warrior'||c==='monk'?0:c==='healer'?1:2;};
 for(const id of party)p.loadouts[id].slot=-1;placeParty(p.loadouts,[...party].sort((a,b)=>role(a)-role(b)));
}
// The shipped raid path (main.ts boot): floor = cleared chapters + 1, the whole roster's story loadouts, the default raid build.
export function raidBattle(p:Profile,enemyId:string,tier:RaidTier='bronze',modifiers:readonly RaidModifierId[]=[],size=3){
 return new Battle('raid',p.cleared.length+1,profileModifiers(p),{roster:[...p.roster],loadouts:structuredClone(p.loadouts),enemyId,raidContract:getRaidContractForEnemy(enemyId,tier,modifiers),raidBuild:defaultRaidBuild(p,size)});
}
export const RAID_ARCHETYPES=Object.values(ENEMIES).filter(e=>e.archetype===e.id).map(e=>e.id);
/** Play one chapter attempt; `heroic` replays it on Heroic. */
export function chapterAttempt(p:Profile,zone:number,policy:Policy,seed:number,heroic=false){
 const b=new Battle('adventure',zone+1,profileModifiers(p),{...storyBattleOptions(p),...(heroic?{heroic:true}:{})}),rows:Row[]=[];
 for(let stage=0;stage<b.stageCount;stage++){const r=play(b,policy,seed*100+stage);rows.push(r);if(r.status!=='victory')break;if(stage+1<b.stageCount)b.nextWave();}
 return {b,rows,won:rows.length===b.stageCount&&rows.at(-1)!.status==='victory'};
}
export function campaign(policy:Policy,retries=0,onClear?:(p:Profile)=>void,run:number=RUNS.casual,onStart?:(p:Profile,zone:number)=>void){
 const p=createProfile(),rows:(Row&{chapter:number;stage:number;attempt:number;kind:string})[]=[];let seed=1;
 for(let zone=0;zone<CAMPAIGN.length;zone++){
  shop(p,run);onStart?.(p,zone);
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
  onClear?.(p);
 }
 return {profile:p,rows,cleared:p.cleared.length};
}
/** Per-chapter numbers of a policy's rows: win share, end HP of the last stage, break uptime, ultimates per minute. */
export function chapterStats(rows:readonly (Row&{chapter:number})[]){
 return CAMPAIGN.map((_,i)=>{const r=rows.filter(x=>x.chapter===i+1),s=r.reduce((a,x)=>a+x.seconds,0)||1;
  return {chapter:i+1,seconds:Math.round(s),breakPct:Math.round(r.reduce((a,x)=>a+x.breakS,0)/s*100),ultsPerMin:+(r.reduce((a,x)=>a+x.ults,0)/s*60).toFixed(2),tapsPerSec:+(r.reduce((a,x)=>a+x.taps,0)/s).toFixed(2),dodges:r.reduce((a,x)=>a+x.dodges,0),minionHits:r.reduce((a,x)=>a+x.minionHits,0),potions:r.reduce((a,x)=>a+x.potions,0)};});
}
/** Damage and healing per second of each job (or basic class), summed over rows. */
export function jobRates(rows:readonly Row[]){
 const sum:Contribution={};for(const r of rows)for(const [k,c] of Object.entries(r.contrib)){const s=sum[k]??={damage:0,healing:0,seconds:0};s.damage+=c.damage;s.healing+=c.healing;s.seconds+=c.seconds;}
 return Object.fromEntries(Object.entries(sum).sort(([a],[b])=>a.localeCompare(b)).map(([k,s])=>[k,{dps:Math.round(s.damage/Math.max(1,s.seconds)),hps:Math.round(s.healing/Math.max(1,s.seconds)),seconds:Math.round(s.seconds)}]));
}
/** An idle player (no input at all: heroes only auto-cast) on a chapter-start profile. */
export const idleChapter=(p:Profile,zone:number)=>({chapter:zone+1,won:chapterAttempt(structuredClone(p),zone,POLICIES.idle,1).won});
/** The novice on a chapter-start profile: each attempt pair is one try with one retry. */
export const NOVICE_SEEDS=[11,23,37,51,67,79,83,97];
export function noviceChapter(p:Profile,zone:number,seeds=NOVICE_SEEDS){
 const wins=seeds.map(s=>chapterAttempt(structuredClone(p),zone,POLICIES.novice,s).won),pairs=Array.from({length:seeds.length>>1},(_,i)=>wins[2*i]||wins[2*i+1]);
 return {chapter:zone+1,winRate:wins.filter(Boolean).length/wins.length,clearRate:pairs.filter(Boolean).length/pairs.length};
}
// Undercroft runs: a careful route walks to the room with the fewest fights (battles over elites) and takes the healing event
// choices, a greedy one hunts elites, battles and the loot choices; both rest at the camp and never extract, so every run ends
// at the guardian or in a wipe.
const CAREFUL_CHOICES=['pray','buy','drink','muffle','silence','read'],GREEDY_CHOICES=['offering','search','guide','buy','ring','coin','burn','temper','answer','rock'];
export function dungeonRun(p:Profile,depth:number,seed:number,policy=POLICIES.casual,greedy=false){
 const q=structuredClone(p),run:DungeonRun=startRun(depth,seed,[...q.storyActive]);q.journey.run=run;const roll=rng(seed*13+depth);
 const ratios=(b:Battle)=>Object.fromEntries(b.heroes.map(h=>[h.id,h.hp/h.maxHp]));
 let guardianHp=-1,fights=0;
 const fight=()=>{const o=dungeonBattleOptions(q,run)!,kind=run.pendingFight!.kind;if(kind==='guardian')guardianHp=run.party.reduce((s,id)=>s+run.hp[id],0)/run.party.length;
  const b=new Battle('dungeon',o.dungeon!.chapter,profileModifiers(q),o);play(b,policy,seed*101+fights++);const won=b.status==='victory';if(won)settleProgress(q,b);resolveFight(run,won,ratios(b),b.potions);};
 while(run.status==='active'){
  if(run.pendingFight){fight();continue;}
  const next=reachable(run);if(!next.length)break;
  const rank=(id:number)=>(greedy?{elite:0,battle:1,treasure:2,event:3,camp:0,guardian:4}:{treasure:0,camp:0,event:1,battle:2,elite:3,guardian:4} as Record<string,number>)[run.nodes[id].kind]+roll()*.5;
  const node=enterNode(run,[...next].sort((a,b)=>rank(a)-rank(b))[0])!;
  if(node.kind==='treasure')openTreasure(run);
  else if(node.kind==='camp')campChoice(run,'rest');
  else if(node.kind==='event'){const choices=DUNGEON_EVENTS[node.event!].filter(c=>choiceNeed(run,node.event!,c)===undefined);chooseEvent(run,choices.find(c=>(greedy?GREEDY_CHOICES:CAREFUL_CHOICES).includes(c))??choices.at(-1)!);}
 }
 if(run.status==='cleared')bankPouch(q,run.pouch);
 return {depth,seed,greedy,status:run.status,guardianHp:guardianHp<0?undefined:Math.round(guardianHp*100),fights};
}
/** Roguelike floors 1-9 with the default recruits and no boons (rewarded floors are 3, 6 and 9). */
export function endlessFloors(policy=POLICIES.casual,floors=9){
 let build=createRogueBuild();const out:{floor:number;status:string;hpPct:number;seconds:number}[]=[];
 for(let floor=1;floor<=floors;floor++){const b=new Battle('endless',floor,undefined,{rogueBuild:structuredClone(build)});const r=play(b,policy,floor*7);out.push({floor,status:r.status,hpPct:r.hpPct,seconds:r.seconds});if(r.status!=='victory')break;build=b.rogueBuild!;}
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 // Mid-campaign raids: the expert's profile after chapters 2, 6 and 10 (after spending, as a player would) raids every archetype at Bronze.
 const midRaids:object[]=[];
 const expert=campaign(POLICIES.expert,0,snapshot=>{if(![2,6,10].includes(snapshot.cleared.length))return;const q=structuredClone(snapshot);shop(q,RUNS.expert);for(const enemyId of RAID_ARCHETYPES){const {contrib:_,...r}=play(raidBattle(q,enemyId),POLICIES.expert);midRaids.push({cleared:q.cleared.length,enemyId,tier:'bronze',...r});}},RUNS.expert);
 // The novice plays every chapter on the casual player's chapter-start profile; Undercroft depths use the profile right after their unlock chapter.
 const novice:ReturnType<typeof noviceChapter>[]=[],idleStarts:ReturnType<typeof idleChapter>[]=[],dungeon:ReturnType<typeof dungeonRun>[]=[];
 const casual=campaign(POLICIES.casual,1,snapshot=>{for(const d of DEPTHS)if(d.unlock===snapshot.cleared.length){const q=structuredClone(snapshot);shop(q,RUNS.casual);for(let seed=1;seed<=24;seed++)dungeon.push(dungeonRun(q,d.id,seed,POLICIES.casual,seed%2===0));}},RUNS.casual,(snapshot,zone)=>{novice.push(noviceChapter(snapshot,zone));idleStarts.push(idleChapter(snapshot,zone));});
 const idle=campaign(POLICIES.idle,0,undefined,RUNS.casual);
 const p=expert.profile;
 const raidRow=(profile:Profile,enemyId:string,tier:RaidTier='bronze',modifiers:readonly RaidModifierId[]=[],size=3,policy=POLICIES.expert)=>{const {contrib:_,...r}=play(raidBattle(profile,enemyId,tier,modifiers,size),policy);return {enemyId,tier,modifiers:[...modifiers],size,...r};};
 const expandedRaids=[
  ...Object.keys(ENEMIES).map(enemyId=>raidRow(p,enemyId)),
  ...(['silver','gold'] as const).flatMap(tier=>RAID_ARCHETYPES.map(enemyId=>raidRow(p,enemyId,tier))),
  ...CERTIFIED_RAID_MODIFIER_COMBOS.filter(combo=>combo.length).map((combo,i)=>raidRow(p,RAID_ARCHETYPES[(i*5)%RAID_ARCHETYPES.length],'gold',combo)),
  raidRow(p,'dragon','gold',[],6),
 ];
 // Informational: the casual player on its own profile, every enemy at Bronze.
 const casualRaids=Object.keys(ENEMIES).map(enemyId=>raidRow(casual.profile,enemyId,'bronze',[],3,POLICIES.casual));
 const casualRaidWinRate=Math.round(casualRaids.filter(r=>r.status==='victory').length/casualRaids.length*100);
 // Informational: how much each contract tier costs. The expert's median end HP and potions per tier, and the casual player's
 // Silver/Gold win rate and median end HP on its own end-of-campaign party (tiers should cost more as they pay more).
 const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]??0;};
 const raidTiers=(['bronze','silver','gold'] as const).map(tier=>{const rows=expandedRaids.filter(r=>r.tier===tier);return {tier,raids:rows.length,expertMedianHpPct:median(rows.map(r=>r.hpPct)),expertPotions:rows.reduce((a,r)=>a+r.potions,0)};});
 for(const row of raidTiers){if(row.tier==='bronze')continue;const rows=RAID_ARCHETYPES.map(enemyId=>raidRow(casual.profile,enemyId,row.tier,[],3,POLICIES.casual));Object.assign(row,{casualWinRate:Math.round(rows.filter(r=>r.status==='victory').length/rows.length*100),casualMedianHpPct:median(rows.map(r=>r.hpPct))});}
 // Informational: an idle player (no input) on the casual profile, every archetype at Bronze.
 const idleRaidWins=RAID_ARCHETYPES.map(enemyId=>raidRow(casual.profile,enemyId,'bronze',[],3,POLICIES.idle)).filter(r=>r.status==='victory').length;
 const raidOptions={roster:[0,4,3]},strip=({contrib:_,...r}:Row)=>r;
 const raid={idle:strip(play(new Battle('raid',1,undefined,raidOptions),POLICIES.idle)),active:strip(play(new Battle('raid',1,undefined,raidOptions)))};
 const summary=(rows:any[])=>({stages:rows.length,defeats:rows.filter(r=>r.status!=='victory').length,avgSeconds:Object.fromEntries(['wave','miniboss','boss'].map(k=>{const s=rows.filter(r=>r.kind===k&&r.status==='victory');return [k,Math.round(s.reduce((a,r)=>a+r.seconds,0)/Math.max(1,s.length))];})),avgHpPct:Math.round(rows.filter(r=>r.status==='victory').reduce((a,r)=>a+r.hpPct,0)/Math.max(1,rows.filter(r=>r.status==='victory').length))});
 // Casual end HP per chapter: the last stage of the attempt that cleared it.
 const endHp=CAMPAIGN.map((_,i)=>casual.rows.filter(r=>r.chapter===i+1&&r.status==='victory').at(-1)?.hpPct??0);
 const noviceClear=novice.reduce((a,n)=>a+n.clearRate,0)/novice.length;
 // Informational (not a gate yet): the largest drop in the novice's win rate from one chapter to the next.
 const noviceJump=Math.round(Math.max(0,...novice.slice(1).map((n,i)=>novice[i].winRate-n.winRate))*100);
 const depthReport=DEPTHS.map(d=>{const r=dungeon.filter(x=>x.depth===d.id),g=r.filter(x=>x.guardianHp!==undefined);return {depth:d.id,runs:r.length,wipeRate:Math.round(r.filter(x=>x.status==='wiped').length/Math.max(1,r.length)*100),guardianEntryHp:g.length?Math.round(g.reduce((a,x)=>a+x.guardianHp!,0)/g.length):undefined,cleared:r.filter(x=>x.status==='cleared').length};});
 const endless=endlessFloors();
 const per=(rows:any[])=>chapterStats(rows),jobs={expert:jobRates(expert.rows),casual:jobRates(casual.rows)};
 const deployed=(prof:Profile,run:number)=>coverageParty(prof,run).map(id=>prof.loadouts[id].job??ROSTER[id].classId);
 const result={chapters:CAMPAIGN.length,expert:{cleared:expert.cleared,...summary(expert.rows),chapters:per(expert.rows),rows:expert.rows.map(strip)},casual:{cleared:casual.cleared,...summary(casual.rows),endHp,chapters:per(casual.rows),rows:casual.rows.map(strip)},novice:{clearRate:Math.round(noviceClear*100),maxDrop:noviceJump,chapters:novice},idle:{cleared:idle.cleared,onCasualParty:idleStarts,rows:idle.rows.map(strip)},jobs,deployed:{expert:deployed(expert.profile,RUNS.expert),casual:deployed(casual.profile,RUNS.casual)},dungeon:{depths:depthReport,runs:dungeon},endless,raid,expandedRaids,raidTiers,midRaids,casualRaidWinRate,idleRaidWins,casualRaids,heroLevels:p.roster.map(id=>({id,...heroProgress(p.loadouts[id].xp)})),remainingGold:p.gold};
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/balance.json',JSON.stringify(result,null,2));
 const brief=(r:any)=>({cleared:r.cleared,stages:r.stages,defeats:r.defeats,avgSeconds:r.avgSeconds,avgHpPct:r.avgHpPct});
 const curve=CAMPAIGN.map((_,i)=>({ch:i+1,casualEndHp:endHp[i],noviceWin:Math.round(novice[i]?.winRate*100),expertBreak:result.expert.chapters[i].breakPct,casualBreak:result.casual.chapters[i].breakPct,expertUltsPerMin:result.expert.chapters[i].ultsPerMin,minionHits:result.casual.chapters[i].minionHits}));
 console.log(JSON.stringify({chapters:CAMPAIGN.length,expert:brief(result.expert),casual:brief(result.casual),noviceClearRate:result.novice.clearRate,noviceMaxDrop:noviceJump,idleCleared:idle.cleared,idleWinsOnCasualParty:idleStarts.filter(r=>r.won).map(r=>r.chapter),raid,expandedRaidWins:expandedRaids.filter(r=>r.status==='victory').length,raids:expandedRaids.length,raidTiers,midRaidWins:midRaids.filter((r:any)=>r.status==='victory').length,midRaids:midRaids.length,casualRaidWinRate,idleRaidWins,dungeon:depthReport,endless:endless.map(f=>`${f.floor}:${f.status==='victory'?f.hpPct+'%':'X'}`).join(' ')},null,1));
 console.table(curve);
 const failures=[expert.cleared<CAMPAIGN.length&&'expert player cannot clear the campaign',casual.cleared<CAMPAIGN.length&&'casual player cannot clear the campaign with one retry per chapter',idle.cleared>=4&&'idle player clears Act I without input',
  ...idleStarts.filter(r=>r.won&&r.chapter<=4).map(r=>`idle player wins chapter ${r.chapter} (Act I) on the casual player's party without input`),
  noviceClear<.7&&`novice player clears only ${Math.round(noviceClear*100)}% of chapters with one retry (needs 70%)`,
  ...expandedRaids.filter(r=>r.status!=='victory').map(r=>`expert player loses the ${r.tier} raid vs ${r.enemyId}${r.modifiers.length?` (${r.modifiers.join('+')})`:''} with ${r.size} heroes at floor ${p.cleared.length+1}`),
  ...midRaids.filter((r:any)=>r.status!=='victory').map((r:any)=>`expert player loses the bronze raid vs ${r.enemyId} after ${r.cleared} chapters`)].filter(Boolean);
 for(const f of failures)console.error('BALANCE FAIL:',f);
 if(failures.length)process.exitCode=1;
}
