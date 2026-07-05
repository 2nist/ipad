## The Song Composition Canvas — Making Structure Visible and Manipulable

This is the UI layer that makes or breaks the entire concept. The goal: a single view where you can map "Come Together" in under two minutes and it's structurally recognizable — sections, voicings, instrumentation changes — without touching a single MIDI note.

---

## The Benchmark: "Come Together" by The Beatles

```
Section Structure:
  Intro(4) → Verse(8) → Chorus(8) → Verse(8) → Chorus(8) → Bridge(4) → Verse(4) → Chorus(8) → Outro(4)

Instrumentation per section:
  Intro:     Bass riff, Drums (kick+toms), Shaker
  Verse:     Bass riff, Drums, Vocal pad, Piano stabs
  Chorus:    Bass riff, Drums (full), Vocal pad, Piano, Guitar crunch
  Bridge:    Drums (toms), Bass, Organ swell
  Outro:     Bass riff, Drums, Guitar, Fade

Chord progression (Verse):
  Dm | Dm | Dm | Dm | A7 | A7 | G7 | G7
  (i  | i  | i  | i  | V7 | V7 | IV7| IV7 )
```

---

## The Song Canvas — Main Composition View

This is the single primary view the user spends most time in. It replaces the vertical module stack with a **horizontal timeline + lane grid** that shows the entire song at once.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  SONG: "Come Together Cover"          120 BPM  4/4  Key: Dm  [Save] [Play] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ SECTION TIMELINE ────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌──────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────┐     │  │
│  │  │ INTRO│ │   VERSE    │ │   CHORUS   │ │   VERSE    │ │BRIDGE│ ... │  │
│  │  │  4   │ │     8      │ │     8      │ │     8      │ │  4   │     │  │
│  │  │ Dm   │ │ Dm A7 G7   │ │ Dm C  G    │ │ Dm A7 G7   │ │ Dm G │     │  │
│  │  └──────┘ └────────────┘ └────────────┘ └────────────┘ └──────┘     │  │
│  │       ▲                                                                 │  │
│  │       └── Transition: riser fill (1 bar)                                │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ MODULE LANES ───────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  🔴 DRUMS     │████████│████████████│████████████│████████████│██│... │  │
│  │  "Verse Kit"  │  shaker │ full kit   │ full kit   │ full kit   │toms│  │  │
│  │               │         │            │            │            │    │  │  │
│  │  🔴 BASS      │████████│████████████│████████████│████████████│████│... │  │
│  │  "Bass Riff"  │  riff   │ riff       │ riff       │ riff       │riff │  │  │
│  │               │         │            │            │            │    │  │  │
│  │  🔵 PADS      │────────│████████████│████████████│████████████│────│... │  │
│  │  "Vocal Pad"  │  (off)  │ sustained  │ sustained  │ sustained  │off │  │  │
│  │               │         │            │            │            │    │  │  │
│  │  🔵 PIANO     │────────│──████████──│████████████│──████████──│────│... │  │
│  │  "Stabs"     │  (off)  │ pattern    │ chords     │ pattern    │off │  │  │
│  │               │         │            │            │            │    │  │  │
│  │  🟢 GUITAR   │────────│────────────│████████████│────────────│────│... │  │
│  │  "Crunch"    │  (off)  │ (off)      │ power chrd │ (off)      │off │  │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ CHORD STRIP ─────────────────────────────────────────────────────────┐  │
│  │  INTRO      VERSE                     CHORUS                  VERSE    │  │
│  │  Dm────────│Dm──Dm──Dm──Dm──A7──A7──G7──G7│Dm──C───G───G───│Dm──Dm...│  │
│  │  i─────────│i───i───i───i───V7──V7─IV7─IV7│i──♭VII─IV──IV─│i...    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ PLAYHEAD ────────────────────────────────────────────────────────────┐  │
│  │  ████▶────────────────────────────────────────────────────────────────  │  │
│  │  Bar 3 · Beat 2 · Section: INTRO                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [+ Add Section]  [+ Add Module]  [AI: Suggest Structure]  [AI: Arrange]    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## The Three Views — Layered Granularity

The user toggles between three levels of detail, all on the same canvas:

### View 1: SECTIONS ONLY (high-level arrangement — default)

```
┌──────┐ ┌────────────┐ ┌────────────┐ ┌──────┐ ┌────────────┐ ┌──────┐
│ INTRO│ │   VERSE    │ │   CHORUS   │ │VERSE │ │   CHORUS   │ │OUTRO │
│  4   │ │     8      │ │     8      │ │  8   │ │     8      │ │  4   │
│  Dm  │ │ Dm A7 G7   │ │ Dm  C  G   │ │ Dm   │ │ Dm  C  G   │ │ Dm   │
└──────┘ └────────────┘ └────────────┘ └──────┘ └────────────┘ └──────┘
   ▲          ▲              ▲
   │          │              └── Section selected: shows chord strip below
   │          └── Drag handles: resize (change bar count)
   └── Drag: reorder sections

User actions at this level:
  • Drag section blocks to reorder
  • Drag edges to resize (change bar count)
  • Double-click to name/label
  • Right-click → Duplicate, Delete, Add chord progression, Set transition type
  • Select → chord strip editor appears below
  • [+ Add Section] button at end
```

### View 2: SECTION + MODULES (instrumentation per section — toggle with [Show Modules])

```
Section blocks expand downward to show module lanes:

┌────────────┐
│   VERSE    │
│     8      │
│ Dm A7 G7   │
├────────────┤
│ 🔴 Drums   │████████████│  ← solid bar = active
│ 🔴 Bass    │████████████│
│ 🔵 Pads    │████████████│
│ 🔵 Piano   │──██████────│  ← partial bar = active for subset
│ 🟢 Guitar  │────────────│  ← dashed = inactive
└────────────┘

User actions at this level:
  • Click module lane within section → toggle active/inactive
  • Drag module lane edges → offset activation within section
  • Hover → module preview plays
  • Right-click module lane → Change module preset, Add expression
  • Module lanes auto-populate from the module library
```

### View 3: FULL COMPOSITION (all detail — toggle with [Expand All])

```
Full view as shown in the main diagram above.
All sections visible, all module lanes visible, chord strip visible,
expression markers visible, playhead visible.

User actions at this level:
  • Everything from Views 1 and 2
  • Drag expression markers between sections
  • Click chord strip to edit individual chord
  • Click playhead bar to seek
  • Marquee-select multiple sections for batch operations
```

---

## Granular Manipulation — What "Feels Creative" Means

Each interaction is a single gesture with immediate audiovisual feedback:

| Gesture | Result | Feedback |
|---|---|---|
| **Drag section edge** | Resize bar count | Section block resizes, chord strip adjusts, all modules auto-adapt — playhead continues if playing |
| **Double-click module lane** | Add/remove module from section | Lane appears/disappears with animation. If playing, module fades in/out over 1 bar |
| **Right-click chord strip** | Chord palette opens | Diatonic chord suggestions ranked by common progressions. Click to set. Hexagon previews harmony. |
| **Drag expression marker** | Move fill/transition position | Marker snaps to bar/beat grid. Preview plays on drop. |
| **Click + drag section** | Reorder sections | Sections slide with spring animation. If playing, transition fires at boundary. |
| **Alt + drag section** | Duplicate section | Clone appears at drop position with all module assignments + chords preserved |
| **Marquee-select modules** | Batch mute/solo/delete | Selection highlight. Press M to mute selected, S to solo, Delete to remove |
| **Scroll wheel over section** | Nudge bar count ±1 | Section grows/shrinks by 1 bar per scroll tick |
| **Middle-click section** | Solo section (temporarily) | Only this section's modules play. All others dim. Click again or press Esc to return. |

---

## The AI Song Structure Engine

Three AI-assisted features, each optional and invoked deliberately:

### 1. "Suggest Structure" — Generate from template

```
User clicks [AI: Suggest Structure]
  → Dialog: "What kind of song?"
  → User types or picks: "Blues" | "Pop" | "Rock" | "Electronic" | "Freeform"
  → AI generates section layout:

  Pop template:
  Intro(4) → Verse(8) → Chorus(8) → Verse(8) → Chorus(8) → Bridge(8) → Chorus(8) → Outro(4)

  User sees preview. Can accept, modify, or dismiss.
  User adjusts: drag sections, resize, rename.
```

### 2. "Suggest Chords" — Generate progression from key

```
User selects a section → right-click → "Suggest Chords"
  → AI generates diatonic progression:

  Key: Dm (D minor)
  Common progressions:
    • i - iv - V7 - i      (dark, classical)
    • i - ♭VII - ♭VI - V7  (aeolian, rock)
    • i - v - iv - ♭VII    (modern minor)
    • i - iv - ♭VII - i    (dorian feel)

  User clicks one → chord strip populates.
  User can edit individual chords: click chord → palette → pick quality + duration.
```

### 3. "Arrange Song" — Auto-assign modules to sections

```
User has: 5 modules in library, 6 sections in timeline
User clicks [AI: Arrange]
  → AI analyzes modules:
    • "Verse Drums" → tagged [drums, verse] → assign to Verse sections
    • "Chorus Kit" → tagged [drums, chorus] → assign to Chorus sections
    • "Bass Riff" → tagged [bass, loop] → assign to all sections
    • "Pad" → tagged [harmonic, pad] → assign to Verse + Chorus
    • "Lead" → tagged [harmonic, lead] → assign to Chorus + Outro

  → Module lanes populate across sections.
  → User tweaks: click lanes to add/remove from specific sections.
```

---

## The Chord Strip Editor — Where Harmony Becomes Visual

The chord strip is the most important sub-view for the "cover any song" benchmark. It must let you quickly input a known progression.

### Editing a chord strip

```
Click on section → chord strip expands:

┌─ VERSE (8 bars, Dm) ──────────────────────────────────────────┐
│                                                                │
│  Bar:  1    2    3    4    5    6    7    8                   │
│       ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                │
│       │Dm│ │Dm│ │Dm│ │Dm│ │A7│ │A7│ │G7│ │G7│                │
│       │i │ │i │ │i │ │i │ │V7│ │V7│ │IV│ │IV│                │
│       └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                │
│                                                                │
│  [Add Bar]  [Duplicate]  [Suggest Chords]  [Clear]            │
│                                                                │
│  ┌─ CHORD PALETTE (opens when chord is clicked) ──────────┐   │
│  │  Key: Dm                                               │   │
│  │                                                        │   │
│  │  i     ii°    ♭III   iv     v      ♭VI    ♭VII         │   │
│  │  Dm    Edim   F      Gm     Am     B♭     C            │   │
│  │  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐            │   │
│  │  │m │  │d │  │M │  │m │  │m │  │M │  │M │            │   │
│  │  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘  └──┘            │   │
│  │                                                        │   │
│  │  Extensions: [7] [maj7] [9] [sus4] [add9] [dim] [aug] │   │
│  │                                                        │   │
│  │  Duration: [1 bar ▼]  [1/2] [1] [2] [4]               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## How This Passes The Beatles Test

To map "Come Together":

1. **Set key and BPM**: D minor, 85 BPM → type in header bar
2. **Generate structure**: [AI: Suggest Structure] → "Rock" → gets Intro/Verse/Chorus pattern → accept
3. **Rename sections**: Double-click → "Intro", "Verse", "Chorus", "Bridge", "Outro"
4. **Set bar counts**: Drag edges → Intro=4, Verse=8, Chorus=8, Bridge=4, Outro=4
5. **Input chord progression**: Click Verse section → chord strip opens → click each bar, pick from palette:
   - Bar 1-4: Dm (i), Bar 5-6: A7 (V7), Bar 7-8: G7 (IV7)
   - Click [Duplicate] → assigns pattern to second half
6. **Assign modules to sections**: Each module lane → click active/inactive per section
   - Drums: Intro(shaker only), Verse(full), Chorus(full), Bridge(toms), Outro(full)
   - Bass: all sections (riff)
   - Pads: Verse, Chorus (sustained)
   - Piano: Verse(partial), Chorus(full)
   - Guitar: Chorus(power chords)
7. **Hit play** → the entire structure plays through. You hear:
   - Intro: Dm bass riff + shaker (4 bars)
   - Transition fill (1 bar drum fill)
   - Verse: bass + drums + pads + piano stabs over Dm-A7-G7 (8 bars)
   - Chorus: everything over Dm-C-G (8 bars)
   - ... etc.

The result is instantly recognizable as "Come Together" — the arrangement, voicings, and instrumentation changes are all there. The timing is quantized (no swing feel, no vocal nuance) but the architecture is correct.

---

## Use Cases — Beyond Covers

| Use Case | How the Canvas Serves It |
|---|---|
| **Cover a song** | Input structure + chords. Assign module presets to sections. Play. |
| **Write original** | Start with AI-suggested structure. Swap modules. Tweak chords. Iterate. |
| **Live performance** | Sections triggered by Arrangement Module MIDI pads. Canvas shows upcoming section highlighted. |
| **Jam / improvise** | Modules as looping layers. Click module lanes to bring instruments in/out live. Sections auto-advance or wait for trigger. |
| **Remix / re-arrange** | Drag section blocks to reorder. "What if the bridge comes first?" Hear it instantly. |
| **Export to DAW** | Export SongObject as stems. Each module track = one stem, arranged per section. |

---

## Type Additions for the Canvas (Lightweight)

The SongObject already captures this data. The canvas is a **view**, not new data. Two small additions for editor state:

```typescript
// UI-only type — stored in Zustand, not in SongObject
interface CanvasViewState {
    viewLevel: "sectionsOnly" | "sectionsWithModules" | "fullComposition";
    selectedSectionIds: string[];
    selectedModuleIds: string[];
    zoomLevel: number;                  // Horizontal zoom
    scrollPosition: number;             // Horizontal scroll
    chordEditorOpen: boolean;
    chordEditorBarIndex: number | null; // Which bar is being edited
    isPlaying: boolean;
    playheadPosition: number;           // Beat position
}

// ADD to SongSection — optional markers for finer granularity
interface SectionMarker {
    beat: number;                       // Beat offset from section start
    label: string;                      // "Fill here", "Drop"
    type: "cue" | "loopPoint" | "expressionTrigger";
    targetModuleId?: string;
}
```

The `SectionMarker` type allows users to place fine-grained markers within sections — drop points, fill triggers, loop retriggers — without needing a full MIDI piano roll. This is the "semi-rudimentary quantized" level of detail.

---

## Summary — What Makes This a Composition Tool, Not a Toy

| Toy | Composition Tool |
|---|---|
| Fixed loops, one pattern | Sections with variable bar counts, chord progressions, module assignments |
| Manual MIDI mapping per track | Modules auto-assign to sections, AI suggests structure |
| Single pattern view | Three-level canvas: sections, modules, chords — all visible at once |
| No chord awareness | Chord strip editor with diatonic palette, AI chord suggestions |
| Static arrangement | Drag-to-reorder sections, resize, duplicate — all live |
| No structural visualization | Every section, module lane, chord, and transition is visible and manipulable |
| Solo performance tool | Cover any song. Write any song. Export to DAW. |

**The canvas is the product.** The types, engines, and module system are infrastructure. The canvas is where a musician sits down and maps out a song — and hears it come alive.