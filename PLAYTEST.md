# Gridbound v0.3 verification

## Executed gates

- `npm test`: 57 passing tests, zero failures. Includes all 20 advanced/third signature skills executing real mechanics, job/prerequisite/save validation, equipment ownership, recruitment, combat input caps, AI targets, ritual counters and boon exhaustion.
- `npm run build`: TypeScript and Vite production build pass. Application and Phaser engine are separately cached chunks. Phaser's large-chunk warning remains visible rather than hidden.
- `npm run database`: generates 9 characters, 5 basic / 10 advanced / 10 third jobs, 40 skills, 15 talent nodes per hero, 9 equipment items, 32 monster records, 12 boons, 16 chapters and 76 encounters.
- `scripts/browser-smoke.mjs`: fresh town/three starters, talent purchase, equip/reload, real tap, pause/Escape, opening-act stage transitions, recruitment, no duplicate rewards, roguelike draft/floor continuation, defeat/retry and local-only resource requests.
- `scripts/mobile-smoke.mjs`: real CDP two-touch input and drag at 360, 390 and 768 px; pause, no horizontal overflow, job/talent controls. At 360 px the sprite tap target is about 81.6×44.1 px and the skill chip 62×24 px, with **zero overlap**.
- `scripts/campaign-browser.mjs`: all 16 chapters/76 transitions, advanced + third promotion, signature equip/save/reload, nine recruits, ending journal, 32 distinct rendered texture images, all 12 boons and continuation to floor 14 after the draft pool is exhausted.
- `npm run test:production`: real static bundle under a nested subpath; all resources local, gameplay changes enemy HP, no development QA global.
- Browser harness forced startup failure with a nonexistent Chrome executable: expected nonzero exit and temporary profile cleanup. The success path also exits cleanly.
- npm package audit reported zero vulnerabilities during lockfile synchronization.

## Balance evidence

`npm run balance` fights the full campaign with a fixed input/build policy, rather than setting boss HP or directly declaring victory. The policy rotates taps, reacts to threats, guards rituals, uses consumables/ultimate, and buys upgrades using earned currency.

All **16 chapters / 76 encounters** were cleared. Summed simulated combat time was approximately **64.8 minutes**; the final boss took **104 seconds** for this policy. This is an automated benchmark, **not a measured human playtime or guaranteed difficulty**. Reading, preparation, retries and human input will differ.

Fresh three-hero raid comparison with the same seed:

| Policy | Outcome | Time |
|---|---|---|
| No input | Defeat | 104.5 s |
| Active policy | Victory, all three standing | 84.2 s |

Output is saved locally to artifacts/balance.json. Build choices and individual stages are included for reproduction. CI runs the policy again rather than trusting this document.

## What the browser tests do and do not prove

Long browser campaign tests set terminal enemy HP to exercise UI transitions quickly. This proves reward, recruitment, dialog, save and route wiring, **not combat reachability**. The separate full simulation above supplies that evidence. Form selections are dispatched through DOM change events; mouse/touch interactions are real CDP input. No test touches the user's normal browser storage/profile.

Several intermediate failures were harness issues (wrong DOM selectors and advancing a wave before pressing Begin). Escape behavior was also corrected. These were fixed and rerun; failed attempts are not counted as successful gates. New-system RED tests existed before core expansion implementation, but later database/browser regression coverage was added after code; this is not a blanket strict-TDD claim for every feature.

## Still unverified

- Physical iOS/Android multi-touch feel, speaker audio and low-end sustained performance.
- Safari/Firefox, screen reader usability across the whole game, and controller input.
- Human perception of balance, pacing, story impact and endgame build diversity.
- A public remote hosting deployment. Local static hosting and repository delivery are separate gates.
- Independent model review: delegated review was not used because earlier delegation routed to the wrong model and failed authentication. Work continued in the primary Astra session.

Screenshots are collected in ignored artifacts/ during the browser scripts. They are evidence captures, not a substitute for a physical-device or independent visual-design review.
