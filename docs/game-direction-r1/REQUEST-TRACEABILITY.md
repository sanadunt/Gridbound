# Request coverage — R1 design vs existing runtime

**Semua request target di bawah sudah dibahas dalam dokumentasi, bukan otomatis diimplementasikan.** Baseline diperiksa pada `main` commit7aced0b, package0.4.0. Exact count current diambil dari `data/database.json`/source; target tidak mengganti export implemented.

| Req | Permintaan user | Current implemented baseline | R1 target & dokumentasi | Verification setelah implementasi |
|---|---|---|---|---|
| Q01 | Press Start/title/menu utama | Boot ke town; belum full game shell | [GDD §3](GDD-TARGET.md), [UX](UX-ART.md) | First gesture consumed, audio opt-in, Continue/New/focus |
| Q02 | Story / Roguelike / Raid pilihan terpisah | adventure/endless/raid memakai banyak profile progression yang sama | [Mode matrix](GDD-TARGET.md), [modes](MODE-SYSTEMS.md) | Currency/build ownership tiap mode |
| Q03 | Cerita bagus/runut/prologue/world building |4acts16chapter,76encounter,9hero bios sudah ada; prologue belum yang dirancang | [Story bible](STORY-BIBLE.md) | Prologue comprehension, foreshadow/payoff, skip/save/flags |
| Q04 | Rogue build3 & job bebas | Endless memakai Story roster/loadout | [Rogue A1](MODE-SYSTEMS.md) | Exactly3,5basic jobs+duplicates, no Story stat carry |
| Q05 | Rogue upgrade/shop/challenge/multiple choice |12boons, floor progression; belum node-shop-event lengkap | [Rogue A2–A4](MODE-SYSTEMS.md) | Seeded reachable map, legal drafts, stock no reroll reload |
| Q06 | Raid langsung build1–6, custom enemy/challenge | Raid enemy variants selectable, party progression shared; belum free normalized builder | [Raid B](MODE-SYSTEMS.md) | All N tested, all jobs counters, frozen config |
| Q07 | Crystal dari Raid, relic menambah tantangan Rogue | Belum Crystal bank/per-mode separation | [Economy §§1/3/4](ECONOMY.md) | Receipt once, installable rules, no free stat inflation |
| Q08 | Rogue juga Crystal, shop khusus Raid/Rogue | Belum implemented | [Currency ownership](ECONOMY.md), [profile wallet](SAVE-PROFILES.md) | Run vs bank labels, no deposit/convert loophole |
| Q09 | Story pure Gold+material/equipment/farming loop |42gear/6sets, Gold; material crafting belum ada | [Story economy](ECONOMY.md), [dungeon](MODE-SYSTEMS.md) | Recipe sources, extraction, no low-drop mandatory blocker |
| Q10 | Story dungeon seperti Rogue tanpa upgrade/shop, ada pilihan | Belum distinct dungeon room system | [Rootbound Expeditions](MODE-SYSTEMS.md) | Node allowlist no upgrade/shop/relic, permanent party |
| Q11 | World map, menu Party/Quest/Skills/Inventory/Status | Town sections/pagination; belum map shell target | [UI flow](UX-ART.md) | Navigation/back/selection persisted, no page pile |
| Q12 | Gear/skill/atribut karakter,5stats | Individual level/XP, gear/skills; belum STR DEF INT DEX WIS | [Combat](CHARACTERS-COMBAT.md) | Points conserved, preview formula equals output |
| Q13 | Skills/advance class unik tiap hero, multi-stat scaling |5bases,10advanced+10third shared,40skills;50talent definitions | [Unique hero kits/routes](CHARACTERS-COMBAT.md) |18+18 routes authored later, all effect tests, hybrid viability |
| Q14 | Banyak Ultra, unlockable by progress | Satu shared Ninefold Dawn Ultimate;3legacy upgrades bukan3Ultra | [Ultra catalog](ULTRA-CATALOG.md) |32proposed IDs/gates, equip1hero, cap/proc safeguards |
| Q15 | Load/Save Profile setiap mode, ganti profile | Single local v3 + backup JSON export; no multi-slot UI | [Saves/profiles](SAVE-PROFILES.md) | New/load/cancel/switch/suspend, transactions/import/rollback |
| Q16 | Skill tree direction benar, margin/padding antar text box | SVG prerequisite map ada; visual polish belum full accepted | [Graph geometry](UX-ART.md), [board](art/skill-tree.svg) | AND/OR/branch/gutter/endpoint tests & physical readability |
| Q17 | Skill icons | Existing procedural/common art; no target unique asset manifest | [Icon system](UX-ART.md), [12concept studies](art/icon-concepts.svg) | Original masters, all icon IDs, grayscale/contrast/touch labels |
| Q18 | Dokumentasi dulu, riset sebelum GDD/next production | Historical production plan sebelum request ini | [Research](RESEARCH.md), [R1 milestone plan](NEXT-PRODUCTION-R1.md) | Source ledger verified; no runtime files changed |

## Approved design decisions / execution boundary

D1–D8 di [index](README.md) **sudah disetujui user**; bukti dan batasnya ada di [approval record](APPROVAL-D1-D8.md). Termasuk Story active cap6 dari roster9; bank/run Crystal tidak saling transfer; rewarded Raid vs Sandbox; mode slots memakai Commander wallet bukan rewind wallet; full target32Ultra/36promotion directions dibagi milestone. Coding, balance dan migration acceptance belum dimulai.

## Hal yang sengaja tidak diklaim selesai

- UI game baru, Three-mode split, Crystal,5stats, material crafting, new story scenes, slot save, new combat mechanics/icon atlas.
- 32 final Ultra sprites atau seluruh54personal normal actions final spec; di sini hanya signature18normals,32Ultra seed catalog,36promotion directions.
- Real fun/balance/pacing, player retention, low-end FPS, physical-device compatibility, final production approval.
- Remote deploy/live Hostinger status, source implementasi R1, atau production approval. User sekarang mengizinkan commit/push dokumentasi R1 dahulu; itu bukan izin menjalankan migrasi atau merilis fitur.

Dokumentasi lengkap untuk mengambil keputusan dan memulai prototype ≠ semua content siap produksi tanpa authoring/test lagi.
