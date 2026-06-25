# iPad MIDI Workshop — Claude Code + Mozaic

A scaffold for building **iOS Audio Unit MIDI tools from your iPad**, where Claude Code
writes [Mozaic](https://apps.apple.com/us/app/mozaic-plugin-workshop/id1457962653)
scripts and you load them into your AU host (AUM, Drambo, apeMatrix, Loopy Pro, Cubasis).

## The setup at a glance

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  Windows PC (this host)  │  git    │            iPad              │
│  • Claude Code           │ ──────▶ │  • Working Copy (pulls repo) │
│  • this repo of scripts  │  push   │  • AUM/Drambo + Mozaic       │
└─────────────────────────┘         └──────────────────────────────┘
        ▲                                          │
        └──────── Remote Control / SSH ◀───────────┘
              (drive Claude from the iPad)
```

- **Host:** this PC runs Claude Code against this repo. It's your always-on, free agent host.
- **Drive it from the iPad:** Claude Code **Remote Control** (Claude iOS app, Pro/Max) or
  **Blink Shell** SSH + `tmux` into this PC.
- **Get scripts onto the iPad:** **Working Copy** (a git client wired into the Files app)
  pulls this repo; or sync `scripts/` via iCloud Drive.
- **Run them:** paste the `.moz` text into Mozaic's editor inside your AU host.

> iOS sandboxing means Claude can't write *directly* into Mozaic. The loop is always
> **edit → sync → paste → test → report back**. These scripts make that loop tight.

## The loop, step by step

1. Ask Claude (from the iPad) for a behavior, e.g. *"make the arp play down instead of up."*
2. Claude edits the file in [scripts/](scripts/) on this PC and commits.
3. On the iPad, **Working Copy** pulls → open the `.moz` file → **Select All → Copy**.
4. In your AU host, open **Mozaic → Edit (the `</>` script button) → Select All → Paste → Run/Apply**.
5. Play notes. If it's wrong, tell Claude what happened — repeat.

## What's here

| Path | What it is |
|------|------------|
| [CLAUDE.md](CLAUDE.md) | Mozaic Script primer + repo conventions — Claude reads this automatically |
| [docs/mozaic-reference.md](docs/mozaic-reference.md) | Complete language reference (every event, command, function, constant) |
| [docs/atom-sq-midi-map.md](docs/atom-sq-midi-map.md) | PreSonus ATOM SQ MIDI map (input, RGB LEDs, OLED, native mode) |
| [scripts/velocity-transpose.moz](scripts/velocity-transpose.moz) | Dead-simple utility to test the loop end-to-end (no host transport needed) |
| [scripts/arpeggiator.moz](scripts/arpeggiator.moz) | Host-synced arpeggiator (press Play in your host) |
| [scripts/atom-sq-template.moz](scripts/atom-sq-template.moz) | ATOM SQ starter: native mode, lit pads, logs all controls, OLED |
| [scripts/atom-sq-mapper.moz](scripts/atom-sq-mapper.moz) | ATOM SQ diagnostic: logs every incoming MIDI byte to map controls |
| [scripts/atom-sq-template-thru.moz](scripts/atom-sq-template-thru.moz) | ATOM SQ template with MIDI passthrough — pads trigger Drambo sounds |
| [tools/generate-atomsq-project.py](tools/generate-atomsq-project.py) | Drambo project generator: Mozaic + Flexi sampler + mixer |
| [projects/atom-sq-template.drproject](projects/atom-sq-template.drproject) | Generated Drambo project (load on iPad) |
| [scripts/README.md](scripts/README.md) | How to load a script into Mozaic, script-by-script notes |

## ATOM SQ × Drambo workflow

The generated `projects/atom-sq-template.drproject` ties the ATOM SQ hardware into
Drambo with a single sub-track that holds both Mozaic and a Flexi sampler:

```
ATOM SQ pads ──┬─→ Mozaic (@OnMidiInput) ──→ LED NoteOns ──→ ATOM SQ
                │    SendMIDIThru
                └─→ Flexi sampler (BoomBap+) ──→ audio → Master → device
```

- **Bottom row pads (notes 36–51)** trigger drum sounds from the `3sleeves_BoomBap+`
  preset (16 slices). Top row pads (52–67) light up but don't play sounds yet.
- **Encoders, touch strip, and buttons** are logged by Mozaic for diagnostic coverage.
- **Mixer tracks A, B, Master** give you level control over the sampler audio.

To regenerate the project after editing the Mozaic script or tweaking sampler settings:
```
python tools/generate-atomsq-project.py
```

Preset path and note range are configurable constants at the top of the generator
script — swap `BUILDING_TRACK_INDEX`, `NOTE_LO`, and `NOTE_HI` to use a different
Building-blocks preset or expand to all 32 pads.

## First run

Start with **[velocity-transpose.moz](scripts/velocity-transpose.moz)** — it reacts to
every incoming note immediately, so it proves the whole loop without needing the host
transport running. Once that works, try the arpeggiator.

## Reference

- Mozaic script library (350+ examples): https://patchstorage.com/platform/mozaic/
- Official manual: https://ruismaker.com/manuals/mozaic.pdf
