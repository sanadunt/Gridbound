import { normalizeProfile, type Profile } from './profile';
export const SAVE_KEY='gridbound.v3';
export type SaveStore={getItem(key:string):string|null;setItem(key:string,value:string):void};
type SaveRecord=Record<string,unknown>;
const isRecord=(value:unknown):value is SaveRecord=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finiteNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);

/** Accept v3 only when its persisted envelope is structurally complete. */
export function isCompleteV3(value:unknown):boolean {
  if(!isRecord(value)||value.version!==3||!finiteNumber(value.gold)||!Array.isArray(value.claimedQuests)||!Array.isArray(value.roster)||!Array.isArray(value.cleared)||!finiteNumber(value.bestFloor)||!finiteNumber(value.wins)||typeof value.sound!=='boolean'||typeof value.motion!=='boolean')return false;
  if(value.economy!==undefined&&(!isRecord(value.economy)||!finiteNumber(value.economy.gold)||!finiteNumber(value.economy.commanderCrystal)||!isRecord(value.economy.materials)))return false;
  if(value.settlementReceipts!==undefined&&!Array.isArray(value.settlementReceipts))return false;
  if(value.challengeUnlocks!==undefined&&!Array.isArray(value.challengeUnlocks))return false;
  if(!isRecord(value.ledger)||!finiteNumber(value.ledger.raids)||!finiteNumber(value.ledger.victories)||!isRecord(value.ledger.enemies)||!isRecord(value.loadouts))return false;
  const loadouts=value.loadouts;
  const roster=value.roster.filter((id):id is number=>typeof id==='number'&&Number.isInteger(id));
  if(roster.length!==value.roster.length||new Set(roster).size!==roster.length||roster.length===0)return false;
  return roster.every(id=>{
    const loadout=loadouts[String(id)];
    return isRecord(loadout)&&Array.isArray(loadout.skills)&&Array.isArray(loadout.talents)&&finiteNumber(loadout.slot);
  });
}

export function loadSave(store:SaveStore) {
  const parse=(key:string)=>{try{return JSON.parse(store.getItem(key)??'null');}catch{return null;}};
  let raw:string|null;
  try{raw=store.getItem(SAVE_KEY);}catch{return {profile:normalizeProfile(null),readOnly:true,warning:'Storage browser tidak tersedia. Progress hanya di tab ini.'};}
  if(raw!==null){
    let data:unknown;
    try{data=JSON.parse(raw);}catch{return {profile:normalizeProfile(parse('gridbound.v2'),parse('gridbound.v1')),readOnly:true,warning:'Save v3 rusak. File asli tidak ditimpa; gunakan backup sebelum melanjutkan.'};}
    if(!isCompleteV3(data))return {profile:normalizeProfile(parse('gridbound.v2'),parse('gridbound.v1')),readOnly:true,warning:'Save v3 tidak lengkap atau tidak didukung. Save asli dilindungi dari penimpaan.'};
    return {profile:normalizeProfile(data),readOnly:false,warning:''};
  }
  const legacy=parse('gridbound.v2');
  return {profile:normalizeProfile(legacy,parse('gridbound.v1')),readOnly:false,warning:legacy?'Save lama dimigrasikan. Salinan v2 tetap disimpan untuk rollback.':''};
}
export function saveProfile(store:SaveStore,p:Profile,readOnly=false) {
  if(readOnly)throw new Error('Save is protected');
  store.setItem(SAVE_KEY,JSON.stringify(p));
}
