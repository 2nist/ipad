# PreSonus ATOM SQ — MIDI map for Mozaic

Everything Mozaic needs to read from and write to a PreSonus ATOM SQ.

**Source:** reverse-engineered from the ATOM SQ Ableton Live 11 control-surface script
(`userdl/ATOMSQ/` — `midi.py`, `elements.py`, `colors.py`). That script *is* the
controller's authoritative I/O map.

> **All of the below applies in NATIVE control mode.** The ATOM SQ only uses this map (and
> accepts LED/display feedback) once it's in native mode. Enable it yourself — see below.
> Outside native mode the controls may send different, user-configurable messages.

Channels here are written as Mozaic's **0-based** channel argument (`0` = MIDI channel 1).

---

## Enable native mode (do this first, in `@OnLoad`)

```
SendMIDIOut 143, 0, 1     // NATIVE MODE ON   (NoteOff ch16, note 0, velocity 1)
SendMIDIOut 143, 0, 0     // NATIVE MODE OFF
```
Mozaic has no unload event, so native mode stays on until you reload the script or
power-cycle the device.

---

## Input — what the ATOM SQ sends

Read in `@OnMidiNoteOn/Off`, `@OnMidiCC`, or `@OnMidiInput`. Most controls are on MIDI
channel 1 (`MIDIChannel = 0`); the touch strip is the exception.

| Control | Type | Number(s) |
|---|---|---|
| Pads — lower row (16) | Note | **36–51** |
| Pads — upper row (16) | Note | **52–67** |
| 8 rotary encoders | CC, **relative** | **14–21** |
| Display/jog encoder | CC, relative | **29** |
| Soft buttons under screen (6) | CC | **36–41** |
| Shift | CC | 31 |
| Song / Instrument / Editor / User | CC | 32 / 33 / 34 / 35 |
| Display ◀ / ▶ | CC | 42 / 43 |
| Up / Down / Left / Right | CC | 87 / 89 / 90 / 102 |
| Click / Record / Play / Stop | CC | 105 / 107 / 109 / 111 |
| Plus / Minus | Note | 0 / 1 |
| Touch strip | Pitch Bend, **MIDI ch 16** (`MIDIChannel = 15`) | position = bend value |

Buttons send value **127** on press, **0** on release.

### Decoding the relative encoders (CC 14–21, 29)
They use sign-bit relative encoding, **not** absolute 0–127:
```
raw = MIDIByte3
if raw < 64
  delta = raw                // 1..63  = clockwise
else
  delta = 0 - (raw - 64)     // 65..127 = counter-clockwise
endif
```

---

## Output — lighting the RGB LEDs

Each pad/button LED is set with Note-On messages that reuse the control's **note number**,
spread across four channels (`userdl/ATOMSQ/colors.py`):

```
SendMIDINoteOn 1, note, red      // channel index 1 = RED   (0..127)
SendMIDINoteOn 2, note, green    // channel index 2 = GREEN
SendMIDINoteOn 3, note, blue     // channel index 3 = BLUE
SendMIDINoteOn 0, note, 127      // channel index 0 = brightness/mode:
                                 //   127 = on, 1 = blink, 2 = pulse, 0 = off
```
Turn a pad off with `SendMIDINoteOn 0, note, 0`.

**Sample palette** (from the Live script): RED `127,0,0` · GREEN `0,127,0` ·
BLUE `0,16,127` · PURPLE `65,0,65` · YELLOW `127,83,3` · WHITE `127,127,127`.

See the `@LightPad` subroutine in
[scripts/atom-sq-template.moz](../scripts/atom-sq-template.moz).

---

## Output — the OLED display (SysEx)

Frame (from `userdl/ATOMSQ/elements.py`):
```
F0 00 01 06 22 12 <seg> 00 5B 5B 01 <ascii text…> F7
```
- `<seg>` = display segment id: soft-button labels use **0,1,2,11,12,13**;
  the main areas are **6** (track-name) and **7** (device-name).
- Text is ASCII, **max 18 chars** for the main area.

Send it from Mozaic with `SendSysex arrayVar, length` after filling an array with those
bytes. Because Mozaic has no string→bytes conversion, text must be supplied as ASCII codes
(see `@ShowText` in the template).

> **Verify the wrapping:** it's unconfirmed whether `SendSysex` wants the full frame
> *including* `F0`/`F7` (as the template does) or *without* them. If your build double-wraps,
> drop the leading `240` and trailing `247` and shorten the length. Test and adjust.

---

## Caveats

1. **Native mode required** — none of this works until you send `SendMIDIOut 143, 0, 1`.
2. **No clean teardown** — Mozaic has no unload event, so the ATOM SQ stays in native mode
   after the script stops; reload or power-cycle to reset it.
3. **Channels/types are inferred** from a decompiled Ableton script and not bench-tested
   here — if a control behaves differently, watch its raw bytes with a `Log` in
   `@OnMidiInput` and adjust.
