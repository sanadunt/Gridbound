import { JOBS } from './jobs';
export type ClassId = 'warrior' | 'rogue' | 'archer' | 'healer' | 'wizard' | 'bard' | 'hexer' | 'monk' | 'engineer';
export const CLASS_IDS: readonly ClassId[] = ['warrior','rogue','archer','healer','wizard','bard','hexer','monk','engineer'];
export type Mode = 'raid' | 'adventure' | 'endless' | 'dungeon';
export type Skill = { name: string; label: string; cooldown: number; power: number; kind: 'attack'|'shield'|'heal'|'buff'|'steal'|'aoe'|'interrupt'|'partyshield'|'regen'|'mark'|'haste'|'weaken'|'delay'|'resolve'|'curse'|'drain'|'sacrifice'|'combo'|'counter'|'flurry'|'selfheal'|'turret'|'stun'|'repair'; description: string };
export type Kit = { name: string; color: string; hp: number; role: string; skills: Skill[] };
export const KITS: Record<ClassId, Kit> = {
 warrior: { name:'Warrior', color:'#e7b96c', hp:490, role:'Penjaga garis depan', skills:[
  {name:'Cleave',label:'SERANG',cooldown:4.2,power:59,kind:'attack',description:'Tebasan 59 damage pada musuh di lane yang sama. Mengisi stagger boss.'},
  {name:'Bulwark',label:'SHIELD',cooldown:5.2,power:88,kind:'shield',description:'88 shield untuk diri dan rekan satu lane. Siapkan sebelum hantaman boss.'}]},
 rogue: {name:'Rogue',color:'#bc9de6',hp:270,role:'Cepat, licik, dan rapuh',skills:[
  {name:'Twin Fang',label:'SERANG',cooldown:2.8,power:43,kind:'attack',description:'Dua tebasan cepat dengan total 43 damage pada lane yang sama.'},
  {name:'Pilfer',label:'CURI',cooldown:4,power:21,kind:'steal',description:'21 damage dan curi 8 gold dari kantong encounter. Maksimal 120 gold.'}]},
 archer: {name:'Archer',color:'#b3cf80',hp:290,role:'Pemburu minion dan weak point',skills:[
  {name:'Split Arrow',label:'VOLLEY',cooldown:4.4,power:62,kind:'aoe',description:'62 damage terbagi ke minion; jika lane bersih, semua panah mengenai boss.'},
  {name:'Pinpoint',label:'TARGET',cooldown:4.8,power:96,kind:'attack',description:'96 damage pada target pilihan. Klik salah satu lane musuh untuk mengarahkan.'}]},
 healer: {name:'Healer',color:'#73d8cc',hp:310,role:'Pemulihan dan tempo party',skills:[
  {name:'Mending Light',label:'HEAL',cooldown:5,power:78,kind:'heal',description:'Pulihkan 78 HP rekan paling terluka dan 20 HP pada seluruh party.'},
  {name:'Battle Hymn',label:'BUFF',cooldown:6,power:0,kind:'buff',description:'Seluruh party mendapat +30% damage dan +20% kecepatan cooldown selama 7 detik.'}]},
 wizard: {name:'Wizard',color:'#91b7ef',hp:255,role:'Burst besar, cooldown panjang',skills:[
  {name:'Arc Lance',label:'LANCE',cooldown:6,power:98,kind:'attack',description:'98 magic damage ke boss atau target lane pilihan.'},
  {name:'Starfall',label:'NOVA',cooldown:9.4,power:160,kind:'aoe',description:'Ledakan 160 damage ke boss dan 95 damage ke setiap minion. Cooldown panjang.'},
  {name:'Time Bomb',label:'BURST',cooldown:8,power:210,kind:'attack',description:'Segel meledak setelah 1,5 detik: 210 damage. Tepatkan dengan jendela Break.'}]},
 bard: {name:'Bard',color:'#f29fc5',hp:300,role:'Irama yang mempercepat party',skills:[
  {name:'Quickstep Reel',label:'HASTE',cooldown:6,power:1.7,kind:'haste',description:'Cooldown tersisa setiap hero lain berkurang 1,7 detik. Tempo party jadi senjata.'},
  {name:'Discordant Note',label:'DISCORD',cooldown:5,power:58,kind:'weaken',description:'58 damage dan lemahkan musuh 5 detik: semua damage musuh −25%.'},
  {name:'Lullaby',label:'LULL',cooldown:8,power:2.2,kind:'delay',description:'Tunda intent musuh berikutnya 2,2 detik. Telegraph yang sudah muncul tetap berjalan.'},
  {name:'Encore',label:'ENCORE',cooldown:9,power:14,kind:'resolve',description:'Isi 14 Resolve. Ninefold Dawn datang lebih cepat.'}]},
 hexer: {name:'Hexer',color:'#d0638a',hp:265,role:'Kutukan dan damage berkelanjutan',skills:[
  {name:'Withering Hex',label:'HEX',cooldown:5,power:18,kind:'curse',description:'Kutuk boss: 18 damage per detik selama 6 detik. Recast memperbarui kutukan.'},
  {name:'Soul Siphon',label:'SIPHON',cooldown:4.6,power:52,kind:'drain',description:'52 damage; rekan paling terluka pulih sebesar 50% damage itu.'},
  {name:'Hollow Pact',label:'PACT',cooldown:6,power:170,kind:'sacrifice',description:'Korbankan 8% HP sendiri untuk 170 damage ke boss.'},
  {name:'Unravel',label:'UNRAVEL',cooldown:7.5,power:70,kind:'interrupt',description:'70 damage dan putus ritual all-grid yang sedang berjalan.'}]},
 monk: {name:'Monk',color:'#f2c14e',hp:380,role:'Petarung combo dan counter',skills:[
  {name:'Palm Strike',label:'COMBO',cooldown:3.2,power:34,kind:'combo',description:'34 damage, +12% per cast beruntun (maks 5 tumpukan). Hantaman telegraph mereset combo.'},
  {name:'Iron Stance',label:'COUNTER',cooldown:6.5,power:60,kind:'counter',description:'Selama 3,5 detik damage ke hero ini −50% dan setiap pukulan dibalas 60 damage.'},
  {name:'Hundred Fists',label:'FLURRY',cooldown:6,power:120,kind:'flurry',description:'Rentetan pukulan total 120 damage; stagger boss terisi dua kali lipat.'},
  {name:'Inner Calm',label:'CALM',cooldown:8,power:.3,kind:'selfheal',description:'Pulihkan 30% HP sendiri dan hapus semua fatigue.'}]},
 engineer: {name:'Engineer',color:'#d98f5c',hp:320,role:'Turret, perangkap, dan perbaikan',skills:[
  {name:'Spark Turret',label:'TURRET',cooldown:7,power:22,kind:'turret',description:'Pasang turret di lane sendiri: 22 damage per detik selama 6 detik ke target terdepan.'},
  {name:'Flash Mine',label:'STUN',cooldown:7.5,power:1.6,kind:'stun',description:'Tunda serangan musuh berikutnya 1,6 detik dan isi stagger boss 120.'},
  {name:'Patch Kit',label:'REPAIR',cooldown:14,power:1,kind:'repair',description:'Tambah 1 potion (maks 3). Sekali per stage.'},
  {name:'Overclock',label:'OVERCLOCK',cooldown:8,power:1.8,kind:'haste',description:'Cooldown tersisa setiap hero berkurang 1,8 detik.'}]}
};
KITS.warrior.skills.push(
 {name:'Shield Bash',label:'DISRUPT',cooldown:6.2,power:48,kind:'interrupt',description:'48 damage ke boss dan batalkan ritual all-grid aktif. Timing cast dengan tap.'},
 {name:'Rallying Wall',label:'RALLY',cooldown:8,power:54,kind:'partyshield',description:'54 shield untuk seluruh party. Lebih lambat dari Bulwark, melindungi semua lane.'}
);
KITS.rogue.skills.push(
 {name:'Expose',label:'EXPOSE',cooldown:5,power:42,kind:'mark',description:'42 damage dan tandai boss selama 4 detik: semua serangan +20% damage.'},
 {name:'Smoke Covenant',label:'SMOKE',cooldown:7,power:40,kind:'partyshield',description:'40 shield untuk seluruh party dan 2 detik buff untuk diri sendiri.'}
);
KITS.archer.skills.push(
 {name:'Silence Arrow',label:'SILENCE',cooldown:6.8,power:61,kind:'interrupt',description:'61 damage ke boss dan putus ritual all-grid. Hanya tersedia jika dipasang sebelum berangkat.'},
 {name:'Ricochet',label:'RICOCHET',cooldown:5.8,power:105,kind:'aoe',description:'105 power dibagi ke minion, atau seluruhnya ke boss saat lane bersih.'}
);
KITS.healer.skills.push(
 {name:'Aegis of Dawn',label:'AEGIS',cooldown:6.5,power:51,kind:'partyshield',description:'51 shield untuk setiap hero. Cegah damage sebelum terjadi; tidak menghidupkan yang tumbang.'},
 {name:'Wild Renewal',label:'RENEW',cooldown:8,power:12,kind:'regen',description:'Pulihkan seluruh party 12 HP per detik selama 6 detik. Recast memperbarui durasi, bukan menumpuk.'}
);
KITS.wizard.skills.push(
 {name:'Null Field',label:'NULL',cooldown:8.5,power:100,kind:'interrupt',description:'100 damage dan putus ritual all-grid. Jendela kontrol kuat dengan cooldown panjang.'}
);
for(const job of Object.values(JOBS)) KITS[job.base].skills[job.index]=job.skill;
export const ROSTER: {name:string;classId:ClassId;slot:number}[] = [
 {name:'Aldric',classId:'warrior',slot:0},{name:'Bran',classId:'warrior',slot:1},{name:'Sable',classId:'rogue',slot:2},
 {name:'Rowan',classId:'archer',slot:3},{name:'Lyra',classId:'healer',slot:4},{name:'Kestrel',classId:'archer',slot:5},
 {name:'Nyx',classId:'rogue',slot:6},{name:'Orin',classId:'wizard',slot:7},{name:'Mira',classId:'healer',slot:8},
 {name:'Tamsin',classId:'bard',slot:4},{name:'Vesper',classId:'hexer',slot:7},{name:'Pell',classId:'engineer',slot:6},
 {name:'Koa',classId:'monk',slot:1},{name:'Ilse',classId:'bard',slot:5},{name:'Hale',classId:'engineer',slot:8}
];
// Grid formation holds nine heroes; larger rosters bench the rest.
export const GRID_SIZE = 9;
export const CHAPTERS = ['The First Spark','Beneath the Canopy','The Broken Seal','The Emerald Gate'];
export const ENEMY_NAMES = ['VHAROK','VHAROK, AWAKENED','VHAROK, UNBOUND'];
export const UPGRADES = [
 {id:'power',name:'Ember Edge',icon:'✦',text:'+18% damage dan kekuatan heal.'},
 {id:'vitality',name:'Ancient Bark',icon:'✚',text:'+22% max HP. Party dipulihkan penuh.'},
 {id:'tempo',name:'Twin Metronome',icon:'⌛',text:'Cooldown 12% lebih cepat.'}
] as const;
