# Mode specification — Story dungeon, Roguelike, Raid

**Proposal R1.** Semua reward/price/durasi angka awal untuk prototype, belum bukti balance. [Ekonomi](ECONOMY.md), [saves](SAVE-PROFILES.md).

## A. Roguelike — Sunken Bell

### A1. Pre-run build

- Pilih tepat 3 slot recruit. Setiap slot nama/avatar optional + salah satu 5 basic jobs; duplikat diizinkan dan tidak didiskon. Semua basic tersedia dari awal.
- Starting stat template/power budget sama untuk seluruh pemain pada ruleset. Pilih satu dari dua normal loadout starter per job, satu starter Ultra, dan formation. Tidak membawa hero level, gear, Gold/material atau talent Story.
- Challenge mastery hanya membuka skill/job alternatives, tidak gratis tambahan point budget. Full advanced class tidak dibawa sejak floor 1: pilih **aspiration path**, unlock mechanical promotion saat mastery node run.
- Pilih sampai 3 **challenge relics** dari library unlocked. Nol relic selalu valid. Preview perubahan aturan, risiko, reward eligibility dan incompatibility. Positive rules modifiers masuk Practice bila membuat kontrak reward lebih mudah.
- Start membuat runId, rulesetVersion, seed, configHash, frozen party, route/RNG state, ledger sequence; autosave node start. RNG seed bukan private key.

### A2. Bentuk run

Usulan run lengkap: 3 acts. Setiap act memiliki 5 depth dengan 2 node alternatif tiap depth, lalu 1 act boss. Satu path berarti 6 node/act, 18 per run. Start/exit bukan node reward tambahan. Target durasi 20–35 menit adalah **hipotesis**, ukur human playtest; short-run slice 1 act.

Node wajib per act: sedikitnya 1 shop dan 1 recovery reachable sebelum boss; tidak ada rute wajib resource check tanpa fallback. Jalur mungkin menawarkan:

| Node | Pilihan & hasil | Persist |
|---|---|---|
| Battle | Preview family/intent; victory Crystal perjalanan + draft 3 upgrade pilih 1 | Run saja |
| Elite | Optional pressure/objective lebih sulit; reward rare choice | Run saja + mastery receipt jika qualified |
| Workshop | Upgrade salah satu equipped skill atau replace satu; harga dalam Crystal perjalanan | Run saja |
| Merchant | Heal, purge downside, skill alternative, temporary relic; stock tersimpan saat entry | Run saja |
| Event | 2–3 opsi dengan risk/resource/stat preview dan Leave yang layak | State tersimpan sebelum resolve |
| Camp | Heal satu hero / restore party sedikit / class mastery; pilih satu | Run saja |
| Challenge | Objective ekstra, timer atau no-potion dengan minimum telegraph | Run reward/risk explicit |
| Boss | Multi-phase boss; act-clear bank reward tetap + next-act choice | Bank via receipt, build tetap sampai run akhir |

Upgrade draft tidak selalu tambah angka: examples “shield berubah ke lane tetangga tetapi durasi lebih pendek”, “second hit hanya pada marked target”, “heal cleanses tetapi cooldown lebih lama”. Tidak memberi upgrade untuk skill/class yang tidak ada kecuali jelas sebagai replace. Reroll dibatasi 1 per draft dan dibayar Crystal perjalanan; autosave sebelum reveal mencegah reroll reload. Class/Ultra content availability berbeda dari equip: run-rank4/9 memberi pilihan advancement, rank6 memberi signature Ultra choice yang eligible, rank10 memberi capstone choice yang eligible. Tiap threshold memiliki satu inter-node milestone prompt di checkpoint berikutnya (fallback bila tidak ada mastery node), bukan node ekstra dengan reward dan bukan guaranteed membeli power dari bank. Pemain selalu boleh keep current build.

### A3. Shop & choice examples

Harga seed: heal 12, purge debuff 18, upgrade rank 24, replace skill 20 Crystal perjalanan. Stock ditulis sekali per node; belum ada interest/farming idle. Bank Crystal tidak dapat menutup kekurangan purse.

**Event RL-E01: The Unlit Ferry**
- Bayar 10 perjalanan → lewati combat berikutnya, tanpa combat reward.
- Bawa lampu → next fight +1 summon wave, menang +18 perjalanan.
- Jalan kaki → tidak ada biaya/reward, next path normal.

**RL-E02: Clockmaker's Bench**
- Pinjam detik → satu skill cooldown -15% sepanjang run, setiap act boss memiliki extra telegraphed pulse.
- Kembalikan roda → restore 15% HP satu hero, tidak mengubah power.
- Lewati → baseline.

**RL-E03: A Name on Copper**
- STR/DEF route mengangkat peti → barrier next fight, lose potion.
- INT/WIS route membaca segel → preview dua node tersembunyi, tidak reward.
- DEX route bypass → skip elite; tidak menerima elite mastery.
- Stat check bersifat deterministic: check memakai **satu recruit terpilih** (STR+DEF pada orang yang sama, tidak menjumlah seluruh party). Bila semua gated opsi gagal, pilihan “Lewati / kembali ke route normal” selalu tersedia tanpa kehilangan slot/node. Threshold ditampilkan; bukan peluang palsu. RNG event jika dipakai menampilkan probabilitas dan state tersimpan.

### A4. Death, retry, bank & suspend

Downed hero tetap bagian 3-unit run, bukan rekrut pengganti gratis. Revival di Camp terbatas 1/act dan dibayar/run tradeoff. Party wipe mengakhiri run; purse/temporary upgrades hilang. Bank yang sudah diberikan act boss tidak dicabut. Abandon sama, tidak membayar sisa purse. Final success memberikan reward kontrak tetap, bukan konversi purse.

Suspend di node boundary aman; force-close mid-fight memulihkan snapshot awal encounter yang sudah committed dengan seed sama. Tidak ada shop reroll baru. Manual load lama tidak memulihkan run terminal atau ledger lama; boleh Practice fork tanpa rewards.

## B. Raid Boss — Echo Crucible

### B1. Build now, fight now

Pilih party **1 sampai 6**, job tiap slot, normal skills, Ultra, attributes allocation dan equipment template. Semua 5 basic jobs + serviceable base equipment tersedia; mastery membuka alternatif. Tidak perlu main Story.

Dua tab tegas:
1. **Contracts (rewarded):** author-validated boss tier, roster size normalized, certified modifier combos.
2. **Sandbox:** HP/damage/interval/sliders, preview semua skill, unit tetap1–6 dan slot2normal+1Ultra sesuai supported caps, practice spawn; banner **NO CRYSTAL / NO MASTERY**. Mengubah slider mentah mengubah mode sebelum Start, bukan diam-diam.

Contract customization: boss archetype, allowed variant tier, arena template, phase set, 0–3 challenge modifiers. Config frozen saat Start. Editing pending config tidak mengubah fight atau settlement yang sedang berjalan.

### B2. Solo–6 scaling proposal

Enemy HP factor `1 + 0.65*(N-1)`; per-target damage awal tidak dikali N. Heal/barrier AoE skill budget dinormalisasi terhadap jumlah target. Jumlah simultaneous targets maksimum `min(N, configuredTargets)`. Semua nilai wajib diuji roster 1/2/3/4/5/6 termasuk mono-class.

Solo: satu universal Guard/evade charge dan limited ration tersedia bagi semua jobs, bukan hanya healer. Tidak ada mechanic “dua hero wajib berdiri bersamaan”; multi-position objective memakai sequential pads pada N=1. Unavoidable all-grid harus punya universal counter, cooldown memenuhi worst-case frequency. Floor tick rate/timing minimum sama pada semua party sizes.

### B3. Eight initial challenge modifiers

| ID | Aturan | Risk points | Incompatibility / safety |
|---|---|---:|---|
| RM01 Fractured Armor | Barrier efektif -25% | 1 | Tidak gabung forbidden-shield rule |
| RM02 Long Night | Potion limit -1, minimum 0 | 1 | Solo rations tetap memiliki minimum 1 untuk baseline eligible |
| RM03 Echo Pulse | Aftershock telegraphed setelah ritual | 2 | Minimum delay 1.5s; no overlap impossible |
| RM04 Hunting Choir | Weakest mark menyusul breath | 2 | Target preview, tidak instant |
| RM05 Restless Brood | Extra minion wave saat phase transition | 1 | Spawn cap dan no target lock obstruction |
| RM06 Narrow Paths | Satu tile temporary blocked bergilir | 1 | Minimal satu jalur aman; fixed center spawn cap |
| RM07 Patient Colossus | Boss HP +20%, windup +10% | 0 | Net harder belum terbukti: Practice sampai calibrated |
| RM08 Last Lantern | Optional secondary lantern objective | 2 | Gagal objective mengurangi bonus, tidak mendadak wipe |

Risk points bukan otomatis multiplier. Hanya combos masuk allowlist calibration memperoleh bonus. Sandbox sliders, mutually impossible settings, over-budget gear atau edited imports menonaktifkan ranked-local reward eligibility. Ini bukan anti-cheat server.

### B4. Reward & meta shop

Victory mengeluarkan contract receipt. Repeated legal runs boleh farming Crystal dengan effort wajar, tetapi receipt yang sama tidak pernah membayar dua kali. First-clear bonus per boss/tier/config family pada Commander, bukan per manual slot.

**Crucible Exchange:** unlock boss modifier, cosmetic banners, alternative loadout recipes/Ultra trials. **Sunken Archive:** unlock challenge relic rule cards, rogue mastery trials, cosmetic maps. Keduanya memakai bank Crystal yang sama dan badge “Shared Challenge Wallet”. Story tidak menerima manfaat stat.

## C. Story challenge dungeon — Rootbound Expeditions

Ini **bukan mode Rogue dengan shop disembunyikan**. Masuk dari world map memakai current Story party, permanent level/gear/skills/Ultra dan supply yang dibeli/disiapkan di town. Party/loadout terkunci saat berangkat; tidak merekrut atau promosi di tengah.

- 1–6 active sesuai roster cap; prologue mulai 3. Dungeon routes 5 room + guardian seed untuk slice/full template.
- Room types: combat, fork, obstacle, lore choice, extraction/guardian. **Tidak ada upgrade draft, merchant, workshop atau temporary relic power.** Tidak ada latent upgrade UI yang hanya disabled.
- Event effects: resource trade, stat threshold memilih jalan, info/risk, heal dari supply, membuka rute, modifier ancaman berikutnya. Tidak permanent stat reward sampai expedition selesai.
- Material pouch unbanked sampai extraction. Checkpoint safety di designated room memungkinkan bank sebagian dengan aksi Return; memilih Return mengakhiri ekspedisi. Wipe kehilangan pouch yang belum bank, **tidak** inventory/material/gold lama, XP/hero/quest yang sudah disimpan.
- Gold reward/XP/material diterima saat extraction atau guardian terminal. No Crystal reward; no relic unlock; no story chapter claim ganda.

### Dungeon contoh

| ID | Region | Material target | Challenge khas |
|---|---|---|---|
| SD01 Charcoal Aqueduct | Ashwood | Ember resin / linen | pilih menahan banjir atau jalan lebih panjang |
| SD02 The Ledger Vault | Glassmere | Glass thread / ore | door rune dua-stat thresholds dengan alternate combat |
| SD03 Orchard Beneath Ice | Frostward | Pale sap / frost alloy | escort seed, optional dangerous harvest |
| SD04 Silent Foundry | Old Tower | Bellsteel / memory cloth | guardian part choice mengubah room akhir |

**SD-E01 Broken Winch:** STR+DEF >=32 (seed) memindahkan puing tanpa fight; DEX>=20 mengambil jalur tali dengan 1 supply; pilih stairway selalu tersedia tetapi combat tambahan. Tidak menciptakan upgrade.

**SD-E02 Glass Relief:** bayar 1 bandage untuk bantu warga → lore + route intel; ambil ore dari reruntuhan → next fight guardian kuat; lewat → safe/no extra reward. Bukan morality meter palsu.

**SD-E03 Last Harvest:** pilih ambil 2 material ekstra dan guardian hazard aktif, atau ambil 1 guaranteed dan exit. Preview menjelaskan pouch/risiko hilang sebelum confirm.

## D. Mode invariants / acceptance

- Party Rogue tidak bisa Start jika bukan 3; Raid valid N=1..6, di luar itu error friendly; Story obey active cap.
- Story dungeon route generator tidak pernah memilih upgrade/shop payload.
- Wrong-mode currencies dan item ids ditolak, termasuk melalui save import.
- Reload event/shop tidak reset RNG, stock, purchase receipt atau claim eligibility.
- Raid custom enemy configuration tidak mengambil reward rate dari field yang dapat diedit pemain.
- Semua normal jobs punya minimal satu viable counter untuk baseline solo Raid; testing simulations + human, bukan formula saja.
- Return to Title, switch profile, Suspend/Continue dan defeat tidak membuka dupe/softlock.
