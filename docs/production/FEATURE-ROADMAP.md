# Feature roadmap dan UX specification

[Masterplan](../PRODUCTION-MASTERPLAN.md). **Seluruh ide baru di bawah bersifat proposed, belum implemented.** Baseline yang sudah ada tercatat di NEXT-PRODUCTION.

## Roadmap dengan alasan dan risiko

| Kandidat | Nilai pemain | Prioritas usulan | Biaya/risiko desain | Gate |
|---|---|---|---|---|
| Tutorial pendek contextual | Mengerti tap, telegraph, skill, guard | Release conditional | State tutorial/save, skip/replay | New-player test tanpa fasilitator |
| Backup import + preview | Bisa memulihkan progress secara sadar | Release conditional | Data loss, schema/security, downgrade | Save fixture matrix dan confirmation |
| Build/version + bug report copy | Laporan masalah dapat direproduksi | Release conditional | Jangan otomatis copy save/identitas | Payload allowlist review |
| Combat recap | Mengerti defeat/XP/reward | Release conditional | Overloaded result dialog | Compact summary + detail optional |
| Credits/accessibility panel | Transparansi asset dan kontrol pengalaman | Release candidate | License verification, settings migration | Keyboard/motion/audio QA |
| Party loadout presets | Eksperimen build tanpa banyak klik | Postlaunch | Inventory/gating/preset migration | Invalid preset atomic rejection |
| Gear sorting/filtering | Koleksi besar mudah dibandingkan | Postlaunch jika perlu | Selection persistence, empty state | Semua filter kombinasi |
| Companion story scenes | Hero terasa personal, bukan angka | Content update | Writing/localization/state flags | Authored review, journal replay |
| Optional challenge contracts | Endgame dengan aturan khusus | Content update | Difficulty/reward exploit | Counterplay dan economy benchmark |
| Non-stat achievements | Milestone tanpa power inflation | Optional | Reward idempotency/save bloat | Retroactive unlock rules explicit |
| Cosmetic recolors | Ekspresi tanpa pay-to-win | Optional | Art/readability/licensing | Telegraph readability preserved |
| Crafting/upgrades | Material progression | Defer | Currency grind, reroll economy, schema changes | Separate design approval |
| Installable PWA | Reload/offline install experience | Defer | Service-worker cache/version/rollback complexity | Offline update and stale cache drill |
| Cloud save/accounts | Cross-device continuity | Out of current scope | Backend auth/privacy/conflicts/cost/support | Separate architecture and consent |

## Screen information architecture (target)

- Town/home: continue journey, current objective, navigasi fasilitas; jangan semua katalog di sini.
- Campaign: satu chapter summary, requirements/rewards dan depart; journal terpisah.
- Training: selected hero tetap konsisten lintas Overview/Skills/Jobs/Talents/Gear/Formation.
- Talent: pilih branch → lihat compact graph → pilih node → detail/prerequisite → explicit learn. Cross-branch dependency harus menyebut parent dan cara menuju parent.
- Gear: filter/slot → item preview (name, rarity, source, cost, restrictions, delta) → confirm. Selecting/cancel tidak mengubah gold/inventory/equipped item. Owned swap tetap explicit.
- Quest: satu task/detail atau bounded list, available/all/claimed, recipient jelas, manual claim; next/previous tidak mengubah quest progress.
- Combat: arena/actions utama; inspector/log/help bisa dibuka tanpa membuang selected hero. Pause behavior dijelaskan; jangan pause diam-diam karena layout berubah.
- Result: death selesai → options visible locked → unlock → selected action. First-clear/XP/downed reward dijelaskan; detail tambahan tidak mendorong primary action jauh ke bawah.
- Settings: sound/motion/help/save/credits/version jika implemented; bedakan download backup dari import yang baru usulan.

## Spec tutorial proposal

Steps: pilih campaign → tap hero → baca ground telegraph → relocate atau guard sesuai threat → switch equipped skill → finish encounter → pahami result delay → buka XP/quest. Tutorial jangan menjanjikan fitur sebelum unlock. Skip kapan saja, replay dari help, step completion idempotent; no extra reward exploit. Tidak mengubah campaign completion tanpa kemenangan sah. Simpan tutorial flags hanya dengan schema review.

## Spec backup import proposal

Input file JSON lokal → batas ukuran/parse → version/envelope validation → preview hero/campaign/gold + warning origin → export current optional/encouraged → explicit replace confirmation → one write → read-back + reload safe. Cancel, invalid/future/too-large payload tidak mutate. Raw contents tidak dikirim jaringan. Jangan mengeksekusi string dari save atau merender nama tanpa escaping. Migrasi downgrade tidak otomatis.

## Accessibility dan text standards

Gunakan status teks bersama warna. Focus visible, modal focus return, no hover-only essentials, setting reduced motion tidak menghilangkan informasi. Label mana hero level, mana campaign rank. Konsistensi bahasa Indonesia/English item names diputuskan editorial. Jangan gunakan daily guilt/FOMO dan reward popup beruntun. Feedback error harus menjelaskan tindakan aman berikutnya tanpa menyuruh hapus save.

## Balance specification sebelum ekspansi baru

Pisahkan campaign rank, hero XP/SP, gold, equipment ownership dan run boons. Pertanyaan playtest: apakah starter build menang dengan counterplay, late recruits berguna, talent pilihan nyata, healer/tank/damage punya peran, quest memberi tujuan bukan chores, dan replay reward tidak memaksa grind. Uji active vs idle, beberapa seed/build/policies, serta resource usage; kemenangan satu policy bukan bukti semua class balanced.
