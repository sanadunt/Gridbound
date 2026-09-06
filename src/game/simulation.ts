import { JOBS, gearStats, legalSkill } from './jobs';
import { TALENTS } from './profile';
import { KITS, ROSTER, type ClassId, type Mode } from './content';
import { CAMPAIGN, ENEMIES, BOONS, type Intent } from './world';
export type Hero = { id:number; name:string; classId:ClassId; slot:number; hp:number; maxHp:number; shield:number; stance:number; remaining:number; total:number; fatigue:number; lastTap:number; moveLock:number; buff:number; acts:number; talents:string[]; skills:number[]; regen:number; regenPower:number; rescued:boolean; job?:string; gear:Record<string,string>; gearPower:number; gearTempo:number };
export type Telegraph = { id:number; name:string; type:'front'|'meteor'|'breath'|'target'|'all'; slots:number[]; left:number; total:number; targetId?:number; counter?:string; damage?:number };
export type Minion = { id:number; lane:number; hp:number; maxHp:number; timer:number; enemyId?:string };
export type BattleEvent = { type:string; source?:number; slot?:number; lane?:number; amount?:number; color?:string; text?:string; targets?:number[]; kind?:string };
export type Status = 'ready'|'fighting'|'paused'|'victory'|'defeat';
export type BattleOptions = { roster?:number[]; loadouts?:Record<number,{skills:number[];talents:string[];slot?:number;job?:string;gear?:Record<string,string>}>; boons?:string[]; enemyId?:string; stage?:number };
const defaultUpgrades = {power:1,vitality:1,tempo:1};
export class Battle {
  heroes:Hero[]=[]; threats:Telegraph[]=[]; minions:Minion[]=[]; events:BattleEvent[]=[];
  status:Status='ready'; mode:Mode='raid'; floor=1; stage=0; time=0; stageTime=0;
  bossHp=0; bossMax=0; enemyId='dragon'; enemyName=''; enemyTitle=''; stageName=''; stageCount=1;
  stagger=0; breakLeft=0; phase=1; resolve=25; gold=0; purse=120; potions=2;
  guardLeft=0; guardCooldown=0; markLeft=0;
  targetLane=-1; selected=0; damage=0; healed=0; blocked=0; dodged=0; taps=0; relocations=0;
  power=1; vitality=1; tempo=1; boons:string[]=[];
  private seed=271828; private eventId=0; private pattern=0;
  private attackIn=5; private clawIn=7; private summonIn=18;
  private lastTapped=-1; private castCount=0;
  private delayed:{left:number;source:number;lane:number;power:number}[]=[];
  private options:BattleOptions={};
  constructor(mode:Mode='raid',floor=1,upgrades=defaultUpgrades,options:BattleOptions={}) { this.reset(mode,floor,upgrades,options); }
  random() { this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0; return this.seed/4294967296; }
  reset(mode:Mode,floor=1,upgrades=defaultUpgrades,options:BattleOptions={}) {
    this.mode=mode; this.floor=Math.max(1,Math.min(mode==='adventure'?CAMPAIGN.length:100,Number.isFinite(floor)?Math.floor(floor):1));
    this.power=Number.isFinite(upgrades.power)?Math.max(.1,upgrades.power):1;
    this.vitality=Number.isFinite(upgrades.vitality)?Math.max(.1,upgrades.vitality):1;
    this.tempo=Number.isFinite(upgrades.tempo)?Math.max(.1,upgrades.tempo):1;
    this.options=structuredClone(options); this.boons=[...new Set(options.boons??[])].filter(id=>BOONS.some(b=>b.id===id));
    this.stage=Math.max(0,Math.min(mode==='adventure'?CAMPAIGN[this.floor-1].stages.length-1:0,Number.isInteger(options.stage)?options.stage!:0));
    const defaults=mode==='adventure'?[[0,4,3],[0,4,3,2],[0,4,3,2,7],[0,4,3,2,7,1,5]][this.floor-1]??ROSTER.map((_,id)=>id):ROSTER.map((_,id)=>id);
    const ids=[...new Set(options.roster??defaults)].filter(id=>Number.isInteger(id)&&ROSTER[id]);
    if (!ids.length) ids.push(0,4,3);
    const occupied=new Set<number>();
    this.heroes=ids.map((id,i)=>{
      const r=ROSTER[id],k=KITS[r.classId],loadout=options.loadouts?.[id];
      const talents=[...new Set(loadout?.talents??[])].filter(t=>TALENTS.some(def=>def.id===t));
      const job=JOBS[loadout?.job??'']?.base===r.classId?loadout?.job:undefined,stats=gearStats(loadout?.gear);
      const allowed=(index:number)=>legalSkill(index,talents,job);
      let skills=[...new Set(loadout?.skills??[0,1])].filter(index=>Number.isInteger(index)&&index>=0&&index<KITS[r.classId].skills.length&&allowed(index)).slice(0,2);
      if(skills.length<2) skills=[0,1];
      let slot=loadout?.slot??(ids.length===3?[1,7,6][i]:r.slot);
      if(!Number.isInteger(slot)||slot<0||slot>8||occupied.has(slot)) slot=Array.from({length:9},(_,j)=>j).find(j=>!occupied.has(j))!;
      occupied.add(slot);
      const maxHp=Math.round(k.hp*this.vitality*stats.hp*(talents.includes('vigor')?1.18:1)*(talents.includes('vigor-2')?1.2:1));
      const total=k.skills[skills[0]].cooldown/(this.tempo*stats.tempo*(talents.includes('focus')?1.1:1)*(talents.includes('focus-2')?1.08:1)*(JOBS[job??'']?.effect==='time'?1.15:1));
      return {id,name:r.name,classId:r.classId,slot,hp:maxHp,maxHp,shield:maxHp*((talents.includes('shelter')?.2:0)+(['aegis','veil','bell-oracle'].includes(job??'')?.25:0)),job,gear:loadout?.gear??{},gearPower:stats.power,gearTempo:stats.tempo,stance:skills[0],remaining:1.2+i*.25,total,fatigue:0,lastTap:-10,moveLock:0,buff:0,acts:0,talents,skills,regen:0,regenPower:0,rescued:false};
    });
    this.time=0; this.gold=0; this.potions=2; this.resolve=25; this.taps=0; this.damage=0; this.healed=0; this.blocked=0; this.dodged=0; this.relocations=0; this.seed=271828; this.eventId=0; this.events=[]; this.castCount=0; this.lastTapped=-1; this.selected=this.heroes[0].id;
    this.prepareStage();
  }
  private prepareStage() {
    this.status='ready'; this.stageTime=0; this.phase=1; this.pattern=0; this.threats=[]; this.minions=[]; this.delayed=[]; this.stagger=0; this.breakLeft=0; this.markLeft=0; this.targetLane=-1;
    this.guardLeft=0; this.guardCooldown=0; this.attackIn=4.5; this.clawIn=7; this.summonIn=this.mode==='adventure'?10:16; this.purse=120;
    if(this.mode==='adventure') {
      const zone=CAMPAIGN[this.floor-1],stage=zone.stages[this.stage];
      this.stageCount=zone.stages.length; this.enemyId=stage.enemy; this.stageName=stage.name;
      this.bossMax=Math.round(stage.hp*(this.floor<=4?2.2:4+this.floor*.75));
    } else {
      const endless=['wolf','goblin','spider','shaman','golem','wraith','treant','dragon'];
      this.enemyId=ENEMIES[this.options.enemyId??'']?this.options.enemyId!:this.mode==='endless'?endless[(this.floor-1)%endless.length]:'dragon';
      this.stageCount=1; this.stageName=this.mode==='endless'?`Descent ${this.floor}`:'Raid contract';
      this.bossMax=Math.round((this.mode==='endless'?1900:3400)*Math.pow(this.heroes.length/3,.9)*Math.pow(1.2,this.floor-1)*ENEMIES[this.enemyId].hp);
    }
    this.bossHp=this.bossMax; this.enemyName=ENEMIES[this.enemyId].name; this.enemyTitle=ENEMIES[this.enemyId].title;
  }
  nextWave() {
    if(this.mode!=='adventure'||this.status!=='victory'||this.stage+1>=this.stageCount) return false;
    this.stage++; this.events=[]; this.prepareStage(); return true;
  }
  emit(event:BattleEvent) { this.events.push(event); if(this.events.length>500)this.events.splice(0,this.events.length-500); }
  drain() { return this.events.splice(0); }
  living() { return this.heroes.filter(h=>h.hp>0); }
  hero(id:number) { return this.heroes.find(h=>h.id===id); }
  availableSkills(id:number) { return [...(this.hero(id)?.skills??[])]; }
  start() { if(this.status==='ready') {this.status='fighting';this.emit({type:'banner',text:this.stageName.toUpperCase()});} }
  pause() { if(this.status==='fighting')this.status='paused';else if(this.status==='paused')this.status='fighting'; }
  private gainResolve(amount:number) { this.resolve=Math.min(100,this.resolve+amount*(this.boons.includes('resolve')?1.6:1)); }
  private cooldown(h:Hero) { return KITS[h.classId].skills[h.stance].cooldown/(this.tempo*h.gearTempo*(h.talents.includes('focus')?1.1:1)*(h.talents.includes('focus-2')?1.08:1)*(JOBS[h.job??'']?.effect==='time'?1.15:1)); }
  tap(id:number,sync=false) {
    const h=this.hero(id);
    if(!h||h.hp<=0||this.status!=='fighting'||h.moveLock>0||this.time-h.lastTap<.11)return false;
    const amount=((sync?.88:.64)+(h.talents.includes('momentum')?.2:0))*(h.fatigue>70?.14:h.fatigue>40?.5:1);
    h.remaining=Math.max(0,h.remaining-amount);h.fatigue=Math.min(100,h.fatigue+5.5);h.lastTap=this.time;this.taps++;
    this.gainResolve(.3);
    if(this.boons.includes('chorus')&&this.lastTapped!==id)h.buff=Math.max(h.buff,2);
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
    const penalty=this.boons.includes('fleet')?.2:.9;
    if(this.status==='fighting') for(const ally of [h,other])if(ally&&ally.hp>0){ally.remaining+=ally.talents.includes('evasive')?Math.min(.45,penalty):penalty;ally.moveLock=.65;if(this.boons.includes('fleet'))this.shield(ally,30);}
    this.relocations++;this.emit({type:'move',source:id,slot,targets:other?[other.id]:[],text:this.status==='fighting'?`+${penalty}s`:'FORMATION'});return true;
  }
  potion() { if(this.status!=='fighting'||this.potions<=0)return false;this.potions--;for(const h of this.living())this.heal(h,130*this.vitality);this.emit({type:'banner',text:'MENDING MIST'});return true; }
  guard() { if(this.status!=='fighting'||this.guardCooldown>0)return false;this.guardLeft=2.8;this.guardCooldown=this.boons.includes('bell')?15:18;if(this.boons.includes('bell'))this.gainResolve(18);this.emit({type:'shield',text:'PARTY GUARD · 65% REDUCTION',targets:this.living().map(h=>h.slot)});return true; }
  ultimate() {
    if(this.status!=='fighting'||this.resolve<100)return false;this.resolve=0;
    this.living().forEach(h=>{this.heal(h,90*this.power);this.shield(h,65);});
    this.hitBoss(220+this.heroes.length*48,-1,'ultimate');
    for(const m of this.minions.filter(m=>m.hp>0))this.hitMinion(m,m.hp,-1,'ultimate');
    this.emit({type:'ultimate',text:'NINEFOLD DAWN'});return true;
  }
  tick(dt:number) {
    if(this.status!=='fighting'||!Number.isFinite(dt)||dt<=0)return;
    if(dt>.05){for(let remaining=Math.min(dt,30);remaining>1e-9;remaining-=.05)this.tick(Math.min(.05,remaining));return;}
    if(this.finish())return;
    this.time+=dt;this.stageTime+=dt;
    const oldPhase=this.phase;this.phase=this.bossHp/this.bossMax>.65?1:this.bossHp/this.bossMax>.3?2:3;
    if(this.phase!==oldPhase)this.emit({type:'phase',text:`${this.enemyName.toUpperCase()} · PHASE ${this.phase}`});
    this.breakLeft=Math.max(0,this.breakLeft-dt);this.guardLeft=Math.max(0,this.guardLeft-dt);this.guardCooldown=Math.max(0,this.guardCooldown-dt);this.markLeft=Math.max(0,this.markLeft-dt);
    for(const h of this.heroes){
      if(h.hp<=0)continue;
      h.moveLock=Math.max(0,h.moveLock-dt);h.buff=Math.max(0,h.buff-dt);
      if(h.regen>0){this.heal(h,h.regenPower*dt);h.regen=Math.max(0,h.regen-dt);}
      if(this.time-h.lastTap>.5)h.fatigue=Math.max(0,h.fatigue-dt*32*(h.talents.includes('composure')?1.5:1));
      h.remaining=Math.max(0,h.remaining-dt*(h.buff>0?1.2:1));
      if(h.remaining<=0&&h.moveLock<=0){this.act(h);h.total=this.cooldown(h);h.remaining=h.total;}
    }
    for(const d of [...this.delayed]){d.left-=dt;if(d.left<=0){this.attack(d.source,d.lane,d.power,'burst');this.delayed.splice(this.delayed.indexOf(d),1);}}
    if(this.finish())return;
    this.attackIn-=dt;this.clawIn-=dt;this.summonIn-=dt;
    if(this.attackIn<=0&&this.breakLeft<=0){this.telegraph();this.attackIn=ENEMIES[this.enemyId].interval-(this.phase-1)*.6;}
    if(this.clawIn<=0&&this.breakLeft<=0){const h=this.living().sort((a,b)=>a.slot-b.slot)[0];if(h){this.hurt(h,(13+this.phase*3)*this.enemyScale());this.emit({type:'claw',slot:h.slot});}this.clawIn=6.5;}
    if(this.summonIn<=0){this.summon();this.summonIn=25;}
    for(const t of [...this.threats]){
      if(t.targetId!==undefined){const target=this.hero(t.targetId);t.slots=target&&target.hp>0?[target.slot]:[];}
      t.left-=dt;
      if(t.left<=0){for(const slot of t.slots){const h=this.heroes.find(a=>a.slot===slot&&a.hp>0);if(h)this.hurt(h,(t.damage??83)*this.enemyScale());else this.dodged++;}this.emit({type:'impact',targets:t.slots,kind:t.type});this.threats.splice(this.threats.indexOf(t),1);}
    }
    for(const m of this.minions){if(m.hp<=0)continue;m.timer-=dt;if(m.timer<=0){const h=this.living().filter(a=>a.slot%3===m.lane).sort((a,b)=>a.slot-b.slot)[0]??this.living().sort((a,b)=>a.hp-b.hp)[0];if(h){this.hurt(h,16*this.enemyScale());this.emit({type:'minionAttack',slot:h.slot,lane:m.lane});}m.timer=5.5;}}
    this.minions=this.minions.filter(m=>m.hp>0);this.finish();
  }
  private finish() {
    if(!this.living().length){this.status='defeat';this.emit({type:'defeat'});return true;}
    if(this.bossHp<=0){this.status='victory';this.gold+=this.mode==='adventure'?20+this.stage*12+this.floor*6:80+this.floor*15;this.emit({type:'victory'});return true;}
    return false;
  }
  enemyScale() { return (this.mode==='adventure'?.65+this.floor*.17:this.mode==='endless'?.82:1.05)*Math.pow(1.075,this.mode==='adventure'?0:this.floor-1)*(this.stageTime>150?1.7:1); }
  telegraph() {
    const enemy=ENEMIES[this.enemyId],intent:Intent=enemy.patterns[this.pattern++%enemy.patterns.length];
    let slots:number[]=[],targetId:number|undefined,type:Telegraph['type']='meteor',name='',counter='';
    const alive=this.living();if(!alive.length)return;
    if(intent==='weakest'||intent==='strongest'){
      const candidates=[...alive].sort((a,b)=>intent==='weakest'?a.hp-b.hp||a.id-b.id:this.threatPower(b)-this.threatPower(a)||a.id-b.id);
      const target=candidates[0];targetId=target.id;slots=[target.slot];type='target';name=intent==='weakest'?'HUNT THE WOUNDED':'BREAK THE STRONG';counter='MARKED: mengikuti hero. Heal target, siapkan shield atau Party Guard.';
    }else if(intent==='front'){
      const row=Math.min(...alive.map(h=>Math.floor(h.slot/3)));slots=[row*3,row*3+1,row*3+2];type='front';name='CRUSHING FRONT';counter='GROUND: keluar dari row yang ditandai setelah telegraph muncul.';
    }else if(intent==='breath'){
      const counts=[0,1,2].map(lane=>alive.filter(h=>h.slot%3===lane).length);const lane=counts.indexOf(Math.max(...counts));slots=[lane,lane+3,lane+6];type='breath';name='LANE ERUPTION';counter='GROUND: pindah ke lane lain. Lokasi impact tidak mengikuti hero.';
    }else if(intent==='all'){
      slots=Array.from({length:9},(_,i)=>i);type='all';name=this.enemyId.startsWith('dragon')?'EMERALD CATACLYSM':'WORLDLESS RITUAL';counter='ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Pindah tile tidak membantu.';
    }else{
      const candidates=[...alive];while(slots.length<Math.min(3,alive.length)){const i=Math.floor(this.random()*candidates.length);slots.push(candidates.splice(i,1)[0].slot);}type='meteor';name=this.enemyId==='spider'?'VENOM WEB':'FALLING SHARDS';counter='GROUND: pindahkan hero ke tile aman. Tanda tetap di tanah.';
    }
    const total=type==='all'?4.2:3.2;
    this.threats.push({id:this.eventId++,name,type,slots,left:total,total,targetId,counter,damage:enemy.damage*(type==='all'?.85:1)*(1+(this.phase-1)*.1)});
    this.emit({type:'warning',text:name,targets:slots});
    if(this.phase>=2&&this.enemyId.startsWith('dragon')&&intent==='meteor'){
      const slot=alive[Math.floor(this.random()*alive.length)].slot;
      this.threats.push({id:this.eventId++,name:'AFTERSHOCK',type:'meteor',slots:[slot],left:5,total:5,damage:75,counter:'GROUND: ledakan kedua tertunda. Jangan buru-buru kembali ke tile ini.'});
    }
  }
  private skillPower(h:Hero) {
    const s=KITS[h.classId].skills[h.stance],effect=JOBS[h.job??'']?.effect;
    let value=this.power*h.gearPower*(h.talents.includes('mastery')?1.18:1)*(h.talents.includes('mastery-2')?1.2:1);
    if(effect==='sanctuary'&&['shield','partyshield'].includes(s.kind))value*=1.35;
    if(effect==='rage'&&h.hp/h.maxHp<.5)value*=1.4;
    if(effect==='execute'&&this.bossHp/this.bossMax<.4)value*=1.35;
    if(effect==='precision'&&h.acts%3===0)value*=1.6;
    if(effect==='mercy'&&['heal','regen'].includes(s.kind))value*=1.3;
    if(effect==='elements'&&s.kind==='aoe')value*=1.3;
    return value;
  }
  private threatPower(h:Hero) { const s=KITS[h.classId].skills[h.stance];return s.power/this.cooldown(h)*this.power*(h.talents.includes('mastery')?1.18:1)*(h.buff>0?1.3:1); }
  summon() {
    const lanes=this.heroes.length<=3?[1]:this.heroes.length<=5?[0,2]:[0,1,2];
    for(const lane of lanes){if(this.minions.some(m=>m.lane===lane&&m.hp>0))continue;const hp=Math.round((this.mode==='adventure'?65+this.floor*18:170)*Math.pow(1.1,this.mode==='adventure'?0:this.floor-1));this.minions.push({id:this.eventId++,lane,hp,maxHp:hp,timer:4,enemyId:['wolf','spider','goblin'][(this.stage+lane)%3]});}
    this.emit({type:'summon',text:'REINFORCEMENTS'});
  }
  act(h:Hero) {
    if(h.hp<=0)return;
    const s=KITS[h.classId].skills[h.stance];h.acts++;
    const p=s.power*this.skillPower(h)*(h.buff>0?1.3:1),lane=h.slot%3;
    this.emit({type:'cast',source:h.id,slot:h.slot,kind:s.kind,text:s.name,color:KITS[h.classId].color});
    if(h.talents.includes('resolve')||JOBS[h.job??'']?.effect==='hymn')this.gainResolve(2);
    if(h.job==='hourkeeper')this.attackIn=Math.min(14,this.attackIn+.25);
    if(this.boons.includes('frost'))this.attackIn=Math.min(14,this.attackIn+.16);
    if(s.kind==='shield'||s.kind==='partyshield'){
      this.living().filter(a=>s.kind==='partyshield'||a.slot%3===lane).forEach(a=>this.shield(a,p));
      if(h.classId==='rogue')h.buff=Math.max(2,h.buff);
    }else if(s.kind==='heal'){
      const lowest=this.living().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(lowest)this.heal(lowest,p);this.living().forEach(a=>this.heal(a,20*this.power));
    }else if(s.kind==='regen'){
      this.living().forEach(a=>{a.regen=6;a.regenPower=p;});
    }else if(s.kind==='buff'){
      this.living().forEach(a=>{a.buff=JOBS[h.job??'']?.effect==='hymn'?10:7;this.emit({type:'buff',source:a.id,slot:a.slot});});
    }else{
      this.castCount++;
      if(s.kind==='interrupt'){
        const active=this.threats.filter(t=>t.type==='all');this.threats=this.threats.filter(t=>t.type!=='all');
        if(active.length)this.emit({type:'break',text:'RITUAL INTERRUPTED'});
        this.hitBoss(p,h.id,'magic');
      }else if(s.kind==='mark'){
        this.hitBoss(p,h.id,'slash');this.markLeft=4;
      }else if(s.kind==='steal'){
        this.attack(h.id,lane,p,'steal');const amount=Math.min(8,this.purse);this.purse-=amount;this.gold+=amount;if(amount)this.emit({type:'coin',source:h.id,slot:h.slot,amount});
      }else if(s.kind==='aoe'){
        if(h.classId==='wizard'||h.classId==='warrior'){this.hitBoss(p,h.id,'nova');for(const m of this.minions)this.hitMinion(m,p*.6,h.id,'nova');}
        else{const enemies=this.minions.filter(m=>m.hp>0);if(enemies.length)enemies.forEach(m=>this.hitMinion(m,p/enemies.length*1.7,h.id,'arrow'));else this.hitBoss(p,h.id,'arrow');}
      }else if(h.classId==='wizard'&&h.stance===2){this.delayed.push({left:1.5,source:h.id,lane:this.targetLane,power:p});this.emit({type:'bomb',source:h.id,lane:this.targetLane});}
      else this.attack(h.id,(h.classId==='archer'||h.classId==='wizard')?this.targetLane:lane,p,h.classId==='archer'?'arrow':h.classId==='wizard'?'magic':'slash');
      if(this.boons.includes('storm')&&this.castCount%5===0)this.hitBoss(p*.55,h.id,'magic');
      if(['blade-saint','starshot','archon'].includes(h.job??'')&&h.acts%5===0)this.hitBoss(p*.4,h.id,'magic');
      if(JOBS[h.job??'']?.effect==='leech'||h.job==='warlord')this.heal(h,p*(h.job==='warlord'?.08:.12));
    }
  }
  attack(source:number,lane:number,power:number,kind:string) { const m=this.minions.find(m=>m.lane===lane&&m.hp>0);if(m)this.hitMinion(m,power,source,kind);else this.hitBoss(power,source,kind); }
  hitMinion(m:Minion,amount:number,source:number,kind:string) {
    if(m.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    if(JOBS[this.hero(source)?.job??'']?.effect==='hunter')amount*=1.45;
    const actual=Math.min(m.hp,amount);m.hp=Math.max(0,m.hp-amount);this.damage+=actual;this.gainResolve(actual*.008);this.emit({type:'projectile',source,lane:m.lane,amount:actual,kind});
    if(m.hp===0&&this.hero(source)?.job==='wildwarden')this.living().forEach(h=>this.heal(h,18));
    if(m.hp===0){this.emit({type:'minionDown',lane:m.lane});if(this.boons.includes('feast'))this.living().forEach(h=>this.heal(h,24));}
  }
  hitBoss(amount:number,source:number,kind:string) {
    if(!Number.isFinite(amount)||amount<=0||this.bossHp<=0)return;
    const execute=this.boons.includes('execution')&&this.bossHp/this.bossMax<.3;
    const dmg=Math.min(this.bossHp,Math.round(amount*(this.breakLeft>0?1.6:1)*(this.markLeft>0?1.2:1)*(execute?1.4:1)));
    this.bossHp=Math.max(0,this.bossHp-dmg);this.damage+=dmg;this.gainResolve(dmg*.014);
    if(this.breakLeft<=0){this.stagger+=amount*.23;const threshold=Math.min(800,this.bossMax*.14);if(this.stagger>=threshold){this.stagger=0;this.breakLeft=6;this.emit({type:'break',text:'ARMOR BREAK · +60% DMG'});}}
    this.emit({type:'projectile',source,lane:-1,amount:dmg,kind});
  }
  private shield(h:Hero,amount:number) { if(h.hp<=0)return;const gained=Math.min(h.maxHp*.6-h.shield,amount);h.shield+=Math.max(0,gained);if(gained>1)this.emit({type:'shield',source:h.id,slot:h.slot,amount:gained}); }
  heal(h:Hero,amount:number) {
    if(h.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    if(h.talents.includes('recovery'))amount*=1.15;
    const value=Math.min(amount,h.maxHp-h.hp);h.hp+=value;this.healed+=value;
    if(h.job==='seraph')this.shield(h,(amount-value)*.25);
    if(this.boons.includes('tide'))this.shield(h,(amount-value)*.35);
    if(value>1)this.emit({type:'heal',source:h.id,slot:h.slot,amount:value});
  }
  hurt(h:Hero,amount:number) {
    if(h.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    if(h.talents.includes('fortitude'))amount*=.9;
    const guard=this.guardLeft>0?amount*.65:0;amount-=guard;
    const absorbed=Math.min(h.shield,amount);h.shield-=absorbed;this.blocked+=absorbed+guard;
    const dmg=Math.round(amount-absorbed);h.hp=Math.max(0,h.hp-dmg);this.gainResolve(amount*.028);
    if(this.boons.includes('thorn'))this.hitBoss((absorbed+guard)*.35,h.id,'thorn');
    this.emit({type:'hurt',source:h.id,slot:h.slot,amount:dmg,text:absorbed+guard>0?'BLOCK':''});
    if(h.hp===0&&this.boons.includes('lifeline')&&!h.rescued){h.rescued=true;h.hp=Math.round(h.maxHp*.2);this.emit({type:'heal',source:h.id,slot:h.slot,amount:h.hp,text:'NOT YET'});}
    else if(h.hp===0)this.emit({type:'down',source:h.id,slot:h.slot});
  }
  snapshot() { return {status:this.status,mode:this.mode,floor:this.floor,stage:this.stage,stageCount:this.stageCount,enemyId:this.enemyId,time:this.time,bossHp:this.bossHp,bossMax:this.bossMax,phase:this.phase,resolve:this.resolve,gold:this.gold,taps:this.taps,relocations:this.relocations,potions:this.potions,guardLeft:this.guardLeft,guardCooldown:this.guardCooldown,boons:[...this.boons],heroes:this.heroes.map(h=>({...h,skills:[...h.skills],talents:[...h.talents]})),threats:this.threats.map(t=>({...t,slots:[...t.slots]})),minions:this.minions.map(m=>({...m}))}; }
}
