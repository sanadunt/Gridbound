# Gridbound: Game-First Immersion Plan

**Status:** Runtime redesign implemented and verified in the local browser matrix; no deployment. Physical Android/iPhone, native browser zoom at 200%, and a native on-screen keyboard remain unverified. See [`docs/GUI-VERIFIED.md`](docs/GUI-VERIFIED.md).

## Design read

Reading this as a pixel-art tactical RPG for players who should move from camp to battle without browsing long pages, using Gridbound's forest-green, brass, and original pixel-art identity.

**Dials:** ENERGY 2 / RHYTHM 3 / MOTION 2. Premium feel comes from clear scene hierarchy, authored transitions, and responsive controls, not more decoration or more buttons.

**Audio:** no background music. Keep optional, event-driven sound effects behind the existing sound setting. Never autoplay audio.

## Problem and product contract

- Before this redesign, Town content overflowed by 968 px at 390×844 and 1114 px at 360×740. Mission entry depended on scrolling; that prior layout motivated the game-first target.
- The core loop becomes a set of viewport-sized game scenes: entry, hub, expedition/map, preparation, battle, intermission, and result.
- At normal browser scale, those primary scenes have no document-level vertical scroll. Their primary action is visible without scrolling. Long secondary collections use tabs, filters, and paging rather than one tall page.
- At 200% browser zoom or unusually short viewports, preserve text and controls without clipping. Reflow detail into separate menu states; allow intentional scrolling only for secondary detail when necessary.
- Phone layouts remain portrait and fill the usable dynamic viewport with safe-area spacing. Desktop no longer uses a narrow 448 px column: use the available landscape canvas, preserve the Phaser board's aspect ratio, and place contextual scenery and panels around it without stretching the board.
- Keep the existing game rules, save formats, economy, and authored campaign. This is a presentation and navigation redesign, not a gameplay or persistence redesign.

## Scene and navigation plan

### 1. Entry and Emberhollow hub

- Keep profile selection and continue/new-run decisions as compact, deliberate screens.
- Replace the stacked Town facility page with a full-screen Emberhollow hub. Show the existing local pixel-art scene as the environment, one current objective, and a clear Continue/Expedition action.
- Use four primary destinations on phone: **Camp**, **Expeditions**, **Party**, and **More**. Desktop uses the same destinations in a compact in-world rail, not a website header plus long page.
- Do not show every facility as a tall list. Camp is the landing scene; selection opens one focused screen or menu at a time.

### 2. Expeditions and mission dossier

- Make the campaign route the main Expeditions scene. Keep the current four-node act map and act progression, with the selected chapter clearly distinguished.
- Selecting a node opens a mission dossier as a separate state: region art, objective, enemy preview, party readiness, and one pinned **Deploy** action. On phone this is a full-height overlay, not a nested panel that pushes the map below the fold.
- Campaign, Raid, and Roguelike are explicit mode choices in this scene. Keep existing unlocks and mode-specific requirements visible before deployment.
- Back returns to the same map selection. No required dossier text or Deploy action sits below the viewport.

### 3. Party preparation

- Give preparation its own screen with the active party and formation visible in the scene.
- Use focused tabs for **Formation**, **Skills**, and **Gear**. Keep the selected hero and a pinned **Deploy** action visible while changing tabs.
- Move talent-tree detail and less frequent management into the Party menu. Preserve current selection, equipment confirmation, party limits, and loadouts.
- Do not combine every training subpage into one vertically stacked Town page.

### 4. Battle and pause

- Make active battle a viewport-sized play screen with three stable regions: threat and enemy state, the large aspect-preserved arena, and a compact party/action rail.
- On phone, arrange those regions vertically to fit 360×640 and taller portrait viewports. Keep the next threat, numeric party health, and essential actions visible; move help, retreat, and secondary statistics into Pause.
- On desktop, use the wider scene for contextual panels and environment, not an empty gutter around a phone-sized website. The Phaser board remains proportional.
- Keep Arena, Hero, and Log available as clearly labeled modes. Hero and Log pause single-player combat and provide one obvious Resume action.
- Pause contains Resume, Controls, Settings, and Retreat/Abandon. Confirm destructive run abandonment before applying it.

### 5. Intermission and result

- Present a stage clear or terminal result as a full-screen game state, not a tall dialog layered over the previous screen.
- Show the actual outcome, survivors, rewards, and the next action. Keep **Continue** or **Return to Camp** visible; move secondary breakdowns into a separate Details state.
- Victory and defeat use distinct authored scene treatments but share navigation and keyboard behavior. Do not require scrolling to claim rewards or continue.

### 6. Secondary game menu

- **More** opens a labeled menu for Journal/Quests, Bestiary, Challenge Shop, Profiles, and Settings. Raid and Roguelike remain under Expeditions.
- Use short paged screens or filters for long lists. Avoid nested scroll areas and avoid adding controls that have no real destination.
- Fullscreen may be offered as an optional user-activated control on supported browsers. Never force browser fullscreen or interfere with browser Back/Escape.

## Immersion and accessibility rules

- Use scene-specific transitions for camp-to-map, Deploy, stage clear, and return. Every motion cue must explain a real navigation or combat event; no endless decorative loops.
- Keep the forest-green, brass, and pixel-art language. Create new art only from the project's local/procedural art pipeline. Hades remains a quality reference, never a layout or asset template.
- Keep combat cues tied to simulation events: telegraph, hit, guard, heal, phase, victory, and defeat. Reduced motion removes shake, particles, and nonessential animation while preserving text, shape, and timing information.
- Keep all controls keyboard reachable with visible focus. Touch targets remain at least 44×44 CSS px with spacing. Tabs, menus, dialogs, and confirmation flows must work with touch and keyboard.
- Respect safe areas and dynamic browser chrome. The on-screen keyboard must not cover profile or text inputs.
- Preserve the current no-music preference. Sound effects remain optional and muted when the existing setting is off.

## Delivery phases

| Phase | Work | Exit evidence |
|---|---|---|
| 0. Lock scene map | Inventory existing states and actions; sketch phone and desktop composition for every core scene. | Screen/state map with one primary action per state and no unresolved navigation destinations. |
| 1. Replace the page shell | Build the viewport-sized root and Camp / Expeditions / Party / More navigation. | Hub and navigation fit at 360×640 and 390×844 without document scroll or clipped actions. |
| 2. Reshape expedition flow | Implement route selection, mission dossier, and party preparation as separate scene states. | Map selection, Back, loadout changes, and Deploy work without returning to a long Town page. |
| 3. Recompose combat and results | Fit threat, arena, party/action rail, pause, intermission, and terminal results to the viewport. | Ready, active, low-health, threat, Hero/Log, intermission, victory, and defeat states all keep required cues and actions visible. |
| 4. Author feedback | Connect navigation and combat events to restrained transitions and current visual/audio effects. | Every cue maps to a real event; mute and reduced-motion settings retain all gameplay information. |
| 5. Verify and cut over | Run the state matrix, keyboard/touch checks, save regressions, and real-device review before removing obsolete stacked views. | Evidence recorded per viewport. No old route, unused control, or misleading alias remains. |

## Acceptance matrix

Test at 360×640, 360×740, 390×844, and 430×932 portrait; 768×1024 tablet; and 1280×720 plus 1440×900 desktop. Add actual 200% browser zoom and physical Android Chrome/iPhone Safari before claiming device support.

For every primary scene:

- At normal scale, `document.documentElement.scrollHeight <= clientHeight + 1` and `scrollWidth <= innerWidth + 1`.
- The scene's primary action is visible without page scrolling. No text, status, or control is clipped or covered by fixed navigation or a safe-area inset.
- Touch targets are at least 44×44 CSS px with usable spacing. Keyboard order follows visual order; Enter/Space activate controls; Escape closes menus and dialogs where appropriate; focus is visible.
- The matrix covers first entry, returning to Camp, each mode, map selection, dossier, all preparation tabs, ready, active combat, low health, telegraph, Hero/Log pause and resume, intermission, victory, defeat, settings, and profile input with the on-screen keyboard.
- Check legacy saves, Commander profiles, economy, checkpoint/retry, and return-to-Town flows for unchanged domain behavior.
- Reduced motion and sound-off are tested. No background music or audio autoplay is introduced.
- Record screenshots and bounds for each scene. Report browser emulation separately from physical-device results.

## Non-goals

The runtime implementation is in the v0.4 working tree; this plan changes presentation and navigation only. Native 200% zoom and physical-device browser verification remain outstanding, as documented in [`docs/GUI-VERIFIED.md`](docs/GUI-VERIFIED.md).
