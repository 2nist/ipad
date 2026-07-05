# Loopy Mapper

Offline-capable static web app for generating Loopy Pro mapping projects from YAML.

## Run Locally

```powershell
cd C:\Users\User\ipad\ipad\web\loopy-mapper
node serve-local.js
```

Open `http://127.0.0.1:8765/`.

## iPad Flow

Host this folder from a static site such as GitHub Pages, open it once in Safari, then add it to the Home Screen. The service worker caches the app shell and the bundled `drum-looper.lpproj` template for offline use.

Tap **Project Zip** to download a generated `.lpproj.zip`. In Files, unzip it, then open/share the `.lpproj` bundle into Loopy Pro.

## Mapping YAML

The editor is seeded with the current ATOM SQ pad mappings:

```yaml
bindings:
  - label: Kick
    trigger: { kind: note, channel: 10, note: 36 }
    actions:
      - identifier: Track Play/Stop
        subject: "0"
        timing: Sequential
        parameters: {}
```

### Triggers

Loopy encodes triggers as **hex MIDI bytes** `<status><data1><value>` (status nibble
`9`=NoteOn, `b`=CC; low nibble = 0-based channel). The generator builds these for you from
the friendly fields:

- `kind: note` → `{ channel, note }` (e.g. note 36 ch10 → `99247f`)
- `kind: cc` → `{ channel, cc }` (e.g. CC20 ch3 → `b2147f`)
- add `hold: true` for a hold gesture → `h:`-prefixed, value byte dropped (e.g. `h:b214`)
- `raw: "<string>"` to pass a trigger through verbatim

The press value defaults to `127`; matching `127` keeps a CC's release (`0`) from
double-firing.

### Actions

Actions accept a friendly name, alias, or the serialized identifier (`action:` or
`identifier:`), resolved via [loopy-actions.js](loopy-actions.js):

- `clear` → `Clear Track`, `play/stop` → `Track Play/Stop` (both **verified** from real exports)
- All actions in the library have **verified serialized identifiers** harvested from decoded
  `.loopy` exports and the decompiled engine specification.
- Unknown strings export as-is with a warning.

The library now includes **50+ verified actions** covering:
- **Clip actions**: Play, Stop, Play/Stop, Record, Overdub, Clear, Mute, Unmute, Toggle Mute,
  Solo, UnSolo, Toggle Solo, Select, Multiply/Divide Clip Length, Reverse, Peel/Replace Layers,
  Phase Align, Merge/Move, Show Detail Screen, Adjust Clip Playhead, Cancel Count-Ins
- **Parameter adjustment**: Adjust Parameter (track/effect/widget) with value payload support
- **Session/Global**: Toggle Global Play, Global Stop, Global Record, Undo, Redo, New/Load/Save
  Project, Adjust Master Volume, Cancel Pending, Toggle Sequence/Mixer, Open Interface
- **Clock/Transport**: Clock Start/Stop/Continue, Tap Tempo, Set BPM, Nudge Forward/Backward
- **FX**: Toggle Effect, Adjust Effect Parameter
- **Capture**: MIDI/Audio Scene Capture

### `adjustParameter` Value Payload

For `Adjust Parameter`, `Adjust Effect Parameter`, and `Adjust Widget Parameter` actions,
you can supply a value payload to control volume, pan, or any hosted parameter:

```yaml
bindings:
  - label: "Track 1 Volume"
    trigger: { kind: cc, channel: 1, cc: 7 }
    actions:
      - identifier: Track Parameter
        subject: "0"
        adjustment: absolute
        value: 0.707       # unity gain (0 dB)
        ramp_time_ms: 0
```

Or using an explicit `value_payload` block:

```yaml
      - identifier: Track Parameter
        subject: "0"
        value_payload:
          adjustmentType: absolute
          value: 0.707
          rampTimeMs: 0
```

The `value` field accepts:
- A **float** 0.0-1.0 (passes through directly)
- A **MIDI integer** 0-127 (auto-converts via sqrt curve: MIDI 64 ≈ 0.707 unity gain)
- A **percentage string** like `"70.7%"` (converts to 0.707)

The `adjustment` field accepts: `absolute`, `relative`, or `toggle`.

### Banks (`repeat`)

Map a whole bank of pads in a few lines instead of one block each. A binding with
`repeat: N` expands to N bindings, auto-incrementing the note/cc and any numeric subject:

```yaml
bindings:
  - repeat: 32
    label: "Pad %n -> Loop %subject"
    trigger: { kind: note, channel: 10, note: 36 }   # note 36, 37, 38 ...
    actions:
      - action: play/stop
        subject: 0                                    # track 0, 1, 2 ...
```

- `step: { note: 2, subject: 0 }` overrides the increments (e.g. hold a subject constant).
- Label tokens: `%n` (1-based), `%i` (0-based), `%note`, `%cc`, `%subject`.

## Layout Configuration (Canvas + Mixer)

You can now generate a **visual workspace** alongside your MIDI bindings.
When a `layout:` section is present, the exported `.lpproj.zip` includes a
`document.json` with `mixerChannels` and `canvasLayout` stubs.

```yaml
layout:
  tracks: 8           # Number of loop tracks
  rows: 2             # Grid rows on canvas (default 2 for grid, 1 for linear)
  cols: 4             # Grid columns on canvas (auto-calculated if omitted)
  archetype: grid     # grid | linear
  canvas:
    width: 1024
    height: 768
  mixer:
    - track: 0
      name: "Kick"
      volume: 0.85
    - track: 7
      name: "Hi Tom"
```

- **grid architecture**: Places one clip-trigger widget per track in a grid layout.
- **linear architecture**: Three widgets per track (record button + play/stop + volume fader).
- If `mixer` entries are omitted, they auto-populate from binding labels.

The layout generates **valid Loopy document.json** structures that the app can
parse on import so the visual canvas matches your expected configuration.

## Harvesting new actions

The serialized identifiers differ from Loopy's UI labels (the UI's "Clear" is `Clear Track`),
so new actions are confirmed from real exports rather than guessed:

1. Set the action up in Loopy, export the project (`.lpproj`).
2. Decode it: `node tools/decode-lpproj.js <path-to.lpproj>` — it lists every binding and flags
   any **new** identifiers not yet in the library (it also auto-repairs an export that was
   committed as text and got UTF-8-mangled).
3. Add the confirmed identifier to `loopy-actions.js` as `verified: true`.
