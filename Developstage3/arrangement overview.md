## 1. ARRANGEMENT MODULE — Deep Dive

### Role

The Arrangement Module is the **conductor**. It has no audio tracks and no sound sources. It owns the timeline, controls the transport clock, dispatches section activation signals to Rhythm/Harmonic modules, and manages transitions between sections.

### Visual Card Face

```
┌──────────────────────────────────────────────────────────┐
│  🟢 ARRANGEMENT: "Main Conductor"                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  BPM: 120    4/4    Bar: 5 / 8                     │  │
│  │  ████████████░░░░░░░░░░░░░░░░░░  Beat: 3 of 4      │  │
│  │  ▶ VERSE (bars 1-8)                               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  INTRO  ▶  VERSE  ▶  CHORUS  ▶  VERSE  ▶  BRIDGE  │  │
│  │   4        8   ▲      8         8        4        │  │
│  │                 └── Now playing                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Transition: NextBar                                     │
│  Slave modules: 5 linked (3 🔴, 2 🔵)                   │
│  Expression: riser (Intro→Verse)                        │
└──────────────────────────────────────────────────────────┘
```

### Section Triggering — How It Conducts

The Arrangement Module has one primary behavior: **advance through sections and tell modules what to do at each boundary.**

```
TRANSPORT STATE MACHINE:

  STOPPED ──[Global Play]──▶ PLAYING
      ▲                          │
      │                          ├── Section advances (natural end)
      │                          ├── Section advances (MIDI/manual trigger)
      │                          ├── Loop section (if repeat enabled)
      │                          └── End of song
      │                               │
      └──[Global Stop]───────────────┘

Within PLAYING:
  Section N playing ──[section.bars elapsed]──▶ Check: next section exists?
                                                    │
                                          ┌─────────┴─────────┐
                                          │ YES                │ NO
                                          ▼                    ▼
                                   Execute transition     Loop to first
                                   (Instant/NextBar/      section OR stop
                                    Fade)                 (configurable)
                                          │
                                          ▼
                                   Section N+1 starts
```

### Transition Engine — Detailed Behavior

Three transition modes. Each defines what happens at a section boundary:

```
┌─────────────────────────────────────────────────────────────┐
│ TRANSITION: INSTANT                                         │
│                                                             │
│  Section A (bar 8, beat 4) ──▶ Section B (bar 1, beat 1)   │
│                                                             │
│  On the exact beat where Section A ends:                    │
│    1. Send DEACTIVATE to modules NOT in Section B           │
│    2. Send ACTIVATE to modules in Section B                 │
│    3. Send SectionContext (chords, etc.) to Section B mods  │
│    4. Update activeSectionId                                │
│    5. Reset bar counter to 0                                │
│                                                             │
│  Audio: Hard cut. No crossfade. No overlap.                 │
│  Use: Abrupt changes (verse→chorus in punk, EDM drops)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TRANSITION: NEXTBAR                                         │
│                                                             │
│  Section A reaches its end → waits for next bar line        │
│  (which is immediately, since the end IS a bar line)        │
│  Optionally: extends Section A by N bars (hold)             │
│                                                             │
│  Same as Instant for standard case.                         │
│  Difference: if Section A is triggered to end early          │
│  (manual skip), NEXTBAR waits for the current bar to        │
│  complete before transitioning.                             │
│                                                             │
│  Audio: Clean bar-line cut. No crossfade.                   │
│  Use: Standard musical transitions. Most common.            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TRANSITION: FADE                                            │
│                                                             │
│  Section A (last N bars) ──[crossfade]──▶ Section B         │
│                                                             │
│  Parameters:                                                │
│    • fadeBars: number of bars to overlap (default: 1)       │
│    • fadeCurve: "linear" | "equalPower" | "slowFade"       │
│                                                             │
│  Timeline (fadeBars=1):                                     │
│    Bar 7 of Section A:                                      │
│      • Section B modules receive ACTIVATE + SectionContext   │
│      • Section B modules start at 0 volume, silent          │
│    Bar 8 of Section A:                                      │
│      • Section A modules: volume ramps 1.0→0.0 over 1 bar   │
│      • Section B modules: volume ramps 0.0→1.0 over 1 bar   │
│    Bar 1 of Section B:                                      │
│      • Section A modules receive DEACTIVATE                  │
│      • Section B modules at full volume                      │
│                                                             │
│  Audio: Smooth crossfade. Both sections play simultaneously  │
│         during the overlap.                                  │
│  Use: Ambient, ballads, EDM transitions, any smooth change   │
└─────────────────────────────────────────────────────────────┘
```

### Transition Expression — The Arrangement's Expression Submodule

```
ArrangementExpression: a transition effect that fires between specific sections.

Example: "Riser" between Verse → Chorus
  • fromSection: "Verse"
  • toSection: "Chorus"  
  • clipId: "riser_sweep_xyz"
  • offsetBeats: 4  (starts 4 beats before end of Verse)
  • durationBeats: 8 (4 beats in Verse + 4 beats in Chorus = spans the boundary)
  • behavior: "layer" (plays ON TOP of both sections, doesn't replace either)

Timeline:
  Verse bar 7, beat 1: riser clip starts playing (low volume, building)
  Verse bar 8, beat 4: riser peaks, transition fires
  Chorus bar 1, beat 1: riser clip still playing, then fades out by beat 4
  
The riser plays through its own sound engine (Tone.js noise sweep or a MIDI clip).
It's mixed into the master output independently of section modules.
```

### Arrangement Module — Complete Type Definition

```typescript
interface ArrangementModuleConfig {
    // ── Section Management ──
    /** The section list (shared with SongObject.arrangement) */
    sections: SongSection[];
    /** Current active section index */
    activeSectionIndex: number;
    /** What happens at end of last section */
    endBehavior: "loop" | "stop" | "continue";
    
    // ── Transition Defaults ──
    /** Default transition type for new sections */
    defaultTransition: TransitionMode;
    /** Default fade bars (used when transition = "fade") */
    defaultFadeBars: number;
    /** Default fade curve */
    defaultFadeCurve: "linear" | "equalPower" | "slowFade";

    // ── Manual Trigger Behavior ──
    /** Allow MIDI/manual section skipping */
    allowSkip: boolean;
    /** Allow MIDI/manual section looping (repeat current) */
    allowRepeat: boolean;
    /** Quantize manual triggers to bar boundary */
    quantizeTriggers: boolean;

    // ── Section Hold (extend section past its natural end) ──
    /** If true, section holds until manually advanced */
    holdOnSectionEnd: boolean;
    
    // ── Metronome ──
    /** Audible click on beats (for recording) */
    metronomeEnabled: boolean;
    /** Metronome volume */
    metronomeVolume: number;
    /** Click sound: first beat vs subsequent beats */
    metronomeSound: "classic" | "electronic" | "sidestick";

    // ── Slave Linkage ──
    /** Modules that this arrangement controls */
    slaveModuleIds: string[];
    /** Per-section: which slave modules are active (auto-populated from SongSection.activeModules) */
    activeSlaves: Record<string, string[]>;  // sectionId → moduleId[]
}

interface TransitionState {
    type: TransitionMode;
    /** Progress through the transition (0.0 = start, 1.0 = complete) */
    progress: number;
    /** Modules currently fading out */
    fadingOut: string[];       // ModuleCard IDs
    /** Modules currently fading in */
    fadingIn: string[];        // ModuleCard IDs
    /** Transition expression active */
    expressionActive: boolean;
}
```

### MIDI Mapping for Arrangement Module

```
Base MIDI note: configurable (default 60)

Pads mapped from baseMidiNote:
  60 → Section 0 (Intro)    — Jump to section
  61 → Section 1 (Verse)
  62 → Section 2 (Chorus)
  63 → Section 3 (Bridge)
  64 → Section 4 (Outro)
  65 → Previous Section
  66 → Next Section
  67 → Toggle Global Play/Stop
  68 → Expression trigger (manual transition fill)

  CC 7 → Master Volume
  CC 30 → Tap Tempo (momentary — tap to set)
```

### Section-Level Override System

Some modules may need **per-section overrides** — for example, "the Verse Drums module plays at 80% volume in the Verse but 100% in the Chorus." Rather than creating two separate modules, the Arrangement Module supports section-level overrides:

```typescript
interface SectionModuleOverride {
    moduleId: string;
    sectionId: string;
    volume?: number;           // Override module volume for this section
    mute?: boolean;            // Force mute in this section
    transpose?: number;        // Transpose all module tracks for this section
    expressionForceTrigger?: boolean;  // Force the module's expression to fire at section start
}
```

These are stored in the Arrangement Module config, not in individual modules. The Arrangement sends them as part of the ACTIVATE signal.

---

## 2. TRANSPORT CLOCK SYSTEM

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    TRANSPORT CLOCK                        │
│                                                          │
│  Source: Internal (Web Audio clock) or External (MIDI)   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  CLOCK ENGINE (singleton)                          │  │
│  │                                                    │  │
│  │  • bpm: number (60-200)                            │  │
│  │  • timeSignature: TimeSignature                    │  │
│  │  • isPlaying: boolean                              │  │
│  │  • position: ClockPosition                         │  │
│  │  • tickResolution: number (960 ticks/beat default) │  │
│  │                                                    │  │
│  │  Methods:                                           │  │
│  │    start(), stop(), toggle(), setBpm(), tapTempo() │  │
│  │    getPosition(): ClockPosition                    │  │
│  │    scheduleBeat(offset, callback)                  │  │
│  │    scheduleBar(offset, callback)                   │  │
│  │    scheduleTick(offset, callback)                  │  │
│  │    registerSubscriber(subscriber)                  │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                  │
│          ┌────────────┼────────────┐                     │
│          ▼            ▼            ▼                     │
│   AudioWorklet   MIDI Scheduler   React UI              │
│   (process()      (setInterval(    (requestAnimation    │
│    callback)       callback)        Frame callback)     │
│   Sample-accurate  ~5ms jitter     ~16ms refresh        │
│   for audio loops  for MIDI events for visual updates   │
└──────────────────────────────────────────────────────────┘
```

### Clock Position

```typescript
interface ClockPosition {
    /** Absolute beat count since transport start */
    absoluteBeat: number;
    /** Bar within current section (0-based) */
    barInSection: number;
    /** Beat within current bar (0-based, 0 to numerator-1) */
    beatInBar: number;
    /** Subdivision tick within current beat (0 to tickResolution-1) */
    tickInBeat: number;
    /** Current section ID */
    sectionId: string;
    /** Beat within current section (0 to section.totalBeats-1) */
    beatInSection: number;
    /** Total beats elapsed in current section */
    elapsedBeatsInSection: number;
    /** Beats remaining in current section */
    remainingBeatsInSection: number;
}

// Derived: beatsPerBar = timeSignature.numerator × (4 / timeSignature.denominator)
// Derived: totalBeatsInSection = beatsPerBar × currentSection.bars
```

### Clock Source

```typescript
type ClockSource = "internal" | "midiClock";

interface InternalClockConfig {
    source: "internal";
    /** Web Audio context currentTime is the master */
    audioContext: AudioContext;
    /** Lookahead for scheduling (seconds) */
    scheduleAhead: number;      // 0.1s default — schedule events 100ms ahead
    /** How often the scheduler timer fires (seconds) */
    schedulerInterval: number;  // 0.025s default (40Hz)
}

interface MidiClockConfig {
    source: "midiClock";
    /** Which MIDI input provides clock */
    midiInputId: string;
    /** PPQN of incoming clock (typically 24) */
    incomingPpqn: number;
    /** Auto-start transport on first clock pulse */
    autoStart: boolean;
}
```

### Subscriber Pattern

Modules don't poll the clock. They register as subscribers and receive callbacks:

```typescript
interface ClockSubscriber {
    id: string;
    /** Called every scheduler tick while playing */
    onTick?: (position: ClockPosition) => void;
    /** Called when transport starts */
    onStart?: (position: ClockPosition) => void;
    /** Called when transport stops */
    onStop?: (position: ClockPosition) => void;
    /** Called at every beat boundary */
    onBeat?: (position: ClockPosition) => void;
    /** Called at every bar boundary */
    onBar?: (position: ClockPosition) => void;
    /** Called when BPM changes */
    onBpmChange?: (bpm: number) => void;
    /** Called when time signature changes */
    onTimeSignatureChange?: (ts: TimeSignature) => void;
}

// Example: Rhythm Module registers:
clockEngine.registerSubscriber({
    id: "rhythm-module-verse-drums",
    onBar: (pos) => {
        // Fire expression fill trigger if conditions met
    },
    onStart: (pos) => {
        // Start all module track playback
    },
    onStop: (pos) => {
        // Stop all module track playback
    }
});
```

### AudioWorklet Clock Sync

The AudioWorklet processor needs beat information for sample-accurate loop scheduling. The main thread sends clock updates via `postMessage`:

```typescript
// Main thread → Worklet (every scheduler tick, ~40Hz):
workletNode.port.postMessage({
    type: "clock_update",
    beat: position.beatInBar,
    bar: position.barInSection,
    bpm: clock.bpm,
    isPlaying: clock.isPlaying,
    // Schedule-ahead: this message is for events 100ms in the future
    targetTime: audioContext.currentTime + scheduleAhead
});

// Worklet processor uses this to:
// • Start/stop loop playback at exact sample boundaries
// • Fire quantized actions (record on next beat)
// • Track loop position within the bar
```

### Quantization & Timing

All module actions that use `timing: "nextBeat" | "nextBar"` are scheduled through the clock:

```typescript
// When a module emits a LooperAction with timing: "nextBar":
{
    command: "record",
    target: "track:verse-drums:0",
    timing: "nextBar"
}

// The action dispatcher calls:
clockEngine.scheduleBar(1, () => {
    // Execute the action at the start of the next bar
    looperEngine.toggleRecord(0);
});
```

---

## 3. MIDI ROUTING SYSTEM

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MIDI ROUTER                           │
│                                                          │
│  Hardware MIDI Input (WebMIDI)                           │
│         │                                                │
│         ▼                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  MIDI ROUTER (singleton)                           │  │
│  │                                                    │  │
│  │  • deviceId: string | null                         │  │
│  │  • channelFilter: number | null                    │  │
│  │  • bindings: MidiBinding[]                          │  │
│  │  • learnMode: boolean                              │  │
│  │  • learnTarget: string | null                       │  │
│  │                                                    │  │
│  │  onMidiEvent(event: MidiInputEvent): void          │  │
│  │  registerBinding(binding): void                    │  │
│  │  generateAutoBindings(modules): MidiBinding[]      │  │
│  │                                                      │  │
│  │  Dispatch paths:                                     │  │
│  │    Note On → check bindings → found?                │  │
│  │      YES → dispatch LooperAction                     │  │
│  │      NO  → check LiveMidiSource tracks              │  │
│  │               → pass through if channel matches      │  │
│  │    CC     → check bindings → found?                 │  │
│  │      YES → dispatch ParamChange                      │  │
│  │      NO  → ignore                                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Auto-Mapping Algorithm

When modules are added or modified, the router auto-generates bindings. No user setup required:

```typescript
function generateAutoBindings(modules: ModuleCard[]): MidiBinding[] {
    const bindings: MidiBinding[] = [];
    
    for (const module of modules) {
        // Track bindings
        for (const track of module.tracks) {
            bindings.push({
                id: generateId(),
                trigger: {
                    type: "noteOn",
                    note: track.midiNote,
                    channel: null,  // Any channel
                    velocityMin: 1
                },
                target: `track:${module.id}:${track.index}`,
                actions: generateTrackActions(module, track),
                moduleId: module.id,
                autoGenerated: true
            });
        }
        
        // Expression trigger binding
        if (module.expression?.enabled) {
            const exprNote = module.baseMidiNote + module.tracks.length;
            bindings.push({
                id: generateId(),
                trigger: {
                    type: "noteOn",
                    note: exprNote,
                    channel: null,
                    velocityMin: 1
                },
                target: `expression:${module.id}`,
                actions: [{ command: "triggerExpression" }],
                moduleId: module.id,
                autoGenerated: true
            });
        }
    }
    
    // Arrangement module section triggers
    const arrModule = modules.find(m => m.type === "arrangement");
    if (arrModule) {
        for (let i = 0; i < 8; i++) {
            bindings.push({
                id: generateId(),
                trigger: {
                    type: "noteOn",
                    note: arrModule.baseMidiNote + i,
                    channel: null,
                    velocityMin: 1
                },
                target: "arrangement",
                actions: [{ command: i < 6 ? "jumpSection" : "nextSection", 
                            sectionIndex: i < 6 ? i : undefined }],
                moduleId: arrModule.id,
                autoGenerated: true
            });
        }
    }
    
    return bindings;
}
```

### MidiBinding Type

```typescript
interface MidiBinding {
    id: string;
    /** What MIDI event triggers this binding */
    trigger: MidiTrigger;
    /** What this binding controls */
    target: string;            // "track:moduleId:trackIndex" | "expression:moduleId" | "arrangement" | "master"
    /** Actions to execute */
    actions: MidiAction[];
    /** Which module this belongs to */
    moduleId: string;
    /** Auto-generated or user-created */
    autoGenerated: boolean;
    /** User-assigned label */
    label?: string;
}

interface MidiTrigger {
    type: "noteOn" | "noteOff" | "cc" | "programChange" | "pitchBend";
    note?: number;             // For noteOn/noteOff
    ccNumber?: number;         // For CC
    channel: number | null;    // null = any channel
    velocityMin?: number;      // Minimum velocity to trigger
    velocityMax?: number;      // Maximum velocity to trigger
}

interface MidiAction {
    command: string;           // "record", "play", "stop", "mute", "solo", "clear",
                               // "triggerExpression", "jumpSection", "nextSection",
                               // "setVolume", "setPan", "globalPlay", "globalStop"
    param?: ParamChange;       // For CC-based parameter changes
    /** Optional direct parameters */
    sectionIndex?: number;
}
```

### MIDI Learn Flow

1. User clicks "Learn" button on any MIDI-assignable control
2. Router enters learn mode: `learnTarget = "track:verse-drums:0"`
3. Next incoming MIDI event is captured
4. Binding is created/updated for that note/CC → target
5. Learn mode exits
6. Auto-generated binding is overridden (marked `autoGenerated: false`)

### LiveMidiSource Pass-through

When a MIDI event doesn't match any binding, the router checks if any module has a `LiveMidiSource` track on the matching channel:

```typescript
function routeUnboundMidi(event: MidiInputEvent, modules: ModuleCard[]): void {
    for (const module of modules) {
        for (const track of module.tracks) {
            if (track.soundSource.type === "liveMidi") {
                const source = track.soundSource as LiveMidiSource;
                if (source.midiChannel === event.channel || source.midiChannel === 0) {
                    // Apply scale snap if enabled
                    const processedEvent = applyScaleSnap(event, module, track);
                    // Route to the sound engine
                    routeToSoundEngine(processedEvent, source.soundEngine);
                }
            }
        }
    }
}
```

---

## 4. ZUSTAND STORE DESIGN

### Store Shape

```typescript
interface LooperStore {
    // ═══════════════════════════════════════
    // SONG DATA (persisted to SongObject JSON)
    // ═══════════════════════════════════════
    
    song: SongObject;
    
    // ═══════════════════════════════════════
    // TRANSPORT STATE
    // ═══════════════════════════════════════
    
    transport: {
        isPlaying: boolean;
        isRecording: boolean;
        position: ClockPosition;
        activeSectionId: string | null;
        activeSectionIndex: number;
    };
    
    // ═══════════════════════════════════════
    // ENGINE REFERENCES (non-serialized)
    // ═══════════════════════════════════════
    
    engines: {
        audioContext: AudioContext | null;
        looperEngine: LooperEngine | null;
        clockEngine: TransportClock | null;
        midiRouter: MidiRouter | null;
        initialized: boolean;
    };
    
    // ═══════════════════════════════════════
    // UI STATE
    // ═══════════════════════════════════════
    
    ui: {
        activeModal: ModalDialog;
        activeEditorPanel: EditorPanel;
        editingModuleId: string | null;
        editingTrackIndex: number | null;
        clipBrowserOpen: boolean;
        sidebarVisible: boolean;
        canvasView: CanvasViewState;
        midiLearnTarget: string | null;
        midiActivity: boolean;          // Blinking MIDI indicator
        midiDeviceConnected: boolean;
        audioInitialized: boolean;
    };
    
    // ═══════════════════════════════════════
    // MODULE RUNTIME STATE (derived from song + transport)
    // ═══════════════════════════════════════
    
    moduleStates: Record<string, ModuleRuntimeState>;
    
    // ═══════════════════════════════════════
    // CLIP BROWSER STATE
    // ═══════════════════════════════════════
    
    clipBrowser: {
        filters: ClipBrowserFilters;
        results: ClipSearchResult | null;
        loading: boolean;
        error: string | null;
        activePreviewId: string | null;
    };
}
```

### Module Runtime State

```typescript
interface ModuleRuntimeState {
    moduleId: string;
    /** Is this module currently active (in the current section)? */
    isActive: boolean;
    /** Per-track runtime state */
    tracks: TrackRuntimeState[];
    /** Current harmony state (Harmonic modules only) */
    harmony?: HarmonyRuntimeState;
    /** Expression state */
    expression?: ExpressionRuntimeState;
    /** Loop repeat counter */
    repeatCount: number;
    /** Module volume after section overrides */
    effectiveVolume: number;
    /** Is module muted by section override? */
    isSectionMuted: boolean;
}

interface TrackRuntimeState {
    trackIndex: number;
    state: TrackState;           // "empty" | "recording" | "playing" | "muted" | "soloed"
    volume: number;
    pan: number;
    /** For MidiClipSource with followChordProgression: current transpose offset */
    activeTranspose: number;
    /** Meters: current audio level (0.0-1.0) — for VU visualization */
    levelLeft: number;
    levelRight: number;
}

interface HarmonyRuntimeState {
    progression: ChordStep[];
    currentStepIndex: number;
    activeChord: ResolvedChord;
    previousChord: ResolvedChord | null;
    beatsInStep: number;
    beatsUntilNext: number;
    cadenceType: string;
}

interface ExpressionRuntimeState {
    isActive: boolean;
    remainingBeats: number;
    nextTriggerRepeat: number;   // How many repeats until next expression fire
}
```

### Store Actions

```typescript
// ═══════════════════════════════════════
// SONG ACTIONS
// ═══════════════════════════════════════

addModule(preset: ModulePreset): string;              // Returns new module ID
removeModule(moduleId: string): void;
updateModule(moduleId: string, updates: Partial<ModuleCard>): void;
moveModule(moduleId: string, newIndex: number): void;
addSection(afterIndex?: number): string;
removeSection(sectionId: string): void;
updateSection(sectionId: string, updates: Partial<SongSection>): void;
moveSection(sectionId: string, newIndex: number): void;
setChordStep(sectionId: string, barIndex: number, chord: ChordStep): void;
addSectionMarker(sectionId: string, marker: SectionMarker): void;
removeSectionMarker(sectionId: string, markerIndex: number): void;
setSongMetadata(updates: Partial<SongMetadata>): void;

// ═══════════════════════════════════════
// TRACK ACTIONS
// ═══════════════════════════════════════

updateTrack(moduleId: string, trackIndex: number, updates: Partial<ModuleTrackConfig>): void;
assignClipToTrack(moduleId: string, trackIndex: number, clipId: string): void;
setSoundSource(moduleId: string, trackIndex: number, source: SoundSource): void;
setSoundEngine(moduleId: string, trackIndex: number, engine: SoundEngine): void;

// ═══════════════════════════════════════
// TRANSPORT ACTIONS
// ═══════════════════════════════════════

globalPlay(): void;
globalStop(): void;
globalRecord(): void;
setBpm(bpm: number): void;
tapTempo(): void;
nudgeBpm(delta: number): void;
jumpToSection(sectionId: string): void;
nextSection(): void;
previousSection(): void;
setTransitionMode(mode: TransitionMode): void;

// ═══════════════════════════════════════
// ENGINE ACTIONS
// ═══════════════════════════════════════

initializeEngines(): Promise<void>;
suspendEngines(): void;
resumeEngines(): void;

// ═══════════════════════════════════════
// UI ACTIONS
// ═══════════════════════════════════════

setModal(modal: ModalDialog): void;
closeModal(): void;
setEditorPanel(panel: EditorPanel, moduleId?: string, trackIndex?: number): void;
closeEditor(): void;
setCanvasView(view: Partial<CanvasViewState>): void;
setMidiLearnTarget(target: string | null): void;
toggleClipBrowser(): void;

// ═══════════════════════════════════════
// FILE ACTIONS
// ═══════════════════════════════════════

newSong(metadata: SongMetadata): void;
saveSong(): SongObject;
loadSong(song: SongObject): void;
exportSong(): void;

// ═══════════════════════════════════════
// PRESET ACTIONS
// ═══════════════════════════════════════

saveModulePreset(moduleId: string, name: string, description: string): void;
loadModulePreset(presetId: string): ModuleCard;
deleteUserPreset(presetId: string): void;
```

### Selectors (Derived State)

```typescript
// Computed from store state — not stored, calculated on read

const selectors = {
    // Get all modules of a specific type
    modulesByType: (type: ModuleType) => 
        store.song.modules.filter(m => m.type === type),
    
    // Get modules active in current section
    activeModules: () => 
        store.song.modules.filter(m => 
            store.song.arrangement[store.transport.activeSectionIndex]
                ?.activeModules.includes(m.id)
        ),
    
    // Get the current section
    currentSection: () => 
        store.song.arrangement[store.transport.activeSectionIndex],
    
    // Get current chord (for Harmonic modules)
    currentChord: (moduleId: string) => 
        store.moduleStates[moduleId]?.harmony?.activeChord,
    
    // Get all MIDI bindings (auto-generated)
    allBindings: () => 
        store.engines.midiRouter?.bindings ?? [],
    
    // Get expression state for a module
    expressionState: (moduleId: string) =>
        store.moduleStates[moduleId]?.expression,
    
    // Is transport in a transition?
    isTransitioning: () =>
        store.transport.position.remainingBeatsInSection <= 
        (store.currentSection()?.transition === "fade" ? 
            store.song.modules.find(m => m.type === "arrangement")?.fadeBars : 0),
    
    // Get effective module volume (after section overrides)
    effectiveModuleVolume: (moduleId: string) =>
        store.moduleStates[moduleId]?.effectiveVolume ?? 1.0,
};
```

### Store Initialization Flow

```
1. App mounts
2. Store initializes with default empty song
3. User clicks "Initialize Audio" → store.initializeEngines()
   a. Create AudioContext (user gesture required)
   b. Load AudioWorklet processor
   c. Create LooperEngine instance
   d. Create TransportClock instance
   e. Create MidiRouter instance
   f. Request MIDI access (navigator.requestMIDIAccess())
   g. Auto-generate MIDI bindings from modules
   h. Register all modules as clock subscribers
   i. Set store.engines.initialized = true
4. User adds modules, builds arrangement
5. User hits Play → store.globalPlay()
   a. TransportClock.start()
   b. Clock subscribers fire onStart → modules begin playback
6. Transport advances → clock subscribers fire onBar → arrangement checks section boundaries
7. Section ends → transition logic → modules deactivate/activate
```

### Data Flow Summary

```
User Action (UI click, MIDI pad, keyboard shortcut)
        │
        ▼
Store Action (e.g., globalPlay(), setBpm(), assignClipToTrack())
        │
        ├──▶ Updates store state (song, transport, ui, etc.)
        │
        ├──▶ If engine action:
        │       ├── TransportClock.start() / setBpm()
        │       ├── LooperEngine.toggleRecord() / setVolume()
        │       └── MidiRouter.dispatchAction()
        │
        └──▶ React re-renders components subscribed to changed state
                │
                ▼
        UI updates: playhead moves, LEDs change, hexagon animates, etc.
```

---

## Summary — Four Topics Defined

| Topic | Status | Key Deliverable |
|---|---|---|
| Arrangement Module | ✅ Complete | Section state machine, transition engine (3 modes), slave linkage, per-section overrides, MIDI mapping, expression transitions, visual card face |
| Transport Clock | ✅ Complete | Clock engine singleton, position model, subscriber pattern, AudioWorklet sync, quantization scheduling, internal + MIDI clock sources |
| MIDI Routing | ✅ Complete | Auto-mapping algorithm, MidiBinding model, learn mode, LiveMidiSource pass-through, routing dispatch flow |
| Zustand Store | ✅ Complete | Store shape (5 domains), 50+ actions, selectors, initialization flow, data flow diagram |

Ready for the next topic or to compile the grand overview. Would you like me to address any of the Tier 2/3 topics next (AudioWorklet integration, SongObject schema, Presets, iPad UX, Error handling) or proceed to assembling the grand overview document?
