# D6 acceptance execution

Status: PARTIAL — not full acceptance. No commit, push or deployment.

## Plan and evidence

1. Scope: checked SAVE-PROFILES.md sections 1–7. D6 approved decision is 3 Commanders, four slots per mode, one active Challenge run. Supporting specification also requires import/recovery and physical-device storage checks.
2. Lifecycle: scripts/d6-browser.mjs passes fresh creation, profile limit, Story manual save/load, reload, profile switch, Raid/Rogue encounter-start suspend/continue/abandon. Victory/defeat settlement lifecycle and all slot combinations remain unverified.
3. Economy: real browser IndexedDB checks show Story old-slot load preserves shared bank=57 and receipt paid-once; Story materialized bank=0. This is a synthetic fixture, not earned combat reward. Duplicate terminal settlement and old Challenge bookmark end-to-end remain open.
4. Storage: independent repositories on real IndexedDB reject stale revision; injected synchronous put failure preserves balance and revision. This is not two independent browser tabs or physical quota exhaustion. Legacy copy/export/import/recovery and crash gates remain open.
5. UI: 390x844 viewport document horizontal overflow assertion passes; screenshot artifacts/d6-profiles-mobile.png. Keyboard and complete mobile flows not verified.
6. Production: npm run test:webapp PASS; npm run package:hostinger PASS; npm run test:hostinger PASS at / and /gridbound/. Package was regenerated before Apache tests, which initially exercised stale packaged assets. git diff --check PASS. Earlier unit run 122 passed; no subsequent game source changes during this execution.

## Harness changes

Production smoke now creates a Commander explicitly and waits for async saves/navigation. Removed old fresh-profile talent purchase assumption because fresh Commander has no starter Gold; talent purchase coverage is therefore not claimed. D6 smoke now includes mobile viewport, run lifecycle, Story wallet non-rewind and IndexedDB fault checks.

## Full acceptance blockers

- General Commander import/recovery UI does not exist; export/fresh-origin import round-trip cannot pass until implemented.
- Physical Safari/private device behavior cannot be inferred from Chromium emulation.
- Two-browser-tab races, terminal reward retries/crashes and live UI legacy migration need additional tests.

Do not mark D6 complete from the successful smoke output alone.
