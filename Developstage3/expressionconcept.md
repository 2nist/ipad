## Expression Submodules — Conditional Override System

This is a powerful concept. Each module archetype gets an optional expression child that temporarily overrides the main loop output. It's a lightweight conditional playback system — not a full second module, but a "variation slot" baked into the parent.

---

## The Three Expression Types

### Rhythm Expression → Fill

```
┌─────────────────────────────────────────────┐
│  RHYTHM MODULE: "Verse Drums"               │
│                                             │
│  Main loop: kick-snare-hat-perc (4 bars)    │
│                                             │
│  ┌─ FILL (expression submodule) ──────────┐ │
│  │  Clip: "fill_pattern_abc123"           │ │
│  │  Trigger: every 4th repeat of parent   │ │
│  │  Offset: last 1 bar of parent loop     │ │
│  │  Behavior: replace parent for duration │ │
│  │  (parent mutes, fill plays,            │ │
│  │   then parent resumes on bar 1)        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

Triggers:
  • Every N repeats (every 4th, every 8th)
  • On section change (play fill at end of current section)
  • Manual (MIDI trigger pad)
  • Random probability (20% chance each repeat)
```

### Harmonic Expression → Variation

```
┌─────────────────────────────────────────────┐
│  HARMONIC MODULE: "Verse Pad"               │
│                                             │
│  Main progression: I → IV → V → I           │
│                                             │
│  ┌─ VARIATION (expression submodule) ─────┐ │
│  │  Chord override: I → IV → vi → V       │ │
│  │  OR melody variation clip              │ │
│  │  Trigger: every 2nd repeat             │ │
│  │  Offset: whole loop (4 bars)           │ │
│  │  Behavior: replace chord progression   │ │
│  │  OR layer melody on top               │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

Triggers:
  • Every N repeats
  • On section change
  • Manual
  • Random
```

### Arrangement Expression → Transition

```
┌─────────────────────────────────────────────┐
│  ARRANGEMENT MODULE: Conductor              │
│                                             │
│  Sections: Intro → Verse → Chorus → Verse   │
│                                             │
│  ┌─ TRANSITION (expression submodule) ────┐ │
│  │  From: Verse → Chorus                  │ │
│  │  Type: riser / sweep / drum fill       │ │
│  │  Offset: last 2 bars of Verse          │ │
│  │  Duration: 2 bars (overlaps bar line)  │ │
│  │  Behavior: layer over outgoing section │ │
│  │  (doesn't mute parent, adds on top)    │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

Triggers:
  • Specific section transition ("Verse→Chorus")
  • All transitions (global transition fill)
  • Manual
```

---

## Expression Behaviors

Expression submodules have one key difference from their parent: **what happens to the parent when the expression fires?**

| Behavior | Parent | Expression | Use Case |
|---|---|---|---|
| **replace** | Muted | Plays alone | Drum fill replaces main beat |
| **layer** | Keeps playing | Plays on top | Transition riser over outgoing section |
| **morph** | Crossfades out | Crossfades in | Smooth chord progression shift |

---

## Type Definitions

```typescript
// ═══════════════════════════════════════════════════════════
// EXPRESSION SUBMODULES
// ═══════════════════════════════════════════════════════════

type ExpressionBehavior = "replace" | "layer" | "morph";

interface ExpressionTrigger {
    type: "everyNRepeats" | "onSectionChange" | "manual" | "random";
    /** For "everyNRepeats": fire every Nth repeat of the parent loop */
    everyN?: number;
    /** For "random": probability 0.0-1.0 of firing on each repeat */
    probability?: number;
    /** For "onSectionChange": which section transition triggers this */
    fromSection?: string;    // Section name
    toSection?: string;      // Section name — if omitted, fires on ANY section change
}

// ── RHYTHM EXPRESSION (Fill) ──

interface RhythmExpression {
    type: "fill";
    /** Clip to play as fill (from backend or user library) */
    clipId: string | null;
    clipData?: ArrayBuffer;
    /** When the fill triggers */
    trigger: ExpressionTrigger;
    /** Where in the parent loop the fill starts (in beats from loop end) */
    offsetBeats: number;
    /** Duration of the fill in beats */
    durationBeats: number;
    /** What happens to the parent loop during the fill */
    behavior: ExpressionBehavior;
    /** Sound engine for the fill clip */
    soundEngine: SoundEngine;
    /** Transpose (±12 semitones) */
    transpose: number;
    /** Enabled/disabled toggle */
    enabled: boolean;
}

// ── HARMONIC EXPRESSION (Variation) ──

interface HarmonicExpression {
    type: "variation";
    /** Override chord progression (if set, replaces parent's chordProgression when active) */
    chordProgressionOverride?: ChordStep[];
    /** OR: a MIDI clip that plays a melodic variation on top */
    clipId?: string | null;
    clipData?: ArrayBuffer;
    /** When the variation triggers */
    trigger: ExpressionTrigger;
    /** Duration override — if omitted, matches parent loop length */
    durationBars?: number;
    /** Replace or layer on top of parent */
    behavior: ExpressionBehavior;
    /** Sound engine for variation clip */
    soundEngine?: SoundEngine;
    /** Transpose */
    transpose: number;
    enabled: boolean;
}

// ── ARRANGEMENT EXPRESSION (Transition) ──

interface ArrangementExpression {
    type: "transition";
    /** The section transition this applies to */
    fromSection: string;
    toSection: string;
    /** Clip to play during transition (riser, sweep, fill) */
    clipId: string | null;
    clipData?: ArrayBuffer;
    /** Offset from the END of the outgoing section (in beats) */
    offsetBeats: number;
    /** Duration of the transition (in beats — can cross the bar line) */
    durationBeats: number;
    /** Usually "layer" — plays over outgoing section without muting it */
    behavior: ExpressionBehavior;
    /** Sound engine */
    soundEngine: SoundEngine;
    /** Transpose */
    transpose: number;
    enabled: boolean;
}

// Union type
type ModuleExpression = RhythmExpression | HarmonicExpression | ArrangementExpression;
```

---

## Updated ModuleCard

The `ModuleCard` gets an optional `expression` field:

```typescript
interface ModuleCard {
    id: string;
    type: ModuleType;
    label: string;
    size: ModuleSize;
    colorAccent: ColorAccent;
    bus: BusColor;
    tracks: ModuleTrackConfig[];
    sync: SyncConfig;
    loop: LoopConfig;
    baseMidiNote: number;
    quantization: QuantizationPreset;
    isPreset: boolean;
    presetId?: string;
    readonly shapeConfig: RhythmShapeConfig;
    
    /** Optional expression submodule — fill, variation, or transition */
    expression?: ModuleExpression;
}
```

---

## How Expression Fits the Architecture

```
MODULE CARD
├── TRACKS (always active, main loop)
│   ├── Track 1 "Kick"   → MidiClipSource
│   ├── Track 2 "Snare"  → MidiClipSource
│   ├── Track 3 "Hat"    → AudioInputSource
│   └── Track 4 "Perc"   → MidiClipSource
│
└── EXPRESSION (conditional override)
    ├── Type: Fill
    ├── Clip: "fill_crash_123"
    ├── Trigger: every 4th repeat, last 1 bar
    ├── Behavior: replace
    └── When it fires:
        • Parent tracks 1-4 mute
        • Fill clip plays through its own sound engine
        • At bar 1 of next cycle, parent resumes
```

The engine dispatches this as:

```
1. Transport detects: "now at bar 3 of 4, repeat #4"
2. Check: expression.trigger matches? → yes (everyN=4)
3. Execute: expression.behavior = "replace"
   → Mute parent tracks 1-4
   → Start expression clip playback
4. Expression clip ends after durationBeats
5. Unmute parent tracks 1-4
6. Parent resumes from bar 1 of next cycle
```

---

## MIDI Mapping for Expressions

Each expression gets one dedicated MIDI trigger (for manual mode) auto-assigned from the module's `baseMidiNote + trackCount + 1`. So a 4-track Rhythm Module uses pads 36-39 for tracks, and pad 40 for the fill trigger.

```typescript
// Expression MIDI note = baseMidiNote + trackCount
// Rhythm Module: base=36, 4 tracks → tracks use 36-39, fill uses 40
// Harmonic Module: base=48, 1 track → track uses 48, variation uses 49
// Arrangement Module: base=60, 0 tracks → sections use 60+, first transition uses 68
```

---

## Editor UI for Expressions

Each module editor gets a collapsible "Expression" section:

```
┌─ EXPRESSION ──────────────────────────────────┐
│  ☑ Enable Fill                                │
│                                                │
│  Clip:  [fill_crash_123          ▾] [Browse]  │
│  Sound: [Tone.js PolySynth       ▾]           │
│                                                │
│  Trigger: [Every N repeats ▾]  N: [4]         │
│                                                │
│  Offset: [1 bar ▾] from loop end              │
│  Duration: [1 bar ▾]                          │
│  Behavior: [Replace parent ▾]                 │
│                                                │
│  MIDI pad: [40]  [Learn]                      │
└────────────────────────────────────────────────┘
```

---

## Summary — Complete Module Family

| Module Type | Bus | Tracks | Expression | Expression Name |
|---|---|---|---|---|
| Rhythm | Red | 2-8 | ✅ | Fill |
| Harmonic | Blue | 1-4 | ✅ | Variation |
| Arrangement | Green | 0 (conductor) | ✅ | Transition |

Each module type now has a parent loop + optional expression child. The expression is lightweight — it doesn't duplicate the full track structure, just overrides what's needed (a clip, a chord progression, a transition effect).

This completes the module family. We have:
- **3 module archetypes** (Rhythm, Harmonic, Arrangement)
- **3 sound source types** (AudioInput, MidiClip, LiveMidi)
- **3 sound engines** (Tone.js PolySynth, Sampler, MidiOut)
- **3 expression types** (Fill, Variation, Transition)
- **3 expression behaviors** (Replace, Layer, Morph)
- **Dual-polygon rhythm visualization** (numerator + denominator overlay)
- **Diatonic hexagon** (Harmonic Module face)
- **Section timeline** (Arrangement Module face)

Ready to draft the final complete `src/types/index.ts` with all definitions consolidated.