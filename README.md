# Gridbound: Ashes of the Bell

An offline-first, pixel-art tactical RPG for the browser. Three Bellkeepers leave Emberhollow to restore a broken sanctuary—and discover what its protection costs.

## Full production planning

[Production Masterplan](docs/PRODUCTION-MASTERPLAN.md): milestone M0–M7, proposed feature roadmap, editable diagrams, QA/device acceptance, release/rollback operations and evidence templates. This is a documentation-only plan, not production certification or approval to deploy.

## Release status and next production

The local v0.4 candidate is **not deployed or production-approved**. See [docs/NEXT-PRODUCTION.md](docs/NEXT-PRODUCTION.md) for the implemented/tested/pending matrix, release blockers, acceptance criteria, verification commands and Hostinger rollback plan. Latest GUI evidence: [docs/GUI-VERIFIED.md](docs/GUI-VERIFIED.md). Earlier PLAYTEST entries describe prior checkpoints, not automatic acceptance of the current working tree.

## Play

Node.js **22.12+** is required only for development/building.

```sh
npm ci
npm run dev
```

Use the local URL Vite prints. A new save opens in town with **Aldric (Warrior), Lyra (Healer), and Rowan (Archer)**. Begin at the war table, or prepare talents, two active skill slots, equipment and formation at the training yard.

### Controls

- **Tap the character/sprite area labelled `TAP ↓ CD`**, not the small skill chip. This accelerates the current cooldown; rotating heroes helps manage fatigue.
- The small chip **below** the sprite switches between the two equipped skills. The selected-character panel provides larger alternatives.
- **Drag** a character to relocate or swap. A button-based relocation alternative is also available.
- Read the enemy intent. Ground attacks stay on tiles; marked attacks follow their target. **Guard or interrupt** all-grid rituals.
- `1–9`: tap the hero at that grid position. `Q/E`: switch skill. `G`: Party Guard. `H`: potion. `R`: ultimate. `Space`: pause when a button is not focused. `Escape`: close dialog/cancel move.
- Two-finger tapping and touch dragging are supported. Mobile skill chips are 24 px tall; sprite tap targets are at least 44 px tall at tested 360/390 px widths, with no overlap.

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
| `src/game/profile.ts`, `save.ts` | Validated saves/migration, purchases, reward settlement, recruitment and respec |
| `src/game/levels.ts`, `talents.ts`, `quests.ts` | XP curve, skill trees, quest definitions/objectives |
| `src/ui/town.ts`, `src/main.ts` | Town/training/forge, journal, combat controls and dialogs |
| `src/art/`, `src/render/`, `src/audio/` | Procedural visuals, Phaser renderer and Web Audio |
| `data/database.json` | Regeneratable content database, including actual scaled encounter HP |
| `Gridbound_GDD_GRID_RAID.md` | Current implemented design and system rules |
| `docs/GDD-PROTOTYPE-ARCHIVE.md` | Earlier design preserved for context, not current acceptance criteria |

## Save and release boundaries

Progress uses browser `localStorage` under **`gridbound.v3`**. Existing v2 saves migrate automatically; the original v2 value is left untouched. Migrated heroes receive a campaign-rank-based starting level. Corrupt or future-version saves disable writes instead of overwriting their source. Settings can download a JSON backup. The older prototype migrates only compatible currency/settings. Save data is per-browser **and per-origin**: moving to another domain does not automatically move progress. In-progress fights are not saved; finish the current chapter before reloading.

This is a complete playable campaign slice, not a claim of production certification. Physical iOS/Android, Safari/Firefox, low-end performance and human difficulty/usability testing remain unverified. There is no cloud sync, controller support, voice acting or multiplayer. Phaser still emits a large-engine-chunk warning; application and engine chunks are split for caching.
