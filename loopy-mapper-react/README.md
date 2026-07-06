# Loopy Mapper — Browser Music Workstation

A standalone browser-based looper, sequencer, and music workstation built with React 19, Tailwind v4, Tone.js, Web Audio API (AudioWorklet), and WebMIDI. Originally a Loopy Pro mapping generator, now a complete self-contained music production environment.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Chrome/Safari)                 │
│                                                             │
│  ┌──────────┐  ┌──────────────────────────────────────┐    │
│  │ WebMIDI  │─▶│  MidiRouter → SynthEngine (Tone.js)  │    │
│  │ (hw ctrl)│  │  or LooperEngine (AudioWorklet)      │    │
│  └──────────┘  └──────────────┬───────────────────────┘    │
│                               │                             │
│  ┌──────────┐  ┌──────────────▼───────────────────────┐    │
│  │ Tone.js  │  │  TransportClock (rAF + perf.now())    │    │
│  │ Sampler  │  │  → position, beat, bar, tick          │    │
│  └──────────┘  └──────────────┬───────────────────────┘    │
│                               │                             │
│  ┌──────────┐  ┌──────────────▼───────────────────────┐    │
│  │ FastAPI  │  │  Zustand Store                        │    │
│  │ Backend  │  │  (song, transport, engine, ui,         │    │
│  │ :8766    │  │   modules, clips, drums)              │    │
│  └──────────┘  └──────────────┬───────────────────────┘    │
│                               │                             │
│                    ┌──────────▼───────────────────────┐    │
│                    │  React 19 + Tailwind 4 UI         │    │
│                    │  ┌─────────────────────────┐     │    │
│                    │  │ DrumModuleCard          │     │    │
│                    │  │ (sample pads, sequencer) │     │    │
│                    │  ├─────────────────────────┤     │    │
│                    │  │ SectionTimeline          │     │    │
│                    │  │ (arrangement blocks)     │     │    │
│                    │  ├─────────────────────────┤     │    │
│                    │  │ MidiSequencerPanel       │     │    │
│                    │  │ (16-step grid)           │     │    │
│                    │  ├─────────────────────────┤     │    │
│                    │  │ DrumKitBrowser           │     │    │
│                    │  │ (196 hardware kits)      │     │    │
│                    │  ├─────────────────────────┤     │    │
│                    │  │ ClipBrowser              │     │    │
│                    │  │ (MIDI dataset search)    │     │    │
│                    │  ├─────────────────────────┤     │    │
│                    │  │ ModuleSettingsPanel      │     │    │
│                    │  │ (Tier 2 structured editor)│    │    │
│                    │  └─────────────────────────┘     │    │
│                    └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### Rhythm / Drum Modules
- **Loop, Fill, Clip** modes with color-coded toggle pills (dark red / red / orange-red)
- **Sample-based drum pads** with one-shot or gate trigger modes
- **8-track, 4-track, and 2-track presets** with dynamic pad grids
- Auto-assigned **mineral pattern names** (Quartz, Onyx, Jasper, Flint...)
- Per-pad **IN/OUT routing** — Sample, MIDI Clip, Live MIDI, Audio Input
- Rotary knobs for Volume, Sample Start, Duration
- Mute/Solo per track with mute groups
- Fill expression with configurable trigger (every N repeats)

### Step Sequencer
- 16-step grid with velocity levels (color-coded green/yellow/orange/red)
- Slides up from bottom toolbar — contextual to selected drum pad
- Follows `TransportClock` for playhead position
- Fires `SynthEngine` (Tone.Sampler or PolySynth) on active steps
- Save pattern as `MidiEvent[]` to track

### Drum Kit Browser
- **196 hardware drum machines** served from local `/Users/Matthew/Drums` directory
- `/api/drums` FastAPI endpoint for kit listing + WAV streaming
- Searchable kit list with sample count
- Per-sample **preview** via temporary `Tone.Sampler`
- **MIDI note dropdown** — assign any sample to any pad in one click

### MIDI Clip Library
- FastAPI backend scanning e-gmd/Tegridy datasets
- SQLite database with key, scale, density, micro-timing features
- Filterable search (key, scale, dataset, density range)
- Client-side MIDI parsing → Tone.js PolySynth preview

### Song Structure
- **Section Timeline** — drag-resizable section blocks with module badges
- **Assign mode** — click module "Section" button, then click section blocks to assign
- Chord progression editor per section
- **JSON Schema** (`schemas/song-object.schema.json`) for import/export
- Song Object API (`/api/songs`) — validate, import, export endpoints
- Song metadata: artist, genre, tags, duration, difficulty
- Per-section lyrics with timestamps (LRCLIB-compatible)
- Provenance tracking for AI-generated structures

### Transport & Clock
- `TransportClock` driven by `performance.now()` + `requestAnimationFrame`
- Independent of Tone.Transport for position (avoids stuck playhead bugs)
- BPM synced to Tone.Transport for audio scheduling
- Section context synchronized on play and section jumps
- Metronome click via SynthEngine on beat boundaries

### Module Settings (Tier 2 Editor)
- Opens in right sidebar when gear icon is clicked on a module card
- Identity: Name, Pattern Name, Size
- Module: Bus routing, Quantization (7 levels), Base MIDI Note
- Rhythm Mode: Loop/Fill/Clip toggle
- Expression: Fill enabled, trigger interval, duration
- Per-track (expandable accordions):
  - Label, MIDI Note, Pan slider, Volume slider
  - Loop Behavior (Toggle / Record→AutoPlay / Record→Wait / One-Shot)
  - Volume Ramp (5ms–500ms)
  - Actions checklist (Record, Play/Stop, Overdub, Clear, Mute, Solo, Reverse, Multiply, Divide, Peel)
  - Mute Group
- Save as Custom Preset (localStorage)

## Run Locally

### Backend (Python/FastAPI)
```bash
cd loopy-mapper-react

# Create virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Ingest MIDI datasets (optional — place .mid files in datasets/)
python -m backend.ingest.scanner --dataset-dir ./datasets

# Start server
uvicorn backend.main:app --reload --port 8766
```

### Backend Without Virtual Environment
```bash
cd loopy-mapper-react
pip install fastapi uvicorn pretty_midi python-multipart
uvicorn backend.main:app --reload --port 8766
```

### Frontend (React/Vite)
```bash
cd loopy-mapper-react
npm install
npm run dev
# → http://localhost:5173/
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/clips` | GET | Filtered MIDI clip search (key, scale, density, dataset) |
| `/api/clips/{id}` | GET | Single clip metadata |
| `/api/clips/{id}/stream` | GET | Raw MIDI binary stream |
| `/api/drums` | GET | List all drum kits (196 kits) |
| `/api/drums/{kit}` | GET | List samples in a kit |
| `/api/drums/{kit}/{sample}` | GET | Stream WAV audio |
| `/api/songs/schema` | GET | Song Object JSON Schema |
| `/api/songs/validate` | POST | Validate a song object |
| `/api/songs/import` | POST | Import a `.songobject.json` file |
| `/api/songs/export` | POST | Generate song template |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React 19, Tailwind v4, Lucide Icons, Radix UI primitives |
| **State** | Zustand (7 slices: song, transport, engine, ui, modules, clips, drums) |
| **Audio** | Tone.js (PolySynth, Sampler, Transport), Web Audio API (AudioWorklet) |
| **MIDI** | WebMIDI API, client-side MIDI file parser |
| **Backend** | Python FastAPI, SQLite, pretty_midi (feature extraction) |
| **Build** | Vite 8, TypeScript 6 |

## Project Structure

```
loopy-mapper-react/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── routes/
│   │   ├── clips.py               # MIDI clip search/stream API
│   │   ├── songs.py               # Song Object import/export API
│   │   └── drums.py               # Drum kit browse/stream API
│   └── ingest/
│       └── scanner.py             # MIDI dataset feature extractor
├── schemas/
│   └── song-object.schema.json    # JSON Schema for Song Object format
├── src/
│   ├── App.tsx                    # Root layout
│   ├── types/
│   │   └── index.ts               # Complete TypeScript domain model
│   ├── store/
│   │   ├── store.ts               # Zustand store composition
│   │   ├── songSlice.ts           # Modules, sections, metadata
│   │   ├── transportSlice.ts      # Play/stop, BPM, section jumps
│   │   ├── engineSlice.ts         # Audio/MIDI engine lifecycle
│   │   ├── uiSlice.ts             # Modal, panel, editor state
│   │   ├── moduleStateSlice.ts    # Per-module runtime state
│   │   ├── clipBrowserSlice.ts    # Clip search/filter state
│   │   └── presets.ts             # Module presets + pattern names
│   ├── lib/
│   │   ├── transportClock.ts      # rAF-based transport clock
│   │   ├── synthEngine.ts         # Tone.js PolySynth + Sampler manager
│   │   ├── midiRouter.ts          # WebMIDI dispatch hub
│   │   ├── audio-worklet.ts       # AudioWorklet looper engine
│   │   ├── audio-preview.ts       # MIDI file parser + preview
│   │   ├── api.ts                 # FastAPI client
│   │   ├── expressionEngine.ts    # Expression/fill trigger logic
│   │   ├── arrangementEngine.ts   # Section transition engine
│   │   └── utils.ts               # Utility functions
│   ├── hooks/
│   │   └── useEngineInitialization.ts  # Audio/MIDI init hook
│   └── components/
│       ├── modules/
│       │   ├── DrumModuleCard.tsx      # Full drum module with pads, transport
│       │   └── ModuleCardRenderer.tsx  # Dispatcher to correct card type
│       ├── canvas/
│       │   ├── SongCompositionCanvas.tsx  # Infinite pan/zoom canvas
│       │   ├── SectionTimeline.tsx        # Section blocks with module badges
│       │   ├── TimelineRuler.tsx          # Beat/bar ruler with playhead
│       │   ├── PlayheadOverlay.tsx        # Playhead position indicator
│       │   └── CanvasToolbar.tsx          # Song metadata, BPM, transport
│       ├── editor/
│       │   ├── ModuleSettingsPanel.tsx    # Tier 2 structured module editor
│       │   └── MidiSequencerPanel.tsx    # 16-step MIDI sequencer
│       ├── browser/
│       │   ├── ClipBrowser.tsx           # MIDI clip search browser
│       │   └── DrumKitBrowser.tsx        # Drum kit sample browser
│       └── layout/
│           ├── LeftNav.tsx               # Sidebar navigation
│           ├── InfoPanel.tsx             # Right sidebar (arrangement + editor)
│           └── BottomToolbar.tsx         # Status bar
└── datasets/
    └── downloads/                 # Sample MIDI files for testing