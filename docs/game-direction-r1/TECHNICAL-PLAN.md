# Technical production blueprint

**Proposed module boundaries and debug tooling, not files already implemented.** Phaser/TypeScript/Vite remain the stack. No Godot migration, server game backend, new package install, or config change is authorized by this document.

## 1. Proposed component tree

```text
src/ (future implementation paths; do not assume they exist)
  app/
    navigation.ts        Title / Menu / Profiles / Mode hub / Overlay stack
    input-boundary.ts    Gesture consumption, focus, result/Ultra locks
    mode-session.ts      ModeID, active Commander, slot and run identity
  persistence/
    schema.ts            Versioned envelope / bounded validators
    database.ts          IndexedDB atomic transactions and recovery
    migration-v3.ts      Copy-only migration with preview/mapping report
    checkpoint.ts        Save/Load without wallet rewind
  economy/
    story-inventory.ts   Gold/material ownership and craft provenance
    challenge-wallet.ts  Bank Crystal / meta unlocks
    run-purse.ts         Run Crystal, no bank top-up/conversion
    settlement.ts        Immutable receipts / duplicate rejection
  modes/
    story/               Scene flags, world map, material dungeon allowlist
    rogue/               Build3, seeded route, event/draft/stock state
    raid/                Build1–6, certified config vs Sandbox
  combat/
    rulesets/            Legacy vs R1 adapters
    stats.ts             Five-stat derived values and common effect pipeline
    actions.ts           Signature / Ultra effects and caps
    battle.ts            Deterministic state transitions and threats
  presentation/
    pages/               Focused DOM pages and selected-item panels
    tree-layout.ts       DAG rank + AND/OR + collision-free connector geometry
    icon-manifest.ts     Stable semantic icon IDs to local atlases
    BattleScene.ts       Phaser presentation; not wallet authority
  dev/
    balance-lab.ts       Test-only scene/data explorer, absent from production
```

The real project currently organizes systems in `src/game`, `src/ui` and `src/render`. New directories above are a boundary proposal, **not an instruction to move all files at once**. Introduce adapters around current systems, prove behavior, then reorganize only when useful. Preserve IDs; don't rename arrays and silently break save mappings.

## 2. Authority boundaries

- ModeSession selects a typed ruleset/context, never a loose bag of optional flags where Story and Raid fields mix.
- Combat calculates outcome, not wallet rewards. ResultPresenter displays terminal snapshot, not recomputes eligibility from current UI sliders.
- Settlement resolves rule IDs from trusted authored definitions, validates owner/run/attempt/config/revision, and commits once with checkpoint.
- Renderer death animation exposes readiness, cannot itself credit currency. Game logic terminal state suppresses combat gestures; presenter waits for animation then full1s lock and fresh gesture.
- UI inspect has no authority to purchase. Confirm dispatches an explicit command; authority validator rechecks cost, slot, ownership, phase, and revision.
- StoryDungeonGenerator and RogueRouteGenerator have different node-kind types/allowlists. Not the same generator with hidden store icon.
- Save bookmark refers to a run ledger sequence; it cannot embed authoritative wallet copy. User-owned backup still can restore a full Commander, never additive merge.

## 3. State transition contracts

| Command | Preconditions | Writes | Failure / cancellation |
|---|---|---|---|
| StartStory | Valid Story slot, no blocking modal | Mode state + safe checkpoint | No overwrite if empty slot not confirmed |
| StartRogue |3valid units, relic combo supported | Frozen run config + node seed + ledger | Show invalid slot/rule; no wallet spend |
| StartRaid |1–6units, normalized budget | AttemptId + configHash + eligibility | Invalid raw modifiers move to Sandbox confirmation |
| ChooseEvent | Active event revealed, choice legal | RNG outcome/effects/checkpoint once | Reload shows existing outcome; no extra roll |
| PurchaseRunItem | Run active, stock exists, purse enough | Purse decrement + run item + receipt atomic | No partial write if checkpoint fails |
| UnlockRelic | Commander bank enough, no duplicate ownership | Bank decrement + unlock + receipt atomic | Duplicate is no-op with explanation |
| CraftStoryGear | Story in town, materials/Gold valid | Inventory/payment/provenance atomic | Preview missing materials, keep selection |
| SettleTerminal | Unseen terminal ID + frozen rules | Mode rewards + ledger + checkpoint | Already committed → read result, no new credit |
| SwitchProfile | Safe checkpoint or explicit abandon | Active manifest only after successful suspend | Storage failure keeps old active session |

## 4. Debug-room blueprint

Future Balance Lab is a dedicated local route/scene behind development/test build guard. It must not be bundled in release, not inspect normal user's saves and not grant real currency. Suggested panels: Spawn, Build, Stats, Timing, Intents, Events, Ledger Sandbox, Hit Geometry, Graph Fixtures. Debug state uses separate namespace/browser profile.

Controls: seed input; N1/3/6 quick presets; basic/lineage selection; set bounded stats; select signature/Ultra; force enemy intent/phase; pause/0.25×/single-step; render hit rectangles; toggle reduced motion; show damage/heal/absorb/charge components; simulate commit failure; export a sanitized deterministic report. Timers, sim state and presentation state shown separately.

Required seed scenarios:
1. Solo Wizard vs unavoidable ritual with universal counter.
2. Six support units, healing cap and shared Resonance rate.
3. Three duplicate Rogues, no proc/economy loop.
4. Multi-parent talent graph with long label and phone width.
5. Victory → scene reset while death wait unresolved → stale presenter rejected.
6. Wallet transaction before/after crash; no duplicate claim.
7. Story dungeon event with insufficient supply and guaranteed alternate path.

A debug command `bossHp=0` proves UI terminal transitions only. Separate full-input policy combat establishes reachability, and humans establish readability/fun. Reports explicitly identify forced state.

## 5. Runtime-content manifests

Every authored record needs stable ID, version, mode scope, display/localization key, art/icon ID, mechanics data and availability gates. Cross-reference validator checks hero/job/action/material/relic/event/scene IDs; all texture variants count separately from base silhouettes.

Build manifest records appVersion, sourceCommit, rulesetVersion, contentVersion, saveSchema, local asset hash list. UI shows friendly version in Settings/bug export. Do not include platform tokens, local path usernames or complete save data in automatic reports. No remote telemetry by default.

## 6. Performance and release boundaries

No heavy build/framework migration required for docs target. Future design profile page changes cannot create hundreds of hidden DOM nodes or Phaser textures per frame. Render one branch/page, cache icons, virtualize where real measurements justify it, coalesce ResizeObserver work and avoid resize loops. Small screens get dedicated pages, not tiny text.

Offline once loaded and local storage are current principles; cold offline boot requires separate caching/PWA decision (out of scope until approved). Static files remain `dist`; optional Node entry is hosting-only, not authoritative anti-cheat service. Hostinger remote verification and save rollback remain independent gates.
