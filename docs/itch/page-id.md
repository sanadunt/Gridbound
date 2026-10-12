# Halaman toko itch.io: teks Bahasa Indonesia

Teks siap tempel untuk halaman proyek itch.io, versi Bahasa Indonesia dari [page-en.md](page-en.md) (isi dan angkanya sama,
semuanya sudah dicek terhadap kode v0.4 di `src/`). Istilah mengikuti glosarium game (`src/i18n/glossary.ts`): Babak,
Ramuan, Fajar Sembilan, pertarungan, petak, ketuk; skill/party/cooldown/run/lane tetap bahasa Inggris, nama chapter dan
babak tetap bahasa Inggris.

Halaman itch.io hanya punya satu kolom deskripsi. Saran: pakai deskripsi bahasa Inggris sebagai isi utama lalu tempel bagian
**Deskripsi** di bawah ini di bawahnya dengan judul "Bahasa Indonesia", atau pakai teks ini untuk devlog/pengumuman
berbahasa Indonesia. Editor deskripsi itch.io tidak membaca Markdown: buka file ini dalam tampilan rendered (misalnya di
GitHub), blok bagian deskripsi, salin, lalu tempel; judul, huruf tebal, dan daftar ikut terbawa.

---

## Judul

Gridbound: Ashes of the Bell

(Nama game tetap bahasa Inggris; subjudul di layar judul versi Indonesia adalah «Abu Sang Lonceng».)

## Deskripsi singkat / tagline

(112 karakter.)

> RPG taktis pixel-art di browser: 15 hero di grid 3×3, boss yang memberi aba-aba serangan, dan cerita 16 chapter.

---

## Deskripsi

**Lonceng Emberhollow berbunyi sebagai peringatan.** Para pengintai hilang di Ashwood Trail, sebuah segel pecah di
reruntuhan, dan sesuatu di bawah hutan mulai terbangun. Kumpulkan para Bellkeeper, pertahankan grid 3×3, dan ikuti
ceritanya dari jalur hutan yang terbakar, kota yang melupakan anak-anaknya, arsip yang menulis sejarah untuk masa depan,
sampai fajar yang belum pernah ditulis siapa pun.

Gridbound adalah RPG taktis pixel-art dengan pertarungan boss real-time, dibuat untuk ponsel maupun desktop. Seluruh game
berjalan di browser, dalam Bahasa Indonesia atau bahasa Inggris.

### Cara bertarung

Party-mu berdiri di grid 3×3 menghadapi boss. Gauge skill setiap hero terisi sendiri: **ketuk hero untuk mempercepatnya**,
dan gantian antar-hero saat mereka mulai lelah. Boss selalu memberi aba-aba sebelum menyerang, dan setiap serangan ada
jawabannya:

- Serangan **TANAH** menandai petak: seret hero ke petak yang aman.
- Serangan **DITANDAI** mengikuti targetnya: beri shield, heal, atau Guard.
- Ritual **SELURUH GRID** mengenai semua orang: tekan **Guard** tepat waktu, atau putus dengan skill interrupt.

Pecahkan zirah boss, simpan Ramuan untuk saat paling genting, dan lepaskan **Fajar Sembilan**, serangan seluruh party, saat
Resolve penuh. Pertarungan bisa dijeda kapan saja.

### Fitur

- **Cerita 16 chapter dalam empat babak**: 76 pertarungan, adegan rekrut saat hero bergabung, tiga pilihan cerita yang
  mengubah epilog, finale dengan kalimat penutup untuk tiap hero, dan Jurnal untuk memutar ulang semuanya.
- **15 hero, 9 kelas**: Warrior, Rogue, Archer, Healer, Wizard, Bard, Hexer, Monk, dan Engineer. Turunkan sampai delapan
  hero ke grid dan atur formasi petak demi petak.
- **Job, skill, dan build**: setiap kelas bercabang ke dua job lanjutan dan dua job ketiga (36 job, job ketiga punya perk
  unik), 72 skill dengan dua terpasang sekaligus, pohon talent dengan keystone, 54 perlengkapan dalam enam set, dan level
  hero 1 sampai 40.
- **Undercroft**: dungeon roguelite di bawah Menara Lonceng. Delapan kedalaman, peta ruangan baru di setiap penurunan
  (pertarungan, elit, peristiwa, harta, kemah, dan penjaga kedalaman), luka dan Ramuan terbawa dari ruang ke ruang, dan
  kantong yang aman bila kamu naik keluar atau mengalahkan penjaga, tetapi hilang bila party tumbang. Materialnya dipakai
  untuk memperkuat perlengkapan.
- **Replay Heroik**: mainkan ulang chapter yang sudah selesai dengan tingkat lebih sulit dan hanya satu Ramuan, demi hadiah
  Heroik sekali saja.
- **Bintang chapter**: selesaikan chapter, selesai dengan semua hero berdiri, kalahkan boss dalam 80 detik atau kurang.
  Bintang membuka peti bintang.
- **Raid**: buru 18 mangsa setelah kamu bertemu mereka, dengan sampai enam hero dan kelas apa pun di slot mana pun.
  Pilih kontrak Perunggu, Perak, atau Emas dan tambahkan pakta untuk tantangan ekstra.
- **Ujian Lonceng**: pendakian roguelike lantai demi lantai, memilih satu boon setiap kali menang. Kumpulkan Crystal dan
  belanjakan untuk relik dan Bell Tonic.
- **Kota untuk pulang**: Emberhollow adalah desa pixel-art dengan papan Quest (30 quest), Bestiary berisi 18 keluarga
  musuh masing-masing dengan empat varian, Aula Latihan, dan Pedagang.
- **Bahasa Indonesia dan bahasa Inggris**, bisa diganti dari layar judul.
- **Main langsung di browser tanpa instalasi**: tanpa akun, dan game ini sendiri tidak melakukan permintaan jaringan setelah
  selesai dimuat. Semua gambar adalah pixel art prosedural dan semua suara disintesis di browser.

### Kontrol

Mouse atau sentuh:

- **Ketuk hero**: mempercepat gauge skill hero itu.
- **Seret hero**: pindah ke petak lain (Status → Pindahkan hero melakukan hal yang sama tanpa menyeret).
- **Chip skill di kartu hero**: ganti ke skill terpasang yang lain.
- **Lane I · II · III** (di atas grid, saat ada minion): arahkan skill jarak jauh ke lane minion; ketuk lane yang sama lagi
  untuk kembali mengincar boss.
- Tombol **Guard**, **Ramuan**, dan **Fajar Sembilan** di bawah grid, tombol **jeda** di kanan atas.

Keyboard (klik game sekali supaya keyboard masuk ke game):

| Tombol | Aksi |
| --- | --- |
| 1–9 | Ketuk hero di petak itu |
| Q / E | Ganti skill hero yang dipilih |
| G | Guard |
| H | Ramuan |
| R | Fajar Sembilan |
| B | Boon (Ujian Lonceng) |
| Spasi | Jeda |
| Enter | Mulai pertarungan dari layar siap |
| Esc | Batalkan pindah, tutup pemilih skill atau dialog |
| ↑ / ↓, Enter | Menu judul |

### Save-mu

- Progres tersimpan otomatis di **penyimpanan browser ini** untuk itch.io. Save tidak ikut pindah ke browser atau perangkat
  lain, dan jendela privat/incognito melupakannya saat jendela ditutup. Sebagian browser hanya menyimpan data game yang
  tertanam sampai tab ditutup (misalnya pengaturan bawaan Brave): di sana, unduh cadangan sebelum pergi.
- Menghapus data situs, atau pembersihan penyimpanan oleh browser, ikut menghapus save. **Unduh cadangan sesekali**:
  Pengaturan → Unduh cadangan save. Game juga menampilkan cadangan itu sebagai teks untuk disalin, kalau browser memblokir
  unduhan dari dalam halaman.
- Pulihkan cadangan dengan Impor save atau Tempel cadangan, dari Muat Game di layar judul atau dari MENU → Save
  (Penginapan di kota juga membukanya).

### Aksesibilitas

- Mematikan Pengaturan → Animasi penuh akan menghilangkan kilatan, guncangan layar, dan hit-stop; game juga mengikuti
  pengaturan "kurangi gerakan" di perangkatmu.
- Peristiwa pertarungan (serangan yang datang, hero tumbang atau bangkit lagi, fase boss, menang dan kalah) diumumkan ke
  pembaca layar.
- Ketuk hero, ganti skill, Guard, Ramuan, Fajar Sembilan, dan jeda punya tombol keyboard, dan hero bisa dipindah dengan
  tombol (Status → Pindahkan hero) tanpa menyeret.
- Chapter 1 mengajarkan dasar-dasarnya selangkah demi selangkah: mengetuk, menghindar, Guard, dan serangan pamungkas (bisa
  dilewati; Pengaturan → Tips pertarungan mematikannya).

### Kredit

- Game: **[nama kamu atau studio]**
- Dibuat dengan [Phaser 3](https://phaser.io) (MIT) dan [GSAP](https://gsap.com) (lisensi Standard "no charge").
- Font: Press Start 2P (CodeMan38) dan Space Grotesk (Florian Karsten), keduanya SIL Open Font License 1.1.
- Pixel art dan suara dibuat oleh kode; tidak ada file gambar atau audio pihak ketiga.

---

## Saran metadata (pemilik yang memutuskan)

Nilai field itch.io ditulis persis seperti di halaman edit (bahasa Inggris).

| Field itch.io | Saran |
| --- | --- |
| Kind of project | HTML |
| Release status | In development (v0.4) |
| Pricing | Keputusan pemilik (No payments, Free with donations, atau Paid) |
| Genre | Role Playing |
| Tags (maks. 10) | `tactical-rpg`, `pixel-art`, `jrpg`, `roguelite`, `boss-battle`, `dungeon-crawler`, `fantasy`, `story-rich`, `singleplayer`, `phaser` |
| Made with | Phaser |
| Languages | English, Indonesian |
| Inputs | Mouse, Keyboard, Touchscreen |
| Accessibility | Interactive tutorial (hanya opsi yang benar; lihat bagian Aksesibilitas) |
| Multiplayer | Tidak ada (single player) |
| Cover image | `docs/itch/cover.png` (630×500) |
| Screenshots | `docs/itch/screenshots/id/01-title.png` … `05-undercroft.png` (set bahasa Inggris di `screenshots/`) |
| Banner (Edit theme) | `docs/itch/banner.png` (960×240, opsional) |
