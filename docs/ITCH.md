# Gridbound di itch.io

Panduan lengkap untuk menerbitkan **Gridbound: Ashes of the Bell** sebagai game HTML5 yang dimainkan langsung di browser
pada itch.io. Gridbound adalah bundle statis (HTML, JavaScript, CSS, font) tanpa server, jadi cocok untuk proyek
**Kind of project: HTML** di itch.io. Semua bahan sudah disiapkan di repo ini: kamu tinggal membuat akun dan halaman
proyek, lalu meng-upload satu file ZIP (atau menjalankan satu perintah/workflow).

Nama tombol dan field itch.io ditulis dalam bahasa Inggris persis seperti di halaman itch.io. Tampilan itch.io bisa sedikit
berubah dari waktu ke waktu; kalau sebuah nama tidak persis sama, cari field dengan arti yang sama.

> Status: panduan ini belum pernah dijalankan pada akun itch.io sungguhan (belum ada akun saat disiapkan). Pengecekan yang
> sudah dilakukan hanya lokal: ZIP diperiksa oleh `scripts/package-itch.py`, dan `npm run test:itch` memutar ZIP itu di
> iframe lintas-origin yang meniru itch.io. Langkah 3 (tes draft) wajib dilakukan sebelum halaman dibuat publik.

## Isi persiapan

| File | Isi |
| --- | --- |
| `npm run package:itch` → `artifacts/Gridbound-itch-<versi>.zip` (+ `.sha256`) | ZIP untuk di-upload. Dibuat dari `dist/` oleh `scripts/package-itch.py`, yang memastikan `index.html` ada di root ZIP, semua URL relatif, tidak ada host luar, kurang dari 1000 file, dan nama file cocok huruf besar/kecilnya. |
| `docs/itch/cover.png` | Cover image 630×500. |
| `docs/itch/banner.png` | Banner halaman 960×240 (opsional, lewat Edit theme). |
| `docs/itch/screenshots/01-title.png` … `05-undercroft.png` | 5 screenshot bahasa Inggris, potret ponsel (1080×1920). |
| `docs/itch/screenshots/id/…` | 5 screenshot yang sama dalam Bahasa Indonesia. |
| `docs/itch/page-en.md`, `docs/itch/page-id.md` | Teks halaman siap tempel: judul, tagline, deskripsi, kontrol, catatan save, kredit, saran metadata. |
| `npm run itch:assets` (`scripts/itch-assets.mjs` + `scripts/itch/cover.html`, `cover.js`) | Membuat ulang semua gambar di atas dari game itu sendiri. |
| `.github/workflows/itch-publish.yml` | Publish manual ke itch.io lewat butler (lihat bagian GitHub Actions). |
| `npm run test:itch` (`scripts/itch-smoke.mjs`) | Uji lokal opsional: ZIP diputar di iframe dari origin lain dengan allow list ala itch.io. |

## Langkah 1 · Build ZIP

Butuh Node.js 22.12+ dan Python 3.9+.

```sh
npm ci
npm run package:itch
```

Hasilnya `artifacts/Gridbound-itch-0.4.0.zip` (angka versi diambil dari `"version"` di `package.json`) beserta file
`.sha256`. Jangan membongkar lalu mem-ZIP ulang dengan tangan: ZIP ini sudah diperiksa, dan `index.html` harus tetap di root
ZIP (bukan di dalam folder).

Opsional, uji ZIP itu di iframe lintas-origin seperti di itch.io (butuh Chrome/Chromium):

```sh
CHROME_PATH=/path/ke/chrome npm run test:itch
```

Untuk rilis berikutnya, naikkan dulu `"version"` di `package.json` (misalnya `0.4.1`), supaya nama ZIP dan nomor versi di
itch.io berbeda dari rilis sebelumnya.

## Langkah 2 · Buat project di itch.io

1. Buat akun / login di itch.io, lalu buka **Dashboard** → **Create new project**.
2. Isi field berikut (teks lengkapnya ada di `docs/itch/page-en.md`):

| Field | Isi |
| --- | --- |
| Title | `Gridbound: Ashes of the Bell` |
| Project URL | `https://<username>.itch.io/<slug>` — pilih slug sendiri (saran: `gridbound`). Slug ini juga nilai `ITCH_GAME` untuk butler/GitHub Actions. |
| Short description or tagline | Tagline dari `page-en.md` (110 karakter). |
| Classification | Games |
| Kind of project | **HTML** |
| Release status | In development |
| Pricing | Keputusan kamu (No payments / Free with donations / Paid). |
| Uploads | **Upload files** → pilih `artifacts/Gridbound-itch-<versi>.zip` → centang **This file will be played in the browser**. |

3. Bagian **Embed options** (muncul setelah ZIP di-upload dan ditandai played in the browser):

| Opsi | Pilihan | Alasan |
| --- | --- | --- |
| Embed options | Embed in page | Game tampil langsung di halaman. |
| Viewport dimensions | **540 × 900** | Ukuran yang direkomendasikan (lolos `npm run test:itch` secara lokal; konfirmasi di halaman draft). Game adalah satu kolom potret (lebar maks. 600 px) yang menyesuaikan diri dengan ukuran frame. Kalau tinggi 900 px tidak muat di layar laptop: selama frame terpotong oleh jendela, roda mouse menggulir halaman itch.io supaya game bisa dibawa ke layar, dan tombol fullscreen itch.io tetap ada. Alternatif yang lebih pendek: 480 × 760 (sudah dicek lokal: kota dan pertarungan utuh, arena sedikit mengecil). Embed lanskap seperti 960 × 600 juga berjalan (pertarungan pindah ke tata letak dua kolom), tetapi peta kota jadi sempit; pakai hanya sebagai cadangan. |
| Mobile friendly | **Ya**, Orientation: **Portrait** | Seluruh game dirancang potret dan bisa dimainkan dengan sentuhan. |
| Automatically start on page load | **Tidak** (click to play) | Halaman lebih ringan untuk pengunjung yang belum bermain; game baru dimuat saat pemain menekan Run game. |
| Fullscreen button | **Ya** | Tombol layar penuh dari itch.io. Di dalam frame, game juga punya opsi Pengaturan → Layar penuh sendiri (Config → Fullscreen dalam bahasa Inggris), yang hanya muncul kalau browser dan frame mengizinkan. |
| Enable scrollbars | **Tidak** | Halaman game tidak menggulir; panel di dalam game punya scroll sendiri. |
| SharedArrayBuffer support | **Tidak** | Tidak dipakai oleh game. |

4. Bagian **Details**:
   - **Description**: buka `docs/itch/page-en.md` dalam tampilan rendered (misalnya di GitHub), blok bagian "Description",
     salin, lalu tempel ke editor itch.io; format judul, huruf tebal, daftar, dan tabel ikut terbawa. Editor itch.io tidak
     membaca Markdown mentah. Kalau ingin halaman dua bahasa, tempel bagian "Deskripsi" dari `docs/itch/page-id.md` di
     bawahnya dengan judul "Bahasa Indonesia". Isi `[your name or studio]` di bagian Credits.
   - **Genre**: Role Playing.
   - **Tags** (maks. 10): `tactical-rpg`, `pixel-art`, `jrpg`, `roguelite`, `boss-battle`, `dungeon-crawler`, `fantasy`,
     `story-rich`, `singleplayer`, `phaser`. itch.io menyarankan tag yang sudah ada saat kamu mengetik; pilih saran yang
     paling dekat.
   - **AI generation disclosure**: kalau itch.io menanyakan apakah proyek memuat konten buatan AI, jawab sesuai kenyataan
     (keputusan kamu sebagai pemilik).
   - Metadata lain: **Languages** English + Indonesian; **Inputs** Mouse, Keyboard, Touchscreen; **Accessibility** hanya
     opsi yang benar (Interactive tutorial: Chapter 1 punya tutorial langkah demi langkah); **Made with** Phaser;
     **Multiplayer** tidak ada.
   - **Community**: Comments (opsional, keputusan kamu).
   - **Visibility & access**: **Draft** dulu sampai Langkah 3 selesai.
5. **Cover image**: upload `docs/itch/cover.png` (630×500, ukuran yang direkomendasikan itch.io).
6. **Screenshots**: upload `docs/itch/screenshots/01-title.png` sampai `05-undercroft.png` berurutan (atau set
   `screenshots/id/` kalau target utamanya pemain Indonesia).
7. Klik **Save** lalu **View page**. Di halaman game, **Edit theme** → upload `docs/itch/banner.png` sebagai banner
   (opsional). Warna yang cocok dengan palet game: latar `#08110f`, latar kedua `#12231e`, teks `#eee8d2`, link dan tombol
   `#e5c687`.

## Langkah 3 · Tes halaman draft sebelum publish

Halaman Draft hanya bisa dilihat olehmu. Tes di desktop (Chrome atau Edge, Firefox, Safari kalau ada) dan di ponsel
(Chrome Android, Safari iPhone):

- [ ] Run game → layar judul muncul (tidak ada layar kosong atau error).
- [ ] Ganti bahasa English/Indonesia di layar judul: game memuat ulang di dalam frame dan bahasanya berganti.
- [ ] Mulai Chapter 1: pertarungan berjalan, tutorial muncul, suara terdengar setelah ketukan/klik pertama.
- [ ] Desktop: klik arena sekali, lalu G, H, R, dan Spasi bekerja, dan halaman itch.io tidak ikut bergulir.
- [ ] Desktop (Chrome, lalu Safari dan Firefox): gulir halaman itch.io sampai game setengah keluar layar, arahkan mouse ke
      game, lalu putar roda mouse → halaman itch.io harus ikut bergulir (supaya game bisa dibawa kembali ke layar). Saat game
      utuh di layar, roda mouse di atas game tidak menggulir halaman. Ini baru dicek di Chromium headless; kalau Safari atau
      Firefox tidak menggulir halaman saat game terpotong, pemain masih bisa menggulir dengan mouse di luar frame.
- [ ] Layar penuh: tombol fullscreen itch.io (desktop) dan Pengaturan → Layar penuh (Config → Fullscreen) di game kalau
      muncul. Safari di iPhone tidak mendukung fullscreen elemen, jadi opsi game itu memang tidak muncul di sana. Setelah
      tombol fullscreen itch.io dipakai, opsi Layar penuh di game tetap tampil tidak tercentang (yang layar penuh adalah
      halaman itch.io, bukan game); pastikan mencentangnya tidak merusak apa pun dan Esc keluar dengan normal.
- [ ] Menangkan satu pertarungan, muat ulang halaman itch.io → progres masih ada.
- [ ] Pengaturan → Unduh cadangan save: file terunduh, dan teks cadangan juga tampil untuk disalin. Lalu Muat Game (atau
      MENU → Save) → Tempel cadangan untuk memastikan cadangan bisa dipulihkan (jadi Commander file baru).
- [ ] Ponsel: orientasi potret, semua tombol terjangkau, kota dan pertarungan tidak terpotong pada ukuran embed yang dipilih.
- [ ] Ponsel: usap game ke atas dan ke bawah (peta kota, bilah HUD, panel ancaman dan Guard saat bertarung, ujung daftar
      Quest) → halaman itch.io tidak bergulir dan tidak dimuat ulang (tarik-untuk-muat-ulang di Android), sedangkan daftar
      Quest sendiri tetap bisa digulir. Ini baru dicek di Chromium headless dengan sentuhan emulasi (`npm run test:itch`).
- [ ] Cek ukuran embed 540 × 900 di laptop; ubah kalau perlu (lihat Langkah 2).

Kalau semua lolos: **Edit game** → **Visibility & access** → **Public** → Save.

## Cara save bekerja di itch.io

- itch.io menjalankan game di dalam `<iframe>` dari domain CDN milik itch.io (bukan `itch.io` itu sendiri, dan dipakai
  bersama banyak game lain), di bawah path per upload. Bagi browser, penyimpanan game adalah penyimpanan "pihak ketiga".
- Browser modern (Chrome, Firefox, Safari) memisahkan penyimpanan pihak ketiga per situs utama. Akibatnya save di halaman
  itch.io terpisah dari save game yang sama di situs lain (misalnya versi Hostinger), dari browser lain, dan dari perangkat
  lain. Save tidak pindah otomatis antar-tempat; pindahkan dengan cadangan (Unduh cadangan save → Impor save / Tempel
  cadangan).
- Game menyimpan di IndexedDB `gridbound.commanders.r1` dan kunci localStorage berawalan `gridbound.` (sudah ber-namespace,
  penting karena origin CDN itu dipakai bersama game lain).
- Update versi (ZIP baru atau butler) tetap memakai origin CDN yang sama, jadi save seharusnya tetap ada. Cek sekali setelah
  update pertama: main sebentar, upload versi baru, lalu pastikan progres masih ada.
- Save bisa hilang kalau: jendela privat/incognito ditutup; pemain menghapus data situs/cookie; browser membersihkan
  penyimpanan (Safari dikenal lebih ketat pada penyimpanan pihak ketiga dan situs yang lama tidak dikunjungi); browser
  hanya menyimpan penyimpanan pihak ketiga selama sesi (misalnya pengaturan bawaan Brave, yang bisa menghapusnya saat tab
  ditutup); atau game lain di origin CDN yang sama menghapus localStorage bersama. Kalau IndexedDB diblokir, game tetap bisa dimainkan dan
  bilah status menampilkan peringatan ("Browser storage limited — …" atau, kalau semua penyimpanan diblokir, "Session only —
  export before closing this tab").
- Karena itu deskripsi halaman sudah menganjurkan pemain mengunduh cadangan sesekali. Di dalam frame, sebagian browser
  memblokir unduhan atau akses clipboard; karena itu di dalam frame (seperti di itch.io) game selalu juga menampilkan
  cadangan sebagai teks yang bisa disalin manual, dan Muat Game (atau MENU → Save) → Tempel cadangan memulihkannya. Tombol
  Tempel cadangan hanya ada saat game berjalan di dalam frame; di halaman biasa cukup Impor save.

## Update versi

**Cara manual:**

1. Naikkan `"version"` di `package.json`, lalu `npm run package:itch`.
2. itch.io → **Edit game** → **Uploads** → **Upload files** → pilih ZIP baru → centang **This file will be played in the
   browser**.
3. Hapus ZIP lama (atau pastikan hanya ZIP baru yang dimainkan di browser), cek ulang Embed options, lalu **Save**.
4. Buka halaman game dan main sebentar (save lama harus tetap ada). Opsional: tulis devlog.

**Dengan butler** (lihat bagian berikut): satu perintah `butler push` mengganti build di channel yang sama; centang
"played in the browser" tetap terpasang.

## butler (opsional)

butler adalah alat command line resmi itch.io untuk upload.

1. Unduh butler: https://itch.io/docs/butler/ — atau langsung zip dari broth, misalnya Linux:
   `curl -L -o butler.zip https://broth.itch.ovh/butler/linux-amd64/LATEST/archive/default && unzip butler.zip`
   (Windows: `windows-amd64`, macOS: `darwin-amd64` di URL yang sama).
2. Login: `butler login` (membuka browser), atau set environment variable `BUTLER_API_KEY` dengan API key dari
   https://itch.io/user/settings/api-keys.
3. Push ZIP yang sudah diperiksa:

   ```sh
   npm run package:itch
   butler push artifacts/Gridbound-itch-0.4.0.zip <username>/<slug>:html5 --userversion 0.4.0
   butler status <username>/<slug>:html5
   ```

4. Setelah push **pertama**, buka **Edit game** di itch.io, centang **This file will be played in the browser** pada upload
   channel `html5`, atur Embed options seperti Langkah 2, lalu Save. Push berikutnya memakai pengaturan itu.

API key memberi akses ke akunmu: jangan pernah menaruhnya di repo, dan cabut (revoke) di halaman API keys kalau bocor.

## GitHub Actions

`.github/workflows/itch-publish.yml` mem-publish ke itch.io lewat butler. Workflow ini **hanya berjalan manual**
(`workflow_dispatch`), tidak pernah otomatis saat push.

Persiapan sekali saja di GitHub → **Settings** → **Secrets and variables** → **Actions**:

- Tab **Secrets** → **New repository secret**: `BUTLER_API_KEY` = API key dari https://itch.io/user/settings/api-keys.
- Tab **Variables** → **New repository variable**: `ITCH_USER` = username itch.io (seperti di URL), `ITCH_GAME` = slug
  proyek.

Menjalankan: **Actions** → **Publish to itch.io** → **Run workflow** → pilih branch (sebaiknya `main` setelah CI hijau) →
channel (default `html5`). Workflow memeriksa secret/variable (gagal dengan pesan jelas kalau belum diisi), lalu menjalankan
`npm ci`, `npm test`, `npm run package:itch`, mengunduh butler dari broth, dan menjalankan
`butler push artifacts/Gridbound-itch-<versi>.zip $ITCH_USER/$ITCH_GAME:<channel> --userversion <versi package.json>`.
ZIP-nya juga disimpan sebagai artifact workflow `gridbound-itch-upload`.

Proyeknya harus sudah dibuat di itch.io dulu (Langkah 2). Setelah push pertama ke channel baru, centang
**This file will be played in the browser** di Edit game (Langkah butler nomor 4).

## Membuat ulang gambar toko

Gambar di `docs/itch/` dibuat oleh game itu sendiri: cover dan banner digambar dari modul art game (`src/art/`) dengan font
dan palet game, screenshot diambil dari save contoh di Babak III (9 chapter selesai, 13 hero, job lanjutan, perlengkapan,
semua mode sudah dikunjungi) pada ukuran ponsel 540×960 CSS px × 2.

```sh
CHROME_PATH=/path/ke/chrome npm run itch:assets                                 # cover, banner, screenshot EN + ID
ITCH_ONLY=shots ITCH_LANGS=en CHROME_PATH=/path/ke/chrome npm run itch:assets   # hanya screenshot bahasa Inggris
```

Skrip menyalakan Vite dev server pribadi (port 5187, `ITCH_PORT` untuk menggantinya) dan Chrome headless dengan profil
sementara, jadi save milikmu tidak tersentuh. Opsi lain: `ITCH_OUT` (folder hasil), `ITCH_DPR` (rasio piksel screenshot),
`GRIDBOUND_URL` (pakai dev server yang sudah jalan). Screenshot pertarungan diambil dari pertarungan real-time, jadi
detailnya sedikit berbeda setiap kali dijalankan. Setelah membuat ulang, lihat semua gambarnya sebelum di-upload.

## Keputusan pemilik

- **Harga**: gratis, gratis dengan donasi, atau berbayar. Kalau berbayar: Phaser (MIT) dan font (SIL OFL 1.1) boleh dipakai
  komersial; GSAP memakai lisensi Standard "no charge", baca sekali di https://gsap.com/standard-license.
- **Slug URL** proyek (sekaligus nilai `ITCH_GAME`).
- **Screenshot** bahasa Inggris, Indonesia, atau campuran.
- **Deskripsi** satu bahasa atau dua bahasa (lihat Langkah 2).
- **Ukuran embed** final (rekomendasi 540 × 900, alternatif 480 × 760; konfirmasi di halaman draft).
- **AI generation disclosure** dan nama di bagian Credits.
- Komentar on/off, banner/tema, dan kapan halaman dibuat Public.
