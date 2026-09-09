import { ROSTER, type ClassId } from './content';

export type D8Path = {
  id: string;
  heroId: number;
  baseClass: ClassId;
  name: string;
  description: string;
};

export type D8Ultra = {
  id: string;
  ownerHeroId: number;
  gate: string;
  effect: string;
  icon: string;
  testHook: string;
};

const hero = (id: number) => ROSTER[id];
const path = (id: string, heroId: number, name: string, description: string): D8Path => ({
  id, heroId, baseClass: hero(heroId).classId, name, description,
});

export const D8_ADVANCED_PATHS: readonly D8Path[] = Object.freeze([
  path('aldric-vanguard', 0, 'Aldric · Vanguard', 'Menahan tekanan depan dan membuka ruang untuk party.'),
  path('aldric-oathguard', 0, 'Aldric · Oathguard', 'Mengubah barrier menjadi tempo perlindungan.'),
  path('bran-breaker', 1, 'Bran · Breaker', 'Memecah ritual musuh lewat serangan terukur.'),
  path('bran-warden', 1, 'Bran · Warden', 'Menjaga jalur belakang saat formasi bergeser.'),
  path('sable-cutpurse', 2, 'Sable · Cutpurse', 'Mengambil peluang tanpa mengubah ekonomi Story.'),
  path('sable-witness', 2, 'Sable · Witness', 'Menandai target dan membuat bukti tetap terbaca.'),
  path('rowan-briar', 3, 'Rowan · Briar', 'Membersihkan minion untuk membuka weak point.'),
  path('rowan-skyline', 3, 'Rowan · Skyline', 'Menukar posisi aman dengan burst terarah.'),
  path('lyra-kindler', 4, 'Lyra · Kindler', 'Menyebarkan heal kecil sebelum luka menjadi krisis.'),
  path('lyra-bellhand', 4, 'Lyra · Bellhand', 'Mengunci ritme party lewat sinyal yang konsisten.'),
  path('kestrel-fleetwing', 5, 'Kestrel · Fleetwing', 'Mengutamakan tempo relokasi dan rescue.'),
  path('kestrel-longwatch', 5, 'Kestrel · Longwatch', 'Mengubah jarak menjadi kontrol target.'),
  path('nyx-threader', 6, 'Nyx · Threader', 'Menjahit debuff ke celah pertahanan lawan.'),
  path('nyx-veilstep', 6, 'Nyx · Veilstep', 'Menghindari intent dengan biaya yang terbaca.'),
  path('orin-forecast', 7, 'Orin · Forecast', 'Menyusun urutan cooldown dari pola yang terlihat.'),
  path('orin-chronicle', 7, 'Orin · Chronicle', 'Menyimpan satu kesalahan agar tidak diulang buta.'),
  path('mira-caretaker', 8, 'Mira · Caretaker', 'Memperkuat klinik dan recovery warga.'),
  path('mira-wayfinder', 8, 'Mira · Wayfinder', 'Menjaga rute air dan pengiriman tetap hidup.'),
]);

export const D8_THIRD_PATHS: readonly D8Path[] = Object.freeze([
  path('aldric-bastion', 0, 'Aldric · Bastion', 'Perlindungan luas dengan tradeoff tempo yang jelas.'),
  path('aldric-sentinel', 0, 'Aldric · Sentinel', 'Menjawab serangan lane tanpa menghapus risiko.'),
  path('bran-ironwake', 1, 'Bran · Ironwake', 'Counter berat untuk tekanan frontal.'),
  path('bran-bridgeward', 1, 'Bran · Bridgeward', 'Memindahkan perlindungan tanpa meninggalkan pekerja.'),
  path('sable-quietus', 2, 'Sable · Quietus', 'Finisher terarah saat target benar-benar terbuka.'),
  path('sable-archive', 2, 'Sable · Archive', 'Bukti publik dengan consent sebagai gate.'),
  path('rowan-wildsong', 3, 'Rowan · Wildsong', 'Mencipta pola baru setelah kehilangan.'),
  path('rowan-horizon', 3, 'Rowan · Horizon', 'Burst jauh yang tetap punya counterplay.'),
  path('lyra-second-dawn', 4, 'Lyra · Second Dawn', 'Overheal menjadi barrier, bukan revive gratis.'),
  path('lyra-chorister', 4, 'Lyra · Chorister', 'Buff lebih lama dengan Resolve terbatas.'),
  path('kestrel-rescue', 5, 'Kestrel · Rescue Captain', 'Timing rescue menjadi objective, bukan damage race.'),
  path('kestrel-signal', 5, 'Kestrel · Signal Keeper', 'Membaca intent sebelum memilih target.'),
  path('nyx-namekeeper', 6, 'Nyx · Namekeeper', 'Menghormati bentuk dan nama pilihan warga.'),
  path('nyx-reaper', 6, 'Nyx · Reaper', 'Execute hanya aktif pada ambang yang fair.'),
  path('orin-uncertain', 7, 'Orin · Uncertain Guide', 'Forecast membantu, tetapi tidak menjanjikan kepastian.'),
  path('orin-hourkeeper', 7, 'Orin · Hourkeeper', 'Mendorong intent mundur dengan cooldown panjang.'),
  path('mira-civic', 8, 'Mira · Civic Anchor', 'Kota mendapat kapasitas kolektif yang terlihat.'),
  path('mira-provisioner', 8, 'Mira · Provisioner', 'Supply route kuat tanpa mengubah Crystal wallet.'),
]);

const ultra = (id: string, ownerHeroId: number, gate: string, effect: string, icon: string, testHook: string): D8Ultra => ({ id, ownerHeroId, gate, effect, icon, testHook });
const ultraPairs = [
  ['aldric',0,'Shield timing','Barrier seluruh party; damage yang ditahan tetap punya batas.','✦','shield-cap'],
  ['bran',1,'Break window','Memutus ritual dan memberi stagger terukur.','◆','interrupt-window'],
  ['sable',2,'Marked target','Expose target selama jendela singkat.','◈','mark-duration'],
  ['rowan',3,'Clean lane','Volley menguat saat lane bersih.','➶','lane-clean'],
  ['lyra',4,'Living ally','Heal tidak menghidupkan hero tumbang.','✚','no-revive'],
  ['kestrel',5,'Rescue timing','Relokasi menyelamatkan ally dengan penalti nyata.','➤','rescue-cost'],
  ['nyx',6,'Execute threshold','Bonus hanya di bawah ambang HP authored.','◌','execute-threshold'],
  ['orin',7,'Forecast read','Intent berikutnya terlihat, bukan dihapus.','⌛','intent-preview'],
  ['mira',8,'Civic route','Recovery route memberi supply, bukan Crystal.','⌂','supply-only'],
] as const;
export const D8_ULTRAS: readonly D8Ultra[] = Object.freeze([
  ...ultraPairs.flatMap(([key, heroId, gate, effect, icon, hook]) => [
    ultra(`${key}-ultra-core`, heroId, gate, effect, icon, hook),
    ultra(`${key}-ultra-signature`, heroId, `${gate} + signature path`, `${effect} Signature variant dengan cooldown lebih panjang.`, icon, `${hook}-signature`),
    ultra(`${key}-ultra-capstone`, heroId, `${gate} + capstone`, `${effect} Capstone membuka payoff final tanpa loop proc.`, icon, `${hook}-capstone`),
  ]),
  ultra('party-bell-ultra', 0, 'Three heroes alive', 'Party shield dan signal defensif dalam satu cast.', '🔔', 'party-shield'),
  ultra('unwritten-dawn-ultra', 7, 'Chapter 16 ending', 'Membuka ending canonical; tidak mengubah outcome menjadi branch baru.', '☼', 'canonical-ending'),
  ultra('shared-signal-ultra', 8, 'Three heroes alive', 'Signal civic memperkuat recovery tanpa menghapus risiko encounter.', '⌂', 'shared-signal'),
  ultra('last-bell-ultra', 3, 'Boss unbound', 'Melunasi motif bell tanpa menghidupkan kembali ancaman lama.', '🔔', 'boss-unbound'),
  ultra('new-name-ultra', 6, 'Eda consent', 'Menghormati nama pilihan Eda tanpa memaksa perfect undo.', '✎', 'name-consent'),
]);

export function d8CatalogReferencesAreValid(): boolean {
  return [...D8_ADVANCED_PATHS, ...D8_THIRD_PATHS].every(item => ROSTER[item.heroId]?.classId === item.baseClass)
    && D8_ULTRAS.every(item => Boolean(ROSTER[item.ownerHeroId]));
}
