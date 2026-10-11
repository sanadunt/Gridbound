// Fits CHAPTER_HP / CHAPTER_DMG to the balance harness's players and prints tables to paste into simulation.ts.
// 1. Profiles: the casual player's chapter-start profile for both branch mixes the CI players field (RUNS), so the tables hold
//    for either. Enemies are harmless while they are built, so the profiles do not depend on the tables.
// 2. Per chapter, two rounds of: HP so the casual player's boss fight lasts ~BOSS_S seconds (chapter 1 is pinned at CH1_HP so
//    the first boss is no wall); the casual cap (the largest damage at which the casual player loses at most one of its runs on
//    both mixes and its median run ends with at least CASUAL_END% party HP, divided by MARGIN); the idle floor (the least
//    damage at which an idle player, no input at all, loses the chapter on both mixes; CI gates it for Act I); the novice
//    curve (its win rate on a grid of damage values, made monotone). The novice target rises from NOVICE_START at chapter 1 to NOVICE_END at
//    chapter 16, so its win rate never falls as the story goes on.
// 3. Smoothing. HP: the boss never has less HP than the previous chapter's, and inside an act the multiplier moves at most STEP
//    per chapter (each act restarts the stage HP base, so the multiplier itself jumps there). Chapters whose HP moved refit their
//    damage. Damage: never above the casual cap, below the idle floor only at a heavy cost (a chapter an idle player wins even
//    at the cap keeps no floor) and, from chapter 6 on, within STEP of the previous chapter up or down (chapters 2-5 may rise
//    further, see 3b); within that, a dynamic program picks the table whose novice win rates (read off each chapter's curve)
//    are closest to their targets.
// 4. The result is measured again. VERIFY=1 only measures the current tables.
import { CHAPTER_HP, CHAPTER_DMG } from '../src/game/simulation';
import { CAMPAIGN } from '../src/game/world';
import { createProfile,completeZone,settleProgress,claimQuest,type Profile } from '../src/game/profile';
import { QUESTS } from '../src/game/quests';
import { heroProgress } from '../src/game/levels';
import { storyBattleOptions } from '../src/game/story-party';
import { chapterAttempt,campaign,dungeonRun,shop,POLICIES,RUNS } from './balance';
import { DEPTHS,DEPTH_DMG } from '../src/game/dungeon';
const env=(k:string,v:number)=>Number(process.env[k]??v);
const BOSS_S=env('BOSS_S',75),CASUAL_END=env('CASUAL_END',50),MARGIN=env('MARGIN',1.05),CH1_HP=env('CH1_HP',2.2),STEP=1.2;
const NOVICE_START=env('NOVICE_START',.5),NOVICE_END=env('NOVICE_END',.6),WALL=3,ACT1_FREE=4,ACT1_RISE=1.8,IDLE_COST=10;
const CASUAL_SEEDS=[11,23,37,51,67,79],NOVICE_SEEDS=[11,23,37,51,67,79,83,97,101,113,127,139],N=CAMPAIGN.length;
const target=(zone:number)=>NOVICE_START+(NOVICE_END-NOVICE_START)*zone/(N-1);
const bossBase=(zone:number)=>CAMPAIGN[zone].stages.at(-1)!.hp;
const act=(zone:number)=>Math.floor(zone/4);
// Undercroft (DUNGEON=1): DEPTH_DMG so the casual player, right after each depth's unlock chapter (a real campaign with the
// current tables), wipes in about DUNGEON_WIPE of its runs (careful and greedy routes), then made non-decreasing with depth
// (pool adjacent violators in log space). Prints the table to paste into src/game/dungeon.ts.
if(process.env.DUNGEON){
 const WIPE=env('DUNGEON_WIPE',.2),SEEDS=Array.from({length:24},(_,i)=>i+1),snaps:Record<number,Profile>={};
 campaign(POLICIES.casual,1,p=>{for(const d of DEPTHS)if(d.unlock===p.cleared.length){const q=structuredClone(p);shop(q,RUNS.casual);snaps[d.id]=q;}},RUNS.casual);
 const measure=(d:number)=>{const r=SEEDS.map(s=>dungeonRun(snaps[d],d,s,POLICIES.casual,s%2===0)),g=r.filter(x=>x.guardianHp!==undefined);
  return {wipe:r.filter(x=>x.status==='wiped').length/r.length,entry:g.length?Math.round(g.reduce((a,x)=>a+x.guardianHp!,0)/g.length):undefined};};
 const fit=DEPTHS.map(d=>{const old=DEPTH_DMG[d.id-1],xs=Array.from({length:13},(_,i)=>Math.log(old)+Math.log(2)*(i-6)/6);
  const ys=xs.map(x=>{DEPTH_DMG[d.id-1]=Math.exp(x);return 1-measure(d.id).wipe;});DEPTH_DMG[d.id-1]=old;
  return cross(monotone(xs.map((x,i)=>[x,ys[i]] as [number,number])),1-WIPE);});
 // Least-squares non-decreasing fit of the per-depth values.
 const blocks:{v:number;n:number}[]=[];for(const y of fit){blocks.push({v:y,n:1});while(blocks.length>1&&blocks.at(-2)!.v>blocks.at(-1)!.v){const b=blocks.pop()!,a=blocks.pop()!;blocks.push({v:(a.v*a.n+b.v*b.n)/(a.n+b.n),n:a.n+b.n});}}
 blocks.flatMap(b=>Array(b.n).fill(b.v) as number[]).forEach((x,i)=>DEPTH_DMG[i]=+Math.exp(x).toFixed(1));
 for(const d of DEPTHS){const m=measure(d.id);console.log(`depth ${d.id} (after chapter ${d.unlock}): fit ${Math.exp(fit[d.id-1]).toFixed(2)} -> ${DEPTH_DMG[d.id-1]} wipe ${Math.round(m.wipe*100)}% guardian entry ${m.entry??'-'}%`);}
 console.log('DEPTH_DMG=['+DEPTH_DMG.join(', ')+']');process.exit(0);
}
// 1. Profiles.
const COMPS=[RUNS.casual,RUNS.expert],saved=[...CHAPTER_DMG],profiles:Profile[][]=COMPS.map(()=>[]);
for(const [c,run] of COMPS.entries()){const p=createProfile();
 for(let zone=0;zone<N;zone++){
  shop(p,run);profiles[c].push(structuredClone(p));CHAPTER_DMG[zone]=.01;
  const {b,won}=chapterAttempt(p,zone,POLICIES.casual,1);if(!won)throw new Error(`casual player cannot beat chapter ${zone+1} even unharmed`);
  p.gold+=b.gold+CAMPAIGN[zone].reward;completeZone(p,zone);settleProgress(p,b);
  for(const q of QUESTS)claimQuest(p,q.id,p.roster[zone%p.roster.length]);
 }}
CHAPTER_DMG.splice(0,N,...saved);
// The casual player's margin: it loses at most one of its runs (it may retry a chapter in CI) and its median run ends with at
// least CASUAL_END% party HP.
function casual(zone:number){
 const ends:number[]=[];let boss=0;
 for(const comp of profiles)for(const seed of CASUAL_SEEDS){const {rows,won}=chapterAttempt(structuredClone(comp[zone]),zone,POLICIES.casual,seed);ends.push(won?rows.at(-1)!.hpPct:-1);if(won)boss+=rows.at(-1)!.seconds;}
 const wins=ends.filter(e=>e>=0).length,median=[...ends].sort((a,b)=>a-b)[ends.length>>1];
 return {ok:wins>=ends.length-1&&median>=CASUAL_END,wins,end:median,boss:wins?boss/wins:999};
}
const novice=(zone:number)=>NOVICE_SEEDS.filter((seed,i)=>chapterAttempt(structuredClone(profiles[i%COMPS.length][zone]),zone,POLICIES.novice,seed).won).length/NOVICE_SEEDS.length;
const at=(zone:number,dmg:number,f:()=>number)=>{const old=CHAPTER_DMG[zone];CHAPTER_DMG[zone]=dmg;const v=f();CHAPTER_DMG[zone]=old;return v;};
// Largest damage (log bisection) at which the casual player still keeps its margin.
function casualCap(zone:number){let lo=Math.log(.2),hi=Math.log(60);for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(at(zone,Math.exp(mid),()=>+casual(zone).ok))lo=mid;else hi=mid;}return Math.exp(lo)/MARGIN;}
// Least damage (log bisection up to the casual cap) at which an idle player loses the chapter on both mixes; 0 when it wins
// even at the cap.
const idleWins=(zone:number)=>profiles.some(c=>chapterAttempt(structuredClone(c[zone]),zone,POLICIES.idle,1).won);
function idleFloor(zone:number,cap:number){if(at(zone,cap,()=>+idleWins(zone)))return 0;let lo=Math.log(.2),hi=Math.log(cap);for(let i=0;i<10;i++){const mid=(lo+hi)/2;if(at(zone,Math.exp(mid),()=>+idleWins(zone)))lo=mid;else hi=mid;}return Math.exp(hi);}
// The novice's win rate on a log grid around `center` (15 points from /3 to ×3), then 11 more points within ±15% of where it
// crosses the chapter's target (its win rate turns from won to lost within a few percent of damage), made non-increasing in
// damage (pool adjacent violators); `rate` reads it at any damage (log interpolation, flat beyond the grid).
type Curve={xs:number[];ys:number[]};
function monotone(points:[number,number][]):Curve{
 points.sort((a,b)=>a[0]-b[0]);const blocks:{v:number;n:number}[]=[];
 for(const [,y] of points){blocks.push({v:y,n:1});while(blocks.length>1&&blocks.at(-2)!.v<blocks.at(-1)!.v){const b=blocks.pop()!,a=blocks.pop()!;blocks.push({v:(a.v*a.n+b.v*b.n)/(a.n+b.n),n:a.n+b.n});}}
 return {xs:points.map(p=>p[0]),ys:blocks.flatMap(b=>Array(b.n).fill(b.v) as number[])};
}
function noviceCurve(zone:number,center:number):Curve{
 const sample=(x:number):[number,number]=>[x,at(zone,Math.exp(x),()=>novice(zone))];
 const coarse=Array.from({length:15},(_,i)=>sample(Math.log(center)+Math.log(3)*(i-7)/7)),mid=cross(monotone([...coarse]),target(zone));
 return monotone([...coarse,...Array.from({length:11},(_,i)=>sample(mid+Math.log(1.15)*(i-5)/5))]);
}
function rate(c:Curve,x:number){if(x<=c.xs[0])return c.ys[0];for(let i=1;i<c.xs.length;i++)if(x<=c.xs[i]){const t=(x-c.xs[i-1])/(c.xs[i]-c.xs[i-1]);return c.ys[i-1]+t*(c.ys[i]-c.ys[i-1]);}return c.ys.at(-1)!;}
// Damage (log) at which the curve falls to win rate w.
function cross(c:Curve,w:number){let lo=c.xs[0],hi=c.xs.at(-1)!;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(rate(c,mid)>w)lo=mid;else hi=mid;}return (lo+hi)/2;}
type Fit={cap:number;idle:number;curve:Curve};
function fitDamage(zone:number):Fit{const cap=casualCap(zone),idle=idleFloor(zone,cap),curve=noviceCurve(zone,Math.min(cap,CHAPTER_DMG[zone]));CHAPTER_DMG[zone]=Math.min(cap,Math.max(idle,Math.exp(cross(curve,target(zone)))));return {cap,idle,curve};}
const fitHp=(zone:number)=>{if(zone===0){CHAPTER_HP[0]=CH1_HP;return;}const c=casual(zone);if(c.wins)CHAPTER_HP[zone]*=Math.max(.6,Math.min(1.6,BOSS_S/c.boss));};
function report(label:string){
 console.log(label);
 for(let zone=0;zone<N;zone++){const c=casual(zone),n=novice(zone),p=profiles[0][zone],roster=storyBattleOptions(p).roster!;
  const levels=roster.map(id=>heroProgress(p.loadouts[id].xp).level).sort((a,b)=>a-b);
  console.log(`ch${zone+1} lv${levels[levels.length>>1]} party${roster.length} hp${CHAPTER_HP[zone].toFixed(2)} (boss ${Math.round(bossBase(zone)*CHAPTER_HP[zone])}) dmg${CHAPTER_DMG[zone].toFixed(2)} novice${Math.round(n*100)}% (target ${Math.round(target(zone)*100)}%) casual${c.wins}/${CASUAL_SEEDS.length*COMPS.length} median end${c.end}% boss${c.boss.toFixed(0)}s idle ${idleWins(zone)?'WINS':'loses'}`);}
 console.log('CHAPTER_HP=['+CHAPTER_HP.map(v=>+v.toFixed(2)).join(',')+']');
 console.log('CHAPTER_DMG=['+CHAPTER_DMG.map(v=>+v.toFixed(2)).join(',')+']');
}
if(process.env.VERIFY){report('current tables');process.exit(0);}
// 2. Raw fit.
const fits:Fit[]=[];
for(let zone=0;zone<N;zone++){
 for(let round=0;round<2;round++){fitHp(zone);fits[zone]=fitDamage(zone);}
 console.log(`raw ch${zone+1} hp${CHAPTER_HP[zone].toFixed(2)} dmg${CHAPTER_DMG[zone].toFixed(2)} (novice 70% ${Math.exp(cross(fits[zone].curve,.7)).toFixed(2)}, 40% ${Math.exp(cross(fits[zone].curve,.4)).toFixed(2)}; casual cap ${fits[zone].cap.toFixed(2)}, idle floor ${fits[zone].idle.toFixed(2)})`);
}
// Gauss-Seidel pass over a chain: each value moves to its wish inside its own bounds and the step bounds to its neighbours.
function chain(x:number[],wish:(i:number)=>number,bounds:(i:number)=>[number,number]){
 for(let sweep=0;sweep<200;sweep++)for(let i=0;i<x.length;i++){const [lo,hi]=bounds(i);x[i]=lo<=hi?Math.max(lo,Math.min(hi,wish(i))):(lo+hi)/2;}
}
// 3a. HP smoothing (in log space; chapter 1 stays pinned).
const hpWish=CHAPTER_HP.map(Math.log),h=[...hpWish],s=Math.log(STEP),eff=(i:number)=>h[i]+Math.log(bossBase(i));
chain(h,i=>hpWish[i],i=>{if(i===0)return [hpWish[0],hpWish[0]];let lo=eff(i-1)-Math.log(bossBase(i)),hi=Infinity;
 if(act(i)===act(i-1)){lo=Math.max(lo,h[i-1]-s);hi=h[i-1]+s;}
 if(i+1<N){hi=Math.min(hi,eff(i+1)-Math.log(bossBase(i)));if(act(i+1)===act(i)){lo=Math.max(lo,h[i+1]-s);hi=Math.min(hi,h[i+1]+s);}}
 return [lo,hi];});
for(let zone=0;zone<N;zone++){const v=Math.ceil(Math.exp(h[zone])*100-1e-6)/100,moved=Math.abs(v/CHAPTER_HP[zone]-1)>.02;CHAPTER_HP[zone]=v;if(moved){fits[zone]=fitDamage(zone);console.log(`refit ch${zone+1} hp${v} dmg${CHAPTER_DMG[zone].toFixed(2)}`);}}
// 3b. Damage smoothing: exact dynamic program on a log grid (steps of 0.4%). From chapter 6 on each chapter is within STEP of the
//     one before, either way. Chapters 2-5 (Act I and the step into Act II) may rise further (never fall by more than STEP): early levels, the first
//     talents and gear, a growing party, and the first jobs and the sixth hero at chapter 5 lift the party far more than 20% per
//     chapter there, so a capped rise would turn chapter 1 into a wall or the start of Act II into a walkover.
const G=.004,lo0=Math.log(.2),grid=Array.from({length:Math.ceil((Math.log(60)-lo0)/G)},(_,k)=>lo0+k*G),down=Math.floor(s/G),up=(i:number)=>i<=ACT1_FREE?Math.floor(Math.log(ACT1_RISE)/G):down;
// Each chapter costs its squared win-rate miss (a miss toward a wall counts WALL times), plus a tiny pull toward its target
// damage so flat stretches of a curve settle there, plus IDLE_COST below its idle floor.
const aim=fits.map((f,i)=>cross(f.curve,target(i)));
const miss=(i:number,x:number)=>{if(x>Math.log(fits[i].cap))return Infinity;const m=rate(fits[i].curve,x)-target(i);return m*m*(m<0?WALL:1)+1e-3*(x-aim[i])**2+(fits[i].idle&&x<Math.log(fits[i].idle)?IDLE_COST:0);};
let cost=grid.map(x=>miss(0,x));const from:number[][]=[];
for(let i=1;i<N;i++){const next:number[]=[],back:number[]=[];
 for(let k=0;k<grid.length;k++){let best=Infinity,arg=-1;for(let j=Math.max(0,k-up(i));j<=Math.min(grid.length-1,k+down);j++)if(cost[j]<best){best=cost[j];arg=j;}
  next.push(best+miss(i,grid[k]));back.push(arg);}
 cost=next;from.push(back);}
let k=cost.indexOf(Math.min(...cost));const d:number[]=[];for(let i=N-1;i>=0;i--){d[i]=grid[k];if(i)k=from[i-1][k];}
for(let i=0;i<N;i++)CHAPTER_DMG[i]=Math.floor(Math.exp(d[i])*100)/100;
console.log('expected novice win rates: '+d.map((x,i)=>Math.round(rate(fits[i].curve,x)*100)+'%').join(' '));
report('smoothed tables (paste into src/game/simulation.ts)');
