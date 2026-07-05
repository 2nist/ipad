#!/usr/bin/env python3
"""
generate-atomsq-project.py
Builds projects/atom-sq-template.drproject from the Mozaictrk1 template.

Architecture (single sub-track):
  external MIDI (ATOM SQ pads) ──┬─→ Mozaic (@OnMidiInput) ──→ LED NoteOns ──→ ATOM SQ
                                  │   SendMIDIThru ────────────────→ Flexi sampler → audio
                                  └─→ Flexi sampler (3sleeves_BoomBap+, bottom row 36-51)

Top-row pads (52-67) light up via Mozaic LEDs but don't trigger samples —
the sampler's note range is 36-51. Expanding to all 32 pads is a future
enhancement (just widen NOTE_LO/NOTE_HI).

Usage:
  python3 tools/generate-atomsq-project.py
"""
import copy
import plistlib
from pathlib import Path

REPO      = Path(__file__).parent.parent
TEMPLATE  = REPO / 'scripts' / 'Mozaictrk1.drproject'
SCRIPT    = REPO / 'scripts' / 'atom-sq-template-thru.moz'
BUILDING  = REPO / 'userdl' / 'Building-blocks.drproject'
SKELETON  = REPO / 'Master.drproject'
OUTPUT    = REPO / 'projects' / 'atom-sq-template.drproject'

# ── Flexi sampler preset ──────────────────────────────────────────────────
# Change these to use a different preset from Building-blocks.drproject.
# Default: 3sleeves_BoomBap1 (track 5, BSCustomRackModule pid=1022).
BUILDING_TRACK_INDEX = 5       # 0-based track index in Building-blocks
NOTE_LO = 36                   # bottom-row first pad
NOTE_HI = 51                   # bottom-row last pad (16 pads)

# ── pid counter ─────────────────────────────────────────────────────────────
_pid = [200]

def npid():
    _pid[0] += 1
    return _pid[0]


# ── Sampler clone ───────────────────────────────────────────────────────────
# We clone the BSCustomRackModule that wraps the Flexi sampler (includes its
# internal effect chain), remap every owned pid to a fresh unique value, then
# fix the three external input opids to point to our sub-track's ioutputs.
# Finally we set the outer MIDI note filter to NOTE_LO..NOTE_HI.
#
# Building-blocks track 5:
#   Sub-track ioutputs: 1025 (Audio in), 1026 (MIDI), 1027 (Time)
#   BSCustomRackModule pid=1022 "3sleeves_BoomBap+"
#     inputs[0] opid=1025, inputs[1] opid=1026, inputs[5] opid=1027
#     ioutputs: 1044 (Audio in), 1082, 1045 (MIDI), 1046, 1047 (Time), 1083
#     modules:
#       pid=1028 BSFlexSampler "BBF2"
#         inputs[0] opid=1044, inputs[1] opid=1045, inputs[2] opid=1046, inputs[3] opid=1047
#       pid=1048 BSPeakEQModule ...
#       pid=1054 BSReverbModule ...
#       pid=1063 BSChannelEQModule ...
#       pid=1069 BSScopeModule ...
#       pid=1074 BSAmpEnvelopeModuleAD2 ...

def clone_sampler(our_audio_in, our_midi_in, our_time_in):
    """
    Returns (module_dict, audio_out_pid).
    our_audio_in / our_midi_in / our_time_in: pids from our sub-track's
    ioutputs that feed audio/MIDI/time signals into the rack.
    """
    with open(BUILDING, 'rb') as f:
        bb = plistlib.load(f)
    bb_track = bb['tracks']['modules'][BUILDING_TRACK_INDEX]

    # Building-blocks' sub-track ioutputs pids
    bb_audio_in = bb_track['ioutputs'][0]['pid']   # 1025
    bb_midi_in  = bb_track['ioutputs'][1]['pid']   # 1026
    bb_time_in  = bb_track['ioutputs'][2]['pid']   # 1027

    rack = copy.deepcopy(bb_track['modules'][0])   # the BSCustomRackModule

    # Collect every pid that belongs to this module tree.
    owned = set()
    def gather(o):
        if isinstance(o, dict):
            if isinstance(o.get('pid'), int):
                owned.add(o['pid'])
            for v in o.values():
                gather(v)
        elif isinstance(o, list):
            for v in o:
                gather(v)
    gather(rack)

    # Map each owned pid to a fresh unique value.
    remap = {pid: npid() for pid in sorted(owned)}
    old_audio_out = rack['outputs'][0]['pid']   # will be in remap

    def apply(o):
        if isinstance(o, dict):
            if o.get('pid') in remap:
                o['pid'] = remap[o['pid']]
            if isinstance(o.get('opid'), int) and o['opid'] in remap:
                o['opid'] = remap[o['opid']]
            for v in o.values():
                apply(v)
        elif isinstance(o, list):
            for v in o:
                apply(v)
    apply(rack)

    new_audio_out = remap[old_audio_out]

    # Fix the three external input opids to point to our sub-track signals.
    ext_map = {bb_audio_in: our_audio_in,
               bb_midi_in:  our_midi_in,
               bb_time_in:  our_time_in}
    for inp in rack.get('inputs', []):
        old = inp.get('opid')
        if old in ext_map:
            inp['opid'] = ext_map[old]

    # Set outer MIDI note filter to our pad range.
    # The BSCustomRackModule has BSMidiFilterModule instances inside it;
    # we find the outermost one (usually named "Instrument key range" or first
    # BSMidiFilterModule) and set its note-low/note-high params.
    def patch_filters(obj):
        if isinstance(obj, dict):
            if obj.get('class') == 'BSMidiFilterModule':
                p = obj.get('params', [])
                if len(p) >= 3:
                    p[1]['v'] = float(NOTE_LO)
                    p[2]['v'] = float(NOTE_HI)
            for v in obj.values():
                patch_filters(v)
        elif isinstance(obj, list):
            for v in obj:
                patch_filters(v)
    patch_filters(rack)

    return rack, new_audio_out


# ── Mixer track cloning (A / B / Master) ─────────────────────────────────────

def time_pid(rack):
    for io in rack.get('ioutputs', []):
        if io.get('nm') == 'Time':
            return io['pid']
    return None

def set_bus(track, src, d1, d2, d3):
    track['trackAudioSrc']  = src
    track['trackAudioDst1'] = d1
    track['trackAudioDst2'] = d2
    track['trackAudioDst3'] = d3

def wire_time(track, root_time):
    ins = track.get('inputs')
    if ins and len(ins) >= 2 and root_time is not None:
        ins[1] = {'ac': True, 'ace': True, 'opid': root_time, 'tp': 6}

def clone_mixer_track(skel_subs, skel_time, name, bus, my_root_time):
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
    set_bus(src, *bus)
    return src


# ── Assemble the project ─────────────────────────────────────────────────────

with open(TEMPLATE, 'rb') as f:
    proj = plistlib.load(f)
proj['projectName'] = 'atom-sq-template'

tracks     = proj['tracks']
sub_tracks = tracks.get('modules', [])
my_root_time = time_pid(tracks)            # pid=189

# ── Inject atom-sq-template-thru.moz into Mozaic (sub-track 0) ──────────────
def find_au_midi(module_list):
    for m in module_list:
        if m.get('class') == 'BSAUMidiModule':
            return m
        if 'modules' in m:
            found = find_au_midi(m['modules'])
            if found:
                return found
    return None

mozaic = find_au_midi(sub_tracks)
if not mozaic:
    raise RuntimeError('BSAUMidiModule not found in template')

script_text = SCRIPT.read_text(encoding='utf-8')
mozaic['unitDescription']['fullState']['CODE'] = script_text.encode('utf-8')

sub_tracks[0]['name'] = 'ATOM SQ+Sampler'
sub_tracks[0]['midiDstExtPort'] = 'ATOM SQ'
sub_tracks[0]['midiDstExtChn']  = -1
sub_tracks[0].pop('destNode1', None)
set_bus(sub_tracks[0], 0, 2, 3, 4)
wire_time(sub_tracks[0], my_root_time)

# Signal flow inside this sub-track:
#   external MIDI (ATOM SQ pads) ──┬─→ Mozaic (@OnMidiInput ─→ LED NoteOns → ATOM SQ)
#                                   │    SendMIDIThru
#                                   └─→ Flexi sampler (BoomBap+) → audio out

# ioutputs of this sub-track — signals available to modules inside.
led_audio_in = sub_tracks[0]['ioutputs'][0]['pid']   # 38  audio in (unused)
led_midi_in  = sub_tracks[0]['ioutputs'][1]['pid']   # 33  MIDI ← ATOM SQ pad notes
led_time_in  = sub_tracks[0]['ioutputs'][2]['pid']   # 39  Time

# Mozaic is already in this sub-track. Its MIDI OUT (pid=36) is already wired
# to iinputs MIDI so it flows to midiDstExtPort='ATOM SQ'. The SendMIDIThru
# in the script forwards incoming notes to the same MIDI bus that the sampler
# listens on, because they share the sub-track's MIDI ioutput.

# Add Flexi sampler (BoomBap+) alongside Mozaic. Both read from the same
# MIDI bus (led_midi_in).
sampler, sampler_audio_out = clone_sampler(led_audio_in, led_midi_in, led_time_in)
sub_tracks[0]['modules'].append(sampler)

# Route sampler's audio to this sub-track's audio output.
# Keep Mozaic's MIDI OUT on the MIDI slot — unchanged from template.
mozaic_midi_out = sub_tracks[0]['iinputs'][1]['opid']  # pid=36
sub_tracks[0]['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': sampler_audio_out, 'tp': 0},   # sampler audio → track Out
    {'ac': True, 'ace': True, 'opid': mozaic_midi_out,   'tp': 5},   # Mozaic MIDI → ATOM SQ
]

# ── Clone A / B / Master mixer tracks from skeleton ─────────────────────────
with open(SKELETON, 'rb') as f:
    skel = plistlib.load(f)
skel_subs = {s.get('name'): s for s in skel['tracks']['modules']}
skel_time = time_pid(skel['tracks'])

track_A      = clone_mixer_track(skel_subs, skel_time, 'A',      (2, 2, 4, 0), my_root_time)
track_B      = clone_mixer_track(skel_subs, skel_time, 'B',      (3, 2, 0, 0), my_root_time)
track_Master = clone_mixer_track(skel_subs, skel_time, 'Master', (1, 1, 0, 0), my_root_time)

mst_audio_out = track_Master['outputs'][0]['pid']
mst_midi_out  = track_Master['outputs'][1]['pid']

# One combined sub-track + A/B/Master.
tracks['modules'] = [sub_tracks[0], track_A, track_B, track_Master]

# Root rack bus routing and final output linkage.
set_bus(tracks, 0, 0, 0, 0)
tracks['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
    {'ac': True, 'ace': True, 'opid': mst_midi_out,  'tp': 5},
    {'ac': True, 'ace': True, 'opid': mst_audio_out, 'tp': 0},
]

# ── Save ─────────────────────────────────────────────────────────────────────
OUTPUT.parent.mkdir(exist_ok=True)
with open(OUTPUT, 'wb') as f:
    plistlib.dump(proj, f, fmt=plistlib.FMT_BINARY)

print('Written: %s  (%d KB)' % (OUTPUT, OUTPUT.stat().st_size // 1024))
print('  Mozaic script: %s' % SCRIPT.name)
print('  Sampler preset: 3sleeves_BoomBap+ (notes %d-%d)' % (NOTE_LO, NOTE_HI))
print('  MIDI dst ext port: ATOM SQ')
print('  Tracks: A, B, Master')