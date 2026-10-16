# Gridbound phone contract (v1)

> **Status: plan and acceptance target, not a description of shipped behaviour** (see "Documentation boundaries" in `CLAUDE.md`; `src/` is the authority). The phone shell package (SHELL: L1–L5, the touch rules G1–G3 and G9, the 16px form fields and the rotate hint of L6) is implemented and its checks are gates in `scripts/phone-browser.mjs`; the other packages' rules (TOWN, BATTLE, SAFE, INSTALL, PERF) are targets that the same script lists in `report` mode until their package lands.

Why this exists: the owner wrote "Aku main di HP sihh, karena fokus gamenya kan di HP. Bisa sesuaikan?" ("I play on my phone, since the game's focus is the phone. Can you adapt it?"). The phone is the primary platform and desktop is secondary. We don't know which phone or which host the owner uses, so the contract covers **Android Chrome and iPhone Safari**, on **the web build and the itch.io frame**.

A phone layout crawler (21 runs, 51 screens), a touch tester, two phone playtesters (new and late-game), a performance engineer and a platform auditor produced 75 confirmed findings. Every screen and interaction must satisfy this contract.

**Relation to the navigation contract.** This contract extends the navigation contract (the "Navigation contract" paragraph in `CLAUDE.md`) and never weakens it:
- labelled `[data-nav-exit]` exits;
- one Back step for every Back input;
- the history guard;
- ◀ Back top-left;
- Ⅱ Menu top-right in battle;
- Skip top-right in story scenes;
- a safe option focused in every confirmation.

Where a phone rule seems to pull a navigation exit somewhere else, the navigation contract's placement wins and the phone rule is met another way. Where this contract and the code disagree, the code is the bug.

Design stays as it is: deep forest-green `.win` panels with thin frames, brass-gold `.btn.primary`, Press Start 2P for headings and numbers, Space Grotesk for text, pixel art, one portrait column (`--col` 600px).

---

## 0. Terms

- **Phone**: a coarse primary pointer (`(pointer: coarse)`), or a viewport 480px wide or less. Most rules below are absolute floors, so they hold on desktop too.
- **Hosts**:

  | Id | Host | What changes |
  |---|---|---|
  | **W** | Web build, a browser tab (Android Chrome, iPhone Safari) | The root never scrolls, so the URL bar and toolbars never hide. `env(safe-area-inset-*)` is live. The Fullscreen API exists on Android and not on iPhone. Storage is first-party, and Safari evicts it after 7 days unused. |
  | **WS** | Web build installed (Home Screen / standalone, once INSTALL lands) | No browser bars. Top and bottom insets apply. On iPhone the storage is separate from Safari's. |
  | **I** | itch.io frame: the 540×900 desktop embed, and on phones itch's full-screen overlay (the frame is the whole viewport) | `env()` is 0 inside the frame. Storage is partitioned under itch.io. No manifest and no service worker. Fullscreen is available only with `allow="fullscreen"`. |

- **Variants**: *full* is the whole screen (itch overlay, an installed app, or a browser whose bars are gone). *bars* is the browser UI showing. On the web build *bars* is the normal case.
- **Effective size**: computed `font-size`, or the hit box found by hit-testing (`document.elementFromPoint` over the control's box, so `::before` extensions count), multiplied by any CSS transform scale.
- **Inset band**: a strip of the viewport inside `env(safe-area-inset-*)`, as set by `Emulation.setSafeAreaInsetsOverride`.

---

## 1. Devices we support and test

These are the profiles that `scripts/phone-browser.mjs` uses (ids as written):

| Id | Device | Full (CSS px) | Bars (CSS px) | DPR | UA | Insets, full | Insets, bars | Why |
|---|---|---|---|---|---|---|---|---|
| `a360` | Small Android | 360×740 | 360×640 | 3 | Android Chrome | bottom 24 | bottom 24 | The most common phone width. Gesture bar (Chrome 135+ edge-to-edge). |
| `se` | iPhone SE | 375×667 | 375×553 | 2 | iPhone Safari | none | none | The shortest portrait we support. |
| `i15` | iPhone 15 | 393×852 | 393×659 | 3 | iPhone Safari | top 59, bottom 34 | none | Full = installed or standalone; bars = Safari. |
| `p7` | Pixel 7 (large Android) | 412×915 | 412×835 | 2.625 | Android Chrome | bottom 24 | bottom 24 | |
| `land` | iPhone 15 landscape | 852×393 | 852×343 | 3 | iPhone Safari | left/right 59, bottom 21 | same | The phone held sideways. |
| `itch` | itch mobile full-screen frame | 390×844 | — | 1 (cross-origin frame input quirk) | Android | 0 (inside the frame) | — | Covered by `scripts/itch-smoke.mjs`. |
| `embed` | itch desktop embed | 540×900 | — | 1 | desktop | — | — | Existing. |
| `desk` | Desktop | 1280×900 | — | 1 | desktop | — | — | Regression: desktop must keep working. |

- **Support floor.** Portrait 360×553 CSS px and larger. Anything narrower (320px, and `gui-layout-smoke` at 180×370) is best effort: no horizontal overflow and nothing unreachable. Landscape phones must work from 640×340 up.
- **Engines.** Android Chrome 111+ and iOS Safari 16.4+. The CSS already needs container queries, `:has`, `dvh` and `color-mix`; Screen Wake Lock needs 16.4. Older engines are not supported, and no finding is filed for them.
- **Test matrix.** Every rule is checked on `a360`, `se`, `i15`, `p7` and `land`, in the *full* and *bars* variants, in EN. ID is checked at `a360` and `i15`. Every text-fit rule (L5, L8, T1–T5, K1) runs in both languages at `a360` and `se`.
- **Real devices.** Real iOS Safari, Android gesture navigation, pull-to-refresh, long-press menus and iOS input zoom cannot be produced in headless Chrome. They are on the manual checklist (§10), and their rules are also backed by static CSS tests.

---

## 2. Layout and safe areas

- **L1 Viewport meta** stays `width=device-width,initial-scale=1,viewport-fit=cover`. Never add `maximum-scale` or `user-scalable=no`: low-vision players must still be able to pinch-zoom.
- **L2 Insets are honoured.**
  - `:root` defines `--safe-t/--safe-r/--safe-b/--safe-l: env(safe-area-inset-*, 0px)`.
  - `#app` is padded by the four insets (`box-sizing: border-box`), so the HUD, town routes and the battle screen live inside the safe rectangle.
  - The overlays positioned `inset: 0` inside `#app` (`.title-screen`, `.result-screen`, `.dialogue-scene`) fill the padding box. They keep their art full-bleed but pad their own content and controls by the insets (for example, Skip gets `top: calc(10px + var(--safe-t))` and `right: calc(10px + var(--safe-r))`).
  - `dialog#modal`: `max-height: calc(100dvh - 32px - var(--safe-t) - var(--safe-b))`, `width: min(calc(100vw - 24px - var(--safe-l) - var(--safe-r)), 540px)`.
  - Floating layers (`.storage-status`, the coach bubble, `.town-notice`, `#skill-picker`, `#skill-toast`) stay inside the inset rectangle.
- **L3 Test.** With `Emulation.setSafeAreaInsetsOverride` set for the profile, no enabled interactive control (`button`, `a[href]`, `summary`, `select`, `input`, `textarea`, `label` that wraps a control, `[role=button]`, `.unit-card`), and no text of the HUD bar, battle top bar, action bar or a sticky footer, intersects an inset band (0.5px tolerance). This covers `#home`, `#menu-button`, `#settings`, `#pause`, `.cmd`, `#start`, `#ready-back`, `.deploy-bar .btn`, `.ceremony-actions .btn`, `[data-nav-exit]` and `[data-continue-story]`. Bands: `i15` full top 59 and bottom 34; `a360`/`p7` bottom 24; `land` left/right 59 and bottom 21.
- **L4 Viewport units.** Sizes use `dvh`, `svh`, `%` or container units. `vh` never appears in `src/styles` (static test). `vw` is allowed, because width does not change with the bars.
- **L5 No horizontal page scroll.** On every screen and profile, `document.documentElement.scrollWidth <= innerWidth + 1`. No element's box crosses the viewport's left or right edge unless it sits inside a horizontal scroller.
- **L6 One portrait column, and landscape.** `--col` 600px on every size. On a landscape phone (`(pointer: coarse) and (orientation: landscape) and (max-height: 500px)`):
  - every town route scrolls as one page, and its sticky footer stays reachable;
  - the battle uses its side-by-side layout with the arena sized by height and the intent panel beside it, not over the boss;
  - town routes and the title show a one-line, non-blocking hint, "Turn your phone upright for the best view". It is never shown over a fight, fades by itself (shown again only on the next turn to landscape, never after a fight), and ignores taps (`pointer-events: none`).
  - Orientation is locked to portrait only when the game is in fullscreen (I1) or installed (I2).
- **L7 One scroller per route.** A route scrolls as a whole, or as one main list. No nested vertical scroller is shorter than 40% of the viewport height while its content is taller. This bans the 118px training panel. A dialog scrolls as one.
- **L8 The primary action is visible on arrival.** On every profile, including *bars*, the screen's primary action is fully on screen when the screen opens, without any scrolling, and `elementFromPoint` at its centre returns it (or a descendant):

  | Screen | Primary action |
  |---|---|
  | Camp | 'Next: CH n' (`[data-continue-story]`) or the guide's Go |
  | Chapter dossier | Enter (`[data-depart]`) |
  | Party, Jobs | Depart (`.deploy-bar`) |
  | Raid setup, Bell Trials setup | the departure button |
  | Undercroft route | the first open depth card (`[data-dungeon-pick]:not(:disabled)`) |
  | Depth dossier | Descend ▶ (`[data-dungeon-start]`) **and** ◀ Back |
  | Undercroft run map (after Descend, after a room, after an event) | every open room of the current row (`.room.open`) |
  | Gear or job inspector, right after the tap that opened it | its confirm (`[data-confirm-gear]`, `[data-confirm-job]`, Equip now) |
  | Ready window | FIGHT! (`#start`) and ◀ Back (`#ready-back`) |
  | Result | the sticky `.ceremony-actions` row |
  | Bell Trials boon draft | the first boon card in full; the others reachable with one swipe |
  | Quest Board | Claim all (when it claims something) |
  | Any dialog | its primary button and its exit row |

- **L9 Sticky footers never hide content.**
  - A sticky action row or sticky exit is the last child of its scroller.
  - The content before it can be scrolled fully above it (a bottom margin or spacer at least the sticky row's height).
  - A dialog whose primary action comes right before its exit puts both in one sticky row (`dialog#modal > .modal-actions`) instead of making only the exit sticky.
  - A `scrollIntoView` that brings a control into view uses that control (or its action row), not its whole panel.
- **L10 Nothing covers the grid before FIGHT!** During the ready window, `elementFromPoint` at the centre of every `.unit-card` returns that card (or a descendant), for 6- and 8-hero parties, in chapters 1, 5 and 11, in EN and ID.

---

## 3. Type

Phones change the type scale by moving small labels from the pixel font to the body font, and by raising floors. Sizes are not scaled down with the viewport.

| Role | Font | Floor (everywhere) | Notes |
|---|---|---|---|
| Headings, big numbers, short readouts ('CH 5', 'FASE 1/3', '1,240 / 3,000', timers) | Press Start 2P (`var(--pixel)`) | **10px** | At most about 14 characters. Never multi-word labels. |
| Kickers, tags, slot and row labels (FRONT/MID/BACK, Slot 1 · opener, Weapon, NEW, LV n, rank and EXP tags, quest kicker, prices '65G', log timestamps) | Space Grotesk, weight 600 | **12px** | Moved off the pixel font on every screen. |
| Secondary text (`small`, hints, meta, chip and name-tag labels in battle) | Space Grotesk | **12px** | |
| Descriptions (quest, skill, talent, job, boon, gear) | Space Grotesk | **13px** | Running copy and dialogue are 14–15px. |
| Badge digits inside a dot (MENU count, roster dot), text badges ('NEW', 'Guild 21') | Space Grotesk, weight 700 | **10px** | On a map narrower than 300px a text badge drops its text and keeps a dot. It never shrinks below the floor. |
| Form controls (`select`, text `input`, `textarea`, `.backup-text`) on `(pointer: coarse)` | inherits | **16px** | Stops iOS Safari from zooming on focus. |

- **T1 Floors** apply to the effective size of every visible text node, in every scroller, dialog and overlay. Container-scaled sizes (`clamp`, `cqw`) have floors at or above these. `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }`.
- **T2 Static test** (`tests/health.test.ts`, CI) over every `src/styles/*.css`:
  - a rule using `var(--pixel)` with `font-size` under 10px fails;
  - a `font-size` under 12px fails unless its selector is on the badge or glyph allowlist (badges at 10px or more; pseudo-element glyphs such as ▶ and ×);
  - the floor is enforced by the test, not by convention.
- **T3 Names never break mid-word and are never ellipsized where the player must identify them.**
  - No `overflow-wrap: anywhere` on names; whole words wrap.
  - Battle skill chips show the full name if it fits, otherwise the first word, otherwise the skill's 2-letter emblem. The full name is in the chip's `aria-label`/`title`, the focus bar, the Status view and the switch toast.
  - Hero name tags and route titles never use an ellipsis on phones; they wrap to 2 lines or shrink to the floor.
- **T4 Units stay together.** 'CH 7' and 'HEROIC · CH 7' use a no-break space (U+00A0) in `en.ts` and `id.ts` and never split. Only stage names wrap.
- **T5 Both languages fit.** Indonesian strings run about 20% longer. Every layout check runs in ID too (§1 matrix). Content names (skills, talents, chapters, enemies) stay English inside the ID UI.

---

## 4. Tap targets and reach

- **K1 Size.** Every visible, enabled control has an effective hit box of at least **44×44 CSS px**. That includes the dialog ×, `<details>` summaries, Bestiary T1–T4 chips, language buttons, Quest buttons, Undercroft room nodes, the coach's Skip, checkbox rows (the whole label row is the target), and the skill book's I/II. The only exception is the battle grid (K2).
- **K2 Battle grid** (dense by design):
  - At every portrait profile, including *bars*, each hero card is at least **70×56 CSS px** (at least 64×50 in landscape).
  - The card's hero zone (points that hit `.unit-tap`) covers at least 60% of the card and is at least 32px tall.
  - The skill chip's hit zone stays inside its own card: its top no higher than the HP bar, its bottom no more than 2px past the card. It is at least 24px tall.
  - A drag can start anywhere on the card.
- **K3 Spacing.** Separate controls are at least **8px** apart, edge to edge (Guard ↔ Potion ↔ Ninefold Dawn, quest buttons). Segments of one control (tabs, the language switch) may touch.
- **K4 Nothing invisible on top.**
  - An invisible control never sits over a visible one: the lane buttons are `pointer-events: none` until minions are on the field.
  - A hit-area extension never reaches into another control's visual box, for example a chip's `::before` into the card below.
- **K5 Thumb zone.**
  - In portrait, the screen's forward action sits in the bottom 40% of the viewport, normally in a sticky footer or the battle tray. This covers the L8 primaries: Depart, Enter, Hunt, Descend, FIGHT!, the result actions and Claim all.
  - FIGHT! and its ◀ Back sit in the battle tray (the action bar) during the ready window.
  - The navigation exits keep their navigation-contract places (◀ Back top-left, MENU and Ⅱ Menu top-right, Skip top-right). They are rare actions, and "same place every time" wins.
- **K6 Danger placement.**
  - A destructive button (`.btn.danger`: Abandon, Leave the chapter, Flee, Delete, Reset) is never focused by default and never first in its row.
  - It never appears where the control that opened its dialog was.
  - It sits at least 8px from the safe option.
  - Leave dialogs are ordered Save & suspend (focused), Cancel, then the danger option last.

---

## 5. Touch behaviour

- **G1 No accidental zoom.**
  - `html { touch-action: manipulation; }` (no double-tap zoom).
  - The arena, hero cards and chips use `touch-action: none` (no pan or zoom gestures start there).
  - Form controls are 16px (no focus zoom).
  - Page pinch-zoom stays possible (L1).
- **G2 No selection, callout or drag ghost.**
  - `#app` has `-webkit-user-select: none; user-select: none; -webkit-touch-callout: none`.
  - `input`, `textarea`, `select`, `[contenteditable]` and `.backup-text` get `-webkit-user-select: text; user-select: text; -webkit-touch-callout: default`. On iOS a text field under a `user-select: none` ancestor cannot be typed in without that.
  - `img { -webkit-user-drag: none; }`, and `draggable="false"` on the camp map art and portraits.
  - A 500ms long press anywhere in the game opens no image menu and selects no word.
  - With a mouse (`(hover: hover) and (pointer: fine)`), the paragraphs of a dialog stay selectable, so a save error can be copied into a bug report.
- **G3 Swipes never move the page or the host page.**
  - `html` (not `body`) has `overscroll-behavior: none`, which turns off Android pull-to-refresh. With a mouse or trackpad (`(hover: hover) and (pointer: fine)`) the root keeps `overscroll-behavior-x: auto`: a trackpad's swipe-back is a browser Back, which the history guard turns into one step back.
  - Dialogs and scrollers have `overscroll-behavior: contain`.
  - In the itch frame, while the whole frame is on screen, a one-finger swipe that nothing in the game can scroll is cancelled on its first cancelable `touchmove` (a finger moving up asks to scroll content down). Two fingers (pinch) are never touched.
  - Test (itch-smoke, 390×844, host page with extra height): swipes up and down on the camp map, the HUD bar, `#intent`, `#guard`, a skill chip and the end of the Quests list leave the host's `scrollY` unchanged, both at 0 and pre-scrolled to 300.
- **G4 Taps activate on release.**
  - Activation happens on `click` or `pointerup`, never on `pointerdown`. A swipe that starts on a button scrolls and presses nothing.
  - `touch-action: manipulation` means there is no 300ms delay.
- **G5 Drags.**
  - The hero drag threshold is 9px.
  - A drag can start on any part of the card: sprite, name tag, HP bar or skill chip.
  - A drag released on the hero's own tile within 24px and 300ms counts as a tap.
  - A drag released off the grid, or over a control, cancels and fires nothing.
- **G6 Multi-touch.**
  - Every battle control works while another finger is down: hero cards (already), skill chips, Guard, Potion, Ninefold Dawn and Ⅱ Menu.
  - Each one activates on the `pointerup` of its own pointer, if that pointer moved 12px or less and was not cancelled. The browser's follow-up `click` is ignored.
  - A keyboard or assistive-tech `click` (`detail === 0`) still activates exactly once.
  - Two fingers on two heroes count as two taps. A third finger is ignored.
- **G7 No double fire.**
  - Content that appears or moves under the finger ignores pointer activations for **450ms** after it appears. This covers a modal opening or swapping content, a town re-render, an inspector opening, and a result screen.
  - Spending and destructive controls ignore them for **600ms** (`CHOICE_INPUT_DELAY_MS`): Descend, Promote, Buy & equip, Equip now, the Crystal Exchange Buy, Abandon, Leave the chapter, Flee, Reset and Delete.
  - Results keep `RESULT_INPUT_DELAY_MS` (1000ms).
  - Keyboard activations are not delayed, except where a guard already exists (the stale Reload).
  - Potion ignores a second activation within 600ms. It refuses when every living hero is at 95% HP or more, and shows a toast instead ('Party is healthy').
- **G8 Spending takes two steps.** Every town control that spends gold or Crystal, or changes a build, first opens an inspector. Only the inspector's confirm spends. This covers gear, jobs, talents and the Crystal Exchange relics.
- **G9 No hover-only or keyboard-only information.**
  - Every `:hover` rule lives inside `@media (hover: hover)`; `:focus-visible` styles stay unconditional (static test).
  - Nothing is shown only in a `title` attribute: each Undercroft party portrait shows its name.
  - On coarse pointers, the Controls help names touch gestures (tap a hero, tap the skill chip, Ⅱ Menu, your phone's Back), and the key hints stay hidden.
- **G10 Sound follows activation.** UI cues play on `click` for touch and pen, and on `pointerdown` only for a mouse. A scroll never clicks audibly.

---

## 6. The phone life-cycle

| Event | What must happen |
|---|---|
| **C1** Page hidden (`visibilitychange`→hidden, `pagehide`, `freeze`) | A live fight pauses (pause menu; this works today). A pending Commander save is flushed. A started Undercroft fight notes HP and potions, is marked `backgrounded`, and is persisted at once. Story, Raid and Bell Trials keep their checkpoints by design. Town saves are already immediate. |
| **C2** Window blur with the document unfocused (notification shade, Control Center, a tap on the itch host page) | A live fight pauses. |
| **C3** Return to the page | Nothing resumes by itself: the pause menu waits for Resume. Sound comes back, including iOS's `interrupted` state. The wake lock is requested again while a battle is on screen. |
| **C4** OS discard or reload of a backgrounded tab | It never costs more than the checkpoint. A backgrounded Undercroft fight restarts the room at the noted HP and potions with the pouch intact, and a notice says so. A reload while the tab was visible keeps the anti-reload flee penalty. |
| **C5** Rotation | No state is lost. The layout recovers, the fight keeps its state, and neither orientation scrolls horizontally. |
| **C6** Screen auto-lock | While a battle is on screen (ready, fighting or paused), the game holds a screen wake lock where allowed (refused in the itch frame and on battery saver: ignored silently). The lock is released in town and on results. |
| **C7** Back/forward cache | The production build stays bfcache-eligible in Chrome. Never add an `unload` handler. |
| **C8** A detour after a defeat | A lost Story battle k (k > 1) left through a defeat fix or Return stays resumable as 'Resume CH n · battle k'. If that cannot be kept, leaving asks first, with 'Retry this battle' focused. |

---

## 7. Install, fullscreen and storage

- **I1 Fullscreen.**
  - Config offers Fullscreen wherever `document.fullscreenEnabled` is true: the web build on Android, and itch with `allow="fullscreen"`. It never appears on iPhone, which has no element fullscreen.
  - On a coarse pointer, entering fullscreen asks for a portrait lock (best effort, errors ignored).
  - The choice is remembered per viewer (`gridbound.ui.fullscreen`) and requested again on the next real tap after a reload.
  - Leaving fullscreen with the phone's Back or Escape takes no game Back step and does not pop the history guard.
- **I2 Installable (web build only).**
  - The manifest has `name`, `short_name` 'Gridbound', `start_url`/`scope` resolving to the game's folder, `display: standalone`, `display_override: ["fullscreen", "standalone"]`, `orientation: portrait`, `background_color`/`theme_color` from the palette, and PNG icons 192, 512 and maskable 512.
  - The page also has `apple-touch-icon` 180, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title` 'Gridbound' and `apple-mobile-web-app-status-bar-style` `black-translucent` (safe on top of L2).
  - The manifest is served as `application/manifest+json` (server.js, `.htaccess`) and compressed.
  - Icons are generated at build time or are small committed files outside `public/`. They are never fetched from a network.
- **I3 The itch build stays clean.** The itch ZIP has no manifest, no app icons, no `apple-*`/`mobile-web-app-*` tags and no service worker (tests/itch.test.ts, package-itch.py).
- **I4 Persistence.** The web build, when not in a frame, calls `navigator.storage.persist()` best-effort (it never throws). It does this after the first settled chapter clear and when Config or Save files open, and shows the result.
- **I5 Backups on every build.**
  - Save files offers Download backup, **Copy backup as text** and **Paste backup** on every build, not only in a frame.
  - A download's blob URL lives at least 60s.
  - The last backup time is kept per viewer in `gridbound.ui.backupAt`.
- **I6 What the player is told.** Every message is an i18n key in both languages:

  | Host | Where | Message (EN; ID follows the glossary) |
  |---|---|---|
  | W/WS, persistence granted | Config and Save files status line | "Saves are protected on this device." |
  | W Android, not granted | same | "The browser may clear saves when the phone runs low on space. Keep a backup." |
  | W iPhone Safari (not standalone) | same | "Safari deletes the saves of sites you haven't opened for 7 days. Add Gridbound to your Home Screen, or keep a backup." Once INSTALL lands, add: "The Home Screen app starts with its own empty save: copy your backup first, then paste it there (Save files → Paste backup)." |
  | WS iPhone | same | "Saves are kept by the Home Screen app." |
  | I (itch) | same | "Saves live in this browser's storage for itch.io. Keep a backup." |
  | W Android | Config | Fullscreen row, sub-line: "Fill the whole screen. Your phone's Back gesture leaves it." |
  | Every host | A notice after an act clear (chapters 4/8/12/16), and in town when the last backup is older than 7 days (never on a fresh save) | "Keep a copy of your progress: Copy backup" with the action. Dismissible, at most once a day. |
  | Every host | Undercroft room, after a background discard | "The game closed in the background: the fight waits, wounds as they were." |

---

## 8. Performance budgets

- **How it is measured.** `scripts/perf-browser.mjs` on the production bundle, the `p7` profile (412×915, DPR 2.625, 4× CPU) and a low-end profile (360×740, DPR 3, 6× CPU), medians of 3 runs. Networks: Slow 4G (1.6 Mbps / 150ms) and Fast 4G (9 Mbps / 60ms). Headless Chrome renders WebGL in software (SwiftShader), so the gates are GPU-independent: main-thread ms/s, long tasks, input delay, transfer and loop state. Frame rate and tap-to-paint are reported, not gated. Another agent's browser can skew timings, so always use medians.
- **Budgets** (p7 at 4× unless noted):

  | Id | Budget | Baseline |
  |---|---|---|
  | P1 | First pixels (an inline splash, never a blank screen) ≤ **1.0s** on Slow 4G | Blank until 5.06s |
  | P2 | Title painted ≤ **4.0s** on Slow 4G; cached reload ≤ **1.5s** | 5.06s / 1.98s |
  | P3 | JS on the critical path before the title ≤ **300 KB gzip**. The Phaser chunk is not `modulepreload`ed and loads after the title. First load in total ≤ **750 KB gzip**. | 605 KB JS before the title; 694 KB total |
  | P4 | Input delay of the first tap on the title ≤ **100ms**. Fastest title → camp on a cached reload ≤ **2.5s**. | 632–770ms; 2.9–3.4s |
  | P5 | Battle, CH13 late save, 8 heroes: main thread ≤ **450 ms/s**, long tasks ≤ **60/min**, none over 200ms, input delay median ≤ **50ms**, full-document layouts ≤ **15/s** | 697 ms/s, 138/min (max 211ms), 64–79ms, 36/s |
  | P6 | Idle on the title, camp, world map, MENU and Party: style recalcs ≤ **10/s** and main thread ≤ **20 ms/s**. A paused fight, an open result or wave-clear card, or the Status/Log view: the Phaser loop asleep and ≤ 20 ms/s. | Title 194 ms/s, camp 133, map 147, 60 recalcs/s; paused 154–342 ms/s |
  | P7 | Tap → next frame for every town route ≤ **200ms**; Depart → ready window ≤ **350ms** | Raid 268ms; Depart 455–552ms |
  | P8 | Every host serves text compressed: server.js (br/gzip, `Vary: Accept-Encoding`), Hostinger (mod_deflate), itch (CDN) | server.js uncompressed: 2.19 MB, title at 12.46s |
  | P9 | Render: at most 60 fps; no `preserveDrawingBuffer`; preFX and postFX pipelines disabled (11 shader programs, not 31) | 120Hz uncapped; 31 programs |
  | P10 | Heap after 10 battles ≤ 15 MB; DOM nodes and listeners flat after the first battle | 9.12 MB (passes) |
  | P11 | No AudioContext while Sound is off; the context suspends when the page is hidden and after silence | Running from the first tap |

---

## 9. English and Indonesian

- Every new or changed player-visible string is a key in both `src/i18n/en.ts` and `src/i18n/id.ts`. `tsc` fails on a missing ID key, and `tests/i18n-ui.test.ts` fails on an unused key. Never hard-code text in UI code.
- Indonesian follows `src/i18n/glossary.ts`: *ketuk*, *Ramuan*, *Kembali*, *Jeda*, *Ⅱ Menu*, *pertarungan*, *kamu/-mu*. *chapter*, *skill*, *party* and *run* stay English. Tuning numbers reach text as `{vars}`. Use `fmtInt`/`fmtDec`/`fmtSec`.
- Touch wording: under `(pointer: coarse)` the Controls help and the fullscreen sub-line use `.touch` keys that name gestures, never keys.
- Every layout rule (L5, L8, T1–T5, K1) is checked in ID as well as EN at `a360` and `se`.

---

## 10. Verification

- **`scripts/phone-browser.mjs`** (new; created by SHELL, extended by every package):
  - It walks the screen tour (title, camp, MENU, Config, Save files, Journal, Party and its tabs and inspectors, Quests, Bestiary, Crystal Exchange, map, dossier, Undercroft route, depth dossier, run map, room, Raid and Bell Trials setups, story intro, ready, fight, pause, Controls, leave dialog, Status, Log, wave result, victory, defeat, raid, Undercroft and Bell Trials draft) with real touch input on the §1 profiles, in the full and bars variants. It uses the seeded fresh, mid and late saves.
  - It asserts the rules in the table below.
  - Each check carries its owner package and a mode: `gate` fails the run, `report` only lists. A package flips its own checks to `gate` when it lands; at the end all are `gate`.
  - `PHONE_ONLY=<profile|screen regex>` narrows a run, `PHONE_FULL=1` runs the whole matrix, and screenshots go to `artifacts/phone/<profile>-<save>-<lang>/<screen>-<variant>.png`.
  - The default matrix (in `test:browser`) is: `a360` bars EN and ID (mid save), `se` bars EN (mid), `i15` full with insets EN (fresh), and `land` EN (mid).

  | Rule | Check | Owner |
  |---|---|---|
  | L3 | Inset bands | SHELL |
  | L5 | Overflow | SHELL |
  | G1–G3 | Computed touch CSS | SHELL |
  | T1 | Text floors outside battle | TOWN |
  | T1 | Text floors in battle | BATTLE |
  | K1, K3 | Targets and spacing outside battle | TOWN |
  | K1, K3 | Targets and spacing in battle | BATTLE |
  | K2 | Battle grid | BATTLE |
  | L7 | Nested scrollers | TOWN |
  | L8 | Arrival, town and dialogs | TOWN |
  | L8 | Arrival, battle and results | BATTLE |
  | L10 | Ready sheet | BATTLE |
  | G5, G6 | Drags and multi-touch | BATTLE |
  | G7 | Double tap: modal and town | SAFE |
  | G7 | Double tap: Potion | BATTLE |
  | C1–C6 | Life-cycle | SAFE |
  | I1–I6 | Install and storage | INSTALL |
  | P1–P11 | Performance | PERF (in perf-browser.mjs) |

- **Static checks (CI, `npm test`):**
  - `tests/health.test.ts`: pixel font at least 10px; px fonts at least 12px apart from the allowlist; no `vh`; `overscroll-behavior` on `html`; the coarse-pointer 16px form rule; `:hover` only inside `(hover: hover)`.
  - `tests/itch.test.ts`: no manifest or app tags in the itch build.
  - `tests/node-hosting.test.ts`: compression and the manifest MIME type.
  - `tests/dungeon.test.ts`: the background interrupt path.
  - A static source check that `main.ts` has no value import of Phaser.
- **Existing browser tests keep passing:** nav, a11y, combat-hud, town-flows, town-screen, town-ux, runs, save-safety, save-dialogs, dungeon, raid-setup, mobile-smoke, itch-smoke, production and webapp.
- **Manual device checklist.** Record a result in `docs/GUI-VERIFIED.md` only when it was really done on a device.
  - **Android Chrome, gesture navigation:**
    - a downward swipe on the camp HUD and on a Quests list at its top never reloads;
    - Guard, Potion and Depart clear the gesture bar;
    - Fullscreen on and off with Back;
    - install from the browser menu;
    - long press on the camp shows no image menu;
    - a 120Hz phone stays cool in town.
  - **iPhone Safari:**
    - focusing a select or the name field never zooms;
    - long press shows no callout;
    - double tap never zooms;
    - sound returns after an app switch and a screen lock;
    - Add to Home Screen, then Paste backup in the app;
    - standalone respects the notch and home indicator.
  - **itch mobile page:** swipes never scroll or reload the itch page.
