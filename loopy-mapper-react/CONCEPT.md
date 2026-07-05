# Loopy Mapper React — Standalone Browser Looper & Music Workstation

## Concept Overview

This project started as a YAML-to-Loopy-Pro project generator but evolved into a **fully self-contained browser-based music workstation** that replaces the need for Loopy Pro (or any external DAW) entirely. It runs in Chrome/Safari on desktop or iPad, uses the Web Audio API's AudioWorklet for sample-accurate audio recording/playback, WebMIDI for hardware controller integration, and React 19 + Tailwind 4 for the UI.

The core philosophy is **"Song as an Object"** — a single unified JSON schema that holds all tracks, arrangement, harmony context, MIDI maps, and audio clips in one portable structure. No project files, no zip bundles, no iOS import gymnastics. Open the app, plug in a controller, and make music.

The `.md` reference document that guided this development (in the `ipad/docs/` directory) contains extensive analysis of Loopy Pro's internal serialization, decompiled action matrices, canvas layout coordinate systems, CSS Grid translation layers, and the Web Audio API's AudioWorklet architecture. All of that research is directly implemented here.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Chrome/Safari)              │
│                                                         │
│  ┌────────────┐    ┌──────────────────────────────┐    │
│  │  WebMIDI   │───▶│   AudioWorklet Looper        │    │
│  │ (hardware  │    │   (8 tracks, isolated thread) │    │
│  │  control.) │    │   record/play/loop/clear      │    │
│  └────────────┘    └──────────┬───────────────────┘    │
│                               │                        │
│  ┌────────────┐    ┌──────────▼───────────────────┐    │
│  │  Tone.js   │    │   Zustand Store              │    │
│  │  preview   │    │   (tracks, UI state,         │    │
│  │  engine    │    │    MIDI mappings, config)    │    │
│  └────────────┘    └──────────┬───────────────────┘    │
│                               │                        │
│  ┌────────────┐    ┌──────────▼───────────────────┐    │
│  │  @tonaljs  │    │   React 19 + Tailwind 4 UI    │    │
│  │  harmony   │    │                               │    │
│  │  engine    │    │   ┌───────────────────────┐   │    │
│  └────────────┘    │   │ GeometricMusicCard   │   │    │
│                    │   │ (SVG polygon rhythm  │   │    │
│  ┌────────────┐    │   │  + diatonic hexagon) │   │    │
│  │ FastAPI    │───▶│   ├───────────────────────┤   │    │
│  │ Backend    │    │   │ MasterArranger       │   │    │
│  │ (e-gmd,    │    │   │ (BPM, transitions,   │   │    │
│  │  tegridy   │    │   │  slave linkage)      │   │    │
│  │  datasets) │    │   ├───────────────────────┤   │    │
│  └────────────┘    │   │ ClipBrowser          │   │    │
│                    │   │ (filterable grid,    │   │    │
│                    │   │  inline audio prev.) │   │    │
│                    │   └───────────────────────┘   │    │
│                    └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

       ▼ Integration Point for Songwriting Agent ▼
  ┌─────────────────────────────────────────────────────┐
  │  "Song-as-Object" JSON Schema                       │
  │                                                     │
  │  {                                                   │
  │    song_metadata: { title, bpm, time_signature },    │
  │    instruments: [ { name, type, url } ],              │
  │    tracks: [ { id, clips, volume, fx } ],            │
  │    arrangement: [ { section, bars, transitions } ],   │
  │    harmony: { key, scale, cadence_engine, chords },  │
  │    midi_mappings: [ { pad, note, action } ],         │
  │    audio_clips: [ { id, buffer, start, end } ]       │
  │  }                                                    │
  └─────────────────────────────────────────────────────┘
```

---

## What Has Been Built

### 1. AudioWorklet Looper Engine (`src/lib/audio-worklet.ts` + `public/looper-processor.js`)

**File:** `src/lib/audio-worklet.ts` (346 lines) + `public/looper-processor.js` (121 lines)

This is the heart of the app — a multi-track audio looper running on the browser's dedicated audio rendering thread via the AudioWorklet API. It replaces what Loopy Pro does natively on iOS.

**Key capabilities:**

| Feature | Implementation |
|---------|---------------|
| **8 independent tracks** | Each has its own `AudioWorkletNode` + `GainNode`, controlled independently |
| **Sample-accurate recording** | Audio is captured on the worklet thread via `process()` — no UI thread blocking. Buffer accumulates Float32 samples |
| **Flawless loop playback** | Play index wraps around with `(playIndex + 1) % loopLength` — zero-gap looping |
| **Record → Auto-play** | When recording stops, the track automatically starts looping playback |
| **Volume per track** | `GainNode.linearRampToValueAtTime()` for click-free volume changes |
| **Clear/reset** | Flushes buffer, resets playhead, stops all states |
| **WebMIDI hardware routing** | `handleMidiCommand(status, data1, data2)` — Note 36-43 (standard drum pad range) maps to tracks 0-7 record-toggle. CC7 maps to track volume |
| **State notifications** | `onTracksChange(callback)` for React UI sync — fires whenever any track's `isRecording`, `isPlaying`, `hasContent`, or `volume` changes |
| **Blob fallback** | If the public file can't load, falls back to an inlined base64 blob |

**Control commands** (sent via `node.port.postMessage()`):
```
record_start | record_stop | record_toggle
play_start   | play_stop   | play_toggle
clear        | set_loop    | get_state
```

**The dedicated processor file** (`public/looper-processor.js`) also includes:
- `get_state` command that replies with current buffer stats (isRecording, isPlaying, loopLength, bufferSize)
- `sampleRate` constant access via global `sampleRate`
- Register callback via `registerProcessor('looper-processor', LooperProcessor)`

### 2. MIDI Preview Engine (`src/lib/audio-preview.ts`) — 225 lines

A complete **client-side MIDI file parser + Tone.js PolySynth playback engine** for zero-latency preview of MIDI clips directly in the browser.

**Features:**
- **Full MIDI binary parser**: Reads standard MIDI file format (MThd header, MTrk chunks, variable-length quantities, running status, tempo meta events, note-on/note-off with velocity)
- **Tone.js PolySynth playback**: 8-voice polyphonic triangle-wave synth with envelope (attack 5ms, decay 100ms, sustain 0.3, release 500ms)
- **Singleton engine**: `audioPreview.previewClip(midiArrayBuffer, tempo)` — call from any component
- **Auto-stop**: Automatically stops after the clip's duration
- **Stop/playing state**: `.stop()` and `.playing` getter for UI feedback

### 3. Python FastAPI Backend (`backend/`)

**Files:** `backend/main.py`, `backend/routes/clips.py`, `backend/ingest/scanner.py`

A Python backend that ingests massive MIDI datasets (e-gmd, Tegridy) and exposes them over a fast SQLite-backed JSON API.

| Component | Description |
|-----------|-------------|
| **Scanner** | Walks dataset directories, extracts per-file: SHA256 ID, key (pitch class histogram heuristic), scale (major/minor/dominant via third detection), note density (notes/beat), micro-timing deviation, tempo, time signature, bar length, pitch class vector. Stores to SQLite. |
| **API — `GET /api/clips`** | Filtered paginated search. Filters: `key`, `scale`, `min_density`, `max_density`, `dataset` (e-gmd/tegridy), `min_bars`, `max_bars`. Returns `{ total, limit, offset, clips: [...] }` |
| **API — `GET /api/clips/{id}`** | Single clip metadata |
| **API — `GET /api/clips/{id}/stream`** | Raw MIDI binary streaming for browser playback |
| **API — `GET /api/health`** | Health check |
| **CORS** | Configured for `localhost:5173` (Vite dev) and `localhost:8765` (vanilla app) |

### 4. Clip Browser UI (`src/components/browser/ClipBrowser.tsx`) — 310 lines

A filterable, paginated grid of MIDI clips with inline audio preview, built for the songwriter to discover and audition loops from the e-gmd/Tegridy dataset library.

**UI Controls:**
- Key filter dropdown (C, C#, D, ... B, All)
- Scale filter dropdown (major, minor, dominant, All)
- Dataset filter (e-gmd, tegridy, All)
- Density filter (Any, Sparse < 2 n/b, Medium 2-5, Dense 5-10)
- Search button + result count
- Pagination (previous/next/page numbers, up to 7 pages visible)
- Stop Preview button when audio is playing

**Clip Cards** show:
- File name (parsed from path)
- Metadata tags: detected key + scale, density label, bar count, dataset name
- Mini density bar (visual width = `note_density / 10 * 100%`)
- Footer: BPM, time signature, note count
- Hover play button → loading spinner → live audio preview

**Preview flow**: Click card → `fetchMidiBinary(clipId)` → parse binary client-side → `audioPreview.previewClip(buffer, tempo)` → Tone.js PolySynth plays instantly.

### 5. Geometric Music Card (`src/components/geometric/GeometricMusicCard.tsx`) — 246 lines

A visual component that moves away from standard DAW square grids. Represents rhythmic time as SVG polygon shapes and harmonic space as a diatonic hexagon.

**Rhythmic Loop Panel (left):**
- **Square** (4 vertices) — 4-beat phrase / 4-bar loop
- **Hexagon** (6 vertices) — 6-beat compound time (6/8 groove)
- **Octagon** (8 vertices) — 8-beat/8-bar standard phrase
- SVG `<polygon>` with stroked shape, vertex markers (`<circle>` at each point)
- Color-coded border based on relation mode:
  - **Blue** (Harmonic) — `stroke-blue-500`
  - **Red** (Rhythm) — `stroke-red-500`
  - **Green** (Arrangement) — `stroke-green-500`
- Beat selector buttons at bottom (4/6/8)

**Diatonic Matrix (right):**
- **Center**: Root "I" button — round, prominent
- **6 surrounding vertices** positioned in hexagon layout (SVG absolute coordinates):
  - ii°, iii, IV, V, vi, vii°
- Each vertex is a clickable button that updates the selected degree
- Background web lines: hexagon polygon + lines from center to each vertex
- Degree label at bottom: "Degree: I/ii/iii/IV/V/vi/vii°"

**Top badges**: Harmonic / Rhythm / Arrangement toggle — switches the color scheme and visual context.

### 6. Master Arrangement Conductor (`src/components/geometric/MasterArrangerConductor.tsx`) — 260 lines

A centralized coordination layer that supervises timelines, triggers cross-fade curves, and coordinates slave "Part Cards" (geometric loops) via a programmatic linkage system.

**Three-column layout:**

| Column | Content |
|--------|---------|
| **1. Time & Metric Engine** | BPM slider (60-200), current BPM display, time signature badges (4/4, 6/8), calculated beat phrase display (`beatsPerBar = timeSig.num * (4 / timeSig.denom)`) |
| **2. Transition Matrix** | Three transition modes: **Instant** (hard break immediately), **NextBar** (wait for bar line), **Fade** (crossfade via multi-bus). Selectable cards with descriptions |
| **3. Slave Card Linkages** | List of linked parts with bus color dot (Blue/Red/Green), name, shape, engine type. Click to toggle active/bypass. Active card shows "LINKED" badge |

**Bottom section:** Renders slave part cards that are `active` as miniature cards with:
- Left bus color bar
- Part name + shape badge
- Description showing current active section and transition mode

**Data model** (`LinkedPart` interface):
```
{ id, name, type: "harmonic"|"rhythm"|"arrangement",
  shape: string, bus: "Blue"|"Red"|"Green", active: boolean }
```

**Key metric calculation:** `beatsPerBar = timeSig.num * (4 / timeSig.denom)` — ensures silent padding steps from e-gmd drum variations are fully accounted for during block transitions.

### 7. shadcn/ui Primitives (`src/lib/shadcn.tsx` — needs .tsx extension)

Reusable component primitives wrapping Radix UI + Tailwind v4 + `cn()`:

| Component | Props | Variants |
|-----------|-------|----------|
| **Button** | `variant, size, asChild` | default/ghost/outline/secondary/destructive, sm/default/lg/icon |
| **Badge** | `variant` | default/outline/secondary |
| **Card** | — | Standard card with border, rounded-xl, shadow |
| **CardHeader/Title/Description/Content** | — | Composable card sections |
| **Slider** | `value, onValueChange, min, max, step` | Single-thumb range slider with primary fill |
| **ToggleGroup** | `options, value, onChange` | Pill toggle group with active state |

### 8. TypeScript Types (`src/types/index.ts`) — 110 lines

All shared interfaces for the application:
```
ActionEntry, TargetEntry, ValuePayload, NormalizedAction,
NormalizedBinding, LayoutConfig, DeviceConfig, ProjectConfig,
AppConfig, BuildResult, LayoutWidget, MixerChannel,
LoopyDocument, ProfileBinding, LooperTrack, LooperEventCallback
```

### 9. Utilities (`src/lib/utils.ts`)
- `cn(...inputs)` — Tailwind merge via clsx + tailwind-merge
- `midiToFloat(midiValue)` — Loopy Pro float calibration: sqrt curve where MIDI 64 ≈ 0.707 (unity gain)
- `percentToFloat(percent)` — "70.7%" → 0.707
- `normalizeFloatValue(raw)` — Accepts float, MIDI int (0-127), or percentage string
- `midiHex(n)` — Two-digit lowercase hex for MIDI byte

### 10. API Client (`src/lib/api.ts`)
- `searchClips(filters)` — `/api/clips?key=...&scale=...`
- `getClip(id)` — `/api/clips/{id}`
- `fetchMidiBinary(id)` — Fetch raw MIDI bytes for Tone.js preview
- `getStreamUrl(id)` — Construct stream URL

### 11. Vanilla JS App (for reference, in `ipad/web/loopy-mapper/`)
The original prototype is still functional:
- YAML → Loopy Pro `.controllerprofile` XML generator
- 52 verified actions in the action library
- `valuePayload` support for Adjust Parameter with float calibration
- `canvasLayout` + `mixerChannels` generation
- ZIP export without JSZip dependency
- `.lpproj` decoder tool

This codebase contains all the reverse-engineered Loopy Pro serialization knowledge that informed the React migration.

---

## Integration Points for the Songwriting Agent

The songwriting system needs to consume/produce the following data structures and API calls to integrate with this looper:

### To Consume (from this app):
1. **`LooperTrack[]`** via `looperEngine.getTracks()` or `onTracksChange()` callback — current state of all 8 loop tracks (isRecording, isPlaying, hasContent, volume)
2. **Audio buffer** access — The raw Float32Array buffers in each AudioWorkletNode could be extracted via `get_state` message for song export
3. **MIDI clip metadata** via `searchClips()` API — key, scale, density, tempo, pitch class vectors
4. **Geometric state** — active beats (4/6/8), selected degree, relation mode, active section, transition mode, slave part linkages
5. **BPM and time signature** from the MasterArrangerConductor

### To Provide (to this app):
1. **Harmony progression** — A `{ chords: [{ degree, quality, duration }] }` object that feeds the GeometricMusicCard's diatonic matrix and the arrangement conductor's section transitions
2. **Song structure** — Section definitions (Intro, Verse, Chorus, Bridge) with bar counts and transition types
3. **MIDI clip selection logic** — Which clips from the dataset to preview/load based on current key, scale, and section
4. **Export schema** — The unified "Song-as-Object" JSON format that packages tracks, arrangement, harmony, MIDI maps, and audio clips into a single portable file

### Shared Data Structures (to align):

```typescript
// Proposed shared SongObject schema
interface SongObject {
  metadata: {
    title: string;
    bpm: number;
    timeSignature: { num: number; denom: number };
    key: string;
    scale: string;
  };
  tracks: SongTrack[];
  arrangement: SongSection[];
  harmony: HarmonyState;
  midiBindings: MidiBinding[];
  audioClips: AudioClipRef[];
}

interface SongTrack {
  id: number;
  name: string;
  clips: TrackClip[];
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  fxBus: "harmonic" | "rhythm" | "arrangement";
}

interface SongSection {
  name: string; // "Intro" | "Verse" | "Chorus" | "Bridge"
  bars: number;
  transition: "Instant" | "NextBar" | "Fade";
  chordProgression: ChordStep[];
  activeTracks: number[]; // track IDs active in this section
}

interface ChordStep {
  degree: number;     // 1-7 scale degree
  quality: "maj" | "min" | "dim" | "aug" | "dom7" | "maj7" | "min7";
  duration: number;   // in bars
}

interface HarmonyState {
  key: string;        // "C", "D#", etc.
  scale: string;      // "major" | "minor" | "dominant"
  activeChord: ChordStep;
  cadenceEngine: {
    type: "authentic" | "plagal" | "deceptive";
    from: string;     // scale degree
    to: string;       // scale degree
  };
}
```

---

## Getting Started

### Prerequisites
- **Node.js** 20+ (for frontend)
- **Python** 3.10+ (for backend — optional, only if you need dataset search)
- **Chrome** or **Edge** (for WebMIDI + AudioWorklet support; Safari works but WebMIDI is limited)

### Run
```bash
# Terminal 1: Frontend
cd loopy-mapper-react
npm install
npm run dev
# → http://localhost:5173/

# Terminal 2: Backend (optional)
cd loopy-mapper-react
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8766
# → http://localhost:8766/api/health
```

### Key Files for Integration

| File | Purpose |
|------|---------|
| `src/lib/audio-worklet.ts` | Looper engine class — the main API the songwriting system will call |
| `src/lib/api.ts` | Clip search/stream API client |
| `src/lib/audio-preview.ts` | MIDI preview engine |
| `src/components/geometric/MasterArrangerConductor.tsx` | Arrangement state (BPM, time sig, sections, transitions) |
| `src/components/geometric/GeometricMusicCard.tsx` | Harmonic space visualizer (diatonic hexagon) |
| `src/types/index.ts` | All TypeScript interfaces |
| `public/looper-processor.js` | AudioWorklet processor (worklet thread) |
| `backend/routes/clips.py` | Dataset search API |
| `ipad/docs/oopy Pro handles action serialization...md` | Full decompiled Loopy Pro reference |