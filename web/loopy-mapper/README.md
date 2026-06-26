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
- Names that are known but not yet harvested export as a **warned guess** so they can be tested
- Unknown strings export as-is with a warning

`loopy-actions.js` is the action library and the harvest backlog: `verified: true` entries have
a confirmed serialized identifier; `id: null` entries still need one.

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

## Harvesting new actions

The serialized identifiers differ from Loopy's UI labels (the UI's "Clear" is `Clear Track`),
so new actions are confirmed from real exports rather than guessed:

1. Set the action up in Loopy, export the project (`.lpproj`).
2. Decode it: `node tools/decode-lpproj.js <path-to.lpproj>` — it lists every binding and flags
   any **new** identifiers not yet in the library (it also auto-repairs an export that was
   committed as text and got UTF-8-mangled).
3. Add the confirmed identifier to `loopy-actions.js` as `verified: true`.
