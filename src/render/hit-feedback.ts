// Hit feedback rules for BattleScene, kept free of Phaser so tests can drive them.
// A crit is relative to the encounter: it beats the 90th-percentile of the last CRIT_WINDOW hits (once CRIT_SAMPLE are known)
// or doubles its source's rolling average. Screen shake has a per-second budget and hit-stop a minimum gap.
export const CRIT_SAMPLE=12,CRIT_WINDOW=40,CRIT_SOURCE_RATIO=2,SHAKE_PER_SECOND=.6,HIT_STOP_GAP=.4;
export type SourceAverage={avg:number;n:number};
/** True when `amount` is a crit against the rolling `hits` and the source's rolling average. */
export function isRelativeCrit(amount:number,hits:readonly number[],source?:SourceAverage){
 if(!(amount>0))return false;
 const sorted=[...hits].sort((a,b)=>a-b),p90=sorted.length>=CRIT_SAMPLE?sorted[Math.floor(sorted.length*.9)]:Infinity;
 return amount>p90||Boolean(source&&source.n>=4&&amount>source.avg*CRIT_SOURCE_RATIO);
}
/** Rolling hit statistics for one encounter. */
export class HitStats {
 private hits:number[]=[];private sources=new Map<number,SourceAverage>();
 reset(){this.hits=[];this.sources.clear();}
 /** Classify a hit (boss or minion) and record it; passive ticks (curse, thorn) and the ultimate never crit and are not recorded. */
 crit(amount:number,source=-1,kind=''){
  if(kind==='ultimate'||kind==='curse'||kind==='thorn'||!(amount>0))return false;
  const avg=this.sources.get(source),crit=isRelativeCrit(amount,this.hits,avg);
  this.hits.push(amount);if(this.hits.length>CRIT_WINDOW)this.hits.shift();
  const next=avg??{avg:amount,n:0};next.n++;next.avg+=(amount-next.avg)/Math.min(next.n,10);this.sources.set(source,next);
  return crit;
 }
}
/** How much of a requested shake fits in what is left of this second's budget (`force` ignores the budget). */
export function allowedShake(amount:number,used:number,force=false){return force?amount:Math.min(amount,Math.max(0,SHAKE_PER_SECOND-used));}
