# Mozaic Script — complete language reference

The authoritative inventory of every Mozaic event, command, function, and constant.

**Source of truth:** derived from the 4Devs / `-ki` *Mozaic Language Support* package
(`userdl/Mozaic_Language_Support/`, CC BY-SA 4.0) — specifically its language validator
(`mozaic.sublime-syntax`), code-completion list (`CodeCompletion/mozaic.json`), and the
`UnitTests.moz` suite, which the validator treats as ground truth. For prose explanations
of behavior, see the official manual: https://ruismaker.com/manuals/mozaic.pdf

> **File extensions:** write source as **`.moz`** (recognized by the editor tooling).
> **`.mozaic`** is the *binary* patch format (an NSKeyedArchiver plist) Mozaic saves —
> not source. When you paste into Mozaic's in-app editor the extension is irrelevant.

Notation: `[x]` = optional argument. Strings are written in `{braces}`. Channels are
0-based (`0` = MIDI channel 1). Blocks open with `@Event` and **must** close with `@End`.

---

## Events (block handlers)

| Event | Fires when |
|---|---|
| `@OnLoad` | script loads — init layout, variables, defaults (not callable) |
| `@Description` | holds the patch description text (not callable) |
| `@OnMidiInput` | any incoming MIDI message |
| `@OnMidiNote` | any note on **or** off |
| `@OnMidiNoteOn` | a note-on |
| `@OnMidiNoteOff` | a note-off |
| `@OnMidiCC` | a control-change |
| `@OnSysex` | a SysEx message arrives (read with `ReceiveSysex`) |
| `@OnPedalDown` / `@OnPedalUp` | sustain pedal |
| `@OnHostStart` / `@OnHostStop` | host transport start/stop |
| `@OnNewBar` / `@OnNewBeat` | each bar / beat of the host |
| `@OnMetroPulse` | each metronome pulse (rate set by `SetMetroPPQN`; needs transport) |
| `@OnTimer` | the wall-clock timer fires (independent of transport) |
| `@OnPadDown` / `@OnPadUp` | a GUI pad is pressed/released |
| `@OnShiftDown` / `@OnShiftUp` | the on-screen Shift |
| `@OnKnobChange` | a GUI knob moves (see `LastKnob`) |
| `@OnXYChange` | the XY pad moves |
| `@OnAuParameter` | a host/AU parameter changes (see `LastAUParameter`) |

**User-defined events / subroutines:** `@MyName ... @End`, invoked with `Call @MyName`.
Every event except `@OnLoad` and `@Description` may be `Call`ed. Limit: **80 user events**.

---

## Commands (statements — no return value)

### MIDI out
```
SendMIDIOut    byte1, byte2 [, byte3 [, delayMs]]
SendMIDINoteOn  chan, note, velocity [, delayMs]
SendMIDINoteOff chan, note, velocity [, delayMs]
SendMIDICC      chan, controller, value [, delayMs]
SendMIDIBankSelect chan, msb, lsb [, delayMs]
SendMIDIPitchbend     chan, value [, delayMs]
SendMIDIProgramChange chan, value [, delayMs]
SendMIDIThru [delayMs]                 // pass current incoming event through
SendMIDIThruOnCh chan [, delayMs]      // pass through, re-channelled
ConfigureMPE lower, upper
```
`delayMs` schedules the message that many milliseconds ahead — used for note gate
length, echoes, strums, ratchets.

### SysEx
```
SendSysex  arrayVar, length     // send `length` inner bytes; Mozaic adds F0/F7 itself
SendSysexThru                   // pass an incoming SysEx through
ReceiveSysex arrayVar           // copy the just-received SysEx into arrayVar
```
> Do **not** put `240` (F0) or `247` (F7) in the array — Mozaic wraps them automatically.
> `length` is the count of inner bytes. (Optional extra args do checksums: `SendSysex
> arrayVar, length, checksumAlgo, checksumStartIndex`.)
`SysexSize` (function) returns the byte count of the received SysEx. **This is what makes
device feedback (e.g. the PreSonus ATOM SQ OLED display) possible from Mozaic.**

### Host / AU
```
SetShortName {name}
SetMetroPPQN ppqn               // pulses per quarter note -> @OnMetroPulse rate
SetMetroSwing swing
SetAUParameter param, value
```

### Timer & LFO
```
StartTimer / StopTimer / ResetTimer
SetTimerInterval msec           // -> @OnTimer
SetupLFO  lfo, min, max, sync, freq
SetLFOType lfo, {type}
ResetLFO  lfo [, phase]
```

### Musical scales
```
CustomScale c, c#, d, d#, e, f, f#, g, g#, a, a#, b   // up to 12 on/off flags
PresetScale {scaleName}          // or a numeric scale id
SetRootNote root
```

### GUI & interaction
```
ShowLayout layout               // choose a knob/pad/XY layout
LabelKnob  knob, {label} [, ...] // label can be built from strings + values
LabelKnobs {title}
LabelPad   pad, {label} [, ...]
LabelPads  {title}
LabelXY    {title}
SetKnobValue knob, value         // 0..127
SetXYValues  x, y
ColorPad pad, value
FlashPad pad
LatchPad pad, state
FlashUserLed
Log {text} [, value, {text}, ...]   // concatenates strings + numbers; the print/debug log
LogTime
Exit                              // stop executing the current event block
```

### Variables, math, arrays
```
FillArray arrayVar, value [, numCells]
CopyArray sourceVar, destVar [, numCells]
Inc var [, max]                  // increment (optionally wrap/clamp at max)
Dec var [, min]                  // decrement
```
`a = [1, 2, 3]` initializes an array; `a = []` makes an empty one. Index with `a[i]`.
Multidimensional arrays are **not** supported. Limit: **256 variables**.

### Note-state matrix (track held/active notes)
```
ResetNoteStates [initValue]
SetNoteState chan, note, value
```

---

## Functions (return a value; use inside expressions)

### Incoming MIDI (valid in MIDI event blocks)
`MIDIChannel` · `MIDICommand` · `MIDINote` · `MIDIVelocity` · `MIDIByte1` · `MIDIByte2`
· `MIDIByte3` · `MIDISustainPedalDown`

### Host / transport
`HostTempo` · `HostBar` · `HostBeat` · `HostBeatsPerMeasure` · `HostRunning`
· `CurrentMetroPulse` · `QuarterNote` · `LastAUParameter` · `GetAUParameter param`
· `SystemTime`

### SysEx / LFO / scales
`SysexSize` · `GetLFOValue lfo` · `InScale note` · `ScaleQuantize note`

### GUI / sensors
`GetKnobValue knob` · `LastKnob` · `GetXValue` · `GetYValue`
· `GetXYMorphValue topLeft, topRight, bottomLeft, bottomRight`
· `LastPad` · `LastPadVelocity` · `PadState pad` · `ShiftPressed`
· `MotionPitch` · `MotionRoll` · `MotionYaw` *(device tilt sensors)*

### Math
`Round v` · `RoundUp v` · `RoundDown v` · `Abs v` · `Sqrt v` · `Exp v` · `Logn v`
· `Log10 v` · `Sin v` · `Cos v` · `Tan v` · `Tanh v` · `Pow base, exp` · `Div v, divisor`
· `Random min, max` *(no args → 0..127)* · `Clip v, min, max`
· `TranslateScale v, inMin, inMax, outMin, outMax` · `TranslateCurve v, curve, min, max`
· `Unassigned var` *(true if var never set)* · `Inc var [,max]` · `Dec var [,min]`

### Note-state
`GetNoteState chan, note`

### String functions (only inside `Log` / `Label*`; wrap in `()` when passing a value)
`RootNoteName` · `ScaleName [scale]` · `NoteName note [, includeOctave]`

```
LabelKnob 0, {Root: }, RootNoteName
LabelPads {Note: }, (NoteName MIDINote, YES)
```

---

## Constants & operators

- **Constants:** `YES` `NO` `TRUE` `FALSE`
- **Arithmetic:** `+ - * / %`   **Bitwise:** `& | ^`
- **Comparison:** `=  <>  <  >  <=  >=`  (use `<>` for "not equal")
- **Logical:** `and` `or` `not` (also `AND OR NOT`). Unary `-x` and `not x` can't be
  stacked directly — `not - b` is an error; use `not (-b)`.
- **Numbers:** decimal (`120`), hex (`0x7F`), and floating point (`12.5`) all parse;
  MIDI byte values must be integers `0..127` (use `Round`/`Clip` before sending).

## Control flow
```
if cond
elseif cond
else
endif

for i = start to end          // inclusive; skipped if start > end
  ...
endfor

while cond
  ...
endwhile

repeat
  ...
until cond
```

## Variable-naming conventions (recognized by the tooling)
Plain names are globals. The editor styles names by prefix; these are conventions, but
worth following for readability:

| Pattern | Meaning |
|---|---|
| `count`, `step` | ordinary (global) variable |
| `_localThing` | leading `_` + lowercase → "local"-style working variable |
| `pAmount` | `p` + Uppercase → parameter passed to a `Call`ed subroutine |
| `gMasterVol` | `g` + Uppercase → emphasized global |
| `global0` … `global99` | reserved cross-script global slots |
| `ALL_CAPS` | constant-style |

---

## Editor setup (syntax highlighting)

The package already in `userdl/Mozaic_Language_Support/` provides highlighting + a full
validator for **Textastic** (iOS/Mac) and **Sublime Text 3**:

- **Sublime 3:** copy the contents of `#Textastic/` into
  `Packages/User/` (Preferences → Browse Packages…), restart, set color scheme to
  *Monokai-Mozaic*. `.moz` files auto-detect.
- **Textastic (iPad):** copy the three files + `#Textastic/` folder into
  *On My iPad / Textastic*. (Full steps in `userdl/Mozaic_Language_Support/Readme.txt`.)
- **VS Code / Claude Code:** no official grammar, but the `.sublime-syntax` keyword groups
  in that folder are the canonical command list if you want to build/convert one.
