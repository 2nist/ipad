# Loopy Mapper → Browser Looper Engine

This project evolved from a Loopy Pro mapping generator into a **standalone browser-based looper and music workstation** — built with React 19, Tailwind v4, Web Audio API (AudioWorklet), Tone.js, and WebMIDI.

## Core Architecture

```
[Physical Mic/Instrument] ──> MediaStream
       │
       ▼
[AudioWorkletNode (8 tracks)] ──> WebAudio Destination
       │                              ↑
       │  record/play/loop            │
       ▼                              │
[Zustand Store] ── sync UI ───────────┘
       │
       ├── WebMIDI (hardware controllers)
       ├── MIDI dataset ingest (e-gmd, Tegridy)
       ├── Tone.js preview engine
       └── @tonaljs harmony / SETLE theory
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **AudioWorklet Looper** | `src/lib/audio-worklet.ts` | Multi-track recording/playback on isolated audio thread. 8 tracks with record, play, clear, volume, WebMIDI trigger mapping |
| **MIDI Preview Engine** | `src/lib/audio-preview.ts` | Full client-side MIDI file parser → Tone.js PolySynth playback for instant clip auditioning |
| **FastAPI Backend** | `backend/main.py` | Scans e-gmd/Tegridy datasets, extracts features (key, scale, density, micro-timing), exposes search/stream API |
| **Clip Browser** | `src/components/browser/ClipBrowser.tsx` | Filterable grid (key/scale/density/dataset) with inline audio preview |
| **Geometric UI** | `src/components/geometric/GeometricMusicCard.tsx` | SVG polygon cards (square=4, hex=6, oct=8 beats) + diatonic hexagon with interactive scale-degree selection |
| **Arrangement Conductor** | `src/components/geometric/MasterArrangerConductor.tsx` | Global BPM/time-sig, transition matrix, slave card linkage system |

## Run Locally

### Backend
```bash
cd loopy-mapper-react
pip install -r backend/requirements.txt
python -m backend.ingest.scanner --dataset-dir ./datasets
uvicorn backend.main:app --reload --port 8766
```

### Frontend
```bash
cd loopy-mapper-react
npm run dev
```

Opens at `http://localhost:5173/` — Vite proxies `/api` to the backend on port 8766.

## Next: Complete Browser Looper

The AudioWorklet engine needs the following to become a fully standalone Loopy Pro replacement:

1. **WebMIDI hardware binding UI** — Map MIDI controller pads to track record/play actions
2. **AudioWorkletProcessor file** — The `PROCESSOR_CODE` inline blob should become a real `looper-processor.js` for reliable loading
3. **Loop quantization** — Time-stretch recorded clips to nearest bar boundary
4. **Input routing** — Channel strip per track with gain, pan, mute, solo
5. **Export/Save** — Save sessions as JSON "song objects" for reload
6. **SoundFont/Virtual instrument** — Load `.sf2` via `@spessasynth/soundfont-parser` for MIDI playback
7. **Song-as-Object state** — Single JSON schema containing all tracks, arrangement, harmony, MIDI maps