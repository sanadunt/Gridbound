# QA dan acceptance plan

[Masterplan](../PRODUCTION-MASTERPLAN.md). Ini adalah **test plan**, bukan hasil PASS. Evidence terakhir: [GUI-VERIFIED](../GUI-VERIFIED.md).

## Matrix minimum usulan

| Surface | Viewports/devices | States |
|---|---|---|
| Desktop Chrome | 1440×900, 1280×720 | Town, every training tab, all collections, combat ready/fighting/result |
| Mobile Chrome emulation | 360×740, 390×844 | Fresh/full roster, touch/drag, long text, preview, settings |
| Tablet | 768×1024 | Portrait dan resize; pilih dukungan landscape eksplisit |
| Physical Android Chrome | Reference device TBD | Cold launch, multitouch, audio, keyboard/address-bar resize, background/resume |
| Physical iPhone Safari | Reference device TBD | Safe areas, sound unlock, storage/reload, touch, orientation |
| Other browsers | Safari desktop, Firefox | Minimum loop/save/modal/asset smoke sebelum supported claim |

Expanded cases: max level, every job/branch, multiple parents, mutually exclusive nodes, insufficient gold/SP, locked/owned/equipped/quest-only gear, empty quest filter, all claimed, all cleared journal, 9 heroes, defeated party, exhausted boons.

## Acceptance cases

| ID | Test | Required result |
|---|---|---|
| L01 | Page bounds all states | No horizontal overflow; vertical budget measured and accepted; no clipping required content |
| L02 | Control hit rectangles | Primary targets at agreed minimum, no overlap with stance/lane targets |
| L03 | Resize/open detail/back | Selection/state preserved, focus visible, no lost controls |
| T01 | Talent prerequisite graph | All canonical edges represented or explicit cross-branch links; no false unlock implied |
| G01 | Gear select/cancel | Gold/inventory/equipment byte-equivalent to pre-preview |
| G02 | Gear confirm | Valid purchase once, exact cost; owned equip no second debit; invalid request no mutation |
| R01 | Victory sequence | Death readiness false initially, true before result; choices locked at <1000ms after appearance |
| R02 | Early/held input | Real pointer/touch/key cannot activate result before lock; no carried gesture after lock |
| R03 | Lifecycle | Retry/wave/retreat/reopen invalidates old callbacks; no duplicate rewards |
| S01 | v2 migration | Existing source v2 retained, valid converted progression survives reload |
| S02 | Corrupt/incomplete/future v3 | No silent fresh-save overwrite; protected state and warning |
| S03 | Storage blocked/full | Explain inability to save; no false saved indicator |
| S04 | Export and optional import | Export JSON safe; import only tested if implemented, validates before replace |
| C01 | Campaign reachability | Legal earned build simulation, separate forced-HP UI traversal |
| C02 | Quest/raid/endless | All objectives measurable, claim once, variant matching, draft exhaustion works |
| A01 | Accessibility | Keyboard path, visible focus, readable labels, reduced motion and contrast review |
| P01 | Performance | Cold load/FPS/memory traces on named device/network with approved budget |
| H01 | Hostinger remote | Correct build, assets/cache, no dev API, save reload and actual combat |

## Regression strategy

Unit tests prove rules; simulation tests prove deterministic mechanics; browser tests prove DOM/input wiring; physical playtests prove feel/device behavior; remote smoke proves deployment. None replaces the others. Source-inspection tests for animation constants do not prove animation visibly plays. Record screenshot/video when visual claims matter.

Current layout script measures default bounds and asserts horizontal fit. Next work should add bounded vertical assertions across expanded states. Old console counts may describe catalog rather than visible node count; align output with assertions.

## Bug severity

- Critical: save data loss, security/privacy exposure, payment risk if ever added. Blocks release, no routine waiver.
- High: core flow impossible, inaccessible controls, repeated crashes, duplicate progression exploit. Blocks release unless scope removed and product owner explicitly accepts safe alternative.
- Medium: degraded but recoverable behavior; scope/impact assessed.
- Low: cosmetic/copy issues without control/readability impact.

Every issue: reproducible steps, expected/actual, commit/build, viewport/device, storage fixture identifier, console evidence, severity and retest. Never attach private raw saves without explicit consent and redaction.

## Human playtest protocol

Recruit testers with consent; device/capacity TBD. Give scenario, not solution. Observe first combat and preparation independently; record confusion around tap/stance, threat counter, XP, confirm purchase and result delay. Ask what they would do next, why they lost, and whether build choice mattered. Do not manufacture scores/sample sizes. Store anonymized notes locally; decide retention before recording audio/video.

## Release test execution

Use NEXT-PRODUCTION runbook. Capture exact commit and command exit, start pinned dev port with readiness check, avoid user's real browser profile. After code change rerun affected gates; after final RC rerun full suite. Documentation-only edits need generated docs/link consistency checks, not a claim of runtime retest. Every waiver and failure stays visible in evidence index.
