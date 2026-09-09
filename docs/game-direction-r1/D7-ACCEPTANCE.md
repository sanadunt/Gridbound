# D7 Acceptance — Story Narrative Slice

Status: **PARTIAL / slice verified**. D7 domain, Story persistence, and locked journal UI are implemented and automated-tested. Full authored 16-chapter playthrough and visible Hermes pane smoke remain open.

## Verified

- Authored Story choices exist at chapters 3, 6, and 13.
- Choices are chapter-gated, allowlisted, immutable after selection, and idempotent.
- Main ending is canonical and linear: one ending text, with optional epilogue cards derived from selected flags.
- Narrative state is normalized and persisted in `Profile.narrative` and `StoredStoryState.narrative`.
- Story slot round-trip is covered; Raid and Roguelike materialized profiles clear narrative state.
- Challenge wallet remains separate from Story narrative state.
- Story journal button and modal render.
- Before Chapter 3, journal shows the gate message and renders zero choice buttons.
- Full automated regression: `127 pass, 0 fail`.
- Production build: `npm run build` passed.
- D7 browser smoke: `node scripts/d7-browser.mjs` passed at 768x900 with zero console errors.

## Evidence commands

```text
node --import tsx --test tests/narrative.test.ts tests/commander.test.ts
# 10 pass, 0 fail

node scripts/d7-browser.mjs
# journal locked-state smoke passed; zero console errors

npm test
# 127 pass, 0 fail

npm run build
# tsc and Vite build passed
```

## Remaining gates

- Exercise chapters 3, 6, and 13 through the actual Story progression and select each choice in browser.
- Verify save/reload after a selected choice through the browser harness.
- Verify completed Chapter 16 ending/epilogue journal rendering through the browser harness.
- Run visible Hermes browser-pane smoke after isolated browser configuration is restored; current built-in browser attempt was blocked because `browser.use_real_profile` was detected on.
- Human playtest narrative comprehension and dialogue-card readability; automated tests cannot establish this.

No commit, push, deployment, or external publish was performed.
