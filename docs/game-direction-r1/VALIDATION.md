# Validation scope — R1 documentation

**Dokumentasi only.** Angka tuning dan catalog dalam paket ini belum diuji sebagai gameplay. Ini bukan laporan QA dari game baru, approval release, atau pernyataan live Hostinger update.

## Pemeriksaan yang dikerjakan

- Audit source baseline `7aced0b`: v0.4 RPG/GUI yang ada dipisahkan dari usulan title/three-mode/economy/profile redesign. `src/`, `data/`, package/config, implemented GDD dan save pengguna tidak diubah.
- Lima sumber publik penerbit di Steam berhasil dibaca. Referensi + petikan disimpan dalam ledger; citation checker dijalankan. Search/extract service403 dan subset site timeout dicatat; tidak ada claimed hands-on playtest.
- Delapan source Mermaid telah benar-benar **diparse dan dirender** memakai renderer sementara di folder artifact, bukan hanya dihitung code fence-nya. File `.mmd` masuk paket; library renderer tidak menjadi dependency game.
- Empat SVG design boards original dan viewer HTML offline dites di isolated headless Chrome pada1440px dan390px. Navigation anchors, local-only resources, label bounds di SVG, dan no page-wide horizontal overflow diperiksa.
- Review gambar mendeteksi diagram mobile memerlukan pan affordance; ditambahkan instruksi swipe per board dan Back to index. Diagram lebar bisa dipan di viewer dokumen; **itu bukan rancangan untuk membuat game scroll horizontal**.
- ID katalog, jumlah chapter/hero/Ultra/relic/modifier, total stat budget, aritmetika reward/rounding, links lokal, code fences dan SVG structure diperiksa dengan validator dokumentasi. Hasil mesin final dilampirkan di `evidence/doc-validation.json` pada arsip.
- Full Markdown gabungan diekspor dari komponen sumber; DOCX merupakan convenience export dengan heading/tabel/diagram. Paket diperiksa ZIP integrity dan isi dokumen dibaca kembali. Word pagination final tidak disertifikasi tanpa Word/LibreOffice rendering.
- Git scope diperiksa agar hanya README/dokumentasi baru/handoff pointers berubah. Pembuatan draft awal tidak melakukan commit/push; user kemudian menyetujui D1–D8 dan meminta publikasi Git sebelum implementasi. [Approval record](APPROVAL-D1-D8.md) membatasi task publikasi ke dokumentasi saja.

## Ringkasan hasil validasi akhir

Pemeriksaan draft awal lulus untuk16file Markdown (termasuk GDD gabungan),8source Mermaid,4boardSVG,32Ultra seed records,12challenge relics,8Raid modifiers,8material,6recipe,9hero/18advanced/18third directions,7prologue beats dan16chapter. Matriks mencakup18request; decision log8default saat draft awal; milestone R0–R10. Ini hitungan **dokumen/record rancangan**, bukan implemented content baru. Approval record ditambahkan sesudah checkpoint tersebut; validasi publikasi memeriksa ulang komponen dan export terbaru.

Worked examples dihitung dari stat template aktual yang tertulis dan pipeline mitigation/cap/rounding yang sama; seluruh template basic berjumlah60points. Consistency checks tidak menggantikan simulator/human balancing.

## Koreksi konsistensi saat authoring

- Story cap party:3prologue,4setelahCh02,5setelahCh03,6setelahCh04; roster9 tetap, tidak diam-diam berubah antara GDD dan chapter plan.
- Trial teaser Ch02 dibedakan dari actual signature Ultra gate setelah advancement/progress. Main plot tidak mewajibkan Challenge currency.
- Recipe Glass/Sap/Bell dipasang setelah dungeon region yang menyediakan material terbuka; basic support gear tersedia lebih awal.
- Rounding damage memakai satu definisi half-up untuk nonnegative output; economy payout memakai floor sesuai rule-nya. Tidak mencampur formula prototype yang sudah diganti.
- Ultra starter5 + signature18 + capstone9 =32; 12challenge relics dan8Raid modifiers punya draft record, sedangkan36promotion actions masih memerlukan final coefficients/effect specs pada R3/R7.
- Target content budget tidak sama dengan authored examples: contoh event Rogue3 dan dungeon3; full budget masing-masing12 baru future authoring.

## Belum diuji / bukan deliverable implementasi

- Tidak ada title baru, material farming, shop/events Rogue, Raid normalized builder, Commander saves,5stats atau Ultra catalog yang dijalankan di game.
- Tidak ada klaim balance/fun/pacing/production quality dari formula, screenshots dokumen atau referensi store.
- Physical device, final pixel/icon atlas, migration behavior, browser game QA, world-map usability dan accessibility runtime memerlukan implementation gate berikutnya.
- Diagram skill tree ilustratif tidak menggantikan semantic/layout tests pada runtime. Icon12motif adalah concept SVG, bukan32Ultra art final.
- D1–D8 kini APPROVED ([record](APPROVAL-D1-D8.md)); task ini baru menyimpan dokumentasi ke Git. Detail tuning, execution start, device/balance evidence dan release authorization belum dianggap disetujui oleh keputusan desain.

Untuk urutan eksekusi baca [R0–R10](NEXT-PRODUCTION-R1.md). Jangan menandai milestone DONE karena dokumen ini ada.
