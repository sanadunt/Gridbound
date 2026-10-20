// Battle juice rules for BattleScene and the HUD, kept free of Phaser and the DOM so tests can drive them. Presentation only: nothing
// here reads or changes Battle state, every time is the battle's own clock (Battle.time), so a paused fight freezes a combo too.
import { TAP_CUT } from '../game/simulation';
/** Clean taps count up a combo while each lands within COMBO_WINDOW s of the last; tiers change the counter's colour. */
export const COMBO_WINDOW=1.2,COMBO_TIERS=[10,25,50] as const;
/** A party Guard raised at most PERFECT_WINDOW s before an all-grid impact is PERFECT: PERFECT_SLOWMO slows the arena to `scale` for
 *  `seconds` of wall-clock time, easing back to full speed. */
export const PERFECT_WINDOW=.6,PERFECT_SLOWMO={seconds:.35,scale:.25};
/** Boss hits from the same source within MERGE_WINDOW s stack into one rising number. */
export const MERGE_WINDOW=.5;
/** The boss's last hit: the arena runs at `scale` for `seconds` (wall clock) with the camera at `zoom` on the boss, then the death animation. */
export const KILL_CAM={seconds:.8,scale:.2,zoom:1.15};
/** A hero's cast lunges `distance` canvas px toward the boss (back rows lean `lean` px), out in `out` s, back in `back` s; a TAP-STRIKE
 *  (the tap that brought the gauge to 0) lunges `strike` times as far. */
export const LUNGE={distance:14,lean:7,out:.09,back:.14,strike:1.5};
/** A clean tap takes the full cut (TAP_CUT or more with bonuses); a fatigued one is cut to half or less, so 95% of TAP_CUT separates them. */
export const cleanTap=(amount:number)=>amount>=TAP_CUT*.95;
export type Combo={count:number;best:number;at:number};
export const newCombo=():Combo=>({count:0,best:0,at:-Infinity});
/** 0 below the first tier, then 1..3 (×10, ×25, ×50). */
export const comboTier=(count:number)=>COMBO_TIERS.filter(n=>count>=n).length;
/** What a tap did to the combo: `up` counted it, `tier` counted it into a new tier, `tired` (a fatigued tap) broke it (`broke`: there was
 *  a running combo of 2 or more to lose). */
export type ComboEvent={combo:Combo;event:'up'|'tier'|'tired';broke:boolean};
export function comboStep(state:Combo,tap:{at:number;amount:number}):ComboEvent{
 if(!cleanTap(tap.amount))return{combo:{count:0,best:state.best,at:tap.at},event:'tired',broke:comboAlive(state,tap.at)&&state.count>=2};
 const count=comboAlive(state,tap.at)?state.count+1:1;
 return{combo:{count,best:Math.max(state.best,count),at:tap.at},event:comboTier(count)>comboTier(count-1)?'tier':'up',broke:false};
}
/** A combo stays on screen while its last tap is at most COMBO_WINDOW s old. */
export const comboAlive=(state:Combo,now:number)=>state.count>0&&now-state.at<=COMBO_WINDOW+1e-9;
/** True when the Guard raised at `guardAt` covers an all-grid impact at `impactAt` and was raised at most PERFECT_WINDOW s before it. */
export const isPerfectGuard=(guardAt:number|undefined,impactAt:number)=>guardAt!==undefined&&Number.isFinite(guardAt)&&impactAt-guardAt>=0&&impactAt-guardAt<=PERFECT_WINDOW+1e-9;
/** The slow-motion factor `elapsed` wall-clock seconds into a slow-mo of `total` seconds that starts at `scale`: eased back to 1. */
export function slowmoScale(elapsed:number,total:number,scale:number){if(!(total>0)||elapsed>=total)return 1;const p=Math.max(0,elapsed)/total;return scale+(1-scale)*p*p;}
export type HitNumber={source:number;at:number;total:number};
/** Stack a boss hit onto the previous number from the same source when it is at most MERGE_WINDOW s old (measured from that number's
 *  latest hit), else start a new one. */
export function mergeNumber(prev:HitNumber|undefined,hit:{source:number;at:number;amount:number}):{merged:boolean;number:HitNumber}{
 if(prev&&prev.source===hit.source&&hit.at-prev.at>=0&&hit.at-prev.at<=MERGE_WINDOW)return{merged:true,number:{source:hit.source,at:hit.at,total:prev.total+hit.amount}};
 return{merged:false,number:{source:hit.source,at:hit.at,total:hit.amount}};
}
/** The lunge's offset share (0..1 of its distance) `elapsed` s after the cast: out with a slight overshoot (Back.easeOut), then back. */
export function lungeShare(elapsed:number){
 if(elapsed<=0)return 0;
 if(elapsed<LUNGE.out){const p=elapsed/LUNGE.out-1,s=1.70158;return 1+(s+1)*p*p*p+s*p*p;}
 if(elapsed<LUNGE.out+LUNGE.back){const p=(elapsed-LUNGE.out)/LUNGE.back;return 1-p*p*(3-2*p);}
 return 0;
}
export const lungeDone=(elapsed:number)=>elapsed>=LUNGE.out+LUNGE.back;
/** Which screen edge a threat comes from: the boss's (top) for ground and all-grid hits, the marked hero's side for a target mark
 *  (column 0 → left, 2 → right, the middle column → bottom). */
export function dangerSide(threat:{type:string;targetSlot?:number}):'top'|'left'|'right'|'bottom'{
 if(threat.type!=='target'||threat.targetSlot===undefined)return 'top';
 const col=threat.targetSlot%3;return col===0?'left':col===2?'right':'bottom';
}
