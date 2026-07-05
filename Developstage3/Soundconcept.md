## The Sound Source Question — The Missing Architectural Layer

You've hit the exact gap. The modules currently have actions (Record, Play, Mute) but no defined **sound source** — no answer to "what is making the noise when a module plays?" The current codebase has conflicting signals:

| What Exists | What It Does | Implied Sound Source |
|---|---|---|
| `audio-worklet.ts` + `looper-processor.js` | Records Float32 audio from mic/input, loops it back | **Audio input → Audio output** (live recording) |
| `audio-preview.ts` | Parses MIDI files, plays through Tone.js PolySynth | **MIDI file → Internal synth** |
| `ClipBrowser` + backend | Browses MIDI dataset files (e-gmd, Tegridy) | **MIDI files** (played how?) |
| `handleMidiCommand()` | Routes MIDI note 36-43 to track record-toggle | **MIDI input** (from hardware controller, but what does it trigger?) |

These are three different paradigms that haven't been reconciled. The module system forces the question: **what is a "track" actually playing?**

---

## The Three Possible Architectures

### OPTION A: Audio-Only (current AudioWorklet path)
```
Module Track → AudioWorklet → records mic/line-in → plays Float32 buffer → speakers
```
- **Pro:** Already built. The AudioWorklet engine works.
- **Con:** No MIDI clip support. No external synth routing. Every sound must be recorded live. The clip browser's MIDI dataset becomes useless.
- **Verdict:** Too limiting. The MIDI dataset is a core differentiator.

### OPTION B: MIDI-Only (simplified)
```
Module Track → MIDI events → Sound Source → Audio → speakers
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
               MIDI Out      Internal       Internal
               (hardware)    Sampler         Synth
                            (audio clips)  (Tone.js)
```
- **Pro:** Clean separation. Modules sequence/record MIDI. Sound sources are pluggable.
- **Con:** Requires building a sampler engine, a synth host, and MIDI output routing. The existing AudioWorklet audio looper gets sidelined.
- **Verdict:** Architecturally clean but abandons working code.

### OPTION C: Hybrid — Sound Source per Track (recommended)
```
Module Track ─── has a ───▶ SoundSource (type discriminant)
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
               AudioInput   MidiClip    LiveMidi
               (mic/line)   (dataset)   (controller)
                    │           │           │
                    ▼           ▼           ▼
               AudioWorklet  Tone.js    MidiOut or
               looper        PolySynth  Internal Synth
               (exists)      (exists)   (new)
```
- **Pro:** Uses existing code (AudioWorklet for audio, Tone.js for MIDI preview). Each module track declares its sound source type. Rhythm Module tracks might use AudioInput (live drums) or MidiClip (dataset drum patterns). Harmonic Module tracks use MidiClip (dataset melodies) or LiveMidi (keyboard input).
- **Con:** More complex type system. But complexity is in the right place — the sound source abstraction.
- **Verdict:** This is the architecture that makes the module system coherent.

---

## Sound Source Types — Defined

```typescript
type SoundSourceType = "audioInput" | "midiClip" | "liveMidi";

// A track records from the microphone/line-in.
// Audio loops stored as Float32Array buffers in the AudioWorklet.
// Actions: Record, Play, Overdub, Clear, Reverse, Multiply, Divide
// Applies to: Rhythm Module (live drums, percussion), Harmonic Module (live instrument)
interface AudioInputSource {
    type: "audioInput";
    inputChannel: number;       // Which audio input channel (0 = mic, 1 = line-in)
    monitorEnabled: boolean;    // Pass-through monitoring while recording
}

// A track plays a MIDI clip from the dataset or user library.
// MIDI data is rendered through a sound engine to produce audio.
// Actions: Play, Stop, Mute, Solo (no recording — the clip is pre-made)
// Applies to: Rhythm Module (drum patterns), Harmonic Module (melody loops)
interface MidiClipSource {
    type: "midiClip";
    clipId: string | null;      // References backend clip ID, or null = empty slot
    clipData?: ArrayBuffer;     // Cached raw MIDI binary (loaded on assignment)
    soundEngine: SoundEngine;   // What renders the MIDI to audio
    transpose: number;          // Semitone transpose (±12)
    velocityScale: number;      // 0.0-1.0 velocity multiplier
}

// A track receives live MIDI from a controller and routes it to a sound engine.
// MIDI events pass through in real-time; optionally recorded as a MIDI sequence.
// Actions: (pass-through, no traditional looper actions — or: Record MIDI sequence)
// Applies to: Harmonic Module (keyboard performance), Rhythm Module (pad performance)
interface LiveMidiSource {
    type: "liveMidi";
    midiChannel: number;        // MIDI channel to listen on (1-16)
    soundEngine: SoundEngine;   // What renders incoming MIDI to audio
    recordMidi: boolean;        // Record incoming MIDI as a sequence
    recordedSequence?: MidiEvent[];  // Recorded MIDI for loop playback
}

// Union type for a track's sound source
type SoundSource = AudioInputSource | MidiClipSource | LiveMidiSource;
```

---

## Sound Engines — What Renders MIDI to Audio

When a sound source is `midiClip` or `liveMidi`, something must turn MIDI events into sound:

```typescript
type SoundEngineType = "tonejsPolySynth" | "sampler" | "midiOut";

// Tone.js PolySynth (already exists in audio-preview.ts)
// Built-in: 8-voice triangle wave with envelope.
// Zero setup, works everywhere. Default for presets.
interface ToneJsPolySynthEngine {
    type: "tonejsPolySynth";
    synthConfig?: {
        oscillatorType: "triangle" | "sine" | "square" | "sawtooth";
        attack: number;     // seconds
        decay: number;
        sustain: number;    // 0.0-1.0
        release: number;    // seconds
    };
}

// Sampler — triggers audio samples via MIDI notes.
// For: drum kits (one sample per note), multi-sampled instruments.
// NOT built yet. Future feature.
interface SamplerEngine {
    type: "sampler";
    sampleMap: Record<number, string>;  // MIDI note → sample URL or buffer ID
    rootNote: number;                   // MIDI note for untransposed playback
}

// MIDI Out — sends MIDI to external hardware/DAW.
// No internal audio generation. The external device makes sound.
// For: advanced users with hardware synths.
interface MidiOutEngine {
    type: "midiOut";
    outputDeviceId: string;
    outputChannel: number;  // 1-16
}

type SoundEngine = ToneJsPolySynthEngine | SamplerEngine | MidiOutEngine;
```

---

## How This Reshapes the Module Types

### Rhythm Module — with Sound Sources

```
Module: "Verse Drums" (Rhythm, Red bus)

Track 1 "Kick"
  └── SoundSource: MidiClipSource
        clipId: "egmd_abc123"  ← from backend dataset
        soundEngine: SamplerEngine  ← drum sample per note
        transpose: 0

Track 2 "Snare"
  └── SoundSource: AudioInputSource  ← live snare mic
        inputChannel: 1
        monitorEnabled: true

Track 3 "Hat"
  └── SoundSource: MidiClipSource
        clipId: "egmd_def456"
        soundEngine: ToneJsPolySynthEngine  ← synthesized hat

Track 4 "Perc"
  └── SoundSource: LiveMidiSource  ← pad controller
        midiChannel: 10
        soundEngine: SamplerEngine
        recordMidi: true  ← record performance as MIDI sequence
```

**This is the power of the hybrid model:** a single Rhythm Module blends pre-made MIDI clips (from the dataset), live audio recording (from a mic), and live MIDI performance (from a controller). The user doesn't configure the routing — they pick a sound source type per track. Presets provide sensible defaults.

### Harmonic Module — with Sound Sources

```
Module: "Chorus Pad" (Harmonic, Blue bus)

Track 1 "Pad"
  └── SoundSource: MidiClipSource
        clipId: "tegridy_xyz789"
        soundEngine: ToneJsPolySynthEngine
        transpose: 0
        → Follows chord progression: auto-transposes to match active ChordStep

Track 2 "Lead" (if expanded to 2 tracks)
  └── SoundSource: LiveMidiSource
        midiChannel: 1
        soundEngine: MidiOutEngine  ← sends to external synth
        recordMidi: true
```

### Arrangement Module — unchanged (no sound sources)

The Arrangement Module is a conductor. It has no tracks and no sound sources. It controls sections, transitions, and global transport.

---

## What This Means for the AudioWorklet

The existing `audio-worklet.ts` is designed for audio recording/playback. In the hybrid model:

- **AudioInputSource tracks** use the AudioWorklet looper as-is. Record Float32, loop playback. No changes needed to the worklet processor.
- **MidiClipSource tracks** bypass the AudioWorklet. They use Tone.js (or a sampler, or MIDI Out) driven by a MIDI scheduler that syncs to the transport clock.
- **LiveMidiSource tracks** are passthrough: MIDI in → Sound Engine → Audio out. When `recordMidi: true`, MIDI events are captured to a buffer and can be looped back.

**The AudioWorklet becomes one engine option, not the only engine.** The module system needs a transport clock that both the AudioWorklet looper and the MIDI scheduler sync to.

---

## Transport Clock — The Unifying Timebase

Both audio loops and MIDI clips need to stay in sync. This requires a shared clock:

```typescript
interface TransportClock {
    bpm: number;
    timeSignature: TimeSignature;
    isPlaying: boolean;
    currentBeat: number;       // 0-based, advances per beat
    currentBar: number;        // 0-based, advances per bar
    currentTick: number;       // Subdivision tick (for quantization)

    // Called by AudioWorklet on each process() cycle
    // Called by MIDI scheduler on each animation frame or setInterval
    advance(deltaTimeMs: number): void;
    
    // Schedule an action at a future beat/bar
    scheduleAt(beat: number, callback: () => void): void;
}
```

The `MasterArrangerConductor` component already has the BPM slider and time signature UI. This gets wired to a real `TransportClock` instance that both engines follow.

---

## Revised Module Track Type (with sound source)

```typescript
interface ModuleTrackConfig {
    index: number;
    label: string;                    // "Kick", "Pad", etc.
    midiNote: number;                 // Auto-assigned from module base + index
    pan: number;                      // -1.0 to 1.0
    volume: number;                   // 0.0 to 1.0
    volumeRampMs: number;             // 5 | 20 | 100 | 500
    loopBehavior: LoopBehavior;
    muteGroup?: string;
    actions: ModuleActionRef[];       // Which actions this track responds to
    
    // THE NEW LAYER:
    soundSource: SoundSource;         // ← discriminates AudioInput | MidiClip | LiveMidi
}
```

---

## Clip Browser Integration — How Clips Get Assigned

The `ClipBrowser` currently lets users browse and preview MIDI clips. With sound sources:

1. User opens ClipBrowser (sidebar or overlay)
2. Filters by key, scale, density, dataset — optionally auto-filtered by active Harmonic Module's chord
3. Hovers a clip → Tone.js preview plays (already works)
4. **NEW:** "Assign to Track" button → sets `MidiClipSource.clipId` on the selected module track
5. The clip's MIDI data loads and is rendered by the track's `soundEngine`

For `AudioInputSource` tracks, the ClipBrowser is irrelevant (you can't assign a MIDI clip to an audio track). For `LiveMidiSource` tracks, the ClipBrowser is also irrelevant (they receive live MIDI).

---

## User-Onboarding Flow — How a New User Gets Sound

```
1. Open app
2. "Add Module" → pick "Rhythm Module — 4 tracks" preset
3. Module appears with 4 tracks, each defaulting to MidiClipSource + ToneJsPolySynth
4. Each track shows "Empty — tap to assign clip"
5. User taps Track 1 → ClipBrowser opens, filtered to drum clips
6. User picks a kick pattern → clip assigned → plays on loop
7. User taps Track 2 → picks a snare pattern → plays in sync
8. 30 seconds. Sound is happening.

Advanced path:
9. User opens Module Editor → changes Track 3 from MidiClip to AudioInput
10. Track 3 now shows "Mic — tap to record"
11. User records live hi-hat → loops alongside MIDI kick and snare
```

**This is the zero-setup promise, delivered.** Presets use Tone.js PolySynth (zero config) + empty MidiClip slots. Sound happens by picking clips from the dataset. Advanced users switch sound sources to audio input, sampler, or MIDI out.

---

## What This Does to the Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                      MODULE CARD                           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  TRACK 1 ──▶ SoundSource: MidiClip + ToneJsSynth     │ │
│  │  TRACK 2 ──▶ SoundSource: AudioInput → AudioWorklet  │ │
│  │  TRACK 3 ──▶ SoundSource: LiveMidi + Sampler         │ │
│  │  TRACK 4 ──▶ SoundSource: MidiClip + MidiOut         │ │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                  │
│            ┌────────────┼────────────┐                    │
│            ▼            ▼            ▼                    │
│     AudioWorklet    Tone.js      MIDI Output              │
│     (audio loop)    (synth)      (hardware)               │
│            │            │            │                    │
│            └────────────┼────────────┘                    │
│                         ▼                                  │
│                   Master Gain → Speakers                  │
└────────────────────────────────────────────────────────────┘
```

---

## Summary: What Changes from Previous Plan

| Previous Plan | Revised with Sound Sources |
|---|---|
| Modules had actions but no concept of sound origin | Every track has a `SoundSource` discriminator |
| AudioWorklet was the only engine | AudioWorklet is one of three engine paths |
| ClipBrowser just previewed clips | ClipBrowser assigns clips to MidiClipSource tracks |
| MIDI from controllers triggered track actions | MIDI can also be a LiveMidiSource (passthrough to synth) |
| No external gear support | MidiOutEngine routes to hardware |
| 3 sound engines to build (later) | Tone.js exists now. Sampler + MidiOut are P2. |

**The domain types now need `SoundSource`, `SoundEngine`, and their variants added.** This is the foundation the entire module system rests on. Should I draft the complete revised type definitions incorporating sound sources?