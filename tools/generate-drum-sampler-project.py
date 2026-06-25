#!/usr/bin/env python3
"""
generate-drum-sampler-project.py

Builds projects/drum-sampler.drproject: eight BSMultiSamplerModule sub-tracks
(one per 4-pad group) plus a Mozaic LED-feedback sub-track.

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
TEMPLATE = REPO / 'scripts' / 'Mozaictrk1.drproject'
SCRIPT   = REPO / 'scripts' / 'atom-sq-drums.moz'
SKELETON = REPO / 'Master.drproject'
OUTPUT   = REPO / 'projects' / 'drum-sampler.drproject'

DRUM_GROUPS = [
    # Bottom row — 16 pads, 4 groups of 4
    ('Kick',       list(range(36, 40))),   # C1–D#1   pads 1-4
    ('Sub',        list(range(40, 44))),   # E1–G#1   pads 5-8
    ('Snare',      list(range(44, 48))),   # A1–B1    pads 9-12
    ('Rim+Clap',   list(range(48, 52))),   # C2–D#2   pads 13-16
    # Top row — 16 pads, 4 groups of 4
    ('Open Hat',   list(range(52, 56))),   # E2–G2    pads 1-4
    ('Closed Hat', list(range(56, 60))),   # G#2–A#2  pads 5-8
    ('Cymbal',     list(range(60, 64))),   # B2–D3    pads 9-12
    ('Perc',       list(range(64, 68))),   # D#3–G3   pads 13-16
]

# ── pid counter ──────────────────────────────────────────────────────────────
# Template pids reach ~190; start well above that.
_pid = [300]

def npid():
    _pid[0] += 1
    return _pid[0]

# ── helpers ──────────────────────────────────────────────────────────────────

def time_pid(rack):
    for io in rack.get('ioutputs', []):
        if io.get('nm') == 'Time':
            return io['pid']
    return None

def find_au_midi(module_list):
    for m in module_list:
        if m.get('class') == 'BSAUMidiModule':
            return m
        if 'modules' in m:
            found = find_au_midi(m['modules'])
            if found:
                return found
    return None

# ── mixer track clone ────────────────────────────────────────────────────────
# Remaps all owned pids to fresh values; replaces skel_time → my_root_time.
# Preserves destNode1/2/3 routing exactly as authored in the skeleton.

def clone_mixer_track(skel_subs, skel_time, name, my_root_time):
    src = copy.deepcopy(skel_subs[name])
    owned = set()
    def collect(o):
        if isinstance(o, dict):
            if isinstance(o.get('pid'), int):
                owned.add(o['pid'])
            for v in o.values():
                collect(v)
        elif isinstance(o, list):
            for v in o:
                collect(v)
    collect(src)
    remap = {pid: npid() for pid in sorted(owned)}
    def apply(o):
        if isinstance(o, dict):
            if o.get('pid') in remap:
                o['pid'] = remap[o['pid']]
            if 'opid' in o:
                if o['opid'] in remap:
                    o['opid'] = remap[o['opid']]
                elif o['opid'] == skel_time:
                    o['opid'] = my_root_time
            for v in o.values():
                apply(v)
        elif isinstance(o, list):
            for v in o:
                apply(v)
    apply(src)
    src['name'] = name
    return src

# ── empty drum slot ──────────────────────────────────────────────────────────
# Omitting 's' key = no sample loaded; user loads on the iPad.

def make_slot(note):
    return {
        'rn':  note,
        'rt':  note,
        'rf':  note,
        'vf':  0.0,
        'vt':  1.0,
        'amp': 1.0,
        'md':  0,      # 0 = one-shot
        'nb':  1.0,
    }

# ── drum sampler sub-track ────────────────────────────────────────────────────
# BSDramboRackModule containing BSMidiToCVModule + BSMultiSamplerModule.
# Audio routing uses destNode1/2/3 (named targets), matching real Drambo projects.

def make_drum_track(name, notes, root_time_pid):
    sub_pid  = npid()
    sub_aud  = npid()   # sub-track 'Out' output pid
    sub_mid  = npid()   # sub-track 'MIDI' output pid
    io_aud   = npid()   # ioutput: Audio in
    io_mid   = npid()   # ioutput: MIDI
    io_time  = npid()   # ioutput: Time

    cv_pid   = npid()   # BSMidiToCVModule pid
    cv_key   = npid()
    cv_gate  = npid()
    cv_vel   = npid()
    cv_p0    = npid()   # 2 params required by the module
    cv_p1    = npid()

    sa_pid   = npid()   # BSMultiSamplerModule pid
    sa_out   = npid()
    sp       = [npid() for _ in range(8)]   # sampler params
    tp       = [npid() for _ in range(9)]   # sub-track params

    midi_to_cv = {
        'class':     'BSMidiToCVModule',
        'name':      'MIDI to CV',
        'modelName': 'MIDI to CV',
        'modelId':   0,
        'pid':       cv_pid,
        'hcv':       False,
        'mr':        True,
        'vam':       0,
        'params': [
            {'pid': cv_p0, 'v': 1.0, 'hcv': False},
            {'pid': cv_p1, 'v': 0.0, 'hcv': False},
        ],
        'inputs':  [{'ac': True, 'tp': 5, 'ace': True, 'opid': io_mid}],
        'outputs': [
            {'pid': cv_key,  'nm': 'Key', 'tp': 2},
            {'pid': cv_gate, 'nm': 'G',   'tp': 3},
            {'pid': cv_vel,  'nm': 'V',   'tp': 4},
        ],
    }

    sampler = {
        'class':     'BSMultiSamplerModule',
        'name':      'Sampler',
        'modelName': 'Sampler',
        'modelId':   0,
        'pid':       sa_pid,
        'hcv':       False,
        'mn':        False,
        're':        True,
        'rsn':       'Ext.In 1',
        'pr':        1,
        'slots':     [make_slot(n) for n in notes],
        'params': [
            {'pid': sp[0], 'v': 1.0,   'hcv': False},
            {'pid': sp[1], 'v': 0.0,   'hcv': False},
            {'pid': sp[2], 'v': 0.0,   'hcv': False},
            {'pid': sp[3], 'v': 0.0,   'hcv': False},
            {'pid': sp[4], 'v': 500.0, 'hcv': False},
            {'pid': sp[5], 'v': 1.0,   'hcv': False},
            {'pid': sp[6], 'v': 250.0, 'hcv': False},
            {'pid': sp[7], 'v': 1.0,   'hcv': False},
        ],
        'outputs': [{'pid': sa_out, 'nm': '', 'tp': 0}],
        'inputs': [
            {'ac': True, 'tp': 3, 'ace': True, 'opid': cv_gate},
            {'ac': True, 'tp': 2, 'ace': True, 'opid': cv_key},
            {'ac': True, 'tp': 4, 'ace': True, 'opid': cv_vel},
            {'ac': True, 'tp': 0, 'ace': True, 'opid': io_aud},
        ],
    }

    param_defaults = [1.0, 1.0, 0.0, 0.3, 0.0, 0.0, 0.0, 0.5, 0.0]

    return {
        'class':          'BSDramboRackModule',
        'modelName':      'Track',
        'modelId':        0,
        'name':           name,
        'pid':            sub_pid,
        'hcv':            False,
        'type':           0,
        'voices':         1,
        'midiRecv':       0,
        'midiInputMode':  1,
        'midiMaskC':      -1,
        'midiMaskN':      -1,
        'midiPC':         -1,
        'midiSrcExtPort': 'All',
        'midiDstExtPort': '- -',
        'midiDstExtChn':  -1,
        'audioRecv':      0,
        'retrig':         True,
        'fv':             False,
        'sv':             False,
        'solog':          0,
        'muteStl':        False,
        'tspeed':         1.0,
        # Named routing targets — same scheme as hand-built Drambo projects.
        'destNode1':      'Master',
        'destNode2':      'A',
        'destNode3':      'B',
        'kbd': {'oct': 4, 'keys': [{'n': notes[0], 'g': 0.5, 'v': 1.0, 'o': 0.0}]},
        'params': [
            {'pid': tp[i], 'v': param_defaults[i], 'hcv': False}
            for i in range(9)
        ],
        'outputs': [
            {'pid': sub_aud, 'nm': 'Out',  'tp': 0},
            {'pid': sub_mid, 'nm': 'MIDI', 'tp': 5},
        ],
        'inputs': [
            {'ace': True, 'tp': 0, 'ac': False},
            {'ac': True,  'tp': 6, 'ace': True, 'opid': root_time_pid},
            {'ace': True, 'tp': 2, 'ac': False},
            {'ace': True, 'tp': 5, 'ac': False},
        ],
        'ioutputs': [
            {'pid': io_aud,  'nm': 'Audio in', 'tp': 0},
            {'pid': io_mid,  'nm': 'MIDI',     'tp': 5},
            {'pid': io_time, 'nm': 'Time',     'tp': 6},
        ],
        'iinputs': [
            {'ac': True, 'tp': 0, 'ace': True, 'opid': sa_out},
            {'ac': True, 'tp': 5, 'ace': True, 'opid': io_mid},
        ],
        'modules': [midi_to_cv, sampler],
    }

# ── assemble project ─────────────────────────────────────────────────────────

with open(TEMPLATE, 'rb') as f:
    proj = plistlib.load(f)
proj['projectName'] = 'drum-sampler'

tracks        = proj['tracks']
sub_tracks    = tracks.get('modules', [])
my_root_time  = time_pid(tracks)

# Inject atom-sq-drums.moz into the Mozaic module (sub-track 0)
mozaic_mod = find_au_midi(sub_tracks)
if not mozaic_mod:
    raise RuntimeError('BSAUMidiModule not found in template')
script_text = SCRIPT.read_text(encoding='utf-8')
mozaic_mod['unitDescription']['fullState']['CODE'] = script_text.encode('utf-8')

mozaic_sub = sub_tracks[0]
mozaic_sub['name']           = 'LED'
mozaic_sub['midiDstExtPort'] = 'ATOM SQ'
mozaic_sub['midiDstExtChn']  = -1
# Remove destNode routing — LED track sends no audio, only MIDI to ATOM SQ
mozaic_sub.pop('destNode1', None)
mozaic_sub.pop('destNode2', None)
mozaic_sub.pop('destNode3', None)
# Connect Time input
ins = mozaic_sub.get('inputs', [])
if len(ins) >= 2:
    ins[1] = {'ac': True, 'ace': True, 'opid': my_root_time, 'tp': 6}

# Keep only the Mozaic MIDI output in iinputs (no audio for LED-only track)
mozaic_midi_out = mozaic_sub['iinputs'][1]['opid']
mozaic_sub['iinputs'] = [
    {'ac': False, 'ace': True, 'tp': 0},
    {'ac': True,  'ace': True, 'opid': mozaic_midi_out, 'tp': 5},
]

# Build 8 drum sampler sub-tracks
drum_tracks = [
    make_drum_track(name, notes, my_root_time)
    for name, notes in DRUM_GROUPS
]

# Clone A / B / Master mixer tracks from skeleton (preserves their destNode routing)
with open(SKELETON, 'rb') as f:
    skel = plistlib.load(f)
skel_subs = {s.get('name'): s for s in skel['tracks']['modules']}
skel_time = time_pid(skel['tracks'])

track_A      = clone_mixer_track(skel_subs, skel_time, 'A',      my_root_time)
track_B      = clone_mixer_track(skel_subs, skel_time, 'B',      my_root_time)
track_Master = clone_mixer_track(skel_subs, skel_time, 'Master', my_root_time)

mst_audio_out = track_Master['outputs'][0]['pid']
mst_midi_out  = track_Master['outputs'][1]['pid']

# Final track order: LED | Kick | Sub | Snare | Rim | Hat | CHat | Cymbal | Perc | A | B | Master
tracks['modules'] = [mozaic_sub] + drum_tracks + [track_A, track_B, track_Master]

tracks['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
    {'ac': True, 'ace': True, 'opid': mst_midi_out,  'tp': 5},
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
]

# ── save ─────────────────────────────────────────────────────────────────────

OUTPUT.parent.mkdir(exist_ok=True)
with open(OUTPUT, 'wb') as f:
    plistlib.dump(proj, f, fmt=plistlib.FMT_BINARY)

print(f'Written: {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)')
print()
print('Sub-tracks:')
print('  LED          → ATOM SQ (Mozaic LED feedback, all 32 pads)')
for name, notes in DRUM_GROUPS:
    lo, hi = notes[0], notes[-1]
    print(f'  {name:<12}  notes {lo}-{hi}  ({len(notes)} empty slots)')
print('  A / B / Master  (mixer bus)')
