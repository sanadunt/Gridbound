import { JOBS, gearStats, legalSkill } from './jobs';
import { TALENTS, talentStats } from './talents';
import { heroProgress, levelStats } from './levels';
import { normalizeStoryParty, storyPartyCap } from './story-party';
import { createRogueBuild, validRogueBuild, normalizeRogueBuild, rewardRogueRoom, promoteRogue, type RogueBuild } from './roguelike-build';
import { normalizeRaidBuild, validRaidBuild, type RaidBuild } from './raid-build';
import { KITS, ROSTER, GRID_SIZE, type ClassId, type Mode } from './content';
import { CAMPAIGN, ENEMIES, BOONS, type Intent } from './world';
import { getRaidContractForEnemy, normalizeRaidSandbox, sandboxRaidContract, validateRaidContract, WARD_RELIC, type RaidContract, type RaidModifierId, type RaidSandbox, type RaidTier, type RunWallet } from '../economy/challenge';
export type Hero = { offensiveActs:number; level:number; perks:ReturnType<typeof talentStats>; equipment:ReturnType<typeof gearStats>; id:number; name:string; classId:ClassId; slot:number; hp:number; maxHp:number; shield:number; stance:number; remaining:number; total:number; fatigue:number; lastTap:number; moveLock:number; buff:number; acts:number; talents:string[]; skills:number[]; regen:number; regenPower:number; regenSource:number; rescued:boolean; combo:number; counterLeft:number; counterPower:number; job?:string; gear:Record<string,string>; gearPower:number; gearTempo:number };
export type Telegraph = { id:number; name:string; type:'front'|'meteor'|'breath'|'target'|'all'|'channel'; slots:number[]; effect?:'silence'|'mend'; left:number; total:number; targetId?:number; counter?:string; damage?:number };
export type Minion = { id:number; lane:number; hp:number; maxHp:number; timer:number; enemyId?:string };
export type BattleEvent = { type:string; source?:number; slot?:number; lane?:number; amount?:number; color?:string; text?:string; targets?:number[]; kind?:string; name?:string; hit?:number[] };
export type Status = 'ready'|'fighting'|'paused'|'victory'|'defeat';
export type BattleOptions = { rogueBuild?:RogueBuild; raidBuild?:RaidBuild; raidSandbox?:RaidSandbox; roster?:number[]; storyCleared?:number[]; storyRecruited?:number[]; loadouts?:Record<number,{skills:number[];talents:string[];xp?:number;slot?:number;job?:string;gear?:Record<string,string>;refine?:Record<string,number>}>; boons?:string[]; enemyId?:string; stage?:number; settlementId?:string; raidContract?:RaidContract; runWallet?:RunWallet; runAct?:1|2|3; runActClear?:boolean; runFinalClear?:boolean; heroic?:boolean; relics?:string[]; extraPotions?:number; dungeon?:{chapter:number;hp:number;damage:number;xp:number;startHp?:Record<number,number>;potions?:number;power?:number;vitality?:number} };
const defaultUpgrades = {power:1,vitality:1,tempo:1};
// Per-chapter enemy tuning, fitted by scripts/calibrate.ts: HP to the casual player's boss time, damage to the novice's win rate
// (with a margin for the casual player), then smoothed (no damage spike or cliff, HP steps of at most 20% inside an act).
// Damage also stays at or above each chapter's idle floor, so an idle player loses (chapters 4 and 7 were raised onto it after the
// last full fit; a chapter an idle player wins even at the casual cap, 9 and 10 today, keeps no floor).
export const CHAPTER_HP:number[]=[2.2,1.95,1.76,2.04,3.52,3.92,3.59,3.68,3.81,3.63,4.35,4.17,4.01,3.73,3.77,3.99];
export const CHAPTER_DMG:number[]=[2.37,3.02,4.18,5.15,8.35,7.74,8.7,8.45,8.86,10.61,12.71,11.36,12.61,13.71,13.39,12.76];
// Damage shape: telegraphs are punishing but survivable; steady front-row strikes and minions keep healers busy.
// Raids (tuned with scripts/balance.ts on the shipped path): story heroes vs the next chapter's boss; RAID_PARTY_DMG eases hits for a party smaller than that chapter's story party.
export const RAID_HP=1.1,RAID_DMG=1.1,RAID_PARTY_DMG=.5,ENDLESS_HP=1300,ENDLESS_HP_GROWTH=1.13,ENDLESS_DMG=.82,ENDLESS_DMG_GROWTH=1.075;
// Roguelike floors that pay bank Crystal (1 to ENDLESS_EARLY_FLOORS) hit ENDLESS_EARLY_DMG times harder, fading out over the next
// three floors, so the rewarded floors carry real risk while the deep floors keep their curve.
export const ENDLESS_EARLY_DMG=1.15,ENDLESS_EARLY_FLOORS=9;
// Contract tiers scale the raid boss on top of the story curve; sandbox practice uses its own sliders instead.
export const RAID_TIER_SCALE:Record<RaidTier,{hp:number;dmg:number}>={bronze:{hp:1,dmg:1},silver:{hp:1.15,dmg:1.1},gold:{hp:1.3,dmg:1.2}};
// Pact modifiers: RM01 cuts barrier gains, RM03 adds an aftershock after each all-grid impact, RM05 summons a wave on each phase change.
export const RM01_BARRIER=.75;
// Roguelike relics bought with bank Crystal.
export const WARD_RELIC_BARRIER=.15;
export const MEND_HEAL=.05;
// Heroic chapters: more HP, harder hits, faster intents, one potion and aftershocks after phase 2. HEROIC_ACT eases the HP and
// damage bonus per act (fitted with scripts/power-curve.ts) so Act IV opens a few levels after its first clear, as Acts I-III do.
export const HEROIC_HP=1.6,HEROIC_DMG=1.45,HEROIC_INTERVAL=.85,HEROIC_ACT:readonly number[]=[1,1,1,.55];
/** Heroic HP and damage multipliers of a chapter (1-based). */
export function heroicScale(chapter:number){const a=HEROIC_ACT[Math.max(0,Math.min(HEROIC_ACT.length-1,Math.floor((chapter-1)/4)))];return {hp:1+(HEROIC_HP-1)*a,dmg:1+(HEROIC_DMG-1)*a};}
export const TELEGRAPH_SHARE=.5,CLAW_BASE=24,CLAW_EVERY=4.2,MINION_HIT=22;
// Late fights keep their threats: the stagger bar is a share of the boss's HP (capped by STAGGER_CAP × STAGGER_CAP_GROWTH^(chapter-1)),
// a break lasts BREAK_SECONDS, and minions strike MINION_FIRST seconds after they appear with MINION_HP × the chapter boss's HP.
export const STAGGER_SHARE=.08,STAGGER_CAP=800,STAGGER_CAP_GROWTH=1.2,BREAK_SECONDS=4.5,MINION_FIRST=2.2,MINION_HP=.03;
// Party tools scale with the party and the fight: a potion heals POTION_HEAL of each hero's max HP; Ninefold Dawn deals
// ULT_BASE + ULT_DAMAGE × boss max HP and heals/shields ULT_HEAL/ULT_SHIELD of each hero's max HP. Resolve comes from damage
// dealt as a share of the chapter boss's HP (RESOLVE_DEALT per boss's worth, RESOLVE_MINION for minions) and from damage
// taken as a share of the whole party's max HP (RESOLVE_TAKEN per party's worth), so ultimates come at the same pace in every
// chapter and with any party size.
export const POTION_HEAL=.28,ULT_BASE=220,ULT_DAMAGE=.05,ULT_HEAL=.12,ULT_SHIELD=.08,RESOLVE_DEALT=45,RESOLVE_MINION=26,RESOLVE_TAKEN=25;
// Skill kinds that are not offensive casts: they never count toward precision, echoes, Second Thunder or cast leech.
export const SUPPORT_KINDS:readonly string[]=['shield','partyshield','heal','regen','buff','haste','delay','stun','resolve','selfheal','repair','counter'];
// Control budget: delay/stun/frost/intent-delay add at most max(CONTROL_MIN, CONTROL_SHARE × intent interval) seconds per intent cycle.
export const CONTROL_MIN=3,CONTROL_SHARE=.4,CHORUS_BUFF=1,CHORUS_EVERY=4;
// Party Guard lasts GUARD_DURATION seconds; the soft enrage multiplies enemy damage by ENRAGE_DMG after ENRAGE_AT seconds of a stage (warned at ENRAGE_WARN).
export const GUARD_DURATION=2.8,ENRAGE_WARN=135,ENRAGE_AT=150,ENRAGE_DMG=1.7;
/** The telegraph name an enemy gives an intent. The map and bestiary chips show it too, so a preview and the battle use one name. */
export const threatName=(enemyId:string,intent:Intent)=>intent==='weakest'?'HUNT THE WOUNDED':intent==='strongest'?'BREAK THE STRONG':intent==='front'?'CRUSHING FRONT':intent==='breath'?'LANE ERUPTION':intent==='silence'?'TOLLING SILENCE':intent==='mend'?'MENDING RITE':intent==='all'?(enemyId.startsWith('dragon')?'EMERALD CATACLYSM':'WORLDLESS RITUAL'):enemyId==='spider'?'VENOM WEB':'FALLING SHARDS';
/** The counter family of an intent, the tag its counter line starts with (MARKED / GROUND / ALL GRID / CHANNEL). */
export const threatKind=(intent:Intent):'marked'|'ground'|'all'|'channel'=>intent==='weakest'||intent==='strongest'?'marked':intent==='all'||intent==='silence'?'all':intent==='mend'?'channel':'ground';
/** Seconds a hero's gauge loses when moved mid-fight (the Fleet boon lowers it). */
export const MOVE_PENALTY=.9,FLEET_MOVE_PENALTY=.2;
/** Damage taken by a marked boss, dealt by a weakened boss, taken during an armour break, and the share Party Guard blocks. UI texts and status chips read these. */
export const MARK_DAMAGE=1.2,WEAKEN_DAMAGE=.75,BREAK_DAMAGE=1.6,GUARD_REDUCTION=.65;
/** Counter text for a ground telegraph when every unmarked tile already holds a living hero. */
export const NO_SAFE_TILE='GROUND: tidak ada tile aman. Tukar tank atau hero ber-shield ke tanda, atau Guard (G).';
const chapterHp=(floor:number)=>CHAPTER_HP[Math.min(CHAPTER_HP.length,floor)-1];
const chapterDmg=(floor:number)=>CHAPTER_DMG[Math.min(CHAPTER_DMG.length,floor)-1];
/** Max HP of a chapter's final boss on Normal: minions and resolve are measured against it. */
const chapterBoss=(floor:number)=>{const ch=Math.max(1,Math.min(CAMPAIGN.length,floor));return CAMPAIGN[ch-1].stages.at(-1)!.hp*chapterHp(ch);};
export class Battle {
  heroes:Hero[]=[]; threats:Telegraph[]=[]; minions:Minion[]=[]; events:BattleEvent[]=[];
  storyRecruited:readonly number[]=[];
  rogueBuild?:RogueBuild;
  raidBuild?:RaidBuild;
  raidSandbox?:RaidSandbox;
  status:Status='ready'; mode:Mode='raid'; floor=1; stage=0; time=0; stageTime=0;
  bossHp=0; bossMax=0; enemyId='dragon'; enemyName=''; enemyTitle=''; stageName=''; stageCount=1;
  stagger=0; breakLeft=0; phase=1; resolve=25; gold=0; purse=120; potions=2;
  guardLeft=0; guardCooldown=0; markLeft=0; weakenLeft=0; repairUsed=false;
  curses:{source:number;left:number;power:number;tick:number}[]=[]; turrets:{lane:number;left:number;power:number;source:number;tick:number}[]=[];
  targetLane=-1; selected=0; damage=0; healed=0; blocked=0; dodged=0; taps=0; relocations=0;
  heroic=false; dungeon?:NonNullable<BattleOptions['dungeon']>;
  power=1; vitality=1; tempo=1; boons:string[]=[]; relics:string[]=[]; raidParty=1; settlementId=''; raidContract?: RaidContract; runWallet?: RunWallet; runAct?: 1|2|3; runActClear=false; runFinalClear=false;
  private seed=271828; private eventId=0; private pattern=0;
  private attackIn=5; private clawIn=7; private summonIn=18;
  private lastTapped=-1; private castCount=0; private delayThisCycle=0; private chorusAt:Record<number,number>={};
  private delayed:{left:number;source:number;lane:number;power:number}[]=[];
  private options:BattleOptions={};
  constructor(mode:Mode='raid',floor=1,upgrades=defaultUpgrades,options:BattleOptions={}) { this.reset(mode,floor,upgrades,options); }
  checkpoint() {
    if (!['ready', 'victory', 'defeat'].includes(this.status)) throw new Error('Checkpoint requires an encounter boundary');
    return structuredClone({ ...this, events: [] });
  }
  restoreCheckpoint(state: ReturnType<Battle['checkpoint']>) {
    if (!['ready', 'victory', 'defeat'].includes(state.status)) throw new Error('Not an encounter boundary');
    Object.assign(this, structuredClone(state));
    this.events = [];
    Reflect.deleteProperty(this, 'curse'); // pre-`curses` checkpoints carried one shared curse slot
  }
  random() { this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0; return this.seed/4294967296; }
  reset(mode:Mode,floor=1,upgrades=defaultUpgrades,options:BattleOptions={}) {
    if(mode==='endless' && options.rogueBuild!==undefined && !validRogueBuild(options.rogueBuild)) throw new Error('Invalid Roguelike build');
    if(mode==='raid' && options.raidBuild!==undefined && !validRaidBuild(options.raidBuild, options.roster ?? ROSTER.map((_,id)=>id))) throw new Error('Invalid Raid build: choose 1-6 unique roster slots');
    this.rogueBuild=mode==='endless'?normalizeRogueBuild(options.rogueBuild??createRogueBuild()):undefined;
    this.raidBuild=mode==='raid'?normalizeRaidBuild(options.raidBuild, options.roster ?? ROSTER.map((_,id)=>id)):undefined;
    this.raidSandbox=mode==='raid' && options.raidSandbox!==undefined?normalizeRaidSandbox(options.raidSandbox):undefined;
    this.mode=mode; this.floor=Math.max(1,Math.min(mode==='adventure'?CAMPAIGN.length:100,Number.isFinite(floor)?Math.floor(floor):1));
    this.power=Number.isFinite(upgrades.power)?Math.max(.1,upgrades.power):1;
    this.vitality=Number.isFinite(upgrades.vitality)?Math.max(.1,upgrades.vitality):1;
    this.tempo=Number.isFinite(upgrades.tempo)?Math.max(.1,upgrades.tempo):1;
    this.options=structuredClone(options); this.settlementId=options.settlementId??'';
    this.heroic=mode==='adventure'&&options.heroic===true; this.dungeon=mode==='dungeon'&&options.dungeon?structuredClone(options.dungeon):undefined;
    if(this.dungeon){this.power*=Math.max(1,Math.min(2,this.dungeon.power??1));this.vitality*=Math.max(1,Math.min(2,this.dungeon.vitality??1));}
    const requestedContract=options.raidContract ?? getRaidContractForEnemy(options.enemyId ?? 'dragon');
    this.raidContract=mode==='raid' ? (options.raidSandbox ? sandboxRaidContract(requestedContract) : validateRaidContract(requestedContract)) : undefined;
    this.runWallet=options.runWallet; this.runAct=options.runAct; this.runActClear=options.runActClear===true; this.runFinalClear=options.runFinalClear===true; this.boons=[...new Set(options.boons??[])].filter(id=>BOONS.some(b=>b.id===id));
    this.relics=mode==='endless'?[...new Set(options.relics??[])].filter(id=>typeof id==='string'):[];const ward=this.relics.includes(WARD_RELIC);
    this.stage=Math.max(0,Math.min(mode==='adventure'?CAMPAIGN[this.floor-1].stages.length-1:0,Number.isInteger(options.stage)?options.stage!:0));
    const defaults=mode==='adventure'?[[0,4,3],[0,4,3,2],[0,4,3,2,7],[0,4,3,2,7,1,5]][this.floor-1]??ROSTER.map((_,id)=>id):ROSTER.map((_,id)=>id);
    let ids=[...new Set(options.roster??defaults)].filter(id=>Number.isInteger(id)&&ROSTER[id]);
    if (mode==='raid' && this.raidBuild) ids=this.raidBuild.slots.map(slot=>slot.heroId);
    if (!ids.length) ids.push(0,4,3);
    this.storyRecruited=Object.freeze(mode==='adventure'||mode==='dungeon'?[...new Set(options.storyRecruited??ids)].filter(id=>Number.isInteger(id)&&ROSTER[id]):[]);
    if(mode==='adventure'||mode==='dungeon')ids=normalizeStoryParty(ids,this.storyRecruited,options.storyCleared??[]).slice(0,storyPartyCap(options.storyCleared??[]));
    if(!ids.length)ids=[0,4,3];
    if(mode==='endless')ids=[0,1,2];
    ids=ids.slice(0,GRID_SIZE);
    const occupied=new Set<number>();
    this.heroes=ids.map((id,i)=>{
      const recruit=this.rogueBuild?.recruits[id];
      const raidSlot=this.raidBuild?.slots.find(slot=>slot.heroId===id);
      const r=raidSlot?{...ROSTER[id],classId:raidSlot.classId,slot:raidSlot.slot??ROSTER[id].slot}:recruit?{name:`Recruit ${id+1}`,classId:recruit.classId,slot:[1,7,6][i]}:ROSTER[id],k=KITS[r.classId];
      // Raid heroes bring their Story progression (xp, gear, refine, talents); a raid class swap drops a mismatched job and the stored skills.
      const story=options.loadouts?.[id];
      const loadout:NonNullable<BattleOptions['loadouts']>[number]|undefined=raidSlot?{...story,skills:raidSlot.classId===ROSTER[id].classId?story?.skills??[0,1]:[0,1],talents:story?.talents??[],slot:raidSlot.slot??r.slot}:recruit?{skills:recruit.job?[JOBS[recruit.job].index,0]:[0,1],talents:[],job:recruit.job}:story;
      const talents=[...new Set(loadout?.talents??[])].filter(t=>TALENTS.some(def=>def.id===t));
      const job=JOBS[loadout?.job??'']?.base===r.classId?loadout?.job:undefined,stats=gearStats(loadout?.gear,loadout?.refine);
      const perks=talentStats(talents,r.classId),growth=levelStats(loadout?.xp),level=heroProgress(loadout?.xp).level;
      const allowed=(index:number)=>legalSkill(index,talents,job);
      let skills=[...new Set(loadout?.skills??[0,1])].filter(index=>Number.isInteger(index)&&index>=0&&index<KITS[r.classId].skills.length&&allowed(index)).slice(0,2);
      if(skills.length<2) skills=[0,1];
      let slot=loadout?.slot??(ids.length===3?[1,7,6][i]:r.slot);
      if(!Number.isInteger(slot)||slot<0||slot>8||occupied.has(slot)) slot=Array.from({length:9},(_,j)=>j).find(j=>!occupied.has(j))!;
      occupied.add(slot);
      const maxHp=Math.round(k.hp*this.vitality*stats.hp*perks.hp*growth.hp*(talents.includes('vigor')?1.18:1)*(talents.includes('vigor-2')?1.2:1));
      const total=k.skills[skills[0]].cooldown/(this.tempo*stats.tempo*perks.tempo*(talents.includes('focus')?1.1:1)*(talents.includes('focus-2')?1.08:1)*(JOBS[job??'']?.effect==='time'?1.15:1));
      return {offensiveActs:0,level,perks,equipment:stats,id,name:r.name,classId:r.classId,slot,hp:maxHp,maxHp,shield:maxHp*Math.min(.6,perks.openingBarrier+(stats.openingBarrier??0)+(talents.includes('shelter')?.2:0)+(JOBS[job??'']?.perk?.barrier??0)+(ward?WARD_RELIC_BARRIER:0)),job,gear:loadout?.gear??{},gearPower:stats.power*perks.power*growth.power,gearTempo:stats.tempo*perks.tempo,stance:skills[0],remaining:1.2+i*.25,total,fatigue:0,lastTap:-10,moveLock:0,buff:0,acts:0,talents,skills,regen:0,regenPower:0,regenSource:-1,rescued:false,combo:0,counterLeft:0,counterPower:0};
    });
    const extra=mode==='raid'||mode==='endless'?Math.max(0,Math.min(2,Math.floor(Number(options.extraPotions)||0))):0;
    this.time=0; this.gold=0; this.potions=(this.mode==='raid' && this.raidContract?.modifiers.includes('RM02') || this.heroic ? 1 : this.dungeon ? Math.max(0,Math.min(3,this.dungeon.potions??2)) : 2)+(ward?1:0)+extra;
    // Dungeon fights continue a run: heroes enter with the HP they left the last room with.
    if(this.dungeon?.startHp)for(const h of this.heroes){const ratio=this.dungeon.startHp[h.id];if(typeof ratio==='number'&&Number.isFinite(ratio)){h.hp=Math.round(h.maxHp*Math.max(0,Math.min(1,ratio)));if(h.hp<=0){h.hp=0;h.shield=0;}}} this.resolve=25; this.taps=0; this.damage=0; this.healed=0; this.blocked=0; this.dodged=0; this.relocations=0; this.seed=271828; this.eventId=0; this.events=[]; this.castCount=0; this.lastTapped=-1; this.chorusAt={}; this.selected=this.heroes[0].id;
    this.prepareStage();
  }
  private prepareStage() {
    this.status='ready'; this.stageTime=0; this.phase=1; this.pattern=0; this.threats=[]; this.minions=[]; this.delayed=[]; this.stagger=0; this.breakLeft=0; this.markLeft=0; this.targetLane=-1; this.weakenLeft=0; this.repairUsed=false; this.curses=[]; this.turrets=[]; this.delayThisCycle=0;
    for(const h of this.heroes){h.combo=0;h.counterLeft=0;}
    this.guardLeft=0; this.guardCooldown=0; this.attackIn=4.5; this.clawIn=7; this.summonIn=this.mode==='adventure'?10:16; this.purse=120;
    if(this.mode==='adventure') {
      const zone=CAMPAIGN[this.floor-1],stage=zone.stages[this.stage];
      this.stageCount=zone.stages.length; this.enemyId=stage.enemy; this.stageName=stage.name;
      this.bossMax=Math.round(stage.hp*chapterHp(this.floor)*(this.heroic?heroicScale(this.floor).hp:1));
    } else if(this.mode==='dungeon'&&this.dungeon) {
      this.stageCount=1; this.enemyId=ENEMIES[this.options.enemyId??'']?this.options.enemyId!:'wolf'; this.stageName='Undercroft';
      this.bossMax=Math.round(this.dungeon.hp*chapterHp(this.dungeon.chapter));
    } else {
      const endless=Object.values(ENEMIES).filter(e=>e.archetype===e.id).map(e=>e.id);
      const requestedEnemy = this.options.enemyId ?? (this.mode === 'raid' ? this.raidContract?.bossId : undefined);
      this.enemyId=ENEMIES[requestedEnemy??'']?requestedEnemy!:this.mode==='endless'?endless[(this.floor-1)%endless.length]:'dragon';
      if (this.mode === 'raid' && this.raidContract?.bossId !== ENEMIES[this.enemyId]?.archetype) this.raidContract = validateRaidContract(undefined);
      this.stageCount=1; this.stageName=this.mode==='endless'?`Descent ${this.floor}`:this.raidContract?.sandbox?'Practice arena · no Crystal':'Raid contract';
      const hpScale=this.mode==='raid' ? this.raidSandbox?.hpScale ?? 1 : 1;
      // Raids follow the story curve: a raid at level N is a tougher version of chapter N's boss for the party size of that point.
      // A party smaller than that chapter's story party faces less HP and (more gently, RAID_PARTY_DMG) lighter hits.
      const ch=Math.min(CAMPAIGN.length,this.floor);this.raidParty=this.mode==='raid'?this.heroes.length/storyPartyCap(Array.from({length:ch-1},(_,i)=>i)):1;
      const raidHp=()=>CAMPAIGN[ch-1].stages.at(-1)!.hp*chapterHp(ch)*RAID_HP*Math.pow(1.15,Math.max(0,this.floor-CAMPAIGN.length))*Math.pow(this.raidParty,.9);
      this.bossMax=Math.round((this.mode==='endless'?ENDLESS_HP*Math.pow(this.heroes.length/3,.9)*Math.pow(ENDLESS_HP_GROWTH,this.floor-1):raidHp()*(this.raidTier()?.hp??1))*ENEMIES[this.enemyId].hp*hpScale);
    }
    // A story stage may rename its enemy (Vharok's chapters name what rides him); art and patterns stay the archetype's.
    const stage=this.mode==='adventure'?CAMPAIGN[this.floor-1].stages[this.stage]:undefined;
    this.bossHp=this.bossMax; this.enemyName=stage?.enemyName??ENEMIES[this.enemyId].name; this.enemyTitle=stage?.enemyTitle??ENEMIES[this.enemyId].title;
  }
  nextWave() {
    if(this.mode!=='adventure'||this.status!=='victory'||this.stage+1>=this.stageCount) return false;
    this.stage++; this.events=[]; this.prepareStage(); return true;
  }
  upgradeRogue(id:number,jobId:string) {
    if(this.mode!=='endless'||!this.rogueBuild||!['ready','victory'].includes(this.status)||!this.hero(id))return false;
    if(!promoteRogue(this.rogueBuild,id,jobId))return false;
    const h=this.hero(id)!,j=JOBS[jobId];
    h.job=jobId;h.skills=[0,j.index];h.stance=j.index;h.total=this.cooldown(h);h.remaining=h.total;
    if(j.perk?.barrier)h.shield=Math.max(h.shield,h.maxHp*j.perk.barrier);
    return true;
  }
  abandonRogue() {
    if(this.mode!=='endless')return;
    this.rogueBuild=undefined;delete this.options.rogueBuild;
    for(const h of this.heroes){delete h.job;h.skills=[0,1];h.stance=0;h.total=this.cooldown(h);h.remaining=h.total;h.shield=0;}
    if(['ready','fighting','paused'].includes(this.status))this.status='defeat';
  }
  emit(event:BattleEvent) { this.events.push(event); if(this.events.length>500)this.events.splice(0,this.events.length-500); }
  drain() { return this.events.splice(0); }
  living() { return this.heroes.filter(h=>h.hp>0); }
  hero(id:number) { return this.heroes.find(h=>h.id===id); }
  availableSkills(id:number) { return [...(this.hero(id)?.skills??[])]; }
  start() { if(this.status==='ready') {this.status='fighting';this.emit({type:'banner',kind:'stage',text:this.stageName.toUpperCase()});} }
  pause() { if(this.status==='fighting')this.status='paused';else if(this.status==='paused')this.status='fighting'; }
  /** HP that damage dealt is measured against for resolve: the chapter's final boss in Story and the Undercroft, the boss itself elsewhere. */
  resolveRef() { return Math.max(1,this.mode==='adventure'?chapterBoss(this.floor):this.mode==='dungeon'?chapterBoss(this.dungeon?.chapter??1):this.bossMax); }
  private gainResolve(amount:number) { this.resolve=Math.min(100,this.resolve+amount*(this.boons.includes('resolve')?1.6:1)); }
  private cooldown(h:Hero) { return KITS[h.classId].skills[h.stance].cooldown/(this.tempo*h.gearTempo*(h.talents.includes('focus')?1.1:1)*(h.talents.includes('focus-2')?1.08:1)*(JOBS[h.job??'']?.effect==='time'?1.15:1)); }
  tap(id:number,sync=false) {
    const h=this.hero(id);
    if(!h||h.hp<=0||this.status!=='fighting'||h.moveLock>0||this.time-h.lastTap<.11)return false;
    const amount=((sync?.88:.64)+(h.talents.includes('momentum')?.2:0)+h.perks.tapBonus+(h.equipment.tapBonus??0))*(h.fatigue>70?.14:h.fatigue>40?.5:1);
    h.remaining=Math.max(0,h.remaining-amount);h.fatigue=Math.min(100,h.fatigue+5.5);h.lastTap=this.time;this.taps++;
    this.gainResolve(.3);
    if(this.boons.includes('chorus')&&this.lastTapped!==id&&this.time-(this.chorusAt[id]??-99)>=CHORUS_EVERY){h.buff=Math.max(h.buff,CHORUS_BUFF);this.chorusAt[id]=this.time;}
    this.lastTapped=id;
    this.emit({type:'tap',source:id,slot:h.slot,amount,text:sync?'SYNC!':`−${amount.toFixed(1)}s`});
    if(this.boons.includes('ember')&&this.taps%3===0)this.hitBoss(18*this.power,id,'fire');
    return true;
  }
  stance(id:number,index:number) {
    const h=this.hero(id); if(!h||h.hp<=0||!['ready','fighting'].includes(this.status)||!Number.isInteger(index)||!h.skills.includes(index)||index===h.stance)return false;
    const ratio=h.remaining/h.total;h.stance=index;h.total=this.cooldown(h);h.remaining=ratio*h.total;
    this.emit({type:'stance',source:id,text:KITS[h.classId].skills[index].name});return true;
  }
  move(id:number,slot:number) {
    const h=this.hero(id);if(!h||h.hp<=0||!Number.isInteger(slot)||slot<0||slot>8||slot===h.slot||h.moveLock>0||!['ready','fighting'].includes(this.status))return false;
    const other=this.heroes.find(a=>a.slot===slot);if(other&&other.moveLock>0)return false;
    const previous=h.slot;h.slot=slot;if(other)other.slot=previous;
    const penalty=this.boons.includes('fleet')?FLEET_MOVE_PENALTY:MOVE_PENALTY;
    if(this.status==='fighting') for(const ally of [h,other])if(ally&&ally.hp>0){ally.remaining+=ally.talents.includes('evasive')?Math.min(.45,penalty):penalty;ally.moveLock=.65;if(this.boons.includes('fleet'))this.shield(ally,30);}
    this.relocations++;this.emit({type:'move',source:id,slot,targets:other?[other.id]:[],text:this.status==='fighting'?`+${penalty}s`:'FORMATION'});return true;
  }
  potion() { if(this.status!=='fighting'||this.potions<=0)return false;this.potions--;for(const h of this.living())this.heal(h,h.maxHp*POTION_HEAL);this.emit({type:'banner',kind:'potion',text:'MENDING MIST'});return true; }
  guard() { if(this.status!=='fighting'||this.guardCooldown>0)return false;this.guardLeft=GUARD_DURATION;this.guardCooldown=this.boons.includes('bell')?15:18;if(this.boons.includes('bell'))this.gainResolve(18);this.emit({type:'shield',text:'PARTY GUARD · 65% REDUCTION',targets:this.living().map(h=>h.slot)});return true; }
  ultimate() {
    if(this.status!=='fighting'||this.resolve<100)return false;this.resolve=0;
    this.living().forEach(h=>{this.heal(h,h.maxHp*ULT_HEAL*this.power);this.shield(h,h.maxHp*ULT_SHIELD);});
    this.hitBoss(ULT_BASE+this.bossMax*ULT_DAMAGE,-1,'ultimate');
    for(const m of this.minions.filter(m=>m.hp>0))this.hitMinion(m,m.hp,-1,'ultimate');
    this.emit({type:'ultimate',text:'NINEFOLD DAWN'});return true;
  }
  tick(dt:number) {
    if(this.status!=='fighting'||!Number.isFinite(dt)||dt<=0)return;
    if(dt>.05){for(let remaining=Math.min(dt,30);remaining>1e-9;remaining-=.05)this.tick(Math.min(.05,remaining));return;}
    if(this.finish())return;
    const before=this.stageTime;this.time+=dt;this.stageTime+=dt;
    if(before<ENRAGE_WARN&&this.stageTime>=ENRAGE_WARN)this.emit({type:'enrage',kind:'warn',text:`ENRAGE IN ${ENRAGE_AT-ENRAGE_WARN}s`});
    if(before<=ENRAGE_AT&&this.stageTime>ENRAGE_AT)this.emit({type:'enrage',kind:'on',text:'ENRAGED'});
    const oldPhase=this.phase;this.phase=this.bossHp/this.bossMax>.65?1:this.bossHp/this.bossMax>.3?2:3;
    if(this.phase!==oldPhase)this.emit({type:'phase',text:`${this.enemyName.toUpperCase()} · PHASE ${this.phase}`});
    if(this.phase>oldPhase&&this.pact('RM05'))this.summon();
    this.breakLeft=Math.max(0,this.breakLeft-dt);this.guardLeft=Math.max(0,this.guardLeft-dt);this.guardCooldown=Math.max(0,this.guardCooldown-dt);this.markLeft=Math.max(0,this.markLeft-dt);this.weakenLeft=Math.max(0,this.weakenLeft-dt);
    for(const c of this.curses){c.left-=dt;c.tick-=dt;if(c.tick<=0){c.tick+=1;this.hitBoss(c.power,c.source,'curse');}}
    this.curses=this.curses.filter(c=>c.left>0);
    for(const t of this.turrets){t.left-=dt;t.tick-=dt;if(t.tick<=0){t.tick+=1;this.attack(t.source,t.lane,t.power,'arrow');}}
    this.turrets=this.turrets.filter(t=>t.left>0);
    for(const h of this.heroes){
      if(h.hp<=0)continue;
      h.moveLock=Math.max(0,h.moveLock-dt);h.buff=Math.max(0,h.buff-dt);h.counterLeft=Math.max(0,h.counterLeft-dt);
      if(h.regen>0){this.heal(h,h.regenPower*dt,this.hero(h.regenSource));h.regen=Math.max(0,h.regen-dt);}
      if(this.time-h.lastTap>.5)h.fatigue=Math.max(0,h.fatigue-dt*32*(h.talents.includes('composure')?1.5:1));
      h.remaining=Math.max(0,h.remaining-dt*(h.buff>0?1.2:1));
      if(h.remaining<=0&&h.moveLock<=0){this.act(h);h.total=this.cooldown(h);h.remaining=h.total;}
    }
    for(const d of [...this.delayed]){d.left-=dt;if(d.left<=0){this.attack(d.source,d.lane,d.power,'burst');this.delayed.splice(this.delayed.indexOf(d),1);}}
    if(this.finish())return;
    this.attackIn-=dt;this.clawIn-=dt;this.summonIn-=dt;
    if(this.attackIn<=0&&this.breakLeft<=0){this.telegraph();this.attackIn=this.intentInterval();}
    if(this.clawIn<=0&&this.breakLeft<=0){const h=this.living().sort((a,b)=>a.slot-b.slot)[0];if(h){this.hurt(h,(CLAW_BASE+this.phase*6)*this.enemyScale(),{kind:'claw'});this.emit({type:'claw',slot:h.slot});}this.clawIn=CLAW_EVERY*(this.raidSandbox?.intervalScale??1);}
    if(this.summonIn<=0){this.summon();this.summonIn=25*(this.raidSandbox?.intervalScale??1);}
    for(const t of [...this.threats]){
      if(t.targetId!==undefined){const target=this.hero(t.targetId);t.slots=target&&target.hp>0?[target.slot]:[];}
      t.left-=dt;
      if(t.left<=0){if(t.effect==='mend'&&this.bossHp>0){this.bossHp=Math.min(this.bossMax,this.bossHp+Math.round(this.bossMax*MEND_HEAL));this.emit({type:'banner',text:'THE WOUND CLOSES'});}
        const hit:number[]=[];let total=0;
        for(const slot of t.slots){const h=this.heroes.find(a=>a.slot===slot&&a.hp>0);if(h){total+=this.hurt(h,(t.damage??83)*this.enemyScale(),{kind:'impact',name:t.name});hit.push(h.id);h.combo=0;if(t.effect==='silence'&&this.guardLeft<=0)h.remaining=Math.min(h.total,h.remaining+1.5);}else this.dodged++;}this.emit({type:'impact',targets:t.slots,kind:t.type,name:t.name,hit,amount:total});this.threats.splice(this.threats.indexOf(t),1);
        if(t.type==='all'&&this.pact('RM03')){const slot=this.aftershock(this.living());if(slot!==undefined)this.emit({type:'warning',text:'AFTERSHOCK',targets:[slot]});}}
    }
    for(const m of this.minions){if(m.hp<=0)continue;m.timer-=dt;if(m.timer<=0){const h=this.living().filter(a=>a.slot%3===m.lane).sort((a,b)=>a.slot-b.slot)[0]??this.living().sort((a,b)=>a.hp-b.hp)[0];if(h){this.hurt(h,MINION_HIT*this.enemyScale(),{kind:'minion'});this.emit({type:'minionAttack',slot:h.slot,lane:m.lane});}m.timer=5.5;}}
    this.minions=this.minions.filter(m=>m.hp>0);this.finish();
  }
  private finish() {
    // Boss death is checked first: a boss that falls on the same frame as the last hero is a victory.
    if(this.bossHp<=0){this.status='victory';if(this.rogueBuild)rewardRogueRoom(this.rogueBuild,this.floor);this.gold+=this.mode==='adventure'?20+this.stage*12+this.floor*6:this.mode==='dungeon'?0:80+this.floor*15;this.emit({type:'victory'});return true;}
    if(!this.living().length){this.status='defeat';this.abandonRogue();this.emit({type:'defeat'});return true;}
    return false;
  }
  enemyScale() { return (this.mode==='adventure'?chapterDmg(this.floor)*(this.heroic?heroicScale(this.floor).dmg:1):this.mode==='dungeon'?this.dungeon?.damage??chapterDmg(this.floor):this.mode==='endless'?ENDLESS_DMG*Math.pow(ENDLESS_DMG_GROWTH,this.floor-1)*(1+(ENDLESS_EARLY_DMG-1)*Math.max(0,Math.min(1,(ENDLESS_EARLY_FLOORS+3-this.floor)/3))):RAID_DMG*chapterDmg(this.floor)*Math.pow(1.06,Math.max(0,this.floor-CAMPAIGN.length)))*(this.enraged()?ENRAGE_DMG:1)*(this.mode==='raid'?(this.raidSandbox?.damageScale??1)*(this.raidTier()?.dmg??1)*Math.pow(Math.min(1,this.raidParty),RAID_PARTY_DMG):1); }
  /** Past ENRAGE_AT seconds of the stage enemy hits land ENRAGE_DMG times harder. */
  enraged() { return this.stageTime>ENRAGE_AT; }
  /** The certified contract tier's scale; undefined outside rewarded raids (sandbox practice uses its sliders). */
  raidTier() { const c=this.mode==='raid'?this.raidContract:undefined;return c&&!c.sandbox?RAID_TIER_SCALE[c.tier]:undefined; }
  /** Stagger needed for an armour break: a share of the boss's HP, capped by a cap that grows with the chapter. */
  staggerThreshold() { const ch=this.mode==='dungeon'?this.dungeon?.chapter??1:Math.min(CAMPAIGN.length,this.floor);return Math.min(this.bossMax*STAGGER_SHARE,STAGGER_CAP*Math.pow(STAGGER_CAP_GROWTH,ch-1)); }
  /** Seconds between two telegraphs at the current phase. */
  intentInterval() { return (ENEMIES[this.enemyId].interval-(this.phase-1)*.6)*(this.raidSandbox?.intervalScale??1)*(this.heroic?HEROIC_INTERVAL:1); }
  /** Push the next intent back, within this cycle's control budget and the 14 s cap; returns the seconds actually added. */
  private delayIntent(amount:number) {
    const before=this.attackIn,room=Math.max(0,Math.max(CONTROL_MIN,CONTROL_SHARE*this.intentInterval())-this.delayThisCycle);
    this.attackIn=Math.max(before,Math.min(14,before+Math.min(amount,room)));this.delayThisCycle+=this.attackIn-before;return this.attackIn-before;
  }
  pact(id:RaidModifierId) { return this.mode==='raid'&&this.raidContract?.modifiers.includes(id)===true; }
  telegraph() {
    const enemy=ENEMIES[this.enemyId],intent:Intent=enemy.patterns[this.pattern++%enemy.patterns.length];this.delayThisCycle=0;
    let slots:number[]=[],targetId:number|undefined,type:Telegraph['type']='meteor',name='',counter='',effect:Telegraph['effect'];
    const alive=this.living();if(!alive.length)return;
    if(intent==='weakest'||intent==='strongest'){
      const candidates=[...alive].sort((a,b)=>intent==='weakest'?a.hp-b.hp||a.id-b.id:this.threatPower(b)-this.threatPower(a)||a.id-b.id);
      const target=candidates[0];targetId=target.id;slots=[target.slot];type='target';name=threatName(this.enemyId,intent);counter='MARKED: mengikuti hero. Heal target, siapkan shield atau Party Guard.';
    }else if(intent==='front'){
      const row=Math.min(...alive.map(h=>Math.floor(h.slot/3)));slots=[row*3,row*3+1,row*3+2];type='front';name=threatName(this.enemyId,intent);counter='GROUND: keluar dari row yang ditandai setelah telegraph muncul.';
    }else if(intent==='breath'){
      const counts=[0,1,2].map(lane=>alive.filter(h=>h.slot%3===lane).length);const lane=counts.indexOf(Math.max(...counts));slots=[lane,lane+3,lane+6];type='breath';name=threatName(this.enemyId,intent);counter='GROUND: pindah ke lane lain. Lokasi impact tidak mengikuti hero.';
    }else if(intent==='silence'){
      slots=Array.from({length:9},(_,i)=>i);type='all';effect='silence';name=threatName(this.enemyId,intent);counter='ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Tanpa itu, semua cooldown hero mundur 1,5 detik.';
    }else if(intent==='mend'){
      slots=[];type='channel';effect='mend';name=threatName(this.enemyId,intent);counter='CHANNEL: putus dengan skill interrupt sebelum selesai, atau boss pulih 5% HP.';
    }else if(intent==='all'){
      slots=Array.from({length:9},(_,i)=>i);type='all';name=threatName(this.enemyId,intent);counter='ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Pindah tile tidak membantu.';
    }else{
      const candidates=[...alive];while(slots.length<Math.min(3,alive.length)){const i=Math.floor(this.random()*candidates.length);slots.push(candidates.splice(i,1)[0].slot);}type='meteor';name=threatName(this.enemyId,intent);counter='GROUND: pindahkan hero ke tile aman. Tanda tetap di tanah.';
    }
    // Story parties stop at eight, so a tile is always free, but a marked row or lane can still cover it: point at the counters that still work.
    if((type==='front'||type==='breath'||type==='meteor')&&Array.from({length:9},(_,i)=>i).every(i=>slots.includes(i)||alive.some(h=>h.slot===i)))counter=NO_SAFE_TILE;
    const total=type==='all'||type==='channel'?4.2:3.2;
    this.threats.push({id:this.eventId++,name,type,slots,left:total,total,targetId,counter,effect,damage:enemy.damage*TELEGRAPH_SHARE*(effect==='silence'?.5:type==='all'?.85:1)*(1+(this.phase-1)*.1)});
    this.emit({type:'warning',text:name,targets:slots});
    if(this.phase>=2&&(this.enemyId.startsWith('dragon')&&intent==='meteor'||this.heroic&&(intent==='meteor'||intent==='front'||intent==='breath'))){
      this.aftershock(alive);
    }
  }
  /** A delayed second blast on one living hero's tile (dragon/Heroic phase 2+, RM03 after an all-grid impact). */
  private aftershock(alive:Hero[]) {
    if(!alive.length)return undefined;
    const slot=alive[Math.floor(this.random()*alive.length)].slot;
    this.threats.push({id:this.eventId++,name:'AFTERSHOCK',type:'meteor',slots:[slot],left:5,total:5,damage:75,counter:'GROUND: ledakan kedua tertunda. Jangan buru-buru kembali ke tile ini.'});
    return slot;
  }
  private skillPower(h:Hero,precise=false) {
    const s=KITS[h.classId].skills[h.stance],effect=JOBS[h.job??'']?.effect;
    let value=this.power*h.gearPower*(h.talents.includes('mastery')?1.18:1)*(h.talents.includes('mastery-2')?1.2:1);
    if(effect==='sanctuary'&&['shield','partyshield'].includes(s.kind))value*=1.35;
    if(effect==='rage'&&h.hp/h.maxHp<.5)value*=1.4;
    if(effect==='execute'&&this.bossHp/this.bossMax<.4)value*=1.35;
    if(effect==='precision'&&precise)value*=1.6;
    if(effect==='mercy'&&['heal','regen'].includes(s.kind))value*=1.3;
    if(effect==='elements'&&s.kind==='aoe')value*=1.3;
    return value;
  }
  private threatPower(h:Hero) { const s=KITS[h.classId].skills[h.stance];return s.power/this.cooldown(h)*this.skillPower(h)*(h.buff>0?1.3:1); }
  summon() {
    const lanes=this.heroes.length<=3?[1]:this.heroes.length<=5?[0,2]:[0,1,2];
    let spawned=0;
    for(const lane of lanes){if(this.minions.some(m=>m.lane===lane&&m.hp>0))continue;spawned++;const hp=Math.round(this.mode==='adventure'?MINION_HP*chapterBoss(this.floor)*(this.heroic?heroicScale(this.floor).hp:1):this.mode==='dungeon'?MINION_HP*chapterBoss(this.dungeon?.chapter??1):170*Math.pow(1.1,this.floor-1));this.minions.push({id:this.eventId++,lane,hp,maxHp:hp,timer:MINION_FIRST,enemyId:['wolf','spider','goblin'][(this.stage+lane)%3]});}
    if(spawned)this.emit({type:'summon',text:'REINFORCEMENTS'});
    return spawned;
  }
  act(h:Hero) {
    if(h.hp<=0)return;
    const s=KITS[h.classId].skills[h.stance],job=JOBS[h.job??''],perk=job?.perk,offensive=!SUPPORT_KINDS.includes(s.kind);h.acts++;
    if(offensive){this.castCount++;h.offensiveActs++;}
    let p=s.power*this.skillPower(h,offensive&&h.offensiveActs%3===0)*(h.buff>0?1.3:1);const lane=h.slot%3,heals=1+h.perks.heal+(h.equipment.heal??0);
    if(['heal','regen'].includes(s.kind))p*=heals;
    if(['shield','partyshield'].includes(s.kind))p*=1+h.perks.shield+(h.equipment.shield??0);
    this.emit({type:'cast',source:h.id,slot:h.slot,kind:s.kind,text:s.name,color:KITS[h.classId].color});
    if(h.talents.includes('resolve')||job?.effect==='hymn')this.gainResolve(2);
    if(perk?.intentDelay)this.delayIntent(perk.intentDelay);
    if(this.boons.includes('frost')){this.delayIntent(.16);this.gainResolve(1);}
    if(s.kind==='shield'||s.kind==='partyshield'){
      this.living().filter(a=>s.kind==='partyshield'||a.slot%3===lane).forEach(a=>this.shield(a,p));
      if(h.classId==='rogue')h.buff=Math.max(2,h.buff);
    }else if(s.kind==='heal'){
      const lowest=this.living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(lowest)this.heal(lowest,p,h);this.living().forEach(a=>this.heal(a,20*this.skillPower(h),h));
    }else if(s.kind==='regen'){
      // Overlapping regens keep the stronger flow; a recast refreshes the duration instead of stacking.
      this.living().forEach(a=>{if(a.regen<=0||p>=a.regenPower){a.regenPower=p;a.regenSource=h.id;}a.regen=Math.max(a.regen,6);});
    }else if(s.kind==='buff'){
      this.living().forEach(a=>{a.buff=Math.max(a.buff,job?.effect==='hymn'?10:7);this.emit({type:'buff',source:a.id,slot:a.slot});});
    }else if(s.kind==='haste'){
      // Seconds, not power: gear and level make it stronger only slightly so tempo cannot run away.
      const seconds=s.power*Math.min(1.5,1+(this.skillPower(h)-1)*.2);
      this.living().forEach(a=>{if(a!==h)a.remaining=Math.max(0,a.remaining-seconds);this.emit({type:'buff',source:a.id,slot:a.slot});});
    }else if(s.kind==='delay'||s.kind==='stun'){
      // The boss's next intent is pushed back (claws and live telegraphs keep going): say so, and keep BREAK for real armour breaks.
      const added=this.delayIntent(s.power);
      if(s.kind==='stun')this.addStagger(120*this.skillPower(h));
      this.emit({type:'stun',source:h.id,kind:s.kind,amount:added,text:added>=.05?`DELAYED +${added.toFixed(1)}s`:'RESISTED'});
    }else if(s.kind==='resolve'){
      this.gainResolve(s.power);
    }else if(s.kind==='selfheal'){
      this.heal(h,h.maxHp*s.power*Math.min(1.5,1+(this.skillPower(h)-1)*.3),h);h.fatigue=0;
    }else if(s.kind==='repair'){
      if(!this.repairUsed&&this.potions<3){this.potions++;this.repairUsed=true;this.emit({type:'buff',source:h.id,slot:h.slot,text:'+1 POTION'});}
    }else if(s.kind==='counter'){
      h.counterLeft=3.5;h.counterPower=p;this.emit({type:'buff',source:h.id,slot:h.slot,kind:'counter',text:'COUNTER'});
    }else{
      if(s.kind==='interrupt'){
        const active=this.threats.filter(t=>t.type==='all'||t.type==='channel');this.threats=this.threats.filter(t=>t.type!=='all'&&t.type!=='channel');
        if(active.length)this.emit({type:'interrupt',source:h.id,name:active.map(t=>t.name).join(' · '),text:'RITUAL INTERRUPTED'});
        this.hitBoss(p,h.id,'magic');
      }else if(s.kind==='mark'){
        this.hitBoss(p,h.id,'slash');this.markLeft=4;this.emit({type:'buff',kind:'mark',text:'MARK +20%'});
      }else if(s.kind==='weaken'){
        this.hitBoss(p,h.id,'magic');this.weakenLeft=5;this.emit({type:'buff',kind:'weaken',text:'WEAKEN -25%'});
      }else if(s.kind==='curse'){
        // One curse per hexer: a recast refreshes only that caster's curse and keeps its tick phase.
        const old=this.curses.find(c=>c.source===h.id);this.curses=this.curses.filter(c=>c!==old);this.curses.push({source:h.id,left:6,power:p,tick:old?Math.min(1,old.tick):1});this.emit({type:'buff',kind:'curse',text:'CURSE'});
      }else if(s.kind==='drain'){
        this.attack(h.id,lane,p,'magic');const lowest=this.living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(lowest)this.heal(lowest,p*.5*heals,h);
      }else if(s.kind==='sacrifice'){
        const cost=Math.min(h.hp-1,Math.round(h.maxHp*.08));if(cost>0){h.hp-=cost;this.emit({type:'hurt',source:h.id,slot:h.slot,amount:cost,text:'PACT'});}this.hitBoss(p,h.id,'magic');
      }else if(s.kind==='combo'){
        h.combo=Math.min(5,h.combo+1);this.attack(h.id,lane,p*(1+.12*(h.combo-1)),'slash');
      }else if(s.kind==='flurry'){
        this.attack(h.id,lane,p,'slash');this.addStagger(p);
      }else if(s.kind==='turret'){
        this.turrets=this.turrets.filter(t=>t.source!==h.id);this.turrets.push({lane,left:6,power:p,source:h.id,tick:1});this.emit({type:'buff',source:h.id,slot:h.slot,kind:'turret',text:'TURRET'});
      }else if(s.kind==='steal'){
        this.attack(h.id,lane,p,'steal');const amount=Math.min(8,this.purse);this.purse-=amount;this.gold+=amount;if(amount)this.emit({type:'coin',source:h.id,slot:h.slot,amount});
      }else if(s.kind==='aoe'){
        if(h.classId==='wizard'||h.classId==='warrior'){this.hitBoss(p,h.id,'nova');for(const m of this.minions)this.hitMinion(m,p*.6,h.id,'nova');}
        else{const enemies=this.minions.filter(m=>m.hp>0);if(enemies.length)enemies.forEach(m=>this.hitMinion(m,p/enemies.length*1.7,h.id,'arrow'));else this.hitBoss(p,h.id,'arrow');}
      }else if(h.classId==='wizard'&&h.stance===2){this.delayed.push({left:1.5,source:h.id,lane:this.targetLane,power:p});this.emit({type:'bomb',source:h.id,lane:this.targetLane});}
      else this.attack(h.id,(h.classId==='archer'||h.classId==='wizard')?this.targetLane:lane,p,h.classId==='archer'?'arrow':h.classId==='wizard'?'magic':'slash');
      if(h.perks.echo&&h.offensiveActs%5===0)this.hitBoss(p*h.perks.echo,h.id,'magic');
      if(h.perks.leech)this.heal(h,p*h.perks.leech*heals,h);
      if(this.boons.includes('storm')&&this.castCount%5===0)this.hitBoss(p*.55,h.id,'magic');
      if(perk?.echo&&h.offensiveActs%5===0)this.hitBoss(p*perk.echo,h.id,'magic');
      if(job?.effect==='leech')this.heal(h,p*.12*heals,h);
      if(perk?.castLeech)this.heal(h,p*perk.castLeech*heals,h);
    }
  }
  attack(source:number,lane:number,power:number,kind:string) { const m=this.minions.find(m=>m.lane===lane&&m.hp>0);if(m)this.hitMinion(m,power,source,kind);else this.hitBoss(power,source,kind); }
  hitMinion(m:Minion,amount:number,source:number,kind:string) {
    if(m.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    const killer=this.hero(source),minionHeal=JOBS[killer?.job??'']?.perk?.minionHeal;
    if(JOBS[killer?.job??'']?.effect==='hunter')amount*=1.45;
    amount*=(1+(killer?.perks.minionDamage??0))*(this.markLeft>0?MARK_DAMAGE:1);
    const actual=Math.min(m.hp,amount);m.hp=Math.max(0,m.hp-amount);this.damage+=actual;this.gainResolve(actual/this.resolveRef()*RESOLVE_MINION);this.emit({type:'projectile',source,lane:m.lane,amount:actual,kind});
    if(m.hp===0&&minionHeal)this.living().forEach(h=>this.heal(h,minionHeal,killer));
    if(m.hp===0){this.emit({type:'minionDown',lane:m.lane});if(this.boons.includes('feast'))this.living().forEach(h=>this.heal(h,24));}
  }
  addStagger(amount:number) {
    if(this.breakLeft>0||this.bossHp<=0)return;
    this.stagger+=amount*.23;
    if(this.stagger>=this.staggerThreshold()){this.stagger=0;this.breakLeft=BREAK_SECONDS;this.emit({type:'break',text:'ARMOR BREAK · +60% DMG'});}
  }
  hitBoss(amount:number,source:number,kind:string) {
    if(!Number.isFinite(amount)||amount<=0||this.bossHp<=0)return;
    const execute=this.boons.includes('execution')&&this.bossHp/this.bossMax<.3;
    const dmg=Math.min(this.bossHp,Math.round(amount*(this.breakLeft>0?BREAK_DAMAGE:1)*(this.markLeft>0?MARK_DAMAGE:1)*(execute?1.4:1)));
    this.bossHp=Math.max(0,this.bossHp-dmg);this.damage+=dmg;this.gainResolve(dmg/this.resolveRef()*RESOLVE_DEALT);
    this.addStagger(amount);
    this.emit({type:'projectile',source,lane:-1,amount:dmg,kind});
  }
  private shield(h:Hero,amount:number) { if(h.hp<=0)return;const gained=Math.min(h.maxHp*.6-h.shield,amount*(this.pact('RM01')?RM01_BARRIER:1));h.shield+=Math.max(0,gained);if(gained>1)this.emit({type:'shield',source:h.id,slot:h.slot,amount:gained}); }
  /** Heal a hero; `source` is the healer, whose job perk can turn overheal on the target into barrier (Ember Seraph). */
  heal(h:Hero,amount:number,source?:Hero) {
    if(h.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    if(h.talents.includes('recovery'))amount*=1.15;
    const value=Math.min(amount,h.maxHp-h.hp),over=amount-value,barrier=JOBS[source?.job??'']?.perk?.overhealBarrier;h.hp+=value;this.healed+=value;
    if(barrier)this.shield(h,over*barrier);
    if(h.perks.overheal)this.shield(h,over*h.perks.overheal);
    if(this.boons.includes('tide'))this.shield(h,over*.35);
    if(value>1)this.emit({type:'heal',source:h.id,slot:h.slot,amount:value});
  }
  /** Damage a hero; `cause` names the source for the KO log. Returns the HP actually lost. */
  hurt(h:Hero,amount:number,cause?:{kind:string;name?:string}) {
    if(h.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
    if(h.talents.includes('fortitude'))amount*=.9;
    if(this.weakenLeft>0)amount*=WEAKEN_DAMAGE;
    if(h.counterLeft>0){amount*=.5;this.hitBoss(h.counterPower,h.id,'slash');}
    amount*=1-Math.min(.45,h.perks.reduction+(h.equipment.reduction??0));
    const guard=this.guardLeft>0?amount*GUARD_REDUCTION:0;amount-=guard;
    const absorbed=Math.min(h.shield,amount);h.shield-=absorbed;this.blocked+=absorbed+guard;
    const dmg=Math.round(amount-absorbed),lost=Math.min(h.hp,dmg);h.hp=Math.max(0,h.hp-dmg);this.gainResolve(amount/Math.max(1,this.heroes.reduce((s,a)=>s+a.maxHp,0))*RESOLVE_TAKEN);
    if(this.boons.includes('thorn'))this.hitBoss((absorbed+guard)*.35,h.id,'thorn');
    if(h.perks.thorns)this.hitBoss((absorbed+guard)*h.perks.thorns,h.id,'thorn');
    // Nobody is downed once the boss has fallen: a counter or thorn kill on this hit leaves the hero standing at 1 HP.
    if(h.hp===0&&this.bossHp<=0)h.hp=1;
    this.emit({type:'hurt',source:h.id,slot:h.slot,amount:dmg,text:absorbed+guard>0?'BLOCK':''});
    if(h.hp===0&&this.boons.includes('lifeline')&&!h.rescued){h.rescued=true;h.hp=Math.round(h.maxHp*.2);this.emit({type:'heal',source:h.id,slot:h.slot,amount:h.hp,text:'NOT YET'});}
    else if(h.hp===0)this.emit({type:'down',source:h.id,slot:h.slot,kind:cause?.kind,name:cause?.name});
    return lost;
  }
  /** The live channel telegraph (Mending Rite) and how far it has run, 0..1. */
  channel() { const t=this.threats.find(t=>t.type==='channel');return t?{name:t.name,left:t.left,total:t.total,progress:Math.max(0,Math.min(1,1-t.left/t.total))}:undefined; }
  snapshot() { return {rogueBuild:this.rogueBuild?normalizeRogueBuild(this.rogueBuild):undefined,status:this.status,mode:this.mode,floor:this.floor,stage:this.stage,stageCount:this.stageCount,enemyId:this.enemyId,time:this.time,bossHp:this.bossHp,bossMax:this.bossMax,phase:this.phase,resolve:this.resolve,gold:this.gold,taps:this.taps,relocations:this.relocations,potions:this.potions,guardLeft:this.guardLeft,guardCooldown:this.guardCooldown,stageTime:this.stageTime,enraged:this.enraged(),breakLeft:this.breakLeft,markLeft:this.markLeft,weakenLeft:this.weakenLeft,boons:[...this.boons],curses:this.curses.map(c=>({...c})),turrets:this.turrets.map(t=>({lane:t.lane,left:t.left,source:t.source})),channel:this.channel(),heroes:this.heroes.map(h=>({...h,skills:[...h.skills],talents:[...h.talents]})),threats:this.threats.map(t=>({...t,slots:[...t.slots]})),minions:this.minions.map(m=>({...m}))}; }
}
