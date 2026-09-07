import type { ClassId, Skill } from './content';
export type Job = {id:string;base:ClassId;name:string;tier:2|3;parent?:string;level:number;cost:number;index:number;description:string;effect:string;skill:Skill};
const skill=(name:string,label:string,cooldown:number,power:number,kind:Skill['kind'],description:string):Skill=>({name,label,cooldown,power,kind,description});
const entries:Job[]=[
{id:'paladin',base:'warrior',name:'Paladin',tier:2,level:4,cost:180,index:4,effect:'sanctuary',description:'Shield yang diberikan +35%. Menjaga lane menjadi sumber pertahanan party.',skill:skill('Consecration','HALLOW',7,75,'partyshield','75 shield ke seluruh party, diperkuat Sanctuary.')},
{id:'berserker',base:'warrior',name:'Berserker',tier:2,level:4,cost:180,index:5,effect:'rage',description:'Saat HP di bawah 50%, power +40%. Damage besar, jangan kehilangan healer.',skill:skill('Blood Oath','RAGE',4.8,112,'attack','112 damage. Rage memberi +40% power saat HP di bawah 50%.')},
{id:'aegis',base:'warrior',name:'Aegis Sovereign',tier:3,parent:'paladin',level:10,cost:420,index:6,effect:'sanctuary',description:'Sanctuary tetap aktif. Mulai tiap expedition dengan barrier 25% max HP.',skill:skill('Worldwall','WALL',9,122,'partyshield','122 barrier ke seluruh party. Jawaban untuk tekanan seluruh grid.')},
{id:'warlord',base:'warrior',name:'Crimson Warlord',tier:3,parent:'berserker',level:10,cost:420,index:7,effect:'rage',description:'Rage tetap aktif; setiap cast ofensif memulihkan 8% power skill.',skill:skill('Red Horizon','HORIZON',7,220,'aoe','220 damage ke boss, 55% power ke setiap minion.')},
{id:'duelist',base:'rogue',name:'Duelist',tier:2,level:4,cost:180,index:4,effect:'leech',description:'Cast ofensif memulihkan 12% power. Duel panjang menjadi sumber sustain.',skill:skill('Riposte','RIPOSTE',3.4,70,'attack','70 damage dan pemulihan dari Leech.')},
{id:'shade',base:'rogue',name:'Nightblade',tier:2,level:4,cost:180,index:5,effect:'execute',description:'Power +35% ketika musuh utama di bawah 40% HP.',skill:skill('Black Warrant','WARRANT',5.5,68,'mark','68 damage dan 4 detik Expose: party damage +20%.')},
{id:'blade-saint',base:'rogue',name:'Blade Saint',tier:3,parent:'duelist',level:10,cost:420,index:6,effect:'leech',description:'Leech tetap aktif. Setiap cast kelima memicu 40% echo damage.',skill:skill('Thousand Cuts','CUTS',5,151,'attack','151 damage. Frekuensi cast membantu echo Blade Saint.')},
{id:'veil',base:'rogue',name:'Veil Reaper',tier:3,parent:'shade',level:10,cost:420,index:7,effect:'execute',description:'Execute tetap aktif. Mulai expedition dengan barrier 25% HP.',skill:skill('Unwritten Name','ERASE',7.8,265,'attack','265 damage, diperkuat execute saat boss terluka.')},
{id:'marksman',base:'archer',name:'Marksman',tier:2,level:4,cost:180,index:4,effect:'precision',description:'Setiap cast ofensif ketiga menghasilkan 1,6× power; tidak bergantung RNG.',skill:skill('Deadeye','DEADEYE',6,142,'attack','142 directed damage. Mengincar lane pilihan atau boss.')},
{id:'ranger',base:'archer',name:'Wild Ranger',tier:2,level:4,cost:180,index:5,effect:'hunter',description:'Semua serangan ke minion +45%. Membersihkan lane membuka boss.',skill:skill('Briar Volley','BRIAR',5.2,116,'aoe','116 power dibagi ke minion; semuanya ke boss jika lane bersih.')},
{id:'starshot',base:'archer',name:'Astral Deadeye',tier:3,parent:'marksman',level:10,cost:420,index:6,effect:'precision',description:'Precision tetap aktif. Cast ofensif kelima menghasilkan echo 40%.',skill:skill('Falling Constellation','COMET',8,244,'attack','244 directed damage. Timing Precision menentukan burst.')},
{id:'wildwarden',base:'archer',name:'Wild Warden',tier:3,parent:'ranger',level:10,cost:420,index:7,effect:'hunter',description:'Hunter tetap aktif. Membunuh minion memulihkan party 18 HP.',skill:skill('Thorn Silence','THORN',6,109,'interrupt','109 damage ke boss dan membatalkan semua ritual all-grid aktif.')},
{id:'priest',base:'healer',name:'Dawn Priest',tier:2,level:4,cost:180,index:4,effect:'mercy',description:'Heal dan regenerasi yang diberikan +30%.',skill:skill('Sunwell','SUNWELL',6,118,'heal','118 heal untuk yang paling terluka dan 20 ke seluruh party.')},
{id:'cantor',base:'healer',name:'War Cantor',tier:2,level:4,cost:180,index:5,effect:'hymn',description:'Buff berlangsung 3 detik lebih lama. Setiap cast menambah 2 Resolve.',skill:skill('March of Embers','MARCH',5.5,0,'buff','Battle Hymn seluruh party; +30% damage dan +20% tempo.')},
{id:'seraph',base:'healer',name:'Ember Seraph',tier:3,parent:'priest',level:10,cost:420,index:6,effect:'mercy',description:'Mercy tetap aktif. 25% overheal berubah menjadi barrier.',skill:skill('Second Sunrise','SUNRISE',7.5,22,'regen','Pulihkan party 22 HP/detik selama 6 detik, diperkuat Mercy.')},
{id:'bell-oracle',base:'healer',name:'Bell Oracle',tier:3,parent:'cantor',level:10,cost:420,index:7,effect:'hymn',description:'Hymn tetap aktif. Mulai expedition dengan barrier 25% HP.',skill:skill('Silence Between Bells','STILL',7,96,'interrupt','96 damage dan batalkan ritual. Menambah Resolve dari Hymn.')},
{id:'elementalist',base:'wizard',name:'Elementalist',tier:2,level:4,cost:180,index:4,effect:'elements',description:'Power skill AoE +30%. AoE mage tetap menghantam boss dan minion.',skill:skill('Cinder Sea','SEA',8,190,'aoe','190 damage ke boss, 55% ke setiap minion, sebelum bonus Elements.')},
{id:'chronist',base:'wizard',name:'Chronist',tier:2,level:4,cost:180,index:5,effect:'time',description:'Semua cooldown milik hero ini 15% lebih cepat.',skill:skill('Stolen Second','STEAL',6.5,101,'interrupt','101 damage dan memutus ritual. Cooldown dipercepat Chronist.')},
{id:'archon',base:'wizard',name:'Prismatic Archon',tier:3,parent:'elementalist',level:10,cost:420,index:6,effect:'elements',description:'Elements tetap aktif. Cast ofensif kelima menghasilkan echo 40%.',skill:skill('Prismatic Ruin','PRISM',9.5,280,'aoe','280 damage ke boss, 55% ke minion; bonus Elements berlaku.')},
{id:'hourkeeper',base:'wizard',name:'Last Hourkeeper',tier:3,parent:'chronist',level:10,cost:420,index:7,effect:'time',description:'Tempo Chronist tetap aktif. Setiap cast memperlambat intent berikutnya 0,25 detik.',skill:skill('Tomorrow on Loan','TOMORROW',7.6,147,'interrupt','147 damage dan putus ritual; mendorong mundur jadwal intent berikutnya.')},
];
export const JOBS:Record<string,Job>=Object.fromEntries(entries.map(j=>[j.id,j]));
export function jobSkills(job?:string) {const j=JOBS[job??''];return j?[j.index,...(j.parent?[JOBS[j.parent].index]:[])]:[];}
export function legalSkill(index:number,talents:string[],job?:string) {return Number.isInteger(index)&&index>=0&&(index<2||(index<4&&talents.includes(`active-${index}`))||jobSkills(job).includes(index));}
export type GearEffect=Partial<{reduction:number;heal:number;shield:number;openingBarrier:number;tapBonus:number}>;
export type Gear={id:string;name:string;slot:'weapon'|'armor'|'charm';cost:number;power:number;hp:number;tempo:number;description:string;rarity?:'common'|'uncommon'|'rare'|'epic';minLevel?:number;classId?:ClassId;setId?:string;source?:'forge'|'quest';effects?:GearEffect};
export type GearSet={id:string;name:string;level:number;quest?:boolean;two:GearEffect;three:GearEffect;description:string};
export const GEAR:Gear[]=[
{id:'iron-edge',name:'Forged Edge',slot:'weapon',cost:65,power:.15,hp:0,tempo:0,description:'+15% skill power.'},
{id:'swift-edge',name:'Quicksteel',slot:'weapon',cost:95,power:.06,hp:0,tempo:.12,description:'+6% power, +12% tempo.'},
{id:'oath-edge',name:'Oathbound Relic',slot:'weapon',cost:180,power:.26,hp:.08,tempo:-.05,description:'+26% power, +8% HP, −5% tempo.'},
{id:'oak-plate',name:'Oak Plate',slot:'armor',cost:70,power:0,hp:.22,tempo:0,description:'+22% max HP.'},
{id:'travel-cloak',name:'Wayfarer Cloak',slot:'armor',cost:100,power:0,hp:.1,tempo:.08,description:'+10% HP, +8% tempo.'},
{id:'bell-plate',name:'Bellmetal Plate',slot:'armor',cost:170,power:0,hp:.36,tempo:-.05,description:'+36% HP, −5% tempo.'},
{id:'ember-charm',name:'Ember Pendant',slot:'charm',cost:60,power:.1,hp:.05,tempo:0,description:'+10% power, +5% HP.'},
{id:'tempo-charm',name:'Clockseed',slot:'charm',cost:95,power:0,hp:0,tempo:.13,description:'+13% tempo.'},
{id:'hearth-charm',name:'Hearthstone',slot:'charm',cost:110,power:0,hp:.18,tempo:.04,description:'+18% HP, +4% tempo.'},
];
export const GEAR_SETS:GearSet[]=[
 {id:'scout',name:'Ashwood Scout',level:3,two:{tapBonus:.08},three:{openingBarrier:.1},description:'2 pieces: tap +0,08s. 3: barrier awal 10% HP.'},
 {id:'wind',name:'Windwalker',level:6,two:{tapBonus:.1},three:{reduction:.05},description:'2 pieces: tap +0,10s. 3: damage masuk −5%.'},
 {id:'pilgrim',name:'Dawn Pilgrim',level:8,two:{heal:.12},three:{shield:.12},description:'2 pieces: heal yang diberikan +12%. 3: shield +12%.'},
 {id:'cinder',name:'Ember Duelist',level:10,two:{openingBarrier:.12},three:{tapBonus:.15},description:'2 pieces: barrier awal 12% HP. 3: tap +0,15s.'},
 {id:'bastion',name:'Bellmetal Bastion',level:12,two:{reduction:.08},three:{shield:.15},description:'2 pieces: damage masuk −8%. 3: shield yang diberikan +15%.'},
 {id:'unbound',name:'Unbound Tomorrow',level:15,quest:true,two:{heal:.12,shield:.12},three:{openingBarrier:.18,tapBonus:.08},description:'2 pieces: heal dan shield +12%. 3: barrier awal 18% HP dan tap +0,08s. Hanya reward town story.'}
];
const setPieces:Record<string,[string,number,number,number][]>={
 scout:[['Trailknife',.14,0,.02],['Barkweave Coat',0,.2,.02],['Scout Whistle',.04,.05,.06]],
 wind:[['Gale Sabre',.1,-.03,.13],['Featherstep Mantle',0,.12,.1],['Windglass Knot',.02,0,.14]],
 pilgrim:[['Dawn Staff',.18,.05,0],['Pilgrim Vestments',0,.26,.02],['Sunwell Rosary',.07,.09,.03]],
 cinder:[['Cinderbrand',.3,0,-.04],['Ashrunner Jacket',.06,.2,.02],['Coalheart Seal',.14,.04,0]],
 bastion:[['Gatekeeper Mace',.22,.12,-.05],['Bastion Harness',0,.42,-.06],['Oath Anchor',.02,.22,-.02]],
 unbound:[['Tomorrow Blade',.25,0,.06],['Open Door Mantle',0,.3,.04],['Unwritten Promise',.1,.12,.05]]
};
for(const set of GEAR_SETS) setPieces[set.id].forEach(([name,power,hp,tempo],i)=>{
 const slot=(['weapon','armor','charm'] as const)[i];
 GEAR.push({id:`${set.id}-${slot}`,name,slot,power,hp,tempo,cost:100+set.level*18+i*15,minLevel:set.level,setId:set.id,source:set.quest?'quest':'forge',rarity:set.quest?'epic':set.level>=8?'rare':'uncommon',description:`${Math.round(power*100)}% power · ${Math.round(hp*100)}% HP · ${Math.round(tempo*100)}% tempo. ${set.name}: ${set.description}`});
});
const weapons:Record<ClassId,[string,string,string]>={warrior:['Watchman Sword','Oathsplitter','Last Bulwark'],rogue:['Threadcutter','Dusk Needle','Mercy Razor'],archer:['Scout Longbow','Briarstring','Horizon Bow'],healer:['Kindling Crook','Dawn Reliquary','Living Bell'],wizard:['Runeslate Rod','Prism Branch','Unwritten Star']};
for(const [classId,names] of Object.entries(weapons) as [ClassId,string[]][]) names.forEach((name,i)=>{
 const effects:GearEffect=classId==='warrior'?{shield:.08+i*.04}:classId==='healer'?{heal:.1+i*.04}:classId==='rogue'?{tapBonus:.04+i*.04}:classId==='archer'?{openingBarrier:.06+i*.03}:{};
 GEAR.push({id:`${classId}-weapon-${i+1}`,name,slot:'weapon',cost:150+i*180,power:.16+i*.1,hp:classId==='warrior'?.05:0,tempo:classId==='wizard'?.03+i*.02:0,classId,minLevel:[5,10,20][i],rarity:i===2?'epic':'rare',source:'forge',effects,description:`${Math.round((.16+i*.1)*100)}% power. ${classId==='warrior'?`Shield +${8+i*4}%, HP +5%.`:classId==='healer'?`Heal diberikan +${10+i*4}%.`:classId==='rogue'?`Tap +${(.04+i*.04).toFixed(2)}s.`:classId==='archer'?`Barrier awal ${6+i*3}% HP.`:`Tempo +${3+i*2}%.`} Khusus ${classId}.`});
});
export function gearStats(gear:Record<string,string>={}) {
 const s={power:1,hp:1,tempo:1,reduction:0,heal:0,shield:0,openingBarrier:0,tapBonus:0};
 const pieces=new Map<string,number>();
 const add=(effects:GearEffect)=>{for(const [key,value] of Object.entries(effects))s[key as keyof GearEffect]+=value;};
 for(const [slot,id] of Object.entries(gear)){
  const g=GEAR.find(g=>g.id===id&&g.slot===slot);if(!g)continue;
  s.power+=g.power;s.hp+=g.hp;s.tempo+=g.tempo;add(g.effects??{});
  if(g.setId)pieces.set(g.setId,(pieces.get(g.setId)??0)+1);
 }
 for(const set of GEAR_SETS){const n=pieces.get(set.id)??0;if(n>=2)add(set.two);if(n>=3)add(set.three);}
 s.reduction=Math.min(.2,s.reduction);return s;
}
