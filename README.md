# Gridbound: Ashes of the Bell

An offline-first, pixel-art tactical RPG for the browser. Three Bellkeepers leave Emberhollow to restore a broken sanctuary—and discover what its protection costs.

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
- Fifteen talent nodes per hero: thirteen passive nodes and two basic active-skill unlocks. Job advancement adds the signature unlocks separately.
- Three equipment slots (weapon, armor, charm), nine deterministic items, ownership and free swapping of purchased items.
- Eight original monster silhouettes, each with ash/frost/auric variants: **32 monster records** with readable intent patterns.
- Four raid contracts and an escalating roguelike with **12 mechanical boons**, nonduplicating drafts and continued floors after all boons are collected.
- Local procedural sprites, fonts and synthesized sound; no runtime backend, remote CDN or account required.

Advanced promotion requires party level 4; third jobs require level 10 and their parent branch. Level rises on a chapter's first clear. Respec refunds talent and job costs; equipment remains owned. Loot is banked only at the end of an expedition. Replays give gold but never duplicate recruitment or levels.

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

The private repository does not itself create a public game URL. Deployment is a separate choice.

## Source of truth

| Path | Purpose |
|---|---|
| `src/game/simulation.ts` | Seeded combat, targeting, threat resolution, job/gear/boon effects |
| `src/game/content.ts`, `jobs.ts`, `characters.ts` | Skills, progression classes, gear, hero biographies |
| `src/game/world.ts`, `story.ts` | Encounters, monster variants, boons, campaign narrative |
| `src/game/profile.ts` | Validated saves, purchases, prerequisites, recruitment and respec |
| `src/ui/town.ts`, `src/main.ts` | Town/training/forge, journal, combat controls and dialogs |
| `src/art/`, `src/render/`, `src/audio/` | Procedural visuals, Phaser renderer and Web Audio |
| `data/database.json` | Regeneratable content database, including actual scaled encounter HP |
| `Gridbound_GDD_GRID_RAID.md` | Current implemented design and system rules |
| `docs/GDD-PROTOTYPE-ARCHIVE.md` | Earlier design preserved for context, not current acceptance criteria |

## Save and release boundaries

Progress uses browser `localStorage` under the existing v2 namespace. New job/gear fields migrate safely. The older prototype save is left intact; only compatible currency/settings are migrated from it. Save data is per-browser **and per-origin**: moving to another domain does not automatically move progress. In-progress fights are not saved; finish the current chapter before reloading.

This is a complete playable campaign slice, not a claim of production certification. Physical iOS/Android, Safari/Firefox, low-end performance and human difficulty/usability testing remain unverified. There is no cloud sync, controller support, voice acting or multiplayer. Phaser still emits a large-engine-chunk warning; application and engine chunks are split for caching.
