# Gridbound: Ashes of the Bell

An offline-first, pixel-art tactical RPG for the browser. Three Bellkeepers leave Emberhollow to restore a broken sanctuary—and discover what its protection costs.

## Target game direction R1 (documentation only)

**D1–D8 approval record:** [Approval record](docs/game-direction-r1/APPROVAL-D1-D8.md) captures the R1 target and documentation-first boundary. Approval does not mean every target feature is shipped.

The [new target GDD and mode designs](docs/game-direction-r1/README.md) propose a redesign beyond v0.4; they are not the source of truth for shipped behavior. Some foundations named in R1 already exist in v0.4, including title and Commander screens, campaign map, Raid, Roguelike, and per-mode Commander state. R1-only targets such as five visible attributes, Ultra progression, and material dungeons remain planned. Check [the current-runtime GDD](docs/GDD-GRIDBOUND-V0.4.md) and `src/` for implemented behavior.

## Full production planning

[Production Masterplan](docs/PRODUCTION-MASTERPLAN.md): milestone M0–M7, proposed feature roadmap, editable diagrams, QA/device acceptance, release/rollback operations and evidence templates. This is a documentation-only plan, not production certification or approval to deploy.

## Release status and next production

The v0.4 source update was merged to `main` at `7aced0b`. **Actual Hostinger deployment and full production acceptance remain unverified**; repository delivery is not live verification. See [docs/NEXT-PRODUCTION.md](docs/NEXT-PRODUCTION.md) for the implemented/tested/pending matrix, release blockers, acceptance criteria, verification commands and Hostinger rollback plan. Latest GUI evidence: [docs/GUI-VERIFIED.md](docs/GUI-VERIFIED.md). Earlier PLAYTEST entries describe prior checkpoints, not automatic acceptance of the current working tree.

## Play

Node.js **22.12+** is required only for development/building.

```sh
npm ci
npm run dev
```

Use the local URL Vite prints. The title screen offers **English** or **Bahasa Indonesia** (also under Config; the game reloads to apply it). A new save opens in the village of Emberhollow with **Aldric (Warrior), Lyra (Healer), and Rowan (Archer)**.

### Town

Emberhollow is the hub: tap a building to open it — **Gate** (world map / story chapters), **Training Hall** (party), **Quests**, **Archive** (bestiary), **Merchant** (Crystal shop), **Hunters** (raid contracts), **Old Well** (roguelike), **Inn** (save files) and **Bell Tower** (journal). **MENU** in the top bar opens the classic main menu from anywhere in town.

### Controls

- **Tap a hero** on the battlefield to charge their skill gauge (the gold ATB-style bar in the party window). Rotate heroes as tap fatigue builds.
- **Drag** a hero to another tile to dodge ground attacks (Status view has a button-based alternative).
- Read the red enemy message box: ground attacks stay on tiles, marked attacks follow their target, all-grid rituals need **Guard** or an interrupt.
- `1–9`: tap the hero at that grid position. `Q/E`: switch skill. `G`: Guard. `H`: potion. `R`: Ninefold Dawn. `B`: boons. `Space`: pause. `Escape`: close dialog/cancel move. Title screen: arrow keys + Enter.
- All touch targets are at least 44 px; two-finger taps and touch dragging are supported.

## Included

- **Four acts, sixteen chapters, seventy-six combat encounters** with between-stage story beats, reveals, a concluding epilogue and a rereadable journal.
- Nine named heroes, recruited through the opening act.
- Five basic jobs, **two advanced branches per job**, and a linked **third job for each branch**: ten advanced and ten third jobs.
- Forty active skill definitions; **two equipped at a time**. Promotion unlocks signature skills but does not automatically equip them.
- **Hero levels 1–40**, individual XP bars and level-up results; recruits catch up to the roster median.
- **50 talent definitions / 34 applicable nodes per hero**: foundational unlocks, Assault/Bastion/Tempo branches, class disciplines, dual-prerequisite nodes and mutually exclusive keystones. New nodes spend level-earned skill points and gold.
- Three equipment slots, **42 equipment items**, class/level gates, ownership, six sets with two/three-piece combat bonuses and quest-only relics.
- **12 original monster silhouettes / 48 records** including ash/frost/auric variants; new moth, basilisk, crab and revenant opponents have authored intent sequences and counterplay.
- **30 quests**: twelve hunts, six linked town requests, nine companion milestones and three endless milestones. Track objectives and manually claim gold, selected-hero XP and item rewards.
- Twelve raid targets with variant selection, plus an escalating roguelike with **12 mechanical boons**, nonduplicating drafts and continued floors after all boons are collected.
- Classic JRPG presentation: pixel-art village hub, per-act overworld maps, blue-window menus, hit-stop and screen flashes in battle, and an original victory fanfare.
- Full English and Indonesian text, switchable in game.
- Local procedural sprites, fonts and synthesized sound; no runtime backend, remote CDN or account required.

Advanced promotion requires **campaign rank 4**; third jobs require rank 10 and their parent branch. Campaign rank rises on first clears; **individual hero levels rise through earned XP**. Respec refunds talent/job gold and skill points without resetting XP or equipment. Combat XP and hunt progress settle once on successful expedition/floor completion; downed participants receive 60% XP. Successful replays award XP/gold but never duplicate recruitment or first-clear bonuses.

## Verify

```sh
npm test                 # simulation, progression, jobs, database contracts
npm run database         # regenerate data/database.json from runtime definitions
npm run balance          # full campaign combat policy, no forced victory
npm run build            # TypeScript + static production bundle
```

With the development server running at port 5180:

```sh
npm run dev -- --port 5180 --strictPort
npm run test:browser
npm run test:production  # serves dist itself under a nested subpath
```

Browser scripts use an isolated headless Chrome profile and real CDP mouse/touch events. Set `CHROME_PATH` for a different Chrome installation and `GRIDBOUND_URL` for a different development URL. They do not access your normal browser profile. See [PLAYTEST.md](PLAYTEST.md) for evidence and limits.

## Host

```sh
npm ci
npm run build
```

Upload **the contents of `dist/`**, not the source folder. Any ordinary static host works: Netlify, Vercel, nginx, Apache, object storage or a GitHub Pages subfolder. `base: './'` permits nested paths. Netlify/Vercel build settings are included. No server-side routes or SPA fallback are necessary. See [docs/HOSTING.md](docs/HOSTING.md).

**Hostinger Business / GitHub import:** use **Deploy Web App → Import Git Repository**, choose Vite, build with `npm run build`, and publish `dist`. If using a Node form that requires an entry file, `server.js` and `npm start` serve the built game. See [docs/HOSTINGER-GITHUB.md](docs/HOSTINGER-GITHUB.md) for the exact field mapping and private-repo authorization. No ZIP or Python is needed for GitHub deployment.

**Hostinger / manual hPanel upload:** use `npm run package:hostinger` to generate a static-only ZIP with `.htaccess`, ready to extract into a dedicated `public_html/` or `public_html/gridbound/` folder. Packaging additionally needs Python 3.9+ locally, not on Hostinger. See [docs/HOSTINGER.md](docs/HOSTINGER.md) for safe upload/update steps. CI also produces a `gridbound-hostinger` artifact.

The private repository does not itself create a public game URL. Deployment is a separate choice.

## Source of truth

| Path | Purpose |
|---|---|
| `src/game/simulation.ts` | Seeded combat, targeting, threat resolution, job/gear/boon effects |
| `src/game/content.ts`, `jobs.ts`, `characters.ts` | Skills, progression classes, gear, hero biographies |
| `src/game/world.ts`, `story.ts` | Encounters, monster variants, boons, campaign narrative |
| `src/game/profile.ts`, `src/game/commander.ts`, `src/game/commander-session.ts`, `src/game/save.ts` | Profile progression, Commander persistence, legacy migration, purchases, settlement, recruitment and respec |
| `src/game/levels.ts`, `talents.ts`, `quests.ts` | XP curve, skill trees, quest definitions/objectives |
| `src/ui/town.ts`, `src/ui/world-map.ts`, `src/main.ts` | Town village and menus, world map, journal, combat controls and dialogs |
| `src/styles/` | JRPG theme (windows, menus, battle HUD, results) |
| `src/i18n/` | English/Indonesian UI strings and content translations |
| `src/art/`, `src/render/`, `src/audio/` | Procedural visuals, Phaser renderer and Web Audio |
| `data/database.json` | Regeneratable content database, including actual scaled encounter HP |
| `docs/GDD-GRIDBOUND-V0.4.md` | Human-readable GDD for current runtime behavior, including modes, combat, story, saves, and verification limits |
| `Gridbound_GDD_GRID_RAID.md` | Generated content catalog; some older cross-system notes may lag runtime |
| `docs/game-direction-r1/` | Future-target proposal, not shipped behavior; source code remains the implementation authority |
| `docs/README.md` | Index for current-runtime, future-target, production, hosting, and historical documentation |
| `docs/GDD-PROTOTYPE-ARCHIVE.md` | Earlier design retained for context, not current acceptance criteria |

## Save and release boundaries

Progress has two storage boundaries. The legacy `gridbound.v3` Profile uses `localStorage`; Commander profiles and run checkpoints use IndexedDB through `CommanderRepository`. `CommanderSession` serializes writes and checks revisions. If IndexedDB is unavailable, Commander storage falls back to session-only memory and is lost when the tab closes. Run checkpoints are saved at encounter boundaries, not as live combat frames. Legacy v2/v1 data migrates where compatible; malformed or unsupported legacy saves disable writes rather than overwriting their source. Settings can download a JSON backup. Saves are local to the browser and origin; there is no cloud sync or automatic transfer when the domain changes.

This is a complete playable campaign slice, not a claim of production certification. Physical iOS/Android, Safari/Firefox, low-end performance and human difficulty/usability testing remain unverified. There is no cloud sync, controller support, voice acting or multiplayer. Phaser still emits a large-engine-chunk warning; application and engine chunks are split for caching.
