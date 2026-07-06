# Strategic Codebase Report — Loopy Mapper / iPad Repo

**Date:** 2026-07-06
**Scope:** Full repository — `loopy-mapper-react/` (React frontend + FastAPI backend), `Developstage3/` concept docs, legacy artifacts
**Method:** Full source read of the domain model, all 6 store slices, all 9 engine/lib modules, key components, and backend routes; empirical verification by running `npm run build` and `npx vitest run` on a clean checkout.

---

## 1. Executive Summary & Progress Direction

### What this codebase is trying to build

The repository has pivoted twice, and the code tells that story clearly:

1. **Phase 1 (root `README.md`, gitignored `scripts/`, `tools/`):** an iPad MIDI workshop — Mozaic scripts pushed via git to an iPad running AUM/Drambo.
2. **Phase 2 (legacy types in `src/types/index.ts:775-809`, `src/lib/actionLibrary.ts`):** a **Loopy Pro mapping generator** — YAML/JSON binding compilers for Loopy Pro's action system.
3. **Phase 3 (current, ~95% of active code):** a **standalone browser-based music workstation** — a live-looping, section-based song composer that *replaces* Loopy Pro rather than mapping to it. React 19 + Zustand + Tone.js + AudioWorklet + WebMIDI on the front, FastAPI + SQLite serving MIDI clip datasets and drum-kit samples on the back.

The current trajectory is unambiguous: build a **module-based live composition environment** ("rhythm / harmonic / arrangement" module cards on an infinite canvas, driven by a section timeline with chord progressions, fills, and MIDI hardware control). The `Developstage3/` documents are a genuine product spec, and `src/types/index.ts` (808 lines) implements that spec as a type system with remarkable fidelity.

### Progress level

**Ambitious prototype, pre-MVP.** The verdict is precise, not pejorative:

- The **domain model and engine scaffolding are MVP-grade or better** — the type system, store architecture, and engine separation would not embarrass a production codebase.
- The **integration layer is proof-of-concept** — engines exist but several are wired loosely or not at all (`ExpressionEngine` is imported in `useEngineInitialization.ts` but never instantiated; `VoicingEngine` and `HarmonyEngineCore` are tested but nothing plays chords through them yet).
- The **build is currently red**: `npm run build` fails on a TypeScript 6.0 config deprecation, and behind that sit 16 real type errors in production code. 5 of 32 unit tests fail. Only `vite dev` works. This is the classic signature of a project that iterates in the dev server and has never had CI.

### Engineering direction

The overarching direction is **spec-first, type-first development**: concept docs → types → engines → UI. That discipline is the project's biggest asset. The biggest liability is that verification (build, tests, CI) has not kept up with generation, so regressions accumulate silently.

---

## 2. Current Capabilities (What Works & System Features)

### Fully operational (verified in code and/or tests)

| Capability | Where | Status |
|---|---|---|
| **Domain model** — modules, tracks, sound sources, sound engines, sections, chords, expressions, MIDI bindings, runtime state | `src/types/index.ts` | Complete; the strongest artifact in the repo |
| **Zustand store, 6 composed slices** (song, transport, engine, ui, moduleState, clipBrowser) | `src/store/` | Working; immutable update patterns throughout |
| **Transport clock** — `performance.now()` + rAF, subscriber pattern (`onTick/onBeat/onBar/onStart/onStop`), section-aware position | `src/lib/transportClock.ts` | Working for the happy path (play from zero, fixed BPM) |
| **Synth engine** — Tone.js PolySynth/Sampler voice pool keyed `${moduleId}:${trackIndex}`, per-voice gain, master gain, metronome voice | `src/lib/synthEngine.ts` | Working |
| **MIDI router** — WebMIDI init, hot-plug connect/disconnect, note→track auto-mapping via `baseMidiNote + trackIndex`, explicit binding table, MIDI-learn capture | `src/lib/midiRouter.ts` | Working (with state-mutation caveats, §4) |
| **AudioWorklet looper** — 8 tracks, record/play/clear/volume, inline-blob processor fallback | `src/lib/audio-worklet.ts`, `public/looper-processor.js` | Working core; no quantization or bar-sync yet |
| **Harmony engine** — 9 scales, 7 chord qualities, degree→note resolution, progression stepper, cadence detection, scale-snap (4 modes) | `src/lib/harmonyEngine.ts` | Working; 27/32 tests pass |
| **Voicing engine** — 7 voicing strategies, voice-leading | `src/lib/voicingEngine.ts` | Implemented; 3 tests fail on octave math (see §4) |
| **Step sequencer** — 16-step grid, 4 velocity tiers, transport-following playhead, live audition | `src/components/editor/MidiSequencerPanel.tsx` | Works while the panel is open; pattern persistence is broken (§4) |
| **Drum module card** — pad grid, per-track IN/OUT routing menus, rotary knobs, mute/solo, fill expression config, clip chain UI | `src/components/modules/DrumModuleCard.tsx` (751 lines) | Working UI |
| **Section timeline** — drag-resizable sections, module-to-section assign mode, per-section chord progression, lyrics | `src/components/canvas/`, `songSlice` | Working |
| **Drum kit browser** — FastAPI kit listing + WAV streaming, per-sample preview, one-click pad assignment | `DrumKitBrowser.tsx` + `backend/routes/drums.py` | Working (with a path-traversal hole, §4) |
| **MIDI clip search** — SQLite-backed filtered search (key/scale/density/dataset), paginated, parameterized SQL | `backend/routes/clips.py`, `backend/ingest/scanner.py` | Search works; the **stream endpoint is broken** (§4) |
| **Song Object import/export** — JSON Schema, validation endpoints, file export with provenance tracking | `schemas/song-object.schema.json`, `backend/routes/songs.py`, `songSlice.exportSong` | Working |
| **Template composer** — 5 genre song-structure templates, chord progression suggestion, tag-based module auto-assignment | `src/lib/aiComposer.ts` | Working (deterministic templates; "AI" is aspirational naming) |

### Architecture patterns in place

- **Engines live outside React** as module singletons (`synthEngine`, `looperEngine`) or factory-created classes (`TransportClockImpl`, `MidiRouter`, `ArrangementEngine`), receiving the store via a `() => store` thunk. This is the correct shape for real-time audio in a React app.
- **Persisted state vs. runtime state** are cleanly split: `song` (serializable, exportable) vs. `moduleStates` (transient runtime), which makes save/load coherent by construction.
- **Clock-subscriber fan-out**: transport events propagate to the store, metronome, arrangement engine, and UI through one subscription mechanism instead of ad-hoc polling.

---

## 3. What Was Done Right (Engineering Wins)

1. **The type system is a real domain model, not decoration.** Discriminated unions are used exactly where they pay off: `SoundSource` (4 variants), `SoundEngine` (3 variants), `ModalDialog` / `EditorPanel` (tagged UI states), `ModuleExpression` (3 variants). Numeric literal unions for `TimeSignatureNumerator/Denominator` prevent nonsense values at compile time. When the wiring catches up, this model will carry the product a long way.

2. **The pivot away from `Tone.Transport` for position tracking was diagnosed, documented, and executed.** `transportClock.ts:1-5` states the reasoning; commit `aa24c42` ("Transport clock fixes") and the inline comment in `transportSlice.jumpToSection` (lines 171-175) show a real bug (playhead wrapping every 8 bars regardless of section length) being root-caused and fixed with the *why* recorded in place. This is mature debugging hygiene.

3. **Defensive guards born from real failures.** `globalPlay` refuses to set `isPlaying` when no clock exists (`transportSlice.ts:66-71`) with a comment explaining the exact failure mode it prevents. The Sampler voice creation skips empty URLs and defers voice creation until a sample is assigned (`synthEngine.ts:108-135`). These show the loop of test→fail→harden actually running.

4. **The store slice pattern is applied correctly.** All slice actions use immutable spread updates; slices declare their action interfaces against a shared `LooperStoreActions` contract; `store.ts` composes them in one place. `moduleStateSlice` is a textbook example of clean nested immutable updates.

5. **The backend is small and disciplined.** Parameterized SQL everywhere in `clips.py` (no injection), Pydantic response models, env-var-overridable paths (`DRUMS_ROOT`, `MIDI_LIBRARY_DB`), cache headers on sample streaming, routers split by resource. `scanner.py` separates ingest from serving. This is the right size of backend for the job.

6. **Tests target the right layer.** The 32 tests in `src/__tests__/harmonyEngine.test.ts` cover the *pure* logic (harmony math, voicing, clock arithmetic, polygon geometry) — the part of an audio app that is actually unit-testable. The instinct of what to test is correct even though the suite is currently red.

7. **Documentation is unusually honest.** `Developstage3/ANALYSIS_REPORT.md` is a prior self-audit that correctly identifies most gaps; the `loopy-mapper-react/README.md` architecture diagram matches the actual code. Concept docs → implementation traceability is explicitly maintained (the types file header lists its source documents).

8. **`.gitignore` archaeology was done** (commit `5da89ad`): legacy directories were fenced off deliberately rather than deleted, keeping the repo navigable while preserving reference material locally.

---

## 4. Potential Problems & Technical Debt (Risk Assessment)

Ordered by severity.

### 4.1 The build is broken — three independent ways (verified)

`npm run build` fails immediately: TS 6.0 rejects the deprecated `baseUrl` in `tsconfig.app.json`. Silencing that surfaces **16 genuine type errors in production code**:

- `transportSlice.ts` — 8 errors: the slice is typed as `StateCreator<LooperStore, ...>` but calls sibling-slice actions (`setSongMetadata`, `jumpToSection`, `updateSection`) that only exist on the composed `LooperStoreType`. The slice typing pattern is wrong for cross-slice calls.
- `songSlice.ts:391` — `newSong()` rebuilds the `ui` object by hand and is missing `drumBrowserOpen`. This hand-rolled reset object is a maintenance trap: every new UI field must be remembered in a second place (it already wasn't).
- `GeometricMusicCard.tsx` / `MasterArrangerConductor.tsx` — import `../../lib/shadcn`, **a module that does not exist in the repo**. These two components are also imported by nothing; they are dead code that breaks the build.
- `audio-preview.ts:44` — `Tone.Part` callback typed incorrectly.

**Consequence:** no deployable artifact can be produced from this repo today, and type checking has been effectively off for weeks of commits.

### 4.2 The test suite is red (verified: 5 of 32 fail)

- `resolveChord` octave math disagrees with its own test (`chordTones` off by an octave — either the engine or the test encodes the wrong MIDI octave convention; pick one).
- 3 `VoicingEngine` tests fail on inversion/doubling expectations.
- `setBpm clamps to valid range` fails because `TransportClockImpl.setBpm` unconditionally touches `Tone.Transport.bpm.value` — the "self-contained" clock has a hard Tone.js dependency, so it can't run in a node test environment. The clock is not actually decoupled from Tone.

### 4.3 Timing architecture will not hold under real use

This is the deepest *product* risk, because the entire product is timing.

- **BPM changes while playing teleport the playhead.** `getPosition()` computes `absoluteBeat = totalElapsedWallSeconds / secondsPerBeat` (`transportClock.ts:123-127`). Changing BPM rescales *all* elapsed time, so the position jumps proportionally. The clock must accumulate beats incrementally (`beats += delta / spb`), not divide total elapsed time.
- **No pause.** `getPosition()` returns beat 0 whenever stopped; stop discards position. Resume-from-position is impossible in the current design.
- **Audio events are fired from UI-thread timers.** The metronome fires `noteOn` inside an rAF callback with a `setTimeout(50)` note-off (`useEngineInitialization.ts:97-100`); the step sequencer fires notes from a React `useEffect` watching `position.beatInBar` (`MidiSequencerPanel.tsx:47-65`). rAF is throttled in background tabs and jitters under load — steps will smear and drop. Web audio needs a lookahead scheduler that books events on the `AudioContext` clock ("A Tale of Two Clocks" pattern). The scaffolding for it exists (`scheduleAhead: 0.1, schedulerInterval: 0.025` are passed into the clock config — **and then never used**), as does dead code (`advance()` computes a delta and discards it).
- **Two unsynchronized timelines coexist.** `SynthEngine.playSequence` schedules on `Tone.Transport` while everything else follows `TransportClockImpl`. Nothing starts/stops/aligns Tone.Transport with the custom clock, so any clip playback through `playSequence` will drift freely from the section timeline.
- **Sequencer audio only exists while its panel is mounted.** Pattern playback lives in `MidiSequencerPanel`'s effect; close the panel and the pattern stops. Playback belongs in an engine, not a component.

### 4.4 Store-bypass mutations (correctness bugs waiting to be noticed)

Several places mutate Zustand state directly, silently breaking subscription/re-render guarantees and persistence:

- `MidiRouter.captureLearnBinding`: `store.song.midiBindings.push(binding)` (`midiRouter.ts:393`).
- `MidiRouter.autoGenerateBindings`: `store.song.midiBindings = [...]` (`midiRouter.ts:471`).
- `DrumModuleCard.tsx:478`: `store.ui.rightPanelVisible = true`.
- `midiRouter.ts:263-280`: live-MIDI recording pushes into `soundSource.recordedSequence` in place.

None of these notify subscribers; MIDI-learned bindings won't render and may be lost on the next real `set()`.

### 4.5 Backend security & correctness

- **Path traversal** in `GET /api/drums/{kit}/{sample}` (`drums.py:82-108`): `root / kit_name / sample_name` is served with no containment check. `kit_name=".."` walks out of `DRUMS_ROOT`. Low stakes on localhost, disqualifying the moment this is deployed. Fix: `resolved = (root/kit/sample).resolve(); assert resolved.is_relative_to(root.resolve())`.
- **`GET /api/clips/{id}/stream` is broken 100% of the time**: it opens a raw connection *without* `row_factory = sqlite3.Row` and then does `row["file_path"]` (`clips.py:159-168`) — a `TypeError` on tuples. Client-side MIDI preview cannot work against this code. (It also duplicates the `get_db` dependency instead of using it.)
- Default `DRUMS_ROOT = "/Users/Matthew/Drums"` is a machine-specific absolute path baked into source.

### 4.6 Type-safety theater at the store boundary

`strict` is **not enabled** in `tsconfig.app.json`, and the meticulous discriminated unions are routinely defeated exactly where they matter: ~25 `as any` casts cluster at sound-source updates (`songSlice.assignClipToTrack`, `setSoundEngine`, `DrumModuleCard` trigger-mode toggles, `MidiSequencerPanel.savePattern`). The pattern `{ ...track.soundSource, soundEngine: engine } as any` can silently attach a `soundEngine` to an `audioInput` source — the union exists to prevent precisely this, and the casts turn it off.

`EngineSlice` types all engines as `unknown | null` while `LooperStore` (types/index.ts:672-678) types them properly — so call sites do ad-hoc structural casts like `(engines.clockEngine as { setSectionContext?: ... })` (`transportSlice.ts:80-81, 177-178`).

### 4.7 Render-performance debt

- `onTick` calls `useLooperStore.setState` **60×/second** with a new `transport` object (`useEngineInitialization.ts:82-90`). Every component selecting anything under `transport` re-renders at 60 fps while playing — `DrumModuleCard` selects `transport.position` (line 348), so every module card re-renders every frame.
- Selector hooks return fresh arrays from `filter()` (`selectors.ts:14-16, 52-60`), re-rendering consumers on *every* store change (no `useShallow`/memoization). `useAllBindings` returns a constant `[]` — dead.
- Every drum-pad click **disposes and recreates the voice** (`DrumModuleCard.tsx:565`, `handlePadClick` → `setVoice`), which for a Sampler means tearing down and refetching sample buffers; the immediate `noteOn` after creation races the sample load and often plays nothing.

### 4.8 Fragile/incomplete logic flagged for the record

- **Arrangement transitions are stubs:** `executeNextBarTransition` is actually instant (`arrangementEngine.ts:131-137`); `executeFadeTransition` uses `setTimeout(1000)` hardcoded as "1 bar at 120 BPM" regardless of BPM (`:154-159`). Section-boundary detection (`onBeat`, `:201`) uses a `>= totalBeats - 1 && beatInBar === 0` heuristic that will double-fire or misfire around loop wraps.
- **`ExpressionEngine` is orphaned:** imported in the init hook but never created or invoked; `repeatCount` is never incremented anywhere, so `everyNRepeats` fills can never fire. `getExpressionEngine()`'s fallback `() => ({} as LooperStoreType)` will crash at first use instead of failing loudly at init.
- **Sequencer "Save Pattern" stores JSON in a field meant for MIDI binary** — `savePattern` TextEncodes a `MidiEvent[]` JSON string into `clipData: ArrayBuffer` (`MidiSequencerPanel.tsx:120-127`); nothing ever reads it back, and reopening the panel resets the grid to empty (`useEffect` at `:40-44`). Users lose every pattern they save.
- **`localStorage` preset I/O has no error handling** — `JSON.parse(localStorage.getItem('user-presets') || '[]')` in three places; one corrupt write bricks the preset system.
- **Init flow requests MIDI access twice** (`engineSlice.initializeEngines` and again in the hook) and `engineSlice` sets `initialized: true` *before* any engine exists — `initialized` doesn't mean what its name says; only the `clockEngine` null-guard prevents a broken play button.
- **Committed `.pyc` files** (`backend/__pycache__/*.cpython-314.pyc`) predate the gitignore and are still tracked.
- **The root `README.md` describes Phase 1** (Mozaic/iPad) and no longer matches the repository's contents.

---

## 5. Paths to Move Away From (Anti-Patterns to Deprecate)

1. **UI-thread audio scheduling (`setTimeout`/rAF → `noteOn`).** Dead end because browsers throttle both aggressively; timing quality will never exceed "demo-grade." Everything scheduled to *sound* must be booked on the `AudioContext` clock via a lookahead scheduler. The rAF loop should survive only for visuals.

2. **Running two transports.** `Tone.Transport` and `TransportClockImpl` both alive is a standing drift generator. Decide: either the custom clock is authoritative and Tone is used purely as a synth library triggered with explicit `time` arguments (recommended — that's the direction the code already leans), or drop the custom clock. Stop straddling.

3. **Direct store mutation escape hatches.** `store.song.midiBindings.push(...)`, `store.ui.rightPanelVisible = true`, in-place `recordedSequence` pushes — each one is a heisenbug. Every state change goes through a slice action, no exceptions; engines get narrow action interfaces, not the raw store.

4. **`as any` at the sound-source/engine boundary.** These casts convert the codebase's best asset (discriminated unions) into noise. Replace with typed helper actions (`updateSampleSource(moduleId, trackIndex, updates: Partial<SampleSource>)`) that narrow before spreading.

5. **Storing live engine instances in Zustand state.** Engines are non-serializable, are typed `unknown` to appease the store, and gain nothing from being in state (nothing re-renders on "the clock object changed"). Move them to a module-level `engineRegistry`; keep only serializable flags (`audioInitialized`, `midiDeviceConnected`) in the store. This also deletes the `unknown`-cast pattern in §4.6.

6. **Hand-rolled full-state reset objects.** `newSong()` re-enumerating every `ui` field is how the `drumBrowserOpen` build break happened. Reset by reusing the slice's exported defaults (`{ ui: { ...DEFAULT_UI } }`), defined once next to the slice.

7. **JSON-smuggled-into-`ArrayBuffer` pattern storage.** Sequencer patterns are first-class domain data; the type system already has `MidiEvent[]` (`LiveMidiSource.recordedSequence`). Store patterns as typed fields on the track and delete the TextEncoder hack.

8. **Dead/orphaned component trees.** `src/components/geometric/*` (build-breaking, unreferenced), `useAllBindings`, `advance()`, `Untitled-1.txt`, tracked `.pyc` files, and the stale root README. Delete them; git remembers.

9. **Machine-specific defaults in source** (`/Users/Matthew/Drums`). Defaults should be repo-relative (`./drums`) with env override — the mechanism already exists, only the default is wrong.

10. **"Fix it in dev server" workflow without CI.** The red build and red tests weren't noticed because nothing runs them. This habit, not any single bug, is the root liability.

---

## 6. Paths to Continue (Strategic Roadmap)

### Priority 0 — Restore a green baseline (1–2 sessions of work)

1. Fix `tsconfig.app.json` (drop `baseUrl`/use relative imports or add `ignoreDeprecations`), fix the 8 slice-typing errors by typing slices against `LooperStoreType` (Zustand's documented cross-slice pattern), fix `newSong`'s ui reset, delete `components/geometric/*`, fix the `audio-preview.ts` callback type.
2. Fix or align the 5 failing tests (decide the octave convention once; inject the Tone dependency into the clock so it's testable).
3. Add CI — a 15-line GitHub Actions workflow running `tsc -b`, `vitest run`, `oxlint`. From this point, red = stop.
4. Fix the two backend one-liners: `row_factory` in `stream_clip`, path containment in `drums.py`.

### Priority 1 — Harden the foundation you already designed

5. **Enable `strict: true`** and burn down the errors (the domain model was written for strict mode; it's mostly the ~25 casts that will surface). Use `zod` — already a dependency, currently unused — to validate `SongObject` on load/import, so the schema is enforced at the trust boundary too.
6. **Rebuild the clock core** (keep the interface, replace internals): accumulate beats incrementally so BPM changes don't teleport; support pause/resume; implement the lookahead scheduler the config already describes; expose `scheduleAt` in AudioContext time. Add clock unit tests for BPM-change-while-playing and pause — the current bugs become regression tests.
7. **Route all state changes through slice actions**; give `MidiRouter` and the engines a narrow typed action interface instead of the whole store.
8. **Move engines out of the store** into a registry module (see §5.5).

### Priority 2 — Close the loop on the core musical experience

9. **Make sequencer patterns first-class**: `pattern: MidiEvent[]` on the track, edited by the panel, played by a `PatternPlaybackEngine` subscribed to the clock — patterns persist, export with the song, and keep playing when the panel closes. This is the single highest user-visible payoff in the backlog.
10. **Wire `ExpressionEngine` and repeat counting**: increment `repeatCount` on module loop boundaries (clock `onBar` + section context), call `shouldFire`/`execute`, and the already-built fill UI becomes real.
11. **Connect `HarmonyEngineCore` + `VoicingEngine` to playback**: on chord-step boundaries, resolve + voice the active chord and drive harmonic-module voices. Both engines are implemented and mostly tested — this is wiring, not research, and it delivers the product's signature feature (chord-following modules).
12. **Finish arrangement transitions properly**: `nextBar` waits for the actual bar callback; `fade` ramps `Tone.Gain` over `defaultFadeBars` at the *current* BPM. Drive both from clock subscriptions, never `setTimeout`.

### Priority 3 — Performance and persistence

13. **Tame the 60 Hz store broadcast**: keep `transport.position` updates for coarse consumers at ~10 Hz; drive playhead visuals via direct DOM/ref updates from a clock subscription (the `PlayheadOverlay` pattern already hints at this). Adopt `useShallow` for array-returning selectors.
14. **Autosave** the `SongObject` to IndexedDB/localStorage (debounced, schema-versioned, zod-validated on load). A looper that loses the song on refresh will not retain users.
15. Stop recreating voices on pad clicks — create voices when sources change (that code path exists in `addModule`/init), and make pad clicks pure `noteOn`.

### What to double-down on

- **Spec → types → engine → UI pipeline.** It is working; keep the Developstage3 docs as the source of truth and keep the traceability comments.
- **Engine/subscriber architecture.** The clock-subscriber fan-out is the right backbone; every new runtime feature (fills, transitions, chord following, looper quantization) should be a clock subscriber, not a component effect.
- **The thin FastAPI backend.** Resist the urge to grow it; it is a local asset server + dataset index, and that's the right scope. If distribution matters later, package it as a local companion process.
- **Pure-logic testing.** Extend the harmony/voicing test style to the clock (post-rewrite), expression triggers, and arrangement boundary math — the parts where bugs are musical and subtle.

---

### Bottom line

This codebase has a professional skeleton — domain model, store discipline, engine separation — wearing a prototype's nervous system. Nothing in the architecture needs to be thrown away; the strategic work is (1) turning verification back on and keeping it on, (2) rebuilding the timing core around the AudioContext clock it was always meant to use, and (3) wiring the three already-built-and-tested engines (expression, harmony, voicing) into playback. Those three moves convert the current demo into the instrument the Developstage3 documents describe.
