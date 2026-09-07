# Next production R1 — gated execution plan

**Documentation only; keputusan R0/D1–D8 APPROVED, execution-preparation belum berjalan, implementasi R1–R10 NOT STARTED.** Scope baru mengubah core gameplay/data, bukan cosmetic patch. Checklist M0–M7 lama dan 84 tests lama **tidak** berarti R1 diterapkan. [GDD](GDD-TARGET.md), [current implemented evidence](../GUI-VERIFIED.md), [release operations baseline](../production/RELEASE-OPERATIONS.md).

## 1. Definition of done

R1 production-ready hanya jika: scope approved; profile/save/economy aman; tiga mode punya playable complete loop; Story runut; UI touch/mouse/keyboard wajib (gamepad di luar scope); semua referenced content real bukan placeholder; bounded layout/readability; balance/human/device gates; clean checkout CI; safe migrate/rollback; user approves deployment; remote URL benar-benar diuji.

Dokumen dibuat dan matematika diperiksa bukan pengganti prototype/human evidence. [Approval D1–D8](APPROVAL-D1-D8.md) sekarang juga mengizinkan commit/push dokumentasi terlebih dahulu. Tidak ada implementasi, migrasi save pemain atau deploy fitur R1 dalam task dokumentasi ini.

[Technical blueprint dan proposed module tree](TECHNICAL-PLAN.md) mendefinisikan authority boundaries dan debug-room yang harus dibangun pada milestone foundation/combat. File paths di blueprint belum dibuat.

## 2. Work ownership & method

- Operator/coding: Astra langsung di sesi utama; **tanpa subagent** kecuali user mengubah instruksi.
- User: product scope, art/story approval, budget/timeline, physical playtest/production authorization.
- Workflow: inspect → RED contract tests → implementation minimal → GREEN → refactor → isolated browser → targeted review → evidence update. One milestone outcome/session, docs handoff di repo.
- Dokumen boleh diriset bounded melalui sumber publik; public broad market research terpisah. No private-account access required.
- Source branch baru setelah implementation approved; remote changes main dan auto-deploy memiliki approval boundary sendiri. Jangan mengutak-atik deployed save dari test browser.

## 3. Milestones, dependencies, exit evidence

| Milestone | Depends | Implement nanti | Evidence wajib sebelum lanjut |
|---|---|---|---|
| R0 · Design lock | D1–D8 APPROVED; execution-preparation pending | Keputusan produk sudah terkunci; saat eksekusi diminta, batasi slice pertama, perangkat referensi, jadwal/budget dan seed yang harus diuji | [Pesan approval user](APPROVAL-D1-D8.md), requirement traceability; persetujuan desain tidak memulai R1 |
| R1 · Save/economy foundation | R0 | IndexedDB spike, mode typed model, Commander slots, receipts, ruleset ids, migration dry-run | Crash/quota/multi-tab/import/duplicate fixtures; v3 untouched; rejected wrong-mode state; rollback drill |
| R2 · Game shell | R1 | Press Start, title/main menu, mode/profile slots, world map shell, Back/focus, optional audio | Fresh/returning player flows at360/390/tablet/desktop, no tap-through, no giant stacked page; slots test |
| R3 · Combat and character slice | R1,R2 | Five stats adapter, role1/3/6, 2normal+1Ultra slots, 3 named identities, starter5+signature3, valid graph and icons | Formula oracle/rounding caps; no proc loop; baseline solo viable; graph edge geometry; key/touch tests |
| R4 · Story slice & material dungeon | R2,R3 | Prologue +Ch1,3starter heroes, world map, quest/forge/material routes, SD01 and choice events | Comprehension playtest, no mandatory grind, dungeon no shop/draft, extraction transaction, replay no duplication |
| R5 · Rogue slice | R1,R3 | Exactly3 job build, one-act seeded branching map, shop/event/draft/camp/boss, CR01/02 | New/abandon/suspend/clear; no wallet top-up or purse convert; generation reachability; varied viable builds |
| R6 · Raid slice & shared shop | R1,R3,R5 | One boss N1–6, certified modifiers vs Sandbox, repeatable rewards, shared bank exchange | All N and5basic jobs counterable; random free sliders reward0; receipt duplicates/reloads rejected |
| R7 · Full content production | R4,R5,R6 | Four-act story pass, full catalog targets, regions/dungeons, challenge library, icons/audio | Every ID/reference real; skip/reload/flags; all Ultra mechanics; all recipes/gates; no fake placeholder counts |
| R8 · Balance/device/accessibility | R7 | Tuning not scope expansion, layout polish, help text, optimization | Active/idle and solo/party balance, human sessions, Safari/Firefox/mobile,200% text, low-end sustained test |
| R9 · Release candidate | R8 | Clean install/build, versioned manifests, save/rollback/backup UX, legal/source ledger, release notes | CI same commit; generated docs match; build artifacts/hash; red issues none at release severity; user approval |
| R10 · Deploy & observe | R9 + explicit approval | Hostinger same plan configuration, correct branch/commit, backup first, deployment verification | Live URL/version/build/asset loading/save smoke; rollback method exercised; short observation window agreed |

**No automatic calendar promises.** Effort buckets S/M/L/XL estimate relative complexity only; staffing and measured throughput required before calendar. R1/save XL, R3/combat XL, R7 content XL are critical scope costs. Slices must prove feasibility before authoring hundreds of detailed nodes.

## 4. Ticket seed backlog (future work)

| ID | Priority | Requirement / ticket | Definition of done |
|---|---|---|---|
| FND-01 | P0 | ModeID and currency scope domains | Wrong Gold/Crystal/material calls type/runtime reject; no old global modifier leak |
| FND-02 | P0 | Wallet+receipt+checkpoint atomic commit | Crash before/after each write and duplicate settle converge |
| FND-03 | P0 | V3 to R1 copy migration | Legacy preserved; gear/job/level mapping preview, no silent lost point/hero |
| FND-04 | P0 | Load old Rogue bookmark | Can't rewind Challenge bank; Practice replay explicit |
| UX-01 | P0 | Title, profile and Continue flow | One pointer gesture cannot skip two screens; correct audio/focus |
| UX-02 | P0 | Focused mode maps/menus | No horizontal overflow; short phone page budgets measured not hidden |
| UX-03 | P0 | Skill DAG geometry renderer | AND/OR/exclusive fixtures, arrow endpoint offset, no node intersections |
| UX-04 | P0 | Preview transaction shared component | Inspect zero writes, confirm current price/hero/mode revalidation, cancel stable |
| CB-01 | P0 | Five-stat formulas and equal budgets | Numeric oracle, point conservation, no old power multiplier double count |
| CB-02 | P0 | Starter/identity/Ultra adapter | Actual effects/assertions, charge cap, no perma invulnerability/proc/revive loops |
| ST-01 | P0 | Prologue and world rules onboarding | New player comprehension, skips preserve state, objective clear |
| ST-02 | P1 | Material route/craft/extraction | Deterministic supply fallback; no recipe softlock; inventory provenance |
| RG-01 | P0 |3-unit run builder/map generator | Exactly3, duplicate jobs legal, reachable shop/camp, deterministic choices |
| RG-02 | P1 | Upgrade/shop/events with stock | Repeat load no reroll, options legal, Leave always safe, run-only scope |
| RD-01 | P0 | Solo–6 boss validation | All party sizes legal, universal counter, scaling UI accurate |
| RD-02 | P0 | Certified contracts vs Sandbox | Config frozen, unsupported combos reward0, first clear once |
| CT-01 | P1 | Promotion action authorship | All36 advancement actions/replacements get coefficients, IDs, icons, tests |
| CT-02 | P1 |32 Ultra catalog finalization | Actual effect/gate/icon/test per ID; no placeholder success |
| CT-03 | P1 | Story act and companion editorial pass | Foreshadow ledger consistent, gate/cast IDs validated, no Rogue mandatory |
| QA-01 | P0 | Cross-mode save/currency hostile fixtures | Imports, two tabs, dupes, wrong-mode fields, quota, rollback |
| QA-02 | P0 | Human/device playtest | Reference device named, evidence file, observed pain points, no fabricated certification |
| REL-01 | P0 | Release manifest/runbook update | Source SHA/build schema/ruleset/artifact hash; approved deployment scope |

P0 menunjukkan risiko atau dependency, **bukan** semua wajib dilaksanakan bersamaan. Staging order mengikuti milestone.

## 5. Content budgets / production pipelines

| Content | Slice budget | Full target | Pipeline / gate |
|---|---|---|---|
| Story | Prologue +Ch1 +3hero beats | Prologue +16chapters +epilogue,9companion arcs | beat map → original script → flag graph → skip/reload → playtest |
| Active Story party |3 |6 active of9 roster (D3 approved) | migration preview → formation test |
| Unique advancement |1 route for each3starter |18advanced +18third | mechanic spec → simulation → signature art → UI |
| Ultra |5starters +3signatures |32definitions | formulas → effects test → icon/readability → gate |
| Hero talent graph |3hero templates |26nodes per9hero,234positions | semantic DAG → geometry → purchase → save |
| Rogue |1act6nodes,6upgrade definitions,3events |3acts18traversed nodes,30upgrades,12events | seeded generator → reachability → economy runs |
| Challenge relic |2 |12 | incompatibility table → reward calibration |
| Raid |1boss,3modifiers |4validated first, then12archetypes,8initialmodifiers | N1–6 matrix → per-class counter → receipt |
| Story dungeon |SD01,3events |4dungeons,12events | material/gate → route/choice → extraction |
| Icons |12original motif studies | Action-specific normal/advancement/Ultra/UI manifest | original master → atlas → license ledger →32px readability |

Full target catalog adalah arah/content ceiling yang disetujui lewat D8, bukan janji semuanya masuk rilis pertama atau coefficient sudah final. Tutorial effectiveness precedes extra bosses. Existing32/48variant record distinctions must remain honest.

## 6. Verification plan

### Baseline commands (already exist, **not executed for R1 docs**)

```sh
npm ci
npm test
npm run database
npm run docs
npm run build
npm run balance
npm run test:browser     # dev server matching GRIDBOUND_URL needed
npm run test:webapp
npm run test:production
npm run package:hostinger
npm run test:hostinger
git diff --check
```

CI currently lacks target tests because target does not exist. Future suites must be authored; do not document nonexistent `npm run test:profiles-r1` as runnable now.

### Required new coverage

- Table-driven save domain validators per mode, transaction/invariant/property tests, deterministic seeds and replay ledger.
- Every Ultra/counter/recipe/action mechanic; max cap, cooldown rounding, party size, advancement transitions.
- Browser: Press Start, continued gesture guard, profiles, long names, load/cancel, menus/back, world map, gear preview, graph keyboard, death/Ultra/input locks.
- Generator fixtures no invalid node route, no forced purchase,3-upgrade choices legal, Story dungeon no upgrade/shop node.
- Economy numeric simulation plus human completion time—not store-page metrics as tuning evidence.
- Safari/Firefox/Chrome, physical Android/iPhone, short-phone landscape, text scaling, focus/contrast/soundless/reduced motion.
- Production root/subdir Node/static, fresh origin import/backup; no gameplay backend assumed.

## 7. Risk register

| Risk | Detection | Mitigation / stop rule |
|---|---|---|
| Crystal save rewind | Old run+wallet fixture | atomic ledger, mode bookmarks not wallet clones; stop R1 if cannot prove |
| Infinite economy from cheap Raid | highest Crystal/min run policy | calibrated contract payout; no arbitrary raw stat sliders rewarded |
| Rogue feels endless with cosmetic nodes | playtest build variety/choice recall | distinct event/shop/camp economy, at least2viable draft paths |
| Story dungeon secretly Roguelike clone | generated room type audit | separate allowlist excludes shop/upgrade/relic |
| Nine heroes huge UI / party6 unpopular | prototype feel + migration preview | D3 cap approved; test feel/migration before apply; never delete benched progress |
|32Ultras exceed QA/art capacity | content ledger incomplete | slice8first; cut optional capstones rather than ship dummy |
| Five stats one dominant build | coefficient/cap sweeps + humans | equal budget and capped DEX/WIS effects; no exponential stacking |
| Story twist undermines agency | comprehension retell | world rules and foreshadow; linear main ending not erased by replay |
| Browser storage loss/migration | quota/future/incomplete fixtures | export/import preview, protected backup, no cloud-sync promise |
| Diagrams mistaken for implementation | doc/package labels | target watermark, source baseline links, no run tests claimed |

## 8. Release/rollback handoff

Keep static architecture; no service install or new public endpoint in R1 plan by default. Potential future data layer entirely local. Hostinger build config remains root`.`/`npm run build`/`dist`, optional`npm start`; verify exact hPanel at release, never infer from repo alone.

At approved release capture commitSHA, app version, schema/ruleset/content manifest, CI URL, ZIP checksum, known issues, backup/export instructions, deployed origin and read-back. Rollback assets does not downgrade saves; R1 supports protected legacy source copy. Do not promote main automatically because tests pass if migration/human/layout gates fail. [Baseline operations](../production/RELEASE-OPERATIONS.md).

## 9. Handoff for next session

Read [approval record](APPROVAL-D1-D8.md), package index, latest source Git state and current implemented GDD first. D1–D8 sudah disetujui; jangan meminta persetujuan yang sama lagi tanpa perubahan scope. Task sekarang berhenti setelah publikasi dokumentasi. Ketika user meminta eksekusi, batasi R0 execution-preparation lalu R1 storage/economy spike, **bukan** drafting32icons dan coding seluruh mode sekaligus. Tetap Astra langsung tanpa subagent. Implementasi belum dimulai.
