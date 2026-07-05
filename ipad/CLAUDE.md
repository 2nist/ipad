# CLAUDE.md — Mozaic Script project

This repo holds **Mozaic scripts**: small programs that run inside the Mozaic AUv3 plugin
on iOS to create custom MIDI tools (arpeggiators, transposers, randomizers, controllers).
Your job is to **write and edit `.moz` scripts** that the user pastes into Mozaic on an
iPad. You cannot run them here — favor correctness and clear inline comments so a paste
"just works" on the first try.

> **For the complete, authoritative command set, read [docs/mozaic-reference.md](docs/mozaic-reference.md)** —
> every event, command, function, and constant, derived from the official Mozaic Language
> Support validator. The primer below is the high-frequency subset; the reference is
> exhaustive. When in doubt, the reference wins.

## Workflow context

- This PC is the host running Claude Code; the user drives it from an iPad and pastes
  script text into Mozaic by hand. Optimize every change to **paste cleanly and run**.
- One tool per file, **`.moz`** extension, in [scripts/](scripts/). (`.mozaic` is the
  binary patch format, not source.) Update [scripts/README.md](scripts/README.md) when you
  add/rename a script.
- Start each script with a `//` header block: what it does, whether it needs the host
  transport playing, and the knob/pad map.

## Mozaic Script — language reference

Mozaic Script is an **integer-only, event-driven** language. No strings in variables, no
floats, no objects — just numbers and numeric arrays.

### Program structure

Code lives in **event blocks** that open with `@OnXxx` and close with `@End`:

```
@OnLoad
  ShowLayout 2
  Log {ready}
@End

@OnMidiNoteOn
  SendMIDINoteOn MIDIChannel, MIDINote + 12, MIDIVelocity
@End
```

- `@End` is **required** to close every block.
- Comments are `//` (whole-line or trailing): `ShowLayout 2 // two knobs`.
- Define your own subroutines as `@Name … @End` and call them with `Call @Name`.

### Event blocks you'll use most

| Block | Fires when… |
|-------|-------------|
| `@OnLoad` | script loads — set up layout, defaults, init variables here |
| `@OnMidiNoteOn` / `@OnMidiNoteOff` | a note on/off arrives |
| `@OnMidiCC` | a CC arrives |
| `@OnMidiInput` | **any** MIDI event arrives (notes, CC, PC, sysex) |
| `@OnKnobChange` | the user turns a knob (see `LastKnob`) |
| `@OnPadDown` / `@OnPadUp` | a pad is pressed/released |
| `@OnMetroPulse` | host clock pulse — **only while host transport is playing** |
| `@OnNewBeat` / `@OnNewBar` | on each beat/bar of the host |
| `@OnTimer` | the wall-clock timer fires (works without host transport) |
| `@OnHostStart` / `@OnHostStop` | host transport starts/stops |

### Reading incoming MIDI

Inside a MIDI event block, read these variables (do not assign to them):

- `MIDIChannel` (0–15), `MIDICommand`, `MIDINote`, `MIDIVelocity`
- `MIDIByte1`, `MIDIByte2`, `MIDIByte3` (raw bytes, for non-note messages)

### Sending MIDI — exact argument order

```
SendMIDINoteOn  <chan>, <note>, <velocity> [, <delayMs>]
SendMIDINoteOff <chan>, <note>, <velocity> [, <delayMs>]
SendMIDICC      <chan>, <controller>, <value> [, <delayMs>]
SendMIDIProgramChange <chan>, <value> [, <delayMs>]
SendMIDIPitchbend     <chan>, <value> [, <delayMs>]
SendMIDIOut     <byte1>, <byte2>, <byte3> [, <delayMs>]
SendMIDIThru    // pass the current incoming event through unchanged
```

- Channels are **0-based** (0 = MIDI channel 1).
- The optional `<delayMs>` schedules the message that many milliseconds in the future —
  use it for gate length, echoes, strums (e.g. send NoteOn now, NoteOff in 200 ms).

### Variables and arrays

- Variables are **global** by default; just assign: `count = 0`. No declaration needed.
- Arrays use `name[index]` with integer indices: `chord[0] = 60`. No declaration needed.
- `FillArray myArr, value [, numCells]` and `CopyArray src, dst [, numCells]` exist.

### Control flow

```
if cond
elseif cond
else
endif

for i = 0 to n          // inclusive; if start > end the loop is skipped
  ...
endfor

while cond
  ...
endwhile

repeat
  ...
until cond
```

Operators: `+ - * / %` · bitwise `& | ^` · compare `=  <>  <  >  <=  >=`
(use `<>` for "not equal", **not** `!=`) · logical `AND OR NOT`.

### Timer vs. metronome

- **Timer** (host-independent): `SetTimerInterval <ms>`, `StartTimer`, `StopTimer` → `@OnTimer`.
- **Metro** (tempo-synced, needs transport): `SetMetroPPQN <pulsesPerQuarter>` → `@OnMetroPulse`.

### UI: knobs and pads

```
ShowLayout <n>              // pick a layout; n knobs/pads become available
LabelKnob <knob>, {text} [, <displayValue>]
SetKnobValue <knob>, <value>     // 0..127
GetKnobValue <knob>              // returns 0..127
LabelPad <pad>, {text}
ColorPad <pad>, <color>
FlashPad <pad>
PadState <pad>                   // returns 0/1
```

In `@OnKnobChange`, `LastKnob` is the knob that moved. `Log {text}` prints a literal
string to Mozaic's log; log a number with `Log <value>` on its own (no interpolation).

## House rules for writing scripts here

1. **Avoid stuck notes.** If you transpose/remap a note, remember the exact note you sent
   the NoteOn for (e.g. `sentNote[MIDINote] = outNote`) and send the matching NoteOff —
   the source note's transpose may change while the key is held. See
   [scripts/velocity-transpose.moz](scripts/velocity-transpose.moz).
2. **Don't inline function calls inside arithmetic.** Assign first, then compute, so the
   parser can't mistake the next token for an extra argument:
   ```
   raw = GetKnobValue 0        // good
   rate = 40 + raw * 6
   // NOT:  rate = 40 + GetKnobValue 0 * 6
   ```
3. **Map knob ranges yourself** — knobs are always 0..127. Convert to musical ranges
   (ms, semitones, PPQN) explicitly and comment the mapping.
4. **Clamp note/velocity to 0..127** before sending.
5. **Say if the host transport is required.** `@OnMetroPulse`/`@OnNewBeat` need Play;
   `@OnTimer` and direct note handlers do not. Put it in the script's header comment.
6. **Comment for a musician, not a programmer** — short, plain-language notes by each block.

## Confidence notes

The full command/function/event set is now validated against the official Mozaic Language
Support definition — see **[docs/mozaic-reference.md](docs/mozaic-reference.md)** for the
exhaustive list (LFOs, scales, note-state matrix, motion sensors, math, string functions,
`SendSysex`, etc.). Use it freely; it's authoritative.

What the validator does **not** enumerate (the string *values* of certain constants):
`ShowLayout` layout ids, `SetLFOType {type}` names, `PresetScale {name}` names, and
`ColorPad` color values. Those live in the official manual
(https://ruismaker.com/manuals/mozaic.pdf) — confirm them there before hard-coding.
