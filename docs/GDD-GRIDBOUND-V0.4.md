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
| Party yang dibangun | Roster dan loadout memberi pilihan komposisi, bukan sekadar angka level. | Sembilan basic job, 36 job lanjutan (18 tier 2, 18 tier 3), dua slot skill, talent, gear, formasi, serta party Story yang tumbuh dari tiga sampai delapan hero aktif. |
| Kemajuan lintas skala | Chapter memberi perkembangan permanen; Rogue memberi eksperimen build sementara; Raid memberi encounter yang dipilih pemain. | Gold, XP, job, gear, quest, boon, kontrak Raid, bank Crystal, dan wallet run yang terpisah. |
| Cerita tentang pilihan | Keselamatan tidak membenarkan penghapusan identitas atau persetujuan. | Cerita authored tentang memori dan kontrak, tiga pilihan kecil yang memengaruhi kartu epilog, serta satu ending utama. |

### Pengalaman dalam kerangka MDA

[INFERENCE] Sebagai pembacaan desain, sasaran pengalaman GDD ini mencakup **challenge**, **narrative**, **discovery**, dan **expression**. Mechanics seperti telegraph, tap-fatigue, formasi, dan build hero menciptakan dinamika rotasi, mitigasi risiko, dan spesialisasi. Dinamika tersebut menjadi dasar pengalaman taktis dan tematik yang dituju. Kerangka MDA adalah alat analisis, bukan bukti bahwa pemain telah menganggap game menyenangkan.

## 3. Pemain, platform, dan batas produk

### Profil pemain

Demografi, usia, wilayah pemasaran, rating umur, durasi sesi rata-rata, dan target penjualan belum ditetapkan dalam repository. [INFERENCE] Dari mekaniknya, game ini mengasumsikan pemain bersedia membaca intent, mengelola cooldown, mencoba susunan party, dan mengikuti cerita chapter. Itu asumsi kebutuhan sistem, bukan hasil riset pemain.

### Perangkat dan input

- Game berjalan di browser dengan mouse/pointer, touch, dan keyboard.
- Layout mendukung viewport desktop serta mobile dan mengubah navigasi Town pada ukuran layar kecil. Ponsel adalah platform utama: di luar battle, teks pixel tidak di bawah 10px dan teks biasa tidak di bawah 12px (label kecil seperti DEPAN/TENGAH/BELAKANG, Slot 1 · pembuka, harga, dan kicker quest memakai Space Grotesk 12px; deskripsi 13px), setiap target sentuh minimal 44 × 44px, tombol utama setiap layar terlihat saat layar dibuka, dan Party, Job, setup Raid/Ujian Lonceng, serta papan Quest digulir sebagai satu halaman (juga saat ponsel dimiringkan) dengan bilah keberangkatan menempel di bawah; berganti tab Party/Job mulai dari atas. Nama talent memutus baris hanya di antara kata.
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

Campaign berjalan dalam urutan linear empat act. Setiap empat chapter membentuk satu act. Chapter 1 sampai 4 memiliki empat stage; chapter 5 sampai 16 memiliki lima stage. Totalnya 76 encounter, bukan 76 model musuh unik. Stage menggabungkan wave, miniboss, dan boss, dan setiap stage (termasuk 16 stage Act I) membawa beat naratif yang tampil di kartu sebelum wave. Beat yang menyebut musuh selalu menyebut musuh wave itu (dijaga `tests/story-beats.test.ts`).

| Act | Chapter | Arah cerita |
|---|---|---|
| I | 1. Ashwood Trail; 2. Sunken Ruins; 3. Blackbriar Keep; 4. The Emerald Gate | Mencari scout yang hilang, mengikuti suara di reruntuhan, menahan siege, lalu membangunkan Vharok sebagai guardian dan bukan membunuhnya. |
| II | 5. The Empty Census; 6. The Glass Ferry; 7. The Choir Ward; 8. The Thirteenth Stroke | Mengungkap anak-anak dan nama yang dihapus, harga memori pada penyeberangan, asal rasa bersalah Lyra, serta kontrak bell yang memperbarui perlindungan. |
| III | 9. Winter Ledger; 10. The Unborn Orchard; 11. Nine Funerals; 12. The Last Rehearsal | Menemukan masa depan Elian di dalam mesin, menolak pengorbanan berulang, memperoleh benih untuk masa depan baru, lalu memutus time repeater. |
| IV | 13. A City Without Bells; 14. The Borrowed Crown; 15. A Name for Tomorrow; 16. The Unwritten Dawn | Membangun perlindungan melalui kerja komunitas, menghadapi sejarah Bellkeeper pertama, memberi Elian ruang memilih nama Eda, dan menghentikan mesin sambil membebaskan Vharok. |

Chapter 1 merekrut Sable, chapter 2 merekrut Orin, chapter 3 merekrut Bran dan Kestrel, chapter 4 merekrut Nyx dan Mira; lalu Tamsin (chapter 5), Vesper (6), Pell (7), Koa (9), Ilse (11), dan Hale (13). Keenam hero baru muncul langsung di chapter perekrutannya (intro, beat, atau outro) sebelum adegan bergabungnya. Pemain memulai dengan Aldric, Lyra, dan Rowan. Recruitment tidak pernah mengganti hero yang sedang aktif: setelah first clear, recruit baru mengisi slot party yang masih kosong (cap dihitung setelah chapter tercatat), lalu sisa slot kosong diisi hero bench sesuai urutan roster. Hero yang perlu tile baru ditempatkan menurut perannya: warrior dan monk di tile depan terendah yang kosong (0–2), class lain di baris belakang (6–8) lalu tengah (3–5).

### Chapter-by-chapter story beats

| Chapter | Beat utama |
|---|---|
| 1. Ashwood Trail | Party mencari scout yang hilang dan menemukan Sable serta pecahan segel pertama di bawah hutan yang terinfeksi. |
| 2. Sunken Ruins | Orin ditemukan di reruntuhan; suara di bawah jembatan adalah gema sumpah lama, bukan suara Orin. |
| 3. Blackbriar Keep | Party menahan siege di menara dan mencegah lonceng ketiga runtuh; Bran dan Kestrel bergabung. |
| 4. The Emerald Gate | Party membangunkan Vharok sebagai guardian, bukan membunuhnya; Nyx dan Mira ikut pulang. |
| 5. The Empty Census | Mira menemukan tujuh belas kursi sekolah yang kosong dan arsip anak-anak yang tidak diingat warga; penyanyi jalanan Tamsin, yang tak pernah membayar lonceng, menyanyikan bait berisi nama Elian. |
| 6. The Glass Ferry | Vesper, penjaga feri, meminta memori sebagai ongkos; Rowan menyerahkan lagu ibunya dan menemukan jejak bengkel Nyx yang belum dibangun. Vesper merobek buku ongkosnya dan ikut. |
| 7. The Choir Ward | Catatan rumah sakit mengaitkan Lyra dengan percobaan lama; kebenarannya, Lyra adalah memori rasa bersalah yang diberi tubuh untuk merawat korban. Pell, pembuat jam muda, memasang tombol mati pada mesin bangsal. |
| 8. The Thirteenth Stroke | Kontrak perlindungan diperbarui setiap kali memori warga dihapus; party menghancurkan Simpul Ketiga Belas yang menunggangi Vharok (Vharok bangkit, terluka tapi bebas) dan memutus pengulang di menara. |
| 9. Winter Ledger | Arsip beku menyimpan surat untuk party dari putaran sebelumnya, semuanya tulisan tangan Koa, dan mengungkap jantung mesin bernama Elian. |
| 10. The Unborn Orchard | Kemungkinan masa depan tergantung pada pohon; Rowan tidak mengambil kembali lagunya dan party memperoleh benih untuk waktu yang tidak memakan dirinya sendiri. |
| 11. Nine Funerals | Party menghadapi penjaga yang mewakili keputusan untuk berhenti mencoba, di antara sembilan makam bertanggal masa depan yang berjajar tiga kali tiga; Ilse menyanyikan lagu duka untuk yang belum meninggal. |
| 12. The Last Rehearsal | Elian menawarkan satu pengulangan sempurna; party menolak janji itu, mengalahkan Sang Pengulang yang membelenggu Vharok, dan menghancurkan time repeater. |
| 13. A City Without Bells | Warga membangun evakuasi, pertolongan, dan tanda bahaya sendiri (alarm Hale dari Koperasi Hearth) tanpa mengaktifkan lagi mesin pengorbanan. Enam belas papan nama lain milik anak-anak yang masa depannya ditukar: mereka tidak kembali, tetapi keluarganya kini tahu alasannya. |
| 14. The Borrowed Crown | Bellkeeper pertama ternyata Aldric dari putaran tertua, yang menukar ingatan tentang dirinya kepada mesin. |
| 15. A Name for Tomorrow | Elian memilih kehidupan biasa yang tidak dirancang ayahnya; nama Eda dipilih sendiri, Nyx mengukirnya, dan Aldric menambahkan garis tinggi badan Eda bertanggal hari ini. |
| 16. The Unwritten Dawn | Mesin Terakhir mencoba menyelamatkan dirinya dengan mengambil bentuk ketakutan kota dan memakai Vharok sebagai sayap; party menghentikannya dan membebaskan naga. |

### Pilihan cerita dan ending

Cerita memiliki tiga pilihan yang dikunci oleh jumlah chapter yang telah selesai. Pemain hanya dapat menetapkan setiap pilihan satu kali. Saat kembali ke Camp setelah chapter yang membukanya, pilihan tampil sebagai adegan dialog berisi opsinya dan **Putuskan nanti**; setelah memilih, akibatnya tampil sebagai halaman berikutnya. Fokus awal ada pada **Putuskan nanti**, dan klik/tombol dalam 0,6 detik setelah opsi muncul diabaikan, sehingga menekan Enter berulang kali melewati adegan tidak pernah menjawab pilihan. Adegan Camp tidak diputar di atas layar judul; adegan menunggu sampai pemain masuk ke Emberhollow. **Putuskan nanti** (juga Skip/Escape) membiarkan pilihan terbuka: panduan Camp menulis "Ada pilihan menunggu di Jurnal." dengan tombol Go ke Jurnal, dan Jurnal menawarkan opsi yang sama serta **Putuskan nanti** (tidak ada lagi opsi default diam-diam). Pilihan menambah kartu epilog, dan dua di antaranya mengganti satu kalimat outro chapter 16 (`storyOutro`); ending utama tidak berubah.

| Pilihan | Gate | Opsi | Akibat yang dicatat |
|---|---:|---|---|
| Nama di atas tembaga | Enam chapter pertama selesai | Buka arsip dengan persetujuan warga; atau kembalikan catatan kepada keluarga. | Arsip publik yang berbasis izin, atau keluarga menyimpan catatan dan Sable hanya menyimpan daftar tanpa rahasia (outro chapter 16: "Sable menjaga daftar yang tidak pernah ia buka."). |
| Lonceng untuk sekolah | Tiga belas chapter pertama selesai | Kestrel menemukan lonceng kecil di reruntuhan Blackbriar: gantung di sekolah yang kosong; atau simpan di taman peringatan. | Lonceng di sekolah yang kosong, tempat tak seorang pun ingat mengapa kursinya kecil; atau di taman peringatan untuk nama-nama yang belum kembali. |
| Kota tanpa lonceng | Tiga belas chapter pertama selesai | Mira dan Hale bertanya: perkuat klinik; atau perbaiki jalur air dan pengiriman. | Mira dan Lyra membuka klinik bersama (outro chapter 16: Lyra membuka klinik bersama Mira dan warga), atau Hale dan Mira mengatur koperasi pengiriman air dan obat. |

Ending utama menyatakan mesin berhenti, Vharok bebas, Eda memilih namanya sendiri, dan kota membangun perlindungan bersama tanpa memperoleh kembali semua yang hilang (kalimat pembuka epilog adalah string UI `journal.epilogue.lead`, diterjemahkan EN/ID). Pilihan pemain menambahkan epilog lokal, bukan cabang ending utama. Setelah chapter 16, kembali ke Camp memutar adegan penutup: outro chapter 16 (sesuai pilihan), satu kalimat "sesudahnya" per hero yang direkrut dengan potretnya (`CHARACTERS[id].fateLine`), kalimat epilog dan akibat setiap pilihan, lalu kartu judul **Emberhollow**. Catatan "Campaign selesai… tantangan postgame" bukan lagi bagian prosa cerita: catatan itu tampil di bawah layar hasil chapter 16. Chapter, pilihan, adegan bergabung, dan adegan penutup dapat dibaca atau diputar ulang melalui Story Journal.

Narasi intro chapter memakai papan nama **KRONIK** (tanpa potret) dengan nama tempatnya; nama dan potret speaker chapter hanya tampil pada halaman yang berupa ucapan langsung (diawali tanda kutip). Pada chapter 8, 12, dan 16, Vharok berada di pihak party, jadi stage boss memakai nama yang menunggangi atau memakainya (`StageDef.enemyName`/`enemyTitle`): **Simpul Ketiga Belas** (MENUNGGANGI VHAROK), **Sang Pengulang** (MEMBELENGGU VHAROK), dan **Mesin Terakhir** (BERSAYAPKAN VHAROK) di HP bar, banner, dan dossier World Map; art dan pola serangannya tetap milik naga.

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
| Tamsin | Bard | Menyanyikan lagu tujuh belas anak yang hilang; arsip yang bisa berjalan. Bergabung di Chapter 5. |
| Vesper | Hexer | Mantan pemungut ongkos ingatan di Feri Kaca; kutukannya mengembalikan beban kepada pembuatnya. Chapter 6. |
| Pell | Engineer | Perawat jam kota yang kini hanya membangun alat yang bisa dimatikan siapa saja. Chapter 7. |
| Koa | Monk | Penjaga Frostward yang menghitung napas, bukan hari. Chapter 9. |
| Ilse | Bard | Penyanyi duka untuk orang yang belum meninggal; lagunya adalah janji. Chapter 11. |
| Hale | Engineer | Membangun tanda bahaya untuk kota tanpa lonceng, dengan tombol mati untuk semua orang. Chapter 13. |

Setiap hero yang direkrut memutar adegan singkat "Sekutu baru" (kartu judul, potret, dan kalimat pertama hero) saat pemain kembali ke Camp setelah chapter perekrutan. Adegan yang masih terutang disimpan di journey (`pendingRecruitScenes`, serta `pendingChapterScenes` untuk adegan pilihan dan penutup) saat first clear dan baru dihapus setelah diputar, sehingga Retry di layar hasil, reload, atau ganti bahasa tidak menghilangkannya. Jurnal memuat bagian **Rekan** untuk memutar ulang adegan bergabung setiap hero.

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

Title screen memuat empat aksi: **Enter Emberhollow**, **Commander Profiles**, **Story Journal**, dan **Camp Settings**. Camp adalah desa pixel: setiap bangunan adalah tombol, dan papan namanya memuat nama bangunan serta, di bawahnya, satu nama tujuan yang sama persis dengan judul HUD, MENU, dan tab gerbang: Gerbang · Cerita, Menara Lonceng · Undercroft, Arsip · Bestiary, Aula Latihan · Party, Serikat · Quest, Pedagang · Bursa Crystal, Sumur Tua · Ujian Lonceng, Penginapan · Save, Pondok Pemburu · Raid. Teks papan nama tidak pernah di bawah 11px dan badge-nya 10px. Di ponsel kecil (peta lebih sempit dari 300px) papan nama hanya menampilkan baris pertama (nama bangunan, gembok, badge yang menjadi titik 10px) agar sembilan papan tidak saling menutupi; jumlah, BARU, dan tujuan tetap terbaca lewat label aksesibilitas tombol dan judul HUD. Di ponsel pendek (tinggi ≤ 700px, mis. bilah browser tampil) teks panduan dipotong menjadi satu baris (heading, Pergi, dan Lanjut tetap utuh) agar peta mendapat tinggi kembali; saat ponsel dimiringkan, camp menjadi dua kolom: peta di kiri (camp digulir ke bawah sepanjang peta) dan panduan menempel di bawah di sebelahnya. Mode roguelike (kode `endless`) bernama **Ujian Lonceng** (EN *Bell Trials*) di semua tempat. Badge kecil pada papan nama menunjukkan hal yang bisa dilakukan: jumlah quest siap klaim (Serikat), jumlah hero party yang bisa mempelajari talent, mengambil job, atau membeli/memasang gear yang lebih baik sekarang (Aula Latihan; roster Party memberi titik merah pada hero tersebut), depth Undercroft baru atau run yang menunggu (Menara Lonceng), dan BARU pada mode yang baru terbuka sampai dikunjungi; tombol MENU di HUD menghitung quest siap klaim dan star chest. Jendela **Langkah berikutnya** di bawah peta selalu terlihat utuh (peta mengecil untuk memberi ruang) dan menyertakan tombol utama **Lanjut: CH n · nama**, yang membuka dossier chapter berikutnya dengan satu ketukan. Navigasi mengikuti satu kontrak: setiap layar punya jalan keluar berlabel kata, dan HUD **◀ Kembali**, Escape, serta tombol Kembali browser/ponsel melakukan satu langkah yang sama. Tombol **◀ Kembali** berbingkai di kiri atas HUD (judul rute adalah heading terpisah di sebelahnya; label aksesibilitasnya menyebut tujuan, mis. "Kembali ke Menu") kembali ke rute sebelumnya: MENU adalah hub (membukanya selalu memberi camp → MENU, sehingga Kembali tidak memutar ulang rute sebelum MENU; MENU → Quest → Kembali ke MENU → Kembali ke camp), anak MENU yang dibuka dari papan camp kembali ke camp, tab gerbang menggantikan semua rute gerbang di atasnya (peta → dossier → Raid menyisakan Raid), dossier kembali ke peta, dan tautan silang (Siapkan party dari dossier, perbaikan setelah kalah) kembali ke layar asalnya. Camp adalah dasar tumpukan: di sana tidak ada tombol Kembali, judul HUD bukan tombol, dan Escape atau Kembali browser membuka layar judul (setelah save di-flush); dari layar judul tombol Kembali browser meninggalkan halaman. Tombol MENU tertekan saat MENU terbuka dan menutupnya lagi. Tombol Kembali browser/ponsel tidak pernah keluar dari game (termasuk di iframe itch.io): halaman menyimpan satu entri riwayat penjaga (`{ gridbound: 'guard' }`, tanpa URL) setelah interaksi pertama, menjalankan satu langkah Kembali saat entri itu dilepas, lalu memasangnya lagi. Penjaga juga dipasang saat sebuah lapisan muncul tanpa ketukan baru (layar judul memudar setelah Enter Emberhollow, adegan camp, Jurnal yang terbuka lagi setelah replay), sehingga Kembali pertama di camp membuka layar judul, bukan halaman sebelumnya. Di ponsel sempit (≤ 420px) dua dompet HUD bertumpuk dan judul rute memakai font teks (sampai dua baris), agar judul tetap terbaca di samping tombol Kembali. MENU memuat Party, Job, Quest, Bestiary, Bursa Crystal, Jurnal, Save, Pengaturan, dan Judul; sampai lebar 600px (ponsel dan embed itch.io 540 × 900) daftar perintah tampil lebih dulu, party menjadi satu baris potret, dan ringkasan (Hero n/15) di bawahnya. Di kota, satu ketukan tidak pernah membelanjakan, menghapus, atau salah sasaran: pemberitahuan (mis. "Party cerita disimpan.") adalah toast yang melayang di atas layar, tembus ketukan, dan hilang sendiri (atau begitu pemain mengetuk, menggulir, atau menekan tombol lagi), sehingga render ulang tidak menggeser tombol di bawah jari; posisi gulir dan daftar party Story (terbuka/tertutup) tetap seperti ditinggalkan pemain.

### Mode yang terbuka bertahap

Mode dibuka oleh cerita (tabel di sisi UI, `src/ui/unlocks.ts`, bukan aturan game): Undercroft setelah Chapter 1, Raid setelah Chapter 2, Ujian Lonceng setelah Chapter 4, Heroic per chapter yang sudah tuntas. Save yang sudah pernah memakai mode itu (raid tercatat di ledger, floor Ujian Lonceng, depth atau run Undercroft) atau Commander yang masih menyimpan run di mode itu (run Ujian Lonceng yang ditangguhkan, raid yang belum selesai) tetap membukanya. Bangunan dan tab gerbang yang terkunci menampilkan gembok dan "Tuntaskan Chapter n"; mengetuknya hanya memunculkan pemberitahuan. Saat sebuah mode terbuka, camp menampilkan kartu perkenalan satu kali (Ke sana / Nanti) dan tanda BARU sampai mode itu dikunjungi; status kartu dan kunjungan disimpan per browser di `localStorage` (`gridbound.ui.unlocks`). Bestiary dan quarry Raid hanya menyebut musuh yang sudah ditemui.

### Panduan pertempuran pertama

Selama Chapter 1 belum tuntas, pertempuran memberi empat tip, masing-masing satu kali: ketuk hero untuk mengisi skill, seret hero keluar dari petak merah saat telegraph ground pertama mengenai hero (pertempuran diperlambat menjadi 30% kecepatan normal sampai hero berpindah: setiap frame memberi dt × 0,3 ke loop tick tetap 1/60 detik, jadi determinisme tidak berubah), tekan Guard saat ritual all-grid pertama masuk jendela GUARD NOW, dan tekan Ninefold Dawn saat Resolve penuh. Gelembung tip menunjuk kontrolnya, tidak menghalangi ketukan atau seretan, dan punya tombol **Lewati tips**. Selama tip ini masih akan muncul, jendela siap pertarungan pertama tidak menampilkan baris cara bermainnya sendiri (tip-tip itulah yang mengajarkannya), sehingga lembar siap tetap pendek dan baris depan tetap terlihat di ponsel. Pengaturan → **Tips pertempuran** mematikannya (menyalakannya lagi memutar ulang semua tip); status tip disimpan di `localStorage` (`gridbound.coach`).

### Expedition map dan dossier

World Map menampilkan empat act dengan route pins, status chapter terkunci/tersedia/selesai, dan seleksi chapter. Memilih route membuka mission dossier dengan informasi speaker, chapter, stage, reward, recruit, boss, intent, counter, dan cerita yang relevan. Baris reward menunjukkan bayaran yang sebenarnya: reward penuh untuk first clear, **Hadiah ulang** (30% Gold dan persentase EXP replay) untuk chapter yang sudah selesai, atau bayaran Heroic (Gold + material clear Heroic pertama, atau "hanya gold pertempuran" bila sudah pernah; EXP Heroic ×1,3 ikut dikalikan `replayFactor`, sehingga persentase EXP juga ditulis bila di bawah 100%). Baris recruit disembunyikan pada replay, dan saat Heroic dipilih target bintang diganti catatan bahwa bintang hanya berasal dari clear Normal. Toggle Heroic berlaku per chapter: memilih chapter lain mengembalikannya ke Normal. Pemain harus menekan aksi deploy; memilih node saja tidak memulai pertarungan.

### Progres yang terlihat

- **Party power** merangkum level, gear, refine, talent, job, dan skill yang sedang dipakai setiap hero menjadi satu angka. Offense dihitung dari skill stance (nilai per detik, termasuk efek job dan perk) dibandingkan skill pertama class-nya pada party tiga hero (`REF_PARTY`); skill pendukung (heal, shield, partyshield, buff, haste, delay) dinilai menurut ukuran party, sehingga satu party shield bernilai lebih besar untuk party delapan hero, dan power seorang hero tidak pernah turun ketika party bertambah. Defense adalah HP efektif (HP maksimum, reduksi damage, Fortitude, barrier awal). Skill job serangan bernilai lebih tinggi dari skill dasar class-nya; skill job kontrol atau pendukung dinilai dari apa yang diberikannya kepada party, sehingga sebagian (misalnya Ember Mine milik Sapper, Silence Between Bells milik Bell Oracle) bernilai lebih rendah dari skill pertama class. World Map, dossier, dan daftar depth Undercroft membandingkannya dengan **recommended power** per chapter (power pemain casual hasil simulasi balance di awal chapter tersebut, `npm run power-curve`; tidak pernah turun dari chapter ke chapter) dengan status Ready / Close / Under. Saat Heroic dipilih, dossier memakai rekomendasi Heroic tersendiri (`recommendedHeroicPower` = recommended power × `HEROIC_POWER_FACTOR` 1,25, median power yang dibutuhkan pemain casual untuk memenangkan separuh percobaan Heroic) beserta status-nya.
- **Chapter stars** (digambar sebagai ikon bintang pixel, karena font pixel tidak memiliki glyph bintang)**:** ★ untuk clear, ★ jika semua hero masih berdiri, ★ jika boss kalah dalam 80 detik atau kurang. Setiap 8 bintang membuka **star chest** (Gold + material); setelah peti keenam (48/48 bintang) bar bintang menulis "Semua peti bintang sudah dibuka".
- **Next step** di Camp selalu menunjuk satu tujuan berikutnya (dungeon yang sedang berjalan, chapter Story yang dijeda (Lanjutkan CH n · pertarungan k), slot party kosong yang bisa diisi hero bench, chest, quest siap klaim, pilihan cerita yang ditunda (Go membuka Jurnal), point yang belum dipakai, chapter berikutnya, promosi job yang terjangkau saat party under-power (lalu Undercroft atau gear), atau Heroic setelah campaign tamat) dengan tombol Go. Untuk slot kosong, Go membuka tab Formation dengan panel party Story sudah terbuka.

### Core loop Story

Chapter → XP, Gold, recruit, bintang → bila power kurang: Undercroft untuk XP dan material → refine gear, talent, job → chapter berikutnya. Setelah chapter selesai, Heroic replay memberi tantangan dan reward material sekali per chapter.

## 6. Mode permainan

| Aspek | Story / Campaign | Raid | Roguelike / Ujian Lonceng (Bell Trials) |
|---|---|---|---|
| Tujuan | Menyelesaikan campaign dan memulihkan Emberhollow tanpa mengulang pengorbanan sanctuary. | Mengalahkan boss yang dipilih dalam kontrak dan konfigurasi party pilihan. | Bertahan melewati floor, mengembangkan build run, memilih boon, dan mencapai act milestone. |
| Party | Roster lima belas hero. Party aktif mulai tiga, lalu cap bertambah sampai delapan seiring progres chapter berurutan; satu dari sembilan tile selalu kosong agar telegraph tanah tetap bisa dihindari. | Satu sampai enam slot; setiap slot memilih hero yang direkrut (unik) dan salah satu dari sembilan basic job. Hero membawa level, gear, refine, dan talent Story. | Tepat tiga recruit dengan basic job pilihan; job duplikat diizinkan. |
| Progres yang dipakai | XP, job, skill, talent, gear, gold, quest, roster, story flags. | Loadout Story (XP, gear, refine, talent, job/skill bila class sama), build Raid, boss, variant, tier, modifier, dan konfigurasi Sandbox. | Build Rogue sementara, point job, boon run, floor, dan run wallet. |
| Progres permanen | Chapter clear, recruit, hero build, quest, gold, narrative flags. | Ledger, reward Crystal jika kontrak tervalidasi, dan challenge unlock sesuai receipt. | Bank Crystal pada milestone act, best-floor data, dan challenge unlock. |
| Perjalanan run | Chapter berisi beberapa stage berurutan. | Satu encounter boss per kontrak. | Satu floor/encounter per clear; milestone act berada di floor 3, 6, dan 9. |
| Gagal/keluar | Chapter yang tidak selesai tidak memberi first-clear progression. Hero yang tumbang tidak dibangkitkan di tengah stage. | Kontrak Sandbox/practice tidak memberi bank reward. | Defeat, abandon, atau akhir run menghapus wallet Crystal sementara dan boons run. |

### Story

Chapter dibuka berurutan. First clear memberikan chapter progression, membuka recruit yang ditetapkan, dan mengisi slot party yang kosong (layar hasil menulis "Party bertambah menjadi n!" saat cap naik). Recruit yang tidak kebagian slot (misalnya Sable setelah chapter 1, saat cap masih 3) masuk cadangan dan layar hasil menyebutnya "menunggu sebagai cadangan". Pemain tetap dapat memilih party yang lebih kecil dari cap aktif; first clear berikutnya mengisinya kembali (replay tidak mengubah party). Hero cadangan menerima minimal 50% XP kemenangan party (`BENCH_XP`), dan hingga penuh selama masih tertinggal dari median party (catch-up, `benchExperience`). Berangkat ke chapter baru dengan slot party kosong padahal ada hero cadangan selalu bertanya dulu: **Isi party** (terfokus; membuka Formasi dengan daftar party terbuka), **Tetap berangkat**, atau Batal. Replay chapter Normal membayar Gold pertempuran ditambah 30% reward chapter (`REPLAY_GOLD`; reward penuh hanya untuk first clear) dan XP dikalikan `replayFactor` = max(0,25; 1 − 0,15 × max(0, chapter selesai − chapter − 1)): penuh sampai chapter terakhir yang selesai, lalu berkurang 15% per chapter di belakangnya. Replay tidak memberi recruit atau bonus first clear untuk kedua kalinya. Layar hasil menampilkan Gold yang benar-benar dikreditkan (Raid menampilkan bank Crystal yang diterima; draft boon Roguelike setelah act tuntas menampilkan bank Crystal milestone yang masuk). Setelah kalah di pertempuran kedua atau lebih dari sebuah chapter, **Ulangi pertempuran ini** memulai lagi pertempuran itu dari checkpoint awalnya (HP dan potion seperti saat pertempuran dimulai, tanpa isi ulang), dan **Ulang chapter (pertempuran 1)** memulai chapter dari awal; keduanya mempertahankan Heroic.

### Undercroft (dungeon)

Dibuka dari Bell Tower di Emberhollow. Delapan depth; depth 1 terbuka setelah Chapter 1, depth berikutnya setelah guardian depth sebelumnya kalah dan chapter syaratnya selesai (Chapter 3, 5, 7, 9, 11, 13, 15). Setiap run membuat peta acak (seeded) tujuh baris: battle, elite, event, treasure, camp (baris keenam), dan satu guardian. Layout peta diberi versi (`MAP_VERSION` = 2): baris 2–4 lebih sering berisi event, setiap depth punya dua–tiga elite dari biome-nya dan biome tetangga, dan ruangan battle/elite tidak mengulang musuh ruangan yang terhubung langsung di bawahnya (kecuali semua pilihan sudah terpakai). Run dari save lama tetap memakai layout 1 sehingga ruangannya tidak berubah setelah update. Rute Undercroft menampilkan intro (dua baris di ponsel), lalu daftar depth, lalu panel **Cara kerja** (aturan peta, luka, dan pouch beserta keterangan jenis ruangan, terbuka sampai guardian pertama kalah), sehingga depth pertama yang terbuka sudah terlihat saat rute dibuka; keterangan ruangan juga tampil di bawah peta run. Mengetuk sebuah depth belum memulai run: ketukan itu membuka **dossier depth** (dialog) berisi nomor dan nama depth, guardian serta musuh ruangan dan elite-nya (siluet dan "???" untuk keluarga yang belum ditemui Bestiary, seperti di setup Raid; kartu depth juga menulis "Guardian: ???"), material yang dijatuhkan, potret party Story yang akan turun (nama tiap hero tertulis di bawah potretnya, juga di chip HP run) beserta kekuatannya di samping "Saran n" dan vonisnya, aturan luka dan pouch (di ponsel terlipat di bawah **Cara kerjanya**), serta peringatan bahwa party Story terkunci di run itu sampai pemain keluar membawa kantong, mengalahkan guardian, atau meninggalkan run. Dossier diakhiri satu baris yang menempel di bawah: **◀ Kembali** lalu **Turun ▶**, keduanya terlihat utuh saat dossier terbuka di ponsel terkecil. **Turun ▶** memulai run dan membawa ruangan yang terbuka (baris bawah peta) ke layar — begitu juga setelah kembali dari hasil ruangan dan lewat tombol **Pilih ruangan berikutnya ▲** di bawah hasil event, treasure, atau camp (ketukan pada Turun yang datang sesaat setelah dossier terbuka — misalnya ketukan ganda pada kartu depth di ponsel, tempat Turun bisa muncul tepat di bawah jari — diabaikan, jadi tidak pernah memulai run sendiri); **◀ Kembali** (fokus awal), ×, Escape, dan tombol Kembali browser menutup dossier tanpa membuat run dan tanpa mengunci party.

Party Story yang berangkat menjadi party run dan **terkunci** selama run aktif: panel party Story menandai hero-nya "Di Undercroft" dan menolak perubahan dengan pesan, dan setiap pertarungan memakai party run itu (bukan party Story saat ini) dengan HP, potion (mulai dua), dan blessing yang terbawa antar ruangan. Hero yang tidak ikut bertarung tidak pernah dicatat tumbang. Sepuluh event acak memberi pilihan (risiko HP demi Gold/material, blessing power/vitality, potion, lore); setiap pilihan berdampak: "pergi" memulihkan 5% HP, buaian memberi +5% HP run dengan biaya −5% HP sekarang, dan pilihan yang membutuhkan Gold dari pouch (potion pedagang 60G, koin sumur 20G) atau potion yang sudah penuh tampil nonaktif dengan alasannya dan tidak menghabiskan event. Pilihan lore menampilkan satu surat pendek dari anggota party di putaran sebelumnya, dipilih seeded dari kumpulan tiga surat per depth. Bila event berujung sergapan, hasil pilihannya tetap tampil di atas musuh. Gold dan material masuk ke **pouch**: aman bila pemain extract di camp atau mengalahkan guardian, hilang bila party wipe atau run ditinggalkan. Api camp hanya melayani satu pilihan dan mengatakannya: **Istirahat: pulihkan 25% dan bangunkan yang tumbang** menutup jalan keluar sampai guardian kalah, sedangkan **Keluar sekarang membawa kantong (run berakhir)** mengakhiri run; setelah istirahat, hasilnya menyebut pemulihan (+25% HP tiap hero, sampai penuh) dan hero yang bangkit lagi (di 25% HP). Depth yang sudah tuntas menyebut tangga berikutnya dengan kalimat yang sama di layar hasil guardian dan di peta sesudahnya (`clearedText`): terbuka, menunggu setelah Chapter n, atau tidak ada (depth terdalam). Setiap pertarungan memberi XP Story; layar hasil ruangan menampilkan HP tiap hero (sebelum → sesudah) dan, saat wipe, apa saja yang hilang dari pouch.

Run yang aktif menampilkan **◀ Kembali ke Emberhollow (run tersimpan)** di atas peta (tetap terlihat saat peta digulir; run menunggu di Menara Lonceng), tab gerbang tetap tampil, dan **Tinggalkan run** (merah, dengan konfirmasi) ada di bawah. Pertarungan yang sudah dimulai (SERANG! ditekan) hanya dapat ditinggalkan dengan **kabur** (Ⅱ Menu → Kabur dari ruangan…, atau tombol yang sama di tampilan Log; Escape dan Kembali browser membuka menu): luka dan potion yang terpakai tetap terbawa, separuh pouch (dibulatkan ke bawah untuk yang tersisa) hilang, ruangan belum bersih dan musuhnya tetap menunggu, lalu pemain kembali ke peta Undercroft. Sebelum SERANG! ditekan, keluar tidak memakan biaya: jendela siap dan menu jeda menawarkan **◀ Kembali ke peta**. Status "pertarungan berlangsung" disimpan, begitu pula keadaan terakhirnya (HP tiap hero dan potion tersisa) setiap kali hero tumbang, potion dipakai, dan setiap 10 detik pertarungan. Reload atau menutup tab di tengah pertarungan dihitung kabur saat Undercroft dibuka lagi (bukan saat game dimuat, agar tab kedua tidak membatalkan pertarungan tab pertama): tiap hero berakhir di nilai yang lebih buruk antara keadaan tersimpan terakhir (hero yang sudah tumbang tetap tumbang) dan HP sebelum pertarungan dikurangi 25% (luka ini sendiri tidak menumbangkan hero yang masih berdiri), dan potion yang sudah terpakai tetap terpakai — reload tidak pernah lebih murah daripada kabur pada saat itu. Pengecualiannya adalah game yang ditutup OS di latar belakang (ponsel membuang tab yang lama tidak dibuka): saat halaman disembunyikan (pindah aplikasi, layar dikunci, `pagehide`, `freeze`) pertarungan dijeda dan keadaannya langsung dicatat bersama cap waktu latar belakang (`pendingFight.hiddenAt`, data UI yang tidak pernah dibaca `Battle`); jika muatan berikutnya datang setidaknya 60 detik setelah cap itu (diukur dari awal muatan halaman, `DISCARD_GRACE_MS`) atau Chrome melaporkan `document.wasDiscarded`, ruangan menunggu dengan HP dan ramuan yang tercatat, tanpa luka tambahan dan dengan pouch utuh, dan ruangan menulis "Game tertutup di latar belakang: pertarungan menunggu, luka tetap seperti tadi." Kembali ke halaman menghapus cap itu, jadi reload oleh pemain tetap dihitung kabur. Material (Ember Shard, Bell Bronze, Frost Glass) dipakai untuk **refine** gear sampai +3 (+15% stat per level). Guardian clear membuka fragmen lore depth itu.

Angka Undercroft: HP musuh ruangan memakai kurva HP chapter pembuka depth itu × `DUNGEON_HP` (1,45); damage musuh adalah milik depth itu sendiri (`DEPTH_DMG`, dalam satuan `CHAPTER_DMG`, tidak pernah turun saat depth bertambah) × faktor jenis ruangan (`FIGHT_DMG`: battle 1,1, elite 1,3, guardian 1,2). Guardian membawa 1,1× HP stage boss chapter-nya (`GUARDIAN_HP`, sekitar 1,3× dari sebelumnya) dan memukul lebih keras dari ruangan battle biasa. Istirahat di camp memulihkan 25% HP dan membangunkan hero tumbang di 25% (`CAMP_REST`/`CAMP_REVIVE`). `DEPTH_DMG` dihitung dengan `DUNGEON=1 npm run calibrate` agar pemain casual (tepat setelah chapter pembuka depth, rute hati-hati dan rute serakah) wipe di sekitar satu dari lima run, kebanyakan di guardian; depth 7 dan 8 berbagi satu nilai (depth 8 sendiri membutuhkan nilai lebih kecil dari depth 7), yang membuat depth 8 wipe di sekitar seperempat run dan depth 7 sekitar sepersepuluh. Karena hero disembuhkan penuh di dalam pertarungan, party biasanya masih masuk guardian dengan HP tinggi dan risiko datang dari kematian di ruangan elite serta guardian, sehingga pilihan extract di camp menimbang kantong melawan guardian yang lebih keras.

### Heroic

Chapter yang sudah selesai dapat diulang dalam mode Heroic: musuh +60% HP, +45% damage di Act I–III (Act IV memakai 55% dari bonus itu, +33% HP dan +25% damage; `HEROIC_ACT`, `heroicScale`), serangan lebih cepat, hanya satu potion, dan boss menambah aftershock setelah phase 2. Dossier menulis bonus HP dan damage chapter yang dipilih. Clear Heroic pertama per chapter memberi Gold dan material; replay berikutnya hanya memberi Gold pertempuran. Heroic tidak memberi bintang chapter; XP Heroic (×1,3) juga memakai `replayFactor`. Simulasi balance (`npm run power-curve`, pemain casual yang memasang skill job-nya, mulai tepat setelah first clear): Heroic Act I dimenangkan tanpa level tambahan, Act II–III umumnya satu sampai tujuh level setelah first clear, dan Act IV sekitar level 24–27 (tiga sampai delapan level setelah first clear, kira-kira beberapa run Undercroft). Klaim lama bahwa Heroic 13–16 memerlukan grinding panjang berasal dari harness lama yang tidak pernah memasang skill job.

### Raid

Pemain memilih boss archetype dan variant (chip T1–T4), tier Bronze/Silver/Gold, modifier pakta (maksimal tiga), jumlah party 1 sampai 6, hero untuk setiap slot (hero yang direkrut, tidak boleh dobel), dan basic job slot itu (sembilan class). Party bawaan adalah party Story lebih dulu, lalu roster sesuai urutan rekrut. Mengubah jumlah party mempertahankan hero, class, dan tile yang sudah dipilih; hero tambahan masuk ke tile kosong. Archetype hanya bisa diburu setelah tercatat di ledger (pernah dikalahkan), chapter pertamanya selesai, atau hunt quest-nya terbuka; archetype lain tampil sebagai tile terkunci "???" dengan petunjuk chapter. Kontrak yang tercatat dalam katalog immutable dan kombinasi modifier yang dikalibrasi memberi bank Crystal pada victory; layar setup menampilkan total bayaran (tier dan jumlah pakta). Slider Sandbox atau modifier di luar daftar kombinasi reward menjadikan encounter practice; kemenangan practice tidak menghasilkan bank Crystal.

Hero Raid memakai loadout Story: XP (level), gear, refine, dan talent ikut. Job dan dua skill Story hanya ikut bila class slot sama dengan class asli hero; jika pemain mengganti class untuk raid, job dilepas dan skill kembali ke dua skill dasar. Loadout Story tidak pernah diubah oleh build Raid.

Floor raid adalah jumlah chapter Story yang selesai + 1. Boss memakai HP boss chapter itu × `RAID_HP` (1,1) dan damage chapter itu × `RAID_DMG` (1,1); setelah chapter terakhir keduanya terus naik per floor. HP boss diskalakan ke ukuran party relatif terhadap cap party Story chapter itu (pangkat 0,9), dan party yang lebih kecil dari cap juga menerima damage lebih ringan (pangkat `RAID_PARTY_DMG` = 0,5; party lebih besar tidak menambah damage). Tier kontrak menambah tekanan di atasnya (`RAID_TIER_SCALE`): Bronze ×1 HP / ×1 damage, Silver ×1,15 / ×1,5, Gold ×1,3 / ×1,9 (HP sengaja tidak dinaikkan lebih jauh: pertarungan yang lebih panjang hanya masuk ke enrage). Practice (Sandbox) mengabaikan tier dan memakai slider sendiri.

Delapan modifier didefinisikan; empat disimulasikan saat ini dan sisanya tampil nonaktif dengan label "belum tersedia":

| Modifier | Tekanan | Risk points | Status |
|---|---|---:|---|
| Fractured Armor (RM01) | Barrier yang didapat selama raid (skill shield, ultimate, overheal) berkurang 25%. | 1 | Aktif |
| Long Night (RM02) | Jatah potion menjadi satu. | 1 | Aktif |
| Echo Pulse (RM03) | Setiap serangan seluruh grid yang mendarat disusul aftershock bertelegraph (5 detik) pada tile satu hero; interrupt yang memutus ritual mencegahnya. | 2 | Aktif |
| Hunting Choir (RM04) | Weakest mark menyusul breath. | 2 | Belum tersedia |
| Restless Brood (RM05) | Setiap kali boss masuk phase berikutnya, gelombang minion tambahan muncul di lane yang kosong. | 1 | Aktif |
| Narrow Paths (RM06) | Satu tile tertutup sementara secara bergilir. | 1 | Belum tersedia |
| Patient Colossus (RM07) | HP boss naik 20%, windup naik 10%. | 0 | Belum tersedia |
| Last Lantern (RM08) | Objective lantern opsional mengurangi bonus jika gagal. | 2 | Belum tersedia |

Kombinasi reward-eligible: tanpa modifier, RM01, RM02, RM03, RM05, serta RM01+RM02, pada setiap tier. Kombinasi lain tetap dimainkan dengan paktanya, tetapi sebagai practice tanpa payout kontrak. Bell Tonic (lihat Currency) dapat dicentang di setup untuk +1 potion.

Gate balance (`npm run balance`) membangun raid persis seperti runtime (roster dan loadout Story, build Raid tiga hero, kontrak authored): pemain expert harus menang melawan semua 72 musuh di Bronze, setiap archetype di Silver dan Gold, setiap kombinasi pakta bersertifikat, party enam hero, dan raid Bronze setiap archetype setelah chapter 2, 6, dan 10. Win rate pemain casual dilaporkan sebagai informasi, begitu juga biaya tiap tier (`raidTiers` di `artifacts/balance.json`: median HP akhir dan ramuan expert per tier, win rate dan median HP casual di Silver/Gold). Dengan party akhir campaign, casual menang hampir semua raid Bronze, sekitar 90% Silver (median HP akhir ~90%) dan sekitar 60% Gold (median HP akhir ~35%, ramuan terpakai); expert tetap memenangkan semuanya.

### Roguelike

Run dimulai dengan tiga recruit dan satu pilihan basic job per recruit. Room clear memberi point untuk promosi job run; satu job tier-2 menghabiskan satu point dan tier-3 menghabiskan total dua. Point dibelanjakan di layar draft boon antar-floor (di bawah kartu boon, terlipat di **Poin promosi: n**, sehingga kartu boon pertama terlihat utuh saat layar dibuka di ponsel), dan job baru berlaku untuk sisa run; recruit yang sudah dipromosikan memulai setiap floor berikutnya dengan skill job-nya. Setiap kemenangan menawarkan sampai tiga boon yang belum dimiliki (empat dengan Fate Relic). Memilih boon memulihkan party sebelum descent berikutnya. Jika semua 12 boon telah dikumpulkan, tombol continuation tetap mengizinkan run berlanjut tanpa draft baru.

Roguelike memiliki tiga act milestone pada floor 3, 6, dan 9. Bank reward milestone adalah 6, 8, dan 22 Crystal. Floor yang membayar Crystal (1–9) memukul 15% lebih keras (`ENDLESS_EARLY_DMG`), lalu bonus itu memudar pada tiga floor berikutnya, sehingga floor berhadiah membawa risiko sementara kurva floor dalam tidak berubah. Floor setelah act ketiga adalah practice yang dapat diulang tanpa receipt milestone baru. Run wallet mendapatkan tiga Crystal per room dan terpisah dari bank Commander. Shop run (sebelum room dimulai): Mending Shard memberi setiap hero barrier 30% HP maksimum untuk room itu, Fate Reroll mengacak ulang boon yang ditawarkan setelah room itu, dan Ember Upgrade memberi power party +15% untuk room itu. Wallet sementara hilang saat run selesai, ditinggalkan, atau kalah.

Relik bank (dibeli permanen dengan Commander Crystal) berlaku di setiap run: Ward Relic memberi +1 potion dan barrier 15% HP maksimum untuk setiap hero di awal setiap floor; Fate Relic menambah kartu boon keempat di setiap draft.

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
| Winter Between Beats | Setiap cast menunda intent berikutnya 0,16 detik (dalam anggaran kontrol per intent) dan menambah 1 Resolve; telegraph aktif tetap berjalan. |
| For the Living | Setiap minion yang tumbang memulihkan 24 HP pada seluruh party. |
| Not Yet, Little Flame | Sekali per hero per floor, damage fatal menyisakan 20% HP. |
| Many Hands, One Song | Tap hero yang berbeda dari tap sebelumnya memberi hero itu Battle Hymn selama 1 detik (+30% power dan +20% tempo), maksimal sekali per hero setiap 4 detik. |

### Batas antar-mode

Story Gold, hero XP, recruitment, gear, dan story flags tetap berada di Story state. Roguelike memakai build run sendiri (recruit level 1). Raid membaca loadout Story (level, gear, refine, talent) tanpa mengubahnya; build Raid hanya memilih hero, class sementara, dan tile. Bank Commander Crystal dan challenge unlocks dirancang untuk digunakan lintas Challenge mode; run Crystal hanya berlaku di dalam run. Tidak ada pertukaran Story Gold menjadi run currency. Satu-satunya hasil Challenge yang masuk ke party Story adalah XP hero dari kemenangan Raid: XP itu menaikkan slot Story `auto` (nilai terbesar yang dipakai), sedangkan gear, job, talent, gold, dan slot manual Story tidak disentuh. Ledger (jumlah kill per musuh, victory, raid), total kemenangan, settlement receipt, dan floor Roguelike terdalam adalah statistik akun yang dibaca semua mode, sehingga hunt quest, Bestiary, dan descent quest di Story ikut menghitung progres dari Raid dan Roguelike. HUD selalu menampilkan Story Gold dan bank Crystal; Gold hanya bisa dibelanjakan di Story dan Crystal hanya di Challenge.

## 7. Aturan combat

### Arena dan waktu

Arena memiliki sembilan tile dalam tiga row dan tiga lane. Hero menempati tile, sementara minion menyerang dari lane. Combat adalah real-time simulation yang bergerak pada fixed step 1/60 detik. Phaser scene mengumpulkan frame delta lalu menjalankan langkah simulasi. `Battle` adalah pemilik status dan rules; renderer memvisualisasikan `BattleEvent`.

### Skill dan tindakan pemain

Hero memakai dua active skill yang dipasang pada loadout. Ketika cooldown stance aktif mencapai nol, hero otomatis menjalankan skill tersebut. Pemain tidak menekan tombol cast untuk setiap skill. Pemain dapat:

- **Tap hero** untuk mengurangi cooldown stance yang sedang aktif. Tap biasa mengurangi 0,64 detik; tap sync mengurangi 0,88 detik sebelum bonus talent/gear.
- **Kelola fatigue.** Tap menambah fatigue 5,5. Di atas 40 fatigue, efisiensi tap menjadi 50%; di atas 70 menjadi 14%. Jarak minimum antar-tap untuk hero yang sama adalah 0,11 detik. Fatigue mulai pulih setelah 0,5 detik tanpa tap, pada 32 poin per detik; talent Composure mempercepat pemulihan 50%.
- **Ganti stance** untuk memilih skill yang akan cast saat cooldown selesai. Pergantian mempertahankan persentase cooldown yang sudah berjalan.
- **Pindah atau swap hero** ke tile lain. Formation change sebelum combat gratis: jendela ready adalah lembar ringkas di area boss, sehingga grid tetap terlihat dan hero dapat diseret selama status `ready`. Saat combat berlangsung, relokasi menambah 0,9 detik cooldown dan move-lock 0,65 detik pada hero yang dipindah serta hero yang terswap. Talent Footwork mengurangi penalti hero pemiliknya menjadi 0,45 detik. Boon Dancer in Ash membuat penalti 0,2 detik dan memberi 30 shield pada setiap hero yang dipindah.
- **Party Guard** untuk mengurangi 65% incoming damage selama 2,8 detik (`GUARD_DURATION`). Cooldown normal 18 detik. Guard hanya melindungi bila masih aktif saat impact, jadi tombol Guard menyala **TAHAN SEKARANG** (`ready-window`) begitu serangan seluruh grid tinggal kurang dari 2,8 detik (dengan margin 0,05 detik, karena durasi Guard berkurang sebelum impact dihitung) dan Guard siap.
- **Potion** untuk memulihkan setiap hero hidup sebesar 28% HP maksimumnya (`POTION_HEAL`); encounter normal dimulai dengan dua potion. Long Night mengurangi jumlahnya menjadi satu.
- **Ninefold Dawn** ketika Resolve mencapai 100. Ultimate menghabiskan Resolve, memulihkan tiap hero hidup sebesar 12% HP maksimumnya (× power), memberi shield 8% HP maksimumnya, memberikan `220 + 5% HP maksimum boss` damage ke boss (`ULT_BASE`/`ULT_DAMAGE`), dan menghabisi minion aktif.

Resolve dimulai pada 25 dan bertambah dari damage, tap (0,3 per tap), cast/talent tertentu, Guard, dan boon tertentu. Nilainya dibatasi 100. Resolve dari damage diukur relatif terhadap pertarungan, bukan angka mentah: damage ke boss memberi 45 Resolve per HP boss final chapter itu (`RESOLVE_DEALT`; Raid dan Roguelike memakai HP boss encounter-nya), damage ke minion 26 per HP itu (`RESOLVE_MINION`), dan damage yang diterima 25 per total HP maksimum party (`RESOLVE_TAKEN`). Karena itu potion, ultimate, dan ritme ultimate (pemain expert: sekitar sekali per 25–50 detik, paling jarang di chapter 1 ketika tap dan cast masih sedikit) sama berartinya di chapter 1 dan chapter 16, dan heal party Mending Light (20 per hero) ikut bertumbuh dengan power skill healer.

### Cast ofensif, efek bertumpuk, dan kontrol

- **Cast ofensif** adalah semua skill selain shield, partyshield, heal, regen, buff, haste, delay, stun, resolve, selfheal, repair, dan counter (`SUPPORT_KINDS` di `simulation.ts`). Precision (1,6× power pada setiap cast ofensif ketiga), echo talent dan job (setiap cast ofensif kelima), Second Thunder, dan leech hanya menghitung cast ofensif. Ranking target Strongest memakai power tanpa proc Precision, sehingga target tidak berganti-ganti karena hitungan cast.
- **Efek yang tumpang tindih tidak saling merugikan.** Regen baru hanya mengganti regen yang sedang berjalan bila alirannya sama kuat atau lebih kuat; durasinya selalu diperbarui ke 6 detik, bukan ditumpuk. Battle Hymn memakai durasi terpanjang yang aktif. Kutukan disimpan per hexer (`curses` di snapshot): recast hanya memperbarui kutukan hexer itu, jadi dua hexer menghasilkan dua kutukan.
- **Bonus heal yang diberikan** (talent dan gear `heal`) berlaku untuk heal dan regen, bagian heal dari drain, dan semua leech. Mark Expose/Black Warrant menambah 20% damage ke boss dan minion. AoE wizard/warrior memberi power penuh ke boss dan 60% ke setiap minion; AoE class lain membagi rata 1,7× power ke semua minion, atau memberi power penuh ke boss bila tidak ada minion.
- **Status yang terlihat.** Mark (+20%), Weaken (−25% damage musuh), dan kutukan tampil sebagai chip dengan hitung mundur di strip status di bawah HUD boss (strip ini dan panel intent tidak pernah tertutup banner); counter stance tampil sebagai belah ketupat emas pada hero, turret sebagai penanda kuningan di lane-nya yang memudar selama 6 detik, dan Mending Rite sebagai busur progres di sekeliling boss. Snapshot `Battle` membawa `markLeft`, `weakenLeft`, `curses`, `turrets`, `channel`, `stageTime`, dan `enraged`. Setiap cast Mark, Weaken, Curse, Turret, dan Counter memunculkan teks singkat.
- **Anggaran kontrol.** Delay dan stun (Lullaby, Flash Mine, Ember Mine), intent delay job tier-3, dan Winter Between Beats berbagi anggaran per siklus intent: total tunda yang ditambahkan di antara dua telegraph paling banyak max(3 detik, 40% interval intent saat itu) (`CONTROL_MIN`/`CONTROL_SHARE`), dan jadwal intent tidak pernah melewati 14 detik. Anggaran terisi lagi pada setiap telegraph baru; stagger dari stun tetap berlaku penuh. Karena itu kontrol bertumpuk tidak bisa menghentikan intent boss sepenuhnya. Stun dan Lullaby memunculkan event `stun` bertuliskan **TERTUNDA +N d** (detik yang benar-benar ditambahkan) atau **DITEPIS** bila anggaran habis; teks itu tampil 1,6 detik sebagai chip di strip status boss dan dicatat di log; interrupt yang memutus ritual memunculkan event `interrupt`. Teks besar **HANCUR!** dengan freeze dan flash hanya dipakai untuk armor break sungguhan.

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

Satu kosakata ancaman dipakai dari pratinjau sampai battle: chip intent di dossier peta dan Bestiary menampilkan nama yang sama dengan banner telegraph (`threatName`, misalnya "BURU YANG TERLUKA" atau "ERUPSI LANE") ditambah keluarganya, dan baris counter di battle diawali tag keluarga yang sama: DITANDAI (weakest/strongest), TANAH (front/breath/meteor/aftershock), SELURUH GRID (all/silence), RAPALAN (mend); dalam bahasa Inggris MARKED, GROUND, ALL GRID, CHANNEL.

Telegraph selain all-grid berlangsung 3,2 detik. Skill interrupt dapat membatalkan telegraph all-grid yang aktif; selama ritual atau channel aktif, chip skill hero yang stance-nya interrupt ikut menyala. Party Story paling banyak delapan hero, jadi selalu ada satu tile kosong; bila telegraph tanah muncul ketika setiap tile tanpa tanda sudah ditempati hero hidup (misalnya row atau lane yang ditandai mencakup tile kosong itu, atau party Raid yang memenuhi grid), counter text-nya berganti menjadi "TANAH: tidak ada petak aman. Tukar tank atau hero ber-shield ke tanda, atau Guard (G)" (`NO_SAFE_TILE`). Mark pada hero mengikuti target; hazard berbasis row, lane, atau meteor tetap di lokasi yang ditandai. Pada phase lanjutan, Vharok dapat menambahkan aftershock meteor tertunda.

### Boss, minion, dan hasil encounter

Boss memiliki tiga phase yang ditentukan oleh HP: di atas 65%, 30% sampai 65%, dan 30% atau kurang. Jadwal telegraph memendek 0,6 detik per phase setelah phase pertama. Damage pada boss menambah stagger (23% dari damage); armor break terjadi saat stagger mencapai 8% HP maksimum boss (`STAGGER_SHARE`), dibatasi 800 × 1,2^(chapter − 1) (`STAGGER_CAP`/`STAGGER_CAP_GROWTH`), sehingga boss akhir tidak lagi hancur setengah pertarungan. Break membuka jendela 4,5 detik (`BREAK_SECONDS`) dengan damage boss 1,6 kali; selama break boss tidak menelegrafkan intent dan claw. Simulasi balance menargetkan uptime break sekitar 15–25% di setiap act. Setelah encounter (stage) melewati 150 detik (`ENRAGE_AT`), multiplier damage musuh menjadi 1,7 kali (`ENRAGE_DMG`). Pada detik 135 (`ENRAGE_WARN`) muncul banner **MURKA DALAM 15d** dan chip hitung mundur yang berdenyut di strip status boss (bukan di baris ARMOR, agar meter stagger tetap utuh di ponsel 360 px); pada detik 150 muncul banner **MURKA**, chip berganti menjadi MURKA, dan boss diberi rona merah. Panel Kontrol menjelaskan aturan ini.

Minion masuk sebagai tekanan tambahan di lane. Minion menyerang pertama kali 2,2 detik setelah muncul (`MINION_FIRST`), lalu setiap 5,5 detik; HP-nya 3% HP boss final chapter itu (`MINION_HP`, di Undercroft chapter depth itu), sehingga minion tetap menjadi ancaman di chapter akhir. Minion cenderung menyerang hero terdepan pada lane mereka, atau hero terlemah jika lane kosong. Claw hit dan summon berjalan sebagai timer terpisah dari intent utama.

Victory terjadi saat HP boss habis. Bila counter atau thorns menghabisi boss pada pukulan yang sama yang seharusnya menumbangkan hero terakhir, boss dihitung kalah lebih dulu: hero itu tetap berdiri dengan 1 HP dan hasilnya victory (tidak ada hero yang tumbang setelah boss kalah), sehingga wave berikutnya atau ruangan Undercroft berikutnya tidak dimulai tanpa hero hidup. Defeat terjadi saat seluruh hero tumbang sementara boss masih hidup. Tidak ada revive umum di tengah encounter. Campaign memerlukan kemenangan sebelum stage berikutnya disiapkan; Raid dan Roguelike memakai satu encounter per kontrak/floor. Hasil dan payout menggunakan settlement receipt untuk mencegah penyelesaian yang sama dibayar dua kali.

### Musuh

Runtime memuat 18 archetype dengan 3 varian warna/tekanan per archetype, total 72 records musuh. Ashbound, Frostbound, dan Gilded masing-masing mengalikan HP menjadi 1,12/1,22/1,32 dan damage menjadi 1,05/1,10/1,15; Frostbound dan Gilded juga memendekkan interval (0,3/0,6 detik) dan memutar urutan intent, sedangkan Ashbound mempertahankan urutan dan interval dasar. Deskripsi varian menyebutkan perbedaan itu. Nama varian membuang awalan "The" ("Ashbound Last Watch", "Frostbound Unburied") dan Frostbound tidak menambah awalan pada nama yang sudah memuat Frost ("Frostward Colossus").

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

Setiap basic job memiliki delapan definisi skill, total 72. Empat skill dasar dan skill job membuka pilihan yang lebih spesifik. Promosi membuka skill job, tetapi tidak memasangnya otomatis. Di tab Job, mengetuk kartu job hanya membuka inspektor di bawah jalur job (deskripsi, signature skill, biaya, dan alasan bila terkunci); Gold baru terpakai saat menekan **Promosikan · {biaya}G** di inspektor, yang lalu menawarkan **Pasang {skill} sekarang** (slot I, kecuali slot itu berisi heal hero dan skill job bukan heal: slot II). Tombol **Tutup** hanya menutup inspektor; Escape dan tombol Back ponsel tetap mundur satu rute, sama seperti inspektor gear. **Reset** hanya ada di tab Job dan selalu bertanya dulu: job beserta parent-nya, jumlah talent, dan Gold yang dikembalikan (`respecPreview`, jumlah yang sama dengan `respecHero`), dengan Batal terfokus; equipment, level, dan skill point tetap. Promosi branch tier-2 terbuka pada campaign rank 4; tier-3 memerlukan rank 10 dan parent yang benar. Harga promosi yang didefinisikan adalah 180 Gold untuk tier-2 dan 420 Gold untuk tier-3.

Setiap job tier-3 mempertahankan efek parent-nya dan membawa satu perk unik. Perk adalah data (`perk` pada job di `jobs.ts`) yang dibaca `Battle`, bukan daftar id job di simulasi:

| Perk | Job tier-3 |
|---|---|
| Barrier awal 25% HP maksimum (juga langsung saat promosi Roguelike) | Aegis Sovereign, Veil Reaper, Bell Oracle, Maestro, Lich Warden |
| Echo 40% power ke boss pada setiap cast ofensif kelima | Blade Saint, Astral Deadeye, Prismatic Archon, Plague Saint, Void Palm, Clockwright |
| Setiap cast menunda intent berikutnya 0,25 detik (dalam anggaran kontrol) | Last Hourkeeper, Thunder Skald |
| Setiap cast ofensif memulihkan diri 8% power skill | Crimson Warlord, Temple Wall |
| Minion yang dibunuh hero ini memulihkan seluruh party 18 HP | Wild Warden, Demolisher |
| 25% overheal dari heal hero ini menjadi barrier pada target | Ember Seraph |

`tests/job-perks.test.ts` memeriksa bahwa setiap perk aktif di pertempuran dan bahwa deskripsi job (sumber, EN, dan ID) menyebut angka yang sama.

### Hero XP, party Story, dan talent

- XP dan level disimpan per hero. Level maksimum 40.
- Setiap level di atas level 1 menambah power 5% dan HP 6% (`LEVEL_POWER`/`LEVEL_HP`); level adalah sumber utama pertumbuhan hero, ditambah gear (dan refine), talent, serta job.
- Hero yang direkrut mengejar median level roster pada saat recruitment. Recruit yang belum ada di save lama (konten ditambahkan belakangan) bergabung pada median level hero yang tersimpan.
- Story party dimulai dengan tiga hero aktif. Cap menjadi empat setelah dua chapter berurutan selesai, lima setelah tiga, enam setelah empat, tujuh setelah enam, dan delapan setelah sembilan. Cap berhenti di delapan agar satu tile selalu kosong; save lama dengan sembilan hero aktif dimuat dengan hero kesembilan di bench.
- Dalam Story, hero bench menerima setidaknya 50% dari victory XP dan catch-up tambahan yang dibatasi oleh selisih terhadap median XP party aktif. Formula ini tidak berlaku untuk Raid atau Roguelike.
- Katalog talent memiliki 66 definisi; 34 berlaku untuk setiap hero: 15 foundational, 15 node shared Assault/Guard/Tempo, dan empat node khusus class. Talent dapat memerlukan level hero, Gold, skill point, node parent, atau dua prerequisite. Hanya satu keystone dari tiga pilihan dapat dipakai pada satu hero.
- Respec mengembalikan Gold dan skill point yang dibelanjakan pada talent/job serta mengatur skill dasar kembali. XP dan gear milik hero tetap ada.

### Skill dan gear

Loadout setiap hero menyimpan dua skill aktif, talent, job, XP, inventori, dan slot formasi. Tile hero aktif unik; hero bench boleh berbagi tile pilihan. Di tab Formation, memindahkan hero aktif ke tile hero aktif lain menukar keduanya, sedangkan memilih tile untuk hero bench tidak pernah menggeser hero lain. Saat party Story diubah, hero yang sudah aktif mempertahankan tile-nya dan hero yang baru diturunkan mengambil tile sisa. Normalisasi save (reload dan setiap aktivasi Commander) mempertahankan tile tersimpan: hero aktif dalam urutan party menyimpan tile-nya bila belum dipakai hero aktif sebelumnya (jika bentrok, mengambil tile kosong sesuai perannya), sedangkan hero bench menyimpan tile valid apa pun. Skill book hanya menawarkan skill yang bisa dipasang (`legalSkill`): skill job lain menulis job yang dibutuhkan. Inspector gear menulis **Pakai** tanpa harga untuk item yang sudah dimiliki, membandingkan stat setelah refine, dan menerjemahkan rarity. Gear memiliki tiga slot: weapon, armor, dan charm. Katalog memiliki 42 item termasuk universal item, enam three-piece sets, class weapon, dan item quest. Item memiliki gate class/level/source; set memberi efek pada dua dan tiga item yang sesuai. Gear dibeli sekali per hero lalu dapat dipasang ulang tanpa pembelian ulang.

Skill, talent, equipment, job, XP curve, koefisien damage, dan deskripsi lengkap berada di definisi runtime berikut. Jangan menyalin tabel angka ke dokumen ini lalu menganggap salinan tetap segar ketika source berubah:

- [Skills](../src/game/content.ts), [job specializations](../src/game/jobs.ts), and [equipment](../src/game/jobs.ts).
- [Talents](../src/game/talents.ts) and [XP curve](../src/game/levels.ts).
- [Generated content tables](../Gridbound_GDD_GRID_RAID.md).

## 9. Konten campaign dan musuh

Campaign memakai empat chapter pembuka yang di-author di `src/game/world.ts`, lalu 12 chapter lanjutan di `src/game/story.ts`. Chapter lanjutan masing-masing berisi lima stage: tiga wave, miniboss, dan boss. Stage menyimpan enemy, nama stage, HP authoring, beat teks, dan opsional `enemyName`/`enemyTitle` (nama musuh khusus stage itu). Keenam belas stage Act I juga memiliki beat. Pertarungan pertama dalam campaign memakai tiga hero dan empat stage.

Contoh progres cerita dari chapter pembuka:

1. **Ashwood Trail:** mencari scout yang hilang. Sable ditemukan di hutan; boss stage adalah treant.
2. **Sunken Ruins:** mencari Orin dan suara di bawah batu. Wraith menjadi boss.
3. **Blackbriar Keep:** menahan siege di menara; Bran dan Kestrel ikut pulang.
4. **The Emerald Gate:** menghadapi Vharok sebagai guardian yang sedang dipengaruhi hunger; Nyx dan Mira ikut pulang.

Detail intro, outro, stage beat, reward, enemy ID, dan recruit ada pada `src/game/world.ts`, `src/game/story.ts`, serta output database. Chapter intro dan outro tersedia di Story Journal untuk dibaca kembali.

### Kurva kesulitan

Kekuatan musuh per chapter adalah `CHAPTER_HP` dan `CHAPTER_DMG` di `simulation.ts`, dihitung oleh `npm run calibrate` terhadap pemain skrip dari harness balance. Pemain skrip berbelanja seperti pemain sungguhan: promosi job dibeli lebih dulu dan skill job dipasang sebagai stance (skill job yang tidak menyembuhkan tidak pernah menggantikan heal healer terakhir), cabang tier-2 dipilih per run sehingga dua pemain CI bersama-sama memakai kedua cabang setiap class, party diisi satu hero per class lebih dulu (Bard, Hexer, Monk, dan Engineer ikut bertarung begitu direkrut), dan formasi mengikuti peran (warrior/monk di depan, sehingga claw mengenai tank). Dalam pertarungan hero yang menghindar ditarik ke tile kosong terdekat lalu kembali ke tile formasinya setelah impact. Ada empat profil: expert, casual, novice (input setiap 1,5 detik, 50% tap, 30% dodge/Guard, potion di bawah 25% HP), dan idle.

- **HP:** boss final pemain casual berlangsung sekitar 75 detik; boss chapter 1 dilunakkan (`CHAPTER_HP[0]` = 2,2). HP boss tidak pernah lebih kecil dari boss chapter sebelumnya, dan di dalam satu act multiplier HP bergerak paling banyak 20% per chapter (setiap act memulai ulang basis HP stage, jadi multiplier melompat di batas act).
- **Damage:** dipilih agar win rate novice per chapter mendekati 50% di chapter 1 sampai 60% di chapter 16, tanpa melewati batas margin pemain casual (casual kalah paling banyak satu dari dua belas run dan median run berakhir dengan sedikitnya 50% HP party, lalu dikurangi margin 5%) dan tidak di bawah batas idle (damage terkecil yang membuat pemain idle, tanpa input sama sekali, kalah di chapter itu dengan party awal-chapter pemain casual pada kedua campuran cabang); chapter yang tetap dimenangkan idle meski damage dinaikkan sampai batas casual tidak punya batas idle (dengan tabel sekarang idle masih memenangkan chapter 9 dan 10 pada salah satu campuran cabang). Mulai chapter 6 damage setiap chapter berada dalam ±20% dari chapter sebelumnya; chapter 2–5 (Act I dan langkah ke Act II) boleh naik lebih jauh (level awal, talent, gear, job pertama, dan hero keenam menaikkan party jauh lebih cepat dari 20% per chapter), tetapi tidak pernah turun lebih dari 20%. Lonjakan lama chapter 6→7 dan 12→13 serta penurunan HP chapter 15 sudah hilang.
- **Gate CI (`npm run balance`):** expert dan casual (boleh mengulang satu kali per chapter) menyelesaikan semua chapter, novice menyelesaikan sedikitnya 70% chapter dengan satu kali ulang, idle tidak bisa menyelesaikan Act I (dari profil baru, dan dengan party awal-chapter pemain casual ia kalah di setiap chapter Act I; hasil idle di setiap chapter dilaporkan, dan chapter 9 masih bisa dimenangkan tanpa input), dan expert memenangkan setiap varian raid. Win rate novice per chapter, uptime break, ultimate per menit, tap per detik, dodge, serangan minion, damage/heal per detik setiap job, wipe rate dan HP saat masuk guardian per depth Undercroft, serta floor Roguelike 1–9 dilaporkan sebagai informasi di `artifacts/balance.json`.

## 10. Quest, ekonomi, dan reward

### Quest

Katalog berisi 30 quest:

- 12 hunt untuk melawan archetype musuh.
- 6 town request yang tersusun sebagai chain.
- 9 companion milestone yang mengikat level ke hero tertentu.
- 3 descent milestone untuk progres Roguelike.

Objective dihitung dari progres tercatat. Pemain harus menekan claim; reward tidak otomatis dibelanjakan. Klaim yang sama tidak dapat diulang. Quest dapat memberi Gold, XP ke hero penerima, atau item tertentu. XP companion diberikan kepada hero yang ditetapkan quest. Gear hadiah langsung dipasang bila slot pemiliknya kosong dan pemilik memenuhi syaratnya (class dan level); slot yang sudah terisi tidak pernah ditukar, gear masuk inventory.

### Currency

| Currency | Pemakaian | Batas |
|---|---|---|
| Gold | Talent, job promotion, gear, quest reward, dan reward encounter Story. Profile baru mulai dengan 60 Gold. | Tidak dijual dengan uang nyata dalam runtime. |
| Commander Crystal | Bank Challenge lintas Raid/Roguelike: relik permanen di Challenge Shop dan Bell Tonic yang bisa dibeli berulang saat berangkat. | Tidak sama dengan run Crystal; hanya bisa dibelanjakan di mode Raid/Roguelike. |
| Run Crystal | Mata uang sementara untuk pilihan item dalam run Roguelike. | Bertambah tiga per room; hilang saat run berakhir, abandon, atau defeat. |
| Material map | Field pada economy profile tersedia. | Loop material gathering/crafting tidak dinyatakan sebagai fitur baseline yang lengkap oleh source/GDD ini. |

Raid Crystal hanya dibayar oleh victory pada kontrak authored dan tervalidasi. Kontrak practice atau Sandbox memberi nol bank reward. Base payout Bronze/Silver/Gold adalah 12/18/26 Crystal. Risk points kontrak mencakup tier (0/3/6) dan modifier; bonus risk dibatasi maksimum 60%, lalu setiap modifier memberi bonus 3 Crystal. Final payout dibulatkan ke integer terdekat.

Challenge Shop menyediakan tiga item run: Mending Shard seharga 8 Run Crystal, Fate Reroll seharga 12, dan Ember Upgrade seharga 18. Bank unlock permanen: Ward Relic seharga 24 Commander Crystal (setiap floor Roguelike +1 potion dan barrier awal 15% HP maksimum per hero) dan Fate Relic seharga 36 (draft boon Roguelike menawarkan 4 pilihan). Di Bursa Crystal, mengetuk relik hanya membukanya di inspektor di bawahnya (biaya atau kekurangannya); Crystal baru terpakai saat menekan **Beli · n ◆** di sana, dan **Tutup** menutupnya. Sink berulang: Bell Tonic seharga 6 Commander Crystal, dicentang di setup Raid atau Roguelike dan dibayar saat run dimulai (setelah encounter berhasil dibuat, sehingga keberangkatan yang gagal tidak memotong Crystal), memberi +1 potion untuk raid itu atau floor pertama run Roguelike itu (bila Crystal tidak cukup, centang dinonaktifkan).

### Settlement dan kegagalan

Settlement memeriksa status victory, stage/floor, contract, dan receipt. Story first-clear recruitment dan chapter reward tidak diberikan ulang saat replay. Raid reward hanya berasal dari contract allowlist. Rogue memiliki bank reward pada milestone act, sementara run wallet dan boon tidak menjadi progres permanen. Encounter checkpoint disimpan pada batas encounter, bukan sebagai rekaman frame-by-frame.

## 11. Antarmuka, kontrol, dan aksesibilitas

### Layar

| Layar | Fungsi |
|---|---|
| Title | Masuk Emberhollow, kelola Commander Profiles, buka Story Journal, dan atur Camp Settings. |
| Camp | Desa pixel dengan bangunan sebagai menu, badge, mode terkunci/BARU, Langkah berikutnya, dan Lanjut: CH n. |
| Cerita (gerbang) | Peta act, pemilihan chapter, dossier, serta tab Undercroft, Raid, dan Ujian Lonceng (terkunci sampai chapter pembukanya). Nama chapter di peta boleh dua baris dan selalu berada di dalam peta. |
| Party | Pilih hero, susun formation, pilih dua active skills, beli/pasang gear. Di ponsel (≤480 px) seluruh rute bergulir: hero menjadi header satu baris yang menempel (potret, nama, LV, Power, SP) bersama tab, dan Depart tetap di bawah. |
| Job | Status, job, cabang talent, skill point, dan respec. Mengetuk talent membawa inspector dan tombol Pelajari ke layar. |
| MENU | Party, Job, Quest, Bestiary, Bursa Crystal, Jurnal, Save, Pengaturan, Judul. |
| Quest | Satu daftar kartu ringkas yang dikelompokkan menurut status: siap diklaim lebih dulu, lalu dilacak, berjalan, terkunci, dan sudah diklaim (urutan QUESTS di dalam kelompok), dengan tombol **Klaim semua (n)** di bilah yang menempel di bawah papan (dalam jangkauan jempol) untuk hero masing-masing quest atau penerima hadiah yang dipilih (Gold dan EXP). n adalah jumlah yang benar-benar diklaim, termasuk quest berantai yang terbuka di tengah klaim. Setiap gear hadiah diberikan kepada hero party aktif yang slotnya kosong, yang paling sedikit memakai gear lebih dulu (sehingga tersebar di party), lalu langsung dipasang; tanpa hero seperti itu gear jatuh ke penerima. Notifikasi menyebut gear mana dipasang pada siapa. Gear hadiah yang sudah dimiliki penerimanya dijual seharga harganya, tidak hilang. |
| Bestiary | Grid 18 jenis musuh (siluet "???" sampai jenis itu ditemui, menurut ledger akun) dengan lembar detail: varian T1–T4, deskripsi, urutan intent, dan counter. |
| Battle | Arena, Hero inspector, Log, party health, lane targets, Guard, potion, ultimate, pause. Header boss: nama, subjudul (mis. FROSTBOUND · PADUAN LONCENG), dan badge fase; bila tidak muat satu baris (ponsel, varian Frostbound/Gilded/Ashbound), subjudul turun ke bawah nama bersama badge fase, tidak pernah tertimpa. |
| Result / boon draft | Victory/defeat dengan tombol aksi yang selalu terlihat di bawah layar, EXP party sebagai grid potret (+EXP, LV lama→baru) dan cadangan dalam satu baris; Detail berisi damage, heal, blok, dodge, ketukan, pindah tile, dan target bintang yang tercapai. Kekalahan Story menampilkan power party vs rekomendasi, hero yang tumbang pertama dan penyebabnya, "Cara mengalahkan {musuh}" (counter musuh yang menang), serta hingga dua perbaikan satu ketukan (lebih dulu **Turunkan hero cadangan (n slot kosong)** bila party berangkat dengan slot kosong padahal ada hero cadangan, kecuali saat run Undercroft mengunci party; lalu Undercroft bila under-power, talent/job, atau upgrade gear yang terjangkau; perbaikan membuka Training Hall pada hero yang disebut, perbaikan cadangan membuka Formasi pada hero cadangan dengan daftar party Story terbuka, dan perbaikan gear langsung pada slot dan item yang ditemukan). Bila checkpoint pertarungan yang kalah dimulai dengan hero yang sudah tumbang (atau HP party di bawah 40%), "Ulang chapter" menjadi tombol utama dengan penjelasan, karena Ulangi pertarungan ini akan mengulang kekalahan yang sama. Outro chapter di layar kemenangan tampil utuh. Roguelike memilih boon sebelum descent berikutnya. |

### Kontrol

| Input | Aksi |
|---|---|
| Tap/click area hero | Mempercepat cooldown hero yang disentuh. Tap pada skill chip mengganti stance, bukan mempercepat cooldown. Area tap chip (minimal 24 px) tetap di dalam kartunya sendiri: dari bar HP sampai 2 px di bawah kartu, sehingga 60% atas kartu (sprite, tag nama, bar HP) selalu milik hero dan strip atas kartu di bawahnya milik kartu itu. Seret yang dimulai di mana pun pada kartu, termasuk dari chip, memindahkan hero setelah 9 px; seret yang dilepas di petaknya sendiri dalam 24 px dan 300 ms dihitung tap (jempol yang tergelincir). Tap chip dalam 300 ms setelah tap pada hero yang sama diabaikan, dan setiap pergantian menampilkan toast "Skill: X (ketuk lagi untuk batal)". Label chip 12 px: nama skill lengkap bila muat, kalau tidak kata pertamanya, kalau tidak emblem dua huruf; nama lengkap ada di label aksesibel, bar fokus, tampilan Status, dan toast. |
| Drag hero ke tile | Memindahkan atau menukar posisi; tersedia juga mode pindah dengan tombol tile. |
| Klik lane target | Memilih lane untuk skill terarah. |
| `1` sampai `9` | Memilih hero berdasarkan posisi grid. |
| `Q` / `E` | Mengganti skill stance hero terpilih. |
| `G` | Party Guard. |
| `H` | Potion. Potion kedua dalam 600 ms diabaikan (ketuk ganda), dan bila setiap hero hidup punya HP 95% atau lebih ramuan tidak dipakai; toast "Party masih sehat" menjelaskannya. |
| `R` | Ultimate jika Resolve mencukupi. |
| `B` | Buka boon codex saat sesuai. |
| `Enter` | Memulai encounter ready jika fokus tidak berada pada tombol/link. |
| `Space` / `P` | Membuka menu jeda (Space juga saat kartu hero sedang difokus; tombol lain tetap menerima Space). |
| `Escape` | Satu langkah Kembali: menutup lapisan teratas (adegan cerita: lewati; dialog: tutup, atau kembali ke dialog induknya; skill picker/move mode; Details hasil), lalu Status/Log → Arena, jendela siap → Kembali-nya, pertarungan → menu jeda, hasil → Kembali, rute kota → rute sebelumnya, camp → layar judul. Di layar judul Escape tidak melakukan apa-apa, begitu juga Escape di kolom teks (ganti nama, DELETE, Tempel cadangan) dan Escape yang ditahan (hanya satu langkah). |
| `Backspace` | Kembali satu rute, hanya di rute kota selain camp tanpa dialog di atasnya. |

Tombol **Ⅱ Menu** (berlabel, di kanan atas bar battle, terlihat di Arena, Status, dan Log) membuka menu jeda: Resume (difokus), Controls, Config, lalu pintu keluar yang labelnya menyebut akibatnya — **◀ Kembali** sebelum SERANG! pada keberangkatan baru, **Tinggalkan pertarungan…** di Story/Raid/Ujian Lonceng, **Kabur dari ruangan…** atau **◀ Kembali ke peta** di Undercroft. Controls dan Config dari menu jeda diakhiri **Kembali** yang kembali ke menu jeda (pertarungan tetap dijeda sampai menu jeda ditutup). Jendela siap menampilkan **◀ Kembali** di depan SERANG!: pada battle pertama keberangkatan baru (juga setelah Retry, raid, lantai pertama Ujian Lonceng, dan setiap ruangan Undercroft) ia gratis — kembali ke rute keberangkatan, checkpoint keberangkatan dibuang tanpa catatan "ditinggalkan", dan Bell Tonic yang dibayar dikembalikan; pada battle berikutnya atau battle yang dilanjutkan ia menjadi **◀ Tinggalkan…** yang membuka dialog. Dialog keluar per mode: **Simpan & tunda** (difokus), Batal, lalu terakhir opsi merah yang menyebut kerugiannya (Story: Keluar dari chapter (tanpa hadiah); Raid: Tinggalkan raid (tanpa hadiah); Ujian Lonceng: Tinggalkan run (boon dan Crystal run hilang)); semua konfirmasi (kabur dari ruangan, reset, hapus file, tinggalkan run) menaruh opsi aman lebih dulu dan opsi merah paling akhir, dan opsi merah tidak pernah muncul di tempat tombol yang membukanya (misalnya **Tinggalkan pertarungan…**): bila tumpang tindih, ia digeser ke bawah (atau ke atas bila di bawah tidak muat), sehingga ketukan kedua di titik yang sama tidak mengenainya. Dialog yang baru terbuka atau berganti isi di bawah jari mengabaikan ketukan selama 450 ms (opsi merah dan yang membelanjakan 600 ms), jadi ketuk ganda pada **Tinggalkan pertarungan…** tidak pernah langsung meninggalkan chapter; di kota, Promote → **Pasang … sekarang** dan **Beli & pasang** → item berikutnya memakai jeda yang sama (ketukan dari keyboard tidak pernah ditahan); setelah battle yang dimenangkan tombol **Tinggalkan dulu…** membuka dialognya sendiri. Di layar draft boon Ujian Lonceng tombol **Tinggalkan dulu…** (lengket di bawah) membuka dialog Ujian Lonceng yang sama: **Simpan & tunda** menyimpan draft itu (begitu juga reload, tab yang ditutup, atau Kembali), lalu setup Ujian Lonceng menampilkan kartu run dengan **Tinggalkan run ini** dan tombol **Lanjutkan · pilih boon (lantai n)** yang membuka draft yang sama: boon yang ditawarkan sama (termasuk Fate Reroll yang sudah dibeli untuk lantai itu), dan poin promosi yang dipakai di draft sebelum boon diambil dikembalikan. **Chapter yang dijeda.** Simpan & tunda di tengah chapter Story (setelah SERANG!, atau setelah sebuah pertarungan dimenangkan; begitu juga reload atau tab yang ditutup) menjeda chapter itu dengan party, HP, ramuan, dan gold yang dibawanya; **Pertarungan berikutnya** menyimpan checkpoint di awal pertarungan berikutnya, dan pertarungan yang ditunda setelah menang dilanjutkan langsung di jendela siap pertarungan berikutnya. Keberangkatan yang belum pernah dimainkan (reload atau tab ditutup di jendela siap pertarungan 1, sebelum SERANG!) tidak menjeda apa pun: tidak ada yang hilang, dan keberangkatan berikutnya memakai party sekarang. Camp menampilkan langkah "CH n dijeda di pertarungan k/total" dengan tombol utama **Lanjutkan CH n · pertarungan k** dan **Tinggalkan…**; dossier chapter itu menampilkan kartu dengan **Tinggalkan CH n** dan tombol masuk **Lanjutkan pertarungan k/total**; dossier chapter lain menulis bahwa masuk ke sana akan ditanyakan dulu; layar Party mengingatkan (di atas panelnya) bahwa perubahan party berlaku setelah pertarungan yang dijeda selesai (dengan **Tinggalkan…**), sedangkan gear, talent, dan job baru sudah berlaku saat dilanjutkan: pertarungan yang dilanjutkan memakai build hero saat ini dengan porsi HP, ramuan, tahap, dan pola musuh yang sama. Kekalahan di pertarungan k > 1 sebuah chapter Story menyimpan awal pertarungan itu sebagai chapter yang dijeda, jadi pergi lewat perbaikan kekalahan (misalnya belajar talent), **Kembali**, tombol Kembali ponsel, atau reload tetap menyisakan **Lanjutkan CH n · pertarungan k** (hasilnya menuliskannya); **Ulang chapter** menghapusnya. Awal pertarungan yang lemah (ada hero yang tumbang, atau HP party di bawah 40%) tidak disimpan: hasilnya menyarankan **Ulang chapter**. Karena pertarungan yang disimpan dilanjutkan dengan party awalnya, perbaikan "turunkan hero cadangan" di sana berbunyi **Turunkan hero cadangan dan ulang CH n** dan memang mengulang chapter. Masuk ke chapter lain (atau ke chapter yang sama dengan tingkat kesulitan lain) tidak pernah diam-diam membuka chapter yang dijeda: dialognya menawarkan **Lanjutkan CH n** (difokus), **Tinggalkan CH n dan masuk ke CH m** (merah; gold yang dibawa hilang, lalu chapter pilihan dimulai dengan party sekarang, dengan intro chapter pada kunjungan pertama), dan **Batal**. Meninggalkan chapter yang dijeda (dengan konfirmasi) hanya menghapus pertarungan itu dan gold yang dibawanya; party, gear, EXP, dan chapter yang sudah tuntas tidak berubah. Keluar dari battle atau hasilnya kembali ke rute tempat keberangkatan dibuat (dossier, Party, setup Raid, Ujian Lonceng, peta Undercroft), kecuali hasil yang mengantre adegan camp (clear pertama, rekrutan, pilihan cerita, akhir), yang kembali ke camp. Setiap hasil menaruh **Kembali ke {tujuan}** pertama di bar aksi lengket (primer saat menang, Retry sesudahnya). Hasil yang gagal disimpan membuka dialog "Tidak tersimpan" yang memblokir (tanpa ×; Escape dan Kembali tetap di dialog; Coba simpan lagi / Ekspor hasil). Di ponsel, jendela siap selalu berakhir di atas row depan (semua kartu hero tetap terlihat dan bisa diseret), cerita stage tampil dua baris dengan tombol **Selengkapnya**/**Ringkas**, dan **SERANG!** beserta **◀ Kembali** berada di baki bawah (menggantikan Guard, Ramuan, dan Fajar Sembilan sampai SERANG! ditekan). Guard, Ramuan, Fajar Sembilan, dan Ⅱ Menu bereaksi saat jarinya sendiri diangkat, sehingga tetap bekerja ketika jari lain sedang menyeret hero. Pada layar sentuh panel Kontrol menjelaskan gestur (ketuk hero, ketuk chip skill, Ⅱ Menu, tombol Kembali ponsel), bukan tombol keyboard. Membuka Status atau Log saat combat mem-pause battle; kembali ke Arena melanjutkannya. Jika pemain meninggalkan tab ketika bertarung (pindah aplikasi, layar dikunci, `pagehide`, `freeze`), game membuka menu jeda; jika jendela kehilangan fokus (bilah notifikasi, Control Center, ketukan di halaman itch.io), pertarungan langsung dijeda dan menu jedanya baru terbuka saat pemain kembali (agar tidak merebut fokus dari halaman yang sedang dipakai). Kembali ke halaman tidak melanjutkan apa pun sampai pemain menekan Lanjutkan. Hasil pertarungan yang menunggu animasi kematian boss langsung disimpan saat halaman disembunyikan, dan save yang gagal dicoba lagi. Selama pertarungan tampil (jendela siap, bertarung, dijeda) game meminta Screen Wake Lock agar layar tidak mati (tidak diminta di frame itch.io yang tidak mengizinkannya; penolakan diabaikan) dan melepasnya di layar hasil dan di kota. Menutup tab ketika bertarung atau saat save tertunda meminta konfirmasi browser.

### Aksesibilitas dan responsive behavior

Source menyediakan native buttons/select/dialog/details, label ARIA pada sebagian navigasi dan control, focus-visible style, keyboard binding, pengaturan sound/motion, dan dukungan `prefers-reduced-motion`. Suara mengikuti aktivasi pengguna: AudioContext baru dibuat saat Sound menyala (pada klik, jari yang diangkat, atau tombol keyboard), dilanjutkan dari status `interrupted` iOS setelah pindah aplikasi atau layar dikunci, dijeda saat halaman tersembunyi atau setelah 20 detik tanpa suara, dan langsung dijeda saat Sound dimatikan; bunyi kursor UI diputar saat ditekan untuk mouse dan saat klik untuk jari/pena, jadi geseran yang dimulai di atas tombol tidak berbunyi. Di iPhone, Config menyebut bahwa sakelar dering/senyap mematikan suara game. Banyak target utama mempunyai tinggi minimum 44 CSS px pada viewport yang diuji.

- **Gerakan:** gerakan efektif = pengaturan Motion pemain **dan** perangkat tidak meminta `prefers-reduced-motion`. Pengaturan tersimpan tidak pernah ditimpa; preferensi perangkat berlaku juga saat Commander dimuat dan langsung saat berubah (tanpa flash layar, guncangan, hit-stop, animasi masuk layar, atau bob boss). Saat perangkat meminta gerakan dikurangi, Pengaturan menjelaskannya di bawah sakelar Motion.
- **Pengumuman battle:** panel intent, banner, dan countdown desimal bukan live region; teks HUD per frame hanya ditulis bila berubah (label kartu party menghitung detik bulat). Satu live region tersembunyi (`#battle-announcer`, role=status) mengucapkan momen penting: ancaman baru beserta target dan sisa detiknya (disusun saat diucapkan; ancaman yang sudah mendarat atau tinggal kurang dari 1 detik dilewati), hero tumbang atau bangkit, fase boss, armor break, menang, dan kalah — paling banyak satu pesan per 1,5 detik, dan dikosongkan di town.
- **Fokus:** isi baru di modal yang sudah terbuka (Pause → Pengaturan) memindahkan fokus ke judulnya; menutup modal, skill picker, atau adegan cerita mengembalikan fokus ke kontrol pembukanya. Adegan cerita membuat seluruh halaman di belakangnya `inert` (Tab tidak bisa mencapai town; hanya region status — status simpan dan `#battle-announcer` — tetap terbaca), teks mesin ketik disembunyikan dari pembaca layar, dan setiap halaman dibacakan utuh sekali. Canvas Phaser `aria-hidden` karena kontrolnya ada di lapisan DOM.
- **Label bangunan:** badge pada papan nama ikut dibacakan, misalnya "Serikat · Quest · 2 hadiah quest siap" atau "Gerbang · Cerita · chapter berikutnya menunggu".
- **Ukuran teks:** angka berhuruf Press Start 2P di layar hasil dan Undercroft minimal 10 px.
- **Ponsel:** ponsel portrait adalah platform utama. Game menghormati area aman ponsel (`env(safe-area-inset-*)`): HUD, rute kota, layar battle, hasil, adegan cerita (termasuk Lewati), dialog, dan status simpan tidak pernah berada di bawah notch, indikator home iPhone, atau bilah gestur Android; latar belakang tetap penuh sampai tepi layar, dan sisi ponsel yang dipegang miring hanya dihitung bila mencapai kolom game. Ketuk dua kali tidak memperbesar halaman (cubit tetap bisa), tekan lama tidak memilih teks dan tidak membuka menu gambar, gambar tidak bisa diseret, dan gaya hover hanya berlaku pada perangkat yang bisa hover (tombol yang diketuk tidak tertinggal berwarna hover). Pada layar sentuh, select, kolom teks, dan teks cadangan berukuran 16 px agar iPhone Safari tidak memperbesar halaman saat kolom difokus. Halaman tidak pernah ikut tergulir, sehingga tarik-untuk-muat-ulang Android tidak memuat ulang game; di iframe itch.io, usapan satu jari yang tidak bisa digulir oleh game tidak menggulir atau memuat ulang halaman itch selama seluruh frame terlihat. Ponsel yang dipegang miring menampilkan satu baris "Putar ponselmu tegak untuk tampilan terbaik." di bawah HUD kota atau di atas layar judul (tidak pernah di atas pertarungan); baris itu tembus ketukan, hilang sendiri setelah 6 detik, dan baru muncul lagi saat ponsel diputar miring lagi (bukan setelah pertarungan). Dengan mouse, teks dialog (misalnya galat simpan) tetap bisa dipilih dan disalin, dan usap-kembali trackpad tetap menjadi satu langkah Kembali. Perilaku iPhone Safari dan gestur Android di perangkat fisik belum diverifikasi; buktinya emulasi Chrome dan aturan CSS.

- **Bahasa (EN/ID):** angka mengikuti bahasa game, bukan locale browser (EN 3,000 dan 4.2s; ID 3.000 dan 4,2d), termasuk HP boss, gold, timer, angka melayang, dan tanggal slot. Teks Inggris memakai bentuk tunggal/jamak yang benar ("1 chapter", "16 chapters"); bahasa Indonesia memakai kata dasar. Galat penyimpanan dan alasan kunci talent/gear berasal dari kode (`CommanderError.code`, `LockReason`) dan selalu tampil dalam bahasa aktif; pesan mentah hanya masuk konsol. Glosarium Indonesia (`src/i18n/glossary.ts`): Act → Babak, Potion → Ramuan, Ninefold Dawn → Fajar Sembilan, battle → pertarungan, tile → petak, klik → ketuk, floor → lantai, power party / stat Power → Kekuatan, dan komandan disapa kamu/-mu ("kalian" hanya saat hero berbicara kepada party); skill, party, cooldown, run, dan lane tetap berbahasa Inggris. Nama chapter dan babak tetap Inggris dan dikutip sebagai judul, misalnya "Masuk: The Glass Ferry", "Berangkat ke «The Glass Ferry»", "Penyeberangan — «The Glass Ferry»". Angka tuning (Heroic, tempa, kemah, efek event Undercroft, penalti pindah, Mark/Weaken) dibaca dari konstanta game, bukan ditulis di teks.

Ini bukan klaim WCAG atau screen-reader certification. Catatan UI masih membatasi bukti pada emulasi browser dan beberapa ukuran viewport. Desktop map-pin focus, screen reader, contrast audit menyeluruh, forced-colors, physical keyboard, dan 200% native zoom belum dinyatakan lulus.

## 12. Arah visual dan audio

- Presentasi menggunakan pixel art dan Canvas-generated hero, monster, serta town imagery yang dibundel lokal. Hero dengan class yang sama dibedakan oleh aksen per hero (`HERO_LOOKS`: warna pakaian dan trim, warna kulit, poni rambut, janggut): Bran, Kestrel, Nyx, Mira, Ilse, dan Hale berbeda dari Aldric, Rowan, Sable, Lyra, Tamsin, dan Pell di camp, menu, Party, Undercroft, hasil, dan grid battle (juga saat Raid menukar class-nya); recruit Ujian Lonceng memakai sprite class.
- Phaser menggambar arena, sprite, intent tiles, countdown, projectile, damage/heal feedback, phase cue, dan victory/defeat presentation. Crit bersifat relatif (`src/render/hit-feedback.ts`): hit di atas persentil ke-90 dari 40 hit terakhir encounter (setelah 12 hit) atau di atas 2× rata-rata sumbernya; crit memakai cue suara crit. Guncangan dan flash berskala dengan porsi HP yang diambil, guncangan dibatasi anggaran per detik, dan hit-stop hanya untuk crit, armor break, KO, ultimate, dan kemenangan. Biaya Hollow Pact tampil sebagai teks PAKTA ungu tanpa flash. Hero yang tumbang mendapat banner "{nama} TUMBANG", ledakan abu-abu, sting suara, kilat merah pada kartunya, dan baris log; kartu hero di bawah 35% HP berdenyut.
- HUD battle: panel intent selalu terlihat (di antara ancaman ia mengajarkan tap dan seret); pada ponsel tinggi panel intent dan chip status boss menempati ruang di atas arena (arena ditempatkan di bawah slotnya). Banner tipis dan tembus klik berada di area boss, selalu di bawah strip status dan panel intent (yang pada ponsel pendek menutupi bagian atas arena) dan di atas row depan; nama stage hanya tampil di jendela ready dan log. Pada layar sentuh, petunjuk "(G)" dihapus dari counter text. Kartu hero membawa tag nama 12 px, angka battle berhuruf piksel memakai minimal 10 px dan teks lain minimal 12 px, dan huruf tombol (G/H/R) disembunyikan pada layar sentuh. Pada layar pendek (bilah browser tampil, iPhone SE) grid tetap selebar ponsel: hingga 120 px kanvas langit di atas boss dipotong, bar fokus disembunyikan, dan label tempat satu baris; di ponsel landscape arena mengisi tinggi layar di kolom kiri dan HUD (bar atas, boss, panel intent, bar fokus, baki) di kolom kanan. Tip coach (paling banyak dua baris, Skip 44 px) ditempatkan di pita antara panel intent dan row depan, tidak pernah di atas kartu hero atau bar HP boss, dengan panah ke sasarannya; saat tip tampil panel intent hanya menampilkan baris ancaman, dan di layar setinggi 760 px atau kurang baris counter-nya satu baris. Log battle menyimpan 30 baris: impact telegraph (siapa terkena dan berapa), KO beserta penyebabnya, interrupt yang berhasil, hasil stun/Lullaby, armor break, dan potion. Panel Run boons dan Journey shop hanya tampil di Roguelike.
- DOM menampung navigasi, panel party, lane control, HUD, dialog, dan status save.
- Font yang dibundel lokal mencakup Press Start 2P dan Space Grotesk.
- Performa: semua canvas art memakai `willReadFrequently` (Phaser dan `toDataURL` membacanya kembali), art musuh didaftarkan saat pertama kali dipakai (8 frame sekaligus; boot hanya membuat boss pembuka; dossier chapter yang terbuka menyiapkan art musuh chapter itu di saat senggang), scene town digambar sekali per halaman untuk layar judul dan camp (setelah layar tampil, PNG-nya di-encode di luar main thread), potret musuh di-cache, dan AudioContext ditangguhkan saat tab tersembunyi. **Muat pertama di ponsel:** `index.html` langsung menampilkan splash (kata GRIDBOUND dan bilah CSS, tanpa font atau URL luar), dan Phaser (sekitar 330 KB gzip) tidak lagi ikut di jalur kritis: engine dimuat lewat dynamic import setelah layar judul (di saat senggang pertama camp setelah Enter, atau saat keberangkatan pertama bila lebih dulu), sehingga ketukan pertama di layar judul tidak menunggu WebGL. Engine berjalan tanpa pipeline FX pre/post (11 program shader, bukan 31), paling banyak 60 frame per detik di layar 90/120 Hz, dan tanpa `preserveDrawingBuffer`. **Diam berarti diam:** loop Phaser hanya berjalan selama arena bisa berubah (pertarungan, jendela siap tanpa dialog di atasnya, boss yang sedang roboh) dan tidur di kota, di balik kartu hasil atau kartu gelombang, di tampilan Status/Log, dan saat dijeda; animasi HUD yang berulang berhenti selama tidak ada pertarungan; latar dialog tidak di-blur; dekorasi kota dan layar judul hanya menganimasikan transform/opacity dan berhenti di bawah layar judul; animasi masuk layar memakai Web Animations tanpa membaca style (GSAP dihapus). `server.js` mengirim teks terkompresi (Brotli/gzip). `scripts/perf-browser.mjs` mengukur anggaran ponsel P1–P11 (Pixel 7 dengan CPU 4×, ponsel 360 × 740 dengan CPU 6×, Slow/Fast 4G; `PERF_DIST=1` untuk build produksi lewat `server.js`; belum menjadi gate CI).
- Combat/interface SFX dibuat secara prosedural melalui Web Audio dan dapat dimatikan. Background music tidak aktif. Setiap jenis cast punya cue sendiri (haste, weaken, curse, delay/stun, counter, turret, drain, sacrifice, repair, dan lainnya), begitu pula KO, stun, interrupt, enrage, serangan minion, dan biaya Pakta; cue yang belum dipetakan dicatat di konsol pada build dev. Suara kekalahan diputar sekali oleh layar hasil.
- Tidak ada voice acting atau aset runtime wajib dari CDN.

Repository belum menyediakan art bible lengkap, inventory seluruh aset eksternal/attribution, atau target loudness/latency audio perangkat. Jangan menyamakan generated local sprites dengan sign-off art final.

## 13. Teknologi, save, dan batas operasi

### Arsitektur

`index.html` memuat `src/main.ts` sebagai composition root. Main mengatur state layar, event DOM, profile, audio, persistence, dan instance Phaser. `src/ui/` menghasilkan tampilan Town/map; `src/game/simulation.ts` memegang rules combat; `src/render/BattleScene.ts` menjalankan fixed-step loop dan efek; `src/audio/sound.ts` merender event menjadi SFX. Progression dan economy berada di domain `src/game/` serta `src/economy/`.

Node.js 22.12+ diperlukan untuk build/dev, bukan untuk memainkan bundle statis. `npm run build` membuat `dist/`; `server.js` opsional untuk host Node dan mengirim HTML/JS/CSS/SVG terkompresi (Brotli, lalu gzip) sesuai `Accept-Encoding`. Aplikasi tidak membutuhkan API server atau route backend.

### Commander dan save

Runtime memisahkan dua lapisan penyimpanan:

1. Legacy Profile `gridbound.v3` di localStorage, dengan pembacaan/migrasi format sebelumnya dan proteksi read-only untuk save rusak/tidak dikenal. Kunci ini sekarang menjadi sumber migrasi ke Commander (lihat di bawah).
2. Commander Documents di IndexedDB. Satu browser dapat menyimpan maksimum tiga Commander. Setiap Commander menyimpan mode Story, Raid, Roguelike, shared Challenge state, empat slot per mode (`manual-1`, `manual-2`, `manual-3`, `auto`), dan encounter/run checkpoint.

Setiap pemain selalu memiliki Commander. Saat launch, runtime mengaktifkan Commander terakhir; jika belum ada satu pun, isi mentah `gridbound.v3` lebih dulu disalin ke kunci cadangan `gridbound.v3.backup-<timestamp ISO>` (tiga cadangan terbaru disimpan, salinan yang identik tidak diulang), lalu Commander dibuat dari profile yang sedang berjalan, termasuk bank Crystal-nya karena belum ada Commander lain yang bisa menggandakannya. Pemain baru mendapat Commander dari profile awal dengan cara yang sama. Migrasi ini dijalankan di bawah Web Lock, sehingga dua tab yang dibuka bersamaan hanya membuat satu Commander dengan satu bank. Save legacy yang rusak atau tidak lengkap tetap read-only dan tidak dimigrasikan saat launch; dialog Save tetap menawarkan **Lanjutkan progress saya** untuk menyimpan progress yang sedang berjalan ke Commander tanpa menulis `gridbound.v3`. Jika pencarian Commander di IndexedDB tidak menjawab dalam 1,5 detik, save legacy mentah dicadangkan lalu progress kembali ditulis ke `gridbound.v3` sampai Commander aktif, sehingga progress tidak pernah hanya hidup di RAM. Selama Commander tersimpan di IndexedDB, `gridbound.v3` tidak lagi ditulis: kunci itu menjadi sumber migrasi yang tidak berubah (preview **Save lama** dan **Buat salinan** membacanya ulang saat dibuka/dikonfirmasi, dan salinan dimulai dengan bank tantangan kosong). Jika IndexedDB tidak tersedia, Commander hanya hidup di sesi itu dan `gridbound.v3` mencerminkan progress Story serta bank-nya (profil Raid/Roguelike dengan Gold 0 tidak pernah ditulis ke sana), sehingga kunjungan berikutnya memigrasikannya lagi. Jika Commander gagal dibuat, progress tetap ditulis ke `gridbound.v3` dan aksi utama dialog Save adalah **Lanjutkan progress saya** dengan ringkasan chapter, gold, dan hero.

**Penyimpanan di ponsel.** Build web (bukan di dalam frame) meminta `navigator.storage.persist()` (tanpa pernah melempar error) saat Config atau File save dibuka dan setelah clear chapter pertama; frame itch.io tidak memintanya (penyimpanannya terpartisi). Config dan File save diawali satu baris yang menjelaskan nasib save: terlindungi di perangkat ini; browser bisa menghapusnya saat ruang ponsel hampir penuh; di iPhone dan iPad browser menghapus save situs yang tidak dibuka selama 7 hari (tab browser iPhone/iPad yang bukan aplikasi Layar Utama); atau, di itch.io, save ada di penyimpanan browser untuk itch.io. Setiap build menawarkan **Unduh cadangan save**, **Salin cadangan sebagai teks** (Config dan File save), dan **Tempel cadangan** (File save); URL unduhan hidup 60 detik (Safari iOS bertanya dulu sebelum mengunduh), dan hanya di dalam frame teks cadangan juga dibuka otomatis setelah unduhan. Unduhan atau salinan yang berhasil mencatat waktu cadangan terakhir per penampil (`gridbound.ui.backupAt`). Pengingat **Simpan salinan progresmu** (Salin cadangan, Unduh cadangan save, **Nanti saja** difokus) muncul pada kunjungan camp yang tidak memutar adegan atau kartu mode baru: setelah sebuah babak selesai (chapter 4/8/12/16), atau bila ada chapter yang selesai dan tidak ada cadangan maupun pengingat dalam 7 hari; paling banyak sekali sehari, tidak pernah di atas dialog atau adegan. Di File save, kolom nama dan **Ganti nama** adalah satu form (Enter/Selesai di keyboard mengganti nama), dan kata konfirmasi hapus diterima dalam huruf apa pun (`delete`), dengan tombolnya digulir di atas keyboard.

Di dialog Save, **Commander baru** adalah tombol sekunder; jika profile yang tampil sudah punya progress (chapter selesai, lebih dari tiga hero, atau gold berbeda dari gold awal), pemain harus mengonfirmasi bahwa Commander baru mulai dari nol, dan file yang sekarang tetap disimpan. Menghapus Commander terakhir langsung membuat Commander baru yang kosong. **Unduh cadangan save** selalu menghasilkan file JSON yang bisa diimpor: dokumen Commander, file recovery saat save masih tertunda, atau amplop `gridbound-legacy` berisi profile jika belum ada Commander; data kosong tidak pernah diunduh. **Impor save** menerima ketiga format itu dan membuat Commander baru dengan id baru (maksimum tiga file); bank Crystal hanya ikut bila tidak bisa terduplikasi, yaitu bila tidak ada Commander dari file yang sama (untuk amplop legacy: bila belum ada Commander sama sekali, yang dalam praktik hanya terjadi setelah migrasi gagal atau dengan save legacy yang terlindungi). Impor dokumen Commander ikut membawa encounter dan run aktifnya; jika file sumbernya sudah dihapus, bank-nya juga ikut, jadi ekspor → hapus → impor bisa mengembalikan bank ke nilai saat ekspor. Salinan tanpa bank diberi nama "<nama> (impor)" dan dialog impor menyebut file mana yang menyimpan Crystal dan relik. Saat Commander dibuat atau diimpor, dialog "Menyimpan…" tetap terbuka sampai file baru aktif dan menampilkan galat bila gagal. Dialog Save menyebut hasil setiap aksinya di bagian atas ("Nama diganti menjadi …", "Tersimpan di Slot n", "… dihapus") sebagai bagian dari tampilan barunya, sehingga tidak ada tombol yang bergeser setelahnya, dan galat di atas tombol-tombolnya (digulir ke dalam pandangan, tidak pernah di bawah tombol Tutup yang lengket). **Ganti nama** baru aktif setelah nama di kolom berbeda dari nama file. Slot kosong bertuliskan Kosong satu kali; slot terisi menulis statusnya dan waktu simpannya. **Lanjutkan terbaru** dinonaktifkan, dengan alasannya tepat di atasnya, bila mode itu belum punya pertarungan tersimpan. Adegan camp yang masih terutang oleh file yang baru diimpor (cadangan yang diambil setelah first clear) atau oleh file yang aktif setelah **Hapus** tidak pernah dimulai di bawah dialog yang terbuka: adegan menunggu dialog ditutup, lalu kartu fitur baru menyusul; dialog yang terbuka tidak pernah dibuat inert oleh adegan.

Slot Story menyimpan seluruh state Story, termasuk journey (bintang chapter, star chest yang sudah dibuka, Heroic clear, kedalaman Undercroft, run dungeon aktif) dan pilihan Story Journal; semua field itu bertahan saat dokumen dibaca ulang dan dinormalisasi. Slot manual (`manual-1..3`) adalah snapshot beku: hanya aksi save ke slot itu yang menulisnya. Raid dan Roguelike selalu dibangun dari slot Story `auto` dan hanya menulis kembali XP hero ke slot itu. Shared state menyimpan bank Crystal, challenge unlock, serta ledger, total kemenangan, receipt, dan floor Roguelike terdalam akun; setiap mode menggabungkan nilainya ke sana (maksimum per kunci, receipt digabung tanpa duplikat), sehingga statistik itu tidak pernah turun, juga setelah memuat slot manual lama. Camp selalu berjalan dalam mode Story, jadi Commander Profiles di camp menampilkan slot Story; run Raid atau Roguelike yang tertunda dilanjutkan dari gerbang mode itu (Continue latest atau Depart di tab Raid/Endless): layar persiapannya menampilkan kartu run yang ditunda dengan tombol Tinggalkan, kontrol persiapan dikunci, dan tombol berangkat bertuliskan run yang akan dilanjutkan ("Lanjutkan perburuan: … · Emas", "Lanjutkan · Lantai 2").

Run checkpoint menyimpan awal encounter beserta status yang dibutuhkan untuk melanjutkan. Checkpoint bukan save setiap frame dan manual save Challenge tidak boleh digunakan untuk memutar ulang payout lama. `CommanderSession` mengantrekan save, menandai revision stale saat tab lain menulis, dan melindungi slot dari overwrite/rewind yang tidak sah. Saat tab atau jendela lain menyimpan Commander yang sama, tab ini menjadi hanya-baca dan membuka dialog yang memblokir **Dibuka di tab lain** (tanpa ×; Escape dan Kembali tetap di dialog): **Muat ulang** (difokus; di iframe itch.io hanya game yang dimuat ulang), **Unduh cadangan save**, dan **Tetap lihat (hanya baca)**. Pertarungan dijeda selama dialog terbuka. Setiap aksi yang ditolak tab hanya-baca (Kembali, MENU, tombol kota, SERANG!, hasil pertarungan yang belum tersimpan, aksi dialog Save) membuka dialog itu lagi, bukan diam saja; adegan cerita yang sedang tampil diselesaikan dulu. Pertarungan tetap bisa ditinggalkan: Ⅱ Menu → **Tinggalkan pertarungan…** (juga ◀ Kembali di jendela siap) meminta konfirmasi **Keluar tanpa menyimpan** (progress pertarungan itu tidak disimpan dan tidak ada yang ditulis), lalu kota hanya-baca menampilkan file seperti terakhir disimpan tab ini. Di draft boon Ujian Lonceng, memilih boon atau lantai berikutnya di tab hanya-baca juga membuka dialog itu tanpa mengubah draft. Tombol Muat ulang mengabaikan tombol keyboard yang ditekan tepat saat dialog muncul (misalnya Spasi untuk jeda). Jika hasil pertarungan yang sudah tersimpan gagal ditampilkan, dialog **Hasil tidak bisa ditampilkan** menawarkan **Kembali ke …** (rute keberangkatan), jadi pertarungan tidak pernah terkunci. Save yang sedang berjalan (`dirty`) dibedakan dari save yang gagal (`failed`): status bar hanya menampilkan peringatan "belum tersimpan" setelah save gagal atau tab menjadi stale, sedangkan save yang berjalan memakai level `busy` yang tidak terlihat. Render ulang town yang tidak mengubah state (misalnya memilih tab hero) tidak membuat revision baru. Hasil ruangan Undercroft disimpan saat layar hasil muncul, sehingga reload tidak menghapus XP, pouch, atau kemenangan dan tidak membatalkan wipe; jika save gagal, dialog retry/ekspor yang sama dengan hasil pertempuran lain muncul. Depart/Continue untuk checkpoint menunggu save yang sedang berjalan, dan menampilkan dialog retry/ekspor jika save gagal; navigasi town yang tertahan oleh save gagal juga menampilkan dialog itu. Engine Phaser baru dimulai setelah Commander aktif (atau setelah 6 detik bila IndexedDB tidak menjawab), sehingga Commander sudah aktif sebelum pemain bisa bertindak; bagi pemain, engine dimuat setelah layar judul (atau saat keberangkatan pertama), sedangkan di bawah otomasi browser ia langsung dimulai. Jika IndexedDB tidak tersedia, repository menyediakan memory-only session (lihat cermin `gridbound.v3` di atas).

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