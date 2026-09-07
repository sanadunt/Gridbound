# Ultra skills — target catalog & unlock contract

**32 definitions usulan; belum ada di runtime.** Source baseline `simulation.ts` memiliki satu shared `ultimate()` / Ninefold Dawn; `UPGRADES` berisi tiga upgrade lama dan **bukan** tiga Ultra berbeda. R1 menggantikan kebingungan itu dengan label serta catalog eksplisit. Jangan mengubah legacy save saat dokumentasi saja.

## 1. Input & activation contract

- Setiap hero memasang **satu Ultra** dari pilihan yang di-unlock, di luar 2 normal skills. Combat punya satu button Ultra berukuran nyaman → memilih caster/target → Confirm; bukan32 tombol sekaligus.
- **Shared Resonance 0–100**, start encounter0; tidak diisi dari idle tap, overheal, reflect, self-damage atau Ultra. Normal effective action memberi4 max sekali/hero/detik; successful Guard/interrupt memberi5; total seluruh sumber **cap5/detik/team**. Angka seed, perlu tempo testing.
- Semua Ultra biaya100, global lock6s, maksimum1 pemakaian per hero per encounter. Basic skill/equipment tidak bisa menghapus cap. Mengganti equipped Ultra di tengah combat dilarang. Stage baru adalah encounter baru hanya jika StageDef mengatakan demikian; wave spawning bukan reset cap.
- Cancel target picker tidak mengonsumsi charge. Confirm atomik: mode battle/status valid, caster alive, equipped/unlocked, target legal, charge dan per-encounter cap dicek lagi. Gesture membuka menu tidak bisa sekaligus Confirm.
- Tidak semua harus damage. Offensive Ultra biasanya single-target budget; area/shared defensive budget tidak linear meledak mengikuti N. Revive di bawah ini eksplisit limited, tidak standar semua heal.
- Animation0.4–0.9s, reduced-motion fade0.12s; tidak memakai white-screen flash. Simulation pause? **Tidak** pada cast; telegraph tetap readable dan damage/event timing eksplisit. Target picker boleh pause single-player dan replay state; picker tidak mengurangi enemy timer tanpa cost.
- Ultra tidak mengisi Ultra, tidak memicu on-cast Echo recursion, tidak menggandakan drop/Crystal. No invulnerability chain/perma interrupt.

## 2. Unlock semantics

| Gate | Story | Roguelike | Raid |
|---|---|---|---|
| Starter | Tersedia saat basic job direkrut; prologue tutorial memakai one starter | Semua 5 tersedia saat build | Semua 5 tersedia saat build |
| Signature A/B | Hero Lv12 + relevant advanced branch/trial; branch B sama gate tanpa wajib punya A | Challenge lineage trial unlocked; **run rank6/mastery node** baru menawarkan equipped upgrade | Challenge lineage trial selesai + corresponding build route |
| Capstone C | Hero Lv28 + Ch12 clear + companion decision/trial | Lineage capstone trial unlocked + run rank10 final-act mastery node | Advanced challenge trial, budget/cap sama; tidak wajib main Story |

Progress memisahkan content availability dan current equip eligibility. Membeli akses trial dengan Crystal tidak instant unlock. Trials punya deterministic objective yang dapat diulang, tanpa stamina/daily gating. No Story→Challenge raw-power transfer.

Notation: STR/DEF/INT/DEX/WIS milik caster. Semua formula action-total, sebelum common damage pipeline. `B` barrier total dibagi eligible allies; `H` heal total, dibagi sesuai target rule; durations/percent adalah seed. Biasa `M` magic, `P` physical. Semua status tunduk stacking/delay cap di [combat](CHARACTERS-COMBAT.md).

## 3. Lima class starters

| ID | Job / nama | Efek seed | Kondisi/counterweight | Icon concept |
|---|---|---|---|---|
| U-WAR | Warrior — Hold the Horizon | B `40+1.2DEF+.5STR`, shared party; Guard window+2s | tidak heal, damage tetap bisa menembus setelah barrier habis | shield + horizon |
| U-ROG | Rogue — Open Secret | P `36+1.2DEX+.4INT`; mark+10%6s | single target, same-type mark tidak stack | dagger + open eye |
| U-ARC | Archer — Guiding Comet | P `40+DEX+.7STR`, split lane target | tidak auto-hit semua lane | bow + comet |
| U-HEA | Healer — Dawn Chorus | H `32+1.1WIS+.6INT`, lowest-HP weighted | no revive, no overheal barrier default | bell + rising line |
| U-WIZ | Wizard — Falling Constellation | M `44+1.3INT+.3WIS`, one target; splashes memakai budget yang sama | delayed1s, no infinite stagger | three stars + descending arc |

## 4. Sembilan hero: dua signature dan satu capstone

| ID | Hero / nama | Gate | Efek seed | Batas / identity | Icon concept |
|---|---|---|---|---|---|
| U-ALD-A | Aldric — A Promise Kept | A | B `44+1.3DEF+.4WIS`, lane terancam; satu guaranteed intercept nonlethal hit | intercept hanya sekali, damage tidak hilang menjadi heal | shield + knot |
| U-ALD-B | Aldric — Break the Covenant | B | P `40+.9STR+.7DEF`, boss break+25 | memakan semua Oath, no shield | cracked sword + seal |
| U-ALD-C | Aldric — No One Owes Tomorrow | C | B `60+DEF+.8WIS`, party; satu ally fatal hit dilindungi hingga1HP selama4s | satu proc total, bukan revive party | dawn + open hands |
| U-BRA-A | Bran — The Spare Rampart | A | B `48+1.5DEF`, shared two lowest-barrier allies | tidak damage, max2 target | twin shields |
| U-BRA-B | Bran — Make a Way | B | P `30+.5STR+DEF`; hapus satu tile hazard dan buka safe corridor3s | hazard boss wajib non-removable hanya ditunda capped | gate + footprint |
| U-BRA-C | Bran — We Waited for You | C | H `24+.6WIS+.8DEF` pada satu downed ally sebagai revive HP cap25% | revive hanya jika corpse eligible, once/team/encounter; no dead target refunds exploit | lantern + return arrow |
| U-SAB-A | Sable — Read the Fine Print | A | P `34+DEX+.5INT`; hapus satu removable boss buff | boss immutable trait tidak dihapus | ledger + blade |
| U-SAB-B | Sable — No Debt to Shadows | B | P `42+1.1DEX+.5STR`; caster evasion satu marked strike4s | no team invulnerability | broken chain + dagger |
| U-SAB-C | Sable — The Record Stands | C | P `40+DEX+.6INT`; expose+15%6s dan reveal phase intent queue2 | expose highest-only, tidak mengubah RNG/reward | copper page + eye |
| U-ROW-A | Rowan — Path Through Ash | A | P `42+1.2DEX+.4WIS`, Quarry; satu ally cleanse root | single-target, no Quarry = no bonus | branch + arrowhead |
| U-ROW-B | Rowan — Beyond the Last Branch | B | P `48+.9DEX+.9STR`, one target delayed1.2s | strongest burst, tidak interrupt | longbow + horizon |
| U-ROW-C | Rowan — A Song Newly Made | C | P `28+.7DEX+.4STR` dan H `20+.7WIS` shared party | budgets terpisah kecil, tidak pure damage/heal terbaik | arrow + music leaf |
| U-LYR-A | Lyra — Mercy Has a Name | A | H `44+1.3WIS+.4INT`, chosen ally; cleanse2 normal debuffs | no revive, cleanse immunity fixed | named bandage + small light |
| U-LYR-B | Lyra — I Choose to Stay | B | B `38+.9WIS+.7INT` shared; anti-Echo damage taken -10%4s | species tag validated, no stacking mitigation beyond cap | hand + echo ring |
| U-LYR-C | Lyra — A Life of Her Own | C | H `48+1.4WIS+.5INT` party-total over4s; first1 overheal portion35% becomes B | effect tidak meregenerasi resource/charge | sprout + heart |
| U-KES-A | Kestrel — Signal in the Gale | A | B `32+.9DEX+.5WIS`; next voluntary move semua allies tanpa move penalty | satu move per hero, bukan haste permanen | flag + wind |
| U-KES-B | Kestrel — Thunder Between Bells | B | P `38+DEX+.6STR`; interrupt1 eligible ritual | ritual yang kebal tetap damage tanpa stunlock | bell + lightning |
| U-KES-C | Kestrel — Every Road Returns | C | P `24+.6DEX+.3STR`, B `30+.6DEX+.5WIS`; party safe reposition preview | tidak memindah hero tanpa confirm, no unavoidable unsafe auto move | crossroads + bell |
| U-NYX-A | Nyx — Name Carved in Copper | A | M `40+.8INT+.8DEX`; inscribed target takes delayed burst1s | one pending mark, no duplicate | chisel + nameplate |
| U-NYX-B | Nyx — The Unmasked Door | B | B `36+.7DEX+.8WIS`; one marked target redirect ke highest barrier ally | cannot redirect onto downed/invalid slot | mask + open door |
| U-NYX-C | Nyx — Be Who You Become | C | M `30+.7INT+.5DEX`, H `24+.6WIS`; remove1 ally debuff | no stat copying/permanent job mutation | unfinished face + star |
| U-ORI-A | Orin — The Unwritten Star | A | M `50+1.5INT+.3WIS`, next phase weakness if visible | no hidden weakness spoilers | quill + star |
| U-ORI-B | Orin — Margin for Tomorrow | B | M `28+.8INT+.5WIS`; delay next intent by min1.5s or25% interval | active telegraph not erased, total delay cap | hour arc + quill |
| U-ORI-C | Orin — Close the Book | C | M `44+INT+WIS`, burst boss; cleanse1 party fear | no rewind/revive/reset timers | closed book + sunrise |
| U-MIR-A | Mira — The Work of Many Hands | A | H `36+WIS+.6DEF`, lowest-weighted party | tidak generate permanent supply/material | three hands + bandage |
| U-MIR-B | Mira — Shelter We Build | B | B `44+DEF+.7WIS`, shared party; hazard damage -10%4s | total mitigation cap, no field permanent | roof + path |
| U-MIR-C | Mira — A Morning for Everyone | C | H `36+WIS+.5INT`, B `24+.6DEF+.4WIS` | split budget, no unlimited sustain loop | sun + town roof |

Setiap baris sudah memiliki concept motif; final icon asset dan manifest belum dibuat. Tidak memakai generic sparkle untuk menutupi icon yang belum authored.

## 5. Availability/progression schedule

Slice:5 starters +3 signatures (Aldric A, Rowan A, Lyra A). Story act1 memberi tutorial starter dan preview locked signatures; trials/signatures available act2. Capstones menjadi rewards act3/companion payoff, bukan collectible otomatis dari membeli Gold.

Full target32 bukan rollout satu patch. Add one Ultra: formula/test/telegraph interaction/icon/localization/keyboard control → review → content manifest. Satu class jangan dikunci tanpa Ultra viable sampai postgame.

## 6. Acceptance matrix

- Catalog IDs unik; all heroIDs/classes exist; gates reachable dari mode sendiri; no icon reuse yang membuat skill berbeda tak dapat dibedakan.
- UI shows cost100, equipped slot, locked requirement, caster, target, damage/heal preview, caps. Disabled menjelaskan alasan.
- Charge generator cap invariant pada N1/N3/N6, proc-heavy build, overheal spam, same-time multi-touch, held keyboard, pause/resume.
- Revive once/team, no-target cancellation, boss phase change mid-confirm, dead caster, death terminal race, repeated confirm, save reload tested.
- Semua attack/defense formulas berbeda secara role; efek yang memperkenalkan mechanic baru wajib simulation test. Katalog bukan bukti implementasi atau fun.
