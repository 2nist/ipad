#!/usr/bin/env python3
"""
generate-drum-project.py
Builds projects/drum-machine.drproject from the Mozaictrk1 template.

Drum sounds: DR Rackula factory rack (/Instrument rack/3s-drums/DR Rackula.drmodule)
cloned from userdl/Building-blocks.drproject with pids remapped and note-range
filter widened to accept ATOM SQ pads (notes 36-43).

Usage:
  python3 tools/generate-drum-project.py
"""
import copy
import plistlib
from pathlib import Path

REPO      = Path(__file__).parent.parent
TEMPLATE  = REPO / 'scripts' / 'Mozaictrk1.drproject'
SCRIPT    = REPO / 'scripts' / 'atom-sq-drums.moz'
BUILDING  = REPO / 'userdl' / 'Building-blocks.drproject'
SKELETON  = REPO / 'Master.drproject'
OUTPUT    = REPO / 'projects' / 'drum-machine.drproject'

# ── pid counter ─────────────────────────────────────────────────────────────
# All new pids must be unique across the project. Template pids reach ~190,
# so we start safely above that.
_pid = [200]

def npid():
    _pid[0] += 1
    return _pid[0]

# ── DR Rackula clone ─────────────────────────────────────────────────────────
# Building-blocks contains a live, working BSCustomRackModule that references
# the factory preset /Instrument rack/3s-drums/DR Rackula.drmodule. It has its
# full internal structure serialised. We deep-copy it, remap every "owned" pid
# to a fresh unique value, then fix the three external input opids that pointed
# to Building-blocks' sub-track ioutputs so they point to our track instead.
# Finally we widen the outer MIDI filter from notes 48-119 to 0-127 so ATOM SQ
# pads (notes 36-43) are not blocked.

def clone_dr_rackula(our_audio_in, our_midi_in, our_time_in):
    """
    Returns (module_dict, audio_out_pid).
    our_audio_in / our_midi_in / our_time_in: pids from the drum sub-track's
    ioutputs that feed audio/MIDI/time signals into the rack.
    """
    with open(BUILDING, 'rb') as f:
        bb = plistlib.load(f)
    bb_drum_sub = bb['tracks']['modules'][0]

    # Building-blocks' drum sub-track ioutputs pids — these are the external
    # signals the DR Rackula's inputs point to (opid 27=audio, 28=MIDI, 29=time).
    bb_audio_in = bb_drum_sub['ioutputs'][0]['pid']   # 27
    bb_midi_in  = bb_drum_sub['ioutputs'][1]['pid']   # 28
    bb_time_in  = bb_drum_sub['ioutputs'][2]['pid']   # 29

    rack = copy.deepcopy(bb_drum_sub['modules'][0])   # the BSCustomRackModule

    # Collect every pid that belongs to (is "owned by") this module tree.
    # External opids (27, 28, 29) are references — not owned — so they won't
    # be in this set and will survive the remap unchanged.
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

    # Fix the three external input opids to point to our drum sub-track signals.
    ext_map = {bb_audio_in: our_audio_in,
               bb_midi_in:  our_midi_in,
               bb_time_in:  our_time_in}
    for inp in rack.get('inputs', []):
        old = inp.get('opid')
        if old in ext_map:
            inp['opid'] = ext_map[old]

    # Remap all note filters to our 8 ATOM SQ pads (36-43).
    # Factory defaults used notes 48-54 — none of our pads would trigger.
    #
    # Voice layout:
    #   36-37  Kick + Rim  → Simple kick   (Kick keys)
    #   38-39  Snare + P1  → Simple snare  (Snare keys)
    #   40     Perc 2      → Hat 1
    #   41     Open Hat    → Hat 2
    #   42-43  ClsHat+Sub  → Hat 3
    #
    # Outer filter: 36-43 (was 48-119)
    # Inner voice filters patched by name.
    note_map = {
        'Instrument key range': (36, 43),
        'Kick keys':            (36, 37),
        'Snare keys':           (38, 39),
        'Hat 1 keys':           (40, 40),
        'Hat 2 keys':           (41, 41),
        'Hat 3 keys':           (42, 43),
    }

    def patch_filters(obj):
        if isinstance(obj, dict):
            if obj.get('class') == 'BSMidiFilterModule':
                nm = obj.get('name', '')
                if nm in note_map:
                    p = obj.get('params', [])
                    if len(p) >= 3:
                        p[1]['v'] = float(note_map[nm][0])
                        p[2]['v'] = float(note_map[nm][1])
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
proj['projectName'] = 'drum-machine'

tracks    = proj['tracks']
sub_tracks = tracks.get('modules', [])
my_root_time = time_pid(tracks)

# ── Inject atom-sq-drums.moz into Mozaic (sub-track 0) ───────────────────────
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

sub_tracks[0]['name'] = 'Drums+LED'
sub_tracks[0]['midiDstExtPort'] = 'ATOM SQ'
sub_tracks[0]['midiDstExtChn']  = -1
sub_tracks[0].pop('destNode1', None)
set_bus(sub_tracks[0], 0, 2, 3, 4)
wire_time(sub_tracks[0], my_root_time)

# This single sub-track handles BOTH LED feedback and drum synthesis.
# Putting them together guarantees both modules see the same external MIDI —
# Drambo only delivers external MIDI to one sub-track at a time (the focused
# one), so splitting them across two tracks meant the LED track was silent.
#
# Signal flow inside this sub-track:
#   external MIDI (ATOM SQ pads) ──┬─→ Mozaic (@OnMidiInput) ──→ LED NoteOns ──→ ATOM SQ
#                                  └─→ DR Rackula (voices)   ──→ audio out

# ioutputs of this sub-track — signals available to modules inside.
led_audio_in = sub_tracks[0]['ioutputs'][0]['pid']   # 38  audio in (unused, no audio source)
led_midi_in  = sub_tracks[0]['ioutputs'][1]['pid']   # 33  MIDI  ← ATOM SQ pad notes arrive here
led_time_in  = sub_tracks[0]['ioutputs'][2]['pid']   # 39  Time

# Mozaic is already in this sub-track (BSAUMidiModule, reads from led_midi_in=33,
# outputs MIDI OUT on pid=36). Its output is already wired to the sub-track's
# iinputs MIDI so it flows to midiDstExtPort='ATOM SQ'. No changes needed there.

# Add DR Rackula alongside Mozaic. Both read from the same MIDI bus (led_midi_in).
dr_rack, dr_audio_out = clone_dr_rackula(led_audio_in, led_midi_in, led_time_in)
sub_tracks[0]['modules'].append(dr_rack)

# Route DR Rackula's audio to this sub-track's audio output.
# Keep Mozaic's MIDI OUT (pid=36) on the MIDI slot — unchanged from template.
mozaic_midi_out = sub_tracks[0]['iinputs'][1]['opid']  # pid=36
sub_tracks[0]['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': dr_audio_out,    'tp': 0},   # drum audio → track Out
    {'ac': True, 'ace': True, 'opid': mozaic_midi_out, 'tp': 5},   # Mozaic MIDI → ATOM SQ
]

# ── Clone A / B / Master mixer tracks from skeleton ──────────────────────────
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

# ── Save ──────────────────────────────────────────────────────────────────────
OUTPUT.parent.mkdir(exist_ok=True)
with open(OUTPUT, 'wb') as f:
    plistlib.dump(proj, f, fmt=plistlib.FMT_BINARY)

print(f'Written: {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)')
