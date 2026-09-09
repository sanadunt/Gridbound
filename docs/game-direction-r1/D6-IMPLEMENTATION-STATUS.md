# D6 implementation status

Baseline: `6071ecfd6a54ceda42f6e03387497f2587ac4b35`. D6 means approved Commander profiles, not roadmap R6.

Status: connected implementation written and production build passes; **NOT runtime-verified or full D6 acceptance**. Sole source writer; no subagents. Tests explicitly deferred by user. No commits, pushes, deployments, Hostinger configuration changes, browser sessions or player-storage access performed.

## Implemented source flows

- Three Commander documents; four slots per mode (three manual, one auto). Existing modal/button style provides creation, switching, rename, deletion confirmation, export, slot previews and Continue latest.
- IndexedDB document transactions with revision comparisons, transactional three-profile cap, read-back after commit, and cross-tab notification. Stale writes are rejected; no legacy-write fallback. Initial unavailable IndexedDB produces explicitly session-only memory storage.
- Runtime selects a Commander rather than materializing legacy directly. Profile switching resets runtime wallet, setup, loadouts and pending encounter state. Story ledger, currency and receipts remain separate from Challenge shared state.
- Legacy v3 read-only preview and explicit copy action; original bytes can be exported and are retained in the copied document. Challenge bank starts fresh. No automatic migration.
- Encounter-start snapshots preserve simulation state, HP, supplies and RNG; no mid-frame restore claim. Challenge run bookmarks cannot rewind rewards: Continue latest uses the authoritative encounter. Save/Suspend/Abandon/Cancel menu does not abandon merely when opened.
- Result integration applies settlement to a candidate, removes the previous extra Rogue purse credit, and applies Story gold/clear/wins only after settlement accepts. Result confirmation awaits persistence; failed outcome saving locks navigation and offers retry/export. These changes are build-checked, not gameplay-tested.
- Regression tests authored in `tests/commander.test.ts` for slot count/isolation, detached legacy copy, revision/profile cap, deterministic boundary restore and incompatible envelopes.

## Exact final build output

Command: `npm run build` (`tsc --noEmit && vite build`). Exit 0. `git diff --check` also exited 0.

```text
> gridbound-web@0.4.0 build
> tsc --noEmit && vite build

vite v7.3.6 building client environment for production...
transforming...
✓ 43 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                 0.74 kB │ gzip:   0.46 kB
dist/assets/press-start-2p-latin-400-normal-KLytu4cr.woff       6.33 kB
dist/assets/press-start-2p-latin-400-normal-_wFEWmAB.woff2     12.51 kB
dist/assets/space-grotesk-latin-700-normal-RjhwGPKo.woff2      12.84 kB
dist/assets/space-grotesk-latin-600-normal-DjKNqYRj.woff2      13.28 kB
dist/assets/space-grotesk-latin-500-normal-lFbtlQH6.woff2      13.31 kB
dist/assets/space-grotesk-latin-400-normal-CJ-V5oYT.woff2      13.39 kB
dist/assets/space-grotesk-latin-700-normal-CwsQ-cCU.woff       16.42 kB
dist/assets/space-grotesk-latin-600-normal-BflQw4A9.woff       16.88 kB
dist/assets/space-grotesk-latin-500-normal-CNSSEhBt.woff       16.99 kB
dist/assets/space-grotesk-latin-400-normal-BnQMeOim.woff       17.00 kB
dist/assets/index-PI-ovl5q.css                                 57.36 kB │ gzip:  12.38 kB
dist/assets/index-AmgE-YaI.js                                 232.24 kB │ gzip:  82.92 kB
dist/assets/engine-DFK5Ua9d.js                              1,208.06 kB │ gzip: 332.17 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.80s
```

## Deferred verification and remaining limitations

All test execution is deferred per user: no unit suite, browser smoke, live IndexedDB/quota/crash test, stale-tab race test or player-storage verification. Test compilation is not test passage. In particular, modal transitions and retry flows need end-to-end validation before acceptance.

- Legacy copy supports complete v3 only; v1/v2 normalization is not a supported opt-in import UI. It retains Classic-compatible jobs/gear; no full R1 path remapping.
- Export is available; general JSON import/recovery UI is not implemented. Session-only progress is lost on reload unless exported.
- Challenge bookmarked snapshots are preview-only, not independently playable unranked replay scenes. Resume is latest authoritative encounter only.
- Schema checks reject unsupported envelopes but are not a comprehensive hostile-save validator for every nested simulation field. No external save import is exposed.
- Profile menu is a compact functional modal, not a fully paginated profile screen. Accessibility, touch layout and longer names remain browser QA gates.
- Pending outcome recovery is exportable, but automatic recovery import is not implemented. Failure/crash atomicity must still be exercised against actual IndexedDB.
- Story restore/checkpoint, shop and promotion persistence, final Rogue lifecycle and profile-switch races require deferred regression coverage beyond the authored domain tests.

## D5 unresolved gates

Baseline D5 was partial and previously pushed. Its test/smoke gaps remain deferred, not passed. `raidBuild` remains optional in the simulation API and legacy tests expecting nine Raid units have not been updated or validated. D6 integration does not certify D5 acceptance or production readiness.

## Changed paths

- `src/game/commander.ts` (pre-existing untracked foundation extended)
- `src/game/commander-session.ts`
- `src/game/simulation.ts`
- `src/main.ts`
- `tests/commander.test.ts`
- `docs/game-direction-r1/D6-IMPLEMENTATION-STATUS.md`

`Gridbound-R1-Target-GDD.docx` and `design-boards.html` were not modified and remain untracked. Production artifact generated locally at `dist/`.
