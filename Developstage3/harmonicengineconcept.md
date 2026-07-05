## Harmonic Engine — Complete Specification

The Harmonic Module is the most musically sophisticated component. It bridges music theory (keys, scales, chord functions) with the looper engine (audio/MIDI playback) and the clip dataset (intelligent filtering). Three engines work together inside it: a **Harmony Engine** (what chords play), a **Voicing Engine** (how chords are voiced), and a **Clip Filter** (which dataset clips match the current harmony).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  HARMONIC MODULE                                                 │
│                                                                  │
│  INPUT (from Arrangement Module):                               │
│    • SectionContext.chordProgression: ChordStep[]                │
│    • SongMetadata.key: "Dm"                                      │
│    • SongMetadata.scale: "minor"                                 │
│                                                                  │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │ HARMONY ENGINE │   │ VOICING ENGINE │   │  CLIP FILTER   │  │
│  │                │   │                │   │                │  │
│  │ • Progression  │──▶│ • Chord tones  │──▶│ • Key match    │  │
│  │   stepper      │   │ • Inversions   │   │ • Scale match  │  │
│  │ • Degree → note│   │ • Extensions   │   │ • Chord match  │  │
│  │ • Cadence      │   │ • Voice leading│   │ • Density      │  │
│  │   detection    │   │ • Range clamp  │   │ • Dataset      │  │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘  │
│          │                    │                    │            │
│          ▼                    ▼                    ▼            │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │ MIDI CLIP      │   │ LIVE MIDI      │   │ AUDIO INPUT    │  │
│  │ SOURCE         │   │ SOURCE         │   │ SOURCE         │  │
│  │ (auto-transpose│   │ (scale snap)   │   │ (no transpose) │  │
│  │  to chord)     │   │                │   │                │  │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘  │
│          │                    │                    │            │
│          ▼                    ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SOUND ENGINE (Tone.js PolySynth / Sampler / MidiOut)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  VISUALIZATION: Diatonic Hexagon + Chord Timeline                │
│  EXPRESSION: Variation (chord override or melody clip)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## HARMONY ENGINE — Chord Progression Stepper

### What It Does

The harmony engine takes a `ChordStep[]` array and advances through it in time, synced to the transport clock. At each step, it calculates what the active chord means in terms of actual notes, and broadcasts that to the sound sources and the visualizer.

### Core Logic

```
Given: key="D", scale="minor", progression=[{degree:1, quality:"min", duration:2}, {degree:4, quality:"min", duration:2}, {degree:5, quality:"dom7", duration:4}]

Step 1 (bars 0-2): degree=1, quality=min → D minor (D, F, A)
Step 2 (bars 2-4): degree=4, quality=min → G minor (G, B♭, D)
Step 3 (bars 4-8): degree=5, quality=dom7 → A dominant 7 (A, C#, E, G)

Loop back to Step 1 after bar 8.
```

### Scale Degree to Note Mapping

The engine needs to resolve "degree 4 in D minor" to actual MIDI note numbers. This requires knowing the scale's interval pattern:

```typescript
const SCALE_INTERVALS: Record<string, number[]> = {
    major:     [0, 2, 4, 5, 7, 9, 11],     // W-W-H-W-W-W-H
    minor:     [0, 2, 3, 5, 7, 8, 10],     // W-H-W-W-H-W-W (natural)
    harmonic:  [0, 2, 3, 5, 7, 8, 11],     // W-H-W-W-H-WH-H
    melodic:   [0, 2, 3, 5, 7, 9, 11],     // W-H-W-W-W-W-H (ascending)
    dorian:    [0, 2, 3, 5, 7, 9, 10],
    phrygian:  [0, 1, 3, 5, 7, 8, 10],
    lydian:    [0, 2, 4, 6, 7, 9, 11],
    mixolydian:[0, 2, 4, 5, 7, 9, 10],
    locrian:   [0, 1, 3, 5, 6, 8, 10],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function degreeToRootNote(key: string, scale: string, degree: number): number {
    const keyIndex = NOTE_NAMES.indexOf(key);
    const intervals = SCALE_INTERVALS[scale];
    const interval = intervals[(degree - 1) % 7];
    return (keyIndex + interval) % 12;  // MIDI note number mod 12
}
```

### Chord Quality → Intervals

```typescript
const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
    maj:   [0, 4, 7],           // Root, major 3rd, perfect 5th
    min:   [0, 3, 7],           // Root, minor 3rd, perfect 5th
    dim:   [0, 3, 6],           // Root, minor 3rd, diminished 5th
    aug:   [0, 4, 8],           // Root, major 3rd, augmented 5th
    dom7:  [0, 4, 7, 10],       // maj + minor 7th
    maj7:  [0, 4, 7, 11],       // maj + major 7th
    min7:  [0, 3, 7, 10],       // min + minor 7th
};

// Example: D minor = root D(2) + intervals [0,3,7] = [2,5,9] = D(2), F(5), A(9)
// MIDI note numbers: 50, 53, 57 (D3, F3, A3 — middle octave)
```

### Progression Stepper Type

```typescript
interface HarmonyState {
    /** The active chord progression (received from current section) */
    progression: ChordStep[];
    /** Current step index in the progression */
    currentStepIndex: number;
    /** Beat position within the current step */
    beatInStep: number;
    /** Total beats until next step */
    beatsUntilNextStep: number;
    /** The current active chord, resolved to actual notes */
    activeChord: ResolvedChord;
    /** The previous chord (for voice leading) */
    previousChord: ResolvedChord | null;
    /** Is the progression looping? */
    isLooping: boolean;
    /** Cadence type at progression end (detected automatically) */
    cadenceType: "authentic" | "plagal" | "deceptive" | "half" | "none";
}

interface ResolvedChord {
    degree: number;
    quality: ChordQuality;
    rootNote: number;       // MIDI note 0-11
    rootOctave: number;     // Octave offset for voicing
    chordTones: number[];   // MIDI note numbers for each tone
    /** Full note names: ["D3", "F3", "A3"] for display */
    noteNames: string[];
}
```

### Cadence Detection

The engine auto-detects the cadence type at the end of a progression. This drives the "feel" of the loop and can influence transition behavior:

```
Progression ending:    V7 → I     = authentic cadence (strong resolution)
Progression ending:    IV → I     = plagal cadence ("Amen")
Progression ending:    V7 → vi    = deceptive cadence (surprise)
Progression ending:    ? → V      = half cadence (pause, unresolved)

Detection is simple pattern matching on the last two ChordSteps.
```

---

## VOICING ENGINE — How Chords Sound

The voicing engine determines HOW chord tones are arranged — which octave, which inversion, voice leading between chords. This is what separates "robot playing block chords" from "musical harmonic texture."

### Voicing Strategies

```typescript
type VoicingStrategy = "closeRoot" | "closeFirst" | "closeSecond" | "open" | "drop2" | "drop3" | "spread";

interface VoicingConfig {
    strategy: VoicingStrategy;
    /** Octave range: min/max MIDI notes */
    minNote: number;        // Default: 48 (C3)
    maxNote: number;        // Default: 84 (C6)
    /** Voice leading: minimize movement between chords */
    smoothVoiceLeading: boolean;
    /** Number of voices */
    voiceCount: number;     // 3-6, default matches chord tones
    /** Octave doubling (doubles root an octave lower) */
    rootDoubling: boolean;
}
```

### Voice Leading Algorithm

When `smoothVoiceLeading` is enabled, transitioning from one chord to the next finds the closest inversion that minimizes total voice movement:

```
Dm (D3, F3, A3) → G7 (G, B, D, F)
Without voice leading: G3, B3, D4, F4  (jumps up)
With voice leading:    G3, B3, D4, F4  → finds closest:
                       G2, B2, D3, F3  (smoother, stays in range)
```

The algorithm:
1. For each voice in the new chord, find the closest pitch to the corresponding voice in the old chord
2. Constrain to `minNote`/`maxNote` range
3. If `rootDoubling`, add root one octave below lowest voice

### Voicing Presets (for the editor)

| Preset | Strategy | Description |
|---|---|---|
| **Piano** | closeRoot | Block chords, root position, 3-4 voices, C3-C5 |
| **Pad** | open | Spread voicing, 4-5 voices, C3-C6, smooth leading |
| **Strings** | drop2 | Drop-2 voicing, 4 voices, C3-C5 |
| **Jazz** | spread | Rootless voicings, 3-4 voices, C3-C5 |
| **Bass** | closeRoot + rootDoubling | Root + octave, 2 voices, C1-C3 |

---

## CLIP FILTER ENGINE

The clip filter uses the current harmony state to filter the backend's MIDI dataset intelligently. Three filter modes:

### Filter Mode 1: Key Match (default)
```
Active chord: D minor (D, F, A)
→ Show clips whose detected key is D AND scale matches
→ Backend API: GET /api/clips?key=D&scale=minor
```

### Filter Mode 2: Chord Tone Match (tight)
```
Active chord: D minor → chord tones: D, F, A
→ Show clips whose pitch class vector is dominated by D, F, A
→ Filter client-side: clip.pitchClassVector[D] > threshold AND
                     clip.pitchClassVector[F] > threshold AND
                     clip.pitchClassVector[A] > threshold
```

### Filter Mode 3: Progression Match (smart)
```
Entire progression: Dm(2 bars) → Gm(2 bars) → A7(4 bars)
→ Pre-fetch clips for all three chords
→ Group by chord: user sees "Dm clips" / "Gm clips" / "A7 clips"
→ Assign per step: Dm clip for step 0, Gm clip for step 1, A7 clip for step 2
→ Module auto-switches clip when chord changes
```

### Clip Filter Type

```typescript
type ClipFilterMode = "keyMatch" | "chordToneMatch" | "progressionMatch";

interface ClipFilterConfig {
    mode: ClipFilterMode;
    /** Minimum note density for suggested clips */
    minDensity: number;     // 0-10
    maxDensity: number;     // 0-10
    /** Preferred datasets */
    datasets: ("e-gmd" | "tegridy")[];
    /** Auto-assign best-matching clip to each progression step */
    autoAssign: boolean;
    /** Chord tone match threshold (0.0-1.0) */
    matchThreshold: number;
}

/** A clip suggestion tied to a specific chord step */
interface ClipSuggestion {
    clipId: string;
    metadata: ClipMetadata;
    /** How well it matches: 0.0-1.0 */
    matchScore: number;
    /** Which chord step it's suggested for */
    chordStepIndex: number;
}
```

---

## MIDI CLIP SOURCE — Auto-Transpose Mode

When a Harmonic Module track uses a `MidiClipSource` with `followChordProgression: true`, the engine auto-transposes the MIDI clip to match the active chord.

### How Auto-Transpose Works

```
Clip original key: C major (detected by backend scanner)
Current chord: D minor (D, F, A)

1. Calculate offset: D - C = +2 semitones
2. Also adjust for scale: major clip → minor chord
   → Lower the 3rd by 1 semitone (E→F natural instead of E→F#)
   → This is advanced: for MVP, just transpose by semitone offset
   
MVP approach: pure semitone transpose
  All MIDI note-on events in clip: noteNumber += transpose
  Constrain to valid MIDI range (0-127)
  Events outside range are omitted or octave-shifted

Advanced approach: scale-aware transpose
  Detect clip's original scale degree for each note
  Map to the same degree in the target chord's scale
  Preserves melodic contour while changing harmony
```

### Transpose Type

```typescript
interface MidiClipSource {
    type: "midiClip";
    clipId: string | null;
    clipData?: ArrayBuffer;
    soundEngine: SoundEngine;
    transpose: number;              // Manual transpose (±12)
    velocityScale: number;
    followChordProgression: boolean; // ← AUTO-TRANSPOSE flag
    /** When followChordProgression is on, the resolved chord tones drive transpose */
    transposeScaleAware: boolean;   // false = semitone only, true = scale-aware
}
```

---

## LIVE MIDI SOURCE — Scale Snap Mode

When a Harmonic Module track uses `LiveMidiSource`, the engine can optionally "snap" incoming MIDI notes to the current scale. This ensures live keyboard/pad performance always stays in key.

### Scale Snap Modes

```typescript
type ScaleSnapMode = "off" | "scale" | "chordTones" | "chordTonesStrict";

// off:              Pass MIDI through unchanged
// scale:            Snap any out-of-scale note to the nearest in-scale note
// chordTones:       Only pass notes that are in the current chord's tones. 
//                   Out-of-chord notes are snapped to nearest chord tone.
// chordTonesStrict: Suppress out-of-chord notes entirely (no snap, just ignore)
```

### Snap Algorithm

```
Key: D minor, Scale: natural minor → notes: D, E, F, G, A, B♭, C
Incoming note: F# (not in scale)

scale snap:     F# is between F(5) and G(7) → snap to F (closer)
chordTones:     Current chord = Dm → tones: D(2), F(5), A(9)
                F# → snap to F (chord tone)
chordTonesStrict: F# → silent (not a chord tone, suppress)
```

---

## DIATONIC HEXAGON — Visualization

The existing `GeometricMusicCard` hexagon becomes the Harmonic Module's card face. It gains animation driven by the harmony engine:

### Hexagon States

```
┌─────────────────────────────────────┐
│         HARMONIC: "Verse Pad"       │
│                                     │
│            ii° (dimmed)             │
│           /          \              │
│      iii /            \ vii°       │
│     (dim)              (dim)        │
│         \              /            │
│     IV ──│─── I ──│── V            │
│    (lit) │  (root) │  (pulsing)     │
│         /    │      \               │
│      vi     │      (next chord)     │
│     (dim)   │                       │
│            │                        │
│   Progression: I→IV→V→I            │
│   Current: V (A7) — bar 5 of 8    │
│   Next: I (Dm) — in 1 bar         │
│                                     │
│   Key: Dm  Scale: Minor  Octave: C3 │
└─────────────────────────────────────┘
```

### Hexagon Vertex States

| Vertex | State | Visual |
|---|---|---|
| **Current chord degree** | Active | Pulsing glow, larger circle, bus color fill |
| **Next chord degree** | Anticipating | Subtle pulse, dashed outline |
| **Previous chord degree** | Trailing | Fading glow, smaller |
| **Chord tones (non-root degrees)** | Related | Slightly brighter than default |
| **Non-chord scale degrees** | Available | Default dimmed, interactive |
| **Out-of-scale degrees** | N/A — all 7 degrees are diatonic by definition | |

### Chord Timeline Mini-Map (below hexagon)

```
Progression: ┌─I─┬─I─┬─IV─┬─IV─┬─V7─┬─V7─┬─V7─┬─V7─┐
             │ Dm│ Dm│ Gm │ Gm │ A7 │ A7 │ A7 │ A7 │
             └───┴───┴────┴────┴────┴────┴────┴────┘
              ▲
              └── Current position (bar 5 of 8, step 2 of 3)

Each bar is a cell. Active chord step highlighted. Playhead moves across.
```

---

## EXPRESSION — Variation Submodule

Recalling the expression system, the Harmonic Module's expression is a **Variation**:

```typescript
interface HarmonicExpression {
    type: "variation";
    /** Override chord progression (replaces parent's progression when active) */
    chordProgressionOverride?: ChordStep[];
    /** OR: a MIDI clip that plays a melodic variation on top (layered) */
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
```

### Variation Examples

**Chord substitution variation** (behavior: replace):
```
Parent progression:  I → IV → V → I  (Dm → Gm → A7 → Dm)
Variation:           I → IV → vi → V (Dm → Gm → B♭ → A7)
→ Every 4th repeat, the progression shifts to include the vi chord
→ Hexagon updates to show the new progression
```

**Melodic layer variation** (behavior: layer):
```
Parent: chord pad plays Dm chord tones
Variation: MIDI melody clip plays on top
→ Both play simultaneously
→ Useful for: "add a lead line on the 3rd repeat"
```

---

## HARMONIC MODULE — Complete Type Definition

```typescript
interface HarmonicModuleConfig {
    // ── Harmony Engine ──
    /** Scale degrees to chord quality mapping for chord suggestions */
    scaleDegrees: ScaleDegreeMap;
    /** Auto-detect cadence type at progression end */
    detectCadence: boolean;
    /** Allow non-diatonic chords (borrowed chords from parallel key) */
    allowBorrowedChords: boolean;

    // ── Voicing Engine ──
    voicing: VoicingConfig;
    
    // ── Clip Filter ──
    clipFilter: ClipFilterConfig;
    
    // ── Scale Snap (for LiveMidiSource tracks) ──
    scaleSnapMode: ScaleSnapMode;

    // ── Visualization ──
    /** Show chord timeline mini-map below hexagon */
    showProgressionTimeline: boolean;
    /** Show note names on hexagon vertices */
    showNoteNames: boolean;
}

interface ScaleDegreeMap {
    /** For each scale degree in order (I, ii, iii, IV, V, vi, vii°), 
     *  the natural quality */
    natural: ChordQuality[];
    /** Available qualities per degree (user can override) */
    available: Record<number, ChordQuality[]>;
}

// Default for major scale:
// degree 1: [maj, maj7, dom7]  (I, Imaj7)
// degree 2: [min, min7]         (ii, ii7)
// degree 3: [min, min7]         (iii, iii7)
// degree 4: [maj, maj7]         (IV, IVmaj7)
// degree 5: [maj, dom7]         (V, V7)
// degree 6: [min, min7]         (vi, vi7)
// degree 7: [dim]               (vii°)

// Default for minor scale:
// degree 1: [min, min7]         (i, i7)
// degree 2: [dim]               (ii°)
// degree 3: [maj, maj7]         (♭III, ♭IIImaj7)
// degree 4: [min, min7]         (iv, iv7)
// degree 5: [min, dom7]         (v, V7 — harmonic minor raises 7th)
// degree 6: [maj, maj7]         (♭VI, ♭VImaj7)
// degree 7: [dim, dom7]         (♭VII, vii°7)
```

---

## Runtime Flow — What Happens When Activated

```
1. Arrangement Module sends SectionContext to Harmonic Module:
   {
     sectionId: "verse-1",
     bars: 8,
     chordProgression: [
       { degree: 1, quality: "min", duration: 2 },
       { degree: 4, quality: "min", duration: 2 },
       { degree: 5, quality: "dom7", duration: 4 }
     ]
   }

2. Harmony Engine initializes:
   • Sets progression stepper to step 0
   • Resolves first chord: Dm (D3, F3, A3)
   • Sends activeChord to Voicing Engine
   • Sends activeChord to Clip Filter
   • Sends activeChord to Hexagon visualization

3. Voicing Engine computes:
   • Strategy: "open" (pad preset)
   • Voices: D3, F3, A3, D4 (root doubled, open spacing)
   • Voice leading: n/a (first chord)

4. Clip Filter queries:
   • Mode: "keyMatch"
   • GET /api/clips?key=D&scale=minor&min_density=2&dataset=e-gmd
   • Returns 23 matching clips → displayed in browser sidebar

5. On each bar boundary:
   • Check if current step duration elapsed
   • If yes → advance stepper, resolve new chord
   • Voicing engine: smooth voice leading from previous chord
   • Clip filter: re-query if chord changed AND autoAssign is on
   • Hexagon: animate degree change

6. At progression end (bar 8):
   • Cadence detected: V7→(I) — authentic cadence if looping to step 0
   • Stepper resets to step 0
   • If section is ending → transition behavior from Arrangement Module
```

---

## EDITOR UI — Harmonic Module Settings

```
┌─ HARMONIC MODULE EDITOR ───────────────────────────────┐
│                                                         │
│  Module Name: [Verse Pad           ]                    │
│  Bus: [🔵 Harmonic ▾]    Size: [md ▾]  Color: [🟣 ▾]  │
│                                                         │
│  ┌─ TRACKS ──────────────────────────────────────────┐ │
│  │                                                    │ │
│  │  Track 1 "Pad"                                     │ │
│  │    Sound Source: [MidiClip ▾]                     │ │
│  │    Clip: [pad_sustain_abc123     ▾] [Browse]      │ │
│  │    Sound Engine: [Tone.js PolySynth ▾]            │ │
│  │    ☑ Follow Chord Progression  (auto-transpose)   │ │
│  │      ☐ Scale-aware transpose (advanced)           │ │
│  │    Transpose: [0] semitones                        │ │
│  │    Velocity: [████████░░] 80%                      │ │
│  │                                                    │ │
│  │  [+ Add Track]                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ HARMONY ─────────────────────────────────────────┐ │
│  │                                                    │ │
│  │  Scale Snap (live MIDI): [Scale ▾]                │ │
│  │  ☑ Detect cadence type                            │ │
│  │  ☐ Allow borrowed chords                          │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ VOICING ─────────────────────────────────────────┐ │
│  │                                                    │ │
│  │  Preset: [Pad ▾]                                  │ │
│  │  Strategy: [Open ▾]                               │ │
│  │  Voice count: [4]                                 │ │
│  │  Range: [C3 ▾] to [C6 ▾]                         │ │
│  │  ☑ Smooth voice leading                           │ │
│  │  ☐ Root doubling (octave below)                   │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ CLIP FILTER ─────────────────────────────────────┐ │
│  │                                                    │ │
│  │  Filter mode: [Key Match ▾]                       │ │
│  │  Density range: [2] to [8]                        │ │
│  │  Datasets: ☑ e-gmd  ☑ tegridy                    │ │
│  │  ☐ Auto-assign clips to progression steps         │ │
│  │  Match threshold: [0.6]                           │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ VARIATION (Expression) ──────────────────────────┐ │
│  │  ☑ Enable Variation                               │ │
│  │  Type: [Chord override ▾]                         │ │
│  │  Progression: [Edit in canvas chord strip]        │ │
│  │  Trigger: [Every N repeats ▾]  N: [4]            │ │
│  │  Behavior: [Replace ▾]                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  [Save as Preset]  [Cancel]  [Apply]                   │
└─────────────────────────────────────────────────────────┘
```

---

## Summary — Harmonic Engine Capabilities

| Feature | What It Does |
|---|---|
| **Progression stepper** | Advances through ChordStep[] synced to transport clock |
| **Degree → note resolution** | Maps scale degree + quality to actual MIDI note numbers using scale intervals |
| **Cadence detection** | Auto-identifies authentic/plagal/deceptive/half cadences at loop end |
| **Voicing engine** | 6 strategies (close root, inversions, open, drop2, drop3, spread) with voice leading |
| **Clip filter** | 3 modes (key match, chord tone match, progression match) with auto-assign |
| **Auto-transpose** | MidiClipSource shifts clip semitones to match active chord |
| **Scale snap** | LiveMidiSource snaps incoming notes to scale/chord tones |
| **Hexagon visualization** | 7 diatonic vertices with animated chord progression display |
| **Chord timeline mini-map** | Bar-by-bar progression view with playhead tracking |
| **Variation expression** | Chord substitution or melodic layer on conditional trigger |
| **Voicing presets** | Piano, Pad, Strings, Jazz, Bass — musical defaults for different textures |
| **Borrowed chords** | Optional non-diatonic chord support (e.g., iv in major key) |