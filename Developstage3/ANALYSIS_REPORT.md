# Architecture & Implementation Analysis Report

**Date:** 2026-07-05
**Scope:** Developstage3 concept documents (9 files) + `loopy-mapper-react/` codebase
**Analyst:** Roo

---

## Table of Contents

1. [What We Got Right](#1-what-we-got-right)
2. [Conceptual Flaws](#2-conceptual-flaws)
3. [Missing Enhancements](#3-missing-enhancements)
4. [What's Wrong — Implementation Gaps](#4-whats-wrong--implementation-gaps)
5. [Immediate Next Step](#5-immediate-next-step)
6. [Long-Term Architectural Plan](#6-long-term-architectural-plan)
7. [Summary of Action Items](#7-summary-of-action-items)

---

## 1. What We Got Right

### 1.1 Domain Model — Exemplary Alignment

The type system in [`loopy-mapper-react/src/types/index.ts`](loopy-mapper-react/src/types/index.ts) is a **remarkably faithful implementation** of the Developstage3 spec. The 728-line file implements nearly every interface defined across the 9 concept documents:

- [`ModuleCard`](loopy-mapper-react/src/types/index.ts:18) — Implements the two-tier module system (isPreset / presetId flags)
- [`ModuleTrackConfig`](loopy-mapper-react/src/types/index.ts:35) — Sound source abstraction, loop behaviors, MIDI mapping
- [`SongSection`](loopy-mapper-react/src/types/index.ts:160) — Timeline hub with chordProgression, transition, activeModules
- [`ClockPosition`](loopy-mapper-react/src/types/index.ts:233) — 8-field transport position snapshot
- [`TransportClock`](loopy-mapper-react/src/types/index.ts:244) — Full interface with subscriber pattern (7 callbacks) and scheduling (4 scheduleAt/Beat/Bar/Tick methods)
- [`HarmonyState` / `ResolvedChord` / `HarmonicModuleConfig`](loopy-mapper-react/src/types/index.ts:351) — Complete harmony domain
- [`VoicingConfig`](loopy-mapper-react/src/types/index.ts:389) — 6 strategies implemented
- [`ClipFilterConfig`](loopy-mapper-react/src/types/index.ts:400) — 3 modes (keyMatch, chordToneMatch, progressionMatch)
- [`RhythmShapeConfig`](loopy-mapper-react/src/types/index.ts:430) — Dual polygon overlay system
- [`ExpressionTrigger` / `RhythmExpression` / `HarmonicExpression` / `ArrangementExpression`](loopy-mapper-react/src/types/index.ts:448) — 3 expression types with 3 behaviors (replace, layer, morph)
- [`LooperStore`](loopy-mapper-react/src/types/index.ts:589) — Zustand store shape with 5 domains
- [`NormalizedAction` / `NormalizedBinding` / `ActionEntry` / `TargetEntry` / `ValuePayload`](loopy-mapper-react/src/types/index.ts:701) — Action pipeline normalization

**Verdict:** The type layer is production-quality. This is the project's strongest asset.

### 1.2 Transport Clock Architecture

[`TransportClockImpl`](loopy-mapper-react/src/lib/transportClock.ts:16) is well-designed:

- AudioContext `currentTime` as master timebase — correct choice for web audio
- SetTimeout-based scheduler at ~40Hz (25ms interval) — pragmatic; avoids AudioWorklet clock complexity for scheduling
- Subscriber pattern with `onTick`/`onBeat`/`onBar`/`onStart`/`onStop` callbacks — clean decoupling
- `scheduleAt`/`scheduleBeat`/`scheduleBar`/`scheduleTick` — quantization scheduling primitives
- `setSectionContext(bars, sectionId)` — section-aware timekeeping

**Verdict:** Solid foundation. The subscriber pattern is the right abstraction for connecting engines to the clock.

### 1.3 Arrangement Engine Structure

[`ArrangementEngine`](loopy-mapper-react/src/lib/arrangementEngine.ts:13) correctly implements:

- Section activation/deactivation with state management
- Three transition modes: `instant`, `nextBar`, `fade`
- `SectionContext` built and sent at activation — not stored globally
- Section module override system (`getEffectiveOverrides`)
- Clock subscriber wiring (`onStart`/`onStop`/`onBeat`/`onBar`)

The distinction between "section clock" and "loop clock" ([`arrangementconcept.md`](Developstage3/arrangementconcept.md:101)) is correctly preserved — the arrangement owns the timeline, modules respond to it.

### 1.4 Harmony Engine Core

[`HarmonyEngineCore`](loopy-mapper-react/src/lib/harmonyEngine.ts:48) correctly implements:

- 9 scale interval sets with `degreeToRootNote` resolution
- 7 chord qualities with `resolveChord`
- `stepProgression` with key/scale progression building
- `detectCadence` — authentic/plagal/deceptive/half/none
- 4 `ScaleSnapMode` values: off/scale/chordTones/chordTonesStrict
- `suggestProgression` for AI-assisted harmony

### 1.5 Engine Lifecycle Management

[`engineSlice.ts`](loopy-mapper-react/src/store/engineSlice.ts:26) handles:

- AudioContext creation with worklet processor loading (including blob URL fallback)
- WebMIDI initialization
- `suspendEngines`/`resumeEngines` for browser tab lifecycle

[`useEngineInitialization`](loopy-mapper-react/src/hooks/useEngineInitialization.ts:11) correctly wires:

- Engine initialization → TransportClock creation → ArrangementEngine clock binding

### 1.6 Core Architectural Decisions

| Decision | Status | Why It's Right |
|----------|--------|---------------|
| Hybrid sound model (AudioInput + MIDI + LiveMIDI) | ✅ Implemented in types | Covers all real-world use cases |
| Three module archetypes (Rhythm/Harmonic/Arrangement) | ✅ Implemented | Correct separation of concerns |
| Two-tier module system (Presets + Structured Editor) | ✅ In types | Onboarding vs power-user balance |
| Transport clock as singleton subscriber pattern | ✅ Implemented | Loose coupling, testable |
| SongObject as single JSON schema | ✅ In types | Portability, save/load foundation |
| Expression submodule system | ✅ In types | Conditional behavior without complexity |
| Dual polygon rhythm visualization | ✅ In types | Musically intuitive time signature display |

---

## 2. Conceptual Flaws

### 2.1 Infinite Canvas Exists Only as Speculation

The [`advancedconcepr.md`](Developstage3/advancedconcepr.md) file contains a complete infinite canvas concept — but this concept is **trapped inside a meta-transcript of its own creation**. The file is a conversation log showing a user/AI creating a concept document via terminal commands. The infinite canvas spec is *embedded within* this transcript but not extracted as a discrete, referenceable document.

Meanwhile, [`App.tsx`](loopy-mapper-react/src/App.tsx:10) implements a **fixed 3-panel layout**: LeftNav + SongCompositionCanvas + InfoPanel. This is a traditional DAW layout, not an infinite canvas.

**Problem:** The infinite canvas is the product vision ("The canvas is the product. The module system, engines, and action pipeline are infrastructure.") but the UI doesn't reflect this. The concept is well-defined but unimplemented. The `CanvasViewState` type exists ([`types/index.ts:557`](loopy-mapper-react/src/types/index.ts:557)) but nothing reads it.

**Recommendation:** Either commit to the infinite canvas and begin UI migration, or formally demote it to a stretch goal and stabilize the fixed-layout approach. Sitting in-between is risky.

### 2.2 AudioWorklet Engine Only Handles AudioInput — MIDI Sound Sources Are Unrouted

[`LooperEngine`](loopy-mapper-react/src/lib/audio-worklet.ts:117) is a **pure audio looper** — it records and plays back audio buffers from `MediaStream` input. There is no:

- Tone.js `PolySynth` integration for `MidiClipSource`
- Tone.js `Sampler` integration
- `MidiOutEngine` for external MIDI routing

The type system defines all three sound engine types ([`ToneJsPolySynthEngine`](loopy-mapper-react/src/types/index.ts:108), [`SamplerEngine`](loopy-mapper-react/src/types/index.ts:119), [`MidiOutEngine`](loopy-mapper-react/src/types/index.ts:125)), and the [`Soundconcept.md`](Developstage3/Soundconcept.md:40) recommends the hybrid approach. But **none of the MIDI sound engines are instantiated or wired.**

**Problem:** A user can create a `MidiClipSource` track in the type system, but it will be silent at runtime because there's no renderer for it. This means the product can only loop audio input — no MIDI clip playback, no synth sounds, no external MIDI output.

### 2.3 No MIDI Scheduler Integration with Transport Clock

The transport clock has [`scheduleAt`](loopy-mapper-react/src/lib/transportClock.ts:142)/`scheduleBeat`/`scheduleBar`/`scheduleTick` methods for scheduling future callbacks, but **there's no MIDI event scheduler** that converts these into note-on/note-off messages at sample-accurate positions.

For a looper, MIDI scheduling is critical:
- MIDI clips need to play back at the correct beat position
- Note-on/note-off pairs need to be scheduled with beat precision
- The arrangement engine's `nextBar` transition depends on bar-accurate MIDI event scheduling

**Problem:** The scheduling infrastructure exists, but it's unused for MIDI. The clock ticks, but nothing musical happens from it.

### 2.4 No SongObject Save/Load

[`SongObject`](loopy-mapper-react/src/types/index.ts:135) is a complete, self-contained JSON schema containing all tracks, arrangement, harmony, and MIDI maps. But there's **no serialization or deserialization logic**. The store is ephemeral — refreshing the browser loses everything.

**Problem:** This is a "browser looper" that can't save or load songs. The data model is perfectly structured for serialization (it's already a JSON object), but the persistence layer doesn't exist.

### 2.5 Engine Slice Stores Engines as `unknown | null`

[`engineSlice.ts`](loopy-mapper-react/src/store/engineSlice.ts:8) stores:
```typescript
looperEngine: LooperEngine | null
clockEngine: unknown | null     // Actually TransportClockImpl
midiRouter: unknown | null      // Actually MidiRouter
```

**Problem:** `clockEngine` and `midiRouter` lack proper typing. This means TypeScript can't catch misuse, and consumers need to cast manually. The types exist in the codebase — [`TransportClock`](loopy-mapper-react/src/types/index.ts:244) is fully defined. This should be `TransportClock | null` (or `TransportClockImpl | null`).

### 2.6 Advancedconcepr.md Filename Typo — Systemic Risk

The filename [`advancedconcepr.md`](Developstage3/advancedconcepr.md) is misspelled (should be `advancedconcept.md` or likely `infinitecanvasconcept.md`). While minor, this indicates the file was created in a rush and its content (the infinite canvas spec) was never properly extracted. Important architectural visions shouldn't live in misspelled filenames or meta-transcripts.

---

## 3. Missing Enhancements

### 3.1 No MIDI Learn UI or Binding Interface

The [`MidiBinding`](loopy-mapper-react/src/types/index.ts:295) type and auto-mapping algorithm are specified in [`arrangement overview.md`](Developstage3/arrangement%20overview.md:452-559), but there's no:

- MIDI learn button UI
- MIDI binding table editor
- Visual indication of mapped vs unmapped controls
- "Press a MIDI key to assign" flow

**Why it matters:** MIDI mapping is the core interaction model for a hardware controller-based looper. Without it, the product is keyboard-and-mouse only, which defeats the purpose of a Loopy Pro-inspired tool.

### 3.2 No Module Editor UI (Tier 2)

The two-tier system specifies:
- **Tier 1:** Presets — zero-setup, "just works" (implemented as [`ModulePreset`](loopy-mapper-react/src/types/index.ts:57))
- **Tier 2:** Structured Editor — advanced customization (specified in [`Looperconcept.md`](Developstage3/Looperconcept.md:237-261))

There is no Tier 2 editor UI. Users can't:
- Customize action-to-track mappings
- Edit param schemas or value ranges
- Create or save custom presets
- Configure the 52 filtered actions per module type

### 3.3 No Preset Library

[`presets.ts`](loopy-mapper-react/src/store/presets.ts) exists but likely contains minimal or no content. A preset library is essential for the two-tier system to work — users need a curated set of module presets to choose from on day one.

### 3.4 No Quantization Scheduling

The clock provides quantization primitives (`scheduleAt`, `scheduleBeat`, etc.), but:
- Loop recording doesn't quantize start/stop positions
- Track toggle doesn't quantize to the nearest beat/bar
- No `QuantizationPreset` UI selector wired to behavior

### 3.5 No Expression Engine

The expression system is fully typed ([`RhythmExpression`](loopy-mapper-react/src/types/index.ts:456), [`HarmonicExpression`](loopy-mapper-react/src/types/index.ts:469), [`ArrangementExpression`](loopy-mapper-react/src/types/index.ts:482)) with trigger types and behaviors, but **no ExpressionEngine class or runtime logic exists**. Expressions are data-only — they can be stored but never executed.

### 3.6 No Effects Engine (Send/Return)

There's no concept of:
- Track-level effects (EQ, compression, delay, reverb)
- Send/return busses
- Master channel
- Effect chain serialization

For a music production tool, this is a significant gap. Even basic volume/pan/mute is implemented at the type level but not wired to the audio graph.

### 3.7 No Undo/Redo

With a Zustand store and normalized action pipeline ([`NormalizedAction`](loopy-mapper-react/src/types/index.ts:723)), undo/redo is architecturally feasible via action history replay. But it's not implemented.

### 3.8 No Export/Share

No audio export (WAV/MP3), no project file export, no share functionality. The product is entirely ephemeral.

---

## 4. What's Wrong — Implementation Gaps

This section focuses on **partial or broken implementations** — things that exist but aren't fully wired.

### 4.1 AudioWorklet — Blob Fallback Instead of Separate File

The [`LooperProcessor`](loopy-mapper-react/src/lib/audio-worklet.ts:1) is embedded as an inline string and loaded via blob URL:

```typescript
const PROCESSOR_CODE = `class LooperProcessor extends AudioWorkletProcessor { ... }`;
const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
const url = URL.createObjectURL(blob);
```

This works but makes the processor code:
- Un-debuggable (no source maps, no file reference in DevTools)
- Imports inside the worklet are limited
- Harder to maintain as it grows

The [`README.md`](loopy-mapper-react/README.md:52) correctly notes this as a next step: "real looper-processor.js file."

### 4.2 No `harmonyEngine.ts` React Hook

[`HarmonyEngineCore`](loopy-mapper-react/src/lib/harmonyEngine.ts:48) is a standalone class with no React hook for component consumption. There's no:
- `useHarmonyEngine` hook
- Harmony state integration with the store
- Wiring to the clip browser for Clip Filter functionality

### 4.3 No MidiRouter Implementation

The MIDI routing system is specified in detail ([`arrangement overview.md`](Developstage3/arrangement%20overview.md:418-592)) with auto-mapping algorithms and `MidiBinding` normalization, but there's no `MidiRouter` class. The store stores it as `unknown | null`.

### 4.4 ArrangementEngine Not Bound to Real Clock

[`useEngineInitialization.ts`](loopy-mapper-react/src/hooks/useEngineInitialization.ts:11) creates the clock and wires it to the ArrangementEngine, but `ArrangementEngine.activateSection()` reads from the Zustand store directly rather than responding to clock events. The reactive flow (clock ticks → arrangement evaluates section boundaries → activates/deactivates modules) exists in the ArrangementEngine's `onBeat`/`onBar` handlers but isn't connected to any UI trigger.

### 4.5 Store Slices Not Fully Wired

The store is split into 6 slices (song, transport, engines, ui, moduleState, clipBrowser) but:
- [`songSlice.ts`](loopy-mapper-react/src/store/songSlice.ts) — likely minimal data
- [`transportSlice.ts`](loopy-mapper-react/src/store/transportSlice.ts) — may not sync with TransportClockImpl
- [`uiSlice.ts`](loopy-mapper-react/src/store/uiSlice.ts) — may not control actual UI state
- [`selectors.ts`](loopy-mapper-react/src/store/selectors.ts) — what derived state exists?

These need audit to confirm the store is actually driving the UI.

### 4.6 No Tests

There are **zero test files** in the codebase. For a project with complex timing logic (TransportClock), state management (Zustand store with 50+ actions), and audio processing (AudioWorklet), this is a risk. The harmony engine's note resolution and the arrangement engine's section transitions are prime candidates for unit tests.

---

## 5. Immediate Next Step

### The Critical Path: Wire Clock → Engine → Modules for Audio

The project has excellent types and architecture documents but silent hardware. The single most impactful next step is:

**Phase 1 — Make a Sound (1-2 weeks)**

1. **Wire Tone.js PolySynth to MidiClipSource**
   - Create a `SynthEngine` class that instantiates Tone.js `PolySynth`
   - Route `MidiClipSource` playback through it
   - This gives the product its first audible output from a MIDI clip

2. **Implement Basic MidiRouter**
   - Create `MidiRouter` class with auto-mapping logic
   - Wire MIDI input to module action dispatch
   - Implement the "press a pad → toggle a track record" flow

3. **Connect TransportClock to LooperEngine**
   - Make the clock's `onBeat`/`onBar` callbacks actually drive the looper
   - Implement loop-length detection from recorded audio
   - Quantize record start/stop to beat boundaries

4. **Validate with One Rhythm Module**
   - Create a single rhythm module with 4 tracks
   - Route audio input → AudioWorklet
   - Map MIDI notes → track record/toggle
   - Verify the loop starts/stops on beat

**Phase 2 — Make It Musical (2-3 weeks)**

5. Wire `HarmonyEngineCore` to the clock
6. Create a clip browser that filters by key/chord match
7. Implement basic SongObject save/load (localStorage MVP)

---

## 6. Long-Term Architectural Plan

### 6.1 Phase 3 — Complete Module System (Month 2)

- **Tier 2 Editor UI:** Full structured editor for all 3 module types
- **Preset Library:** 10-20 curated presets per module type
- **Expression Engine:** Runtime execution of all 3 expression types with trigger evaluation
- **MIDI Learn UI:** Complete binding workflow with visual feedback

### 6.2 Phase 4 — Song Composition Canvas (Month 3)

- **Infinite Canvas:** Implement 2D pan/zoom with pinned timeline
- **3 Canvas Views:** Sections Only → Sections+Modules → Full Composition
- **Chord Strip Editor:** Diatonic palette, drag-to-assign chords
- **AI Song Features:** Suggest Structure, Suggest Chords, Arrange (backend integration)

### 6.3 Phase 5 — Audio Production Features (Month 3-4)

- **Effects Engine:** Track-level insert effects, send/return busses, master channel
- **Export:** WAV/MP3 rendering of arrangement
- **SoundFont Support:** Load `.sf2` files for SamplerEngine
- **MIDI Clock Sync:** Slave to external MIDI clock, or act as master

### 6.4 Phase 6 — Polish & Scale (Month 4+)

- **Undo/Redo:** Action history with normalized actions
- **Project Management:** Save/load/rename/duplicate SongObjects
- **Performance:** AudioWorklet optimization for 8+ simultaneous tracks
- **Mobile:** Touch-optimized UI for iPad
- **Testing:** Full test suite for all engines and store slices

### 6.5 Architecture Evolution Diagram

```
Now:                              Phase 3-4:
┌─────────────┐                   ┌──────────────────────────────┐
│   Types     │ ✓ Strong          │   Infinite Canvas UI         │
│   Clock     │ ✓ Works           │   ├─ Pinned Timeline         │
│   ArrEng    │ ✓ Works          │   ├─ Mini-Map                │
│   HarmEng   │ ✓ Works          │   └─ 3 View Toggles          │
│   AudioWL   │ ⚠ Audio only     │                               │
│   MIDI      │ ✗ Not routed     │   Module System              │
│   Engine    │                   │   ├─ Tier 1: Presets (curated)│
│   Presets   │ ✗ Empty          │   ├─ Tier 2: Editor (full)   │
│   Expressions│ ✗ Data only     │   ├─ Expression Engine       │
│   Canvas    │ ✗ Fixed layout   │   └─ MIDI Learn UI           │
└─────────────┘                   │                               │
                                  │   Engines                    │
                                  │   ├─ SynthEngine (Tone.js)   │
                                  │   ├─ SamplerEngine (SF2)     │
                                  │   ├─ MidiOutEngine           │
                                  │   ├─ Effects Engine          │
                                  │   └─ ExpressionEngine        │
                                  │                               │
                                  │   Persistence                │
                                  │   ├─ SongObject serialization│
                                  │   └─ LocalStorage / IndexedDB│
                                  └──────────────────────────────┘
```

### 6.6 Key Architectural Principles to Maintain

1. **Types as source of truth:** The `types/index.ts` file already serves this role. Keep it as the single source — all implementations should derive from types, not the other way around.

2. **Engine isolation:** Engines (Transport, Arrangement, Harmony, Audio, Expression, MIDI) should remain independent classes communicating through the clock subscriber pattern and Zustand store. No engine should import another engine.

3. **Action pipeline:** The `NormalizedAction`/`NormalizedBinding` system is the right abstraction for MIDI-to-action dispatch. Build on it rather than creating ad-hoc event handling.

4. **Hybrid sound model:** Maintain the sound source abstraction (AudioInput vs MidiClip vs LiveMidi) as the user-facing model, with sound engines as the implementation layer. This lets users think in terms of "what sound source" not "what rendering technology."

5. **Canvas-first UI:** Even if the infinite canvas is deferred, keep all UI as canvas-compatible components (no hardcoded positions, no fixed-size panels that can't be embedded in a 2D viewport).

---

## 7. Summary of Action Items

| Priority | Action | Category | Effort |
|----------|--------|----------|--------|
| **P0** | Wire Tone.js PolySynth to MidiClipSource | Missing Enhancement | 3-5 days |
| **P0** | Implement MidiRouter class | Missing Enhancement | 3-5 days |
| **P0** | Connect TransportClock to LooperEngine | Implementation Gap | 2-3 days |
| **P1** | Type `clockEngine` and `midiRouter` properly | Bug | 1 day |
| **P1** | Implement SongObject save/load (localStorage) | Missing Enhancement | 3-5 days |
| **P1** | Extract infinite canvas spec from advancedconcepr.md | Documentation | 1 day |
| **P1** | Create proper looper-processor.js file | Implementation Gap | 1 day |
| **P2** | Build MIDI Learn UI | Missing Enhancement | 1 week |
| **P2** | Build Module Editor (Tier 2) | Missing Enhancement | 2 weeks |
| **P2** | Implement Expression Engine | Missing Enhancement | 1 week |
| **P2** | Populate preset library | Missing Enhancement | 3-5 days |
| **P3** | Implement undo/redo | Missing Enhancement | 1 week |
| **P3** | Build Effects Engine | Missing Enhancement | 2 weeks |
| **P3** | Add quantization scheduling | Implementation Gap | 3-5 days |
| **P3** | Add test suite | Missing Enhancement | Ongoing |
| **P4** | Infinite Canvas UI | Conceptual Flaw | 3-4 weeks |
| **P4** | Export/Share | Missing Enhancement | 1 week |
| **P4** | SoundFont support | Missing Enhancement | 1-2 weeks |
| **P4** | MIDI clock sync | Missing Enhancement | 1-2 weeks |

---

*This report was generated by analyzing 9 Developstage3 concept documents and ~4,500 lines of source code across the `loopy-mapper-react/` codebase.*
