# Editable diagrams — R1 target, not implemented

[Package index](README.md). Mermaid source can be edited in any compatible tool. Offline SVG/HTML boards are separate renderable design studies. No external game assets.

## Title Navigation

[Source](diagrams/title-navigation.mmd)

```mermaid
flowchart TD
  Boot["Boot / local storage check"] --> Start["PRESS START - fresh gesture"]
  Start --> Menu["Main Menu"]
  Menu --> Profiles["Commander and mode slot"]
  Profiles --> Story["Story world map"]
  Profiles --> Rogue["Rogue build exactly 3"]
  Profiles --> Raid["Raid build 1 to 6"]
  Story --> GameMenu["Party - Quests - Skills - Inventory - Status"]
  GameMenu --> Story
  Story --> Brief["Mission or material dungeon brief"]
  Rogue --> Route["Seeded Rogue node map"]
  Raid --> Contract["Boss and certified rules or Sandbox"]
  Brief --> Fight["Shared combat - isolated mode state"]
  Route --> Fight
  Contract --> Fight
  Fight --> Results["Death ready then result input lock 1000ms"]
  Results --> Story
  Results --> Route
  Results --> Raid
  Menu --> Options["Settings / Credits"]
```

## Mode Economy

[Source](diagrams/mode-economy.mmd)

```mermaid
flowchart LR
  subgraph Story["Story save slot"]
    Quest["Chapters and quests"] --> Gold["Gold"]
    Dungeon["Material dungeon extraction"] --> Mats["Materials"]
    Gold --> Forge["Forge / supplies / gear"]
    Mats --> Forge
  end
  subgraph Commander["Commander Challenge economy"]
    Raid["Eligible Raid receipt"] --> Bank["Bank Crystal - shared"]
    Boss["Rogue act and final receipt"] --> Bank
    Bank --> Relics["Rule relic and alternative unlocks"]
    Relics --> Rules["Pre-run choice - no free stats"]
  end
  subgraph Run["One Rogue run"]
    Room["Room win or event"] --> Purse["Run Crystal"]
    Purse --> Shop["Temporary shop and upgrades"]
    Shop --> Room
    Purse --> Reset["Unused purse resets - no conversion"]
  end
  Rules -. "rules only" .-> Room
```

## Rogue Loop

[Source](diagrams/rogue-loop.mmd)

```mermaid
flowchart TD
  Build["3 recruits - choose basic jobs and relic rules"] --> New["New runId - seed - RNG - frozen rules"]
  New --> Node["Select reachable node"]
  Node --> Fight["Battle or elite"]
  Node --> Event["Event with preview and fallback"]
  Node --> Shop["Run-only shop / camp / mastery"]
  Fight --> Win{"Victory?"}
  Win -->|No| End["Run terminal - purse reset"]
  Win -->|Yes| Draft["3 legal choices - take 1"]
  Draft --> Save["Atomic checkpoint"]
  Event --> Save
  Shop --> Save
  Save --> Boss{"Act boss reached?"}
  Boss -->|No| Node
  Boss -->|Yes| ActFight["Boss encounter"]
  ActFight --> ActWin{"Victory?"}
  ActWin -->|No| End
  ActWin -->|Yes| Receipt["Bank act reward once"]
  Receipt --> Final{"Third act cleared?"}
  Final -->|No| Node
  Final -->|Yes| End
```

## Story Journey

[Source](diagrams/story-journey.mmd)

```mermaid
flowchart LR
  P["Prologue - town worth protecting"] --> A1["Act I - repair seals - false victory"]
  A1 --> A2["Act II - census and hidden consent"]
  A2 --> A3["Act III - futures are not debts"]
  A3 --> A4["Act IV - build safety together"]
  A4 --> E["Epilogue - Eda chooses a name"]
  A1 -. "optional" .-> D["Material dungeon - existing party"]
  A2 -. "optional" .-> D
  A3 -. "optional" .-> D
  A4 -. "optional" .-> D
  D --> C["Routes and choices - no shop or draft"]
  C --> Extract["Extract Gold and materials or lose unbanked pouch"]
```

## Raid Contract

[Source](diagrams/raid-contract.mmd)

```mermaid
flowchart TD
  Build["Party 1 to 6 / boss / rules"] --> Gate{"Certified config?"}
  Gate -->|Yes| Freeze["Freeze ruleset, seed, attempt ID"]
  Gate -->|No| Sand["Sandbox - no Crystal or mastery"]
  Freeze --> Fight["Telegraphed encounter"]
  Fight --> Outcome["Outcome intent once"]
  Outcome --> Death["Death animation readiness"]
  Outcome --> Tx["Atomic wallet + outcome receipt"]
  Death --> Results["Results visible / Saving if pending"]
  Results --> Delay["One-second visible input lock"]
  Tx --> Ready{"Receipt committed and lock elapsed?"}
  Delay --> Ready
  Ready -->|Yes, fresh gesture| Options["Retry / edit / exchange / title"]
  Ready -->|Save failed| Recover["Keep outcome / Retry save / Export"]
  Sand --> Practice["Practice results only"]
```

## Save Settlement

[Source](diagrams/save-settlement.mmd)

```mermaid
sequenceDiagram
  participant U as Player
  participant G as Mode state
  participant D as Local DB
  U->>G: Resolve node or boss
  G->>D: Begin transaction with revision and receipt ID
  D->>D: Validate owner config and unseen receipt
  D->>D: Write checkpoint wallet receipt and revision
  D-->>G: Commit acknowledged
  G-->>U: Saved result
  U->>G: Reload or retry same result
  G->>D: Read receipt and latest checkpoint
  D-->>G: Already settled - no duplicate payment
  G-->>U: Resume latest or Practice replay
```

## Production Gates

[Source](diagrams/production-gates.mmd)

```mermaid
flowchart LR
  R0["R0 Design approval"] --> R1["R1 Save and economy foundations"]
  R1 --> R2["R2 Game shell"]
  R2 --> R3["R3 Combat character slice"]
  R3 --> R4["R4 Story and dungeon slice"]
  R3 --> R5["R5 Rogue slice"]
  R5 --> R6["R6 Raid and shared exchange"]
  R4 --> R7["R7 Full content production"]
  R6 --> R7
  R7 --> R8["R8 Balance device and accessibility"]
  R8 --> R9["R9 RC and migration drill"]
  R9 --> Approval{"Explicit deploy approval?"}
  Approval -->|Yes| R10["R10 Hostinger verify and observe"]
  Approval -->|No| Hold["Hold candidate - no main deploy"]
```

## Skill Dependencies

[Source](diagrams/skill-dependencies.mmd)

```mermaid
flowchart TD
  Root["Root - Stand Fast"] --> Guard["Guard branch"]
  Root --> Tempo["Tempo branch"]
  Guard --> AND{"ALL prerequisites"}
  Tempo --> AND
  AND --> Keystone["Selected keystone - inspect then learn"]
  Keystone --> Trial["Ultra trial - progression gate"]
```

## Offline design boards

- [Three-mode navigation](art/mode-navigation.svg)
- [Economy boundaries](art/economy-boundaries.svg)
- [Prerequisite tree geometry](art/skill-tree.svg)
- [12 original icon studies](art/icon-concepts.svg)
- [All boards as one HTML document](art/design-boards.html)

These are static documentation artifacts; no game controls or current gameplay screenshots are implied. Mermaid syntax/render validation status is reported in [VALIDATION](VALIDATION.md).
