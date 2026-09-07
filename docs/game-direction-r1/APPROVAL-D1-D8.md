# Approval record — D1–D8

**Status: APPROVED DESIGN DECISIONS / DOCUMENTATION ONLY. Implementation has not started.**

- Decision owner: user / project owner, melalui percakapan langsung dengan Astra.
- Recorded: **7 September 2026, 14:06 WIB (UTC+07:00)**. Ini waktu pencatatan, bukan klaim digital signature atau waktu pesan yang terverifikasi terpisah.
- Runtime baseline: `main` / `7aced0b` / app `0.4.0`.
- Design revision: **Game Direction R1**, bukan versi aplikasi.
- Record scope: delapan keputusan di bawah, sesuai tabel D1–D8 yang dibaca user sebelum memberikan approval.

## Pernyataan user

> Oke aku sudah setuju dari D1-D8, tapi kita dokumentasikannya itu masukin ke Git dulu yaa sebelum dieksekusi

Artinya: **D1–D8 disetujui; catat dan simpan dokumentasinya di Git terlebih dahulu.** Task sekarang dibatasi pada dokumentasi dan publikasi Git. Jangan menyamakan approval desain dengan perintah mulai coding, menjalankan migrasi save pemain, atau merilis fitur R1.

## Keputusan yang disetujui

| ID | Keputusan disetujui | Status |
|---|---|---|
| D1 | Crystal Raid + Rogue disimpan pada satu Commander profile; Story terisolasi | APPROVED |
| D2 | Crystal bank untuk meta-unlock; Crystal perjalanan untuk shop selama run; bank tidak boleh dibawa masuk | APPROVED |
| D3 | Story roster 9, aktif 3 pada prologue lalu maksimum 6; bench mendapat catch-up | APPROVED |
| D4 | Rogue tepat 3 recruit custom, job bebas dari 5 basic termasuk duplikat; job upgrade diperoleh di run | APPROVED |
| D5 | Rewarded Raid memakai boss/modifier tervalidasi; raw sliders masuk Sandbox tanpa Crystal | APPROVED |
| D6 | 3 Commander profiles; tiap mode 3 manual slot + 1 auto; satu run aktif per Challenge mode | APPROVED |
| D7 | Story utamanya linear dengan pilihan konsekuensi kecil; satu ending utama dan epilogue flags | APPROVED |
| D8 | Full target: 9 hero unik, 18 advanced + 18 third paths, 32 Ultra definitions; slice jauh lebih kecil | APPROVED |

Tabel ini merekam keputusan pada saat approval. [Index desain](README.md) menyediakan alasan masing-masing; [target GDD](GDD-TARGET.md), [economy](ECONOMY.md), [profiles](SAVE-PROFILES.md) dan [production gates](NEXT-PRODUCTION-R1.md) menjabarkan konsekuensinya. Bila dokumen berikutnya mengubah arti D1–D8, buat decision amendment baru dan minta approval—jangan menulis ulang persetujuan ini seolah user pernah menyetujui keputusan lain.

## Batas otorisasi saat pencatatan

| Tindakan | Status |
|---|---|
| Catat D1–D8, sinkronkan komponen dan GDD gabungan | Diizinkan sekarang |
| Commit dan push dokumentasi R1 ke GitHub `main` | Diizinkan sekarang; melanjutkan arahan user untuk memakai `main` |
| Periksa link/katalog/export/diff dan CI baseline | Diizinkan untuk memverifikasi dokumentasi/repository |
| Coding fitur R1, perubahan schema/runtime/package/config | **Tidak dikerjakan dalam task ini** |
| Migrasi save pemain atau akses akun Hostinger | **Tidak diizinkan oleh approval dokumentasi ini** |
| Deploy/production sign-off fitur R1 | Gate terpisah setelah implementasi dan QA, belum diberikan |

Push ke `main` dapat memicu CI atau auto-build Hostinger yang sudah dikonfigurasi. Tidak ada perintah deploy manual, perubahan konfigurasi hosting, atau gameplay baru dalam commit dokumentasi ini. Keberhasilan push/CI tidak membuktikan keadaan website live.

## Status milestone dan hal yang belum dikunci

- **R0 / keputusan produk D1–D8: APPROVED**, dibuktikan oleh pesan user di atas, bukan oleh tanda tangan yang dibuat agent.
- R0 execution-preparation: belum dijalankan. Jadwal/budget/perangkat referensi, slice kerja pertama dan detail risiko teknis harus dibatasi saat ada instruksi eksekusi; approval ini tidak menciptakan deadline atau biaya.
- **R1–R10: NOT STARTED** untuk implementasi target. Daftar pekerjaan, diagram dan katalog bukan bukti feature completion.
- Harga Crystal, formula stat, coefficient skill/Ultra, angka encounter dan jadwal unlock rinci tetap **seed tuning**. D8 menyetujui target arah/jumlah, bukan mengesahkan balance atau menjamin semuanya masuk rilis pertama.
- Persetujuan D3 menentukan roster/active cap; mapping migrasi, urutan anggota aktif dan perlindungan hero bench masih perlu prototype dan preview user sebelum diterapkan ke save.
- Source R1 belum ada; runtime baseline tetap v0.4.0. Deployment Hostinger versi apa pun masih perlu pemeriksaan live tersendiri.

## Handoff berikutnya

1. Ambil dokumentasi dari Git; baca record ini dan [R0–R10](NEXT-PRODUCTION-R1.md).
2. Jangan menanyakan ulang D1–D8 tanpa perubahan konteks yang nyata; keputusan tersebut sudah disetujui.
3. Tunggu instruksi eksekusi sesudah publikasi dokumentasi. Saat eksekusi diminta, mulai dengan scope terbatas save/economy foundation, bukan langsung seluruh tiga mode.
4. Kerjakan langsung menggunakan Astra, **tanpa subagent**, kecuali user mengubah instruksi itu.
5. Approval produk, hasil test, commit repository dan live release tetap dicatat sebagai bukti yang berbeda.
