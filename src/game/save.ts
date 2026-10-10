import { normalizeProfile, type Profile } from './profile';
import { applyRuntimeToDocument, createCommanderDocument, normalizeCommanderDocument, type CommanderDocument } from './commander';
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

/** Backups of the raw legacy save, newest last when sorted: `gridbound.v3.backup-<ISO timestamp>`. */
export const BACKUP_PREFIX=`${SAVE_KEY}.backup-`;
export type BackupStore=SaveStore&{removeItem(key:string):void;key(index:number):string|null;readonly length:number};
/** Copy the raw gridbound.v3 string aside before a Commander takes it over. Keeps the newest `keep` backups, skips a copy identical to the newest one, and never throws. */
export function backupLegacy(store:BackupStore,stamp:string,keep=3):string|undefined {
  try{
    const raw=store.getItem(SAVE_KEY);
    if(raw===null)return undefined;
    const backups=()=>Array.from({length:store.length},(_,i)=>store.key(i)).filter((key):key is string=>Boolean(key?.startsWith(BACKUP_PREFIX))).sort();
    const newest=backups().at(-1);
    if(newest!==undefined&&store.getItem(newest)===raw)return newest;
    const key=`${BACKUP_PREFIX}${stamp}`;
    store.setItem(key,raw);
    for(const old of backups().slice(0,-keep))store.removeItem(old);
    return key;
  }catch{return undefined;}
}

/** The file 'Download save backup' writes when no Commander holds the progress yet. */
export const legacyBackup=(profile:Profile)=>({kind:'gridbound-legacy',version:3,profile});
export type BackupFile={document:CommanderDocument;sourceId?:string};
/** Turn a downloaded backup into a new Commander candidate with a fresh id: a Commander export, a recovery export (its document plus a pending Story profile) or a gridbound-legacy envelope. Undefined when the file is not a Gridbound save. */
export function commanderFromBackup(text:string,options:{id:string;name:string;timestamp:number}):BackupFile|undefined {
  let data:unknown;
  try{data=JSON.parse(text);}catch{return undefined;}
  if(!isRecord(data))return undefined;
  if(data.kind==='gridbound-legacy'){
    if(!isCompleteV3(data.profile))return undefined;
    const document=createCommanderDocument(normalizeProfile(data.profile),options.name);
    return {document:{...document,commanderId:options.id,legacySource:JSON.stringify(data.profile)}};
  }
  const recovery=data.kind==='gridbound-recovery';
  const document=normalizeCommanderDocument(recovery?data.document:data);
  if(!document)return undefined;
  if(recovery&&data.mode==='story'&&isCompleteV3(data.pendingProfile))applyRuntimeToDocument(document,{mode:'story',slotId:'auto',profile:normalizeProfile(data.pendingProfile)},options.timestamp);
  return {document:{...document,commanderId:options.id,revision:0},sourceId:document.commanderId};
}
