# itch.io store page: English copy

Ready-to-paste text for the itch.io project page (Edit game). Every claim below is checked against the v0.4 code (`src/`); see
[docs/ITCH.md](../ITCH.md) for where each field lives and how to upload. Numbers come from the content definitions
(`src/game/*.ts`); if content changes, recheck them.

Tip: the itch.io description editor is a rich-text editor and does not read Markdown. Open this file rendered (GitHub, or
any Markdown preview), select the description section and paste it: headings, bold text and lists keep their formatting.

---

## Title

Gridbound: Ashes of the Bell

## Short description or tagline

(110 characters; itch.io shows it under the title in browse listings.)

> A pixel-art tactical RPG for your browser: 15 heroes on a 3×3 grid, telegraphed bosses and a 16-chapter story.

---

## Description

**The bell of Emberhollow is ringing a warning.** Scouts have gone missing on the Ashwood Trail, a seal lies broken in the
ruins, and something beneath the forest is waking. Gather the Bellkeepers, hold the line on a 3×3 grid, and follow the
story from a burning trail to a town that forgets its children, an archive that writes history in the future tense, and a
dawn nobody has written yet.

Gridbound is a pixel-art tactical RPG with real-time boss battles, made for phones and desktops alike. It runs entirely in
your browser, in English or Bahasa Indonesia.

### How a battle works

Your party stands on a 3×3 grid facing a boss. Every hero's skill gauge fills on its own: **tap a hero to speed it up**,
and rotate between heroes as tap fatigue builds. The boss announces each attack before it lands, and every attack has an
answer:

- **GROUND** attacks mark tiles: drag your heroes to safe ground.
- **MARKED** attacks follow their target: shield it, heal it, or Guard.
- **ALL-GRID** rituals hit everyone: press **Guard** at the right moment, or cut them short with an interrupt skill.

Break the boss's armour, save potions for the worst moments, and unleash **Ninefold Dawn**, a party-wide strike, when
Resolve is full. You can pause at any time.

### Features

- **A 16-chapter story in four acts**: 76 battles, recruit scenes as heroes join, three story choices that change the
  epilogue, a finale with a closing line for each hero, and a Journal to replay it all.
- **15 heroes, 9 classes**: Warrior, Rogue, Archer, Healer, Wizard, Bard, Hexer, Monk and Engineer. Field up to eight
  heroes on the grid and plan the formation tile by tile.
- **Jobs, skills and builds**: each class branches into two advanced jobs and two third jobs (36 jobs, the third jobs with
  unique perks), 72 skills with two equipped at a time, a talent tree with keystones, 54 pieces of gear in six sets, and hero
  levels 1 to 40.
- **The Undercroft**: a roguelite dungeon beneath the Bell Tower. Eight depths, a new room map on every descent (battles,
  elites, events, treasure, camps and a guardian), wounds and potions that carry from room to room, and a pouch you bank by
  climbing out or beating the guardian, and lose if the party falls. Its materials refine your gear.
- **Heroic replays**: replay cleared chapters on a harder setting with a single potion, for a one-time Heroic reward.
- **Chapter stars**: clear the chapter, finish with every hero standing, beat the boss in 80 seconds or less. Stars open
  star chests.
- **Raids**: hunt any of 18 quarries once you have met them, with up to six heroes and any class in any slot. Pick a
  Bronze, Silver or Gold contract and add pacts for an extra twist.
- **Bell Trials**: a roguelike climb, floor after floor, drafting a boon after every floor you clear. Earn Crystal and spend it on relics
  and the Bell Tonic.
- **A town to come home to**: Emberhollow is a pixel-art village hub with a Quest Board (30 quests), a Bestiary of 18
  enemy families in four variants each, a Training Hall and a Merchant.
- **English and Bahasa Indonesia**, switchable from the title screen.
- **Plays in your browser with nothing to install**: no account, and the game itself makes no network requests once it has
  loaded. All art is procedural pixel art and all sound is synthesized in the browser.

### Controls

Mouse or touch:

- **Tap a hero**: speed up that hero's skill gauge.
- **Drag a hero** from anywhere on its card (the skill chip included): move it to another tile (Status view → Move hero does
  the same without dragging).
- **Tap the skill chip on a hero card**: switch to the hero's other equipped skill.
- **Lanes I · II · III** (above the grid, when minions appear): aim ranged skills at a minion lane; tap the same lane again
  to target the boss.
- **Guard, Potion** and **Ninefold Dawn** buttons under the grid (they work while another finger drags a hero; a Potion is
  kept when the party is healthy), **Ⅱ Menu** at the top right (resume, controls, settings or leave). Before the fight,
  **FIGHT!** and **◀ Back** sit in the same row under the grid: **◀ Back** returns to where you set out; nothing is spent
  until you fight.
- In town, **◀ Back** (top left) goes back one screen; the browser's or phone's Back button does the same (in battle it opens
  the menu).

Keyboard (click the game once so it has the keyboard):

| Key | Action |
| --- | --- |
| 1–9 | Tap the hero on that grid tile |
| Q / E | Switch the selected hero's skill |
| G | Guard |
| H | Potion |
| R | Ninefold Dawn |
| B | Boons (Bell Trials) |
| Space / P | Pause (the battle menu) |
| Enter | Start the battle from the ready screen |
| Esc | Back: close the top window, then go back one screen (in battle: the menu) |
| ↑ / ↓, Enter | Title menu |

### Your save

- Progress saves automatically in **this browser's storage** for itch.io. It does not follow you to another browser or
  device, and a private or incognito window forgets it when the window closes. Some browsers keep the storage of an
  embedded game only until the tab closes (Brave's default, for example): download a backup there before you leave.
- Clearing site data, or a browser's storage clean-up, deletes it. **Keep a backup now and then**: Config → Download
  save backup, or Copy backup as text and keep the text in a note (handy on a phone). The game also shows the backup as
  text after a download, in case the browser blocks downloads inside the page, and reminds you after each act.
- Restore a backup with Import save or Paste backup, from Load Game on the title screen or from MENU → Save (the Inn in
  town opens it too).

### Accessibility

- Switching off Config → Full motion turns off flashes, screen shake and hit-stop; the game also follows your system's
  reduce-motion setting.
- Battle events (incoming attacks, a hero going down or getting back up, boss phases, victory and defeat) are announced to
  screen readers.
- Tapping heroes, switching skills, Guard, potions, Ninefold Dawn and pause all have keyboard keys, and heroes can be moved
  with a button (Status view → Move hero) instead of dragging.
- Chapter 1 teaches the basics step by step: tapping, dodging, Guard and the ultimate (skippable; Config → Battle tips turns
  it off).

### Credits

- Game: **[your name or studio]**
- Built with [Phaser 3](https://phaser.io) (MIT).
- Fonts: Press Start 2P (CodeMan38) and Space Grotesk (Florian Karsten), both SIL Open Font License 1.1.
- Pixel art and sound are generated in code; no third-party art or audio files.

---

## Suggested metadata (owner decides)

| itch.io field | Suggestion |
| --- | --- |
| Kind of project | HTML |
| Release status | In development (v0.4) |
| Pricing | Owner's decision (No payments, Free with donations, or Paid) |
| Genre | Role Playing |
| Tags (max 10) | `tactical-rpg`, `pixel-art`, `jrpg`, `roguelite`, `boss-battle`, `dungeon-crawler`, `fantasy`, `story-rich`, `singleplayer`, `phaser` |
| Made with | Phaser |
| Languages | English, Indonesian |
| Inputs | Mouse, Keyboard, Touchscreen |
| Accessibility | Interactive tutorial (only options that are true; see the Accessibility section above) |
| Multiplayer | None (single player) |
| Cover image | `docs/itch/cover.png` (630×500) |
| Screenshots | `docs/itch/screenshots/01-title.png` … `05-undercroft.png` (Indonesian set in `screenshots/id/`) |
| Banner (Edit theme) | `docs/itch/banner.png` (960×240, optional) |

itch.io suggests existing tags as you type: when a suggested tag is close to one of these, prefer the suggestion.
