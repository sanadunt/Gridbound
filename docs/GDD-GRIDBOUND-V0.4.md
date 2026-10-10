# Gridbound: Ashes of the Bell

## Game Design Document

> **Baseline:** current browser runtime, package version `0.4.0`
> **Status:** implementation reference, not a proposal for unbuilt features
> **Spoilers:** this document reveals the campaign's central mystery and ending.

## Cara menggunakan dokumen ini

Dokumen ini merangkum pengalaman pemain, aturan game, cerita, konten, antarmuka, penyimpanan, serta batas verifikasi Gridbound yang ada di source saat ini. Runtime TypeScript di `src/` menjadi acuan saat teks dokumen dan perilaku aplikasi berbeda.

- **Sudah ada** berarti ada definisi atau jalur runtime di `src/`.
- **Lolos smoke lokal** berarti bukti pengujian lokal tercatat di [GUI-VERIFIED.md](GUI-VERIFIED.md). Itu bukan sertifikasi perangkat fisik atau deployment.
- **Belum ditetapkan** berarti repo tidak memberi keputusan produk yang cukup untuk menyatakan angka atau target tersebut.
- **R1 / target** berarti tercatat di [paket game-direction R1](game-direction-r1/README.md), tetapi dokumen R1 sendiri bukan bukti bahwa fitur telah dibuat.

Beberapa konsep di dokumen R1 juga punya bentuk yang memang sudah ada di runtime. Dokumen ini menyebutnya sebagai fitur saat ini hanya jika ada bukti langsung di source atau catatan smoke yang relevan. Jangan menganggap semua angka, sistem, atau janji R1 telah menjadi bagian dari game.

`Gridbound_GDD_GRID_RAID.md` adalah ekspor konten yang dibuat dari database. Gunakan file itu untuk indeks konten dan tabel yang dihasilkannya, tetapi gunakan `src/` dan dokumen ini untuk membaca arsitektur mode, penyimpanan Commander, dan batas produk terbaru. Jika angka runtime bertentangan dengan catatan ekspor, source `src/` menang. `data/database.json` dan GDD ekspor dapat dibuat ulang, bukan sumber authoring utama.

## Daftar isi

1. [Ringkasan produk](#1-ringkasan-produk)
2. [Visi dan pilar desain](#2-visi-dan-pilar-desain)
3. [Pemain, platform, dan batas produk](#3-pemain-platform-dan-batas-produk)
4. [Dunia, cerita, dan karakter](#4-dunia-cerita-dan-karakter)
5. [Struktur sesi dan loop pemain](#5-struktur-sesi-dan-loop-pemain)
6. [Mode permainan](#6-mode-permainan)
7. [Aturan combat](#7-aturan-combat)
8. [Roster dan perkembangan karakter](#8-roster-dan-perkembangan-karakter)
9. [Konten campaign dan musuh](#9-konten-campaign-dan-musuh)
10. [Quest, ekonomi, dan reward](#10-quest-ekonomi-dan-reward)
11. [Antarmuka, kontrol, dan aksesibilitas](#11-antarmuka-kontrol-dan-aksesibilitas)
12. [Arah visual dan audio](#12-arah-visual-dan-audio)
13. [Teknologi, save, dan batas operasi](#13-teknologi-save-dan-batas-operasi)
14. [Verifikasi dan risiko yang diketahui](#14-verifikasi-dan-risiko-yang-diketahui)
15. [Hal yang belum ditetapkan](#15-hal-yang-belum-ditetapkan)
16. [Glosarium](#16-glosarium)
17. [Rujukan](#17-rujukan)

## 1. Ringkasan produk

**Logline:** Bangun party Bellkeeper, baca telegraph pada grid tiga lane, atur stance dan posisi hero, lalu percepat skill dengan tap saat Emberhollow mengungkap harga perlindungannya.

Gridbound adalah tactical RPG single-player untuk browser dengan pixel art lokal dan combat real-time berbasis grid. Pemain menyiapkan roster, skill, job, talent, gear, dan formasi di Emberhollow; kemudian memilih campaign chapter, Raid contract, atau Roguelike descent. Skill hero berjalan otomatis berdasarkan cooldown. Pemain mengarahkan tempo dengan tap, mengganti skill yang sedang aktif, menjaga party, memakai potion dan ultimate, serta memindahkan hero keluar dari telegraph yang bisa dihindari.

| Bidang | Definisi saat ini |
|---|---|
| Genre | Tactical RPG real-time berbasis grid, dengan campaign authored, Raid, dan Roguelike. |
| Pemain | Satu pemain lokal. Tidak ada multiplayer, akun wajib, atau leaderboard online. |
| Platform | Browser desktop dan mobile. Tidak ada build native iOS atau Android. |
| Runtime | TypeScript, Phaser, Vite, UI DOM, Canvas art, dan Web Audio. |
| Konten inti | Empat act, 16 chapter, 76 encounter campaign; lima belas hero dari sembilan basic job; Undercroft (dungeon acak delapan depth), Heroic replay, Raid, dan Roguelike yang dapat diulang. |
| Layanan | Tidak memerlukan backend, account service, atau CDN untuk menjalankan game. Save berada di penyimpanan browser. |
| Model bisnis | Tidak ada ads, pembelian dalam aplikasi, loot box, atau mata uang berbayar yang diimplementasikan. Harga dan model distribusi belum ditetapkan di repo. |
| Status perilisan | Build statis dapat dibuat, tetapi tidak ada klaim deployment live atau penerimaan produksi. |

## 2. Visi dan pilar desain

[INFERENCE] Visi, fantasi, dan pilar berikut menyintesis cerita serta mekanik runtime menjadi tujuan desain yang mudah dirujuk. Ini bukan keputusan formal yang disetujui terpisah atau hasil riset pemain.

### Fantasi pemain

Pemain menjadi Bellkeeper yang melindungi Emberhollow tanpa mengambil alih masa depan orang lain. Dalam combat, fantasi itu tampil sebagai pengambilan keputusan cepat: siapa yang perlu dilindungi, kapan harus menginterupsi ritual, apakah aman berpindah tile, dan skill mana yang sedang dipersiapkan.

### Pilar

| Pilar | Pengalaman yang dituju | Sistem yang mendukungnya |
|---|---|---|
| Taktik yang terbaca | Pemain bisa memahami ancaman sebelum dampaknya tiba. | Intent cycle musuh, telegraph berwarna, lane/row/tile, target mark, Guard, dan interrupt. |
| Tempo yang dimainkan | Pemain ikut membentuk ritme tanpa menekan tombol cast berulang untuk setiap skill. | Cooldown berjalan otomatis; tap mempercepat cooldown; fatigue membatasi tap beruntun; stance menentukan skill yang otomatis cast berikutnya. |
| Party yang dibangun | Roster dan loadout memberi pilihan komposisi, bukan sekadar angka level. | Lima basic job, 20 job lanjutan, dua slot skill, talent, gear, formasi, serta party Story yang tumbuh dari tiga sampai enam hero aktif. |
| Kemajuan lintas skala | Chapter memberi perkembangan permanen; Rogue memberi eksperimen build sementara; Raid memberi encounter yang dipilih pemain. | Gold, XP, job, gear, quest, boon, kontrak Raid, bank Crystal, dan wallet run yang terpisah. |
| Cerita tentang pilihan | Keselamatan tidak membenarkan penghapusan identitas atau persetujuan. | Cerita authored tentang memori dan kontrak, tiga pilihan kecil yang memengaruhi kartu epilog, serta satu ending utama. |

### Pengalaman dalam kerangka MDA

[INFERENCE] Sebagai pembacaan desain, sasaran pengalaman GDD ini mencakup **challenge**, **narrative**, **discovery**, dan **expression**. Mechanics seperti telegraph, tap-fatigue, formasi, dan build hero menciptakan dinamika rotasi, mitigasi risiko, dan spesialisasi. Dinamika tersebut menjadi dasar pengalaman taktis dan tematik yang dituju. Kerangka MDA adalah alat analisis, bukan bukti bahwa pemain telah menganggap game menyenangkan.

## 3. Pemain, platform, dan batas produk

### Profil pemain

Demografi, usia, wilayah pemasaran, rating umur, durasi sesi rata-rata, dan target penjualan belum ditetapkan dalam repository. [INFERENCE] Dari mekaniknya, game ini mengasumsikan pemain bersedia membaca intent, mengelola cooldown, mencoba susunan party, dan mengikuti cerita chapter. Itu asumsi kebutuhan sistem, bukan hasil riset pemain.

### Perangkat dan input

- Game berjalan di browser dengan mouse/pointer, touch, dan keyboard.
- Layout mendukung viewport desktop serta mobile dan mengubah navigasi Town pada ukuran layar kecil.
- Kontrol gamepad/controller belum diimplementasikan.
- Android Chrome fisik, iPhone Safari, Firefox, zoom browser native 200%, dan performa perangkat low-end belum lolos verifikasi fisik.
- Tidak ada jaminan bahwa pemain dapat membuka game tanpa jaringan setelah cache browser dibersihkan. Tidak ada service worker yang dijanjikan oleh dokumen sumber.

### Batas fitur

Tidak ada free-roam town, multiplayer, cloud sync, akun wajib, voice acting, paid economy, gacha, live-ops, atau random gear affix pada baseline yang dijelaskan di sini. Emberhollow adalah hub antarmuka untuk menyiapkan party dan memilih kegiatan, bukan level eksplorasi berjalan.

## 4. Dunia, cerita, dan karakter

### Premis dan tema

Tiga Bellkeeper meninggalkan Emberhollow untuk memulihkan sanctuary yang rusak. Mereka menemukan bahwa perlindungan kota bergantung pada memori, perjanjian yang tidak lagi diingat warga, dan masa depan yang dikorbankan. Lonceng pada awalnya tampak sebagai alarm dan pelindung; perjalanan mengubah maknanya menjadi tanda untuk merawat dan berkumpul.

Tema yang tertanam di naskah meliputi:

- **Memori dan identitas:** catatan warga, nama, lagu, arsip, dan batu nisan menyimpan bukti yang dihapus oleh siklus sanctuary.
- **Perlindungan dan persetujuan:** keselamatan yang terus diperbarui tanpa ingatan warga bukan persetujuan yang terus berlangsung.
- **Kepastian dan masa depan:** party menolak mengulang solusi sempurna yang mengorbankan pilihan seseorang.
- **Perawatan sebagai infrastruktur:** klinik, obat, air, jalur evakuasi, arsip, dan kerja bersama menawarkan perlindungan tanpa mesin pengorbanan.
- **Kehilangan yang tidak dibatalkan:** ending tidak mengembalikan semua yang hilang. Kota membangun cara baru untuk hidup bersama.

### Struktur campaign

Campaign berjalan dalam urutan linear empat act. Setiap empat chapter membentuk satu act. Chapter 1 sampai 4 memiliki empat stage; chapter 5 sampai 16 memiliki lima stage. Totalnya 76 encounter, bukan 76 model musuh unik. Stage awal menggabungkan wave, miniboss, dan boss; stage dari act berikutnya menambah beat naratif pada perjalanan menuju boss.

| Act | Chapter | Arah cerita |
|---|---|---|
| I | 1. Ashwood Trail; 2. Sunken Ruins; 3. Blackbriar Keep; 4. The Emerald Gate | Mencari scout yang hilang, mengikuti suara di reruntuhan, menahan siege, lalu membangunkan Vharok sebagai guardian dan bukan membunuhnya. |
| II | 5. The Empty Census; 6. The Glass Ferry; 7. The Choir Ward; 8. The Thirteenth Stroke | Mengungkap anak-anak dan nama yang dihapus, harga memori pada penyeberangan, asal rasa bersalah Lyra, serta kontrak bell yang memperbarui perlindungan. |
| III | 9. Winter Ledger; 10. The Unborn Orchard; 11. Nine Funerals; 12. The Last Rehearsal | Menemukan masa depan Elian di dalam mesin, menolak pengorbanan berulang, memperoleh benih untuk masa depan baru, lalu memutus time repeater. |
| IV | 13. A City Without Bells; 14. The Borrowed Crown; 15. A Name for Tomorrow; 16. The Unwritten Dawn | Membangun perlindungan melalui kerja komunitas, menghadapi sejarah Bellkeeper pertama, memberi Elian ruang memilih nama Eda, dan menghentikan mesin sambil membebaskan Vharok. |

Chapter 1 merekrut Sable, chapter 2 merekrut Orin, chapter 3 merekrut Bran dan Kestrel, chapter 4 merekrut Nyx dan Mira. Pemain memulai dengan Aldric, Lyra, dan Rowan. Recruitment tidak memindahkan hero baru secara diam-diam ke party aktif.

### Chapter-by-chapter story beats

| Chapter | Beat utama |
|---|---|
| 1. Ashwood Trail | Party mencari scout yang hilang dan menemukan Sable serta pecahan segel pertama di bawah hutan yang terinfeksi. |
| 2. Sunken Ruins | Orin ditemukan di reruntuhan; suara di bawah jembatan adalah gema sumpah lama, bukan suara Orin. |
| 3. Blackbriar Keep | Party menahan siege di menara dan mencegah lonceng ketiga runtuh; Bran dan Kestrel bergabung. |
| 4. The Emerald Gate | Party membangunkan Vharok sebagai guardian, bukan membunuhnya; Nyx dan Mira ikut pulang. |
| 5. The Empty Census | Mira menemukan tujuh belas kursi sekolah yang kosong dan arsip anak-anak yang tidak diingat warga. |
| 6. The Glass Ferry | Penyeberangan meminta memori sebagai ongkos; Rowan menyerahkan lagu ibunya dan menemukan jejak bengkel Nyx yang belum dibangun. |
| 7. The Choir Ward | Catatan rumah sakit mengaitkan Lyra dengan percobaan lama; kebenarannya, Lyra adalah memori rasa bersalah yang diberi tubuh untuk merawat korban. |
| 8. The Thirteenth Stroke | Kontrak perlindungan diperbarui setiap kali memori warga dihapus; party memutus pengulang di menara. |
| 9. Winter Ledger | Arsip beku menyimpan surat dari putaran sebelumnya dan mengungkap jantung mesin bernama Elian. |
| 10. The Unborn Orchard | Kemungkinan masa depan tergantung pada pohon; Rowan tidak mengambil kembali lagunya dan party memperoleh benih untuk waktu yang tidak memakan dirinya sendiri. |
| 11. Nine Funerals | Party menghadapi penjaga yang mewakili keputusan untuk berhenti mencoba, di antara sembilan makam bertanggal masa depan. |
| 12. The Last Rehearsal | Elian menawarkan satu pengulangan sempurna; party menolak janji itu dan menghancurkan time repeater. |
| 13. A City Without Bells | Warga membangun evakuasi, pertolongan, dan tanda bahaya sendiri tanpa mengaktifkan lagi mesin pengorbanan. |
| 14. The Borrowed Crown | Bellkeeper pertama ternyata Aldric dari putaran tertua, yang menukar ingatan tentang dirinya kepada mesin. |
| 15. A Name for Tomorrow | Elian memilih kehidupan biasa yang tidak dirancang ayahnya; nama Eda dipilih sendiri. |
| 16. The Unwritten Dawn | Mesin mencoba menyelamatkan dirinya dengan mengambil bentuk ketakutan kota dan memakai Vharok; party menghentikannya dan membebaskan naga. |

### Pilihan cerita dan ending

Cerita memiliki tiga pilihan yang dikunci oleh jumlah chapter yang telah selesai. Pemain hanya dapat menetapkan setiap pilihan satu kali. Pilihan menambah kartu epilog dan tidak mengganti ending utama.

| Pilihan | Gate | Opsi | Akibat yang dicatat |
|---|---:|---|---|
| Lonceng untuk sekolah | Tiga chapter pertama selesai | Kembalikan lonceng ke sekolah; atau simpan di taman peringatan. | Anak-anak memakai lonceng untuk waktu makan, atau mempelajari nama warga yang hilang. |
| Nama di atas tembaga | Enam chapter pertama selesai | Buka arsip dengan persetujuan warga; atau kembalikan catatan kepada keluarga. | Arsip publik yang berbasis izin, atau keluarga menyimpan catatan dan Sable hanya menyimpan daftar tanpa rahasia. |
| Kota tanpa lonceng | Tiga belas chapter pertama selesai | Perkuat klinik; atau perbaiki jalur air dan pengiriman. | Mira dan Lyra membuka klinik bersama, atau Mira mengatur koperasi pengiriman air dan obat. |

Ending utama menyatakan mesin berhenti, Vharok bebas, Eda memilih namanya sendiri, dan kota membangun perlindungan bersama tanpa memperoleh kembali semua yang hilang. Pilihan pemain menambahkan epilog lokal, bukan cabang ending utama. Chapter dan pilihan dapat dibaca kembali melalui Story Journal.

### Roster Bellkeeper

| Hero | Basic job | Kait karakter |
|---|---|---|
| Aldric | Warrior | Pelindung yang belajar bahwa menjaga seseorang tidak berarti memiliki masa depannya. |
| Bran | Warrior | Membawa perisai cadangan dan rasa bersalah karena pernah terlambat; menginginkan kemenangan tanpa korban yang ditinggalkan. |
| Sable | Rogue | Pencuri yang menyimpan kuitansi sebagai bukti dalam kota yang melupakan kontrak. |
| Rowan | Archer | Mengenali burung dari suara dan harus memilih antara lagu ibunya atau memberi orang lain jalan pulang. |
| Lyra | Healer | Takut kebaikannya adalah perintah yang ditanamkan; memilih tindakan yang ia lakukan sekarang. |
| Kestrel | Archer | Membawa lonceng kecil dan mengubah tanda bahaya menjadi ajakan saling menjaga. |
| Nyx | Rogue | Pengukir yang memberi bentuk tahan lama kepada nama dan hal-hal yang memilih untuk ada. |
| Orin | Wizard | Menulis prediksi dalam buku yang selalu mengoreksi dirinya, lalu belajar menutup buku itu. |
| Mira | Healer | Membangun obat, jalur evakuasi, dan cara hidup aman tanpa mengorbankan seseorang. |
| Tamsin | Bard | Menyanyikan lagu tujuh belas anak yang hilang; arsip yang bisa berjalan. Bergabung di Chapter 6. |
| Vesper | Hexer | Mantan pemungut ongkos ingatan di Feri Kaca; kutukannya mengembalikan beban kepada pembuatnya. Chapter 7. |
| Pell | Engineer | Perawat jam kota yang kini hanya membangun alat yang bisa dimatikan siapa saja. Chapter 8. |
| Koa | Monk | Penjaga Frostward yang menghitung napas, bukan hari. Chapter 10. |
| Ilse | Bard | Penyanyi duka untuk orang yang belum meninggal; lagunya adalah janji. Chapter 12. |
| Hale | Engineer | Membangun tanda bahaya untuk kota tanpa lonceng, dengan tombol mati untuk semua orang. Chapter 14. |

Setiap hero yang direkrut memutar adegan singkat "Sekutu baru" (kartu judul, potret, dan kalimat pertama hero) saat pemain kembali ke Camp setelah chapter perekrutan.

## 5. Struktur sesi dan loop pemain

### Jalur utama

1. Pemain membuka title screen dan memilih Commander atau masuk ke Emberhollow.
2. Di Camp, pemain memeriksa roster, progres, party, dan status save.
3. Pemain memilih route Campaign, Raid, atau Roguelike.
4. Sebelum berangkat, pemain meninjau dossier, memilih hero/build, menetapkan skill, gear, job, dan formasi yang diizinkan mode tersebut.
5. Encounter bergerak pada state `ready`, `fighting`, `paused`, `victory`, atau `defeat`.
6. Hasil diselesaikan satu kali melalui receipt/checkpoint rules, lalu pemain melanjutkan stage, mengambil boon, mencoba lagi, suspend, abandon, atau kembali ke Camp sesuai mode.
7. Di Camp, pemain mengklaim quest, membeli atau memasang gear, mengembangkan hero, memilih chapter berikutnya, atau menyiapkan mode lain.

### Title dan hub

Title screen memuat empat aksi: **Enter Emberhollow**, **Commander Profiles**, **Story Journal**, dan **Camp Settings**. Camp menampilkan party aktif serta jalan pintas **Plan expedition** dan **Prepare the party**. Navigasi Town utama adalah **Camp**, **Expeditions**, **Party**, dan **More**. More memuat Quest Ledger, Field Bestiary, Challenge Shop, Story Journal, Commander Profiles, dan settings.

### Expedition map dan dossier

World Map menampilkan empat act dengan route pins, status chapter terkunci/tersedia/selesai, dan seleksi chapter. Memilih route membuka mission dossier dengan informasi speaker, chapter, stage, reward, recruit, boss, intent, counter, dan cerita yang relevan. Pemain harus menekan aksi deploy; memilih node saja tidak memulai pertarungan.

### Progres yang terlihat

- **Party power** merangkum level, gear, refine, talent, dan job menjadi satu angka. World Map, dossier, dan daftar depth Undercroft membandingkannya dengan **recommended power** per chapter (power pemain casual hasil simulasi balance di awal chapter tersebut) dengan status Ready / Close / Under.
- **Chapter stars:** ★ untuk clear, ★ jika semua hero masih berdiri, ★ jika boss kalah dalam 80 detik atau kurang. Setiap 8 bintang membuka **star chest** (Gold + material).
- **Next step** di Camp selalu menunjuk satu tujuan berikutnya (dungeon yang sedang berjalan, chest, point yang belum dipakai, chapter berikutnya, Undercroft saat party under-power, atau Heroic setelah campaign tamat) dengan tombol Go.

### Core loop Story

Chapter → XP, Gold, recruit, bintang → bila power kurang: Undercroft untuk XP dan material → refine gear, talent, job → chapter berikutnya. Setelah chapter selesai, Heroic replay memberi tantangan dan reward material sekali per chapter.

## 6. Mode permainan

| Aspek | Story / Campaign | Raid | Roguelike / The Sunken Bell |
|---|---|---|---|
| Tujuan | Menyelesaikan campaign dan memulihkan Emberhollow tanpa mengulang pengorbanan sanctuary. | Mengalahkan boss yang dipilih dalam kontrak dan konfigurasi party pilihan. | Bertahan melewati floor, mengembangkan build run, memilih boon, dan mencapai act milestone. |
| Party | Roster lima belas hero. Party aktif mulai tiga, lalu cap bertambah sampai sembilan (grid 3×3 penuh) seiring progres chapter berurutan. | Satu sampai enam slot dari hero yang direkrut; setiap slot dapat diberi salah satu basic job. | Tepat tiga recruit dengan basic job pilihan; job duplikat diizinkan. |
| Progres yang dipakai | XP, job, skill, talent, gear, gold, quest, roster, story flags. | Build Raid, boss, variant, tier, modifier, dan konfigurasi Sandbox. | Build Rogue sementara, point job, boon run, floor, dan run wallet. |
| Progres permanen | Chapter clear, recruit, hero build, quest, gold, narrative flags. | Ledger, reward Crystal jika kontrak tervalidasi, dan challenge unlock sesuai receipt. | Bank Crystal pada milestone act, best-floor data, dan challenge unlock. |
| Perjalanan run | Chapter berisi beberapa stage berurutan. | Satu encounter boss per kontrak. | Satu floor/encounter per clear; milestone act berada di floor 3, 6, dan 9. |
| Gagal/keluar | Chapter yang tidak selesai tidak memberi first-clear progression. Hero yang tumbang tidak dibangkitkan di tengah stage. | Kontrak Sandbox/practice tidak memberi bank reward. | Defeat, abandon, atau akhir run menghapus wallet Crystal sementara dan boons run. |

### Story

Chapter dibuka berurutan. First clear memberikan chapter progression dan membuka recruit yang ditetapkan. Pemain dapat memilih party yang lebih kecil dari cap aktif. Hero yang berada di bench dapat menerima XP catch-up terbatas pada mode Story. Replaying chapter dapat menghasilkan XP dan Gold, tetapi tidak memberi recruit atau bonus first clear untuk kedua kalinya.

### Undercroft (dungeon)

Dibuka dari Bell Tower di Emberhollow. Delapan depth; depth 1 terbuka setelah Chapter 1, depth berikutnya setelah guardian depth sebelumnya kalah dan chapter syaratnya selesai (Chapter 3, 5, 7, 9, 11, 13, 15). Setiap run membuat peta acak (seeded) tujuh baris: battle, elite, event, treasure, camp (baris keenam), dan satu guardian. Party Story masuk dengan HP, dua potion, dan blessing yang terbawa antar ruangan. Sepuluh event acak memberi pilihan (risiko HP demi Gold/material, blessing power/vitality, potion, lore). Gold dan material masuk ke **pouch**: aman bila pemain extract di camp atau mengalahkan guardian, hilang bila party wipe atau run ditinggalkan. Setiap pertarungan memberi XP Story. Material (Ember Shard, Bell Bronze, Frost Glass) dipakai untuk **refine** gear sampai +3 (+15% stat per level). Guardian clear membuka fragmen lore depth itu.

### Heroic

Chapter yang sudah selesai dapat diulang dalam mode Heroic: musuh +60% HP, +45% damage, serangan lebih cepat, hanya satu potion, dan boss menambah aftershock setelah phase 2. Clear Heroic pertama per chapter memberi Gold dan material; replay berikutnya tidak memberi reward chapter. Simulasi balance: pemain expert dengan level satu–dua chapter di atas syarat dapat menyelesaikan Heroic chapter 1–12; Heroic chapter 13–16 adalah konten post-game yang memerlukan level tambahan dari Undercroft.

### Raid

Pemain memilih boss archetype atau variant, tier Bronze/Silver/Gold, modifier, jumlah party 1 sampai 6, dan basic job untuk setiap slot. Kontrak yang tercatat dalam katalog immutable dan kombinasi modifier yang dikalibrasi dapat memberi bank Crystal pada victory. Slider Sandbox atau modifier di luar daftar kombinasi reward menjadikan encounter practice; kemenangan practice tidak menghasilkan bank Crystal.

Delapan modifier yang didefinisikan saat ini:

| Modifier | Tekanan | Risk points |
|---|---|---:|
| Fractured Armor | Barrier efektif berkurang 25%. | 1 |
| Long Night | Jatah potion berkurang satu, minimum satu untuk party solo. | 1 |
| Echo Pulse | Aftershock menyusul ritual. | 2 |
| Hunting Choir | Weakest mark menyusul breath. | 2 |
| Restless Brood | Gelombang minion tambahan saat pergantian phase. | 1 |
| Narrow Paths | Satu tile tertutup sementara secara bergilir. | 1 |
| Patient Colossus | HP boss naik 20%, windup naik 10%. | 0 |
| Last Lantern | Objective lantern opsional mengurangi bonus jika gagal. | 2 |

Tidak semua kombinasi modifier mempunyai status reward-eligible. Source saat ini mengizinkan kombinasi terkalibrasi: tanpa modifier, RM01, RM02, RM03, RM05, RM06, serta RM01+RM02. Kombinasi lain dapat dipakai sebagai Sandbox tetapi tidak memberi payout kontrak.

### Roguelike

Run dimulai dengan tiga recruit dan satu pilihan basic job per recruit. Room clear memberi point untuk promosi job run; satu job tier-2 menghabiskan satu point dan tier-3 menghabiskan total dua. Point dibelanjakan di layar draft boon antar-floor, dan job baru berlaku untuk sisa run. Setiap kemenangan menawarkan sampai tiga boon yang belum dimiliki. Memilih boon memulihkan party sebelum descent berikutnya. Jika semua 12 boon telah dikumpulkan, tombol continuation tetap mengizinkan run berlanjut tanpa draft baru.

Roguelike memiliki tiga act milestone pada floor 3, 6, dan 9. Bank reward milestone adalah 6, 8, dan 22 Crystal. Floor setelah act ketiga adalah practice yang dapat diulang tanpa receipt milestone baru. Run wallet mendapatkan tiga Crystal per room dan terpisah dari bank Commander. Shop run (sebelum room dimulai): Mending Shard memberi setiap hero barrier 30% HP maksimum untuk room itu, Fate Reroll mengacak ulang boon yang ditawarkan setelah room itu, dan Ember Upgrade memberi power party +15% untuk room itu. Wallet sementara hilang saat run selesai, ditinggalkan, atau kalah.

Dua belas boon:

| Boon | Efek singkat |
|---|---|
| Cinder Fingers | Setiap tiga tap efektif memicu 18 fire damage ke musuh utama. |
| Second Thunder | Setiap cast ofensif kelima mengulang 55% power ke boss. |
| Mercy Overflows | 35% overheal berubah menjadi shield. |
| Briar Oath | 35% damage yang diserap shield atau Guard dipantulkan ke boss. |
| Resonant Shelter | Party Guard memberi 18 Resolve langsung dan cooldown Guard berkurang 3 detik. |
| Dancer in Ash | Penalti relokasi turun dari 0,9 ke 0,2 detik; hero yang dipindah mendapat 30 shield. |
| Dawn Runs Deep | Semua sumber Resolve mengisi 60% lebih cepat. |
| Last Light | Damage ke boss di bawah 30% HP meningkat 40%. |
| Winter Between Beats | Setiap cast menunda intent berikutnya 0,16 detik; telegraph aktif tetap berjalan. |
| For the Living | Setiap minion yang tumbang memulihkan 24 HP pada seluruh party. |
| Not Yet, Little Flame | Sekali per hero per floor, damage fatal menyisakan 20% HP. |
| Many Hands, One Song | Tap hero yang berbeda dari tap sebelumnya memberi hero itu Battle Hymn selama 2 detik: +30% power dan +20% tempo. |

### Batas antar-mode

Story Gold, hero XP, recruitment, gear, dan story flags tetap berada di Story state. Raid dan Roguelike memakai build mode masing-masing. Bank Commander Crystal dan challenge unlocks dirancang untuk digunakan lintas Challenge mode; run Crystal hanya berlaku di dalam run. Tidak ada pertukaran Story Gold menjadi run currency. Satu-satunya hasil Challenge yang masuk ke party Story adalah XP hero dari kemenangan Raid: XP itu menaikkan slot Story `auto` (nilai terbesar yang dipakai), sedangkan gear, job, talent, gold, dan slot manual Story tidak disentuh. Ledger (jumlah kill per musuh, victory, raid), total kemenangan, settlement receipt, dan floor Roguelike terdalam adalah statistik akun yang dibaca semua mode, sehingga hunt quest, Bestiary, dan descent quest di Story ikut menghitung progres dari Raid dan Roguelike. HUD selalu menampilkan Story Gold dan bank Crystal; Gold hanya bisa dibelanjakan di Story dan Crystal hanya di Challenge.

## 7. Aturan combat

### Arena dan waktu

Arena memiliki sembilan tile dalam tiga row dan tiga lane. Hero menempati tile, sementara minion menyerang dari lane. Combat adalah real-time simulation yang bergerak pada fixed step 1/60 detik. Phaser scene mengumpulkan frame delta lalu menjalankan langkah simulasi. `Battle` adalah pemilik status dan rules; renderer memvisualisasikan `BattleEvent`.

### Skill dan tindakan pemain

Hero memakai dua active skill yang dipasang pada loadout. Ketika cooldown stance aktif mencapai nol, hero otomatis menjalankan skill tersebut. Pemain tidak menekan tombol cast untuk setiap skill. Pemain dapat:

- **Tap hero** untuk mengurangi cooldown stance yang sedang aktif. Tap biasa mengurangi 0,64 detik; tap sync mengurangi 0,88 detik sebelum bonus talent/gear.
- **Kelola fatigue.** Tap menambah fatigue 5,5. Di atas 40 fatigue, efisiensi tap menjadi 50%; di atas 70 menjadi 14%. Jarak minimum antar-tap untuk hero yang sama adalah 0,11 detik. Fatigue mulai pulih setelah 0,5 detik tanpa tap, pada 32 poin per detik; talent Composure mempercepat pemulihan 50%.
- **Ganti stance** untuk memilih skill yang akan cast saat cooldown selesai. Pergantian mempertahankan persentase cooldown yang sudah berjalan.
- **Pindah atau swap hero** ke tile lain. Formation change sebelum combat gratis. Saat combat berlangsung, relokasi menambah 0,9 detik cooldown dan move-lock 0,65 detik pada hero yang dipindah serta hero yang terswap. Talent Footwork mengurangi penalti hero pemiliknya menjadi 0,45 detik. Boon Dancer in Ash membuat penalti 0,2 detik dan memberi 30 shield pada setiap hero yang dipindah.
- **Party Guard** untuk mengurangi 65% incoming damage selama 2,8 detik. Cooldown normal 18 detik.
- **Potion** untuk memulihkan semua hero hidup sebesar 130 × vitality; encounter normal dimulai dengan dua potion. Long Night mengurangi jumlahnya menjadi satu.
- **Ninefold Dawn** ketika Resolve mencapai 100. Ultimate menghabiskan Resolve, memulihkan tiap hero hidup sebesar 90 × power, memberi 65 shield, memberikan `220 + 48 × jumlah hero` damage ke boss, dan menghabisi minion aktif.

Resolve dimulai pada 25 dan bertambah dari damage, tap (0,3 per tap), cast/talent tertentu, Guard, dan boon tertentu. Nilainya dibatasi 100.

### Telegraph dan counterplay

Pola setiap musuh authored sebagai daftar intent yang berulang. Intent dan area yang ditandai terlihat sebelum impact. Lokasi pada telegraph dapat mengikuti target hero atau tetap berada di grid, bergantung jenisnya.

| Intent | Pemilihan target | Tanggapan utama |
|---|---|---|
| Weakest | Hero hidup dengan HP absolut terendah. Target mengikuti hero tersebut sampai impact. | Heal, shield, atau Guard; pindah tile saja tidak menghindari mark. |
| Strongest | Hero hidup dengan threat power tertinggi, berdasar power skill relatif terhadap cooldown. | Lindungi target; mengganti stance dapat mengubah prioritas sebelum mark. |
| Front | Row paling depan yang dihuni saat telegraph dimulai, semua tiga slot row itu ditandai. | Pindah dari row sebelum impact. Mark row tidak mengikuti hero. |
| Breath | Lane dengan hero hidup terbanyak; lane pertama dipilih jika seri. Semua tiga row lane itu ditandai. | Pindah lane sebelum impact. |
| All | Kesembilan tile ditandai selama 4,2 detik. | Guard dekat impact atau cast interrupt. Bergerak tidak membantu. |
| Meteor | Sampai tiga tile berisi hero hidup dipilih oleh RNG combat. Tile tetap di tanah sampai impact. | Pindah ke tile aman. |

Telegraph selain all-grid berlangsung 3,2 detik. Skill interrupt dapat membatalkan telegraph all-grid yang aktif. Mark pada hero mengikuti target; hazard berbasis row, lane, atau meteor tetap di lokasi yang ditandai. Pada phase lanjutan, Vharok dapat menambahkan aftershock meteor tertunda.

### Boss, minion, dan hasil encounter

Boss memiliki tiga phase yang ditentukan oleh HP: di atas 65%, 30% sampai 65%, dan 30% atau kurang. Jadwal telegraph memendek 0,6 detik per phase setelah phase pertama. Damage pada boss menambah stagger; break membuka jendela enam detik dengan damage boss 1,6 kali. Setelah encounter melewati 150 detik, multiplier damage masuk menjadi 1,7 kali.

Minion masuk sebagai tekanan tambahan di lane. Minion cenderung menyerang hero terdepan pada lane mereka, atau hero terlemah jika lane kosong. Claw hit dan summon berjalan sebagai timer terpisah dari intent utama.

Victory terjadi saat HP boss habis dan setidaknya satu hero masih hidup. Defeat terjadi saat seluruh hero tumbang. Tidak ada revive umum di tengah encounter. Campaign memerlukan kemenangan sebelum stage berikutnya disiapkan; Raid dan Roguelike memakai satu encounter per kontrak/floor. Hasil dan payout menggunakan settlement receipt untuk mencegah penyelesaian yang sama dibayar dua kali.

### Musuh

Runtime memuat 12 archetype dengan 3 varian warna/tekanan per archetype, total 48 records musuh. Ashbound, Frostbound, dan Gilded masing-masing mengalikan HP menjadi 1,12/1,22/1,32 dan damage menjadi 1,05/1,10/1,15; tiap varian juga memendekkan interval dan memutar urutan intent.

| Archetype | Nama dalam game | Pola utama |
|---|---|---|
| Wolf | Ashfang | Weakest, front, strongest. |
| Goblin | Scrap Marshal | Strongest, strongest, meteor, weakest. |
| Spider | Silk Widow | Weakest, meteor, all. |
| Shaman | Hollow Cantor | All, weakest, breath. |
| Golem | Ironroot | Front, strongest, all. |
| Wraith | The Unburied | Weakest, all, strongest. |
| Treant | Mournbark | Front, all, meteor. |
| Dragon | Vharok | Breath, front, meteor, all. |
| Moth | Lantern Eater | Strongest, meteor, breath. |
| Basilisk | Glassjaw | Weakest, breath, strongest, meteor. |
| Crab | Bellshore Claw | Front, meteor, all. |
| Revenant | The Last Watch | Strongest, front, all, weakest. |

AI tidak memakai machine learning. `Battle` menjalankan intent generik yang dipilih dari pattern data. Deskripsi dan counter text memberi konteks naratif, tetapi klaim perilaku spesifik hanya berlaku jika simulation rule memang mengimplementasikannya.

## 8. Roster dan perkembangan karakter

### Basic job dan spesialisasi

Sembilan basic job menentukan kit awal dan peran combat.

| Basic job | Peran ringkas | Dua cabang advanced | Jalur third job |
|---|---|---|---|
| Warrior | Garis depan dan perlindungan. | Paladin; Berserker. | Aegis Sovereign; Crimson Warlord. |
| Rogue | Serangan cepat, mark, dan utility. | Duelist; Nightblade. | Blade Saint; Veil Reaper. |
| Archer | Target lane dan pressure minion. | Marksman; Wild Ranger. | Astral Deadeye; Wild Warden. |
| Healer | Heal, regen, dan buff tempo. | Dawn Priest; War Cantor. | Ember Seraph; Bell Oracle. |
| Wizard | Burst magic, area damage, dan interrupt. | Elementalist; Chronist. | Prismatic Archon; Last Hourkeeper. |
| Bard | Haste, resolve, dan buff seluruh party; makin kuat pada party besar. | Lihat `data/database.json`. | Lihat `data/database.json`. |
| Hexer | Weaken, curse, drain, dan sacrifice; melemahkan boss dari belakang. | Lihat `data/database.json`. | Lihat `data/database.json`. |
| Monk | Combo, flurry, counter, dan selfheal di garis depan. | Lihat `data/database.json`. | Lihat `data/database.json`. |
| Engineer | Turret, repair, delay, dan stun; mengunci telegraph. | Lihat `data/database.json`. | Lihat `data/database.json`. |

Setiap basic job memiliki delapan definisi skill, total 72. Empat skill dasar dan skill job membuka pilihan yang lebih spesifik. Promosi membuka skill job, tetapi tidak memasangnya otomatis; pemain harus memasukkannya sendiri ke salah satu dari dua slot. Promosi branch tier-2 terbuka pada campaign rank 4; tier-3 memerlukan rank 10 dan parent yang benar. Harga promosi yang didefinisikan adalah 180 Gold untuk tier-2 dan 420 Gold untuk tier-3.

### Hero XP, party Story, dan talent

- XP dan level disimpan per hero. Level maksimum 40.
- Setiap level di atas level 1 menambah power 5% dan HP 6% (`LEVEL_POWER`/`LEVEL_HP`); level adalah sumber utama pertumbuhan hero, ditambah gear (dan refine), talent, serta job.
- Hero yang direkrut mengejar median level roster pada saat recruitment.
- Story party dimulai dengan tiga hero aktif. Cap menjadi empat setelah dua chapter berurutan selesai, lima setelah tiga, enam setelah empat, tujuh setelah enam, delapan setelah sembilan, dan sembilan setelah dua belas.
- Dalam Story, hero bench menerima setidaknya 50% dari victory XP dan catch-up tambahan yang dibatasi oleh selisih terhadap median XP party aktif. Formula ini tidak berlaku untuk Raid atau Roguelike.
- Katalog talent memiliki 50 definisi; 34 berlaku untuk setiap hero: 15 foundational, 15 node shared Assault/Guard/Tempo, dan empat node khusus class. Talent dapat memerlukan level hero, Gold, skill point, node parent, atau dua prerequisite. Hanya satu keystone dari tiga pilihan dapat dipakai pada satu hero.
- Respec mengembalikan Gold dan skill point yang dibelanjakan pada talent/job serta mengatur skill dasar kembali. XP dan gear milik hero tetap ada.

### Skill dan gear

Loadout setiap hero menyimpan dua skill aktif, talent, job, XP, inventori, dan slot formasi. Gear memiliki tiga slot: weapon, armor, dan charm. Katalog memiliki 42 item termasuk universal item, enam three-piece sets, class weapon, dan item quest. Item memiliki gate class/level/source; set memberi efek pada dua dan tiga item yang sesuai. Gear dibeli sekali per hero lalu dapat dipasang ulang tanpa pembelian ulang.

Skill, talent, equipment, job, XP curve, koefisien damage, dan deskripsi lengkap berada di definisi runtime berikut. Jangan menyalin tabel angka ke dokumen ini lalu menganggap salinan tetap segar ketika source berubah:

- [Skills](../src/game/content.ts), [job specializations](../src/game/jobs.ts), and [equipment](../src/game/jobs.ts).
- [Talents](../src/game/talents.ts) and [XP curve](../src/game/levels.ts).
- [Generated content tables](../Gridbound_GDD_GRID_RAID.md).

## 9. Konten campaign dan musuh

Campaign memakai empat chapter pembuka yang di-author di `src/game/world.ts`, lalu 12 chapter lanjutan di `src/game/story.ts`. Chapter lanjutan masing-masing berisi lima stage: tiga wave, miniboss, dan boss. Stage menyimpan enemy, nama stage, HP authoring, serta beat teks. Pertarungan pertama dalam campaign memakai tiga hero dan empat stage.

Contoh progres cerita dari chapter pembuka:

1. **Ashwood Trail:** mencari scout yang hilang. Sable ditemukan di hutan; boss stage adalah treant.
2. **Sunken Ruins:** mencari Orin dan suara di bawah batu. Wraith menjadi boss.
3. **Blackbriar Keep:** menahan siege di menara; Bran dan Kestrel ikut pulang.
4. **The Emerald Gate:** menghadapi Vharok sebagai guardian yang sedang dipengaruhi hunger; Nyx dan Mira ikut pulang.

Detail intro, outro, stage beat, reward, enemy ID, dan recruit ada pada `src/game/world.ts`, `src/game/story.ts`, serta output database. Chapter intro dan outro tersedia di Story Journal untuk dibaca kembali.

## 10. Quest, ekonomi, dan reward

### Quest

Katalog berisi 30 quest:

- 12 hunt untuk melawan archetype musuh.
- 6 town request yang tersusun sebagai chain.
- 9 companion milestone yang mengikat level ke hero tertentu.
- 3 descent milestone untuk progres Roguelike.

Objective dihitung dari progres tercatat. Pemain harus menekan claim; reward tidak otomatis dibelanjakan. Klaim yang sama tidak dapat diulang. Quest dapat memberi Gold, XP ke hero penerima, atau item tertentu. XP companion diberikan kepada hero yang ditetapkan quest.

### Currency

| Currency | Pemakaian | Batas |
|---|---|---|
| Gold | Talent, job promotion, gear, quest reward, dan reward encounter Story. Profile baru mulai dengan 60 Gold. | Tidak dijual dengan uang nyata dalam runtime. |
| Commander Crystal | Bank Challenge lintas Raid/Roguelike dan pembelian unlock di Challenge Shop. | Tidak sama dengan run Crystal. |
| Run Crystal | Mata uang sementara untuk pilihan item dalam run Roguelike. | Bertambah tiga per room; hilang saat run berakhir, abandon, atau defeat. |
| Material map | Field pada economy profile tersedia. | Loop material gathering/crafting tidak dinyatakan sebagai fitur baseline yang lengkap oleh source/GDD ini. |

Raid Crystal hanya dibayar oleh victory pada kontrak authored dan tervalidasi. Kontrak practice atau Sandbox memberi nol bank reward. Base payout Bronze/Silver/Gold adalah 12/18/26 Crystal. Risk points kontrak mencakup tier (0/3/6) dan modifier; bonus risk dibatasi maksimum 60%, lalu setiap modifier memberi bonus 3 Crystal. Final payout dibulatkan ke integer terdekat.

Challenge Shop menyediakan tiga item run: Mending Shard seharga 8 Run Crystal, Fate Reroll seharga 12, dan Ember Upgrade seharga 18. Bank unlock Ward Relic seharga 24 Commander Crystal dan Fate Relic seharga 36. Definisi unlock ada di economy catalog. Efek gameplay lanjutan setiap unlock tidak boleh disimpulkan hanya dari nama item.

### Settlement dan kegagalan

Settlement memeriksa status victory, stage/floor, contract, dan receipt. Story first-clear recruitment dan chapter reward tidak diberikan ulang saat replay. Raid reward hanya berasal dari contract allowlist. Rogue memiliki bank reward pada milestone act, sementara run wallet dan boon tidak menjadi progres permanen. Encounter checkpoint disimpan pada batas encounter, bukan sebagai rekaman frame-by-frame.

## 11. Antarmuka, kontrol, dan aksesibilitas

### Layar

| Layar | Fungsi |
|---|---|
| Title | Masuk Emberhollow, kelola Commander Profiles, buka Story Journal, dan atur Camp Settings. |
| Camp | Ringkasan party dan progres, lalu pintasan ke expedition atau persiapan party. |
| Expeditions | Campaign route map, pemilihan chapter, dossier, serta pintasan Raid dan Roguelike. |
| Party | Pilih hero, susun formation, pilih dua active skills, beli/pasang gear. |
| Progression | Overview, jobs, talent branches, skill points, dan respec. |
| More | Quest ledger, Field Bestiary, Challenge Shop, Story Journal, Commander Profiles, settings. |
| Battle | Arena, Hero inspector, Log, party health, lane targets, Guard, potion, ultimate, pause. |
| Result / boon draft | Menampilkan victory/defeat, continuation atau return; Roguelike memilih boon sebelum descent berikutnya. |

### Kontrol

| Input | Aksi |
|---|---|
| Tap/click area hero | Mempercepat cooldown hero yang disentuh. Tap pada skill chip mengganti stance, bukan mempercepat cooldown. |
| Drag hero ke tile | Memindahkan atau menukar posisi; tersedia juga mode pindah dengan tombol tile. |
| Klik lane target | Memilih lane untuk skill terarah. |
| `1` sampai `9` | Memilih hero berdasarkan posisi grid. |
| `Q` / `E` | Mengganti skill stance hero terpilih. |
| `G` | Party Guard. |
| `H` | Potion. |
| `R` | Ultimate jika Resolve mencukupi. |
| `B` | Buka boon codex saat sesuai. |
| `Enter` | Memulai encounter ready jika fokus tidak berada pada tombol/link. |
| `Space` | Pause/resume jika fokus tidak berada pada tombol/link. |
| `Escape` | Menutup dialog atau membatalkan move mode. |

Pause menyediakan Resume, Controls, Sound & Motion, dan Retreat. Membuka Hero atau Log saat combat mem-pause battle; kembali ke Arena melanjutkannya. Jika pemain meninggalkan tab ketika bertarung, game membuka mekanisme pause/retreat. Keluar dari run menawarkan Save & Suspend, Abandon run, atau Cancel.

### Aksesibilitas dan responsive behavior

Source menyediakan native buttons/select/dialog/details, label ARIA pada sebagian navigasi dan control, focus-visible style, keyboard binding, pengaturan sound/motion, dan dukungan `prefers-reduced-motion`. Banyak target utama mempunyai tinggi minimum 44 CSS px pada viewport yang diuji.

Ini bukan klaim WCAG atau screen-reader certification. Catatan UI masih membatasi bukti pada emulasi browser dan beberapa ukuran viewport. Desktop map-pin focus, screen reader, contrast audit menyeluruh, forced-colors, physical keyboard, dan 200% native zoom belum dinyatakan lulus.

## 12. Arah visual dan audio

- Presentasi menggunakan pixel art dan Canvas-generated hero, monster, serta town imagery yang dibundel lokal.
- Phaser menggambar arena, sprite, intent tiles, countdown, projectile, damage/heal feedback, phase cue, dan victory/defeat presentation.
- DOM menampung navigasi, panel party, lane control, HUD, dialog, dan status save.
- Font yang dibundel lokal mencakup Press Start 2P dan Space Grotesk.
- Combat/interface SFX dibuat secara prosedural melalui Web Audio dan dapat dimatikan. Background music tidak aktif.
- Tidak ada voice acting atau aset runtime wajib dari CDN.

Repository belum menyediakan art bible lengkap, inventory seluruh aset eksternal/attribution, atau target loudness/latency audio perangkat. Jangan menyamakan generated local sprites dengan sign-off art final.

## 13. Teknologi, save, dan batas operasi

### Arsitektur

`index.html` memuat `src/main.ts` sebagai composition root. Main mengatur state layar, event DOM, profile, audio, persistence, dan instance Phaser. `src/ui/` menghasilkan tampilan Town/map; `src/game/simulation.ts` memegang rules combat; `src/render/BattleScene.ts` menjalankan fixed-step loop dan efek; `src/audio/sound.ts` merender event menjadi SFX. Progression dan economy berada di domain `src/game/` serta `src/economy/`.

Node.js 22.12+ diperlukan untuk build/dev, bukan untuk memainkan bundle statis. `npm run build` membuat `dist/`; `server.js` opsional untuk host Node. Aplikasi tidak membutuhkan API server atau route backend.

### Commander dan save

Runtime memisahkan dua lapisan penyimpanan:

1. Legacy Profile `gridbound.v3` di localStorage, dengan pembacaan/migrasi format sebelumnya dan proteksi read-only untuk save rusak/tidak dikenal.
2. Commander Documents di IndexedDB. Satu browser dapat menyimpan maksimum tiga Commander. Setiap Commander menyimpan mode Story, Raid, Roguelike, shared Challenge state, empat slot per mode (`manual-1`, `manual-2`, `manual-3`, `auto`), dan encounter/run checkpoint.

A legacy Profile dapat disalin ke Commander melalui aksi migration yang eksplisit; migrasi itu tidak dilakukan otomatis saat launch.

Slot Story menyimpan seluruh state Story, termasuk journey (bintang chapter, star chest yang sudah dibuka, Heroic clear, kedalaman Undercroft, run dungeon aktif) dan pilihan Story Journal; semua field itu bertahan saat dokumen dibaca ulang dan dinormalisasi. Slot manual (`manual-1..3`) adalah snapshot beku: hanya aksi save ke slot itu yang menulisnya. Raid dan Roguelike selalu dibangun dari slot Story `auto` dan hanya menulis kembali XP hero ke slot itu. Shared state menyimpan bank Crystal, challenge unlock, serta ledger, total kemenangan, receipt, dan floor Roguelike terdalam akun; setiap mode menggabungkan nilainya ke sana (maksimum per kunci, receipt digabung tanpa duplikat), sehingga statistik itu tidak pernah turun, juga setelah memuat slot manual lama. Camp selalu berjalan dalam mode Story, jadi Commander Profiles di camp menampilkan slot Story; run Raid atau Roguelike yang tertunda dilanjutkan dari gerbang mode itu (Continue latest atau Depart di tab Raid/Endless).

Run checkpoint menyimpan awal encounter beserta status yang dibutuhkan untuk melanjutkan. Checkpoint bukan save setiap frame dan manual save Challenge tidak boleh digunakan untuk memutar ulang payout lama. `CommanderSession` mengantrekan save, menandai revision stale saat tab lain menulis, dan melindungi slot dari overwrite/rewind yang tidak sah. Jika IndexedDB tidak tersedia, repository menyediakan memory-only session; progress tersebut hilang ketika tab ditutup. UI menyediakan export backup/recovery, tetapi import backup umum belum dibuktikan sebagai flow yang tersedia.

Save bersifat lokal per browser/origin. Tidak ada cloud sync dan tidak ada jaminan transfer otomatis ketika domain/host berubah.

### Seed dan reproducibility

Simulation memakai generator pseudorandom internal dengan seed tetap pada reset encounter untuk keputusan hazard tertentu. Ini mendukung uji aturan combat, tetapi bukan jaminan replay deterministik menyeluruh: sebagian partikel dan noise audio memakai randomness presentasi, dan pilihan seed encounter tidak diekspos sebagai setting pemain.

## 14. Verifikasi dan risiko yang diketahui

[GUI-VERIFIED.md](GUI-VERIFIED.md) mencatat hasil lokal terbaru: 128 test lulus; build dan balance lulus; full browser smoke melewati campaign, mode, progression, persistence, battle HUD, result, serta viewport matrix. Browser matrix mencakup 360×640, 360×740, 390×844, 430×932, 721×500, 768×1024, 1280×720, 1440×900, dan proxy CSS 180×370. Production smoke lokal melewati nested path `/subdir/Gridbound/` dan memastikan QA API development tidak masuk bundle.

Bukti tersebut adalah catatan repository dari smoke lokal, bukan hasil pengujian yang dijalankan ulang saat dokumen ini ditulis. Batas yang masih berlaku:

- Tidak ada verifikasi live deployment.
- Tidak ada pengujian fisik Android Chrome, iPhone Safari, Safari/Firefox desktop, atau keyboard OS.
- Native browser zoom 200%, low-end performance, long-session memory/thermal behavior, screen reader, dan human difficulty/usability test belum dibuktikan.
- `npm run build` melaporkan engine chunk Phaser sekitar 1.208 kB minified, melampaui warning threshold 500 kB.
- Automation membuktikan transisi sistem yang diuji, bukan bahwa pacing, balance, atau cerita sudah disetujui pemain.

Gunakan [NEXT-PRODUCTION.md](NEXT-PRODUCTION.md) untuk gate rilis historis dan [GUI-VERIFIED.md](GUI-VERIFIED.md) untuk checkpoint GUI terkini. Tidak satu pun menjadi bukti bahwa website remote telah diperbarui.

## 15. Hal yang belum ditetapkan

Hal berikut tidak boleh diisi dengan angka atau janji hasil tebakan:

- Target umur, wilayah, persona pemasaran, rating usia, harga, dan sales goal.
- Rata-rata durasi satu chapter, satu Raid, atau satu run Roguelike.
- Target FPS/perangkat minimum dan performance budget final.
- Sertifikasi aksesibilitas, browser matrix rilis, serta dukungan screen reader/gamepad.
- Target final untuk balance, difficulty curve, dan tingkat drop/reward setelah human playtest.
- Model final untuk material map pada economy state.
- Efek penuh dari bank relic unlock setelah pembelian.
- Apakah tagline title screen dan label versi UI mewakili positioning/release version final. `package.json` mencantumkan 0.4.0; title footer saat ini menampilkan `GRIDBOUND v3.1`.

### R1 dan pekerjaan mendatang

R1 memiliki dokumen target terpisah, termasuk full target GDD, mode spec, ekonomi, character/combat, serta production gates. Paket itu bukan spesifikasi untuk mengubah runtime tanpa instruksi implementasi tersendiri. Beberapa fasilitas yang namanya juga muncul di R1, seperti title screen, Commander Profiles, Raid, Roguelike, dan map Campaign, memang ada di source sekarang dan didokumentasikan di bagian atas. Fitur R1 lain hanya menjadi rencana sampai jalur runtime yang sesuai dibuat dan diverifikasi.

## 16. Glosarium

| Istilah | Arti dalam Gridbound |
|---|---|
| Bellkeeper | Anggota party yang berangkat dari Emberhollow. |
| Intent / telegraph | Pola serangan yang diumumkan sebelum impact. |
| Lane | Salah satu dari tiga kolom vertikal pada grid. |
| Row / front | Salah satu dari tiga baris horizontal; front adalah row hero terdepan yang sedang dihuni. |
| Stance | Skill dari dua slot loadout yang sedang dipilih untuk auto-cast. |
| Tap fatigue | Penalti efisiensi cooldown reduction akibat tap berulang. |
| Resolve | Meter yang mengisi ultimate Ninefold Dawn. |
| Campaign rank | Progres chapter yang membuka batas party dan job promotion; berbeda dari hero XP level. |
| Boon | Modifier combat sementara pada run Roguelike. |
| Run wallet | Crystal sementara untuk pembelian selama run. |
| Bank Crystal | Crystal Commander yang digunakan untuk Challenge Shop dan reward Challenge. |
| Commander | Dokumen save lokal yang menampung state Story, Raid, Roguelike, slot, dan shared Challenge state. |
| Sandbox | Raid practice dengan konfigurasi yang tidak memenuhi katalog kontrak reward tervalidasi. |

## 17. Rujukan

### Sumber Gridbound

- [README.md](../README.md), quickstart, kontrol, build, dan batas produk.
- [Current runtime content export](../Gridbound_GDD_GRID_RAID.md), tabel katalog dari database hasil generate.
- [Combat simulation](../src/game/simulation.ts), combat rules and terminal state.
- [Skills](../src/game/content.ts), [jobs/equipment](../src/game/jobs.ts), [talents](../src/game/talents.ts), and [XP](../src/game/levels.ts).
- [Campaign world](../src/game/world.ts), [later chapters](../src/game/story.ts), [narrative choices](../src/game/narrative.ts), and [roster](../src/game/characters.ts).
- [Profile progression](../src/game/profile.ts), [Commander documents](../src/game/commander.ts), [save sequencing](../src/game/commander-session.ts), and [legacy save migration](../src/game/save.ts).
- [Currency](../src/economy/currency.ts) and [Raid/Roguelike economy](../src/economy/challenge.ts).
- [Composition root](../src/main.ts), [Town](../src/ui/town.ts), and [World Map](../src/ui/world-map.ts).
- [Phaser battle presentation](../src/render/BattleScene.ts) and [audio](../src/audio/sound.ts).
- [GUI-VERIFIED.md](GUI-VERIFIED.md), local viewport and browser evidence.

### Riset format GDD

1. Danielle Riendeau, [“How to write a Game Design Document”](https://www.gamedeveloper.com/design/how-to-write-a-game-design-document), Game Developer, 15 August 2023. Rujukan untuk GDD yang spesifik terhadap proyek, mudah dicari/dipindai, terhubung antarbagian, dan berfokus pada komunikasi desain, bukan mengisi template universal.
2. Robin Hunicke, Marc LeBlanc, dan Robert Zubek, [“MDA: A Formal Approach to Game Design and Game Research”](https://storage.ghost.io/c/25/84/2584b75d-4bd6-4cce-8259-f1d1c65abbb5/content/files/~hunicke/mda.pdf). Rujukan untuk menghubungkan mechanics, dynamics, dan aesthetics secara iteratif.
3. [OpenGDD](https://opengdd.org/), versi 0.8 working draft saat dibaca. Rujukan tambahan untuk memisahkan prosa desain, data bernama, dan acceptance evidence. GDD ini tidak mengklaim patuh pada format OpenGDD.

Dokumen ini mengikuti prinsip bahwa tidak ada satu format GDD yang cocok untuk semua game. Struktur dipilih untuk Gridbound: cerita berperan penting, combat memiliki aturan spesifik, progression terpisah antar-mode, dan runtime sudah berjalan sehingga deskripsi implementasi harus dibedakan dari arah yang belum dibangun.