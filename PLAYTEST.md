# Gridbound v0.4 verification

> Latest GUI checkpoint: 84 tests passed, full browser suite and local production hosting passed; visual/device and expanded-state bounds remain open. See [GUI-VERIFIED](docs/GUI-VERIFIED.md) and [NEXT-PRODUCTION](docs/NEXT-PRODUCTION.md). Historical counts below are checkpoint records, not the final release gate.

## Executed gates

- `npm test`: 77 passing tests, zero failures. Includes Hostinger configuration and deterministic static-only ZIP validation. Includes all 20 advanced/third signature skills executing real mechanics, job/prerequisite/save validation, equipment ownership, recruitment, combat input caps, AI targets, ritual counters and boon exhaustion.
- `npm run build`: TypeScript and Vite production build pass. Application and Phaser engine are separately cached chunks. Phaser's large-chunk warning remains visible rather than hidden.
- `npm run database`: generates 9 characters, 5 basic / 10 advanced / 10 third jobs, 40 skills, 50 talent definitions / 34 nodes per hero, 42 equipment items, six sets, 30 quests, hero levels 1–40, 48 monster records, 12 boons, 16 chapters and 76 encounters.
- `scripts/browser-smoke.mjs`: fresh town/three starters, talent purchase, equip/reload, real tap, pause/Escape, opening-act stage transitions, recruitment, no duplicate rewards, roguelike draft/floor continuation, defeat/retry and local-only resource requests.
- `scripts/mobile-smoke.mjs`: real CDP two-touch input and drag at 360, 390 and 768 px; pause, no horizontal overflow, job/talent controls. At 360 px the sprite tap target is about 81.6×44.1 px and the skill chip 62×24 px, with **zero overlap**.
- `scripts/campaign-browser.mjs`: all 16 chapters/76 transitions, advanced + third promotion, signature equip/save/reload, nine recruits, ending journal, 48 distinct rendered texture images, all 12 boons and continuation to floor 14 after the draft pool is exhausted.
- `scripts/progression-browser.mjs`: 390/1440 px v2→v3 migration, byte-identical legacy backup, independent XP, point spending/level gates, three-piece equipment set, 30 quest records/filter/claim/track, hunt→variant raid, rank scaling, terminal reward settlement, save/reload and corrupt-save protection. Zero runtime exceptions.
- `npm run test:webapp`: real production game through `server.js` on an assigned localhost port; town, party preparation and campaign combat pass, assets stay local and the development QA global is absent. HTTP tests also cover non-root working directories, HEAD, immutable cache, missing build output, malformed URLs, source/dotfile exclusion, traversal, symlinks and invalid ports.
- `npm run test:hostinger`: extracts the deploy ZIP into isolated local Apache roots; real browser gameplay passes at `/` and `/gridbound/`. HTTP checks verify JavaScript MIME, HTML revalidation, immutable hashed cache, gzip, 403 for hidden files/directory listing and 404 for missing assets. This is not a live Hostinger deployment.
- `npm run test:production`: real static bundle under a nested subpath; all resources local, gameplay changes enemy HP, no development QA global.
- Browser harness forced startup failure with a nonexistent Chrome executable: expected nonzero exit and temporary profile cleanup. The success path also exits cleanly.
- npm package audit reported zero vulnerabilities during lockfile synchronization.

## Balance evidence

`npm run balance` fights the full campaign with a fixed input/build policy, rather than setting boss HP or directly declaring victory. The policy rotates taps, reacts to threats, guards rituals, uses consumables/ultimate, and buys upgrades using earned currency.

All **16 chapters / 76 encounters** were cleared. Summed simulated combat time was approximately **46.2 minutes**; the final boss took **80.1 seconds** for this policy. This is an automated benchmark, **not a measured human playtime or guaranteed difficulty**. Reading, preparation, retries and human input will differ.

Fresh three-hero raid comparison with the same seed:

| Policy | Outcome | Time |
|---|---|---|
| No input | Defeat | 104.5 s |
| Active policy | Victory, all three standing | 84.2 s |

The same earned campaign build also defeats all **48 raid variants** at campaign rank 17; no terminal HP shortcut is used for this gate. The campaign policy ends with heroes at levels **21–22**, claims **23 quests**, and does not exercise every possible talent/gear build.

Output is saved locally to artifacts/balance.json. Build choices and individual stages are included for reproduction. CI runs the policy again rather than trusting this document.

## What the browser tests do and do not prove

Long browser campaign tests set terminal enemy HP to exercise UI transitions quickly. This proves reward, recruitment, dialog, save and route wiring, **not combat reachability**. The separate full simulation above supplies that evidence. Form selections are dispatched through DOM change events; mouse/touch interactions are real CDP input. No test touches the user's normal browser storage/profile.

Several intermediate failures were harness issues (wrong DOM selectors and advancing a wave before pressing Begin). Escape behavior was also corrected. These were fixed and rerun; failed attempts are not counted as successful gates. New-system RED tests existed before core expansion implementation, but later database/browser regression coverage was added after code; this is not a blanket strict-TDD claim for every feature.

## Still unverified

- Physical iOS/Android multi-touch feel, speaker audio and low-end sustained performance.
- Safari/Firefox, screen reader usability across the whole game, and controller input.
- Human perception of balance, pacing, story impact and endgame build diversity.
- This update on the user’s live Hostinger deployment. Only local Node/static/Apache hosting was exercised; no deployment settings were changed.
- Independent model/visual review: the delegation and image-analysis paths returned HTTP 401. No result from those failed calls is treated as a review. The primary session completed implementation, automated checks and source review; independent approval is not claimed.

Screenshots are collected in ignored artifacts/ during the browser scripts. They are evidence captures, not a substitute for a physical-device or independent visual-design review.
