# Lima atribut, unique character kits & advancement

**Target design R1, bukan schema/rumus yang sedang dipakai game.** [Target GDD](GDD-TARGET.md). Semua coefficient seed; keseimbangan harus diuji setelah combat adapter dibuat. Jangan menggabungkan multiplier level lama dengan formula baru secara otomatis.

## 1. Atribut & derived values

| Stat | Fungsi utama | Fungsi sekunder | Batas anti-dominant-stat |
|---|---|---|---|
| STR | physical power, break/impact | sebagian HP, beberapa DEF hybrid attack | tidak mempercepat semua skill |
| DEF | physical mitigation, barrier | HP, shield-based offense | tidak menjadi kebal, reflect tidak mengisi charge |
| INT | magic damage, ritual strength | sebagian heal/control potency | tidak memotong telegraph musuh di bawah minimum |
| DEX | precision/physical hybrid, cooldown | capped critical chance | dua diminishing curves; crit tidak proc rekursif |
| WIS | heal, support/ward | magic mitigation, HP | tidak membesarkan semua damage sekaligus |

**Seed template Challenge level1** (budget60 total, angka bukan hasil balance):

| Basic job | STR | DEF | INT | DEX | WIS |
|---|---:|---:|---:|---:|---:|
| Warrior | 18 | 16 | 6 | 12 | 8 |
| Rogue | 10 | 8 | 8 | 24 | 10 |
| Archer | 14 | 10 | 8 | 20 | 8 |
| Healer | 7 | 10 | 13 | 8 | 22 |
| Wizard | 6 | 7 | 22 | 10 | 15 |

Story hero memakai class template dengan redistribusi ±4 personal tanpa mengubah total. Level Story cap40 tetap sebagai target, tetapi growth baru: 2 auto stat points sesuai job +2 discretionary per level. Total discretionary78 saat level40. All 5 allocations ditampilkan sebelum confirm; respec mengembalikan point budget tepat sekali. Base+growth+gear+buff ditampilkan terpisah. Suggested allocation bisa dipakai, tidak auto-spend tanpa persetujuan.

Rogue max run rank12 proposal; tiap rank-up memberi2auto+2discretionary seperti growth Story, sehingga budget non-gear104 pada rank12. Raid normalized level20 proposal memakai budget non-gear136:60base+38auto+38allocation; preview/reset bebas sebelum attempt. Tidak memakai level hero Story; gear templates membayar budget khusus yang sama untuk semua loadout. Job change tidak memperbanyak total points atau preserve buff dari class lama. Advanced mechanics bukan flat double stats.

### Formula reference (deterministik; round hanya di output)

Untuk output nonnegative, `round(x)` berarti `floor(x + 0.5)`; jangan memakai banker rounding pada satu platform dan half-up pada platform lain. Simpan intermediate dalam precision penuh sebelum cap dan rounding terakhir.

```
S = base + growth + allocated + gearFlat
S_effective = clamp(S * (1 + sum(statPctBuffs)), 1, 250)
HPmax = 180 + 8*STR + 10*DEF + 4*WIS
rawSkill = basePower + a*STR + b*DEF + c*INT + d*DEX + e*WIS
cooldown = max(1.2, baseCD * (1 - 0.25*DEX/(DEX+50)) * (1 - haste))
0 <= haste <= 0.20
critChance = min(0.20, 0.02 + 0.18*DEX/(DEX+60))
physicalMitigation = min(0.70, targetDEF/(targetDEF+100))
magicMitigation = min(0.60, (0.5*targetWIS)/(0.5*targetWIS+100))
rawHealExample = 10 + 0.85*WIS + 0.35*INT
rawBarrierExample = 12 + 0.65*DEF + 0.45*WIS
```

Damage pipeline: rawSkill → named additive modifiers (cap +100%) → crit1.4 if eligible → target mitigation → universal Guard factor (0.65 seed) → shield absorption → HP. Final damage half-up once sesuai `round(x)` di atas; damaging hit minimum1, immunity explicit. Critical per **action** not per decorative projectile; heals/barriers/DoT tidak crit default. Break window +20% damage masuk named additive cap, bukan separate multiplying chain. DOT applies mitigation sekali saat tick dan bersumber skill budget, tidak on-hit chain.

Area heal/barrier/offense menyebut **total budget** atau **per target**. Default budget shared across actual eligible targets, kecuali coefficient explicitly per-target kecil. Mengequip same team aura tidak stack; highest potency refresh capped duration. True damage bukan default balancing shortcut.

Normal cooldown progress dari tap tetap rate-capped dan fatigue; efek “-cooldown” tidak mengulang free cast pada frame sama. Time-control maksimum satu delay trigger/0.5s, total delay suatu intent <=25% base interval; windup yang sedang tampil tidak dipersingkat di bawah1.5s default contract minimum. Endgame raw stats boleh tinggi tetapi derivative cap, threats dan resource counters tetap meaningful.

### Worked examples — arithmetic only

Contoh raw physical `18 + 1.6STR + 0.6DEX`, target DEF20, tanpa crit/Guard/gear/buff. Tabel dihitung dengan script sesuai formula di atas, bukan DPS test. Heal adalah `rawHealExample` dan CD sebelum haste. Jangan memakai contoh physical ini sebagai default action semua job: Wizard/Healer memiliki skill coefficients lain.

| Template | HP | Contoh physical raw | Setelah DEF20 | Heal contoh | CD dasar6s |
|---|---:|---:|---:|---:|---:|
| Warrior | 516 | 54.0 | 45 | 19 | 5.7097s |
| Rogue | 380 | 48.4 | 40 | 21 | 5.5135s |
| Archer | 424 | 52.4 | 44 | 20 | 5.5714s |
| Healer | 424 | 34.0 | 28 | 33 | 5.7931s |
| Wizard | 358 | 33.6 | 28 | 30 | 5.7500s |

Stat budget non-gear:StoryLv40=216, RogueRank12=104, RaidLv20=136. Ini total points, bukan power-equivalence antar-mode; encounter rulesets dituning terpisah.

## 2. Baseline vs target identity

Baseline `ROSTER` berisi Aldric/Bran Warrior; Sable/Nyx Rogue; Rowan/Kestrel Archer; Lyra/Mira Healer; Orin Wizard. Banyak skills/jobs shared by base class. **Target:** base common pool tetap ada, tetapi tiap named hero punya mechanic, 2 signature normal skills, 2 unique advancement routes, 2 signature Ultras dan1 capstone. Ini rewrite design bertahap, bukan klaim saat ini sudah unik.

Story identity tetap immutable: Aldric tidak diubah jadi Wizard hanya untuk farming optimal. Respec memilih route dalam karakter. Rogue/Raid custom unit memilih job bebas; optional **Echo mentor lineage** memilih satu named kit sesuai base job. Menambahkan lineage tidak menumpuk passives; satu lineage aktif, signature unlock via Challenge trial independen dari Story. Rogue memulai starter, mastery node membuka owned lineage option di dalam run. Raid dapat memakai unlocked lineage dalam equal build budget.

## 3. Personal kits — 18 signature normal actions target

Notation: P physical, M magic, H heal, B barrier; `N` active party count; coefficients action-total. Semua masih memakai 2 equipped normal slots, bukan semua skill menjadi tombol baru.

| Hero / resource | Signature 1 (seed) | Signature 2 (seed) | Weakness / role difference |
|---|---|---|---|
| Aldric · Oath max3 dari protected ally hits | **Keep the Line**: B `16+.7DEF+.3WIS`, shared lane, CD6; Oath+1 jika barrier benar-benar menyerap | **Promise Cut**: P `10+.7STR+.4DEF`, CD5; spend Oath3 untuk break+20 | defensive counter, bukan fastest damage |
| Bran · Bastion max3 saat guard first impact | **Spare Shield**: B `12+.9DEF`, ally lowest barrier, CD6.5; tidak overwrite shield lebih besar | **Grounded Return**: P `12+.45STR+.65DEF`, CD6; +one taunt window3s | menahan/redistribute, lemah menghadapi magic tanpa WIS |
| Sable · Evidence max3 dari marking different intent families | **Expose Receipt**: P `8+.65DEX+.25INT`, CD5; mark+10% damage4s, highest-only | **Borrowed Opening**: P `10+.7DEX+.25STR`, CD4.5; spend3 Evidence untuk cleanse1 enemy buff | utility/debuff, tidak unlimited Gold steal |
| Rowan · Quarry satu enemy | **Thread the Branch**: P `12+.75DEX+.35STR`, CD5, +break versus Quarry | **Shelter Arrow**: B `10+.45DEX+.5WIS`, CD6; protect one ally in targeted lane | precision dengan support opportunity cost |
| Lyra · Mercy max3 dari effective heal, sekali/cast | **Name the Wound**: H `12+.9WIS+.3INT`, CD5.5; weakest ally; spend3 Mercy cleanse1 | **Living Chorus**: H `10+.65WIS+.25INT` dibagi3 tick party-total, CD8 | heal/cleanse, tidak damage aura universal |
| Kestrel · Cadence max3 dari planned relocation, per2s | **Signal Step**: B `10+.6DEX+.25WIS`, CD5.5; one ally move penalty -0.3s next move | **Crosswind Volley**: P `12+.65DEX+.35STR`, CD5; total split minions; spend3 cadence mark lane | mobility support, cap mencegah drag-spam |
| Nyx · Inscription max2 pada target berbeda | **Copper Rune**: M `10+.55INT+.55DEX`, CD6; delayed hit after1s | **Namekeeper's Knot**: B `12+.5WIS+.4DEX`, CD6.5; bind one debuff expiry extension only once | hybrid setup, burst perlu waktu |
| Orin · Forecast max2 dari interrupt successful | **Uncertain Star**: M `14+.95INT+.2WIS`, CD7; choose lane before cast | **Margin of Error**: M `8+.6INT+.4WIS`, CD8; interrupt interruptible ritual, cooldown if failed | control/burst, low HP, no perfect future dodge |
| Mira · Supply max3 first effective heals on different allies | **Field Dressing**: H `10+.7WIS+.3DEF`, CD5.5; overheal tidak supply | **Safe Passage**: B `12+.6WIS+.4DEF`, CD7; shared lane, spend3 Supply remove1 temporary blocked tile at safe phase | sustain/logistics, tidak menambah inventory supply permanen |

Resource reset encounter kecuali mode contract explicitly permits carry; cannot gain from Ultra/reflect/duplicate proc. Resource gain icon hanya feedback, tidak extra sixth attribute.

## 4. Unique advancement — 18 routes +18 third continuations

Story advanced gate proposal: Lv8 + Ch4 clear + hero trial. Third: Lv20 + Ch10 clear + parent trial; companion capstone Ultra later Ch12+. Trials tersedia setelah hero direkrut dan tidak memerlukan Rogue/Raid. Dua routes mutually exclusive per hero; respec di town, learned alternate route tidak bertumpuk.

Rogue equivalent gate: run rank4/9 + mastery nodes; jika tidak menemui mastery pilihan, node act transition menawarkan fallback. Raid: mastery trial + normalized build budget; menu preview prerequisite jelas.

| Hero | Advanced A → third A | Advanced B → third B | Branch mechanical choice |
|---|---|---|---|
| Aldric | Oathguard → Dawnbastion | Bell Duelist → Covenant Breaker | lane protection/Oath spending vs break-pressure/mark |
| Bran | Stonebearer → Last Rampart | Gate Marshal → Open Gate | personal absorb distribution vs party reposition window |
| Sable | Ledger Knife → Truthbinder | Night Broker → Unbought Shadow | expose/buff cleanse vs evasion/choice info, no economy multiplication |
| Rowan | Trail Warden → Greenwood Sentinel | Stringseer → Far-Horizon | Quarry+shelter vs charged weakpoint hits |
| Lyra | Mercy Cantor → Living Hymn | Echo Shepherd → Self-Named Saint | heal cadence vs cleanse/anti-echo control |
| Kestrel | Wind Courier → Skyrelay | Alarm Ranger → Stormcaller | movement windows vs precise mark/interrupt chains |
| Nyx | Runecarver → Namewright | Veil Artisan → Unmasked | hybrid delayed inscriptions vs defensive mirage, no untargetable loop |
| Orin | Star Scribe → Unwritten Sage | Rift Auditor → Horizon Keeper | forecast burst vs phase/rule-safe control |
| Mira | Hearth Medic → Common Dawn | Pathmaker → Refuge Architect | sustained recovery vs supply-efficient guard/route support |

Each advanced adds1 signature normal action; third upgrades/replaces that action, **does not add another equipped slot**. Full design budget: 18 personal normals +18 advanced actions +18 third replacements =54 personal action records, plus existing shared pool for reuse. Exact normal-action coefficients for the 36 promotion actions are **not authored yet**; class names/mechanics above are directional, production milestone R7 owns full executable spec (R3 authors the slice subset). Jangan memasukkan dummy skills dan menghitungnya implemented.

## 5. Talent graph & specialization depth

Per hero template target26 nodes: 4 foundation, 6 hero-identity nodes, 6 routeA nodes, 6 routeB nodes, 4 Ultra/trial nodes. Only selected branch spent path active. Full library `9*26=234` positions, reuse node mechanics allowed but signature labels/effects character-specific. This is content budget, not new runtime count; baseline50 definitions unchanged.

Point budget intentionally tidak cukup untuk semua route sekaligus. AND prerequisites explicit; OR unlock uses typed `anyOf`, bukan ditarik dua arrows seolah AND. Levels/quest/point/gold conditions shown in node detail; unlocking skill ≠ automatically equip. [Graph layout rules](UX-ART.md) are acceptance-critical.

## 6. Balance strategy & debug scene specification

Future **Balance Lab** local/test-only harness (not implemented): 5 equal-budget templates; each enemy intent can be forced, damage/heal/absorb/charge breakdown; visible coefficient source; seed replay; pause/single-step; dump report with mode/config. Build a 1/3/6 party matrix plus mono-job parties. Test same stat redistribution vs primary+secondary builds; no claim stat combinations are balanced before measurement.

Regression gates: zero/infinite stats rejected, respec refund once, class swap budget conserved, double-aura/cast/reflect loop forbidden, DPS vs survivability tradeoff, solo universal counter, UI damage preview matches simulation rounding, baseline legacy level multiplier removed in new ruleset only. Legacy ruleset can still load safely until user approves migration.
