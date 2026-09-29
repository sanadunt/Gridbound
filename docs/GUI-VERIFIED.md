# GUI verification — local, not deployed

## Portrait implementation pass — local verification

Applied to the v0.4 runtime; no deployment performed.

### Viewport and state evidence

- The centered game surface caps at 448 CSS px. At 1280×720 it begins at x=416; at 1440×900 it begins at x=496. Desktop gutters remain non-interactive.
- At 390×844, `#town-screen` measures 1583 px scroll height / 615 px client height (968 px overflow). At 360×740 it measures 1625 / 511 px (1114 px overflow). Mission entry remains reachable with one Town scroll path, but these totals exceed the provisional overflow budgets.
- At 360×740, the battle-ready card is x=10, y=424.5, w=340, h=199. Its 44 px start button ends at y=623.6; the arena begins at y=630.6.
- At 180×370 and 195×422, half-size CSS viewport proxies showed no horizontal overflow and visible targets remained at least 44 px. These are not native browser-zoom or physical-device tests.
- Intermission and victory actions remained reachable by scrolling the result dialog; at 180×370 the dialog had no horizontal overflow. At 390×844 the victory dialog used one vertical scroll path, with retry and return actions reachable after scrolling.
- Active battle checks covered numeric party HP, boss phase and intent cues, low health, event-log entries, pause while Hero/Log is open, resume to Arena, healing, an ultimate, stage transitions, and final victory.
- Sound and full-motion settings were disabled in the manual session and remained disabled after reload. Automated Chrome is launched with audio muted; no music was played.

### Automated checks

- `npm test`: 128 passed, zero failures.
- `npm run build`: passed; Vite reports the existing Phaser engine chunk above its 500 kB warning threshold.
- `npm run test:browser`: passed desktop, mobile 360/390, 16 chapters / 76 stage transitions, 48 distinct monster textures, and RPG progression/save checks at 390/1440. Mobile checks confirmed two-touch input, dragging, pause/resume, 44 px stance controls, and no browser errors.
- `npm run test:production`: passed the nested `/subdir/Gridbound/` route, local-resource checks, active gameplay, and absence of the dev QA API. One earlier run overlapped the browser suite and timed out at CDP; the isolated rerun passed.

### Known verification limits

- Actual 200% browser zoom, physical Android Chrome, and iPhone Safari were not tested.
- Town vertical overflow is materially above the plan's provisional targets; content is preserved rather than clipped.

## Earlier GUI verification record

Executed directly in the main Astra session without new subagents.

- npm test: 84 passed, zero failures.
- npm run build: passed; Phaser chunk-size warning remains.
- GRIDBOUND_URL=http://127.0.0.1:5193/ npm run test:browser: passed desktop, mobile 360/390, 16 chapters / 76 transitions, progression/save/quest/gear flows.
- npm run test:webapp, test:production, test:hostinger: passed, including Apache root and subfolder.
- git diff --check: passed.

Implemented: training subpages, individual quest/bestiary/campaign listing pages, selected talent branch with SVG prerequisite paths and selected-node detail, free equipment preview followed by explicit confirm, enemy-death readiness before result dialog plus one-second input lock, incomplete-v3 save protection regression.

Layout measurements via scripts/gui-layout-smoke.mjs on initial/default screens (not every late-game content state): no horizontal overflow. Desktop 1440x900 vertical overflow 0–41px; mobile390x844 0–113px; mobile360x740 0–232px. Opening optional details or equipment preview may increase height. Not a claim of zero scroll or completed visual polish. Combat detail uses expandable panel; its final vertical layout has not been measured in this pass. SVG paths need visual review for clarity and crossings. Physical devices and Safari/Firefox remain unverified.

No commit, push or live Hostinger deployment performed. Latest package artifacts/Gridbound-Hostinger-0.4.0.zip was rebuilt from this source. Dev URL http://127.0.0.1:5193/ is local only.
