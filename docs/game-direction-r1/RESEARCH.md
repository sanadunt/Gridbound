# Riset referensi — arah game R1

**Riset dokumen publik, bukan hands-on playtest.** Diakses 7 September 2026. Halaman store berisi deskripsi penerbit: memadai untuk memahami mekanik yang mereka nyatakan, bukan bukti semua build seimbang, pemain menyukainya, atau game Gridbound akan berhasil.

## Ringkasan

Gridbound memerlukan tiga loop yang berbeda, bukan tiga tombol ke progression yang sama. Referensi memberi pola: build berubah sepanjang run, pilihan rute berisiko, telegraph yang dapat dibaca, karakter dengan identitas, dan persiapan ekspedisi. Adaptasi di bawah adalah **kesimpulan desain kita**, bukan pernyataan penerbit tentang Gridbound.

| Referensi | Fakta yang ditemukan | Adaptasi untuk Gridbound (usulan) | Yang tidak diambil |
|---|---|---|---|
| Hades | Escape attempts membuka cerita, Boons mengubah kemampuan, dan Mirror of Night memberi perkembangan permanen.[1] | Upgrade run dipisahkan dari unlock antar-run. Lore kecil kembali ke hub, tetapi kisah utama tidak dikunci di balik grinding Roguelike. | Mythology, dialog, aset, atau asumsi permanent raw-power grind harus menjadi inti semua mode. |
| Slay the Spire | Rute berubah, pemain memilih jalan aman/berisiko, interaksi relic memengaruhi build; custom mode memiliki run modifiers.[2] | Peta node Roguelike, preview risiko, pilihan upgrade dengan synergy; challenge relic mengubah aturan. | Card combat, daftar kartu/relic, nama event atau layout persis. |
| Into the Breach | Serangan musuh ditelegrafkan; upgrade senjata/pilot muncul sepanjang tantangan.[3] | Pertahankan intent terlihat pada combat Gridbound; mutator dilarang menghapus semua telegraph. | Mengganti game menjadi turn-based, atau mengklaim UI kita sudah terbaca karena memakai grid. |
| Octopath Traveler II | Traveler mempunyai asal/motivasi/skill unik; pengembangan jobs/skills dan latent power unik per traveler disebut eksplisit.[4] | Identitas Aldric berbeda dari Bran walau sama-sama Warrior; unique advancement dan Ultra per karakter. | Delapan traveler, dunia Solistia, sistem Break/Boost persis, atau tuntutan HD-2D mahal. |
| Darkest Dungeon | Merekrut, melatih dan memimpin party ke dungeon, dengan persiapan/pemulihan di town, risiko stress dan permadeath.[5] | Story dungeon memakai party persisten dan pilihan resource sebelum/saat ekspedisi. | Permadeath hero Story, stress spiral, hukuman farming yang bertentangan dengan casual premium. |

## Sintesis: hal yang cocok dan yang bertentangan

Hades dan Slay the Spire sama-sama menempatkan variasi di dalam percobaan/run, tetapi deskripsi Hades juga menekankan permanent upgrades, sedangkan Slay the Spire menyoroti deck/relic di tiap attempt.[1][2] **Keputusan R1:** meta Challenge terutama membuka alternatif dan tingkat tantangan; bukan multiplier stat permanen yang wajib digrind.

Darkest Dungeon menjual ekspedisi penuh attrition/stress/permadeath, sementara Gridbound diminta casual, beberapa profile, serta Story yang runut.[5] **Keputusan R1:** attrition hanya pada ekspedisi; kekalahan Story tidak menghapus karakter, ending atau slot save.

Telegraph eksplisit Into the Breach dan latent power unik Octopath memberi dua arah yang saling melengkapi: informasi musuh jelas, tetapi respons pemain bervariasi.[3][4] **Keputusan R1:** challenge berarti pola/tujuan berubah, bukan tooltip menghilang atau stat seragam membesar.

## Batas riset

- Web search dan web_extract gagal 403 pada backend retrieval. Dilanjutkan dengan direct HTTPS GET terhadap halaman publik Steam; lima halaman mengembalikan HTTP 200 dan bagian `About This Game` benar-benar dibaca.
- Situs Subset langsung timeout; halaman Steam Into the Breach dipakai sebagai sumber alternatif resmi distribusi.
- Tidak login, tidak mengambil akun privat, tidak mengunduh aset game, tidak membeli game.
- Tidak mengutip angka harga/review/retention sebagai evidence desain; snapshot store dapat berubah.
- Detail ekonomi, jumlah party, formula damage, durasi run dan harga di dokumen R1 adalah rancangan kita. Bukan hasil reverse-engineering game referensi.
- Riset tidak membuktikan pacing, balance, fun, readability, accessibility atau performa. Itu tetap gate prototype dan human playtest.

## Keputusan yang lahir dari riset

1. Title → mode → profile → hub/map; setiap mode menjelaskan persist/reset sebelum Start.
2. Story gold/material tidak berhubungan dengan Crystal Challenge.
3. Roguelike mempunyai node, toko, upgrade, event dan boss; bukan endless combat berulang dengan tiga opsi stat saja.
4. Story dungeon mempunyai rute/event/attrition tetapi **tidak** punya draft upgrade atau shop di dalam.
5. Raid rewarded memakai aturan tervalidasi; parameter bebas masuk Sandbox, tidak mencetak Crystal.
6. Membangun banyak Ultra tanpa identitas/kondisi unlock hanya menambah UI noise; R1 memakai katalog unik dan slot pilihan terbatas.

## Evidence singkat

- Hades: “Permanent upgrades mean you don't have to be a god yourself to experience the exciting combat and gripping story.”[1]
- Slay the Spire: “Choose a risky or safe path, face different enemies, choose different cards, discover different relics, and even fight different bosses!”[2]
- Into the Breach: “All enemy attacks are telegraphed in minimalistic, turn-based combat.”[3]
- Octopath II: “Each traveler possesses a unique latent power, which can be used to turn the tide of battle.”[4]
- Darkest Dungeon: “Recruit, train, and lead a team of flawed heroes through twisted forests, forgotten warrens, ruined crypts, and beyond.”[5]

Source IDs, URL dan kutipan didaftarkan serta diperiksa dengan ledger. [Ledger lokal paket](research-ledger.json) menyimpan provenance; full halaman riset hanya di ignored `artifacts/design-research/`, bukan dibundel sebagai aset game.

## Sources

[1] https://store.steampowered.com/app/1145360/Hades
[2] https://store.steampowered.com/app/646570/Slay_the_Spire
[3] https://store.steampowered.com/app/590380/Into_the_Breach
[4] https://store.steampowered.com/app/1971650/OCTOPATH_TRAVELER_II
[5] https://store.steampowered.com/app/262060/Darkest_Dungeon
