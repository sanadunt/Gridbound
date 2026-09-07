# Gridbound R1 — game direction & target GDD

**Status: D1–D8 APPROVED / DOCUMENTATION ONLY / IMPLEMENTATION NOT STARTED.** R1 adalah revisi arah desain, **bukan** versi aplikasi. Baseline source `main` commit `7aced0b`; deployment Hostinger aktual belum diverifikasi. User menyetujui D1–D8 pada 7 September 2026 dan meminta dokumentasi masuk Git sebelum dieksekusi. Task saat ini hanya mencatat approval serta commit/push dokumentasi; runtime, save dan build configuration tidak berubah. [Approval record dan batas eksekusi](APPROVAL-D1-D8.md).

## Baca berurutan

Mulai dari [keputusan D1–D8 yang disetujui](APPROVAL-D1-D8.md); jangan menafsirkan target berikut sebagai fitur yang sudah diimplementasikan.

1. [GDD target](GDD-TARGET.md) — game promise, title/menu, batas mode, scope dan keputusan.
2. [Riset referensi](RESEARCH.md) — lima game, bukti, yang diadaptasi dan yang ditolak.
3. [Story bible](STORY-BIBLE.md) — prologue, world rules, act/chapter, payoff dan original sample script.
4. [Mode design](MODE-SYSTEMS.md) — Roguelike 3 hero, Raid 1–6, Story dungeon tanpa shop/upgrade.
5. [Economy & crafting](ECONOMY.md) — Gold/material Story, Crystal Challenge, merchant dan anti-duplicate ledger.
6. [Character/combat spec](CHARACTERS-COMBAT.md) — STR DEF INT DEX WIS, formulas, unique heroes/classes/skills.
7. [Ultra catalog](ULTRA-CATALOG.md) — starter Ultra + signature catalog, unlock, coefficients dan safeguards.
8. [UX/skill-tree/icon spec](UX-ART.md) — world map, focused screens, graph routing, spacing, icon language.
9. [Save/profile architecture](SAVE-PROFILES.md) — per-mode Load/Save, shared Challenge economy, migration/rollback.
10. [Technical blueprint](TECHNICAL-PLAN.md) — proposed module boundaries, command contracts dan test-only Balance Lab.
11. [Next production R1](NEXT-PRODUCTION-R1.md) — dependency milestones, content budget, acceptance/risks.
12. [Request traceability](REQUEST-TRACEABILITY.md) — setiap permintaan dipetakan, current vs target.
13. [Editable diagrams & design boards](DIAGRAMS.md) — Mermaid + offline HTML/SVG, bukan UI game yang bekerja.
14. [Validation record](VALIDATION.md) — pemeriksaan dokumentasi, bukan hasil playtest atau runtime QA.

[Full GDD gabungan](GRIDBOUND-R1-FULL-GDD.md) tersedia untuk baca/download satu dokumen; komponen di atas tetap sumber editorial.

[Word export dengan approval D1–D8](exports/Gridbound-R1-Target-GDD.docx) adalah convenience copy di Git. Markdown komponen tetap sumber editorial. Salinan Word/HTML lepas di root workspace bukan sumber resmi dan tidak ditimpa oleh task publikasi ini.

## Prinsip source of truth

- `src/` dan `data/database.json`: implementasi v0.4.0 yang ada sekarang.
- `Gridbound_GDD_GRID_RAID.md`: GDD implemented yang digenerate dari runtime. **Tidak diganti menjadi wish list R1.**
- Paket ini: target baru, dengan semua angka ditandai sebagai seed balance atau content budget, belum diuji di game.
- [Production masterplan sebelumnya](../PRODUCTION-MASTERPLAN.md): process/release baseline. Untuk scope baru, baca [R1 milestones](NEXT-PRODUCTION-R1.md); M0–M7 lama bukan bukti target R1 selesai.
- [GUI evidence sebelumnya](../GUI-VERIFIED.md): bukti lama, tidak menguji title, profile slots, mode-specific economy atau lima atribut karena fitur tersebut belum diimplementasi.

## Keputusan D1–D8 — APPROVED oleh user

| ID | Keputusan rancangan | Mengapa | Status |
|---|---|---|---|
| D1 | Crystal Raid + Rogue disimpan pada satu Commander profile; Story terisolasi | Progres lintas-mode sesuai permintaan tanpa menjual Story power | APPROVED |
| D2 | Crystal bank untuk meta-unlock; Crystal perjalanan untuk shop selama run; bank tidak boleh dibawa masuk | Run tetap menuntut pilihan, tidak bisa membeli kemenangan memakai tabungan Raid | APPROVED |
| D3 | Story roster 9, aktif 3 pada prologue lalu maksimum 6; bench mendapat catch-up | Selaras Raid 1–6, masih memberi ruang reposisi grid; desain cap disetujui, migrasi tetap perlu preview | APPROVED |
| D4 | Rogue tepat 3 recruit custom, job bebas dari 5 basic termasuk duplikat; job upgrade diperoleh di run | Kebebasan build tanpa membawa level/equipment Story | APPROVED |
| D5 | Rewarded Raid memakai boss/modifier tervalidasi; raw sliders masuk Sandbox tanpa Crystal | Customization tidak menjadi exploit hadiah | APPROVED |
| D6 | 3 Commander profiles; tiap mode 3 manual slot + 1 auto; satu run aktif per Challenge mode | Ganti profile tetap mudah, ekonomi tidak direwind oleh save lama | APPROVED |
| D7 | Story utamanya linear dengan pilihan konsekuensi kecil; satu ending utama dan epilogue flags | Cerita runut dan scope penulisan/test terkendali | APPROVED |
| D8 | Full target: 9 hero unik, 18 advanced + 18 third paths, 32 Ultra definitions; slice jauh lebih kecil | Luas tapi dipecah gate, bukan janji implementasi sekali jalan | APPROVED |

**Seluruh D1–D8 disetujui user.** Lihat [pesan persetujuan, scope Git dan batas eksekusi](APPROVAL-D1-D8.md). Persetujuan ini mengunci arah desain, bukan nilai balance, kalender produksi, QA, implementasi atau deployment. Seluruh kode R1 masih menunggu instruksi eksekusi setelah dokumentasi tersimpan di Git.

## Non-goals

Tidak ada account login wajib, cloud sync, online leaderboard, multiplayer, monetisasi Crystal, live-ops/FOMO, trade antar-player, procedural AI story, atau downloadable assets dari game referensi. Browser/static Hostinger tetap platform target; restart offline tanpa cache/service worker tidak dijanjikan.
