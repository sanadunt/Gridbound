# D8 Content Inventory

Status: **audit complete; target catalog not yet complete**.

## Approved target vs canonical runtime

| Catalog | Approved target | Current canonical runtime | Gap |
|---|---:|---:|---:|
| Unique heroes | 9 | 9 | 0 |
| Tier-2 advanced paths | 18 | 10 | 8 |
| Tier-3 paths | 18 | 10 | 8 |
| Ultra definitions | 32 | 0 dedicated definitions | 32 |

Current runtime has 20 `JOBS` entries: 10 tier-2 and 10 tier-3. They are class-based paths, not yet 36 authored hero-specific advancement paths. Current `KITS` skills and talent `Signature art` nodes must not be counted as the approved 32 Ultra catalog: there is no canonical `UltraDef` collection or per-definition gate/effect/icon/test contract yet.

## Canonical existing IDs

- Heroes: Aldric, Bran, Sable, Rowan, Lyra, Kestrel, Nyx, Orin, Mira.
- Basic classes: warrior, rogue, archer, healer, wizard.
- Existing advancement families: four jobs per basic class (two tier-2 and two tier-3), for 20 total.

## D8 execution boundary

Do not pad counts with aliases, recolors, talent nodes, or generated placeholder definitions. The next task is a RED contract test for:

1. 9 unique hero IDs;
2. 18 tier-2 and 18 tier-3 authored advancement definitions;
3. 32 authored Ultra definitions, each with an ID, owning hero/class, gate, effect, icon key, and executable test hook.

A passing count test alone is not evidence of playable balance or human readability. Those remain later gates.
