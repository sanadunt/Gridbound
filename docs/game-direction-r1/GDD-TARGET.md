# Target GDD — Gridbound: Ashes of the Bell

**Working title dipertahankan. D1–D8 APPROVED; fitur target belum diimplementasikan atau lolos production acceptance.** [Approval record](APPROVAL-D1-D8.md) mengunci keputusan desain dan meminta publikasi Git terlebih dahulu; detail tuning tetap provisional. [Index & keputusan](README.md). [Referensi riset dan batas bukti](RESEARCH.md).

## 1. Pitch & player fantasy

Bangun party Bellkeeper, percepat aksi dengan tap terukur, baca niat musuh dan tentukan siapa yang dilindungi. Satu sistem combat mendukung **kisah authored**, **run build yang berubah**, serta **boss lab yang bisa langsung dimainkan**—masing-masing punya progression dan resource sendiri.

Rasa yang dicari: membuka sebuah game, bukan dashboard. Musik title, tombol Start yang jelas, world map sebagai rumah Story, brief pendek sebelum berangkat, kemenangan dengan ruang bernapas, dan progression yang dapat ditelusuri. “Premium casual” adalah target pengalaman, bukan klaim harga, polish atau hasil riset pasar.

## 2. Platform & controls

- Tetap browser desktop/mobile, Phaser + TypeScript + Vite; production static Hostinger, optional Node `server.js`. Tidak mengganti engine.
- Portrait-first mobile; desktop mengadaptasi komposisi, bukan memperbesar satu kolom panjang.
- Tap sprite → mengurangi cooldown dengan fatigue/cap; drag atau mode pindah → reposition; 2 equipped normal skills/hero; 1 equipped Ultra/hero.
- 5 atribut yang terlihat: STR, DEF, INT, DEX, WIS. Tidak ada level account tersembunyi yang menaikkan semua mode.
- Touch + mouse + keyboard; primary targets minimal 44 CSS px, fokus terlihat, safe areas. Dua sentuhan tidak boleh menjadi dua pembelian/dua Ultra.
- Pause/visibility loss membekukan combat dan timer ancaman; animasi title/motion optional. Background throttling bukan alat skip challenge.

## 3. First session flow

1. Load lokal → title artwork → **PRESS START / TAP TO START**, juga bisa Enter/Space. Tidak meminta login. Gesture Start boleh membuka audio sesuai pilihan, tidak memaksa fullscreen.
2. Title transition mengonsumsi pointer/key pemicu hingga release; tidak menekan menu di belakang.
3. **Main Menu:** Continue, Story Mode, Roguelike, Raid Boss, Profiles, Settings, Credits. Continue menampilkan mode/profile/checkpoint sebelum resume. Disabled Continue menjelaskan belum ada save.
4. Pilih mode → tampilkan Commander aktif dan mode slot. New, Load, Continue, Back selalu jelas; tidak menimpa slot hanya karena memilih New.
5. Story baru → prologue playable → Emberhollow/world map. Rogue baru → party 3 + relic/difficulty → node map. Raid baru → party 1–6 + boss/challenge → arena.
6. Semua mode tersedia dari menu; Story progress tidak wajib untuk mencoba Rogue/Raid. Spoiler boss/story assets disamarkan di Challenge sampai reveal opt-in atau milestone Story pada Commander itu.
7. Settings/credits/profile list adalah halaman sendiri. Tidak semua di bawah title.

## 4. Mode contract

Story active-party cap seed: 3 pada prologue; 4 setelah Ch02; 5 setelah Ch03; 6 setelah Ch04. Ini batas maksimum, bukan kewajiban membawa party penuh. Roster9 menyediakan pilihan bench, bukan9unit di arena. Cap dan recruitment checkpoint diuji terpisah.


| Hal | Story Mode | Roguelike: Sunken Bell | Raid Boss: Echo Crucible |
|---|---|---|---|
| Tujuan | Menyelamatkan kota tanpa mengulang pengorbanannya | Menyelesaikan run dengan build hasil pilihan | Mengalahkan boss/ruleset pilihan |
| Party | 9 hero authored; aktif 3→6 usulan | Tepat 3 recruit, job bebas | 1–6 echo unit, build dapat diedit |
| Growth | XP, atribut, talent, unique class, equipment | Run levels, upgrade draft, shop, mastery node | Budget/preset ternormalisasi, unlock pilihan; tidak farming level hero |
| Resource | Gold + material + supply | Crystal perjalanan saat run; bank Crystal untuk meta | Bank Crystal dari rewarded contracts |
| Persists | Quest/story flags/hero progress/inventory | Relic library, job/Ultra unlock, bank; build run reset | Presets/bestiary/mastery/bank; encounter state reset |
| Map | World map region → chapter/dungeon | Branching node map 3 acts | Boss constellation/contract board |
| Kalah | Checkpoint, tidak permadeath | Run selesai, unbanked run currency hilang | Retry, tidak kehilangan permanent gear |
| Bisa shopping di run? | Tidak pada Story dungeon | Ya: temporary-only dengan Crystal perjalanan | Sebelum battle saja; unlock alternatif, bukan live power |

**Tidak saling mengalirkan Gold, material, XP atau stat.** Rogue & Raid berbagi ChallengeWallet melalui Commander, tetapi slot run tidak memiliki salinan wallet yang dapat direwind.

## 5. Story world map & menu

World map menunjukkan satu region fokus dengan node main quest, side quest, material site, dungeon, town. Desktop boleh overview lalu zoom region; mobile memakai tombol region, bukan scrolling canvas tanpa batas.

Node click → panel brief khusus: nama, tujuan, cerita singkat, lawan diketahui, reward/material, recommended level, party, status save. **Depart membutuhkan konfirmasi**, bukan akibat tap peta.

Game Menu membuka: Party, Quests, Skills, Inventory, Status, Forge, Journal, Save/Load, Settings, Return to Title. Party memuat hero → Overview/Attributes/Gear/Skills/Advancement/Ultra. Skills dari game menu membuka hero terakhir; tidak menggandakan data.

Map mengikuti progression; replay chapter diberi label memory/expedition, tidak mengulang recruitment atau canonical ending. Peta challenge terpisah dari Story canon.

## 6. Combat identity

Pertahankan grid, intent, Guard/interrupt, cooldown/tap dan reposition dari baseline. Keterbacaan lebih penting dari menggandakan animasi. Lima stats menghasilkan mekanik yang terukur; skill berbasis dua atribut dapat membangun hybrid tanpa satu atribut mendominasi semua tugas.

Setiap action mempunyai source, target, coefficient, damage type, cooldown/charge, cap, status stacking dan icon ID. Primary skills berbeda dari Ultra. Definisi [combat](CHARACTERS-COMBAT.md) dan [Ultra](ULTRA-CATALOG.md) adalah target, bukan penggantian source otomatis.

Hasil: status terminal → block combat input → death visual bounded (victory) → layar hasil → **minimal 1000ms lock setelah tampil** → satu action baru setelah gesture lama dilepas. Reward settlement idempotent pada checkpoint/terminal transaction, tidak bergantung klik berulang. Retrying tidak membayar lagi.

## 7. Progression layers

1. **Hero Story:** level/allocated attributes/gear/unique talents/job quests/Ultra.
2. **Story town:** recipes, known material routes, optional dungeons dan journal.
3. **Rogue run:** 3-unit temporary build, rank/mastery, relics ditemukan, run purse, route choices.
4. **Challenge meta:** bank Crystal, challenge relic unlock, class/Ultra alternatives, presets. Bukan unlimited stat boost.
5. **Raid encounter:** frozen config and party, score/first-clear/bestiary mastery; victory receipt satu kali.
6. **Commander profile:** menampung sub-save tiga mode dan ChallengeWallet, bukan global transfer antar-Commander.

## 8. Full target & content budget, bukan janji rilis sekaligus

- Title/Main Menu/Profile Hub, Story world map, Rogue route map, Raid board.
- Story: playable prologue + 4 acts/16 chapter + epilogue; baseline 76 encounters dipertahankan sebagai inventory awal, bukan final count setelah authoring pass.
- 9 hero dengan 2 signature normal skills, 2 advanced branches dan third continuation masing-masing; 36 promotion definitions target. Target dibangun bertahap.
- 32 Ultra definitions target: 5 class starters, 18 signatures, 9 capstones; bukan 32 tombol di combat.
- Rogue content target: 3 biomes/acts, 30 upgrades, 12 events, 6 elite contracts, 9 camp recipes, 12 challenge relics; seed values belum tuned.
- Raid initial fully validated bosses 4 lalu 12 base archetypes. 8 authored modifiers awal; recolors bukan boss original tambahan.
- Story farming: 4 region material families + shared iron/cloth; 4 authored challenge dungeons; 12 multi-choice dungeon events target.
- Tidak wajib menambah musuh demi angka sebelum mode-loop lulus.

## 9. Vertical slice yang harus lulus dulu

Title → one Commander → mode slot → Story prologue dengan 3 hero; satu material dungeon; satu Rogue act dengan 3 hero dan node Shop/Event/Upgrade/Boss; satu Raid boss untuk party 1/3/6; dua challenge relic; save/import/suspend/settle. Hanya 1 advanced branch per hero slice, 5 class starter Ultra + 3 signatures. Scope diperluas setelah bukti loop/ekonomi/UI tidak rusak.

## 10. Art, sound, monetization boundaries

Forest emerald/brass pixel art dipertahankan. Title art, region maps, icons dan SFX original/local; semua aset berlisensi tercatat. No CDN requirement. Portrait narration bernada hangat/melankolis, tidak voice acting full sebagai gate.

Crystal adalah currency earnable lokal, **bukan premium paid currency**. Tidak ada ads, gacha, battle pass, IAP, stamina timer. Title premium casual tidak memberi izin monetisasi. [UX art dan icon](UX-ART.md).

## 11. Core risks

Scope membesar menjadi tiga progression system; UI saja tidak cukup. Shared wallet + manual save menciptakan dupe/rewind risks; normalisasi build migration bukan copy/paste gear. Party 1 membutuhkan tank/heal counter tanpa memaksa job tertentu. Formula stats dan banyak Ultra rawan proc loop. Cerita tentang masa depan yang dicuri harus punya aturan agar twist tidak terasa sewenang-wenang.

Semua diturunkan menjadi testable gates di [production R1](NEXT-PRODUCTION-R1.md). Full production berarti scope disetujui, dites, ada rollback dan remote verification—bukan dokumen panjang saja.
