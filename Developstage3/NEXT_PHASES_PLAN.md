# Near-Term Development Plan: Modules, Submodules & Architecture Evolution

**Date:** 2026-07-06  
**Based on:** Developstage3 concept documents (9 files) + `loopy-mapper-react/` codebase analysis  
**Covers:** Current state inventory, Harmonic Module, Transition Module, Effects Engine, Persistence, Constraints

---

## Table of Contents

1. [Current State Inventory](#1-current-state-inventory)
2. [Phase 1: Harmonic Module](#2-phase-1-harmonic-module)
3. [Phase 2: Transition Module](#3-phase-2-transition-module)
4. [Phase 3: Effects Engine](#4-phase-3-effects-engine)
5. [Phase 4: Persistence & Polish](#5-phase-4-persistence--polish)
6. [Constraints & Deferrals](#6-constraints--deferrals)
7. [Appendix: Transition Type Evolution](#7-appendix-transition-type-evolution)

---

## 1. Current State Inventory

### 1.1 Fully Built (Production-Ready)

| Layer | Component | Lines | Status |
|---|---|---|---|
| **Backend** | Clip API (browse/search/stream MIDI dataset) | Full routes | ✅ |
| | Drum API (WAV kit listing/streaming) | `routes/drums.py` 108 | ✅ |
| | Songs API (CRUD) | `routes/songs.py` | ✅ |
| | MIDI scanner (e-gmd, Tegridy ingestion) | `ingest/scanner.py` | ✅ |
| **Engines** | TransportClock (subscriber pattern, `scheduleAt/Beat/Bar/Tick`, section-aware) | `transportClock.ts` | ✅ |
| | ArrangementEngine (section activation, instant/nextBar/fade transitions, `SectionContext` dispatch, module override system) | `arrangementEngine.ts` | ✅ |
| | HarmonyEngineCore (9 scale intervals, 7 chord qualities, degree→note resolution, cadence detection, 4 scale snap modes, progression suggestion) | `harmonyEngine.ts` 239 | ✅ |
| | SynthEngine (Tone.js PolySynth + Sampler voice pool, MIDI sequence playback, `playSequence` loop, voice lifecycle) | `synthEngine.ts` 280 | ✅ |
| | MidiRouter (WebMIDI, auto-mapping, learn mode, note→track→LooperEngine/SynthEngine dispatch, binding management) | `midiRouter.ts` 505 | ✅ |
| | ExpressionEngine (fill/variation/transition trigger evaluation, replace/layer/morph behaviors, cleanup functions) | `expressionEngine.ts` 142 | ✅ |
| | AudioWorklet Looper (8-track Float32 record/play/loop, AudioWorklet, blob fallback, track state notifications) | `audio-worklet.ts` + `looper-processor.js` | ✅ |
| | VoicingEngine | `voicingEngine.ts` | ✅ |
| **Store** | 6 Zustand slices: song, transport, engines, ui, moduleState, clipBrowser | Full | ✅ |
| | `moduleStateSlice.ts` — per-module runtime state (isActive, tracks, harmony, expression, repeatCount) | Full | ✅ |
| **Components** | SongCompositionCanvas + SectionTimeline + ModuleLanes + PlayheadOverlay + TimelineRuler | Full | ✅ |
| | GeometricMusicCard (dual polygon + diatonic hexagon) | Full | ✅ |
| | ModuleCardRenderer (dispatches to correct card type) | `ModuleCardRenderer.tsx` 311 | ✅ |
| | HarmonicModuleCard (existing placeholder — circle + chord names) | Partial | ⚠️ |
| | DrumModuleCard + DrumKitBrowser (WAV sample browsing/assignment flow) | Full | ✅ |
| | ClipBrowser (MIDI clip filtering, inline Tone.js preview, pagination) | Full | ✅ |
| | ModuleSettingsPanel (Tier 2 editor — identity, tracks, expression, presets) | `ModuleSettingsPanel.tsx` 475 | ✅ |
| | MidiSequencerPanel | Full | ✅ |
| | LeftNav, InfoPanel, BottomToolbar, CanvasToolbar, MasterArrangerConductor | Full | ✅ |
| **Types** | 809-line `types/index.ts` — every concept doc interface implemented | Full | ✅ |
| **Tests** | `__tests__/harmonyEngine.test.ts` | Exists | ✅ |
| **Initialization** | `useEngineInitialization.ts` wires all engines: Tone.js → Looper → Synth → Clock → Arrangement → MidiRouter → synth voices | 197 | ✅ |

### 1.2 Built But Needs Enhancement

| Feature | What Exists | What's Missing |
|---|---|---|
| **HarmonicModuleCard** | Placeholder in `ModuleCardRenderer.tsx` lines 228-261 — shows a colored circle with chord names | Needs full hexagon visualization driven by live `HarmonyRuntimeState`, chord timeline mini-map, progression bar display, pluggable track count |
| **HarmonicModuleConfig** | Full type in `types/index.ts` lines 445-483 | No UI editor for voicing settings, clip filter config, or scale snap mode |
| **ModuleSettingsPanel** | Generic editor for identity/tracks/expression | Missing harmonic-specific sections: voicing preset, chord filter mode, harmony settings |
| **Presets** | `presets.ts` has harmonic presets (`preset-harmonic-1tk`, `preset-harmonic-2tk`) with `followChordProgression: true` | Need presets with voicing config, clip filter config, scale snap mode populated |
| **Transition system** | `TransitionMode: "instant" | "nextBar" | "fade"` as simple enum on `SongSection` | No visual editor, no per-module transition behavior, no adjustable offset/duration |
| **SongObject save/load** | Types defined, `saveSong` returns object, `exportSong` downloads JSON | No localStorage/IndexedDB persistence, no "Open" dialog, no recent songs list |

### 1.3 Not Built (Deferred)

| Feature | Why Deferred | Target Phase |
|---|---|---|
| Effects engine (EQ, compressor, reverb, delay, chorus, phaser, distortion, autoFilter) | Requires audio graph restructuring | Phase 3 |
| Infinite canvas | 3-4 week migration, destabilizes current layout | Post-Phase 4 |
| Undo/redo | Zustand middleware possible, not critical yet | Phase 4 |
| Full audio sampling/editing suite | Massive feature surface; AudioWorklet input works | Post-Phase 4 |
| SoundFont (.sf2) loading | Sampler via URL-based samples works for drum kits | P4 |
| MidiOutEngine (external hardware) | Niche; type exists for completeness | P4 |
| Mobile/touch optimization | iPad target but desktop parity first | Post-Phase 4 |
| Multi-user / collaboration | Out of scope | Never |

---

## 2. Phase 1: Harmonic Module

### 2.1 Summary

Build the complete Harmonic Module UI + editor + engine integration. The engines (`HarmonyEngineCore`, `SynthEngine`, `ExpressionEngine`) are all built. The types are built. What remains is the UI layer that makes harmonic concepts tangible.

**Effort:** 1-2 weeks  
**Priority:** P0 — this is the next major module class

### 2.2 HarmonicModuleCard — Full Implementation

The existing placeholder (lines 228-261 of `ModuleCardRenderer.tsx`) needs to become a proper card with:

**Card Header:**
- Bus color dot + module label + type badge ("🔵 Harmonic")
- Edit button → opens harmonic-specific editor panel
- Remove button

**Card Body — Diatonic Hexagon (top):**
- 7 vertices arranged in hexagon + center (I, ii°, iii, IV, V, vi, vii°)
- **Active vertex**: Current chord degree pulses with glow effect (bus color fill)
- **Next vertex**: Anticipating — subtle pulse, dashed outline
- **Previous vertex**: Trailing — fading glow, smaller
- **Chord tone vertices** (non-root): Slightly brighter than default
- **Non-chord scale degrees**: Default dimmed but visible
- Center shows root chord name (e.g., "Dm")
- Animated transitions when chord changes (vertex highlight swaps)

**Card Body — Chord Timeline Mini-Map (middle):**
- Bar-by-bar progression display: `┌─I─┬─IV─┬─V7─┬─I─┐`
- Each cell = 1 bar, shows degree + quality
- Active cell highlighted with playhead position
- Scrolls horizontally if progression exceeds visible width

**Card Body — Active Chord Info (below hexagon):**
- Current chord: "V7 (A7) — bar 5 of 8 — Next: I (Dm) in 1 bar"
- Note names: "A3 · C#4 · E4 · G4"
- Voicing preset badge: "Pad · Open · 4 voices"
- Cadence badge (if at progression end): "Authentic cadence"

**Track Row (bottom):**
- Reuses existing `TrackRow` component from `ModuleCardRenderer.tsx` lines 60-181
- Tracks configured with `MidiClipSource.followChordProgression: true`
- Track rows show clip status, auto-transpose indicator, volume

**Expression badge:**
- Shows "VAR ×4" when variation expression is enabled
- Reuses `ExpressionBadge` component

### 2.3 Harmonic Module Editor (ModuleSettingsPanel Expansion)

Add these sections to `ModuleSettingsPanel.tsx` for harmonic modules:

```
┌─ HARMONIC MODULE EDITOR ──────────────────────────────┐
│                                                         │
│  [Existing Identity section]                            │
│  [Existing Module Settings section]                     │
│                                                         │
│  ┌─ HARMONY ─────────────────────────────────────────┐ │
│  │  Scale Snap (live MIDI): [Scale ▾]                │ │
│  │    • off / scale / chordTones / chordTonesStrict   │ │
│  │  ☑ Detect cadence type                            │ │
│  │  ☐ Allow borrowed chords                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ VOICING ─────────────────────────────────────────┐ │
│  │  Preset: [Pad ▾]                                   │ │
│  │    • Piano / Pad / Strings / Jazz / Bass            │ │
│  │  Strategy: [Open ▾]                                │ │
│  │    • closeRoot / closeFirst / closeSecond / open    │ │
│  │    • drop2 / drop3 / spread                         │ │
│  │  Voice count: [4] (3-6)                            │ │
│  │  Range: [C3 ▾] to [C6 ▾]                          │ │
│  │  ☑ Smooth voice leading                            │ │
│  │  ☐ Root doubling (octave below)                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ CLIP FILTER ─────────────────────────────────────┐ │
│  │  Filter mode: [Key Match ▾]                        │ │
│  │    • keyMatch / chordToneMatch / progressionMatch   │ │
│  │  Density range: [2] to [8]                         │ │
│  │  Datasets: ☑ e-gmd  ☐ tegridy                     │ │
│  │  ☐ Auto-assign clips to progression steps          │ │
│  │  Match threshold: [0.6] (slider 0.0-1.0)           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  [Existing track settings]                              │
│  [Existing expression section]                          │
│  [Existing preset save button]                          │
└─────────────────────────────────────────────────────────┘
```

**Implementation files to create/update:**

| File | Action |
|---|---|
| `src/components/modules/HarmonicModuleCard.tsx` | Create — full harmonic card with hexagon + timeline |
| `src/components/modules/DiatonicHexagon.tsx` | Create — SVG hexagon visualization component |
| `src/components/modules/ChordTimelineMinimap.tsx` | Create — bar-by-bar progression strip |
| `src/components/editor/HarmonicModuleEditor.tsx` | Create — harmony/voicing/clip-filter editor sections |
| `src/components/modules/ModuleCardRenderer.tsx` | Update — import `HarmonicModuleCard` (already has it), enhance harmonic dispatch |
| `src/components/editor/ModuleSettingsPanel.tsx` | Update — add `isHarmonic` conditional sections delegating to `HarmonicModuleEditor` |
| `src/store/harmonySlice.ts` | Create — harmony runtime state slice (if separate from moduleState) |

### 2.4 Harmony Engine → Clock Wiring

The `HarmonyEngineCore` class in `harmonyEngine.ts` needs to be subscribed to the transport clock to drive the harmonic module's progression stepper. This is done in the `useEngineInitialization.ts` hook:

```typescript
// In useEngineInitialization.ts, after clock creation:

// Subscribe harmony engine to clock
import { harmonyEngine } from '../lib/harmonyEngine';

clock.registerSubscriber({
    id: 'harmony-sync',
    onBeat: (pos: ClockPosition) => {
        const store = useLooperStore.getState();
        const sections = store.song.arrangement;
        const activeSection = sections.find(s => s.id === pos.sectionId);
        if (!activeSection?.chordProgression?.length) return;

        const key = store.song.metadata.key;
        const scale = store.song.metadata.scale;
        const progression = activeSection.chordProgression;
        const beatsPerBar = store.song.metadata.timeSignature.numerator * (4 / store.song.metadata.timeSignature.denominator);

        // Get current harmony state from module runtime state
        // For each harmonic module active in this section:
        const harmonicModules = store.song.modules.filter(
            m => m.type === 'harmonic' && activeSection.activeModules.includes(m.id)
        );

        for (const mod of harmonicModules) {
            const runtime = store.moduleStates[mod.id];
            if (!runtime?.harmony) continue;

            const h = runtime.harmony;
            const result = harmonyEngine.stepProgression(
                progression,
                h.currentStepIndex,
                h.beatsInStep,
                beatsPerBar
            );

            if (result.advanced) {
                const step = progression[result.newStepIndex];
                const resolved = harmonyEngine.resolveChord(
                    key, scale, step.degree, step.quality, 3
                );

                // Detect cadence at progression end
                const cadence = (result.newStepIndex === 0 && h.currentStepIndex === progression.length - 1)
                    ? harmonyEngine.detectCadence(progression, key, scale)
                    : h.cadenceType;

                store.updateModuleState(mod.id, {
                    harmony: {
                        ...h,
                        currentStepIndex: result.newStepIndex,
                        activeChord: resolved,
                        previousChord: h.activeChord,
                        beatsInStep: result.beatInStep,
                        beatsUntilNext: (step.duration * beatsPerBar) - result.beatInStep,
                        cadenceType: cadence,
                    },
                });

                // Auto-transpose MIDI clips if followChordProgression is enabled
                for (const track of mod.tracks) {
                    if (track.soundSource.type === 'midiClip' && track.soundSource.followChordProgression) {
                        // Calculate transpose offset from resolved chord root
                        // The keyboard's base key is in the song metadata
                        const baseKeyIndex = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(key);
                        const transpose = resolved.rootNote - baseKeyIndex;
                        store.updateTrack(mod.id, track.index, {
                            soundSource: { ...track.soundSource, transpose } as any,
                        });
                    }
                }

                // Re-filter clip browser suggestions if auto-assign is on
                // (delegated to clip browser or handled via filter mode)
            } else {
                store.updateModuleState(mod.id, {
                    harmony: {
                        ...h,
                        beatsInStep: result.beatInStep,
                        beatsUntilNext: (progression[h.currentStepIndex].duration * beatsPerBar) - result.beatInStep,
                    },
                });
            }
        }
    },
    onBar: (pos: ClockPosition) => {
        // Bar boundary — could trigger clip filter re-query if progressionMatch mode
        // Or update chord timeline mini-map highlight
    },
});
```

### 2.5 Clip Filter Integration

The harmony engine needs to drive clip suggestions in the ClipBrowser. When a harmonic module is active:

1. **Key Match mode:** `GET /api/clips?key={activeChord.rootNote}&scale={song.scale}`
2. **Chord Tone Match mode:** Filter client-side using `pitchClassVector` — only show clips whose dominant pitch classes match the active chord tones
3. **Progression Match mode:** Pre-fetch clips for ALL chords in the progression, group by chord step number

Wire this in `clipBrowserSlice.ts` by adding a harmony-aware filter function:

```typescript
// In clipBrowserSlice.ts or a utility:
function applyHarmonyFilter(
    results: ClipSearchResult,
    activeChord: ResolvedChord,
    mode: ClipFilterMode,
): ClipSearchResult {
    // Client-side filtering logic
    // ...
}
```

### 2.6 Preset Updates

Update `presets.ts` to include harmonic presets with full configuration:

- `preset-harmonic-pad` — 1 track, `midiClip` + `followChordProgression`, voicing: Pad preset (open, 4 voices, smooth voice leading)
- `preset-harmonic-keys` — 1 track, `liveMidi`, scale snap: chordTones, voicing: Piano (closeRoot, 3 voices)
- `preset-harmonic-strings` — 1 track, `midiClip`, voicing: Strings (drop2, 4 voices)
- `preset-harmonic-jazz` — 1 track, `midiClip`, voicing: Jazz (spread, rootless, 3 voices)
- `preset-harmonic-bass` — 1 track, `midiClip`, voicing: Bass (closeRoot + rootDoubling, 2 voices)
- `preset-harmonic-section` — 2 tracks (Pad + Lead), different voicings per track

---

## 3. Phase 2: Transition Module

### 3.1 Summary

Elevate transitions from a simple `TransitionMode` enum on `SongSection` to a first-class entity with visual editing, per-module behavior, and adjustable position/duration.

### 3.2 Transition Type Evolution

Current:
```typescript
interface SongSection {
    // ...
    transition: TransitionMode;  // "instant" | "nextBar" | "fade"
}
```

New (see Appendix for full type):
```typescript
interface SongSection {
    // ...
    transition: SectionTransitionConfig;  // First-class object
}
```

**Key changes:**
- Transitions live between two sections, not as a property of one section
- Each transition has: start offset (beats before boundary), end offset (beats after)
- Each participating module can have a different behavior: continue / mute / crossfade / playClip
- Transition clips (risers, sweeps, fills) can be assigned

### 3.3 TransitionEditor Component

**Visual representation on SectionTimeline:**

```
┌────────────┐          ┌────────────┐
│ Section A  │ ╱╲╱╲╱╲  │ Section B  │
│  "Verse"   │ ╱╲╱╲╱╲  │  "Chorus"  │
│  8 bars    │╱╲╱╲╱╲╱╲│  8 bars    │
└────────────┘          └────────────┘
               ╲╱╲╱╲╱
               Transition region
               (adjustable trapezoid)
```

- Rendered between section blocks on the timeline
- Trapezoid shape spanning `startOffsetBeats` before to `endOffsetBeats` after the boundary
- Left drag handle adjusts start offset (how early the transition begins)
- Right drag handle adjusts end offset (how late the transition extends)
- Color-coded by transition mode (yellow for crossfade, orange for fill, etc.)
- Click to open transition editor panel

**Transition Editor Panel (InfoPanel):**

```
┌─ TRANSITION EDITOR ───────────────────────────┐
│                                                 │
│  From: Verse    →    To: Chorus                 │
│                                                 │
│  ┌─ Timing ────────────────────────────────┐   │
│  │  Start offset: [2] beats before boundary │   │
│  │  End offset:   [1] beats after boundary  │   │
│  │  Duration: 3 beats total                 │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ Mode ──────────────────────────────────┐   │
│  │  ○ Instant (hard cut)                   │   │
│  │  ○ Crossfade (smooth transition)        │   │
│  │  ○ Fill (drum fill over transition)     │   │
│  │  ○ Riser (sweep/noise build)            │   │
│  │  ○ Custom (per-module config below)     │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ PARTICIPATING MODULES ──────────────────┐   │
│  │                                            │   │
│  │  ☑ Verse Drums                            │   │
│  │     Behavior: [Crossfade ▾]               │   │
│  │     Fade out: [2.0] beats                 │   │
│  │     Fade in:  [1.0] beats                 │   │
│  │                                            │   │
│  │  ☐ Verse Pad                              │   │
│  │     Behavior: [Mute ▾]                    │   │
│  │                                            │   │
│  │  ☑ Chorus Drums                           │   │
│  │     Behavior: [Continue ▾]                │   │
│  │                                            │   │
│  │  ☑ Riser                                   │   │
│  │     Clip: [riser_sweep_123    ▾] [Browse]  │   │
│  │     Behavior: [Layer ▾]                    │   │
│  └────────────────────────────────────────────┘   │
│                                                 │
│  [Preview]  [Save]  [Reset to Default]          │
└─────────────────────────────────────────────────┘
```

### 3.4 Implementation Files

| File | Action |
|---|---|
| `src/types/index.ts` | Update `SongSection.transition` → `SectionTransitionConfig`, add `ModuleTransitionBehavior`, `TransitionClip` types |
| `src/components/canvas/TransitionEditor.tsx` | Create — visual editor for transition config |
| `src/components/canvas/SectionTimeline.tsx` | Update — render transition trapezoids between sections, drag handles |
| `src/lib/arrangementEngine.ts` | Update — handle new transition config in section activation logic |
| `src/store/songSlice.ts` | Update — transition mutation actions |
| `src/store/transitionSlice.ts` | Create — transition runtime state (progress, active modules, fade curves) |

---

## 4. Phase 3: Effects Engine

### 4.1 Summary

Add per-module insert effects chains using Tone.js built-in effects. Effects process the module's mixed audio output (all tracks summed) before reaching the master output.

### 4.2 Architecture

```
Module Tracks (summed)
       │
       ▼
  ┌───────────────┐
  │ Effects Chain │  ← Inserted here
  │ [EQ] [Comp]   │
  │ [Reverb]      │
  └───────┬───────┘
          │
          ▼
  Master Gain → Destination
```

### 4.3 Type Definitions

```typescript
// ADD to types/index.ts:

type EffectType = "eq" | "compressor" | "reverb" | "delay" | "chorus" | "phaser" | "distortion" | "autoFilter" | "panner";

interface EffectSlot {
    id: string;
    type: EffectType;
    order: number;
    enabled: boolean;
    params: EffectParams;
    bypassed: boolean;
}

interface EffectParams {
    // EQ (3-band)
    lowGain?: number;       // -20 to 20 dB
    midGain?: number;
    highGain?: number;
    lowFreq?: number;       // 20-500 Hz
    highFreq?: number;      // 2000-20000 Hz
    
    // Compressor
    threshold?: number;     // -60 to 0 dB
    ratio?: number;         // 1:1 to 20:1
    attack?: number;        // 0.001 to 0.5 sec
    release?: number;       // 0.01 to 1.0 sec
    knee?: number;          // 0 to 40 dB
    
    // Reverb
    decay?: number;         // 0.1 to 10 sec
    preDelay?: number;      // 0 to 0.1 sec
    wet?: number;           // 0.0 to 1.0
    
    // Delay
    delayTime?: number;     // 0.01 to 1.0 sec
    feedback?: number;      // 0.0 to 1.0
    wet?: number;
    
    // Distortion
    distortion?: number;    // 0.0 to 1.0
    
    // Chorus / Phaser
    frequency?: number;     // 0.1 to 10 Hz
    depth?: number;         // 0.0 to 1.0
    
    // AutoFilter
    frequency?: number;
    q?: number;
    rolloff?: number;
    
    // Common
    mix?: number;           // 0.0 to 1.0 (dry/wet)
}

interface EffectsConfig {
    enabled: boolean;
    chain: EffectSlot[];
    masterMix: number;      // 0.0 to 1.0
}

// UPDATE ModuleCard:
// Add: effects?: EffectsConfig;
```

### 4.4 EffectsEngine Class

```typescript
// src/lib/effectsEngine.ts

import * as Tone from 'tone';
import type { EffectsConfig, EffectSlot, EffectType } from '../types';

export class EffectsEngine {
    private chains: Map<string, Tone.ToneAudioNode[]> = new Map();
    // moduleId → [input, effect1, effect2, ..., output]
    
    setChain(moduleId: string, config: EffectsConfig): void {
        // Remove existing chain
        this.removeChain(moduleId);
        if (!config.enabled || config.chain.length === 0) return;
        
        const nodes: Tone.ToneAudioNode[] = [];
        
        for (const slot of config.chain.sort((a, b) => a.order - b.order)) {
            if (!slot.enabled || slot.bypassed) continue;
            const effect = this.createEffect(slot);
            if (effect) nodes.push(effect);
        }
        
        this.chains.set(moduleId, nodes);
        // Wire: previous node output → next node input
        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
        }
    }
    
    private createEffect(slot: EffectSlot): Tone.ToneAudioNode | null {
        switch (slot.type) {
            case 'reverb':
                return new Tone.Reverb({ decay: slot.params.decay ?? 2, wet: slot.params.wet ?? 0.3 });
            case 'delay':
                return new Tone.FeedbackDelay({ delayTime: slot.params.delayTime ?? 0.25, feedback: slot.params.feedback ?? 0.3, wet: slot.params.wet ?? 0.3 });
            case 'distortion':
                return new Tone.Distortion({ distortion: slot.params.distortion ?? 0.3 });
            case 'chorus':
                return new Tone.Chorus({ frequency: slot.params.frequency ?? 4, depth: slot.params.depth ?? 0.3 });
            case 'phaser':
                return new Tone.Phaser({ frequency: slot.params.frequency ?? 0.5 });
            case 'autoFilter':
                return new Tone.AutoFilter({ frequency: slot.params.frequency ?? 1, q: slot.params.q ?? 1 });
            case 'eq':
                return new Tone.EQ3({ low: slot.params.lowGain ?? 0, mid: slot.params.midGain ?? 0, high: slot.params.highGain ?? 0 });
            case 'compressor':
                return new Tone.Compressor({ threshold: slot.params.threshold ?? -24, ratio: slot.params.ratio ?? 3, attack: slot.params.attack ?? 0.003, release: slot.params.release ?? 0.25 });
            case 'panner':
                return new Tone.Panner({ pan: slot.params.pan ?? 0 });
            default:
                return null;
        }
    }
    
    connectInput(moduleId: string, inputNode: Tone.ToneAudioNode): Tone.ToneAudioNode {
        const chain = this.chains.get(moduleId);
        if (!chain || chain.length === 0) return inputNode; // Passthrough
        inputNode.connect(chain[0]);
        return chain[chain.length - 1]; // Return last node for output connection
    }
    
    removeChain(moduleId: string): void {
        const chain = this.chains.get(moduleId);
        if (chain) {
            for (const node of chain) {
                try { node.disconnect(); node.dispose(); } catch {}
            }
            this.chains.delete(moduleId);
        }
    }
    
    dispose(): void {
        for (const [id] of this.chains) {
            this.removeChain(id);
        }
    }
}

export const effectsEngine = new EffectsEngine();
```

### 4.5 Effect Presets

```typescript
const EFFECT_PRESETS: Record<string, EffectsConfig> = {
    'Lo-Fi': {
        enabled: true,
        masterMix: 1.0,
        chain: [
            { id: 'eq1', type: 'eq', order: 0, enabled: true, bypassed: false, params: { lowGain: -2, highGain: -4 } },
            { id: 'chorus1', type: 'chorus', order: 1, enabled: true, bypassed: false, params: { frequency: 1.5, depth: 0.4 } },
        ],
    },
    'Ambient Wash': {
        enabled: true,
        masterMix: 1.0,
        chain: [
            { id: 'reverb1', type: 'reverb', order: 0, enabled: true, bypassed: false, params: { decay: 6, wet: 0.6 } },
            { id: 'delay1', type: 'delay', order: 1, enabled: true, bypassed: false, params: { delayTime: 0.5, feedback: 0.4, wet: 0.3 } },
        ],
    },
    'Tight Room': {
        enabled: true,
        masterMix: 1.0,
        chain: [
            { id: 'comp1', type: 'compressor', order: 0, enabled: true, bypassed: false, params: { threshold: -18, ratio: 4, attack: 0.01, release: 0.1 } },
            { id: 'reverb1', type: 'reverb', order: 1, enabled: true, bypassed: false, params: { decay: 0.4, wet: 0.15 } },
        ],
    },
    'Crushed Drums': {
        enabled: true,
        masterMix: 1.0,
        chain: [
            { id: 'dist1', type: 'distortion', order: 0, enabled: true, bypassed: false, params: { distortion: 0.6 } },
            { id: 'comp1', type: 'compressor', order: 1, enabled: true, bypassed: false, params: { threshold: -30, ratio: 8, attack: 0.005, release: 0.05 } },
        ],
    },
    'Clean': {
        enabled: true,
        masterMix: 1.0,
        chain: [],
    },
};
```

### 4.6 Implementation Files

| File | Action |
|---|---|
| `src/types/index.ts` | Add `EffectType`, `EffectSlot`, `EffectParams`, `EffectsConfig` |
| `src/lib/effectsEngine.ts` | Create — Tone.js effects chain manager |
| `src/components/editor/EffectsEditor.tsx` | Create — drag-and-drop chain editor |
| `src/components/modules/EffectsBadge.tsx` | Create — shows active effect count on module card |
| `src/hooks/useEngineInitialization.ts` | Update — wire effects engine after SynthEngine init |

---

## 5. Phase 4: Persistence & Polish

### 5.1 SongObject Save/Load

**localStorage MVP:**
```typescript
// In songSlice.ts — add these to existing saveSong/loadSong:

saveSongToLocalStorage: () => {
    const song = get().song;
    const key = `songobject-${song.metadata.title}-${Date.now()}`;
    const data = JSON.stringify({
        savedAt: new Date().toISOString(),
        song,
    });
    localStorage.setItem(key, data);
    // Also update recent songs list
    const recent = JSON.parse(localStorage.getItem('recent-songs') || '[]');
    recent.unshift({ key, title: song.metadata.title, savedAt: Date.now() });
    localStorage.setItem('recent-songs', JSON.stringify(recent.slice(0, 20)));
},

loadSongFromLocalStorage: (key: string) => {
    const data = localStorage.getItem(key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    get().loadSong(parsed.song);
    return parsed.song;
},

listSavedSongs: () => {
    const recent = JSON.parse(localStorage.getItem('recent-songs') || '[]');
    return recent.map((r: any) => ({
        ...r,
        song: JSON.parse(localStorage.getItem(r.key) || '{}').song || null,
    }));
},
```

**UI:**
- **Save button** in toolbar → `saveSongToLocalStorage()` with auto-generated name
- **Save As...** in menu → opens name dialog
- **Open** in menu → shows recent songs list with timestamps
- **Auto-save** to IndexedDB every 60 seconds (Phase 4 enhancement)

### 5.2 Assign Clip to Track Flow

Add "Assign to Track" button in `ClipBrowser.tsx`:

```typescript
// In ClipBrowser.tsx, add to clip card footer:
{assigningModuleId ? (
    <button
        onClick={() => {
            assignClipToTrack(assigningModuleId, assigningTrackIndex, clip.id);
            setAssigningModuleId(null);
        }}
        className="px-2 py-1 rounded bg-blue-600 text-white text-[10px]"
    >
        Assign to Track
    </button>
) : null}
```

The flow: user right-clicks a module track → "Browse Clips" → ClipBrowser opens with harmony-aware filters → user picks clip → click "Assign to Track" → `MidiClipSource.clipId` is set.

### 5.3 Expression Engine Wiring

The `ExpressionEngine` class exists but isn't wired to the module runtime lifecycle. Wire it in `useEngineInitialization.ts`:

```typescript
// In useEngineInitialization.ts, add to onBeat handler or onBar:

// After harmony advancement, check expression triggers:
import { getExpressionEngine } from '../lib/expressionEngine';

const exprEngine = getExpressionEngine();
for (const mod of harmonicModules) {
    if (mod.expression?.enabled && runtime?.repeatCount !== undefined) {
        const shouldFire = exprEngine.shouldFire(
            mod.expression,
            runtime.repeatCount,
            { fromSection: prevSection?.name, toSection: currentSection?.name },
        );
        if (shouldFire) {
            const cleanup = exprEngine.execute(mod.expression, mod.id);
            // Store cleanup function for later execution
            // Schedule cleanup after expression duration
            setTimeout(cleanup, (mod.expression as any).durationBeats * (60000 / bpm) / 4);
        }
    }
}
```

### 5.4 Undo/Redo

Implement using Zustand's `subscribeWithSelector` middleware:

```typescript
// In store.ts:
import { subscribeWithSelector } from 'zustand/middleware';

const history: { past: SongObject[]; future: SongObject[] } = {
    past: [],
    future: [],
};

// Subscribe to song changes (debounced)
useLooperStore.subscribe(
    (state) => state.song,
    (song, prevSong) => {
        if (JSON.stringify(song) !== JSON.stringify(prevSong)) {
            history.past.push(JSON.parse(JSON.stringify(prevSong)));
            history.future = []; // Clear redo on new action
        }
    },
    { equalityFn: (a, b) => false }, // Always record (we JSON compare inside)
);
```

### 5.5 Preset Library Population

Add 10+ curated presets per module type in `presets.ts`:

| Module Type | Presets to Add |
|---|---|
| **Rhythm** | `Rhythm — 8 Track` (existing), `Rhythm — 4 Track` (existing), `Rhythm — 2 Track` (existing), `Rhythm — Percussion`, `Rhythm — Electronic`, `Rhythm — Vinyl Scratch` |
| **Harmonic** | `Harmonic — Pad` (existing), `Harmonic — Pad + Lead` (existing), `Harmonic — Strings`, `Harmonic — Jazz Comping`, `Harmonic — Bass`, `Harmonic — Ambient`, `Harmonic — Arp` |
| **Arrangement** | `Arrangement — Conductor` (existing), `Arrangement — DJ`, `Arrangement — Live Band` |

---

## 6. Constraints & Deferrals

These are explicitly NOT to be pursued in the next 4 phases:

### 6.1 Infinite Canvas — Already Built (Infrastructure), Needs Element Diversity

**Correction (7/6):** The infinite canvas infrastructure is **already built**:
- `SongCompositionCanvas.tsx` has 2D pan/zoom, module drag, infinite grid, zoom control (lines 24-28, 40-60)
- Modules are absolutely positioned via `canvasPosition` (lines 194-219)
- Three view levels exist in the type: `sectionsOnly`, `sectionsWithModules`, `fullComposition` (unused)
- `CanvasViewState` type is defined in `types/index.ts` line 631-641

**What already exists:**
| Feature | Status |
|---|---|
| 2D pan (drag empty space) | ✅ Built (lines 64-93) |
| Zoom with mouse wheel (cursor-centered) | ✅ Built (lines 41-61) |
| Module drag-to-reposition | ✅ Built (lines 102-113) |
| Infinite grid background | ✅ Built (lines 167-191) |
| Zoom indicator | ✅ Built (lines 151-153) |
| Lock position/size controls | ✅ Built (lines 134-148, 19-21) |
| Empty state | ✅ Built (lines 222-230) |

**What the concept spec adds (not yet built):**

| Element Type | Description | Status |
|---|---|---|
| `sectionDetail` | A zoomed-in view of a section showing module lanes + chord strip, spawned by clicking a timeline section | ❌ |
| `chordStrip` | Inline chord progression editor that floats on canvas | ❌ |
| `textNote` | Sticky note for free text annotations | ❌ |
| `referenceClip` | Clip dragged from browser, hover to preview, right-click to assign to track | ❌ |
| `lyricBlock` | Lyric block assignable to a section, current line highlights during playback | ❌ |
| `image` | Image element (album art, reference photo) | ❌ |

**Advanced features not yet built:**
- Auto-pan during playback (canvas follows active section detail)
- Mini-map (bottom-right overview with viewport indicator)
- Layout automation: clean up grid, stack vertical, align to time, group by section
- Keyboard shortcuts (Cmd+C/V/D/Z, Cmd+0 reset zoom, Cmd+Shift+Z toggle auto-pan)
- Element z-order management
- Snap-to-grid

**Why this is NOT a deferral:** The canvas infrastructure is already in place and working. The remaining work is adding new element types (text notes, section details, reference clips, lyric blocks, images) and the mini-map + auto-pan. This is incremental work — each element type is a new component rendered into the same 2D transform space. Estimated: 1-2 days per element type, not 3-4 weeks for a migration.

**Recommendation:** After Phase 1 (Harmonic Module), add canvas elements incrementally as needed — text notes and section details first (they're the highest value for composition workflow), then the mini-map.

### 6.2 Full Audio Sampling/Suite — Defer

**Why defer:** The AudioWorklet records Float32 from mic/line-in. The `AudioInputSource` type exists. User-facing features (record trim, waveform editor, multi-take management, sample export) would be a massive feature surface.

**Keep:** Functional `AudioInputSource` tracks with existing record/play/loop behavior.
**Defer:** Sample editor, waveform view, crossfade editing, sample library management.

### 6.3 SoundFont (`.sf2`) Loading — Defer

**Why defer:** `SamplerEngine` uses Tone.Sampler with URL-based samples. The drum kit WAV files load via HTTP. Full SoundFont parsing would require a third-party library or custom parser.

**Keep:** URL-based sample maps for drum kits.
**Defer:** `.sf2` file loading, multi-velocity layer instruments.

### 6.4 MidiOutEngine (External Hardware) — Defer

**Why defer:** The type exists for completeness. WebMIDI output routing is niche (requires hardware synth, MIDI interface, configuration). Internal synth engines cover 90% of use cases.

**Keep:** `MidiOutEngine` type in `types/index.ts`.
**Defer:** Implementation of WebMIDI output routing.

### 6.5 Mobile / Touch Optimization — Defer

**Why defer:** Desktop/single-screen iPad in landscape is the current target. Touch interactions (tap, swipe, pinch) work at the browser level but are not fully optimized.

**Target:** Chrome + Safari on desktop, iPad landscape in split view.
**Defer:** Touch gesture optimizations, mobile-specific layout, PWA manifest.

### 6.6 Multi-User / Collaboration — Never

Out of scope for this project. SongObject JSON export/import is the sharing mechanism.

---

## 7. Appendix: Transition Type Evolution

### Current (Phase 0 — exists now)

```typescript
export type TransitionMode = "instant" | "nextBar" | "fade";

interface SongSection {
    // ...
    transition: TransitionMode;  // Single enum, no config
}
```

### Phase 2 — Proposed Full Transition Types

```typescript
// ── New types to add to types/index.ts ──

export type TransitionMode = "instant" | "nextBar" | "crossfade" | "fill" | "riser" | "custom";

export type ModuleTransitionBehavior = "continue" | "mute" | "crossfade" | "playClip";

export interface ParticipatingModuleTransition {
    moduleId: string;
    behavior: ModuleTransitionBehavior;
    clipId?: string;            // For "playClip" behavior — a transition clip (riser, fill, sweep)
    fadeOutDuration?: number;   // Beats over which to fade out
    fadeInDuration?: number;    // Beats over which to fade in
    volumeTarget?: number;      // Target volume during transition (0.0-1.0)
}

export interface TransitionClip {
    clipId: string | null;
    clipData?: ArrayBuffer;
    soundEngine?: SoundEngine;
    transpose: number;
    velocityScale: number;
}

export interface SectionTransitionConfig {
    id: string;
    mode: TransitionMode;
    
    // Timing — position relative to section boundary
    startOffsetBeats: number;   // How many beats BEFORE the boundary to start
    endOffsetBeats: number;     // How many beats AFTER the boundary to end
    
    // Derived (computed, not stored):
    // totalDurationBeats = startOffsetBeats + endOffsetBeats
    
    // Participating modules
    participatingModules: ParticipatingModuleTransition[];
    
    // Transition audio (for fill/riser modes)
    clip?: TransitionClip;
    
    // Crossfade curve (for crossfade mode)
    fadeCurve: "linear" | "equalPower" | "slowFade";
    
    // UI state
    editable: boolean;
    locked: boolean;
    label?: string;
    color?: string;
}

// ── Update SongSection ──
// Change from:
//   transition: TransitionMode;
// To:
//   transition: {
//      mode: TransitionMode;
//      config?: SectionTransitionConfig;  // Optional — if omitted, use default
//   };
// OR for forward compat, keep mode as shorthand:
//   transition: TransitionMode | SectionTransitionConfig;
```

### Backward Compatibility

When loading old songs where `transition` is a plain `TransitionMode` string:
```typescript
function normalizeTransition(t: TransitionMode | SectionTransitionConfig): SectionTransitionConfig {
    if (typeof t === 'string') {
        return {
            id: `transition-default`,
            mode: t,
            startOffsetBeats: t === 'instant' ? 0 : t === 'fade' ? 2 : 0,
            endOffsetBeats: t === 'instant' ? 0 : t === 'fade' ? 2 : 0,
            participatingModules: [],
            fadeCurve: 'linear',
            editable: true,
            locked: false,
        };
    }
    return t;
}
```

---

## Summary of Build Order

| Phase | Week | Deliverable | Key Files |
|---|---|---|---|
| **Phase 1: Harmonic Module** | 1-2 | Hexagon card, chord timeline, voicing/filter/scale-snap editor, clock wiring | `HarmonicModuleCard.tsx`, `DiatonicHexagon.tsx`, `ChordTimelineMinimap.tsx`, `HarmonicModuleEditor.tsx`, harmony slice, clock subscriber |
| **Phase 2: Transition Module** | 3-4 | First-class transition type, visual editor, per-module behavior, trapezoid UI | Transition types in `types/index.ts`, `TransitionEditor.tsx`, `SectionTimeline.tsx` update, transition slice |
| **Phase 3: Effects Engine** | 5 | Tone.js effects chain per module, editor UI, effect presets | `effectsEngine.ts`, `EffectsEditor.tsx`, `EffectsBadge.tsx`, effect types |
| **Phase 4: Persistence + Polish** | 6-8 | SongObject save/load, assign-clip flow, expression wiring, undo/redo, preset expansion | `songSlice.ts` persistence, `ClipBrowser.tsx` assignment, expression hooks, undo middleware, `presets.ts` |

Each phase is independent and layered. Phase 2 does not depend on Phase 1 (they touch different parts of the codebase). Phase 3 depends on neither. Phase 4 touches all stores but is independent of UI components.