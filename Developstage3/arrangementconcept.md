## Arrangement Module Owns the Timeline — Modules Respond to It

The answer is: **all timeline events, regions, sections, and markers live in the Arrangement Module's `SongSection[]` array.** Rhythm and Harmonic modules do not carry their own timeline data. They carry **what they do when activated**, not **when they are active.** The Arrangement Module tells them when.

---

## The Data Flow

```
SONGOBJECT
│
├── modules: ModuleCard[]
│     ├── Rhythm Module "Verse Drums"
│     │     └── Contains: tracks, sound sources, loop config, expression
│     │     └── Does NOT contain: "I play from bar 1 to bar 16"
│     │
│     └── Harmonic Module "Chorus Pad"
│           └── Contains: tracks, sound engine, chord progression attachment
│           └── Does NOT contain: "I play during the Chorus"
│
└── arrangement: SongSection[]   ← THE TIMELINE
      │
      ├── SongSection "Intro" (4 bars)
      │     └── activeModules: ["verse-drums-id", "intro-pad-id"]
      │           ↑
      │           These modules are told to play during this section
      │
      ├── SongSection "Verse" (16 bars)
      │     ├── activeModules: ["verse-drums-id", "verse-pad-id", "bass-id"]
      │     ├── chordProgression: [I→IV→V→I]
      │     └── transition: "nextBar"
      │
      └── SongSection "Chorus" (8 bars)
            ├── activeModules: ["chorus-drums-id", "chorus-pad-id"]
            └── transition: "instant"

THE ARRANGEMENT MODULE:
  1. Reads arrangement[]
  2. Plays sections in order (or jumps on MIDI trigger)
  3. At each section boundary:
     → Sends ACTIVATE signal to modules in activeModules[]
     → Sends DEACTIVATE signal to modules NOT in activeModules[]
     → Sends chordProgression to any Harmonic module in activeModules[]
  4. Counts bars/beats within each section
  5. Triggers section transitions (instant, nextBar, fade)
```

---

## What Modules Need to Know About Sections

Modules don't need their own timeline, but they do need **one piece of context** from the current section:

### Rhythm Module needs:
```
Received from Arrangement when activated:
  • Current section's time signature (if different from global)
  • Current section's bar count (so the module knows when the section ends — for expression fill triggers that fire N bars before the end)
  • Module plays its loop for the duration of the section
```

### Harmonic Module needs:
```
Received from Arrangement when activated:
  • Current section's chordProgression (if the module's followChordProgression is enabled)
  • Module follows those chords for the section duration
  • If section has no chordProgression → module plays at its root key
```

### Arrangement Module holds:
```
Its own data:
  • Full section list (ordered)
  • Per-section: name, bars, transition, activeModules[], chordProgression[]
  • Current position: which section, which bar, which beat
  • Expression transitions: which AudioClip plays between sections
```

---

## This Eliminates Redundancy

If modules carried their own timeline data, every time you moved a section boundary you'd have to update every module. Instead:

```
To change Verse from 16 bars to 12 bars:
  → Edit ONE field: arrangement[1].bars = 12
  → All modules adapt because Arrangement sends DEACTIVATE at bar 12 instead of bar 16
  → Zero module edits needed
```

```
To add a new module to the Verse:
  → Add module.id to arrangement[1].activeModules
  → Module auto-activates when Verse starts
  → Zero module timeline edits needed
```

---

## The Module's Internal Clock vs. The Arrangement Clock

There's a distinction between two clocks:

| Clock | Owner | What It Tracks |
|---|---|---|
| **Section clock** | Arrangement Module | Current bar within section (0 to section.bars-1), section transitions |
| **Loop clock** | Rhythm/Harmonic Module | Beat position within its own loop (0 to loop.totalBeats-1), expression triggers (every N repeats) |

The module's loop clock is **independent of the section clock**. A 4-bar drum loop might play 3 full times within a 12-bar section. The module doesn't know or care that it's in bar 7 of the Verse — it only knows it's on repeat #2, beat 3 of its 4-bar loop. The module's expression trigger ("fire fill on repeat #3") works against the loop clock, not the section clock.

The Arrangement Module is the only thing that cares about section boundaries. When a section ends, it tells modules to stop (or transition), regardless of where they are in their internal loops.

---

## Updated Type: What Modules Receive from Arrangement

Modules don't store section data. They receive it as a runtime context object when activated:

```typescript
// Sent by Arrangement Module to each activated module at section start
interface SectionContext {
    sectionId: string;
    sectionName: string;          // "Verse", "Chorus", etc.
    bars: number;                 // Total bars in this section
    timeSignature: TimeSignature; // Section time sig (may differ from global)
    chordProgression?: ChordStep[]; // For Harmonic modules
    transition: TransitionMode;   // How this section will end
}
```

This is NOT stored in the SongObject or ModuleCard. It's a runtime message from Arrangement → Module via the Zustand store or an event bus.

---

## Updated SongSection — Still the Timeline Hub

```typescript
interface SongSection {
    id: string;
    name: string;
    bars: number;
    transition: TransitionMode;
    chordProgression: ChordStep[];
    activeModules: string[];      // ModuleCard IDs active in this section
    
    // NEW: optional markers/regions within the section
    markers?: SectionMarker[];
}

interface SectionMarker {
    beat: number;                 // Beat offset from section start
    label: string;                // "Fill here", "Drop", "Solo start"
    type: "cue" | "loopPoint" | "expressionTrigger";
    /** Optional: which module this marker targets */
    targetModuleId?: string;
}
```

Markers are optional annotations within a section. They can trigger expression fills, cue changes, or mark loop points. But they live in the section, not in individual modules.

---

## Summary

| Data | Stored In | Why |
|---|---|---|
| Section order, names, bar counts | `SongObject.arrangement[]` | Single source of truth |
| Which modules play in which section | `SongSection.activeModules[]` | The section declares its ensemble |
| Chord progressions | `SongSection.chordProgression[]` | Chords belong to sections, not modules |
| Transition type between sections | `SongSection.transition` | Section-level property |
| Expression triggers (fills, variations) | `ModuleCard.expression.trigger` | Module-internal loop timing |
| Module loop length, time sig, tracks | `ModuleCard` | Module identity and behavior |
| Runtime section context | Not stored — sent at activation | Transient, derived from SongSection |

**The rule: Sections say WHEN and WITH WHOM. Modules say WHAT and HOW.**