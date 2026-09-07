# Milestone dan backlog

[Masterplan](../PRODUCTION-MASTERPLAN.md) · Semua status berikut **planned/open**, bukan pekerjaan selesai. Baseline existing berbeda dari deliverable milestone.

## Milestones

| ID | Deliverable | Dependency | Exit criteria / evidence | Approval |
|---|---|---|---|---|
| M0 Scope lock | Feature cut, supported-device list, owner, risk register, baseline commit setelah approval | Tidak ada | Scope keputusan tercatat; sumber/evidence lama dipisah; kapasitas/estimasi ditetapkan | User |
| M1 GUI dan input | Compact pages, combat panels, arrows jelas, preview/confirm, result safety | M0 | All-state matrix, screenshot, touch/keyboard and timing tests; tidak ada hidden required content | User visual + implementer QA |
| M2 Progression dan onboarding | Save recovery/import jika approved, tutorial, result clarity | M1 | New-player flow, v2/v3 fixtures, interrupted/blocked writes, no duplicate reward | User flow + QA |
| M3 Content dan presentation | Balance pass, copy consistency, art/audio/credits ledger | M2 | Campaign legit completion, class/build comparison, authored-content checklist, licenses reviewed | User content |
| M4 Device/performance/accessibility | Browser/device report, cold load/frame/memory baseline, accessibility fixes | M1–M3 | Supported matrix green; issues severity tagged; known limits disclosed | User quality |
| M5 Release candidate | Frozen scope, clean checkout, generated docs/database, artifact/hash, rollback rehearsal | M4 | Exact commit evidence, no critical/high unresolved issue, approved release notes | User release |
| M6 Deployment verification | Hostinger candidate deploy, remote smoke, save migration and cache checks | M5 + explicit deploy scope | Read-back live build/URL, normal combat, result input, backup/rollback ready | User hosting |
| M7 Launch and maintenance | Observation report, support route, patch procedure | M6 | No blocker in agreed observation window; ownership and response expectations defined | User launch |

Tidak ada auto-promotion milestone. Milestone gagal → perbaiki penyebab → ulangi gate terdampak. Uji tidak independen hanya karena dijalankan proses lain; dokumentasikan siapa melakukan review.

## Work packages dan acceptance

| ID | Work | Milestone | Acceptance tambahan |
|---|---|---|---|
| UI-01 | Combat arena/detail separate interaction | M1 | Semua critical actions bisa dicapai tanpa scroll jauh; open/close detail mempertahankan selected hero |
| UI-02 | Collection paging dan empty states | M1 | Next/previous boundaries, filter reset, selected chapter persistence, no skipped records |
| UI-03 | Talent graph navigation | M1 | Every canonical edge accounted; cross-branch parent diberi link/label; keyboard selection bukan purchase |
| UI-04 | Gear compare/confirmation | M1 | Price/owned/equipped/locked/quest-only konsisten; cancel dan preview tidak mutate |
| IN-01 | Result input lock lifecycle | M1 | Pointer/keyboard/mobile held-input dan stale presentation tests |
| SV-01 | Save envelope/version validation | M2 | Corrupt/incomplete/future data protected; no silent fallback write |
| SV-02 | Backup import proposal | M2 jika approved | Schema/size validation, preview overwrite, cancel-safe, export existing before replace |
| OB-01 | First-session tutorial | M2 jika approved | Skip/replay, no duplicate rewards, steps only advance after action verified |
| CT-01 | Balance/economy pass | M3 | Legal earned build; varied policies; quest rewards tidak menciptakan mandatory grind tanpa review |
| AV-01 | Feedback and credits | M3 | Motion setting honored, sound unlock browser-safe, asset provenance complete |
| QA-01 | Expanded-state visual/device suite | M4 | Matrix di QA-ACCEPTANCE; runtime errors dan clipping report |
| PF-01 | Performance budget | M4 | Baseline device/network defined; optimasi tidak mengubah save/combat determinism |
| RL-01 | Candidate provenance | M5 | Commit→build→checksum→deployment mapping |
| RL-02 | Rollback drill | M5 | App rollback dan v3 save retention diuji secara terpisah |
| OP-01 | Manual support/incident runbook | M7 | Repro template tanpa secrets/save otomatis; owner jelas |

## Estimasi dan change control

Isi per work package: owner, capacity, optimistic/likely/pessimistic effort, unknowns, dependency dan retest cost. Tidak ada deadline/effort yang dijanjikan dalam paket ini. Fitur baru harus menjelaskan nilai pemain, scope yang dikurangi, perubahan save/hosting/privacy, test cases, dan approval. Satu fitur tidak boleh memblokir release hanya karena ide tersebut menarik; gunakan release cut.

## Release cut usulan

- Mandatory: semua safety fixes, compact readable core UI, established baseline loop, device minimum, credits, reproducible deployment.
- Conditional: tutorial, import backup dan diagnostic/version UI bila approved dan gate terjangkau.
- Later: equipment crafting, additional story quests, achievement cosmetics; lihat roadmap untuk konsekuensi.
