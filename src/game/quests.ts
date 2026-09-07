import type { Profile } from './profile';
import { ROSTER } from './content';
import { GEAR } from './jobs';
import { heroProgress } from './levels';
export type Quest = {id:string;name:string;giver:string;story:string;kind:'hunt'|'town'|'companion'|'descent';chapter:number;requires?:string;heroId?:number;metric:'enemy'|'chapters'|'level'|'talents'|'gear'|'raids'|'floor';target:number;enemy?:string;gold:number;xp:number;gear?:string};
const hunts:[string,string,string,number][]=[
 ['wolf','Tracks Beside the Cradle','Jejak abu mencapai rumah-rumah. Rowan meminta bukti bahwa jalan pulang aman.',0],
 ['goblin','The Stolen Rations','Lumbung tidak kosong karena kelaparan. Ada perintah militer di setiap karung yang dicuri.',0],
 ['spider','Names in the Silk','Jaring di jembatan menyimpan label nama para pengungsi. Putuskan sarangnya, bukan daftar mereka.',1],
 ['shaman','A Voice That Is Not Yours','Seorang anak mendengar suaranya sendiri dari sumur. Lyra mengenali irama ritual di dalamnya.',1],
 ['golem','The Bridge Remembers','Orin menemukan bahwa penjaga batu masih memungut tol dari orang yang sudah mati.',2],
 ['wraith','An Unfinished Funeral','Tidak ada nama yang boleh dihapus hanya karena lonceng tak mau mengingatnya.',2],
 ['treant','Roots Under the School','Akar membawa halaman pelajaran ke bawah tanah. Sable mencari halaman yang mengajarkan hari esok.',3],
 ['dragon','An Oath Freely Given','Temui penjaga gerbang lagi, kali ini tanpa memaksanya menerima sumpah kota.',3],
 ['moth','Lanterns Without Flames','Cahaya jalan menghilang satu per satu. Pemburu baru mengikuti panas yang tersisa.',1],
 ['basilisk','The Stone Orchard','Petani masih memanggil nama pohon-pohonnya. Di kebun, sesuatu menjawab dengan tatapan.',3],
 ['crab','The River Toll','Dermaga ditutup oleh cangkang besi. Tanpa jalur air, obat tidak akan tiba.',2],
 ['revenant','The Last Watch Never Ends','Penjaga yang gugur kembali meminta pergantian giliran. Beri ia akhir yang tidak diberikan kota.',5]
];
export const QUESTS:Quest[]=hunts.map(([enemy,name,story,chapter],i)=>({id:`hunt-${enemy}`,name,giver:'SCOUTS OF EMBERHOLLOW',story,kind:'hunt',chapter,metric:'enemy',enemy,target:1,gold:65+i*14,xp:100+i*25,gear:i<3?['iron-edge','oak-plate','ember-charm'][i]:undefined}));
const town:[string,string,string,Quest['metric'],number,number][]=[
 ['first-road','One Road Open','Jangan janjikan seluruh hutan. Buka satu jalan dulu, agar utusan benar-benar bisa pulang.','chapters',1,0],
 ['a-shared-craft','Tools, Not Trophies','Pandai besi meminta satu rekan memakai perlengkapan buatannya. Besi harus bekerja, bukan dipajang.','gear',2,1],
 ['a-lesson-kept','Teach Someone Tomorrow','Bawa pulang keahlian yang bisa diajarkan. Pelajari empat talent pada satu hero.','talents',4,1],
 ['letters-unburned','Letters Never Burned','Empat segel pulih. Peti surat yang dulu disegel akhirnya boleh dibuka.','chapters',4,3],
 ['river-of-names','A River of Names','Delapan perjalanan memberi cukup nama untuk menulis sejarah yang berbeda.','chapters',8,7],
 ['a-door-unlocked','Leave the Door Unlocked','Selesaikan kisah lonceng. Bangun pintu yang boleh dilewati, bukan segel baru.','chapters',16,15]
];
for(const [i,[id,name,story,metric,target,chapter]] of town.entries()) QUESTS.push({id,name,story,giver:'MAREN · TOWN STEWARD',kind:'town',chapter,requires:i?town[i-1][0]:undefined,metric,target,gold:90+i*70,xp:180+i*120,gear:GEAR.filter(g=>g.source==='quest')[i-3]?.id});
const companionStories=[
 ['A Shield Set Down','Aldric ingin cukup kuat untuk meletakkan perisainya tanpa meninggalkan siapa pun.'],
 ['A Wall with Windows','Bran belajar bahwa benteng juga harus memberi orang jalan melihat ke luar.'],
 ['The Name She Chose','Sable menyimpan nama untuk masa setelah perang. Bantu ia hidup cukup lama untuk memakainya.'],
 ['The Arrow Home','Rowan membuat anak panah yang tidak harus ditembakkan: penunjuk jalan pulang.'],
 ['A Song for the Living','Lyra menulis lagu tanpa nama orang mati di bait terakhirnya.'],
 ['The Weight of Speed','Kestrel selalu datang lebih dulu. Kali ini ia belajar menunggu rekan-rekannya.'],
 ['No Debt to the Night','Nyx berhenti menghitung hidup sebagai utang yang harus dilunasi.'],
 ['A Question Unanswered','Orin berlatih meninggalkan satu pertanyaan terbuka, agar masih ada alasan untuk bangun besok.'],
 ['Fire Without a Cage','Mira belajar memegang api tanpa mengurung siapa pun di dalam cahayanya.']
];
for(const [id,[name,story]] of companionStories.entries()) QUESTS.push({id:`companion-${id}`,name,giver:ROSTER[id].name.toUpperCase(),story,kind:'companion',chapter:0,heroId:id,metric:'level',target:8+Math.floor(id/3)*4,gold:180+id*20,xp:300+id*40});
for(const [i,floor] of [3,7,12].entries()) QUESTS.push({id:`descent-${floor}`,name:['Below the First Bell','The Seventh Echo','An Exit, Not a Throne'][i],giver:'THE KEEPER BELOW',story:['Tiga lantai cukup untuk membuktikan bahwa tangga ini tidak hanya turun di dalam mimpi.','Gema ketujuh membawa suara yang bukan milik penjaga lama.','Bawa kabar dari lantai kedua belas. Jangan jadikan kedalaman sebagai rumah baru.'][i],kind:'descent',chapter:i*3,requires:i?`descent-${[3,7,12][i-1]}`:undefined,metric:'floor',target:floor,gold:200+i*220,xp:400+i*350});
export function questProgress(p:Profile,q:Quest) {
  const unlocked=p.cleared.length>=q.chapter&&(!q.requires||p.claimedQuests.includes(q.requires))&&(q.heroId===undefined||p.roster.includes(q.heroId));
  let value=0;
  if(q.metric==='enemy')value=p.ledger.enemies[q.enemy!]??0;
  if(q.metric==='chapters')value=p.cleared.length;
  if(q.metric==='level')value=heroProgress(p.loadouts[q.heroId!]?.xp).level;
  if(q.metric==='talents')value=Math.max(0,...p.roster.map(id=>p.loadouts[id].talents.length));
  if(q.metric==='gear')value=Math.max(0,...p.roster.map(id=>Object.values(p.loadouts[id].gear??{}).filter(Boolean).length));
  if(q.metric==='raids')value=p.ledger.raids;
  if(q.metric==='floor')value=p.bestFloor;
  const claimed=p.claimedQuests.includes(q.id);
  return {unlocked,claimed,value:Math.min(value,q.target),ready:unlocked&&!claimed&&value>=q.target};
}
