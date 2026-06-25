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

Supported trigger helpers are `kind: note`, `kind: cc`, or `raw`. Unknown Loopy action identifiers are exported with a warning so new Loopy actions can be tested without changing the app first.
