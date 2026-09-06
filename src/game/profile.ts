import { CAMPAIGN } from './world';
import { JOBS, GEAR, legalSkill } from './jobs';
import { ROSTER } from './content';
export type Loadout = { skills:number[]; talents:string[]; slot:number; job?:string; gear?:Record<string,string>; inventory?:string[] };
export type Profile = { version:2; gold:number; roster:number[]; cleared:number[]; loadouts:Record<number,Loadout>; bestFloor:number; wins:number; sound:boolean; motion:boolean };
export const TALENTS:{id:string;name:string;description:string;cost:number;requires?:string}[] = [
  {id:'vigor',name:'Vigor',description:'+18% max HP untuk hero ini.',cost:35},
  {id:'focus',name:'Focus',description:'Cooldown hero ini 10% lebih cepat.',cost:35},
  {id:'active-2',name:'Tactical art',description:'Buka skill aktif ketiga, lalu pasang ke salah satu slot.',cost:45},
  {id:'mastery',name:'Mastery',description:'+18% power skill hero ini, termasuk heal dan shield.',cost:65,requires:'focus'},
  {id:'active-3',name:'Signature art',description:'Buka skill aktif keempat. Tetap hanya dua slot saat bertarung.',cost:80,requires:'active-2'},
  {id:'vigor-2',name:'Iron Constitution',description:'+20% max HP, multiplicative dengan Vigor.',cost:100,requires:'vigor'},
  {id:'focus-2',name:'Flow State',description:'+8% tempo.',cost:110,requires:'focus'},
  {id:'mastery-2',name:'Grandmaster',description:'+20% skill power.',cost:150,requires:'mastery'},
  {id:'fortitude',name:'Fortitude',description:'Damage masuk −10%, sebelum shield.',cost:95,requires:'vigor'},
  {id:'shelter',name:'Shelter',description:'Mulai expedition dengan barrier 20% HP.',cost:100,requires:'fortitude'},
  {id:'recovery',name:'Open Heart',description:'Heal diterima +15%.',cost:90,requires:'vigor'},
  {id:'momentum',name:'Momentum',description:'Tap fresh mengurangi tambahan 0,2s cooldown; fatigue tetap berlaku.',cost:110,requires:'focus'},
  {id:'composure',name:'Composure',description:'Pemulihan fatigue 50% lebih cepat.',cost:95,requires:'focus'},
  {id:'evasive',name:'Footwork',description:'Penalti relokasi diri turun ke 0,45s.',cost:100,requires:'composure'},
  {id:'resolve',name:'Conviction',description:'Setiap cast menambah 2 Resolve.',cost:120,requires:'mastery'},
];
export function createProfile():Profile {
  return {version:2,gold:60,roster:[0,4,3],cleared:[],loadouts:{0:{skills:[0,1],talents:[],slot:1},4:{skills:[0,1],talents:[],slot:7},3:{skills:[0,1],talents:[],slot:6}},bestFloor:0,wins:0,sound:true,motion:true};
}
function loadout(p:Profile,id:number) { return Number.isInteger(id)&&p.roster.includes(id)?p.loadouts[id]:undefined; }
export function buyTalent(p:Profile,heroId:number,talentId:string) {
  const h=loadout(p,heroId),t=TALENTS.find(t=>t.id===talentId);
  if(!h||!t||h.talents.includes(t.id)||p.gold<t.cost||(t.requires&&!h.talents.includes(t.requires)))return false;
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
  const h=loadout(p,id),g=GEAR.find(g=>g.id===gearId);if(!h||!g||h.gear?.[g.slot]===g.id)return false;
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
    p.roster.push(id);p.loadouts[id]={skills:[0,1],talents:[],slot};
  }
  return true;
}
export function profileModifiers(p:Profile) { const level=p.cleared.length;return {power:1+level*.12,vitality:1+level*.13,tempo:1+level*.035}; }
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const bounded=(value:unknown,fallback:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):fallback;
export function normalizeProfile(raw:unknown,legacy?:unknown):Profile {
  const p=createProfile(),data=record(raw);
  if(data.version!==2){
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
    h.talents=[];
    for(const talent of TALENTS)if(claimed.includes(talent.id)&&(!talent.requires||h.talents.includes(talent.requires)))h.talents.push(talent.id);
    const job=JOBS[String(source.job??'')];if(job&&job.base===ROSTER[id].classId&&job.level<=p.cleared.length+1)h.job=job.id;
    h.inventory=Array.isArray(source.inventory)?[...new Set(source.inventory.filter((id):id is string=>typeof id==='string'&&GEAR.some(g=>g.id===id)))]:[];
    h.gear={};for(const [slot,id] of Object.entries(record(source.gear)))if(typeof id==='string'&&h.inventory.includes(id)&&GEAR.some(g=>g.id===id&&g.slot===slot))h.gear[slot]=id;
    const skills=Array.isArray(source.skills)?source.skills:[];
    const valid=[...new Set(skills)].filter((index):index is number=>typeof index==='number'&&legalSkill(index,h.talents,h.job));
    h.skills=valid.length===2?valid:[0,1];
    const slot=source.slot;
    if(typeof slot==='number'&&Number.isInteger(slot)&&slot>=0&&slot<=8&&!occupied.has(slot))h.slot=slot;
    else if(occupied.has(h.slot))h.slot=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i))!;
    occupied.add(h.slot);
  }
  return p;
}
