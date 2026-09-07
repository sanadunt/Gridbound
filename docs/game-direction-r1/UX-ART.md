# Game UI, skill-tree graph & icon direction

**Design specification R1; boards/SVG di paket ini adalah dokumentasi, bukan layar game baru yang bisa dimainkan.** [Mode definitions](MODE-SYSTEMS.md).

## 1. Information architecture — bukan dashboard

| Screen | Primary decision | Content yang boleh terlihat | Dipisahkan ke halaman lain |
|---|---|---|---|
| Press Start | Memulai interaksi | Logo, key art, profile hint, Start, versi kecil | Stats, gear, semua mode descriptions |
| Main Menu | Continue / pilih mode | Continue card, 3 mode cards, profile/settings/credits | Party detail, story journal, shop inventory |
| Profiles / mode slots | Load / New / Export | Slot preview, save state, mode, parent Commander | Seluruh world map |
| Story world map | Pilih destinasi | Region fokus, nodes, party miniature, Game Menu | Inventory/quest list penuh |
| Mission brief | Depart atau prepare | Threat/reward/supply/party summary | Full skill tree |
| Rogue build | Tiga hero/job + challenge rules | Three slots, branch aspiration, relic cards | Shop stock yang belum ditemui |
| Rogue route map | Pilih node berikut | Reachable paths, type icons, danger, purse | Semua upgrade detail sekaligus |
| Raid build | Party/boss/challenge/preset | Stepper Party → Boss → Rules → Review | Raw Sandbox slider dalam rewarded mode |
| Combat arena | Read threat, tap/move/skill | Arena, compact status, selected hero, actions | Roster9 biography / inventory |
| Hero detail | Satu hero dan satu subtab | Attributes / Gear / Skills / Advance / Ultra | Semua subtabs stacked |
| Results | Baca outcome lalu pilih | Short totals, level/unlock highlights, Continue | Expandable breakdown terpisah |

Game Menu bisa overlay sheet/tombol, tetapi destination berupa full focused screen. Back selalu ke konteks asal (map node/run node/raid draft), bukan reset selection. Tidak ada modal bertumpuk di atas modal.

## 2. Screen flows

**Story:** World Map → Game Menu → Party → Aldric → Attributes / Gear / Skills / Advancement / Ultra → Back to Party → Back to Map. Quest pin deep-links ke relevant map region. Inventory item → preview → equip/craft confirmation, tidak transaksi pada select.

**Rogue:** Menu → Profile → New Run / Continue → Build3 → Relic rules → Route map → Encounter/Event/Shop/Draft → Next node → Act result → Final/Defeat → Archive. **Leave shop** selalu tersedia tanpa beli. Nilai temporary ditandai RUN.

**Raid:** Menu → Profile → Build1–6 → Boss → Challenge → Final config/reward preview → Start → Result → Edit/Retry/Map. Config summary mudah dibandingkan; Sandbox banner ditampilkan dari awal sampai receipt.

## 3. Layout & spacing tokens (proposal)

- Base spacing scale:4/8/12/16/24/32 CSS px. Body card padding16 desktop,12 mobile; touch controls min44×44. Hit target boleh lebih besar dari icon tanpa bertabrakan.
- Text blocks line-height1.45–1.6; body14–16px default, mobile tidak diperkecil menjadi10px demi nol scroll. Body uses local readable font; pixel heading short, bukan semua paragraf pixel.
- Major sections separated24px desktop/16px mobile; text boxes tidak menempel border. Long item names wrap dua baris, bukan overflow di belakang icon.
- Page header compact (title/back/profile/currency mode). Footer primary action fixed hanya jika safe-area + content padding menjamin tidak menutupi teks.
- Default pages target satu viewport, boleh sedikit scroll pada360×740. **Target budget**:0 horizontal, ≤120px overflow default390×844, ≤160px default360×740; bukan keadaan v0.4 yang sudah lulus. Detail expanded/200% text scaling boleh scroll lebih panjang, tetapi konten tetap bisa dicapai.
- Tidak memakai `overflow:hidden` global untuk “membuktikan” nol scroll. `min-height:0` dan scroll regional untuk dialog detail boleh jika fokus/scroll affordance jelas.
- Bounded lists: quest/story log1–3 entries/page sesuai content, inventory6–8 compact cards dengan detail terpisah, main chapter per region. Pagination state/filters ikut Back restoration.
- Mobile combat: **Arena / Hero / Log** tabs; arena tetap primary, Hero detail dedicated page/sheet dengan Back jelas. On Hero/Log single-player combat **pause** secara eksplisit, bukan fighting tak terlihat di belakang. Panel raid config tidak dapat dibuka untuk mutate saat fighting.

## 4. Skill tree — semantics dulu, arrows kemudian

### Graph data

Each node: nodeId, heroId/classId, branchId, rank, kind, prerequisites typed `allOf`/`anyOf`, exclusivityGroup, content unlock, cost, level/trial gates, iconId. Tidak menebak prerequisite dari urutan array/nama file.

- Top-to-bottom invariant: root rank0 di atas, descendants lebih bawah. Mobile tidak membalik arah hanya karena1-column; rank rows tetap masuk akal.
- DAG validated: unique IDs, all targets exist, no cycles; rank(child)>rank(parent), no self-edge. Edge meaning `allOf`=AND, `anyOf`=OR group. Promotion prerequisite dari branch lain tampil ghost-linked dan label, bukan hilang.
- Group branch view: Foundations / Personal / Path A / Path B / Ultra. View hanya5–8 nodes sekaligus; overview graph bisa zoom/pan, tidak memaksa membaca26 cards pada phone sekaligus.
- Locked branch visible preview; learn terpisah dari inspect. Locked bukan disabled inaccessible text. Inspect opens selected-node detail panel yang menunjukkan *seluruh* unmet gates.
- Branch keystone mutually-exclusive diberi connector/bar bracket bertanda **choose one**. Arrow tidak dipakai untuk berarti exclusion.

### Geometry & arrow routing

1. Measure node boxes setelah local fonts ready; gunakan `ResizeObserver`/layout scheduler untuk resize/text scale. Layout data coordinates terpisah DOM screen coords.
2. Node min footprint96×56 mobile proposal dengan hit44px; desktop132×64. Row gap **minimum32px**, column gap **minimum24px**. Card internal gap8px. Mobile width360 content328: dua96px nodes +24 gap muat, bukan tiga cards kecil paksa.
3. Draw orthogonal cubic/rounded paths dari bottom-center parent ke top-center child, edges layer **di belakang opaque card**. Stem12px dan arrowhead10px berakhir **6px sebelum border**; bukan masuk text.
4. Multi-parent: route shared trunk/junction di gutter, per-parent branch visible. AND junction solid dot/“ALL”; OR hollow diamond/“ANY”. Jumlah endpoint harus sesuai data, tidak satu ornamental arrow di heading.
5. Edges tidak menembus node lain. Crossing yang tak dapat dielakkan memakai bridge/offset dan highlight selected ancestry. Cross-branch prerequisite pakai labelled ghost node + jump link; semua dependency masih dapat ditemukan keyboard.
6. Selected, learned, available, locked dibedakan shape/icon/text/dash; warna bukan satu-satunya channel. Selected ancestry high contrast; unselected masih terbaca.
7. Text detail berada **di luar graph**, bukan membuat satu node meluas tanpa rerouting. Short node label tetap terbaca; long names detail on inspect.

### Graph tests (future runtime)

Fixtures: diamond AND, OR group, shared prerequisite, cross branch, exclusive A/B, long localized names,26-node hero, collapsed group, narrow viewport,200% text scale. Assert every required edge, endpoint offset within tolerance, arrow direction positive rank, no segment/card intersection, buttons not overlapped, keyboard select and learn confirmation. DOM test + screenshot inspection; screenshot alone tidak membuktikan prerequisite benar.

## 5. Equipment, skills & stats preview

Select item hanya membuka preview; tidak memotong wallet atau mengubah loadout. Preview memuat:
- icon/name/slot/rarity, **Story Gold+materials atau Challenge context**, requirement dan owned/equipped status;
- full description, five stat delta, derived HP/CD/skill examples, set bonus aktif→nonaktif;
- cost breakdown per material/currency dengan after balance; missing material → Pin route;
- Confirm **Buy & Equip / Craft / Equip owned** sesuai action, serta Cancel/Back;
- schema changed / not enough funds / wrong hero / active expedition → reason, no partial purchase.

Atribut: base+growth+allocated+gear ditampilkan; preview allocation before commit. Skills: icon, cooldown, formula sederhana “INT+WIS”, effect, unlock source. Advanced menu memisahkan inspect, learn dan equip. Ultra slot shows progress requirement, bukan spam32 cards di combat.

## 6. Icon art system — original/local

**Bukan menyalin icon Hades/Octopath.** Buat silhouette pada32×32 grid, primary safe area26×26, scale2×/3× tanpa blur. Silhouette beda ketika grayscale. Foreground brass/ivory, accent class-specific; minimal contrast3:1 non-text,4.5:1 body labels (verify rendered palette, bukan klaim otomatis).

| Layer | Makna | Contoh |
|---|---|---|
| Main silhouette | Action family | blade physical, starburst magic, bandage heal, shield barrier, broken ring interrupt |
| Secondary motif | Hero identity | Aldric knot, Bran gate, Sable ledger, Rowan leaf, Lyra bell, Kestrel pennant, Nyx chisel, Orin quill, Mira roof |
| Small corner badge | Variant/target | lane chevron, shared dots, delayed clock; not more than1 badge |
| Border/frame | Slot category | normal square, Ultra double-outline, challenge relic angled corners |
| Lock/progress | Availability overlay | padlock + text in detail, tidak menghapus silhouette |

Icon IDs stable (`icon.skill.aldric.promise-cut`, `icon.ultra.aldric.promise`, `icon.node.shop`). Tooltips bukan satu-satunya label mobile; aria-label text ada, icon decorative alt kosong jika text label sama. No emoji sebagai final art fallback.

**Asset budget target:** common UI/action family12 prototypes sekarang di design sheet; full kit art18 signature normals +18 advanced +18 third variants +32 Ultras; reuse motif boleh, exact actions tidak identical. Same ID reuse semantic pada multiple screens desirable. Placeholder must say placeholder in manifest; no fake production asset count.

[Offline concept icon sheet](art/icon-concepts.svg) adalah 12 original SVG study symbols, bukan final pixel assets atau implementation. Nama dan outline membantu art direction. Future deliverables: `.aseprite`/editable vector masters, PNG32/64 atlas, icon manifest, source/license ledger, per-icon acceptance checklist. Tidak mengubah `src/art`/`public` dalam task ini.

## 7. Motion, audio, accessibility

- Title idle scene subtle leaves/bell glow, no aggressive flashing. Press Start consumes first input; audio respects mute, no volume jump.
- Victory enemy death780ms existing target normal /120ms reduced as starting reference; rescued boss use escape/release animation not corpse logic. Outcome membuat settlement intent satu kali. Death animation dan local save transaction boleh berjalan paralel; results menunggu death readiness, menampilkan Saving jika receipt belum committed. Navigasi result aktif hanya setelah **kedua** syarat:1000ms sesudah visible dan receipt commit sukses, plus fresh pointer/key release. Save gagal menampilkan Retry save/Export dengan data masih utuh, bukan Continue yang membuang reward. Screen reader live region announces outcome then ready, not repeatedly each frame.
- Reduced motion stops shakes/drifts/rapid particles; all mechanics still visible. Colorblind mode combines shapes/text. Keyboard: Escape backs one layer after locked transition, Tab stable focus, arrows graph navigation optional.
- Pause on background; fullscreen optional explicit user click, no browser permission prompt on boot.
- Human QA reading speed, thumb zones, skills names, hearing/screen reader, text zoom and physical low-end Android/iOS remain necessary.

## 8. Design-board acceptance

[Presentation boards](art/design-boards.html) memperlihatkan target IA/economy/tree, bukan screenshot hasil game. Bisa dibuka offline tanpa fonts/CDN atau login. SVG layout harus XML valid, tidak merujuk aset remote, arrows visibly stop before card boxes. Visual review artifact tidak sama dengan final GUI QA.
