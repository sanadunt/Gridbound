# Economy, crafting & challenge relics

**Proposal; semua jumlah adalah seed tuning, bukan economy yang sudah live.** [Mode definitions](MODE-SYSTEMS.md). Tidak ada microtransaction, exchange uang, atau currency yang dapat diuangkan.

## 1. Currency ownership

| Resource | Pemilik | Sumber | Sink | Tidak boleh |
|---|---|---|---|---|
| Gold | Story save slot | chapter, quest, replay, dungeon extraction | equipment purchase, craft fee, supply, respec | ditukar Crystal; membeli relic Challenge |
| Material | Story save slot inventory | targetable farming/dungeon, quest, dismantle bound gear | recipe, gear upgrade | diterima Rogue/Raid atau dijual ke Crystal |
| Bank Crystal | Commander ChallengeWallet | eligible Raid receipt; Rogue act/final clear receipt | relic rule unlock, alternative mastery/Ultra trials, cosmetics | transfer antar-Commander; langsung top-up purse run |
| Crystal perjalanan | satu Rogue run | room win/event/risk | run shop/heal/upgrade/reroll | carry ke run baru, konversi ke Gold, copy dari bank |
| Supplies | Story slot / carried expedition | Gold/recipe di town | healing, alternate route | auto-refill gratis lewat save reload |

Dua scope Crystal tetap tema/currency yang sama, tetapi bukan saldo yang dapat dipindahkan: **ikon Crystal isi solid = bank; Crystal outline dengan badge RUN = perjalanan**. Setiap shop menyebut sumber saldo, apa yang persist/reset, dan tidak menampilkan saldo salah. Pemisahan ini keputusan D2 yang [sudah disetujui](APPROVAL-D1-D8.md); coding dan pengujian ekonominya belum dijalankan.

## 2. Story economy loop

World map menunjukkan lokasi material yang diketahui, guaranteed drop dan risiko bonus. Siklus: pilih recipe → Pin materials → peta menyorot rute → dungeon/extraction → craft preview → confirm. Penggilingan material memberi pilihan, bukan syarat grinding langka untuk story boss mandatory.

### Material catalog awal

| ID | Material | Region & cara memperoleh | Fungsinya |
|---|---|---|---|
| MAT-IRON | Iron scrap | Jalur biasa/SD01 guaranteed | weapon/armor basic |
| MAT-LINEN | Field linen | Quest supply/SD01 | healer gear, bandage |
| MAT-RESIN | Ember resin | Ashwood branches/SD01 | fire/resistance craft |
| MAT-GLASS | Glass thread | Glassmere/SD02 | focus, precision |
| MAT-SAP | Pale sap | Frostward/SD03 | restoration |
| MAT-FROST | Frost alloy | Guardian SD03 | guard/slow resistance |
| MAT-BELL | Bellsteel | Old Tower/SD04 | late weapon/core |
| MAT-MEMORY | Memory cloth | SD04 side rescue/quest | signature equipment catalyst |

Drop proposal dungeon: guaranteed target 2 per successful extraction, guardian +1, optional hazard +1. RNG cosmetic/bonus boleh ditambah tetapi required recipe tidak bergantung low-probability-only drop. Preview menampilkan pouch yang bisa hilang. Quest materials tidak dapat soft-lock jika dismantled: ada repeatable safe route.

### Recipe examples (design IDs, tidak memakai existing IDs secara diam-diam)

| Recipe ID | Hasil | Cost seed | Gate | Design purpose |
|---|---|---|---|---|
| RC-SHIELD | Watchman's Rim | 80 Gold +3 Iron +1 Resin | Ch1 | DEF/WIS barrier hybrid |
| RC-BOW | Ferry String | 110 Gold +2 Glass +2 Linen | Ch6 | DEX/STR precision |
| RC-STAFF | Mercy Reed | 100 Gold +2 Sap +2 Linen | Ch9; basic healer gear tetap tersedia sejak Ch1 | WIS/INT healing |
| RC-COAT | Orchard Coat | 180 Gold +3 Sap +2 Frost | Ch9 | physical survival tanpa tempo |
| RC-DAGGER | Copper Witness | 170 Gold +2 Bell +2 Glass | Ch13 | DEX utility + reveal |
| RC-SIGIL | A Name Kept | 200 Gold +2 Memory +1 Bell | companion quest | signature sidegrade, tidak ending requirement |

Ferry String baru craftable Ch6 saat SD02 tersedia; Mercy Reed Ch9 saat SD03 terbuka. Recipe boleh muncul grey-preview lebih awal, tidak menjadi quest yang mustahil. Target data-authoring wajib memvalidasi material-route gate <= mandatory requirement gate.

Gear masih memakai Weapon/Armor/Charm. Upgrade **+0 → +3** target cap: beda kecil dan satu perk pilih, bukan infinite stat slope. Upgrade preview merinci before/after semua affected stats, skill output examples dan set break. Unique template tidak di-dismantle tanpa warning; owned swap free, craft spends sekali. Respec stat points gratis di town saat tutorial dan setelah rebalance patch; biaya Gold kecil setelah itu optional, jangan memaksa farming untuk memperbaiki salah klik.

### Anti-loop

- Dismantle mengembalikan paling banyak sebagian material yang benar-benar dibayar; zero Gold. Quest-granted/free copy memakai provenance `refund=0`.
- Tidak bisa craft→dismantle menghasilkan lebih dari input. Price/rounding floor satu kali, tidak rekursif set bonus.
- Pertama kali recipe dibuka bukan hadiah berulang dari membuka UI. Inventory full/blocked save membatalkan atomic transaction; tidak potong resource dahulu.
- Item quantity integer bounded; unknown ID, negative cost, NaN/Infinity, wrong-mode item ditolak.

## 3. Crystal bank reward model

**Raid contract seed:** `reward = floor(Btier * (1 + bonusAllowed) * objectiveFactor)`.

- Tier base `Btier`: 12 / 18 / 26 Crystal untuk Bronze / Silver / Gold.
- `bonusAllowed = min(0.60, 0.10 * validatedRiskPoints)`; hanya certified modifier combination. Unknown/unvalidated config → Practice, reward0. Risk points diberi cap sesudah compatibility checks.
- `objectiveFactor`: 1 untuk victory primary; optional objective success dapat menjadi bonus terpisah yang sudah masuk contract data. Jangan memberi failure payout dari abandon/retry. Prototype default tetap1.
- Reward tidak bertambah berdasarkan party size: HP/targets sudah diskalakan. Solo ditantang tetapi bukan payout eksploit.
- First clear per boss+tier memberi bonus base sekali. Duplicate/import/reload receipt tidak membayar ulang.
- Payout mengacu immutable contract record, bukan boss custom HP, client elapsed seconds, atau nilai reward dari imported save.

**Rogue seed:** clear act1 +6 bank, act2 +8, act3 +12; clear full run +10. Total base full success 36; wipe act2 setelah act1 mempertahankan6. Challenge relic certified memberi maximum +60% pada masing-masing payout (floor per receipt); tidak ada reward dari sekadar masuk/restart.

**Tidak ada purse conversion.** Ini menghapus strategi “jangan pernah belanja karena coin akhir jadi meta”. Crystal perjalanan yang tersisa diringkas di result sebagai unspent, lalu reset. Repeated legitimate runs masih boleh memberi Crystal; target effort/reward diuji pada boss termudah serta challenge combo tersulit. Tidak pakai daily cap/streak untuk menutup tuning yang jelek.

### Harga meta seed & pacing hypothesis

| Purchase | Cost seed | Yang dibuka |
|---|---:|---|
| Basic challenge relic | 30 | Pilihan aturan tambahan, bukan +stat permanen |
| Advanced relic | 60 | Aturan gabungan setelah mastery trial |
| Alternative skill trial access | 24 | Trial unlock; bukan langsung upgrade menang |
| Ultra specialization trial | 48 | Unlock route yang dibatasi budget |
| Banner cosmetic | 20 | Tanpa reward multiplier |

Contoh **aritmetika, bukan measured pacing**: tiga Bronze base wins menghasilkan36; satu basic relic30 menyisakan6. Satu Rogue full base run36 juga dapat membeli basic relic dan menyisakan6. Tradeoff unlock vs cosmetic jelas. Tidak ada “bagus” yang dibuktikan oleh angka ini tanpa waktu completion/playtest.

## 4. Challenge relic library — target 12

Relic library unlock permanen; **memasang relic gratis**, melepas gratis, hanya sebelum run. Stack maksimum3. Relic ditemukan di run dinamai **Run Relic** untuk membedakan rule card meta. R1 slice hanya CR01/CR02, full baru setelah calibration.

| ID | Nama | Rules change | Seed risk | Guardrail |
|---|---|---|---:|---|
| CR01 | Cracked Bell | Every act boss punya aftershock tambahan | 1 | telegraph tambahan ≥1.5s |
| CR02 | Narrow Lantern | Satu tile bergilir unavailable per elite | 1 | jalur aman & area party cukup |
| CR03 | Miser's Prism | Heal shop +25%, camp recovery +10% | 0 | benefit+cost; Practice sampai net-risk measured |
| CR04 | Restless Root | Extra minion wave tiap elite | 1 | cap minion/sprite/input |
| CR05 | Glass Bargain | Semua upgrade rare punya downside | 2 | three choices tetap legal |
| CR06 | Patient Hour | Skill base cooldown +10%, tap cap tetap | 1 | tidak mendorong tapping patologis |
| CR07 | Open Ledger | Event risiko/stock revealed, shop price +15% | 0 | insight modifier, bukan free reward |
| CR08 | Hollow Feast | Boss heal reduction debuff pada phase2 | 2 | cleanse/counter universal tersedia |
| CR09 | Last Watch | Guardian challenge objective tambahan | 2 | not instant fail/safe fallback |
| CR10 | Ashbound Purse | Start purse0, elite reward +10 | 0 | target baseline start20; higher net reward Practice sampai calibrated |
| CR11 | Twin Omens | Pattern order remix dengan preview | 1 | no simultaneous impossible patterns |
| CR12 | Unwritten Path | Dua event slots menjadi elite choice | 2 | mandatory camp/shop preserved |

Unlocked tidak berarti equipped. UI menjelaskan rank/risk, change list dan unsupported combo. Relic yang memberi benefit tanpa net higher risk tidak membayar risk bonus. CR02 + crowded-arena modifier wajib generator compatibility validation.

## 5. Settlement ledger & fairness

Transaction fields target: txnId, ownerCommanderId, mode, runOrAttemptId, checkpointId, type, currencyScope, amount, sourceRuleId, configHash, revision, status. Commit wallet/unlock/receipt dalam **satu local transaction**. Claim button hanya acknowledgment/UI, bukan sumber kebenaran.

Crash sebelum transaction: retry valid. Crash sesudah commit sebelum dialog: receipt ditemukan, tampilkan hasil tanpa membayar ulang. Purchase transaction menyimpan inventory unlock dan pengurangan wallet atomik. Multi-tab writer lease dan revision compare mencegah overwrite. Save slot load bukan rollback wallet.

**Batas jujur:** semua ini konsistensi aplikasi offline, bukan tamper-proof economy. Pemilik browser dapat mengedit file/DB, menggandakan profile, atau memulihkan backup lama. Tidak ada kompetisi/leaderboard finansial; jangan mengklaim anti-cheat. Imported full Commander menjadi profile baru/provenance backup, tidak digabung additive ke wallet existing.

## 6. QA economy gates

- Enumerasi tiap recipe termasuk gates, required routes, dismantle loops, zero paid provenance.
- Simulasi minimum/maximum party, solo baseline job, repeated easiest boss; ukur Crystal per minute, lalu gunakan human playtime untuk menetapkan target—bukan hardcode multiplier dari asumsi.
- Initial Commander bank0 punya Rogue dan Raid playable; tidak wajib farm Story atau membeli relic.
- Ledger duplicate, negative/unknown currency, foreign Commander, old slot, crash points, two tabs, import ulang, quota exceeded harus test.
- Non-zero Rogue purse di ending/abandon tidak pernah masuk bank; only authored receipt. Shop tidak membaca Story Gold.
