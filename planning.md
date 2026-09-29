# Gridbound: Portrait-First Immersive Experience Plan

**Status:** portrait-first UI changes are implemented locally; verification evidence and remaining gaps are recorded in [`docs/GUI-VERIFIED.md`](docs/GUI-VERIFIED.md). No deployment is authorized or performed.

This plan turns the recent UI audit and the user's direction into an ordered presentation and responsive-layout effort. The target is an immersive, readable browser RPG experience built around portrait mobile framing. Hades is a quality reference for pacing and polish, not a visual template to copy.

## 1. Goal and product direction

- Design every core screen for a portrait phone first.
- On a wide PC browser, present the same portrait-oriented game surface centered in the window. Do not stretch the game into a desktop dashboard. Use the side gutters as quiet, non-interactive world framing, not as a second place for controls or required information.
- Keep Gridbound's existing forest-green, brass, and local pixel-art identity. Use original art, motion, sound, and scene transitions to strengthen that identity.
- Make the battle arena and all character silhouettes easy to see. Health, cooldowns, telegraphs, and controls must stay readable without covering heroes, enemies, lanes, or other important battle information.
- Make each screen serve one primary player decision. Keep long or secondary details reachable without squeezing text or stacking every feature on one page.

Initial implementation decision: cap the portrait game surface at 448 CSS px and center it on desktop; desktop gutters remain quiet and non-interactive. Short viewports preserve authored content through the page's single vertical scroll path, but current Town overflow exceeds the provisional budgets. A half-size CSS viewport proxy was checked; actual 200% browser zoom and physical devices remain unverified.

## 2. Baseline and scope

The current runtime is v0.4. Existing source is authoritative for shipped behavior. The R1 documents describe future direction and are not evidence that R1 features are already implemented.

The existing project direction already supports this work:

- `docs/game-direction-r1/UX-ART.md` proposes focused screens, readable 14 to 16 px body text, touch targets of at least 44 px, and Arena / Hero / Log navigation for mobile combat. Treat these as design proposals until the runtime is changed and verified.
- `docs/GUI-VERIFIED.md` records prior default-screen measurements: vertical overflow ranged from 0 to 41 px at 1440x900, 0 to 113 px at 390x844, and 0 to 232 px at 360x740. Those measurements do not cover every expanded state, and the final combat layout was not measured in that pass. Physical phones and Safari or Firefox were not verified there.
- The recent directional browser audit at 1440x900 and 390x844 found that the mobile facility strip visibly cuts off part of a tab label, and the mission dossier requires scrolling within its own panel before its main action appears. These are review findings, not a complete device QA result.

This plan covers presentation and responsive UX for the existing game flow: entry, town or map, mission briefing, preparation, battle, intermission, and result. It does not automatically include the broader R1 gameplay, save, profile, or economy redesign. It does not add new game modes, story content, accounts, cloud services, multiplayer, monetization, or voice acting.

## 3. Layout and battle HUD principles

### Portrait shell

- Use one portrait composition on phone and PC. On PC, center it and cap its width based on the first wireframe. Do not add desktop-only sidebars that compete with the play area.
- Keep the game surface usable when the browser is short. Scrolling may be necessary, but one obvious scroll path is preferred over nested panels that hide primary actions.
- Never solve fit by clipping text, shrinking controls below touch size, hiding required information, or forcing horizontal scrolling.
- Respect device safe areas and browser viewport changes. Fixed headers, action trays, and bottom controls must not cover content.
- Keep keyboard operation on PC. Mobile controls must work by touch without hover-only dependencies.

### Battle safe zones

The battle screen should have three reserved regions. Exact dimensions and arrangement must be set in a wireframe and checked against the actual Phaser scene before implementation.

1. **Threat band:** enemy identity, boss health, phase, and current threat summary sit outside the hero sprite area. A lane telegraph stays associated with the lane it affects and remains visually distinct from character silhouettes.
2. **Arena:** heroes, enemies, lanes, attack ranges, and movement space remain the visual focus. HUD elements must not sit over sprite hit areas or cover the telegraph that determines the next decision.
3. **Party and action band:** persistent party health and status indicators sit in a dedicated tray below or beside the arena, not on top of the characters. Skill controls, selected-hero actions, and tap targets have clear spacing. Expanded hero details and battle log use a labeled panel or tab.

Keep essential health visible while players inspect detail. If opening Hero or Log detail would hide the fight in progress, pause single-player combat explicitly and provide an obvious resume action. Do not rely on color alone to communicate low health, damage, guard, or threat state.

### Immersion

- Use scene art and transitions to connect the selected region, mission briefing, and encounter. Keep environmental animation subtle unless a battle event gives it a reason to intensify.
- Tie impact, guard, skill, telegraph, phase change, victory, and return feedback to real game events. Motion should clarify cause and effect, not run as decoration.
- Use original Gridbound art and sound direction. Hades may inform the quality bar for timing and feedback, but its characters, layouts, icons, and assets must not be copied.
- Respect mute and reduced-motion settings. Essential combat information must remain available without sound, flashing, shake, or particles.

## 4. Ordered work phases

| Phase | Work | Exit evidence |
|---|---|---|
| 0. Lock the portrait contract | Confirm the portrait-first shell, desktop framing, supported minimum viewport, scroll behavior, and visual scope. Inventory every screen and state in the current core loop. | Approved portrait wireframe and a screen/state list. Any undecided landscape or tablet behavior is recorded, not assumed. |
| 1. Reflow the game shell | Design the entry, town/map, mission brief, and navigation for portrait use. Replace clipped or crowded navigation with an accessible mobile pattern. Keep one clear primary action per screen. | Wireframes at 360x740 and 390x844, plus the same portrait surface centered at desktop widths. All primary actions are visible or reachable through one clear scroll path. |
| 2. Protect the battle view | Design the threat band, arena, party health tray, skill controls, detail panel, and pause behavior. Check the actual hero and enemy silhouettes, lane markers, and telegraphs before fixing HUD positions. | Battle wireframes for ready, active combat, low health, telegraph, phase transition, detail-open, and result states. No required information or control obscures a character or combat cue. |
| 3. Add authored presentation | Plan region-specific scene framing, purposeful transition timing, combat feedback, and sound cues. Identify original assets and their provenance before production. | A small approved visual and audio direction with event-to-feedback mapping, reduced-motion behavior, and no copied Hades assets. |
| 4. Rework preparation and results | Apply the same portrait rules to party setup, training, mission dossier, intermission, and result screens. Move secondary detail into reachable, labeled panels. | Every core-flow screen has one primary decision, preserved selection/back behavior, and reachable secondary information. |
| 5. Verify with real use | Run the browser state matrix, inspect screenshots and bounds, then test on physical Android Chrome and iPhone Safari before claiming phone support. Keep PC keyboard behavior in the same pass. | Evidence is recorded per viewport and state. Overlap, clipping, input, readability, reduced-motion, audio, and runtime issues have an explicit disposition. |

No dates or effort estimates are set yet. They require an approved scope, a final portrait wireframe, and a named device matrix.

## 5. Priorities

### P0: layout contract and battle readability

- Lock the portrait-on-PC presentation rule and viewport assumptions.
- Reserve safe space for the battlefield, party health, enemy health, telegraphs, and controls.
- Remove clipping and unreachable primary actions from the first-run and mission-entry flow.

### P1: immersive core loop

- Connect entry, region, mission, encounter, and result with authored transitions.
- Add original environment and character presentation plus event-driven combat feedback.
- Keep navigation and secondary information from overpowering the arena.

### P2: full-screen consistency and device polish

- Carry the same type scale, spacing, touch behavior, focus states, and motion rules through preparation, collections, settings, and long-detail states.
- Validate physical devices, browser safe areas, text scaling, keyboard navigation, and accessibility states.

## 6. Acceptance criteria for implementation

These are proposed gates for the later implementation and QA work. They do not describe the current runtime as passing.

- Phone layouts are checked at 360x740 and 390x844. Desktop browsers are checked at 1280x720 and 1440x900, using the centered portrait game surface rather than a stretched multi-column layout.
- The page has zero horizontal overflow. No text, tab label, status, target, or action is clipped. Every required action and status is reachable without relying on an unlabeled nested scrollbar.
- Use the existing R1 layout budgets as provisional targets: no more than 160 px of default vertical overflow at 360x740 and no more than 120 px at 390x844. Confirm these budgets during scope lock; do not meet them by hiding content or shrinking text.
- On every tested battle state, character silhouettes, enemy silhouettes, lane targets, telegraphs, and core attack feedback remain visible. Health bars, labels, detail panels, and controls do not cover them.
- Party health, enemy health, phase, selected hero, skill readiness, and the next threat remain readable while the player acts. Secondary explanations are available in a labeled detail view.
- Touch targets are at least 44x44 CSS px with enough separation for reliable taps. PC keyboard focus and activation remain visible and usable.
- Text and controls remain usable at 200% text zoom. Contrast is measured rather than judged by appearance alone. Low-health and combat states use text or shape as well as color.
- Reduced motion preserves all mechanical information. Muted or unavailable audio does not remove gameplay cues.
- The QA matrix includes first entry, returning to town, mission briefing, battle ready, active battle, low health, telegraph, open detail or pause, intermission, result, and long-name or expanded-detail cases.
- Browser evidence includes screenshots and layout bounds. Physical-device findings are reported separately from browser emulation. No zero-overflow, accessibility, or device-support claim is made without its matching evidence.

## 7. Decisions to confirm during planning

1. **Desktop frame:** this plan recommends a centered portrait game surface with quiet world framing in the side gutters. Confirm its final width and whether the gutters may contain non-interactive art.
2. **Landscape and tablet:** portrait is the primary target. Decide whether landscape should keep a scrollable portrait surface, show an orientation hint, or receive a separate layout. Do not silently claim landscape support.
3. **Battle health presentation:** the recommended starting point is a dedicated party-health tray below the arena and enemy health in the threat band. Approve the wireframe only after checking the actual battle scene and all supported party sizes.
4. **Art and sound scope:** retain the local pixel-art direction. Approve any newly commissioned or created assets and sound work before production.

## 8. Related source documents

- [GUI acceptance targets](docs/GUI-ACCEPTANCE.md)
- [Latest recorded GUI verification](docs/GUI-VERIFIED.md)
- [R1 UI and art direction](docs/game-direction-r1/UX-ART.md), a design target, not current runtime
- [R1 execution gates](docs/game-direction-r1/NEXT-PRODUCTION-R1.md), a broader unstarted redesign plan
- [Production masterplan](docs/PRODUCTION-MASTERPLAN.md)
