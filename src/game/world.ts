import { EXTRA_CAMPAIGN } from './story';
export type EnemyId = string;
export type Intent = 'front'|'meteor'|'breath'|'weakest'|'strongest'|'all';
export type EnemyDef = { id: EnemyId; name: string; title: string; description: string; counter: string; patterns: Intent[]; hp: number; damage: number; interval: number; archetype?: string; tint?:number; tier?:number };
export const ENEMIES: Record<string, EnemyDef> = {
  wolf: { id:'wolf', name:'Ashfang', title:'CINDER WOLF', description:'Pemburu luka. Menandai hero dengan HP absolut terendah, lalu menerkam garis depan.', counter:'Marked mengikuti hero. Pulihkan target atau lindungi dengan Guard; hindari sapuan tanah.', patterns:['weakest','front','strongest'], hp:1, damage:62, interval:9 },
  goblin: { id:'goblin', name:'Scrap Marshal', title:'GOBLIN WAR BAND', description:'Taktisi pemulung mengincar hero dengan kekuatan skill tertinggi. Sisa kelompoknya melempar bom ke tile ramai.', counter:'Strongest dihitung dari power skill per cooldown. Ganti stance sebelum mark untuk mengubah prioritas musuh.', patterns:['strongest','strongest','meteor','weakest'], hp:.9, damage:73, interval:8.5 },
  spider: { id:'spider', name:'Silk Widow', title:'VENOM BROOD', description:'Mengurung hero yang terluka dan memenuhi grid dengan brood venom setelah dua pola pembuka.', counter:'Keluar dari tile web sebelum impact. Simpan Guard untuk venom seluruh grid.', patterns:['weakest','meteor','all'], hp:1, damage:72, interval:8 },
  shaman: { id:'shaman', name:'Hollow Cantor', title:'BELL CULT SHAMAN', description:'Ritual lonceng retak menghantam semua tile. Ia mengincar healer yang terluka setelah ritual selesai.', counter:'All-grid bisa diputus Shield Bash, Silence Arrow, atau Null Field. Tanpa skill itu, timing Party Guard.', patterns:['all','weakest','breath'], hp:1.05, damage:86, interval:9 },
  golem: { id:'golem', name:'Ironroot', title:'RUIN GOLEM', description:'Sapuannya menggilas barisan terdepan yang masih ditempati. Ketika marah, semua lantai runtuh.', counter:'Front mengikuti ROW terdepan yang dihuni saat telegraph dimulai, bukan selalu row pertama. Reposisi setelah tanda muncul.', patterns:['front','strongest','all'], hp:1.15, damage:98, interval:9 },
  wraith: { id:'wraith', name:'The Unburied', title:'OATHBOUND WRAITH', description:'Memburu jiwa terlemah, lalu memukul seluruh party dengan ratapan. Mark tetap mengikuti target saat dipindah.', counter:'Heal menjelang mark, Guard saat ratapan. Bunuh spirit minion agar mereka tidak menghabisi target.', patterns:['weakest','all','strongest'], hp:1, damage:100, interval:7.8 },
  treant: { id:'treant', name:'Mournbark', title:'ANCIENT TREANT', description:'Penjaga hutan yang terinfeksi: akar menyapu depan, spora menelan grid, lalu duri menghantam tile ramai.', counter:'Jangan bertahan di front yang ditandai. Guard spora atau interrupt; shield satu lane membantu attrition.', patterns:['front','all','meteor'], hp:1.12, damage:106, interval:8.5 },
  dragon: { id:'dragon', name:'Vharok', title:'THE EMERALD GATE', description:'Penjaga segel terakhir. Breath satu lane, sapuan depan, meteor, lalu Emerald Cataclysm ke seluruh grid.', counter:'Baca empat pola. Sisakan Guard untuk Cataclysm; phase lanjut menambahkan aftershock tertunda.', patterns:['breath','front','meteor','all'], hp:1.2, damage:112, interval:8.2 },
};
export const VARIANTS=[{id:'ash',name:'Ashbound',tint:0xf1b39a,hp:1.12,damage:1.05},{id:'frost',name:'Frostbound',tint:0xa6d6ff,hp:1.22,damage:1.1},{id:'auric',name:'Gilded',tint:0xffd79a,hp:1.32,damage:1.15}];
for(const enemy of Object.values(ENEMIES)){enemy.archetype=enemy.id;enemy.tier=1;for(const [i,v] of VARIANTS.entries()){const id=`${enemy.id}-${v.id}`;ENEMIES[id]={...enemy,id,name:`${v.name} ${enemy.name}`,title:`${v.name.toUpperCase()} · ${enemy.title}`,tint:v.tint,tier:i+2,hp:enemy.hp*v.hp,damage:Math.round(enemy.damage*v.damage),interval:enemy.interval-i*.3,patterns:[...enemy.patterns.slice(i%enemy.patterns.length),...enemy.patterns.slice(0,i%enemy.patterns.length)],description:`${enemy.description} Varian ${v.name}: urutan intent bergeser dan tekanan meningkat.`};}}
export type StageDef = { enemy: EnemyId; kind:'wave'|'miniboss'|'boss'; name:string; hp:number; beat?:string };
export type CampaignDef = { id:string; name:string; subtitle:string; speaker:string; intro:string; outro:string; recruit:number[]; reward:number; stages:StageDef[] };
export const CAMPAIGN: CampaignDef[] = [
  { id:'ashwood',name:'Ashwood Trail',subtitle:'Follow the missing scouts',speaker:'LYRA · AT THE NORTH GATE',intro:'Sable seharusnya pulang sebelum lonceng senja. Yang kembali hanya panah patah dan jejak serigala. Aldric mengangkat perisainya. Rowan menunjuk bara di antara pohon: seseorang masih hidup di sana.',outro:'Sable terlepas dari akar yang membelenggunya. Di tangannya ada pecahan segel pertama. “Mereka tidak membakar hutan,” katanya. “Mereka sedang membangunkan sesuatu di bawahnya.” Lonceng Emberhollow berbunyi lagi.',recruit:[2],reward:95,stages:[
    {enemy:'wolf',kind:'wave',name:'The scent of cinders',hp:350},{enemy:'goblin',kind:'wave',name:'Scavenger barricade',hp:470},{enemy:'spider',kind:'miniboss',name:'Silk across the path',hp:700},{enemy:'treant',kind:'boss',name:'The root that remembers',hp:1150}] },
  { id:'sunken',name:'Sunken Ruins',subtitle:'Find the voice beneath the stone',speaker:'SABLE · THE BROKEN BRIDGE',intro:'Pecahan segel bergetar dekat reruntuhan. Orin, seorang peneliti yang hilang, meninggalkan rune di batu: JANGAN IKUTI SUARANYA. Dari bawah jembatan, suara Orin meminta pertolongan.',outro:'Orin memutus nyanyian palsu dengan segel kedua. Suara itu bukan miliknya, melainkan gema sumpah para penjaga lama. “Empat segel bukan penjara,” ia berkata. “Mereka menahan mimpi seekor naga.”',recruit:[7],reward:150,stages:[
    {enemy:'goblin',kind:'wave',name:'Stolen relics',hp:800},{enemy:'shaman',kind:'wave',name:'The false voice',hp:1000},{enemy:'golem',kind:'miniboss',name:'Warden of the bridge',hp:1600},{enemy:'wraith',kind:'boss',name:'The oath below',hp:2400}] },
  { id:'blackbriar',name:'Blackbriar Keep',subtitle:'Break the siege, ring the bell',speaker:'ORIN · THE SIEGE ROAD',intro:'Bran dan Kestrel masih menjaga menara luar, tetapi akarnya sudah menembus tembok. Jika lonceng ketiga runtuh, Emberhollow kehilangan perlindungannya. Tidak ada waktu menunggu pasukan lain.',outro:'Bran menahan pintu sementara Kestrel menyalakan lonceng ketiga. Mereka ikut pulang, membawa peta gerbang. Dari kejauhan terdengar sayap: Vharok sudah membuka satu mata.',recruit:[1,5],reward:215,stages:[
    {enemy:'spider',kind:'wave',name:'Brood at the walls',hp:1300},{enemy:'wolf',kind:'wave',name:'The hungry vanguard',hp:1450},{enemy:'shaman',kind:'miniboss',name:'Cantor of the siege',hp:2300},{enemy:'golem',kind:'boss',name:'Ironroot awakens',hp:3800}] },
  { id:'emerald',name:'The Emerald Gate',subtitle:'Wake the guardian, not the hunger',speaker:'ALDRIC · THE LAST CAMPFIRE',intro:'Nyx dan Mira menjaga segel terakhir sendirian. Di seberang gerbang, naga memimpikan hutan tanpa manusia. Kita tidak datang untuk membunuh penjaganya. Kita datang untuk menghentikan apa yang sedang memakan mimpinya.',outro:'Cahaya empat segel bertemu di dada Vharok. Naga itu menunduk, bukan kalah, melainkan terbangun. Nyx dan Mira membawa api terakhir pulang. Untuk pertama kalinya, lonceng Emberhollow berbunyi bukan sebagai peringatan. Di bawah menara, masih ada satu tangga yang belum dijelajahi…',recruit:[6,8],reward:320,stages:[
    {enemy:'wraith',kind:'wave',name:'Echoes of the lost',hp:2000},{enemy:'shaman',kind:'wave',name:'The final chorus',hp:2350},{enemy:'treant',kind:'miniboss',name:'Heart of the forest',hp:3500},{enemy:'dragon',kind:'boss',name:'A guardian dreaming',hp:6200}] },
];
CAMPAIGN.push(...EXTRA_CAMPAIGN);
export type BoonDef = { id:string; name:string; patron:string; description:string };
export const BOONS: BoonDef[] = [
  {id:'ember',name:'Cinder Fingers',patron:'EMBER · TAP',description:'Setiap 3 tap efektif memicu 18 fire damage langsung ke musuh utama. Fatigue tetap berlaku.'},
  {id:'storm',name:'Second Thunder',patron:'STORM · CAST',description:'Setiap cast ofensif kelima mengulang 55% power ke boss. Cocok dengan build cooldown cepat.'},
  {id:'tide',name:'Mercy Overflows',patron:'TIDE · HEAL',description:'35% overheal berubah menjadi shield. Heal saat sehat sekarang menyiapkan pertahanan.'},
  {id:'thorn',name:'Briar Oath',patron:'THORN · SHIELD',description:'35% damage yang diserap shield atau Guard dipantulkan ke boss. Bersinergi dengan overheal.'},
  {id:'bell',name:'Resonant Shelter',patron:'BELL · GUARD',description:'Party Guard langsung memberi 18 Resolve dan cooldown Guard berkurang 3 detik.'},
  {id:'fleet',name:'Dancer in Ash',patron:'GALE · MOVEMENT',description:'Penalti relokasi turun dari 0,9 ke 0,2 detik. Hero yang dipindah mendapat 30 shield.'},
  {id:'resolve',name:'Dawn Runs Deep',patron:'DAWN · ULTIMATE',description:'Seluruh sumber Resolve mengisi 60% lebih cepat. Lebih banyak Ninefold Dawn dalam satu fight.'},
  {id:'execution',name:'Last Light',patron:'ASH · EXECUTE',description:'Damage ke boss di bawah 30% HP meningkat 40%. Ledakan akhir saat phase paling berbahaya.'},
  {id:'frost',name:'Winter Between Beats',patron:'FROST · CONTROL',description:'Setiap cast memperlambat jadwal intent berikutnya 0,16 detik. Telegraph aktif tetap berjalan.'},
  {id:'feast',name:'For the Living',patron:'HARVEST · MINIONS',description:'Setiap minion tumbang memulihkan 24 HP seluruh party. Jangan abaikan summon.'},
  {id:'lifeline',name:'Not Yet, Little Flame',patron:'HEARTH · SURVIVAL',description:'Sekali per hero per floor, pukulan fatal menyisakan 20% HP. Kesempatan kedua, bukan kebal.'},
  {id:'chorus',name:'Many Hands, One Song',patron:'CHORUS · ROTATION',description:'Tap hero berbeda dari tap sebelumnya memberi hero itu Battle Hymn selama 2 detik (+30% power, +20% tempo).'},
];
export function boonChoices(owned: string[], seed: number): BoonDef[] {
  const pool = BOONS.filter(b => !owned.includes(b.id));
  let state = seed >>> 0;
  for (let i = pool.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
