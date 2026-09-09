# GRIDBOUND — GODOT 4 IMPLEMENTATION & PORTING BLUEPRINT
> **Panduan Arsitektur, Struktur Node, Skrip GDScript, dan Alur Kerja Porting dari Web Prototype ke Godot Engine 4.x**

---

## 1. Ringkasan Eksekutif & Pemetaan Arsitektur

Web prototype *Gridbound* dibangun dengan pemisahan tegas antara:
1. **Core Simulation Engine** (TypeScript murni, tanpa dependensi grafis/DOM, 100% deterministik).
2. **Economy & Save System** (Multi-slot profile, receipt settlement, unlock flags).
3. **Phaser Combat Arena** (Canvas 2D grid, intent telegraphing, particle emitter).
4. **Diegetic UI & World Map** (100dvh single-screen console, SVG bezier cartography, tactical dossier).
5. **Procedural Audio Synthesizer** (Web Audio ADSR & filter envelopes).

Arsitektur ini **sangat ramah untuk di-port ke Godot 4** karena logika inti (state & simulation) tidak terikat pada DOM/browser.

---

## 2. Pemetaan Komponen (Web Prototype ➔ Godot 4)

| Komponen Web Prototype | Lokasi Web Source | Padanan Godot 4 (Node / Resource) | Penjelasan Teknis |
| :--- | :--- | :--- | :--- |
| **Main Root & Viewport** | `index.html`, `src/main.ts` | `Main.tscn` (`Node`) + `SceneManager` Autoload | Mengatur scene switcher antara Title, Town, dan Combat. Stretch mode `canvas_items`, aspect `keep_width` atau `expand`. |
| **Save & Profile Data** | `src/game/profile.ts`, `save.ts` | `ProfileResource.gd` (`Resource`) / `SaveManager.gd` (`Node` Autoload) | Menyimpan data 3 slot profil ke `user://save_slot_*.json` atau file `.tres` terenkripsi. |
| **Combat Simulation** | `src/game/simulation.ts` | `BattleSimulation.gd` (`RefCounted`) | Kelas murni GDScript yang menjalankan state battle, timer tick, intent queue, tap tempo, dan attrition. |
| **Campaign & Enemy Data** | `src/game/world.ts`, `story.ts` | `CampaignData.gd`, `EnemyDef.gd` (`Resource`) | Custom Resource untuk 16 chapter, 4 babak (Acts), data musuh, intent pattern, counter, dan dialog prologue/epilogue. |
| **Job, Gear & Talents** | `src/game/jobs.ts`, `profile.ts` | `JobDef.gd`, `GearDef.gd`, `TalentDef.gd` (`Resource`) | Database skill pohon talent (4 tiers), equipment sets, dan branch promosi. |
| **Combat Arena (Arena Grid)** | `src/render/BattleScene.ts` | `CombatArena.tscn` (`Node2D`) | Mengelola grid 3x3 barisan hero, sprite bos, rendering intent telegraph visual di lantai grid. |
| **Visual Intent Telegraphs** | `BattleScene.ts` (Graphics) | `TileMapLayer` atau `Area2D` + Custom Shader | Menandai tile target (Front row, lane breath, single tile meteor, all-grid) dengan warna telegraph & animasi pulsasi. |
| **Town Hub & Facilities** | `src/ui/town.ts` | `TownHub.tscn` (`Control`) | UI War Table, Training Hall, Quest Ledger, Bestiary, Challenge Shop, dan Descent. |
| **World Map Kartografi** | `src/ui/world-map.ts`, `world-map.css` | `WorldMap.tscn` (`Control` + `Line2D` / `Path2D`) | Menggambar rute bezier bercahaya antar chapter, node pin interaktif (cleared/active/locked), dan tab selektor 4 Act. |
| **Tactical Mission Dossier** | `src/ui/world-map.ts` (`.mission-brief`) | `MissionDossier.tscn` (`PanelContainer`) | Menampilkan thumbnail bos, tier, urutan intent serangan, hazard chips, dan tombol departure. |
| **Audio Synthesizer** | `src/audio/sound.ts` | `AudioManager.gd` Autoload (`AudioStreamPlayer`) | Memutar SFX WAV/OGG hasil ekspor atau procedural via `AudioStreamGenerator`. |

---

## 3. Struktur Direktori Proyek Godot 4 yang Direkomendasikan

```text
res://
├── assets/
│   ├── fonts/
│   │   ├── PressStart2P-Regular.ttf
│   │   └── SpaceGrotesk-Medium.ttf
│   ├── sprites/
│   │   ├── heroes/          # Sprite 8-frame hero
│   │   ├── enemies/         # Sprite bos (Dragon, Treant, Wraith, dll)
│   │   ├── icons/           # Icon status, intent, hazard, seals
│   │   └── backgrounds/     # Panorama desa Emberhollow, ruins arena
│   ├── audio/
│   │   ├── sfx/             # Clink koin, card deal, impact, guard, slam
│   │   └── music/           # Ambient town drone, battle loop
│   └── themes/
│       └── underworld_theme.tres # Custom theme emas & obsidian
├── resources/
│   ├── campaign/            # Resource per chapter (ch01.tres s/d ch16.tres)
│   ├── enemies/             # EnemyDef resources (wolf, treant, dragon, dll)
│   ├── talents/             # Talent node definitions
│   ├── gear/                # Item equipment dan set definitions
│   └── boons/               # Sunken Bell boons definitions
├── scenes/
│   ├── core/
│   │   ├── Main.tscn        # Scene root utama
│   │   └── TitleScreen.tscn # Layar judul & 3 slot profil
│   ├── town/
│   │   ├── TownHub.tscn     # Layar kota Emberhollow
│   │   ├── WorldMap.tscn    # Sistem World Map kartografi
│   │   ├── MissionDossier.tscn # Kartu recon bos & persiapan
│   │   └── TrainingHall.tscn# Roster, skill equip & talent tree
│   └── combat/
│       ├── CombatScreen.tscn# Layout pertarungan 1-layar
│       ├── CombatArena.tscn # Grid 3x3 arena Phaser port
│       ├── IntentPanel.tscn # HUD intent musuh
│       ├── ActionBar.tscn   # Tombol Guard, Potion, Ultimate
│       └── ResultModal.tscn # Layar kemenangan / kekalahan
└── scripts/
    ├── autoload/
    │   ├── GameManager.gd   # State global & session
    │   ├── SaveManager.gd   # I/O disk save slot
    │   └── AudioManager.gd  # Audio sound effects & ambient
    ├── core/
    │   ├── ProfileData.gd   # Model data profil
    │   └── BattleSimulation.gd # Port simulation.ts ke GDScript
    └── ui/
        ├── WorldMapController.gd
        └── CombatController.gd
```

---

## 4. Porting Logika Inti ke GDScript (Kode Siap Pakai)

### 4.1. Model Penyimpanan Profil (`ProfileData.gd`)

```gdscript
class_name ProfileData
extends Resource

@export var version: int = 3
@export var gold: int = 60
@export var cleared: Array[int] = []
@export var roster: Array[int] = [0, 4, 3] # Warrior, Healer, Archer
@export var story_active: Array[int] = [0, 4, 3]
@export var best_floor: int = 0
@export var wins: int = 0
@export var loadouts: Dictionary = {} # HeroId -> {skills: [], talents: [], gear: {}, slot: int, xp: int}
@export var economy: Dictionary = {
	"gold": 60,
	"commanderCrystal": 0,
	"materials": {}
}
@export var challenge_unlocks: Array[String] = []
@export var sound_enabled: bool = true
@export var motion_enabled: bool = true

static func create_default() -> ProfileData:
	var p = ProfileData.new()
	p.gold = 60
	p.cleared = []
	p.roster = [0, 4, 3]
	p.story_active = [0, 4, 3]
	p.loadouts = {
		0: {"skills": [0, 1], "talents": [], "slot": 1, "xp": 0},
		4: {"skills": [0, 1], "talents": [], "slot": 7, "xp": 0},
		3: {"skills": [0, 1], "talents": [], "slot": 6, "xp": 0}
	}
	return p
```

### 4.2. Autoload Pengelola Save (`SaveManager.gd`)

```gdscript
extends Node

const SAVE_DIR = "user://saves/"

func save_slot(slot_index: int, profile: ProfileData) -> bool:
	DirAccess.make_dir_recursive_absolute(SAVE_DIR)
	var path = SAVE_DIR + "slot_%d.json" % slot_index
	var file = FileAccess.open(path, FileAccess.WRITE)
	if not file:
		push_error("Gagal membuka file save untuk menulis: " + path)
		return false
	
	var dict = {
		"version": profile.version,
		"gold": profile.gold,
		"cleared": profile.cleared,
		"roster": profile.roster,
		"storyActive": profile.story_active,
		"bestFloor": profile.best_floor,
		"wins": profile.wins,
		"loadouts": profile.loadouts,
		"economy": profile.economy,
		"challengeUnlocks": profile.challenge_unlocks,
		"sound": profile.sound_enabled,
		"motion": profile.motion_enabled
	}
	file.store_string(JSON.stringify(dict, "\t"))
	return true

func load_slot(slot_index: int) -> ProfileData:
	var path = SAVE_DIR + "slot_%d.json" % slot_index
	if not FileAccess.file_exists(path):
		return ProfileData.create_default()
	
	var file = FileAccess.open(path, FileAccess.READ)
	var json = JSON.new()
	if json.parse(file.get_as_text()) != OK:
		push_error("Data save korup, mengembalikan profil default")
		return ProfileData.create_default()
	
	var data = json.data
	var p = ProfileData.new()
	p.gold = int(data.get("gold", 60))
	p.cleared.assign(data.get("cleared", []))
	p.roster.assign(data.get("roster", [0, 4, 3]))
	p.story_active.assign(data.get("storyActive", [0, 4, 3]))
	p.best_floor = int(data.get("bestFloor", 0))
	p.wins = int(data.get("wins", 0))
	p.loadouts = data.get("loadouts", {})
	p.economy = data.get("economy", {"gold": p.gold, "commanderCrystal": 0, "materials": {}})
	p.challenge_unlocks.assign(data.get("challengeUnlocks", []))
	p.sound_enabled = bool(data.get("sound", true))
	p.motion_enabled = bool(data.get("motion", true))
	return p
```

### 4.3. Porting Simulator Combat (`BattleSimulation.gd`)

```gdscript
class_name BattleSimulation
extends RefCounted

signal state_changed(event_name: String, payload: Dictionary)

enum BattleStatus { READY, FIGHTING, PAUSED, VICTORY, DEFEAT }
enum IntentType { FRONT, METEOR, BREATH, WEAKEST, STRONGEST, ALL }

var status: BattleStatus = BattleStatus.READY
var enemy_id: String
var boss_hp: float
var boss_max_hp: float
var attack_interval: float = 8.0
var attack_timer: float = 0.0
var current_intent_index: int = 0
var intent_patterns: Array[IntentType] = []

# Hero data in battle
class HeroUnit:
	var id: int
	var slot: int # 0-8 (grid 3x3)
	var hp: float
	var max_hp: float
	var cooldown: float
	var max_cooldown: float
	var living: bool = true

var heroes: Array[HeroUnit] = []
var taps_count: int = 0
var potions_remaining: int = 2
var guard_active: bool = false
var guard_cooldown: float = 0.0

func init_encounter(enemy_data: Dictionary, roster_loadouts: Array[HeroUnit]):
	heroes = roster_loadouts
	boss_max_hp = enemy_data.hp
	boss_hp = boss_max_hp
	attack_interval = enemy_data.interval
	attack_timer = attack_interval
	intent_patterns = enemy_data.patterns
	status = BattleStatus.READY

func tap_hero(slot_idx: int):
	if status != BattleStatus.FIGHTING: return
	for hero in heroes:
		if hero.slot == slot_idx and hero.living:
			# Akselerasi cooldown (mekanik tap Gridbound)
			hero.cooldown = max(0.0, hero.cooldown - 0.45)
			taps_count += 1
			state_changed.emit("hero_tapped", {"hero_id": hero.id, "cooldown": hero.cooldown})
			break

func tick(dt: float):
	if status != BattleStatus.FIGHTING: return
	
	# Guard cooldown
	if guard_cooldown > 0.0:
		guard_cooldown = max(0.0, guard_cooldown - dt)
	
	# Advance boss intent timer
	attack_timer -= dt
	if attack_timer <= 0.0:
		execute_boss_attack()
		current_intent_index = (current_intent_index + 1) % intent_patterns.size()
		attack_timer = attack_interval
		state_changed.emit("new_intent_started", {"intent": intent_patterns[current_intent_index]})

func execute_boss_attack():
	var current_intent = intent_patterns[current_intent_index]
	state_changed.emit("boss_attack_impact", {"intent": current_intent, "guarded": guard_active})
	guard_active = false
```

---

## 5. Implementasi World Map di Godot 4 (`WorldMap.tscn`)

### 5.1. Struktur Scene Tree World Map

```text
WorldMap (Control)
├── Background (ColorRect / TextureRect)
├── ActSelectorRibbon (HBoxContainer)
│   ├── Act1Button (Button)
│   ├── Act2Button (Button)
│   ├── Act3Button (Button)
│   └── Act4Button (Button)
├── MapSplitLayout (HSplitContainer / HBoxContainer)
│   ├── MapCanvasCard (PanelContainer)
│   │   ├── MapChartViewport (Control)
│   │   │   ├── TopoGridLines (Line2D or Custom Draw)
│   │   │   ├── CompassRose (TextureRect)
│   │   │   ├── RoutesLayer (Node2D)
│   │   │   │   ├── RouteSegment0 (Line2D)
│   │   │   │   ├── RouteSegment1 (Line2D)
│   │   │   │   └── RouteSegment2 (Line2D)
│   │   │   └── NodesLayer (Control)
│   │   │       ├── NodePin0 (Button)
│   │   │       ├── NodePin1 (Button)
│   │   │       ├── NodePin2 (Button)
│   │   │       └── NodePin3 (Button) [Gate Boss]
│   └── MissionDossier (PanelContainer)
│       ├── VBoxContainer
│       │   ├── SpeakerLabel (Label)
│       │   ├── ZoneTitleLabel (Label)
│       │   ├── TacticalChips (HBoxContainer)
│       │   ├── BossReconCard (PanelContainer)
│       │   │   ├── BossAvatar (TextureRect)
│       │   │   └── BossIntel (VBoxContainer)
│       │   ├── EncounterRouteList (ItemList)
│       │   └── DepartButton (Button - Gold CTA)
```

### 5.2. Menggambar Rute Bezier di Godot (`RoutesLayer.gd`)

Di Godot 4, kita bisa menggunakan `Curve2D` dan `Line2D` untuk merender garis jalur kartografi yang persis seperti SVG di web prototype:

```gdscript
extends Node2D

@onready var route_lines: Array[Line2D] = [$RouteSegment0, $RouteSegment1, $RouteSegment2]

# Titik koordinat 4 node
const NODE_POINTS = [
	Vector2(120, 260),
	Vector2(310, 120),
	Vector2(510, 270),
	Vector2(700, 150)
]

func draw_act_routes(cleared_zones: Array[int], act_start_zone: int):
	for i in range(3):
		var curve = Curve2D.new()
		var p0 = NODE_POINTS[i]
		var p1 = NODE_POINTS[i + 1]
		# Kontrol bezier kurva organik
		var control_offset = Vector2((p1.x - p0.x) * 0.5, 0)
		curve.add_point(p0, Vector2.ZERO, control_offset)
		curve.add_point(p1, -control_offset, Vector2.ZERO)
		
		var line = route_lines[i]
		line.points = curve.tessellate(5, 2)
		
		# Styling rute
		var target_zone = act_start_zone + i + 1
		var is_cleared = cleared_zones.has(target_zone)
		if is_cleared:
			line.default_color = Color("#e5b954") # Emas
			line.width = 4.0
		else:
			line.default_color = Color("#25392e") # Batu besi terkunci
			line.width = 2.0
```

---

## 6. Porting Combat Arena & Intent Telegraphs ke Godot

### 6.1. Grid 3x3 & Deteksi Tile
- Gunakan `Node2D` dengan 9 anak `Area2D` atau koordinat terhitung:
  ```gdscript
  func get_cell_position(slot: int) -> Vector2:
      var col = slot % 3
      var row = slot / 3
      return Vector2(ARENA_ORIGIN_X + col * (CELL_WIDTH + GAP), ARENA_ORIGIN_Y + row * (CELL_HEIGHT + GAP))
  ```

### 6.2. Intent Telegraph Shaders
- Untuk serangan **Front Row**, **Meteor**, atau **All-Grid**, gunakan `Polygon2D` atau shader persegi dengan warna transparan:
  - `Warning Color`: Merah/oranye pulsasi (`Color(1.0, 0.2, 0.2, 0.35)`).
  - Tampilkan animasi peringatan 1.5 detik sebelum dampak serangan boss.

---

## 7. Mengimplementasikan "Game Feel" (Juice) di Godot

Sangat mudah membuat animasi spektakuler di Godot:

### 7.1. Hitstop (Freeze-Frame pada Serangan Kritis)
```gdscript
func trigger_hitstop(duration: float = 0.06):
	Engine.time_scale = 0.0
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0
```

### 7.2. Camera Shake (Getaran Layar)
```gdscript
# Di Camera2D arena
var shake_amount: float = 0.0

func add_shake(intensity: float):
	shake_amount = min(shake_amount + intensity, 25.0)

func _process(delta: float):
	if shake_amount > 0:
		offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake_amount
		shake_amount = max(0.0, shake_amount - delta * 40.0)
	else:
		offset = Vector2.ZERO
```

### 7.3. 3D Card Tilt pada UI Godot
Di Godot 4, Control nodes memiliki properti `pivot_offset` dan bisa dipadukan dengan `Tween` atau custom canvas item material shader untuk efek tilt 3D ala *Hearthstone*!

---

## 8. Alur Porting Bertahap yang Disarankan

1. **Sprint 1: Setup Proyek & Data Foundation**
   - Buat project Godot 4.3+, pasang resolusi `1280x720` (Viewport stretch mode: `canvas_items`).
   - Import font *Press Start 2P* & *Space Grotesk*.
   - Buat script `ProfileData.gd` dan `SaveManager.gd`.
2. **Sprint 2: Combat Simulator & Arena 3x3**
   - Port `BattleSimulation.gd`.
   - Bangun `CombatArena.tscn` (9 slot hero, 1 boss sprite, tombol tap).
   - Implementasikan sistem intent visual (Front, Meteor, Breath, All-Grid).
3. **Sprint 3: Hub Kota & World Map**
   - Bangun `TownHub.tscn` dengan tab navigasi fasilitas.
   - Buat `WorldMap.tscn` dengan 4 Act selector, garis `Line2D` bezier, dan kartu dossier recon boss.
4. **Sprint 4: Fitur Ekstra (Raids & Sunken Bell)**
   - Porting sistem kontrak raid (Pact of Punishment modifiers).
   - Porting sistem draf boon 3-pilihan di Sunken Bell rogue descent.
5. **Sprint 5: Audio & Polish Game Feel**
   - Hubungkan SFX impact, clink tombol, dan ambient loop.
   - Tambahkan hitstop, screen shake, dan particle emitter untuk kematian boss.
