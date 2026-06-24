# Scripts

Each `.moz` file is one MIDI tool (`.moz` = Mozaic source; `.mozaic` is the binary patch
format). To use one on the iPad:

1. **Get the text onto the iPad** — pull this repo in **Working Copy**, or open the file
   from an iCloud-synced copy of `scripts/` in the **Files** app.
2. Open the file and **Select All → Copy**.
3. In your AU host (AUM, Drambo, …) add **Mozaic** as a MIDI plugin in the chain.
4. Open Mozaic's **script editor** (the `</>` / Edit button) → **Select All → Paste**.
5. Tap **Run / Apply / Done** to compile and load the script.
6. Route a keyboard/sequencer into Mozaic and Mozaic's output into your instrument.

If Mozaic reports a syntax error, copy the message back to Claude and it'll fix the line.

## Catalogue

| Script | Needs transport playing? | What it does |
|--------|:---:|--------------|
| [velocity-transpose.moz](velocity-transpose.moz) | No | Transpose incoming notes + optional fixed velocity. Best first test — reacts to every note immediately. |
| [arpeggiator.moz](arpeggiator.moz) | **Yes** | Plays a held chord one note at a time, synced to the host clock. Knobs: Rate, Gate. |
| [atom-sq-template.moz](atom-sq-template.moz) | No | PreSonus ATOM SQ starter — native mode, RGB pad feedback, logs every button/encoder + touch strip, OLED text. See [../docs/atom-sq-midi-map.md](../docs/atom-sq-midi-map.md). |
| [atom-sq-mapper.moz](atom-sq-mapper.moz) | No | Diagnostic — logs every incoming MIDI byte so you can map every ATOM SQ control. |

## Ideas to ask Claude for next

- Note repeat / ratchet, random velocity humanizer, chord memory (one finger → triad),
  scale quantizer, MIDI delay/echo, CC LFO, probability gate, strummer.
- Tell Claude the AU host you use and how you've routed MIDI — it'll tailor the script.
