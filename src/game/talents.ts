import type { ClassId } from './content';
export type TalentEffect = Partial<{ power:number; hp:number; tempo:number; reduction:number; heal:number; shield:number; openingBarrier:number; tapBonus:number; echo:number; leech:number; thorns:number; overheal:number; minionDamage:number }>;
export type Talent = {id:string;name:string;description:string;cost:number;requires?:string;requiresAll?:string[];level?:number;points?:number;branch?:string;classId?:ClassId;exclusive?:string;effect?:TalentEffect};
export const TALENTS:Talent[] = [
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

const node=(id:string,name:string,description:string,level:number,points:number,requires:string,effect:TalentEffect,more:Partial<Talent>={}):Talent=>({id,name,description,level,points,requires,effect,cost:20+level*4,branch:id.split('-')[0],...more});
TALENTS.push(
  node('assault-root','Committed Strike','+6% power. Jalur serangan; perlu Mastery.',3,1,'mastery',{power:.06}),
  node('assault-break','Fracture Rhythm','+5% power dan +5% tempo.',6,1,'assault-root',{power:.05,tempo:.05}),
  node('assault-hunt','Lane Predator','+18% damage ke minion.',10,2,'assault-root',{minionDamage:.18}),
  node('assault-echo','Resounding Blow','Setiap cast ofensif kelima: echo 18% power ke boss.',15,2,'assault-break',{echo:.18},{requiresAll:['assault-hunt']}),
  node('assault-crown','Crown of Cinders','Keystone: +14% power, tetapi −8% HP. Pilih satu keystone.',20,3,'assault-echo',{power:.14,hp:-.08},{exclusive:'keystone'}),
  node('guard-root','Deep Roots','+10% max HP.',3,1,'vigor',{hp:.1}),
  node('guard-shell','Layered Guard','Damage masuk −5%.',6,1,'guard-root',{reduction:.05}),
  node('guard-mend','Kindling Shelter','Heal yang diberikan +10%; mulai dengan barrier 8% HP.',10,2,'guard-root',{heal:.1,openingBarrier:.08}),
  node('guard-wall','Living Rampart','Pantulkan 15% damage yang diserap shield/Guard ke boss.',15,2,'guard-shell',{thorns:.15},{requiresAll:['guard-mend','fortitude']}),
  node('guard-crown','Crown of Hearths','Keystone: +20% HP dan −6% damage masuk, tetapi −5% tempo.',20,3,'guard-wall',{hp:.2,reduction:.06,tempo:-.05},{exclusive:'keystone'}),
  node('tempo-root','Measured Breath','+5% tempo dan tap efektif +0,05s.',3,1,'focus',{tempo:.05,tapBonus:.05}),
  node('tempo-weave','Thread the Needle','Tap efektif +0,10s; fatigue tetap membatasi.',6,1,'tempo-root',{tapBonus:.1}),
  node('tempo-flow','Borrowed Beat','+8% tempo.',10,2,'tempo-root',{tempo:.08}),
  node('tempo-echo','Returning Echo','Setiap cast ofensif kelima: echo 12%. Tiap cast ofensif memulihkan diri 4% power.',15,2,'tempo-weave',{echo:.12,leech:.04},{requiresAll:['tempo-flow']}),
  node('tempo-crown','Crown of Hours','Keystone: +15% tempo dan tap +0,10s, tetapi −7% power.',20,3,'tempo-echo',{tempo:.15,tapBonus:.1,power:-.07},{exclusive:'keystone'})
);
const classNodes:Record<ClassId,[string,string,TalentEffect][]>={
 warrior:[['Shieldwright','Shield yang diberikan +12%.',{shield:.12}],['Hold the Line','Barrier awal 10% HP.',{openingBarrier:.1}],['Reprisal','Pantulkan 12% damage yang ditahan.',{thorns:.12}],['Unbroken Oath','+8% HP dan shield +10%.',{hp:.08,shield:.1}]],
 rogue:[['Red Thread','Cast ofensif memulihkan diri 5% power.',{leech:.05}],['Knife Between Beats','+6% tempo.',{tempo:.06}],['Surgical Finish','Echo ofensif kelima +15%.',{echo:.15}],['No Wasted Motion','+8% power dan tap +0,08s.',{power:.08,tapBonus:.08}]],
 archer:[['Trailcraft','Damage ke minion +15%.',{minionDamage:.15}],['Steady Draw','+8% power.',{power:.08}],['Split Feathers','Echo ofensif kelima +15%.',{echo:.15}],['Horizon Keeper','+8% tempo dan damage minion +10%.',{tempo:.08,minionDamage:.1}]],
 healer:[['Warm Hands','Heal yang diberikan +12%.',{heal:.12}],['Safe Ember','Shield yang diberikan +12%.',{shield:.12}],['Mercy Reservoir','15% overheal yang diterima hero ini jadi barrier.',{overheal:.15}],['Dawn Within','Heal +10% dan barrier awal 10% HP.',{heal:.1,openingBarrier:.1}]],
 wizard:[['Runic Weight','+8% power.',{power:.08}],['Clear Thought','+6% tempo.',{tempo:.06}],['Prism Echo','Echo ofensif kelima +18%.',{echo:.18}],['Unwritten Formula','+10% power dan tap +0,05s.',{power:.1,tapBonus:.05}]]
};
for(const [classId,definitions] of Object.entries(classNodes) as [ClassId,[string,string,TalentEffect][]][]) {
  definitions.forEach(([name,description,effect],i)=>TALENTS.push(node(`${classId}-${i+1}`,name,description,[5,9,14,18][i],[1,1,2,2][i],i?`${classId}-${i}`:'focus',effect,{classId,branch:'class'})));
}
export function talentStats(ids:string[],classId:ClassId) {
  const out={power:1,hp:1,tempo:1,reduction:0,heal:0,shield:0,openingBarrier:0,tapBonus:0,echo:0,leech:0,thorns:0,overheal:0,minionDamage:0};
  for(const t of TALENTS) if(ids.includes(t.id)&&(!t.classId||t.classId===classId)) {
    for(const [key,value] of Object.entries(t.effect??{})) out[key as keyof typeof out]+=value;
  }
  return out;
}
