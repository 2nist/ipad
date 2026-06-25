#!/usr/bin/env python3
"""
generate-drum-sampler-project.py

Builds projects/drum-sampler.drproject from Sampler2.drproject (reference)
and Mozaictrk1.drproject (Mozaic LED template).

Strategy: clone the working drum sub-track from Sampler2 eight times,
clear its slots, set the note range, rename it. Keep A/B/Master from
Sampler2. Prepend a Mozaic LED sub-track from Mozaictrk1.

Pad layout — ATOM SQ 32 pads, 2 rows of 16:
  BOTTOM ROW (left → right):
    36-39  Kick             pads  1-4   (C1–D#1)
    40-43  Sub / 808        pads  5-8   (E1–G#1)
    44-47  Snare            pads  9-12  (A1–B1)
    48-51  Rim / Clap       pads 13-16  (C2–D#2)
  TOP ROW (left → right):
    52-55  Open Hat         pads  1-4   (E2–G2)
    56-59  Closed Hat       pads  5-8   (G#2–A#2)
    60-63  Cymbal / Crash   pads  9-12  (B2–D3)
    64-67  Perc             pads 13-16  (D#3–G3)

Each sampler sub-track gets 4 empty slots. Load samples on the iPad by
tapping a slot in the Sampler module and choosing a file.

Usage:
  python3 tools/generate-drum-sampler-project.py
"""

import copy
import plistlib
from pathlib import Path

REPO     = Path(__file__).parent.parent
SAMPLER2 = REPO / 'scripts' / 'Sampler2.drproject'    # known-working reference
TEMPLATE = REPO / 'scripts' / 'Mozaictrk1.drproject'  # Mozaic LED source
SCRIPT   = REPO / 'scripts' / 'atom-sq-drums.moz'
OUTPUT   = REPO / 'projects' / 'drum-sampler.drproject'

DRUM_GROUPS = [
    # Bottom row — 16 pads, 4 groups of 4
    ('Kick',       list(range(36, 40))),   # C1–D#1
    ('Sub',        list(range(40, 44))),   # E1–G#1
    ('Snare',      list(range(44, 48))),   # A1–B1
    ('Rim+Clap',   list(range(48, 52))),   # C2–D#2
    # Top row — 16 pads, 4 groups of 4
    ('Open Hat',   list(range(52, 56))),   # E2–G2
    ('Closed Hat', list(range(56, 60))),   # G#2–A#2
    ('Cymbal',     list(range(60, 64))),   # B2–D3
    ('Perc',       list(range(64, 68))),   # D#3–G3
]

# ── pid counter ──────────────────────────────────────────────────────────────
# Sampler2 and template pids reach ~300; start well above.
_pid = [500]

def npid():
    _pid[0] += 1
    return _pid[0]

# ── helpers ──────────────────────────────────────────────────────────────────

def time_pid(rack):
    for io in rack.get('ioutputs', []):
        if io.get('nm') == 'Time':
            return io['pid']
    return None

def collect_owned(o, result=None):
    if result is None: result = set()
    if isinstance(o, dict):
        if isinstance(o.get('pid'), int): result.add(o['pid'])
        for v in o.values(): collect_owned(v, result)
    elif isinstance(o, list):
        for v in o: collect_owned(v, result)
    return result

def remap_pids(o, remap, ext_time_old=None, ext_time_new=None):
    """Remap owned pids and fix external Time opid reference."""
    if isinstance(o, dict):
        if o.get('pid') in remap:
            o['pid'] = remap[o['pid']]
        if 'opid' in o:
            if o['opid'] in remap:
                o['opid'] = remap[o['opid']]
            elif ext_time_old is not None and o['opid'] == ext_time_old:
                o['opid'] = ext_time_new
        for v in o.values():
            remap_pids(v, remap, ext_time_old, ext_time_new)
    elif isinstance(o, list):
        for v in o:
            remap_pids(v, remap, ext_time_old, ext_time_new)

def clone_sub(src, ext_time_old, ext_time_new):
    """Deep copy a sub-track and remap all owned pids to fresh values."""
    dup = copy.deepcopy(src)
    owned = collect_owned(dup)
    rm = {pid: npid() for pid in sorted(owned)}
    remap_pids(dup, rm, ext_time_old, ext_time_new)
    return dup

def find_au_midi(module_list):
    for m in module_list:
        if m.get('class') == 'BSAUMidiModule':
            return m
        if 'modules' in m:
            found = find_au_midi(m['modules'])
            if found: return found
    return None

# ── empty drum slot ──────────────────────────────────────────────────────────

def make_slot(note):
    return {
        'rn': note, 'rt': note, 'rf': note,
        'vf': 0.0, 'vt': 1.0,
        'amp': 1.0, 'md': 0, 'nb': 1.0,
    }

# ── load Sampler2 as base ─────────────────────────────────────────────────────

with open(SAMPLER2, 'rb') as f:
    ref = plistlib.load(f)

ref_tracks = ref['tracks']
ref_subs   = {s.get('name'): s for s in ref_tracks['modules']}
ref_time   = time_pid(ref_tracks)   # pid 27 in Sampler2

# Use sub-track "1" as the drum sub-track template (BSMidiToCVModule + BSMultiSamplerModule)
drum_template = ref_subs['1']

# ── build 8 drum sub-tracks ───────────────────────────────────────────────────

def make_drum_track(src, name, notes, ref_time, new_time):
    """
    Clone src sub-track (from Sampler2 "1"), clear slots, set new note range.
    ext_time_old → ext_time_new so the Time input wires to the new root.
    """
    trk = clone_sub(src, ref_time, new_time)
    trk['name'] = name
    trk['kbd'] = {'oct': 4, 'keys': [{'n': notes[0], 'g': 0.5, 'v': 1.0, 'o': 0.0}]}

    # Replace slots: 4 empty slots for the 4 notes in this group
    for m in trk.get('modules', []):
        if m.get('class') == 'BSMultiSamplerModule':
            m['slots'] = [make_slot(n) for n in notes]

    return trk

# ── load Mozaic template for LED sub-track ────────────────────────────────────

with open(TEMPLATE, 'rb') as f:
    tmpl = plistlib.load(f)

tmpl_tracks = tmpl['tracks']

# Sub-track 0 of the template has BSMidiToCVModule + BSAUMidiModule (Mozaic)
mozaic_sub_src = tmpl_tracks['modules'][0]

# Inject script into BSAUMidiModule
mozaic_mod = find_au_midi(mozaic_sub_src.get('modules', []))
if not mozaic_mod:
    raise RuntimeError('BSAUMidiModule not found in Mozaictrk1 template')
script_text = SCRIPT.read_text(encoding='utf-8')
mozaic_mod['unitDescription']['fullState']['CODE'] = script_text.encode('utf-8')

# We need Sampler2's root Time pid as the target (new_time)
# The new project is built on Sampler2's root structure, so ref_time stays.
# Clone the Mozaic sub-track, remapping its pids so they don't collide.
tmpl_time = time_pid(tmpl_tracks)
mozaic_sub = clone_sub(mozaic_sub_src, tmpl_time, ref_time)

# Configure as LED-only output track → ATOM SQ
mozaic_sub['name']           = 'LED'
mozaic_sub['midiDstExtPort'] = 'ATOM SQ'
mozaic_sub['midiDstExtChn']  = -1
mozaic_sub.pop('destNode1', None)
mozaic_sub.pop('destNode2', None)
mozaic_sub.pop('destNode3', None)

# Rewire iinputs: disconnect audio, keep Mozaic MIDI OUT → ATOM SQ
# After clone, the Mozaic MIDI OUT pid was remapped — find it.
au_midi = find_au_midi(mozaic_sub.get('modules', []))
mozaic_midi_out_pid = None
for out in au_midi.get('outputs', []):
    if out.get('tp') == 5:  # MIDI type
        mozaic_midi_out_pid = out['pid']
        break

mozaic_sub['iinputs'] = [
    {'ac': False, 'ace': True, 'tp': 0},
    {'ac': True,  'ace': True, 'opid': mozaic_midi_out_pid, 'tp': 5},
]

# ── clone A / B / Master from Sampler2 ───────────────────────────────────────

track_A      = clone_sub(ref_subs['A'],      ref_time, ref_time)
track_B      = clone_sub(ref_subs['B'],      ref_time, ref_time)
track_Master = clone_sub(ref_subs['Master'], ref_time, ref_time)

mst_audio_out = track_Master['outputs'][0]['pid']
mst_midi_out  = track_Master['outputs'][1]['pid']

# ── assemble project on Sampler2's root ──────────────────────────────────────

drum_tracks = [
    make_drum_track(drum_template, name, notes, ref_time, ref_time)
    for name, notes in DRUM_GROUPS
]

ref_tracks['modules'] = [mozaic_sub] + drum_tracks + [track_A, track_B, track_Master]
ref['projectName'] = 'drum-sampler'

ref_tracks['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
    {'ac': True, 'ace': True, 'opid': mst_midi_out,  'tp': 5},
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
]

# ── save ─────────────────────────────────────────────────────────────────────

OUTPUT.parent.mkdir(exist_ok=True)
with open(OUTPUT, 'wb') as f:
    plistlib.dump(ref, f, fmt=plistlib.FMT_BINARY)

print(f'Written: {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)')
print()
print('Sub-tracks:')
print('  LED          → ATOM SQ (Mozaic LED feedback, all 32 pads)')
for name, notes in DRUM_GROUPS:
    lo, hi = notes[0], notes[-1]
    print(f'  {name:<12}  notes {lo}-{hi}  ({len(notes)} empty slots)')
print('  A / B / Master  (mixer bus)')
