# Gridbound documentation index

Use this page to find current runtime documentation without treating proposals or historical checkpoints as shipped behavior. `src/` is authoritative for the running v0.4 game. The generated content export at the repository root is a catalog, not a replacement for source definitions.

## Current runtime

- [v0.4 Game Design Document](GDD-GRIDBOUND-V0.4.md): current story, modes, combat, progression, UI, save boundaries, and verification limits.
- [GUI verification](GUI-VERIFIED.md): latest documented local browser and viewport evidence. It is not live-deployment or physical-device certification.
- [Generated content catalog](../Gridbound_GDD_GRID_RAID.md): skills, equipment, enemy, and other authored content tables. Runtime source takes precedence when system notes or numbers differ.

## Future design direction

- [R1 design package](game-direction-r1/README.md): approved future-target proposal and its supporting specs. R1 is not the shipped v0.4 implementation.

## Production and hosting references

- [Next production checkpoint](NEXT-PRODUCTION.md): historical implementation handoff, release gates, and current evidence pointers. Check its status notes before relying on an older entry.
- [Production masterplan](PRODUCTION-MASTERPLAN.md): planning document, not production approval or deployment evidence.
- [Production planning folder](production/): proposed milestones, QA acceptance targets, release operations, and diagrams.
- [Static hosting](HOSTING.md), [Hostinger GitHub deployment](HOSTINGER-GITHUB.md), and [Hostinger manual upload](HOSTINGER.md): deployment instructions. A documented procedure does not prove that a remote deployment occurred.

## Historical and alternate-engine material

- [Prototype GDD archive](GDD-PROTOTYPE-ARCHIVE.md): superseded design context, not current acceptance criteria.
- [D3 verification record](D3-VERIFIED.md): an earlier implementation checkpoint; use [GUI verification](GUI-VERIFIED.md) for the latest recorded browser evidence.
- [GUI acceptance targets](GUI-ACCEPTANCE.md): requested targets, explicitly not test results.
- [Feature-branch delivery record](BRANCH-DELIVERY.md): historical branch handoff; inspect Git and CI for current delivery state.
- [Godot porting blueprint](GODOT-IMPLEMENTATION-BLUEPRINT.md): alternate-engine porting proposal, not the current Phaser runtime.
