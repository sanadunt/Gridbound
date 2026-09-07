# Editable production diagrams

[Masterplan](../PRODUCTION-MASTERPLAN.md). Diagram menggambarkan baseline atau target yang diberi label, bukan proof implementasi. Edit file `.mmd` terkait saat flow berubah. Preview Mermaid tersedia di Markdown reader yang mendukung Mermaid; rendering grafis belum diverifikasi dalam pekerjaan dokumentasi ini.

## game-loop

[Editable source](diagrams/game-loop.mmd)

```mermaid
flowchart TD
  Town[Town] --> Prep[Hero skills talents gear formation]
  Prep --> Mission[Campaign raid or endless]
  Mission --> Ready[Encounter ready]
  Ready --> Fight[Tap read telegraph and counter]
  Fight --> Outcome{Outcome}
  Outcome -->|Victory| Death[Wait for death animation]
  Death --> Locked[Result visible and locked 1000ms]
  Outcome -->|Defeat| Locked
  Locked --> Choice{Options enabled}
  Choice -->|Next wave if available| Ready
  Choice -->|Return or retry| Town
  Choice -->|Endless victory| Boon[Bank floor and choose boon]
  Boon --> Ready
```
## production-flow

[Editable source](diagrams/production-flow.mmd)

```mermaid
flowchart LR
  M0[Scope lock M0] --> M1[UX and safety M1]
  M1 --> M2[Progression onboarding M2]
  M2 --> M3[Content and licenses M3]
  M3 --> M4[Device performance QA M4]
  M4 --> M5[RC and rollback drill M5]
  M5 --> Approval{Explicit approval}
  Approval -->|Yes| M6[Deploy and remote smoke M6]
  Approval -->|No| M1
  M6 --> M7[Observe launch maintain M7]
```
## ui-navigation

[Editable source](diagrams/ui-navigation.mmd)

```mermaid
flowchart TD
  Home[Town navigation] --> Campaign[Chapter page]
  Campaign --> Journal[Optional journal detail]
  Home --> Training[Selected hero]
  Training --> Overview[Overview]
  Training --> Skills[Active skills]
  Training --> Jobs[Job branches]
  Training --> Talents[Talent branch graph]
  Talents --> Detail[Selected node detail and learn]
  Training --> Gear[Item selection]
  Gear --> Preview[Preview stats restrictions price]
  Preview --> Confirm{Explicit confirm}
  Confirm -->|Cancel| Gear
  Confirm -->|Valid| Equip[Purchase or equip]
  Training --> Formation[Formation]
  Home --> Quests[Quest page and manual claim]
  Home --> Bestiary[Monster page]
  Home --> Combat[Encounter]
  Combat --> Inspector[Expandable detail target design]
```
## save-release-safety

[Editable source](diagrams/save-release-safety.mmd)

```mermaid
flowchart TD
  Load[Read primary v3] --> Exists{Present}
  Exists -->|No| Legacy[Read legacy and normalize compatible data]
  Exists -->|Yes| Validate{Supported complete envelope}
  Validate -->|Yes| Normalize[Normalize fields]
  Validate -->|No| Protect[Preserve original and disable writes]
  Protect --> Backup[Use compatible legacy fallback for session]
  Normalize --> Session[Playable session]
  Legacy --> Session
  Backup --> Session
  Session --> Write{Writes permitted}
  Write -->|Yes| Persist[Persist v3]
  Write -->|No| Warning[Warn and offer existing export]
  Import[Proposed import not implemented] -.-> Consent[Validate preview and explicit replace consent]
```
## result-sequence

[Editable source](diagrams/result-sequence.mmd)

```mermaid
sequenceDiagram
  participant Player
  participant Combat
  participant Renderer
  participant UI
  participant Gate
  Combat->>Renderer: Victory state
  Renderer->>Renderer: Death collapse or reduced-motion fade
  Renderer-->>UI: Death readiness complete
  UI->>Gate: Open new presentation generation
  UI-->>Player: Show options disabled
  Player->>UI: Early click or key
  UI->>Gate: Check time and generation
  Gate-->>UI: Reject before 1000ms
  UI->>Gate: Check current generation after delay
  Gate-->>UI: Allow current presentation
  UI-->>Player: Enable choices
```
