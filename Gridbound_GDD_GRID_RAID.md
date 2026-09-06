# Gridbound: Ashes of the Bell — GDD v0.3

This document describes the implemented browser game. The earlier, broader proposal is archived in [docs/GDD-PROTOTYPE-ARCHIVE.md](docs/GDD-PROTOTYPE-ARCHIVE.md). Runtime TypeScript is authoritative; this document and data/database.json are generated from those definitions. Story spoilers follow.

## 1. Product and pillars

A mobile-friendly real-time grid RPG with an authored four-act campaign and repeatable raids/roguelike. Preparation creates a build; taps create tempo; telegraphs create tactical decisions. The story concerns memory, consent and the cost of a sanctuary that refuses to let tomorrow happen. The town is a preparation hub with war table, training, forge, bestiary and journal—not a free-roaming walking simulation.

## 2. Full playable loop

Town → assign two skills, talents, job and three equipment slots → place heroes → depart → read encounter beat → Begin → waves → miniboss → boss → return with banked loot and first-clear progression. Chapters 1–4 have four stages each; chapters 5–16 have five. There are 76 encounters, not 76 unique enemy models. HP, cooldown, formation and potion attrition carry between stages; surviving heroes receive a small 8% HP breather. Downed allies remain down until town. Quitting or losing an unfinished expedition forfeits carried loot. Replaying a completed chapter grants encounter gold but not another level or recruit.

## 3. Input and pacing

Tap the sprite-area button marked TAP ↓ CD. A separate small chip beneath it changes stance. At tested mobile widths the chip is 24 px high and the tap area at least 44 px high; they do not overlap. Larger skill and movement alternatives exist in the selected-character panel. Two simultaneous touches can accelerate separate heroes. Drag/swap uses atomic grid relocation with 0.9 seconds cooldown penalty, except preparation is free. Relocation talents/boons reduce that penalty. Stance switching preserves normalized cooldown progress.

A fresh tap removes 0.62 seconds before talents; an accepted sync tap removes 0.85. Repeats within 0.11 seconds are rejected. Fatigue reduces the bonus, encouraging rotation. The simulation ticks at 60 Hz independently of rendering. It uses seeded RNG and has terminal-state guards.

## 4. Characters and recruitment

Start with Aldric, Lyra and Rowan. Additional recruits arrive on first clears of the opening four chapters, ultimately forming a nine-hero party. Recruitment assigns an unoccupied formation tile.

| Hero | Basic job | Biography |
| --- | --- | --- |
| Aldric | warrior | Aldric mengingat semua cara melindungi orang lain, tetapi tidak ingat siapa yang pertama ia lindungi. Perisainya memiliki goresan yang tidak sesuai dengan usianya. Ia belajar bahwa menjaga seseorang tidak berarti memiliki masa depannya. |
| Bran | warrior | Bran selalu datang membawa perisai cadangan. Ia pernah terlambat satu kali dan tidak bisa menjelaskan mengapa rasa bersalah itu terasa lebih tua dari dirinya. Ia ingin sebuah kemenangan yang tidak meninggalkan siapa pun. |
| Sable | rogue | Sable mencuri benda yang pemiliknya mengaku tidak pernah punya. Ia menyimpan kuitansi, bukan trofi. Di kota yang bisa melupakan kontrak, seorang pencuri mungkin menjadi satu-satunya saksi yang menyimpan bukti. |
| Rowan | archer | Rowan mengenali setiap burung dari nadanya. Ketika harga sebuah penyeberangan adalah lagu ibunya, ia harus memilih antara mendapatkan masa lalunya kembali atau memberi orang lain jalan pulang. |
| Lyra | healer | Lyra selalu tahu obat untuk luka yang belum pernah ia lihat. Ia takut kebaikannya hanya perintah yang ditanamkan. Kisahnya bukan mencari bukti bahwa ia pernah manusia, tetapi memilih apa yang akan ia lakukan hari ini. |
| Kestrel | archer | Kestrel membawa lonceng kecil yang tak terhubung ke menara. Ia mengajari warga bahwa tanda bahaya dapat menjadi ajakan saling menjaga, bukan perintah untuk menyerahkan pilihan. |
| Nyx | rogue | Nyx adalah pengukir yang mengingat bengkel sebelum bangunannya ada. Ia menulis nama-nama di bahan yang sulit dihapus. Keahliannya memberi bentuk pada hal-hal yang baru berani memilih untuk ada. |
| Orin | wizard | Orin menulis prediksi di buku yang terus mengoreksi dirinya sendiri. Ia terpaksa memilih antara peta yang selalu benar dan masa depan yang belum ditentukan. Hal paling berani yang ia lakukan adalah menutup bukunya. |
| Mira | healer | Mira merawat hal-hal kecil: obat, jalur evakuasi, kursi sekolah yang kosong. Ketika para pahlawan sibuk memecahkan rahasia, ia membangun cara hidup yang tidak perlu mengorbankan seseorang agar terasa aman. |

## 5. Jobs and specialization

Each basic job branches into two mutually exclusive advanced jobs at party level 4; each advanced job leads to one third job at level 10. A third job requires the correct advanced parent. Advanced promotion costs 180g; third promotion costs 420g. Promoting opens an active skill and a passive specialty. The player must explicitly equip the unlocked skill into one of the two slots. Third jobs retain access to their parent skill. A full respec refunds talents and both promotion steps exactly once; equipped gear remains owned.

| Basic | Advanced → third | Specialty | Signature |
| --- | --- | --- | --- |
| warrior | Paladin → Aegis Sovereign | Shield yang diberikan +35%. Menjaga lane menjadi sumber pertahanan party. / Sanctuary tetap aktif. Mulai tiap expedition dengan barrier 25% max HP. | Consecration → Worldwall |
| warrior | Berserker → Crimson Warlord | Saat HP di bawah 50%, power +40%. Damage besar, jangan kehilangan healer. / Rage tetap aktif; setiap cast ofensif memulihkan 8% power skill. | Blood Oath → Red Horizon |
| rogue | Duelist → Blade Saint | Cast ofensif memulihkan 12% power. Duel panjang menjadi sumber sustain. / Leech tetap aktif. Setiap cast kelima memicu 40% echo damage. | Riposte → Thousand Cuts |
| rogue | Nightblade → Veil Reaper | Power +35% ketika musuh utama di bawah 40% HP. / Execute tetap aktif. Mulai expedition dengan barrier 25% HP. | Black Warrant → Unwritten Name |
| archer | Marksman → Astral Deadeye | Setiap cast ofensif ketiga menghasilkan 1,6× power; tidak bergantung RNG. / Precision tetap aktif. Cast ofensif kelima menghasilkan echo 40%. | Deadeye → Falling Constellation |
| archer | Wild Ranger → Wild Warden | Semua serangan ke minion +45%. Membersihkan lane membuka boss. / Hunter tetap aktif. Membunuh minion memulihkan party 18 HP. | Briar Volley → Thorn Silence |
| healer | Dawn Priest → Ember Seraph | Heal dan regenerasi yang diberikan +30%. / Mercy tetap aktif. 25% overheal berubah menjadi barrier. | Sunwell → Second Sunrise |
| healer | War Cantor → Bell Oracle | Buff berlangsung 3 detik lebih lama. Setiap cast menambah 2 Resolve. / Hymn tetap aktif. Mulai expedition dengan barrier 25% HP. | March of Embers → Silence Between Bells |
| wizard | Elementalist → Prismatic Archon | Power skill AoE +30%. AoE mage tetap menghantam boss dan minion. / Elements tetap aktif. Cast ofensif kelima menghasilkan echo 40%. | Cinder Sea → Prismatic Ruin |
| wizard | Chronist → Last Hourkeeper | Semua cooldown milik hero ini 15% lebih cepat. / Tempo Chronist tetap aktif. Setiap cast memperlambat intent berikutnya 0,25 detik. | Stolen Second → Tomorrow on Loan |

## 6. Active skill database

Forty definitions: four foundational and four job-specific skills per basic job. Only two are equipped per hero.

### Warrior

| Index | Skill | Kind | Cooldown | Power | Effect |
| --- | --- | --- | --- | --- | --- |
| 0 | Cleave | attack | 4.2 | 59 | Tebasan 59 damage pada musuh di lane yang sama. Mengisi stagger boss. |
| 1 | Bulwark | shield | 5.2 | 88 | 88 shield untuk diri dan rekan satu lane. Siapkan sebelum hantaman boss. |
| 2 | Shield Bash | interrupt | 6.2 | 48 | 48 damage ke boss dan batalkan ritual all-grid aktif. Timing cast dengan tap. |
| 3 | Rallying Wall | partyshield | 8 | 54 | 54 shield untuk seluruh party. Lebih lambat dari Bulwark, melindungi semua lane. |
| 4 | Consecration | partyshield | 7 | 75 | 75 shield ke seluruh party, diperkuat Sanctuary. |
| 5 | Blood Oath | attack | 4.8 | 112 | 112 damage. Rage memberi +40% power saat HP di bawah 50%. |
| 6 | Worldwall | partyshield | 9 | 122 | 122 barrier ke seluruh party. Jawaban untuk tekanan seluruh grid. |
| 7 | Red Horizon | aoe | 7 | 220 | 220 damage ke boss, 55% power ke setiap minion. |
### Rogue

| Index | Skill | Kind | Cooldown | Power | Effect |
| --- | --- | --- | --- | --- | --- |
| 0 | Twin Fang | attack | 2.8 | 43 | Dua tebasan cepat dengan total 43 damage pada lane yang sama. |
| 1 | Pilfer | steal | 4 | 21 | 21 damage dan curi 8 gold dari kantong encounter. Maksimal 120 gold. |
| 2 | Expose | mark | 5 | 42 | 42 damage dan tandai boss selama 4 detik: semua serangan +20% damage. |
| 3 | Smoke Covenant | partyshield | 7 | 40 | 40 shield untuk seluruh party dan 2 detik buff untuk diri sendiri. |
| 4 | Riposte | attack | 3.4 | 70 | 70 damage dan pemulihan dari Leech. |
| 5 | Black Warrant | mark | 5.5 | 68 | 68 damage dan 4 detik Expose: party damage +20%. |
| 6 | Thousand Cuts | attack | 5 | 151 | 151 damage. Frekuensi cast membantu echo Blade Saint. |
| 7 | Unwritten Name | attack | 7.8 | 265 | 265 damage, diperkuat execute saat boss terluka. |
### Archer

| Index | Skill | Kind | Cooldown | Power | Effect |
| --- | --- | --- | --- | --- | --- |
| 0 | Split Arrow | aoe | 4.4 | 48 | 48 damage terbagi ke minion; jika lane bersih, semua panah mengenai boss. |
| 1 | Pinpoint | attack | 5 | 79 | 79 damage pada target pilihan. Klik salah satu lane musuh untuk mengarahkan. |
| 2 | Silence Arrow | interrupt | 6.8 | 61 | 61 damage ke boss dan putus ritual all-grid. Hanya tersedia jika dipasang sebelum berangkat. |
| 3 | Ricochet | aoe | 5.8 | 105 | 105 power dibagi ke minion, atau seluruhnya ke boss saat lane bersih. |
| 4 | Deadeye | attack | 6 | 142 | 142 directed damage. Mengincar lane pilihan atau boss. |
| 5 | Briar Volley | aoe | 5.2 | 116 | 116 power dibagi ke minion; semuanya ke boss jika lane bersih. |
| 6 | Falling Constellation | attack | 8 | 244 | 244 directed damage. Timing Precision menentukan burst. |
| 7 | Thorn Silence | interrupt | 6 | 109 | 109 damage ke boss dan membatalkan semua ritual all-grid aktif. |
### Healer

| Index | Skill | Kind | Cooldown | Power | Effect |
| --- | --- | --- | --- | --- | --- |
| 0 | Mending Light | heal | 5 | 78 | Pulihkan 78 HP rekan paling terluka dan 20 HP pada seluruh party. |
| 1 | Battle Hymn | buff | 6 | 0 | Seluruh party mendapat +30% damage dan +20% kecepatan cooldown selama 7 detik. |
| 2 | Aegis of Dawn | partyshield | 6.5 | 51 | 51 shield untuk setiap hero. Cegah damage sebelum terjadi; tidak menghidupkan yang tumbang. |
| 3 | Wild Renewal | regen | 8 | 12 | Pulihkan seluruh party 12 HP per detik selama 6 detik. Recast memperbarui durasi, bukan menumpuk. |
| 4 | Sunwell | heal | 6 | 118 | 118 heal untuk yang paling terluka dan 20 ke seluruh party. |
| 5 | March of Embers | buff | 5.5 | 0 | Battle Hymn seluruh party; +30% damage dan +20% tempo. |
| 6 | Second Sunrise | regen | 7.5 | 22 | Pulihkan party 22 HP/detik selama 6 detik, diperkuat Mercy. |
| 7 | Silence Between Bells | interrupt | 7 | 96 | 96 damage dan batalkan ritual. Menambah Resolve dari Hymn. |
### Wizard

| Index | Skill | Kind | Cooldown | Power | Effect |
| --- | --- | --- | --- | --- | --- |
| 0 | Arc Lance | attack | 6 | 98 | 98 magic damage ke boss atau target lane pilihan. |
| 1 | Starfall | aoe | 9.4 | 160 | Ledakan 160 damage ke boss dan 95 damage ke setiap minion. Cooldown panjang. |
| 2 | Time Bomb | attack | 8 | 210 | Segel meledak setelah 1,5 detik: 210 damage. Tepatkan dengan jendela Break. |
| 3 | Null Field | interrupt | 8.5 | 100 | 100 damage dan putus ritual all-grid. Jendela kontrol kuat dengan cooldown panjang. |
| 4 | Cinder Sea | aoe | 8 | 190 | 190 damage ke boss, 55% ke setiap minion, sebelum bonus Elements. |
| 5 | Stolen Second | interrupt | 6.5 | 101 | 101 damage dan memutus ritual. Cooldown dipercepat Chronist. |
| 6 | Prismatic Ruin | aoe | 9.5 | 280 | 280 damage ke boss, 55% ke minion; bonus Elements berlaku. |
| 7 | Tomorrow on Loan | interrupt | 7.6 | 147 | 147 damage dan putus ritual; mendorong mundur jadwal intent berikutnya. |

## 7. Talent tree

Fifteen nodes per hero: thirteen passive talents and two foundational active-skill unlocks. The five classes share the passive tree; active node names/effects come from their own kit. Job advancement is a separate branch system. This does not claim fifteen bespoke passives per class.

| Node | Cost | Prerequisite | Effect |
| --- | --- | --- | --- |
| Vigor | 35 | Root | +18% max HP untuk hero ini. |
| Focus | 35 | Root | Cooldown hero ini 10% lebih cepat. |
| Tactical art | 45 | Root | Buka skill aktif ketiga, lalu pasang ke salah satu slot. |
| Mastery | 65 | focus | +18% power skill hero ini, termasuk heal dan shield. |
| Signature art | 80 | active-2 | Buka skill aktif keempat. Tetap hanya dua slot saat bertarung. |
| Iron Constitution | 100 | vigor | +20% max HP, multiplicative dengan Vigor. |
| Flow State | 110 | focus | +8% tempo. |
| Grandmaster | 150 | mastery | +20% skill power. |
| Fortitude | 95 | vigor | Damage masuk −10%, sebelum shield. |
| Shelter | 100 | fortitude | Mulai expedition dengan barrier 20% HP. |
| Open Heart | 90 | vigor | Heal diterima +15%. |
| Momentum | 110 | focus | Tap fresh mengurangi tambahan 0,2s cooldown; fatigue tetap berlaku. |
| Composure | 95 | focus | Pemulihan fatigue 50% lebih cepat. |
| Footwork | 100 | composure | Penalti relokasi diri turun ke 0,45s. |
| Conviction | 120 | mastery | Setiap cast menambah 2 Resolve. |

## 8. Equipment and economy

Three slots: weapon, armor and charm. Each has three authored options. Buying records ownership per hero; switching an owned item is free and repeated equip cannot deduct currency twice. There are no loot boxes, random affixes or monetization. Currency is earned in encounters and banked at expedition completion. Skill/gear/job effects alter the simulation, not just labels.

| Item | Slot | Cost | Effect |
| --- | --- | --- | --- |
| Forged Edge | weapon | 65 | +15% skill power. |
| Quicksteel | weapon | 95 | +6% power, +12% tempo. |
| Oathbound Relic | weapon | 180 | +26% power, +8% HP, −5% tempo. |
| Oak Plate | armor | 70 | +22% max HP. |
| Wayfarer Cloak | armor | 100 | +10% HP, +8% tempo. |
| Bellmetal Plate | armor | 170 | +36% HP, −5% tempo. |
| Ember Pendant | charm | 60 | +10% power, +5% HP. |
| Clockseed | charm | 95 | +13% tempo. |
| Hearthstone | charm | 110 | +18% HP, +4% tempo. |

## 9. Enemy AI and counterplay

Intent selection is an authored per-archetype pattern with phase-dependent pace and seeded lane/tile choices, not a machine-learned agent. Marked weakest-target attacks choose the lowest living HP ratio. Strongest-target attacks rank living skill throughput. Their marker follows the hero until resolution; dragging does not evade a tracking attack. Front-row, lane breath and meteor attacks stay at their ground locations. Ritual attacks target all nine tiles. Guard mitigates party damage by 65% for 2.3 seconds with a 12-second cooldown. Interrupt skills can cancel an all-grid ritual; ultimate also interrupts. Shield/heal timing gives additional counterplay. Encounters enrage after 150 seconds.

The eight base silhouettes have ash/frost/auric palette variants. Variants also adjust intent order or cadence. Strength in campaign additionally comes from encounter HP and chapter scaling.

| Monster | Title | Pattern | Counter |
| --- | --- | --- | --- |
| Ashfang | CINDER WOLF | weakest → front → strongest | Marked mengikuti hero. Pulihkan target atau lindungi dengan Guard; hindari sapuan tanah. |
| Scrap Marshal | GOBLIN WAR BAND | strongest → strongest → meteor → weakest | Strongest dihitung dari power skill per cooldown. Ganti stance sebelum mark untuk mengubah prioritas musuh. |
| Silk Widow | VENOM BROOD | weakest → meteor → all | Keluar dari tile web sebelum impact. Simpan Guard untuk venom seluruh grid. |
| Hollow Cantor | BELL CULT SHAMAN | all → weakest → breath | All-grid bisa diputus Shield Bash, Silence Arrow, atau Null Field. Tanpa skill itu, timing Party Guard. |
| Ironroot | RUIN GOLEM | front → strongest → all | Front mengikuti ROW terdepan yang dihuni saat telegraph dimulai, bukan selalu row pertama. Reposisi setelah tanda muncul. |
| The Unburied | OATHBOUND WRAITH | weakest → all → strongest | Heal menjelang mark, Guard saat ratapan. Bunuh spirit minion agar mereka tidak menghabisi target. |
| Mournbark | ANCIENT TREANT | front → all → meteor | Jangan bertahan di front yang ditandai. Guard spora atau interrupt; shield satu lane membantu attrition. |
| Vharok | THE EMERALD GATE | breath → front → meteor → all | Baca empat pola. Sisakan Guard untuk Cataclysm; phase lanjut menambahkan aftershock tertunda. |
| Ashbound Ashfang | ASHBOUND · CINDER WOLF | weakest → front → strongest | Marked mengikuti hero. Pulihkan target atau lindungi dengan Guard; hindari sapuan tanah. |
| Frostbound Ashfang | FROSTBOUND · CINDER WOLF | front → strongest → weakest | Marked mengikuti hero. Pulihkan target atau lindungi dengan Guard; hindari sapuan tanah. |
| Gilded Ashfang | GILDED · CINDER WOLF | strongest → weakest → front | Marked mengikuti hero. Pulihkan target atau lindungi dengan Guard; hindari sapuan tanah. |
| Ashbound Scrap Marshal | ASHBOUND · GOBLIN WAR BAND | strongest → strongest → meteor → weakest | Strongest dihitung dari power skill per cooldown. Ganti stance sebelum mark untuk mengubah prioritas musuh. |
| Frostbound Scrap Marshal | FROSTBOUND · GOBLIN WAR BAND | strongest → meteor → weakest → strongest | Strongest dihitung dari power skill per cooldown. Ganti stance sebelum mark untuk mengubah prioritas musuh. |
| Gilded Scrap Marshal | GILDED · GOBLIN WAR BAND | meteor → weakest → strongest → strongest | Strongest dihitung dari power skill per cooldown. Ganti stance sebelum mark untuk mengubah prioritas musuh. |
| Ashbound Silk Widow | ASHBOUND · VENOM BROOD | weakest → meteor → all | Keluar dari tile web sebelum impact. Simpan Guard untuk venom seluruh grid. |
| Frostbound Silk Widow | FROSTBOUND · VENOM BROOD | meteor → all → weakest | Keluar dari tile web sebelum impact. Simpan Guard untuk venom seluruh grid. |
| Gilded Silk Widow | GILDED · VENOM BROOD | all → weakest → meteor | Keluar dari tile web sebelum impact. Simpan Guard untuk venom seluruh grid. |
| Ashbound Hollow Cantor | ASHBOUND · BELL CULT SHAMAN | all → weakest → breath | All-grid bisa diputus Shield Bash, Silence Arrow, atau Null Field. Tanpa skill itu, timing Party Guard. |
| Frostbound Hollow Cantor | FROSTBOUND · BELL CULT SHAMAN | weakest → breath → all | All-grid bisa diputus Shield Bash, Silence Arrow, atau Null Field. Tanpa skill itu, timing Party Guard. |
| Gilded Hollow Cantor | GILDED · BELL CULT SHAMAN | breath → all → weakest | All-grid bisa diputus Shield Bash, Silence Arrow, atau Null Field. Tanpa skill itu, timing Party Guard. |
| Ashbound Ironroot | ASHBOUND · RUIN GOLEM | front → strongest → all | Front mengikuti ROW terdepan yang dihuni saat telegraph dimulai, bukan selalu row pertama. Reposisi setelah tanda muncul. |
| Frostbound Ironroot | FROSTBOUND · RUIN GOLEM | strongest → all → front | Front mengikuti ROW terdepan yang dihuni saat telegraph dimulai, bukan selalu row pertama. Reposisi setelah tanda muncul. |
| Gilded Ironroot | GILDED · RUIN GOLEM | all → front → strongest | Front mengikuti ROW terdepan yang dihuni saat telegraph dimulai, bukan selalu row pertama. Reposisi setelah tanda muncul. |
| Ashbound The Unburied | ASHBOUND · OATHBOUND WRAITH | weakest → all → strongest | Heal menjelang mark, Guard saat ratapan. Bunuh spirit minion agar mereka tidak menghabisi target. |
| Frostbound The Unburied | FROSTBOUND · OATHBOUND WRAITH | all → strongest → weakest | Heal menjelang mark, Guard saat ratapan. Bunuh spirit minion agar mereka tidak menghabisi target. |
| Gilded The Unburied | GILDED · OATHBOUND WRAITH | strongest → weakest → all | Heal menjelang mark, Guard saat ratapan. Bunuh spirit minion agar mereka tidak menghabisi target. |
| Ashbound Mournbark | ASHBOUND · ANCIENT TREANT | front → all → meteor | Jangan bertahan di front yang ditandai. Guard spora atau interrupt; shield satu lane membantu attrition. |
| Frostbound Mournbark | FROSTBOUND · ANCIENT TREANT | all → meteor → front | Jangan bertahan di front yang ditandai. Guard spora atau interrupt; shield satu lane membantu attrition. |
| Gilded Mournbark | GILDED · ANCIENT TREANT | meteor → front → all | Jangan bertahan di front yang ditandai. Guard spora atau interrupt; shield satu lane membantu attrition. |
| Ashbound Vharok | ASHBOUND · THE EMERALD GATE | breath → front → meteor → all | Baca empat pola. Sisakan Guard untuk Cataclysm; phase lanjut menambahkan aftershock tertunda. |
| Frostbound Vharok | FROSTBOUND · THE EMERALD GATE | front → meteor → all → breath | Baca empat pola. Sisakan Guard untuk Cataclysm; phase lanjut menambahkan aftershock tertunda. |
| Gilded Vharok | GILDED · THE EMERALD GATE | meteor → all → breath → front | Baca empat pola. Sisakan Guard untuk Cataclysm; phase lanjut menambahkan aftershock tertunda. |

## 10. Campaign: four acts

Narrative is authored prose in Indonesian with English chapter/skill names. Chapter intros establish the mission, intermediate stages carry short story beats, and clear results deliver the next reveal. Cleared chapter intros/outros remain readable in the town journal. The ending is authored and singular, not a branching-choice system. Full text is preserved in data/database.json and src/game/story.ts.

### 1. Ashwood Trail

Follow the missing scouts

**LYRA · AT THE NORTH GATE**

Sable seharusnya pulang sebelum lonceng senja. Yang kembali hanya panah patah dan jejak serigala. Aldric mengangkat perisainya. Rowan menunjuk bara di antara pohon: seseorang masih hidup di sana.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| The scent of cinders | wave | wolf | 770 | Opening-act encounter |
| Scavenger barricade | wave | goblin | 1034 | Opening-act encounter |
| Silk across the path | miniboss | spider | 1540 | Opening-act encounter |
| The root that remembers | boss | treant | 2530 | Opening-act encounter |

**Aftermath:** Sable terlepas dari akar yang membelenggunya. Di tangannya ada pecahan segel pertama. “Mereka tidak membakar hutan,” katanya. “Mereka sedang membangunkan sesuatu di bawahnya.” Lonceng Emberhollow berbunyi lagi.

Reward: 95g zone bonus. Recruits: Sable.

### 2. Sunken Ruins

Find the voice beneath the stone

**SABLE · THE BROKEN BRIDGE**

Pecahan segel bergetar dekat reruntuhan. Orin, seorang peneliti yang hilang, meninggalkan rune di batu: JANGAN IKUTI SUARANYA. Dari bawah jembatan, suara Orin meminta pertolongan.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Stolen relics | wave | goblin | 1760 | Opening-act encounter |
| The false voice | wave | shaman | 2200 | Opening-act encounter |
| Warden of the bridge | miniboss | golem | 3520 | Opening-act encounter |
| The oath below | boss | wraith | 5280 | Opening-act encounter |

**Aftermath:** Orin memutus nyanyian palsu dengan segel kedua. Suara itu bukan miliknya, melainkan gema sumpah para penjaga lama. “Empat segel bukan penjara,” ia berkata. “Mereka menahan mimpi seekor naga.”

Reward: 150g zone bonus. Recruits: Orin.

### 3. Blackbriar Keep

Break the siege, ring the bell

**ORIN · THE SIEGE ROAD**

Bran dan Kestrel masih menjaga menara luar, tetapi akarnya sudah menembus tembok. Jika lonceng ketiga runtuh, Emberhollow kehilangan perlindungannya. Tidak ada waktu menunggu pasukan lain.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Brood at the walls | wave | spider | 2860 | Opening-act encounter |
| The hungry vanguard | wave | wolf | 3190 | Opening-act encounter |
| Cantor of the siege | miniboss | shaman | 5060 | Opening-act encounter |
| Ironroot awakens | boss | golem | 8360 | Opening-act encounter |

**Aftermath:** Bran menahan pintu sementara Kestrel menyalakan lonceng ketiga. Mereka ikut pulang, membawa peta gerbang. Dari kejauhan terdengar sayap: Vharok sudah membuka satu mata.

Reward: 215g zone bonus. Recruits: Bran, Kestrel.

### 4. The Emerald Gate

Wake the guardian, not the hunger

**ALDRIC · THE LAST CAMPFIRE**

Nyx dan Mira menjaga segel terakhir sendirian. Di seberang gerbang, naga memimpikan hutan tanpa manusia. Kita tidak datang untuk membunuh penjaganya. Kita datang untuk menghentikan apa yang sedang memakan mimpinya.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Echoes of the lost | wave | wraith | 4400 | Opening-act encounter |
| The final chorus | wave | shaman | 5170 | Opening-act encounter |
| Heart of the forest | miniboss | treant | 7700 | Opening-act encounter |
| A guardian dreaming | boss | dragon | 13640 | Opening-act encounter |

**Aftermath:** Cahaya empat segel bertemu di dada Vharok. Naga itu menunduk, bukan kalah, melainkan terbangun. Nyx dan Mira membawa api terakhir pulang. Untuk pertama kalinya, lonceng Emberhollow berbunyi bukan sebagai peringatan. Di bawah menara, masih ada satu tangga yang belum dijelajahi…

Reward: 320g zone bonus. Recruits: Nyx, Mira.

### 5. The Empty Census

ACT II · A town that forgot its children

**MIRA · THE SCHOOLHOUSE**

Pagi setelah Vharok terbangun, lonceng berbunyi tujuh belas kali. Tidak ada yang tahu mengapa. Mira menemukan tujuh belas kursi kecil di sekolah; warga bersikeras Emberhollow tidak pernah punya anak.

Di belakang papan tulis, sebuah garis tinggi badan ditulis dengan tangan Aldric. Namanya bukan nama anak. Namanya sendiri. Garis terakhir bertanggal besok.

Kita pergi mencari arsip sekolah di desa sebelah. Lyra membawa bekal untuk empat orang, lalu menatap tiga kantong yang tersisa. Ia tidak ingat siapa yang hilang.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Empty Census | wave | wolf-ash | 9672 | Mainan dari arang terserak di jalan. Jejak kecil berhenti tepat di tepi wilayah lonceng. |
| Pursuit · The Empty Census | wave | goblin-ash | 11284 | Pemulung memakai lencana murid. Mereka mempertahankan kotak makan kosong, bukan harta. |
| Pressure · The Empty Census | wave | spider-ash | 13098 | Di dalam kepompong: daftar nama, dibungkus agar tidak dicuri angin. |
| The threshold · The Empty Census | miniboss | shaman | 19143 | Cantor bernyanyi memakai suara anak yang tak seorang pun bisa ingat. |
| The reckoning · The Empty Census | boss | golem-ash | 32240 | Ironroot menutupi pintu arsip. Di pelat dadanya terukir: JANGAN BIARKAN MEREKA MEMBAYAR DUA KALI. |

**Aftermath:** Buku sensus tersimpan di rongga Ironroot. Setiap halaman memiliki cap lonceng. Tujuh belas nama telah dicoret, tetapi tinta di ujung jarinya masih basah.

Aldric membaca salah satunya: Elian. Ia tidak mengenali nama itu. Tubuhnya menangis lebih dulu. Di samping nama tersebut, tulisan tangannya berbunyi: SAYA SETUJU MENUKARNYA.

Reward: 330g zone bonus. Recruits: none.

### 6. The Glass Ferry

ACT II · Pay the river with a memory

**NYX · AT THE WATERLINE**

Sensus menyebut sebuah kapal yang menyeberang tanpa penumpang. Nyx mengenali lambang di tiket: bengkel tempat ia belajar mengukir. Bengkel itu belum dibangun.

Penjaga feri menerima ingatan sebagai ongkos. Sable menawarkan ingatan tentang dompet yang pernah ia curi. Penjaga menolak: “Bukan sesuatu yang ingin kau lupakan.”

Rowan menyerahkan lagu yang diajarkan ibunya. Ia masih ingat wajahnya, tetapi saat mencoba bersenandung, tak ada suara. Kita naik sebelum harga tiket berubah.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Glass Ferry | wave | spider-ash | 12648 | Air memantulkan party dengan satu orang tambahan. Jangan menoleh mencari wajahnya. |
| Pursuit · The Glass Ferry | wave | wolf-ash | 14756 | Bayangan di air terluka sebelum hero yang di darat terkena serangan. |
| Pressure · The Glass Ferry | wave | wraith | 17128 | Gema menyerang yang paling rapuh: ia tahu tepat bagaimana luka itu dibuat. |
| The threshold · The Glass Ferry | miniboss | goblin-ash | 25033 | Awak feri menumpuk tiket bertuliskan satu tanggal yang sama. |
| The reckoning · The Glass Ferry | boss | wraith-ash | 42160 | Pengemudi melepas topeng. Tidak ada wajah, hanya mulut yang menyanyikan lagu Rowan. |

**Aftermath:** Di seberang, lagu Rowan terdengar dari mulut makhluk yang kita kalahkan. Wraith menyerahkan tiket balik: penumpangnya tercatat sebagai bahan bakar, bukan warga.

Lonceng tidak mengusir monster. Lonceng memisahkan ingatan yang menyakitkan dari pemiliknya. Yang dibuang ke hutan belajar berjalan. Monster pertama yang kita bunuh mungkin pernah menjadi rasa takut kita sendiri.

Reward: 375g zone bonus. Recruits: none.

### 7. The Choir Ward

ACT II · The healer who remembers too much

**LYRA · OUTSIDE THE WHITE WARD**

Lyra meminta kita tidak masuk rumah sakit lama. Ia mengenali setiap jendela meski bangunan itu ditinggalkan sebelum ia lahir.

Di kamar paling ujung, ada sembilan tempat tidur. Buku perawat mencatat nama party kita, kecuali Lyra. Namanya ada di sampul sebagai kepala percobaan.

“Kalau aku meminta kalian melupakan ini,” katanya, “jangan percaya aku.” Ia menyerahkan kunci ruangan kepada Sable dan berjalan paling depan.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Choir Ward | wave | shaman-ash | 15984 | Botol obat berlabel kata-kata: amarah, rindu, malu. Semuanya kosong. |
| Pursuit · The Choir Ward | wave | spider-ash | 18648 | Catatan perawatan selalu berakhir pada hari yang sama, lalu dimulai kembali. |
| Pressure · The Choir Ward | wave | goblin-ash | 21645 | Sebuah pesan ditulis di bawah ranjang: jika Lyra lupa, tolong ingatkan bahwa ia pernah baik. |
| The threshold · The Choir Ward | miniboss | wraith-ash | 31635 | Cantor menuntut Lyra pulang ke penciptanya. Party berdiri menghalangi pintu. |
| The reckoning · The Choir Ward | boss | shaman-ash | 53280 | Choirmaster mengaku dapat membuat rasa bersalah Lyra hilang. Ia menolak dengan mengangkat tongkatnya. |

**Aftermath:** Lyra bukan kepala percobaan. Ia adalah ingatan rasa bersalah milik kepala percobaan, diberi tubuh agar dapat merawat para korban. Tidak ada tanggal lahirnya; hanya tanggal keputusan untuk menyesal.

Aldric tidak mengangkat senjata. “Kau sudah menyelamatkanku berkali-kali. Itu cukup nyata.” Untuk pertama kalinya, Lyra memilih namanya sendiri alih-alih nama dalam arsip.

Reward: 420g zone bonus. Recruits: none.

### 8. The Thirteenth Stroke

ACT II · Return to a sanctuary that hunts

**SABLE · EMBERHOLLOW EAST WALL**

Pulang seharusnya aman. Namun jam kota berhenti pada pukul tiga belas dan pintu rumah tidak mengenali pemiliknya.

Wali kota menunjukkan kontrak: semua warga pernah memilih perlindungan lonceng. Bahkan Aldric. Yang tidak tertulis adalah bahwa persetujuan itu diperbarui setiap kali ingatan mereka dihapus.

Vharok mendarat tanpa menyerang. Ia menunggu jawaban kita. Mengembalikan segel telah memperbaiki mesin yang seharusnya kita hentikan.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Thirteenth Stroke | wave | goblin-ash | 19680 | Penjaga gerbang membaca perintah dengan suara wali kota, tetapi bibirnya tidak bergerak. |
| Pursuit · The Thirteenth Stroke | wave | wolf-ash | 22960 | Monster mengambil jalan pulang seolah mereka pernah tinggal di sini. |
| Pressure · The Thirteenth Stroke | wave | treant-ash | 26650 | Akar membentuk dinding di sekitar menara, bukan untuk menyerang kota: untuk mengurung lonceng. |
| The threshold · The Thirteenth Stroke | miniboss | golem-ash | 38950 | Kestrel membunyikan lonceng kecilnya sendiri agar warga menemukan jalur evakuasi. |
| The reckoning · The Thirteenth Stroke | boss | dragon-ash | 65600 | Vharok menahan mesin dengan tubuhnya. Hancurkan simpul yang menguasainya, bukan sang penjaga. |

**Aftermath:** Kita memutus pengulang di menara. Ingatan warga kembali sekaligus: cinta, kehilangan, dan semua janji yang mereka langgar. Tidak ada perayaan. Ada rumah yang pintunya dibuka kembali untuk orang asing yang ternyata keluarga.

Dari dalam lonceng, terdengar suara Elian: “Ayah, ini bukan putaran pertama.” Aldric menatap bekas luka yang selalu ia anggap tanda kemenangan. Ternyata itu tanda jumlah kegagalannya.

Reward: 465g zone bonus. Recruits: none.

### 9. Winter Ledger

ACT III · A history written in future tense

**ORIN · THE NORTHERN ARCHIVE**

Mesin masih memiliki jantung jauh di utara. Orin membawa peta yang berubah setiap malam. Satu rute selalu kembali ke menara; rute lain belum pernah dicoba.

Arsip beku menyimpan surat-surat yang ditulis party pada putaran sebelumnya. Sebagian meminta kita menyerah. Satu surat dari Bran hanya berkata: “Aku selalu datang terlalu terlambat. Kali ini tunggu aku.”

Kita menunggu. Di atas salju, untuk pertama kalinya, ada sembilan pasang jejak yang berjalan bersama.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · Winter Ledger | wave | wolf-frost | 23736 | Tulisan di salju muncul sebelum langkah kaki kita menyentuhnya. |
| Pursuit · Winter Ledger | wave | spider-frost | 27692 | Sarang es menyimpan surat dari diri kita yang lebih tua. |
| Pressure · Winter Ledger | wave | goblin-frost | 32143 | Pemulung membakar halaman yang belum kita baca. Mereka takut pada isinya. |
| The threshold · Winter Ledger | miniboss | golem-frost | 46978 | Penjaga arsip menghitung sembilan pengunjung, lalu memanggil sepuluh nama. |
| The reckoning · Winter Ledger | boss | wraith-frost | 79120 | Wraith menawarkan satu masa depan tanpa kehilangan. Harganya adalah semua masa depan yang lain. |

**Aftermath:** Catatan terakhir menjelaskan mengapa penjara itu berulang. Jantung mesin bernama Elian, tetapi ia bukan anak yang ditawan. Ia adalah masa depan Elian yang tidak jadi terjadi, dijahit dari semua kemungkinan yang ditukar demi menyelamatkan kota.

Aldric tidak memilih melupakan anaknya. Ia memilih menyerahkan hari esok anaknya agar semua orang punya hari ini. Mesin menghapus ingatannya supaya ia sanggup memilih hal yang sama lagi.

Reward: 510g zone bonus. Recruits: none.

### 10. The Unborn Orchard

ACT III · Harvest what never happened

**ROWAN · BENEATH THE PALE TREES**

Pohon utara tidak berbuah apel. Di setiap dahan tergantung sebuah kemungkinan: tangan yang sempat ditolong, surat yang sempat dikirim, seorang anak yang sempat dewasa.

Rowan menemukan lagunya. Jika dipetik, ia akan ingat kembali suara ibunya. Namun dahan itu juga menyangga jalur untuk para pengungsi. Ia membiarkannya tumbuh.

Kita mencari benih yang bisa menumbuhkan waktu tanpa memakannya. Para penjaga kebun mengenali Aldric sebagai pemilik pertama kapak itu.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Unborn Orchard | wave | spider-frost | 28152 | Setiap buah menampilkan wajah yang hampir kita kenal. |
| Pursuit · The Unborn Orchard | wave | treant-frost | 32844 | Mournbark melindungi dahan muda dengan tubuhnya yang retak. |
| Pressure · The Unborn Orchard | wave | wolf-frost | 38123 | Ashfang tidak memburu kita; ia memburu bayangan masa depan di belakang kita. |
| The threshold · The Unborn Orchard | miniboss | shaman-frost | 55718 | Cantor menukar suara-suara kemungkinan sampai tidak bisa menyebut namanya sendiri. |
| The reckoning · The Unborn Orchard | boss | treant-frost | 93840 | Jangan bakar akar. Lepaskan parasit yang hidup dari janji tidak ditepati. |

**Aftermath:** Benih yang kita dapat tidak memulihkan masa lalu. Ia membiarkan dua hal benar sekaligus: kota pernah diselamatkan, dan caranya salah.

Lyra berhenti mencoba membuktikan bahwa ia manusia. Ia mulai bertanya kehidupan seperti apa yang ingin ia jalani. Di belakang kita, kebun berbunga untuk sesuatu yang belum hilang.

Reward: 555g zone bonus. Recruits: none.

### 11. Nine Funerals

ACT III · Fight the party that took the easier road

**BRAN · THE NAMELESS CEMETERY**

Sembilan makam menunggu kita, lengkap dengan tanggal yang belum tiba. Bran mengenali batu nisannya: ia sendiri yang memahatnya pada putaran ketika seluruh party pulang kecuali dirinya.

Di balik makam berdiri penjaga-penjaga putih. Mereka bukan kita yang telah mati. Mereka adalah keputusan-keputusan kita yang memilih berhenti mencoba.

Sable menghitung senjata mereka. “Mereka tahu semua trik lama kita.” Nyx tersenyum tipis. “Untung kita sudah ganti build.”

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · Nine Funerals | wave | goblin-frost | 32928 | Sembilan lilin menyala. Nyala kesepuluh muncul ketika Lyra mendekat. |
| Pursuit · Nine Funerals | wave | wraith-frost | 38416 | Lawan menandai hero terkuat: mereka mengenali strategi kita. |
| Pressure · Nine Funerals | wave | shaman-frost | 44590 | Nama-nama di batu berubah setiap kali seseorang terluka. |
| The threshold · Nine Funerals | miniboss | golem-frost | 65170 | Bran memecah perisai yang serupa miliknya. Di baliknya ada surat yang ia tak pernah kirim. |
| The reckoning · Nine Funerals | boss | wraith-frost | 109760 | Unburied meminta kita memilih siapa yang akan ditinggal. Jawab dengan membawa semua yang masih berdiri. |

**Aftermath:** Makam kosong tidak runtuh saat kita menang. Kita hanya mencabut tanggalnya. Kematian tetap mungkin; kepastian bukan takdir.

Bran meninggalkan surat di atas nisannya: kali ini kami menunggu. Kestrel mencatat semua nama agar kemenangan berikutnya tidak perlu dibayar dengan lupa.

Reward: 600g zone bonus. Recruits: none.

### 12. The Last Rehearsal

ACT III · Refuse the perfect rescue

**ELIAN · THROUGH A CRACKED BELL**

Elian akhirnya berbicara tanpa mesin. Ia menawarkan jalan aman: ulangi satu kali lagi, dengan semua ingatan dipertahankan. Kita akan tahu setiap serangan dan tidak kehilangan siapa pun.

Orin menunjukkan masalahnya. Janji itu tercatat di setiap putaran sebelumnya. Yang selalu hilang bukan ingatan mereka—melainkan kemampuan untuk percaya bahwa jalan lain mungkin.

Aldric menjawab anak yang tak pernah sempat ia kenal: “Aku tidak bisa menjanjikan kita semua selamat. Aku bisa menjanjikan aku tidak akan memilihkan hidupmu lagi.”

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Last Rehearsal | wave | wolf-frost | 38064 | Pola serangan lama datang dalam urutan baru. Pengetahuan bukan jaminan. |
| Pursuit · The Last Rehearsal | wave | shaman-frost | 44408 | Mesin meniru suara seseorang yang paling kita rindukan. |
| Pressure · The Last Rehearsal | wave | spider-frost | 51545 | Jejak pulang mulai menghilang dari peta. Tidak ada retry di dalam cerita ini. |
| The threshold · The Last Rehearsal | miniboss | treant-frost | 75335 | Vharok berdiri di depan retakan waktu, menahan seluruh kemungkinan yang ingin kembali. |
| The reckoning · The Last Rehearsal | boss | dragon-frost | 126880 | Putuskan ritus pengulang. Guard untuk yang tak bisa dihindari; lindungi yang masih bisa diselamatkan. |

**Aftermath:** Pengulang waktu pecah. Untuk pertama kalinya, jam bergerak melewati tanggal yang tercatat di semua makam. Badai datang tanpa ramalan.

Elian tidak marah. Ia takut. Ia telah hidup sebagai kemungkinan selama ratusan putaran dan belum pernah punya satu menit yang benar-benar miliknya. Kita menyalakan api dan menunggu bersama sampai menit itu selesai.

Reward: 645g zone bonus. Recruits: none.

### 13. A City Without Bells

ACT IV · Safety has to be built together

**KESTREL · THE OPEN SQUARE**

Tanpa pengulang, Emberhollow bukan benteng lagi. Warga meminta kita menyalakan mesin. Sebagian tahu harganya dan tetap memilih aman.

Mira tidak berpidato. Ia menggambar jalur evakuasi, membagikan ember, dan mengajarkan cara membaca tanda monster. Keselamatan pertama yang tidak menuntut korban tersembunyi dibuat dari pekerjaan biasa.

Kita menjaga jalan cukup lama agar kota belajar menjaga dirinya. Lonceng kecil Kestrel kini berarti berkumpul, bukan patuh.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · A City Without Bells | wave | goblin-auric | 43560 | Barikade dibuat warga, bukan sihir. Beri mereka waktu menyelesaikannya. |
| Pursuit · A City Without Bells | wave | wolf-auric | 50820 | Jaga jalan utama; yang berlari di belakang party bukan minion, melainkan tetangga. |
| Pressure · A City Without Bells | wave | spider-auric | 58988 | Mira membagi obat tanpa meminta ingatan sebagai pembayaran. |
| The threshold · A City Without Bells | miniboss | golem-auric | 86213 | Golem memakai lonceng lama sebagai perisai. Pecahkan logamnya, bukan jalan evakuasi. |
| The reckoning · A City Without Bells | boss | treant-auric | 145200 | Akar terakhir menutup saluran air. Lepaskan aliran sebelum api mencapai rumah. |

**Aftermath:** Kota bertahan tanpa menelan satu nama pun. Tidak semua bangunan selamat. Warga menuliskan yang hilang, lalu membangun lagi tanpa meminta siapa pun melupakannya.

Di bekas sekolah, Aldric menggantung tujuh belas papan nama. Satu papan dibiarkan kosong, bukan karena lupa, tetapi karena pemiliknya belum memilih nama.

Reward: 690g zone bonus. Recruits: none.

### 14. The Borrowed Crown

ACT IV · Meet the first Bellkeeper

**NYX · BELOW THE ORIGINAL TOWER**

Di bawah menara pertama, kita menemukan pencipta mesin masih hidup. Bukan wali kota, bukan naga, bukan Lyra. Ia adalah Aldric dari putaran yang paling tua.

Ia bertahan dengan menukar semua ingatan tentang dirinya kepada mesin. Yang tersisa hanya tujuan: menyelamatkan kota. Tanpa ingatan tentang siapa yang dicintainya, ia tidak lagi tahu kapan harus berhenti.

Aldric muda meletakkan pedangnya di lantai. “Kau menyimpan tujuan dan membuang alasannya.” Yang tua menjawab, “Dan kau membawa alasan tanpa rencana.”

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Borrowed Crown | wave | wraith-auric | 49416 | Mahkota di dinding dibuat dari kunci rumah yang pernah diselamatkan. |
| Pursuit · The Borrowed Crown | wave | goblin-auric | 57652 | Tentara menarget hero terkuat, sama seperti pelajaran pertama Aldric. |
| Pressure · The Borrowed Crown | wave | shaman-auric | 66918 | Ritual menawarkan perlindungan dengan harga satu rekan. Putuskan ritualnya. |
| The threshold · The Borrowed Crown | miniboss | golem-auric | 97803 | Penjaga terakhir bergerak seperti Aldric ketika melindungi Lyra. |
| The reckoning · The Borrowed Crown | boss | wraith-auric | 164720 | Hadapi tujuan yang kehilangan alasannya. Jangan biarkan party terpecah. |

**Aftermath:** Mereka tidak berdamai. Yang tua tetap yakin pengorbanannya benar. Namun saat Lyra merawat lukanya tanpa meminta balasan, ia mengingat satu nama. Bukan Elian. Nama orang yang pertama kali mengajarinya meminta maaf.

Ia menyerahkan mahkota kendali tanpa meminta pengampunan. Mesin akan berhenti hanya jika Elian sendiri melepaskannya. Kita tidak punya hak merampas keputusan itu.

Reward: 735g zone bonus. Recruits: none.

### 15. A Name for Tomorrow

ACT IV · Carry a future that cannot fight

**ELIAN · THE UNFINISHED ROOM**

Elian ingin meninggalkan mesin, tetapi ia belum punya tubuh. Benih dari kebun bisa memberinya satu kehidupan biasa. Bukan hidup yang direncanakan Aldric, bukan hidup yang dijanjikan mesin.

Konsekuensinya jelas: semua kemungkinan Elian yang lain akan berhenti. Ia tidak akan menjadi setiap hal yang bisa diinginkan ayahnya. Ia hanya akan menjadi dirinya sendiri.

“Aku mau terlambat bangun,” katanya. “Aku mau buruk dalam sesuatu dan tetap boleh belajar.” Aldric mengangguk. Party menjaga ruangan tempat hari esok mulai tumbuh.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · A Name for Tomorrow | wave | spider-auric | 55632 | Benih membutuhkan waktu. Musuh mengejar sumber cahaya di tengah ruangan. |
| Pursuit · A Name for Tomorrow | wave | wolf-auric | 64904 | Ingatan yang dibuang mencoba kembali ke mesin. Jangan biarkan mereka memakan benih. |
| Pressure · A Name for Tomorrow | wave | wraith-auric | 75335 | Wraith memakai suara Elian kecil untuk memanggil Aldric menjauh. |
| The threshold · A Name for Tomorrow | miniboss | shaman-auric | 110105 | Cantor memulai ritus terakhir. Semua tile terancam: waktunya Guard atau interrupt. |
| The reckoning · A Name for Tomorrow | boss | treant-auric | 185440 | Mournbark menawarkan akarnya sebagai tempat tumbuh. Lepaskan cengkeraman mesin dari batangnya. |

**Aftermath:** Anak yang keluar dari ruangan tidak mengingat putaran-putaran itu. Ia tidak berutang rasa terima kasih atas hidup yang baru dimulainya.

Ia memilih nama Eda. Aldric menuliskannya di papan kosong tanpa menghapus nama Elian dari sensus. Keduanya pernah berarti sesuatu. Salah satunya kini boleh berarti sesuatu yang baru.

Reward: 780g zone bonus. Recruits: none.

### 16. The Unwritten Dawn

ACT IV · The last boss is not the last word

**THE BELLKEEPERS · AT FIRST LIGHT**

Mesin yang kehilangan penjaganya melakukan satu hal terakhir: mencoba menyelamatkan dirinya. Ia mengambil bentuk semua ketakutan kota, lalu memakai Vharok sebagai sayap.

Tidak ada nubuat untuk pertarungan ini. Orin menutup bukunya. Kestrel berhenti menghitung. Lyra bertanya apakah semua sudah siap, bukan apakah semua akan selamat.

Di town, Eda mencoba bersiul. Nadanya sumbang. Itulah suara masa depan yang sedang kita pertahankan.

| Stage | Role | Enemy | Combat HP | Beat |
| --- | --- | --- | --- | --- |
| Crossing · The Unwritten Dawn | wave | goblin-auric | 62208 | Barisan mesin mengenali seluruh party. Balas dengan build yang telah kalian pilih sendiri. |
| Pursuit · The Unwritten Dawn | wave | wraith-auric | 72576 | Echo tertua menawarkan satu rewind lagi. Jalan terus. |
| Pressure · The Unwritten Dawn | wave | shaman-auric | 84240 | Setiap ritual yang diputus memberi kota satu tarikan napas. |
| The threshold · The Unwritten Dawn | miniboss | golem-auric | 123120 | Jaga yang terluka sebelum mengejar damage terakhir. Tidak ada kemenangan jika rumah kehilangan semua penghuninya. |
| The reckoning · The Unwritten Dawn | boss | dragon-auric | 207360 | Vharok masih ada di balik logam dan cahaya. Hancurkan inti, lepaskan sang penjaga. Ini bukan penyelamatan sempurna. Ini milik kita. |

**Aftermath:** Saat inti mesin padam, Vharok terbang tanpa membawa mimpi siapa pun. Tidak ada cahaya yang mengembalikan rumah-rumah, tidak ada mantra yang membatalkan luka. Hanya pagi yang datang sekali.

Lyra membuka klinik atas namanya sendiri. Sable menjaga arsip agar tidak ada kontrak yang disembunyikan. Orin menulis buku yang boleh salah. Rowan mengajarkan lagu baru kepada Eda; ia tidak perlu mendapatkan lagu lamanya kembali untuk bisa bernyanyi.

Aldric menggantung perisai di samping pintu sekolah. Lonceng baru dibuat kecil, dari logam mesin yang dilebur. Ia berbunyi untuk memanggil makan siang. Di bawahnya tertulis: YANG HILANG AKAN DIINGAT. YANG HIDUP TIDAK BERUTANG MASA DEPANNYA.

Campaign complete. Emberhollow tetap terbuka: raid hunt, respec, dan Sunken Bell menjadi tantangan postgame, bukan pengulangan ending.

Reward: 825g zone bonus. Recruits: none.


## 11. Raids and roguelike

Raid contracts select golem, wraith, treant or dragon. Contract level follows cleared campaign chapters, while HP also scales to roster size. Sunken Bell starts a fresh floor-one run with the prepared roster and no boons; persistent job/gear/talents carry in. Each victory banks reward and offers up to three distinct, not-yet-owned boons. Select one, fully recover and descend. All twelve can be collected; a dedicated continuation button prevents an exhausted draft from trapping the run. Death or return to town clears run boons.

| Boon | Patron | Effect |
| --- | --- | --- |
| Cinder Fingers | EMBER · TAP | Setiap 3 tap efektif memicu 18 fire damage langsung ke musuh utama. Fatigue tetap berlaku. |
| Second Thunder | STORM · CAST | Setiap cast ofensif kelima mengulang 55% power ke boss. Cocok dengan build cooldown cepat. |
| Mercy Overflows | TIDE · HEAL | 35% overheal berubah menjadi shield. Heal saat sehat sekarang menyiapkan pertahanan. |
| Briar Oath | THORN · SHIELD | 35% damage yang diserap shield atau Guard dipantulkan ke boss. Bersinergi dengan overheal. |
| Resonant Shelter | BELL · GUARD | Party Guard langsung memberi 18 Resolve dan cooldown Guard berkurang 3 detik. |
| Dancer in Ash | GALE · MOVEMENT | Penalti relokasi turun dari 0,9 ke 0,2 detik. Hero yang dipindah mendapat 30 shield. |
| Dawn Runs Deep | DAWN · ULTIMATE | Seluruh sumber Resolve mengisi 60% lebih cepat. Lebih banyak Ninefold Dawn dalam satu fight. |
| Last Light | ASH · EXECUTE | Damage ke boss di bawah 30% HP meningkat 40%. Ledakan akhir saat phase paling berbahaya. |
| Winter Between Beats | FROST · CONTROL | Setiap cast memperlambat jadwal intent berikutnya 0,16 detik. Telegraph aktif tetap berjalan. |
| For the Living | HARVEST · MINIONS | Setiap minion tumbang memulihkan 24 HP seluruh party. Jangan abaikan summon. |
| Not Yet, Little Flame | HEARTH · SURVIVAL | Sekali per hero per floor, pukulan fatal menyisakan 20% HP. Kesempatan kedua, bukan kebal. |
| Many Hands, One Song | CHORUS · ROTATION | Tap hero berbeda dari tap sebelumnya memberi hero itu Battle Hymn selama 2 detik (+30% power, +20% tempo). |

## 12. Architecture, saves and delivery

Phaser 3 + TypeScript + Vite, procedural pixel art, Web Audio, local fonts. No runtime server or third-party network dependency. Profile validation repairs invalid skills, impossible jobs, equipment ownership, chapter gaps and duplicate tile placement. v2 save namespace is retained with optional job/gear fields for backwards compatibility. Live combat is not persisted. Saves are tied to origin/browser. Development-only QA exposes snapshots and fixed-step simulation; production bundles do not expose that API.

Production uses relative asset URLs and independently cached engine/application chunks. Upload dist contents to a static host, including a nested subfolder. Netlify and Vercel configurations are included. CI regenerates the database, checks it against Git, tests, builds and runs the full campaign policy.

## 13. Verification and honest boundaries

See PLAYTEST.md for executed commands. Automated policy tests establish reachability, not subjective fun. Browser campaign tests force terminal HP solely to exercise transitions; full simulation benchmarks separately fight every encounter normally. Physical touch feel, Safari/Firefox, low-end performance and human difficulty testing remain unverified. No multiplayer, cloud save, voiceover, free-roaming town, procedural narrative or paid economy is implemented. The broad prototype archive contains ideas that are not acceptance criteria for this release.
