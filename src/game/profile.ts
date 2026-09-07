import { CAMPAIGN, ENEMIES } from './world';
import { JOBS, GEAR, legalSkill } from './jobs';
import { ROSTER } from './content';
import { TALENTS, type Talent } from './talents';
export { TALENTS } from './talents';
import { heroProgress, normalizedXP, xpForLevel } from './levels';
import { QUESTS, questProgress } from './quests';
import type { Battle } from './simulation';
export type Loadout = { skills:number[]; talents:string[]; slot:number; xp?:number; job?:string; gear?:Record<string,string>; inventory?:string[] };
export type Profile = { version:3; gold:number; claimedQuests:string[]; trackedQuest?:string; ledger:{raids:number;victories:number;enemies:Record<string,number>}; roster:number[]; cleared:number[]; loadouts:Record<number,Loadout>; bestFloor:number; wins:number; sound:boolean; motion:boolean };
export function createProfile():Profile {
  return {version:3,claimedQuests:[],ledger:{raids:0,victories:0,enemies:{}},gold:60,roster:[0,4,3],cleared:[],loadouts:{0:{skills:[0,1],talents:[],xp:0,slot:1},4:{skills:[0,1],talents:[],xp:0,slot:7},3:{skills:[0,1],talents:[],xp:0,slot:6}},bestFloor:0,wins:0,sound:true,motion:true};
}
function loadout(p:Profile,id:number) { return Number.isInteger(id)&&p.roster.includes(id)?p.loadouts[id]:undefined; }
export function buyTalent(p:Profile,heroId:number,talentId:string) {
  const h=loadout(p,heroId),t=TALENTS.find(t=>t.id===talentId);
  if(!h||!t||talentReason(p,heroId,t))return false;
  p.gold-=t.cost;h.talents.push(t.id);return true;
}
export function equipSkill(p:Profile,heroId:number,slotIndex:number,skillIndex:number) {
  const h=loadout(p,heroId);
  if(!h||![0,1].includes(slotIndex)||!Number.isInteger(skillIndex)||!legalSkill(skillIndex,h.talents,h.job))return false;
  if(h.skills[slotIndex]===skillIndex)return false;
  const other=1-slotIndex;
  if(h.skills[other]===skillIndex)h.skills[other]=h.skills[slotIndex];
  h.skills[slotIndex]=skillIndex;return true;
}
export function respecHero(p:Profile,heroId:number) {
  const h=loadout(p,heroId);if(!h||(!h.talents.length&&!h.job))return false;
  p.gold+=TALENTS.filter(t=>h.talents.includes(t.id)).reduce((sum,t)=>sum+t.cost,0);
  const j=JOBS[h.job??''];if(j)p.gold+=j.cost+(j.parent?JOBS[j.parent].cost:0);
  delete h.job;h.talents=[];h.skills=[0,1];return true;
}
export function promote(p:Profile,id:number,jobId:string) {
  const h=loadout(p,id),j=JOBS[jobId];
  if(!h||!j||j.base!==ROSTER[id].classId||p.cleared.length+1<j.level||p.gold<j.cost||h.job===j.id)return false;
  if(j.tier===2?h.job!==undefined:h.job!==j.parent)return false;
  p.gold-=j.cost;h.job=j.id;return true;
}
export function equipGear(p:Profile,id:number,gearId:string) {
  const h=loadout(p,id),g=GEAR.find(g=>g.id===gearId);if(!h||!g||h.gear?.[g.slot]===g.id||gearReason(p,id,gearId))return false;
  h.inventory??=[];h.gear??={};
  if(!h.inventory.includes(g.id)){if(p.gold<g.cost)return false;p.gold-=g.cost;h.inventory.push(g.id);}
  h.gear[g.slot]=g.id;return true;
}
export function moveFormation(p:Profile,heroId:number,slot:number) {
  const h=loadout(p,heroId);if(!h||!Number.isInteger(slot)||slot<0||slot>8||slot===h.slot)return false;
  const other=p.roster.find(id=>p.loadouts[id].slot===slot);
  if(other!==undefined)p.loadouts[other].slot=h.slot;
  h.slot=slot;return true;
}
export function canEnterZone(p:Profile,index:number) { return Number.isInteger(index)&&index>=0&&index<CAMPAIGN.length&&(index===0||p.cleared.includes(index-1)); }
export function completeZone(p:Profile,index:number) {
  if(!canEnterZone(p,index)||p.cleared.includes(index))return false;
  p.cleared.push(index);
  for(const id of CAMPAIGN[index].recruit)if(!p.roster.includes(id)){
    const occupied=new Set(p.roster.map(id=>p.loadouts[id].slot));
    const slot=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i))!;
    const levels=p.roster.map(i=>heroProgress(p.loadouts[i].xp).level).sort((a,b)=>a-b);
    p.loadouts[id]={skills:[0,1],talents:[],slot,xp:xpForLevel(levels[Math.floor(levels.length/2)]??1)};p.roster.push(id);
  }
  return true;
}
export function profileModifiers(p:Profile) { const level=p.cleared.length;return {power:1+level*.12,vitality:1+level*.13,tempo:1+level*.035}; }
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const bounded=(value:unknown,fallback:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):fallback;
export function normalizeProfile(raw:unknown,legacy?:unknown):Profile {
  const p=createProfile(),data=record(raw);
  if(data.version!==2&&data.version!==3){
    const old=record(legacy);p.gold=bounded(old.gold,60,1000000);
    if(typeof old.sound==='boolean')p.sound=old.sound;
    if(typeof old.motion==='boolean')p.motion=old.motion;
    return p;
  }
  p.gold=bounded(data.gold,60,1000000);p.bestFloor=bounded(data.bestFloor,0,100);p.wins=bounded(data.wins,0,1000000);
  if(typeof data.sound==='boolean')p.sound=data.sound;if(typeof data.motion==='boolean')p.motion=data.motion;
  const cleared=Array.isArray(data.cleared)?data.cleared:[];
  for(let index=0;index<CAMPAIGN.length&&cleared.includes(index);index++)completeZone(p,index);
  const loads=record(data.loadouts),occupied=new Set<number>();
  for(const id of p.roster){
    const source=record(loads[String(id)]),h=p.loadouts[id];
    const claimed=Array.isArray(source.talents)?source.talents:[];
    h.xp=data.version===2?xpForLevel(p.cleared.length+1):normalizedXP(source.xp);
    h.talents=[];
    for(const talent of TALENTS)if(claimed.includes(talent.id)&&!talentReason(p,id,talent,true))h.talents.push(talent.id);
    const job=JOBS[String(source.job??'')];if(job&&job.base===ROSTER[id].classId&&job.level<=p.cleared.length+1)h.job=job.id;
    h.inventory=Array.isArray(source.inventory)?[...new Set(source.inventory.filter((id):id is string=>typeof id==='string'&&GEAR.some(g=>g.id===id)))]:[];
    h.gear={};for(const [slot,gearId] of Object.entries(record(source.gear)))if(typeof gearId==='string'&&h.inventory.includes(gearId)&&GEAR.some(g=>g.id===gearId&&g.slot===slot)&&!gearReason(p,id,gearId,true))h.gear[slot]=gearId;
    const skills=Array.isArray(source.skills)?source.skills:[];
    const valid=[...new Set(skills)].filter((index):index is number=>typeof index==='number'&&legalSkill(index,h.talents,h.job));
    h.skills=valid.length===2?valid:[0,1];
    const slot=source.slot;
    if(typeof slot==='number'&&Number.isInteger(slot)&&slot>=0&&slot<=8&&!occupied.has(slot))h.slot=slot;
    else if(occupied.has(h.slot))h.slot=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i))!;
    occupied.add(h.slot);
  }
  const ledger=record(data.ledger),enemies=record(ledger.enemies);
  p.ledger.raids=bounded(ledger.raids,0,1000000);p.ledger.victories=bounded(ledger.victories,0,1000000);
  for(const e of Object.values(ENEMIES))if(e.archetype===e.id&&enemies[e.id]!==undefined)p.ledger.enemies[e.id]=bounded(enemies[e.id],0,1000000);
  const claims=Array.isArray(data.claimedQuests)?data.claimedQuests:[];
  for(const q of QUESTS)if(claims.includes(q.id)&&(!q.requires||p.claimedQuests.includes(q.requires)))p.claimedQuests.push(q.id);
  if(typeof data.trackedQuest==='string'&&QUESTS.some(q=>q.id===data.trackedQuest)&&!p.claimedQuests.includes(data.trackedQuest))p.trackedQuest=data.trackedQuest;
  return p;
}

export function awardExperience(p:Profile,id:number,amount:number) {
  const h=loadout(p,id);if(!h||!Number.isFinite(amount)||amount<=0)return 0;
  const before=heroProgress(h.xp).level;h.xp=normalizedXP(normalizedXP(h.xp)+Math.floor(amount));
  return heroProgress(h.xp).level-before;
}
export function availablePoints(p:Profile,id:number) {
  const h=loadout(p,id);if(!h)return 0;
  return Math.max(0,heroProgress(h.xp).level-1-TALENTS.filter(t=>h.talents.includes(t.id)).reduce((sum,t)=>sum+(t.points??0),0));
}
export function talentReason(p:Profile,id:number,t:Talent,ignoreGold=false):string {
  const h=loadout(p,id);if(!h)return 'Hero belum direkrut';
  if(h.talents.includes(t.id))return 'Sudah dipelajari';
  if(t.classId&&t.classId!==ROSTER[id].classId)return 'Khusus class lain';
  if(t.requires&&!h.talents.includes(t.requires))return `Perlu ${TALENTS.find(n=>n.id===t.requires)?.name??t.requires}`;
  if(t.requiresAll?.some(key=>!h.talents.includes(key)))return 'Perlu kedua cabang sebelumnya';
  if(t.level&&heroProgress(h.xp).level<t.level)return `Perlu hero Lv.${t.level}`;
  if(t.exclusive&&TALENTS.some(n=>n.exclusive===t.exclusive&&h.talents.includes(n.id)))return 'Keystone lain dipilih';
  if(availablePoints(p,id)<(t.points??0))return 'Skill point belum cukup';
  if(!ignoreGold&&p.gold<t.cost)return 'Gold belum cukup';
  return '';
}
export function gearReason(p:Profile,id:number,gearId:string,ignoreGold=false):string {
  const h=loadout(p,id),g=GEAR.find(g=>g.id===gearId);if(!h||!g)return 'Item tidak tersedia';
  if(g.classId&&g.classId!==ROSTER[id].classId)return 'Khusus class lain';
  if(heroProgress(h.xp).level<(g.minLevel??1))return `Perlu hero Lv.${g.minLevel}`;
  if(!h.inventory?.includes(g.id)){
    if(g.source==='quest')return 'Hadiah quest';
    if(!ignoreGold&&p.gold<g.cost)return 'Gold belum cukup';
  }
  return '';
}
export function claimQuest(p:Profile,id:string,recipient:number) {
  const q=QUESTS.find(q=>q.id===id);if(!q||!questProgress(p,q).ready)return false;
  const heroId=q.heroId??recipient,h=loadout(p,heroId);if(!h)return false;
  p.claimedQuests.push(q.id);p.gold+=q.gold;awardExperience(p,heroId,q.xp);
  if(q.gear&&GEAR.some(g=>g.id===q.gear)){h.inventory??=[];if(!h.inventory.includes(q.gear))h.inventory.push(q.gear);}
  if(p.trackedQuest===q.id)delete p.trackedQuest;
  return true;
}
const settled=new WeakSet<Battle>();
export function settleProgress(p:Profile,b:Battle) {
  if(b.status!=='victory'||(b.mode==='adventure'&&b.stage+1<b.stageCount)||settled.has(b))return null;
  settled.add(b);
  const xp=b.mode==='adventure'?180+b.floor*75+b.stageCount*45:b.mode==='endless'?100+b.floor*35:180+b.floor*45;
  const rewards=b.heroes.map(h=>{const amount=Math.floor(xp*(h.hp>0?1:.6));const before=heroProgress(p.loadouts[h.id]?.xp).level;awardExperience(p,h.id,amount);return {id:h.id,xp:amount,before,after:heroProgress(p.loadouts[h.id]?.xp).level};});
  p.ledger.victories++;if(b.mode==='raid')p.ledger.raids++;
  const enemies=b.mode==='adventure'?CAMPAIGN[b.floor-1].stages.map(s=>s.enemy):[b.enemyId];
  for(const id of enemies){const base=ENEMIES[id].archetype??id;p.ledger.enemies[base]=(p.ledger.enemies[base]??0)+1;}
  return rewards;
}
