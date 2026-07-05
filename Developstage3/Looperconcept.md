## Refined Architecture: Two-Tier Module System (Convention Over Configuration)

You've identified the exact right tension. The solution is a **two-tier system** that follows the "convention over configuration" pattern — Rails, not raw assembly. Sensible defaults that work instantly, but a structured editor underneath for those who need to deviate.

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: MODULE PRESETS  ("Just pick a module and play")    │
│                                                             │
│  User picks: "Rhythm Module — 4 tracks"                     │
│  → Auto-mapped to MIDI pads 36-39                           │
│  → Auto-routed to Red bus                                   │
│  → Actions pre-configured: Record/Play/Overdub/Clear/Mute   │
│  → 4-bar loop, bar quantization                             │
│  → Auto-pan: L, mid-L, mid-R, R                             │
│                                                             │
│  This is the ZERO-SETUP path. Beginner makes music now.     │
└─────────────────────────────────────────────────────────────┘
        │
        │  User clicks "Edit Module" (advanced path)
        ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: STRUCTURED MODULE EDITOR                           │
│                                                             │
│  NOT a freeform canvas. NOT a raw action list.              │
│  A structured form with constrained, meaningful options:    │
│                                                             │
│  ◉ Track count:      [2] [4] [6] [8]                       │
│  ◉ Quantization:     [1/16] [1/8] [1/4] [1 bar] [2] [4] [8]│
│  ◉ Loop behavior:    [Record→AutoPlay] [Record→Wait]        │
│                       [One-shot] [Toggle]                   │
│  ◉ Bus routing:      [🔴 Rhythm] [🔵 Harmonic] [🟢 Arrange] │
│                                                             │
│  Per-track (expandable):                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Track 1 "Kick"                                      │    │
│  │   MIDI note: [36 ▾]        Pan: [◀──●──▶] L30      │    │
│  │   Actions:  ☑ Record  ☑ Play  ☑ Overdub            │    │
│  │             ☑ Mute    ☐ Solo  ☐ Reverse            │    │
│  │             ☑ Clear   ☐ Multiply  ☐ Divide         │    │
│  │   Volume ramp: [20ms ▾]    Mute group: [None ▾]   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  □ Save as custom preset → "My Punk Kit, 3-track"          │
└─────────────────────────────────────────────────────────────┘
```

The key insight: **the editor exposes the same underlying action vocabulary as Loopy Pro, but through a structured UI that constrains choices to what makes musical sense per module type.** The user never types action identifiers. They check boxes, pick from dropdowns, and drag sliders — all within the module's conceptual frame.

---

## REVISED MASTER INVENTORY — The Full Spectrum

### LEGEND
- 🟢 **PRESET SURFACE** — exposed in Tier 1 module picker (zero-setup)
- 🔵 **EDITOR SURFACE** — exposed in Tier 2 structured editor (advanced)
- ⚫ **ENGINE INTERNAL** — used by the engine, never user-facing
- ❌ **DISCARD** — Loopy Pro pattern that doesn't fit this model

---

## PART 1: TypeScript Interfaces — REVISED

| # | Interface | Verdict | Tier | Rationale |
|---|---|---|---|---|
| 1 | **`ValuePayload`** | ⚫ ENGINE INTERNAL | — | Unified `{adjustmentType, value, rampTimeMs}` for all parameter changes. The editor exposes `rampTimeMs` as a per-track dropdown (5ms/20ms/100ms/500ms). Never raw. |
| 2 | **`NormalizedAction`** | ⚫ ENGINE INTERNAL | — | `{identifier, subject, timing, parameters, valuePayload}` — the command object modules emit. The editor generates these from checkboxes; users never see identifiers. |
| 3 | **`NormalizedBinding`** | ⚫ ENGINE INTERNAL | — | `{label, triggerString, actions[]}` — stored per-module-track. The editor UI generates these from the structured form. |
| 4 | **`ActionEntry`** | 🔵 EDITOR ASSET | Tier 2 | The 52-action library is the **vocabulary** the editor draws from. Actions are grouped by category and filtered by module type — a Rhythm Module's per-track action checklist only shows rhythm-relevant actions. |
| 5 | **`MixerChannel`** | 🔵 EDITOR SURFACE | Tier 2 | Per-track pan exposed as a slider with auto-pan default. `name` field becomes the user-editable track label ("Kick", "Snare"). `type` reserved for future send bus expansion. |
| 6 | **`TargetEntry`** | 🔵 PARTIAL | Tier 2 | Only "Specific track" and "All clips" survive. "Selected/Next/Previous" — useful as an advanced MIDI mapping option for single-knob controllers: a "cycle target" behavior. |
| 7 | **`LayoutConfig`** | 🟢 SIMPLIFIED | Tier 1 | Stripped to module sizing only: `size: "sm" | "md" | "lg"` — CSS Grid slots, not pixel coordinates. The grid/linear archetype becomes the module ordering (vertical stack vs horizontal row). No freeform xy. |
| 8 | **`LayoutWidget`** | ❌ DISCARD | — | Replaced entirely by Module Cards. Widget types (`clipTrigger`, `recordButton`, `mixerSlider`) are now module-internal track behaviors, not user-placeable objects. |
| 9-15 | **`DeviceConfig`, `ProjectConfig`, `AppConfig`, `BuildResult`, `ProfileBinding`, `LoopyDocument`, `canvasLayout.pages`** | ❌ DISCARD | — | No transferable value in this model. |

---

## PART 2: The 52 Actions — Filtered by Module Type & Tier

### Rhythm Module Actions

| # | Action | Loopy Pro ID | Tier | Editor Surface |
|---|---|---|---|---|
| 1 | **Record** | Track Record | 🟢 Preset (on) | Checkbox, always on for rhythm tracks |
| 2 | **Play/Stop** | Track Play/Stop | 🟢 Preset (on) | Checkbox |
| 3 | **Overdub** | Track Overdub | 🟢 Preset (on) | Checkbox |
| 4 | **Clear** | Clear Track | 🟢 Preset (on) | Checkbox |
| 5 | **Mute** | Track Mute | 🟢 Preset (on) | Checkbox |
| 6 | **Solo** | Track Solo | 🔵 Optional | Checkbox (off by default) |
| 7 | **Reverse** | Reverse Clip | 🔵 Optional | Checkbox (off by default) |
| 8 | **Multiply Length** | Multiply Clip Length | 🔵 Optional | Checkbox (off by default) |
| 9 | **Divide Length** | Divide Clip Length | 🔵 Optional | Checkbox (off by default) |
| 10 | **Peel Layers** | Peel Replace Layers | 🔵 Optional | Checkbox (off by default) |
| 11 | **Play** (one-direction) | Track Play | 🔵 Optional | For "one-shot" loop behavior mode |
| 12 | **Stop** (one-direction) | Track Stop | 🔵 Optional | For "one-shot" loop behavior mode |

### Harmonic Module Actions

| # | Action | Loopy Pro ID | Tier | Editor Surface |
|---|---|---|---|---|
| 13 | **Record** | Track Record | 🟢 Preset (on) | Checkbox |
| 14 | **Play/Stop** | Track Play/Stop | 🟢 Preset (on) | Checkbox |
| 15 | **Overdub** | Track Overdub | 🟢 Preset (on) | Checkbox — layering harmonies |
| 16 | **Clear** | Clear Track | 🟢 Preset (on) | Checkbox |
| 17 | **Mute** | Track Mute | 🟢 Preset (on) | Checkbox |
| 18 | **Reverse** | Reverse Clip | 🔵 Optional | Creative pad reversal |
| 19 | **Multiply Length** | Multiply Clip Length | 🔵 Optional | Double harmonic loop |

### Arrangement Module Actions (conductor, no audio tracks)

| # | Action | Loopy Pro ID | Tier | Editor Surface |
|---|---|---|---|---|
| 20 | **Toggle Global Play** | Toggle Global Play | 🟢 Preset | Master transport — always on |
| 21 | **Global Stop** | Global Stop | 🟢 Preset | Always on |
| 22 | **Global Record** | Global Record | 🔵 Optional | Arm-all and record |
| 23 | **Tap Tempo** | Tap Tempo | 🟢 Preset | Always on |
| 24 | **Set BPM** | Set BPM | 🔵 Optional | Direct BPM via MIDI CC |
| 25 | **Nudge Forward** | Nudge Forward | 🔵 Optional | MIDI-mappable nudge |
| 26 | **Nudge Backward** | Nudge Backward | 🔵 Optional | MIDI-mappable nudge |
| 27 | **Adjust Master Volume** | Adjust Master Volume | 🟢 Preset | Master fader, always on |
| 28 | **Undo** | Undo | 🟢 Preset | Global undo |
| 29 | **Redo** | Redo | 🔵 Optional | Global redo |

### Section Triggers (Arrangement Module — section switching)

| # | Action | What It Does | Tier | Editor Surface |
|---|---|---|---|---|
| 30 | **Next Section** | Advance to next SongSection | 🟢 Preset | Always on — one MIDI pad cycles sections |
| 31 | **Previous Section** | Go to previous SongSection | 🔵 Optional | Back-cycling |
| 32 | **Jump to Section N** | Direct section jump (pad 60=Intro, 61=Verse, etc.) | 🔵 Optional | Per-section pad assignment |
| 33 | **Transition Mode** | Cycle Instant→NextBar→Fade | 🔵 Optional | Per-transition type MIDI trigger |

### ACTIONS TO DISCARD (don't fit the module model)

| # | Action | Why Discarded |
|---|---|---|
| 34 | **Select** | "Selected track" targeting is a Loopy Pro concept. Modules have fixed tracks. The "cycle target" behavior can be a module-level option without the Select action. |
| 35 | **Merge/Move** | Cross-track merging breaks the module's track independence. If needed, re-record. |
| 36 | **Phase Align Clip** | Auto zero-crossing alignment in the worklet — no user action needed. |
| 37 | **Adjust Clip Playhead** | Scrubbing is an editor feature, not a performance action. Add later to a clip detail view. |
| 38 | **Cancel Count-Ins/Outs** | Requires scheduled action queue. Add when timing system is built. |
| 39 | **Cancel Pending Actions** | Same — requires action queue. |
| 40 | **MIDI Scene Capture** | Advanced snapshot feature. Future. |
| 41 | **Audio Scene Capture** | Advanced snapshot feature. Future. |
| 42 | **Enable/Disable Effect** | No effects engine yet. |
| 43 | **Adjust Effect Parameter** | No effects engine yet. |
| 44 | **Toggle Sequence / Toggle Mixer / Open Interface** | UI navigation, not performance actions. Keyboard shortcuts handle this. |
| 45 | **Show Detail Screen** | UI navigation. |
| 46 | **Start New Project / Load Project / Save Project** | File menu, not performance actions. |
| 47 | **Clock Start / Stop / Continue** | MIDI Clock sync to external gear. Future. |
| 48 | **Adjust Widget Parameter** | Widgets don't exist. |

---

## PART 3: NEW TYPES — The Module System

These are the NEW types that need to exist in `src/types/index.ts`. They replace the Loopy Pro types as the app's domain model.

```typescript
// ─── Module Definition ───

type ModuleType = "rhythm" | "harmonic" | "arrangement";
type ModuleSize = "sm" | "md" | "lg";
type LoopBehavior = "toggle" | "recordAutoPlay" | "recordWait" | "oneShot";
type QuantizationPreset = "1_16" | "1_8" | "1_4" | "1_bar" | "2_bar" | "4_bar" | "8_bar";
type BusColor = "red" | "blue" | "green";

interface ModuleCard {
    id: string;
    type: ModuleType;
    label: string;              // User-named: "Verse Drums", "Chorus Pad"
    size: ModuleSize;
    colorAccent: string;        // Hex color, preset palette
    bus: BusColor;
    tracks: ModuleTrackConfig[];
    quantization: QuantizationPreset;
    quantizationEnabled: boolean;
    baseMidiNote: number;       // First MIDI note — tracks map consecutively from here
    isPreset: boolean;          // true = from preset library, false = user-edited
    presetId?: string;          // Reference to original preset if edited
}

interface ModuleTrackConfig {
    index: number;              // 0-based within module
    label: string;              // "Kick", "Snare", "Pad", empty = auto-label
    midiNote: number;           // Auto-assigned from baseMidiNote + index, but overridable
    pan: number;                // -1.0 to 1.0, auto-assigned but overridable
    volume: number;             // 0.0 to 1.0, default 0.8
    actions: ModuleActionRef[]; // Which actions this track responds to
    loopBehavior: LoopBehavior; // Per-track behavior override
    volumeRampMs: number;       // 5, 20, 100, 500
    muteGroup?: string;         // Optional mute group ID
}

interface ModuleActionRef {
    actionId: string;           // References an ActionEntry.id from the action library
    enabled: boolean;
    triggerNote?: number;       // If different from track's main midiNote
    quantizationOverride?: QuantizationPreset; // Per-action quantization
}

// ─── Module Preset (saved/shared configurations) ───

interface ModulePreset {
    id: string;
    name: string;               // "Punk Kit", "Ambient Pad", "DJ Transition"
    description: string;
    moduleType: ModuleType;
    defaults: ModuleCard;       // Full default configuration
    tags: string[];             // "drums", "electronic", "acoustic", "4-track"
}

// ─── Action Library Entry (internal vocabulary) ───

interface ActionDef {
    id: string;                 // Loopy Pro serialized ID (verified)
    name: string;               // Human-readable
    category: "clip" | "global" | "clock" | "session" | "effect";
    appliesTo: ModuleType[];    // Which module types can use this action
    paramSchema?: ParamSchema;  // If action takes parameters
}

interface ParamSchema {
    fields: {
        key: string;
        type: "float" | "int" | "choice" | "bool";
        label: string;
        default: number | string | boolean;
        choices?: { label: string; value: string }[];
        min?: number;
        max?: number;
    }[];
}
```

---

## PART 4: EDITOR SURFACE — What Advanced Users Can Customize

| Customization | Scope | UI Control | Loopy Pro Equivalent |
|---|---|---|---|
| Track count | Per module | 2/4/6/8 radio buttons | Freeform (any number) |
| Track labels | Per track | Text input with auto-label | Freeform |
| MIDI note per track | Per track | Number input + "learn" button | Yes, same |
| Base MIDI note (shift all) | Per module | Number input + "learn" | Not directly — Loopy Pro requires per-pad mapping |
| Actions per track | Per track | Checkbox list (filtered by module type) | Full action list with parameter editing |
| Quantization | Per module + per-action override | Dropdown (filtered presets) | Full quantization key set |
| Loop behavior | Per module + per-track override | Dropdown | Configurable via action combinations |
| Pan | Per track | Slider with reset-to-auto button | Freeform |
| Volume | Per track | Slider | Freeform |
| Volume ramp time | Per track | Dropdown (5/20/100/500ms) | Freeform numeric |
| Mute group | Per track | Dropdown (A/B/C/D/None) | Yes, same |
| Bus routing | Per module | Radio (Red/Blue/Green) | Not explicit — implicit via canvas placement |
| Module size | Per module | sm/md/lg radio | Freeform pixel dimensions |
| Color accent | Per module | Preset palette swatches | Full color picker |
| Module order | Global layout | Drag to reorder (vertical/horizontal) | Freeform xy canvas |
| Chord progression | Harmonic module only | Structured editor: add/remove steps, set degree/quality/duration | Separate MIDI track + chord plugin + manual programming |

**What's deliberately NOT customizable:** freeform pixel positioning, raw action identifiers, arbitrary parameter values (only dropdown/checkbox/slider for pre-validated ranges), creating actions from scratch, custom quantization keys, custom bus colors, infinite track counts.

---

## PART 5: FINAL INVENTORY — READY FOR IMPLEMENTATION

```
                    DISCARD   ⚫ ENGINE    🔵 EDITOR    🟢 PRESET
Types (15 original):   7          3           4           1
Actions (52 original): 15         0          20          17
New types:              —          5           7           4

IMPLEMENTATION PRIORITY:
```

| Priority | Item | Category | Tier |
|---|---|---|---|
| 🔴 P0 | App domain types (all new Module types + SongObject family) | Types | — |
| 🔴 P0 | Zustand store: module cards, song data, UI state | State | — |
| 🔴 P0 | App shell: vertical module stack, drag-to-reorder | UI | 🟢 |
| 🔴 P0 | Module card component: renders per archetype, connects to engine | UI | 🟢 |
| 🔴 P0 | `LooperAction` dispatch pipeline (engine internal) | Engine | ⚫ |
| 🔴 P0 | `ParamChange` pipeline (engine internal) | Engine | ⚫ |
| 🟠 P1 | 52-action library ported as `ActionDef[]` typed constant | Data | ⚫ |
| 🟠 P1 | Module preset library (3-5 presets per archetype) | Data | 🟢 |
| 🟠 P1 | Mute + Solo per track in worklet | Engine | 🟢 |
| 🟠 P1 | Global Play/Stop + Master Volume | Engine | 🟢 |
| 🟠 P1 | Tap Tempo + BPM wired to engine | UI + Engine | 🟢 |
| 🟠 P1 | Auto MIDI mapping: baseNote + trackCount → consecutive notes | Engine | 🟢 |
| 🟡 P2 | **Structured Module Editor UI** (Tier 2 — the full form) | UI | 🔵 |
| 🟡 P2 | **ChordStep looping progression** in Harmonic Module | Feature | 🔵 |
| 🟡 P2 | Overdub in worklet | Engine | 🟢 |
| 🟡 P2 | Quantization scheduling (action timing = next bar) | Engine | 🔵 |
| 🟡 P2 | MIDI learn for per-track notes | UI | 🔵 |
| 🟡 P2 | Module preset save/load (user presets) | Feature | 🔵 |
| 🟢 P3 | Undo/Redo (command pattern) | Engine | 🟢 |
| 🟢 P3 | Multiply/Divide Clip Length | Engine | 🔵 |
| 🟢 P3 | Reverse Clip | Engine | 🔵 |
| 🟢 P3 | Mute groups | Engine | 🔵 |
| ⬜ Future | Effects engine | Engine | — |
| ⬜ Future | SongObject save/load with buffer extraction | Engine + UI | — |
| ⬜ Future | MIDI Clock sync | Engine | — |

---

## HOW THIS WALKS THE LINE

| Concern | Loopy Pro | Our App |
|---|---|---|
| **Time to first sound** | 30-60 minutes (map pads, place widgets, configure actions) | 30 seconds (pick a module preset) |
| **Customization ceiling** | Infinite (any action, any parameter, any position) | High but structured (track count, actions per track, MIDI notes, quantization, bus, pan, behavior modes) |
| **Can you build unique setups?** | Yes, anything | Yes — different track counts × action sets × quantization × bus routing × loop behaviors = thousands of combinations per module. Multiplied across modules per song. |
| **Can you paint yourself into a corner?** | Yes — broken mappings, conflicting actions, orphaned widgets | No — the editor constrains choices to valid combinations per module type |
| **Learning curve** | Steep (read wiki, memorize 52+ action IDs, understand canvas model) | Shallow (presets work immediately; editor uses checkboxes and dropdowns, not identifiers) |
| **Portability** | .lpproj + .controllerprofile (iOS only) | SongObject JSON (runs anywhere with a browser) |