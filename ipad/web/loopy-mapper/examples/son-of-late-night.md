# Son of Late Night Mapping

The salvaged concept from the lost session — rebuilt clean on a known-good base.
This is the blueprint to assemble in Loopy plus the MIDI mapping we can already
generate. (We do **not** hand-author `Project.sqlite`; that's what produced the
crashing file. Build the tracks/widgets in Loopy, generate the device mappings here.)

## Key takeaways banked from the session
- Triggers are **hex** `<status><data1><value>` (`h:` = hold). Decimal was the old bug.
- Verified action identifiers (usable by friendly name in the mapper now):
  `Play/Stop` → `Track Play/Stop`, `Clear` → `Clear Track`, `Undo` → `Undo`,
  `Mute` → `Mute`, `Solo` → `Track Solo`, `Volume/param` → `Track Parameter`.
- Still to harvest (set up in Loopy, export, decode): `Enable/Disable Effect`,
  `MIDI Scene Capture`, `Audio Scene Capture`, plus the `Selected/All` targets.
- Lesson: export small + often; pull before working so iPad/PC don't both commit binaries.

## Track layout (16 tracks)

| Idx | Track | Group / color |
|----|-------|----------------|
| 0 | Rim | **Drums** (one-shots) |
| 1 | Snare | Drums |
| 2 | Closed Hat | Drums |
| 3 | Open Hat | Drums |
| 4 | Kick | Drums |
| 5 | Kick Sub | Drums |
| 6 | Perc 1 | Drums |
| 7 | Perc 2 | Drums |
| 8 | Guitar Loop 1 | **Guitar** color |
| 9 | Guitar Loop 2 | Guitar |
| 10 | Bass Loop 1 | **Bass** color |
| 11 | Bass Loop 2 | Bass |
| 12 | Drum Loop 1 | **Drum-loop** color |
| 13 | Drum Loop 2 | Drum-loop |
| 14 | Synth Loop 1 | **Synth** color |
| 15 | Synth Loop 2 | Synth |

Suggested colors (color = a control/routing group): Drums red · Guitar amber ·
Bass purple · Drum-loops blue · Synth green · Inputs teal (separate). Each loop
*category* gets its own color so you can stop/mute/route a category as a unit.

## Drum samples — note map (MIDI ch 10)
| Note | Hex trigger | Pad |
|------|-------------|-----|
| 36 | `99247f` | Rim |
| 37 | `99257f` | Snare |
| 38 | `99267f` | Closed Hat |
| 39 | `99277f` | Open Hat |
| 40 | `99287f` | Kick |
| 41 | `99297f` | Kick Sub |
| 42 | `992a7f` | Perc 1 |
| 43 | `992b7f` | Perc 2 |

## Controls
- **Per loop (×8):** an **FX button** (`Enable/Disable Effect`) + a **slider**
  (`Track Parameter` → volume/param). FX + Volume are verified except `Enable/Disable
  Effect`, which still needs harvesting.
- **Drum loops:** **Rec** + **Clear** for Drum Loop 1 (trk 12) and Drum Loop 2 (trk 13)
  — `Record` (harvest) and `Clear Track` (verified).
- **Global:** one **MIDI Scene Capture** button, one **Audio Scene Capture** button
  (both `capture` actions — harvest to confirm identifiers).

## Deferred (didn't make the cut this round)
Master Volume, Undo/Redo, Sequence toggle, Mixer toggle — pick up later.

## What's generatable today vs. harvest-gated
| Part | Status |
|------|--------|
| 8 drum pads → Play/Stop (trk 0–7) | ✅ generate now — see `son-of-late-night.yaml` |
| Loop volume sliders → Track Parameter | ✅ action verified; needs the knob/slider CCs |
| Drum-loop Clear | ✅ `Clear Track` verified; needs the button CCs |
| Loop Record, FX toggle, Scene captures | ⬜ harvest the identifiers first |

Next session: in Loopy set up one each of Record, Enable/Disable Effect, MIDI Scene
Capture, Audio Scene Capture; export; `node tools/decode-lpproj.js` harvests them; then
the whole surface generates by name.
