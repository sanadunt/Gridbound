# D3 implementation and verification record

Status: IMPLEMENTED, UNIT/BUILD PASS, BROWSER ACCEPTANCE BLOCKED. Not end-to-end certified.

## Scope and preservation

Work was performed directly, without other agents, commits, pushes, deploys or global configuration edits. Existing uncommitted D1/D2 changes were retained. No real browser profile or real player save was accessed/reset. D3 adds a defaultable `storyActive` field to the existing profile rather than resetting saves. Existing save-envelope protection remains unchanged.

Read: APPROVAL-D1-D8.md, MODE-SYSTEMS.md, STORY-BIBLE.md, CHARACTERS-COMBAT.md, README/package.json, actual profile/save/simulation/main/town/world/characters code, profile/progression/combat tests and browser-harness/campaign-browser scripts.

## Rules implemented

- Recruited roster remains nine, with all recruited loadouts retained.
- Fresh selected party is Aldric/Lyra/Rowan `[0,4,3]`.
- Authored milestone takes precedence over fallback: STORY-BIBLE.md chapter table specifies cap4 after Ch2, cap5 after Ch3, cap6 after Ch4. Cap remains3 before that. Unlocks require contiguous clears. Replay uses saved progression, not the replayed chapter number.
- Selection accepts 1..current cap unique recruited IDs. Invalid changes are rejected atomically. New recruits do not silently replace or activate heroes.
- Older saves without selection select the first recruited IDs up to cap. Malformed selections are filtered/deduplicated/capped with a nonempty fallback; roster/loadouts are not truncated to active size.
- Initial Story battle and shared boot path (departure/retry/dev boot) use selection and progression after option overrides. Simulation constructor/reset also clamp Story parties; no progression supplied means cap3 even at a later requested chapter. Wave transitions retain participants.
- Raid/Rogue retain their existing roster behavior. D4/D5 party redesign is not included.
- Town Training hall provides active/bench toggles with full-cap and last-active disabled states, plus explanatory copy. Swap at full capacity is bench one then activate another. Result rows distinguish ACTIVE/BENCH and catch-up bonus.

### Bench XP seed

No exact bench formula was found in the read specification. Let V be full active victory XP from the existing Story formula `180 + floor*75 + stageCount*45`; B=`floor(V*0.5)`; X=bench XP; M=pre-award median XP of battle participants, averaging the middle two and flooring for even parties.

Bonus=`min(B,max(0,M-X-B))`; total=B+bonus, clamped by existing hero XP cap. Thus only the catch-up bonus is bounded by median, while baseline half XP remains available even at/above median. Underlevel here means XP below the median, not solely integer level. Existing downed-active 60% rule is unchanged.

Eligibility is the recruited-ID snapshot copied at battle entry minus combat participants, intersected with current recruited loadouts. New recruits from the completing chapter are excluded even though existing main code recruits before calling settleProgress. Bench and active awards share the same existing WeakSet/receipt-gated settlement. Wrong-mode bench calculation returns null and non-Story settlement never adds bench rows. Settlement receipt reload is unit-tested.

## Exact executed evidence

Environment command `node --version && npm --version`: Node v22.23.1, npm 10.9.8.

1. Tests were written before implementation. Executed `node --import tsx --test tests/story-party.test.ts`: exit1, ERR_MODULE_NOT_FOUND for src/game/story-party; pass0/fail1. This was the expected missing-feature RED.
2. First `npm test` after implementation: tests105/pass104/fail1. The failing legacy assertion expected four/seven automatically active Story heroes by chapter. D3 tests passed. Replaced that obsolete contract with progression-free cap3 expectations; did not remove unrelated endless assertions.
3. First `npm run build && git diff --check`: exit0, 39 modules transformed, build succeeded with existing large Phaser chunk warning.
4. Executed `node scripts/d3-browser.mjs` ONCE. The script started one Vite server on 127.0.0.1:5183 with --strictPort, received HTTP200, launched the existing isolated temporary-profile harness and reached scene texture readiness. It then failed before D3 scenario assertions:

   `SyntaxError: Identifier 'original' has already been declared`

   Cause: the new QA script installed a duplicate top-level console hook. This is an authoring bug in the smoke test, not proof of a gameplay failure or gameplay success. Removed both custom hooks and extended the existing harness event collector to capture Runtime.consoleAPICalled errors directly. The corrected smoke script has NOT been run.

   The executed script's finally terminated its server. Read-back artifacts/d3-browser-report.json was exactly:

   {"checks":[],"consoleErrors":[],"serverStopped":true}

   Empty consoleErrors is NOT a clean-console certification because the scenario stopped early. No D3 screenshots or successful scenario evidence were produced.
5. Final command `npm test && npm run build && git diff --check`: exit0. Test summary: tests105, suites0, pass105, fail0, cancelled0, skipped0, todo0. Seven D3 tests cover caps/progression, party validation/swap, save normalization/reload, constructor/reset/replay and mode isolation, bench formula, idempotent settlement/recruits/receipt reload, wrong-mode bench rejection. Build: 39 modules transformed; completed in 4.61s; existing >500kB engine warning remains. Diff check emitted no diagnostics.
6. `git status --short && lsof -nP -iTCP:5183 -sTCP:LISTEN`: status listed retained D1/D2 and new D3 files; lsof printed no listener and returned1. No second development server was started.

## Files changed by D3

- src/game/story-party.ts: cap/selection validation/defaults, Story entry options, bench formula.
- src/game/profile.ts: separate persisted selection and shared settlement bench awards, layered over D1/D2.
- src/game/simulation.ts: Story-only cap and copied recruited eligibility snapshot.
- src/main.ts: all shared Story entries, town selection events, XP labels.
- src/ui/town.ts: roster/active distinction and playable controls.
- src/town.css: wrapping party controls, existing palette, minimum button height.
- tests/story-party.test.ts: seven new D3 test cases.
- tests/combat.test.ts: superseded automatic Story roster-growth assertion updated.
- scripts/browser-harness.mjs: capture console.error via CDP events.
- scripts/d3-browser.mjs: isolated smoke runner with strict loopback server/finally cleanup (corrected but not successfully exercised).
- docs/D3-VERIFIED.md: this record.
- artifacts/d3-browser-report.json: actual failed-attempt partial report (artifacts ignored by Git).
- dist/: local build output, not deployed.

Pre-existing src/game/save.ts and src/economy changes, D1/D2 tests and unrelated DOCX/HTML were not overwritten or reset.

## Remaining acceptance gaps / precise blocker

The user permits at most one isolated dev server. That one attempt was consumed by the smoke authoring error and its finally shutdown. Starting another server would violate the explicit limit, so browser retry needs renewed permission. Browser fresh3, progressed6-from9, swap/reload, combat active IDs, bench XP/result UI, mobile sizing and clean-console scenarios remain UNVERIFIED, despite their assertions being present in the corrected script. Do not claim end-to-end completion.

Natural-victory balance for reduced Story parties is not certified; the planned browser terminal fixture explicitly forces boss HP to zero for settlement/transition checks, not balance. No physical-device/accessibility certification or new standalone R1 prologue/dungeon routes is claimed. Existing R1 future content is out of this D3 scope.
