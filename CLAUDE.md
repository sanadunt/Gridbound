# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gridbound: Ashes of the Bell (v0.4) — an offline-first, pixel-art tactical RPG for the browser. TypeScript + Vite + Phaser 3 (+ GSAP for UI tweens). No backend: the build is a static bundle; `server.js` is only a minimal static file server for Node-based hosts. Node 22.12+ for development.

## Commands

```sh
npm ci
npm run dev                         # Vite dev server on 127.0.0.1
npm test                            # all unit tests (node:test via tsx): tests/*.test.ts
node --import tsx --test tests/combat.test.ts                         # one test file
node --import tsx --test --test-name-pattern="shield absorbs" tests/combat.test.ts   # one test
npm run build                       # tsc --noEmit (typecheck) + vite build -> dist/
npm run database                    # regenerate data/database.json from src/game definitions
npm run docs                        # database + regenerate Gridbound_GDD_GRID_RAID.md
npm run balance                     # simulate the full campaign with a scripted input policy (writes artifacts/balance.json)
```

There is no linter/formatter configured; `tsc` (strict) via `npm run build` is the type check.

CI (`.github/workflows/ci.yml`) runs: `npm test`, `npm run database` then **`git diff --exit-code -- data/database.json`**, `npm run build`, `npm run balance`, and `scripts/package-hostinger.py`. So any change to content definitions in `src/game/` (skills, jobs, gear, talents, quests, enemies, campaign, boons) must be followed by `npm run database` and committing the regenerated `data/database.json`. `npm run balance` must still clear the whole campaign without shortcuts, so combat/number changes can fail CI there.

Browser tests (`scripts/*-browser.mjs`, `*-smoke.mjs`) drive headless Chrome over raw CDP via `scripts/browser-harness.mjs` (not Playwright). They expect a dev server on port 5180 and a Chrome binary:

```sh
npm run dev -- --port 5180 --strictPort
CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:browser      # or a single script: node scripts/combat-hud-browser.mjs
npm run test:production    # serves dist/ under a nested subpath
npm run test:webapp        # production build through server.js
```

The harness defaults `CHROME_PATH` to the macOS Chrome path (and adds `--no-sandbox` when running as root); `GRIDBOUND_URL` overrides the dev URL. Navigate in tests with `click.nav('party' | 'campaign' | 'raid' | 'more' | …)`, which goes through the real UI (town buildings, MENU, gate mode tabs) — there is no bottom nav bar. Screenshots go to `artifacts/` (gitignored). `language-browser` and `story-scene-browser` cover the language switch and story scenes. Not every browser script is in `test:browser`; others (e.g. `d2`…`d7`, `pact`, `training`, `archives`) are run individually.

## Architecture

- **Pure game logic in `src/game/`, no DOM.** Everything here is importable from Node tests and scripts. `simulation.ts` holds the `Battle` class: a seeded, deterministic, fixed-timestep combat simulation (`tick(dt)`, `tap`, `move`, `act`, `potion`, `ultimate`, `snapshot()`), parameterized by mode (`adventure`/`raid`/`endless`…) and `BattleOptions` (roster, loadouts, boons, rogue/raid builds, raid contracts). Tests advance it with `b.tick(1/60)` loops; determinism (`seeded encounter behavior is reproducible`) is a tested invariant — don't introduce `Math.random`/wall-clock into it.
- **Content definitions** are plain TS data: `content.ts` (`KITS` basic jobs/skills, `ROSTER`), `jobs.ts` (advanced/third jobs, `GEAR`, sets), `talents.ts`, `levels.ts`, `quests.ts`, `world.ts` (`CAMPAIGN`, `ENEMIES`, `BOONS`), `story.ts`/`narrative.ts`/`characters.ts`, `d8-content.ts`. `data/database.json` and `Gridbound_GDD_GRID_RAID.md` are generated exports of these — never hand-edit them.
- **Two save layers:**
  - Legacy `Profile` (`profile.ts`, `save.ts`) in `localStorage` key `gridbound.v3`, with v1/v2 migration; malformed saves disable writes instead of overwriting. Progression mutations (`promote`, `equipGear`, `buyTalent`, `settleProgress`, `completeZone`, `claimQuest`, …) are functions over a `Profile`.
  - **Commander** system (`commander.ts`, `commander-session.ts`): IndexedDB (`gridbound.commanders.r1`) documents holding per-mode state for `story | roguelike | raid`, slots (`manual-1..3`, `auto`), and run checkpoints saved at encounter boundaries. `CommanderSession` serializes writes, checks revisions, and goes read-only when another tab commits (`StaleCommanderError`). `materializeProfile(document, mode)` turns a Commander document into the `Profile` the rest of the game uses; `applyRuntimeToDocument` writes runtime state back. Falls back to in-memory session storage if IndexedDB is unavailable.
- **Mode-specific builds:** `story-party.ts`, `roguelike-build.ts`, `raid-build.ts` produce/normalize the party inputs for `Battle`; `src/economy/` holds currency and the challenge run-wallet/shop/raid-contract logic.
- **Rendering/UI:** `src/render/BattleScene.ts` is the Phaser scene that renders a `Battle` (3×3 hero grid via `ARENA`/`cell`), consuming `battle.events`. Sprites and item icons are procedural (`src/art/`, `items.ts` for equipment icons), audio is synthesized Web Audio (`src/audio/sound.ts`) — no asset files or CDNs; keep runtime fully local/offline. In battle, each hero's grid cell (`#unit-layer .unit-card`) carries its HP bar and a skill chip (`[data-skill-switch]`: toggles 2-skill heroes, opens `#skill-picker` for more); `#focus-bar` summarizes the selected hero, and the full party list lives in the Status view. `src/main.ts` is the large orchestrator: title screen, battle HUD, dialogs, result ceremony (`ui/result-gate.ts`), and Commander session wiring. `ui/town.ts` renders every town route: the camp is a full-screen pixel village (`src/art/town-scene.ts` exports the canvas plus `TOWN_HOTSPOTS` percent rectangles that become `.town-spot` buttons with `data-facility`/`data-open-action`), and the MENU route (`more`) is the JRPG main menu. `ui/world-map.ts` draws the per-act overworld (`src/art/overworld.ts`). `ui/dialogue.ts` plays story scenes (title card + typewriter message pages); first-time chapter departures play the chapter intro (skipped under `navigator.webdriver`, like the title screen — tests trigger it with `window.gridbound.chapterIntro(i)`), and the Journal can replay intros.
- **Styles** live in `src/styles/` (`base.css` tokens/windows/buttons/menus, then `title`, `town`, `screens`, `battle`, `result`), imported from `main.ts`. The UI chrome uses the original Gridbound palette (deep forest-green `.win` panels with thin frames, brass-gold `.btn.primary`, outlined `.btn`), `.menu-list > .menu-item` with the ▶ cursor, `.tabs`, `.gauge`; game art (sprites, town, overworld) stays pixel art. Fonts are local `@fontsource` packages (Space Grotesk body, Press Start 2P headings/numbers). The game is one portrait column (`--col`) on every screen size; the battle arena keeps its 600×760 aspect via a size container (`.arena-slot`).
- **i18n:** `src/i18n/index.ts` exposes `t(key, vars)`, `lang()`, `setLang()`; UI strings live in `en.ts` / `id.ts` (`id.ts` is typed `Record<keyof typeof EN, string>`, so `tsc` fails if a key is missing). Language is stored in `localStorage['gridbound.lang']` (default from `navigator.language`) and applied by reloading the page. Game content is localized in place at startup by `localizeContent(lang)` (`src/i18n/content.ts` + `content-text.ts`, keyed by content paths) so `src/game/` sources and `data/database.json` stay untouched; runtime battle strings go through `eventText()`, and validation/storage messages from game modules through `gameText()`. When you add or change player-visible text in `src/game/`, add/update its `CONTENT_TEXT` entry — nothing fails automatically if a hand-written entry goes stale.
- **Dev QA hook:** in dev builds only, `main.ts` exposes `window.gridbound` (`snapshot`, `profile`, `battle`, `step(seconds)`, `boot`, `showTitle`, …). Browser tests depend on it; production smoke tests assert it is absent. Browser tests seed state by pre-writing `localStorage['gridbound.v3']`.
- **Static hosting:** `vite.config.ts` uses `base: './'` so `dist/` works from any subpath; Phaser is split into an `engine` chunk. `scripts/package-hostinger.py` builds a Hostinger ZIP with `.htaccess`; `tests/hosting.test.ts`, `web-deploy.test.ts`, `node-hosting.test.ts` cover deploy config and `server.js`.

## Conventions

- Match the existing dense style: much of `src/game/` and the tests are compact one-line functions/tests with minimal whitespace. Imports use extensionless relative paths.
- Never hard-code player-visible strings in UI code; add a key to both `en.ts` and `id.ts`. Source strings authored inside `src/game/` are mostly Indonesian prose with English names; their translations live in `src/i18n/content-text.ts`.

## Documentation boundaries

`src/` is the authority for shipped behavior. `docs/GDD-GRIDBOUND-V0.4.md` describes the current runtime. `docs/game-direction-r1/` (R1 target GDD, D1–D8) and `docs/PRODUCTION-MASTERPLAN.md`/`docs/production/` are future plans, not implemented behavior. `PLAYTEST.md`, `docs/GUI-VERIFIED.md`, `docs/NEXT-PRODUCTION.md` are verification records; don't claim deployment or device verification that hasn't been done.
