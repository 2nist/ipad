#!/usr/bin/env python3
"""
generate-drum-project.py
Builds projects/drum-machine.drproject from the Mozaictrk1 template.

What it does:
  - Loads scripts/Mozaictrk1.drproject (binary plist with Mozaic already wired)
  - Replaces the Mozaic script CODE with scripts/atom-sq-drums.moz
  - Routes sub-track 1 MIDI output to ATOM SQ (LED feedback)
  - Replaces sub-track 2 modules with 8 native drum voices (notes 36-43)
  - Saves as projects/drum-machine.drproject (binary plist)

Drum voices:
  36 Kick    — BS808KickModule (AN Kick)
  37 Rim     — BSImpulseModule + envelope
  38 Snare   — BSImpulseModule + noise + envelope
  39 Perc1   — BSNoiseModulePoly (hi-pitched) + envelope
  40 Perc2   — BSNoiseModulePoly (lo-pitched) + envelope
  41 OpenHat — BSNoiseModulePoly + long envelope
  42 ClsdHat — BSNoiseModulePoly + short envelope
  43 SubKick — BS808KickModule (sub settings)

Usage:
  python3 tools/generate-drum-project.py
"""
import plistlib
from pathlib import Path

REPO     = Path(__file__).parent.parent
TEMPLATE = REPO / 'scripts' / 'Mozaictrk1.drproject'
SCRIPT   = REPO / 'scripts' / 'atom-sq-drums.moz'
OUTPUT   = REPO / 'projects' / 'drum-machine.drproject'

# ── pid counter ─────────────────────────────────────────────────────────────
# All pids are scoped to sub-track 2's modules array. They just need to be
# unique within that scope. We start above any pids already used at the
# sub-track level (params use 41-57 in template).
_pid_counter = [200]

def npid():
    _pid_counter[0] += 1
    return _pid_counter[0]

# ── module builders ──────────────────────────────────────────────────────────

def midi_filter(midi_opid, note):
    """Pass-through for one specific MIDI note. Returns (module_dict, midi_out_pid)."""
    m  = npid()
    p0 = npid()   # enabled
    p1 = npid()   # minNote
    p2 = npid()   # maxNote
    out = npid()  # MIDI output
    return {
        'class': 'BSMidiFilterModule',
        'hcv': False,
        'inputs': [{'ac': True, 'ace': True, 'opid': midi_opid, 'tp': 5}],
        'modelId': 0,
        'modelName': 'Note filter',
        'name': f'Note {note}',
        'outputs': [{'pid': out, 'tp': 5}],
        'params': [
            {'hcv': False, 'pid': p0, 'v': 1.0},
            {'hcv': False, 'pid': p1, 'v': float(note)},
            {'hcv': False, 'pid': p2, 'v': float(note)},
        ],
        'pid': m,
    }, out

def midi_to_cv(midi_opid):
    """MIDI → Key/Gate/Velocity CVs. Returns (module, key_pid, gate_pid, vel_pid)."""
    m   = npid()
    p0  = npid()     # mode
    p1  = npid()     # retrig
    k   = npid()     # Key output (pitch)
    g   = npid()     # Gate output
    v   = npid()     # Velocity output
    return {
        'class': 'BSMidiToCVModule',
        'hcv': False,
        'inputs': [{'ac': True, 'ace': True, 'opid': midi_opid, 'tp': 5}],
        'modelId': 0,
        'modelName': 'MIDI to CV',
        'mr': True,
        'name': 'MIDI to CV',
        'outputs': [
            {'nm': 'Key', 'pid': k, 'tp': 2},
            {'nm': 'G',   'pid': g, 'tp': 3},
            {'nm': 'V',   'pid': v, 'tp': 4},
        ],
        'params': [
            {'hcv': False, 'pid': p0, 'v': 1.0},
            {'hcv': False, 'pid': p1, 'v': 0.0},
        ],
        'pid': m,
        'vam': 0,
    }, k, g, v

def an_kick(gate_opid, freq_start=-0.16, pitch_decay=0.079, noise_lv=0.0):
    """BS808KickModule (AN Kick). Returns (module, audio_out_pid)."""
    m   = npid()
    p0  = npid()   # amplitude
    p1  = npid()   # freq_start
    p2  = npid()   # pitch_decay
    p3  = npid()   # noise
    out = npid()   # audio out
    return {
        'class': 'BS808KickModule',
        'hcv': False,
        'inputs': [
            {'ac': True,  'ace': True,  'opid': gate_opid, 'tp': 3},
            {'ac': False, 'ace': False, 'tp': 4},
        ],
        'modelId': 0,
        'modelName': 'AN Kick',
        'name': 'Kick Osc',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': [
            {'hcv': False, 'pid': p0, 'v': 1.0},
            {'hcv': False, 'pid': p1, 'v': freq_start},
            {'hcv': False, 'pid': p2, 'v': pitch_decay},
            {'hcv': False, 'pid': p3, 'v': noise_lv},
        ],
        'pid': m,
    }, out

def impulse_osc(gate_opid, vel_opid, freq=200.0):
    """BSImpulseModule. Returns (module, audio_out_pid)."""
    m   = npid()
    out = npid()
    params = []
    for v in [1.0, 0.0, freq, 1.0, 1.0, 0.686]:
        params.append({'hcv': False, 'pid': npid(), 'v': v})
    return {
        'class': 'BSImpulseModule',
        'hcv': False,
        'inputs': [
            {'ac': True, 'ace': True, 'opid': gate_opid, 'tp': 3},
            {'ac': True, 'ace': True, 'opid': vel_opid,  'tp': 4},
        ],
        'modelId': 0,
        'modelName': 'Impulse',
        'name': 'Impulse',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': params,
        'pid': m,
    }, out

def noise_osc(model_id=3):
    """BSNoiseModulePoly. Returns (module, audio_out_pid)."""
    m   = npid()
    out = npid()
    params = []
    for v in [1.0, 0.5, 1.0]:
        params.append({'hcv': False, 'pid': npid(), 'v': v})
    return {
        'class': 'BSNoiseModulePoly',
        'hcv': False,
        'inputs': [],
        'modelId': model_id,
        'modelName': 'Noise',
        'name': 'Noise',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': params,
        'pid': m,
    }, out

def mix2(opid_a, opid_b, vol_a=0.7, vol_b=0.5):
    """BSMixerModule with 2 inputs. Returns (module, audio_out_pid)."""
    m   = npid()
    out = npid()
    return {
        'class': 'BSMixerModule',
        'hcv': False,
        'inputs': [
            {'ac': True, 'ace': True, 'opid': opid_a, 'tp': 0},
            {'ac': True, 'ace': True, 'opid': opid_b, 'tp': 0},
        ],
        'modelId': 0,
        'modelName': 'Mixer',
        'name': 'Mix',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': [
            {'hcv': False, 'pid': npid(), 'v': vol_a},
            {'hcv': False, 'pid': npid(), 'v': 0.5},
            {'hcv': False, 'pid': npid(), 'v': vol_b},
            {'hcv': False, 'pid': npid(), 'v': 0.5},
        ],
        'pid': m,
    }, out

def amp_env_ad2(audio_opid, gate_opid, vel_opid, attack=1.0, decay=100.0):
    """BSAmpEnvelopeModuleAD2. Returns (module, audio_out_pid)."""
    m   = npid()
    out = npid()
    params = []
    for v in [1.0, attack, decay, 1.0, 1.0, 0.0]:
        params.append({'hcv': False, 'pid': npid(), 'v': v})
    return {
        'class': 'BSAmpEnvelopeModuleAD2',
        'hcv': False,
        'inputs': [
            {'ac': True, 'ace': False, 'opid': audio_opid, 'tp': 0},
            {'ac': True, 'ace': True,  'opid': gate_opid,  'tp': 3},
            {'ac': True, 'ace': True,  'opid': vel_opid,   'tp': 4},
        ],
        'modelId': 0,
        'modelName': 'Amp env AD',
        'name': 'Amp Env',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': params,
        'pid': m,
    }, out

def drum_mixer(input_opids):
    """Final BSMixerModule summing all 8 voices. Returns (module, audio_out_pid)."""
    m   = npid()
    out = npid()
    inputs = []
    params = []
    for opid in input_opids:
        inputs.append({'ac': True, 'ace': True, 'opid': opid, 'tp': 0})
        params.append({'hcv': False, 'pid': npid(), 'v': 0.8})  # level
        params.append({'hcv': False, 'pid': npid(), 'v': 0.5})  # pan
    return {
        'class': 'BSMixerModule',
        'hcv': False,
        'inputs': inputs,
        'modelId': 0,
        'modelName': 'Mixer',
        'name': 'Drum Bus',
        'outputs': [{'pid': out, 'tp': 0}],
        'params': params,
        'pid': m,
    }, out

# ── build the 8 drum voices ──────────────────────────────────────────────────
# MIDI bus pid: this is the opid inside sub-track 2 that carries incoming MIDI.
# Sub-track 2's iinputs assigns MIDI to opid=58. All BSMidiFilterModules read from it.
MIDI_BUS = 58

voice_modules = []
voice_outs = []

# ── 36 KICK ──────────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 36)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
kk, kk_o = an_kick(cv_g, freq_start=-0.16, pitch_decay=0.079)
voice_modules += [mf, cv, kk]
voice_outs.append(kk_o)

# ── 37 RIM ───────────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 37)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
im, im_o = impulse_osc(cv_g, cv_v, freq=400.0)
ae, ae_o = amp_env_ad2(im_o, cv_g, cv_v, attack=1.0, decay=25.0)
voice_modules += [mf, cv, im, ae]
voice_outs.append(ae_o)

# ── 38 SNARE ─────────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 38)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
im, im_o = impulse_osc(cv_g, cv_v, freq=180.0)
nz, nz_o = noise_osc(model_id=3)
mx, mx_o = mix2(im_o, nz_o, vol_a=0.6, vol_b=0.5)
ae, ae_o = amp_env_ad2(mx_o, cv_g, cv_v, attack=1.0, decay=75.0)
voice_modules += [mf, cv, im, nz, mx, ae]
voice_outs.append(ae_o)

# ── 39 PERC 1 ────────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 39)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
nz, nz_o = noise_osc(model_id=1)   # model 1 = different noise colour
ae, ae_o = amp_env_ad2(nz_o, cv_g, cv_v, attack=1.0, decay=40.0)
voice_modules += [mf, cv, nz, ae]
voice_outs.append(ae_o)

# ── 40 PERC 2 ────────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 40)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
nz, nz_o = noise_osc(model_id=2)   # model 2 = different noise colour
ae, ae_o = amp_env_ad2(nz_o, cv_g, cv_v, attack=1.0, decay=55.0)
voice_modules += [mf, cv, nz, ae]
voice_outs.append(ae_o)

# ── 41 OPEN HAT ──────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 41)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
nz, nz_o = noise_osc(model_id=3)
ae, ae_o = amp_env_ad2(nz_o, cv_g, cv_v, attack=1.0, decay=400.0)
voice_modules += [mf, cv, nz, ae]
voice_outs.append(ae_o)

# ── 42 CLOSED HAT ────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 42)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
nz, nz_o = noise_osc(model_id=3)
ae, ae_o = amp_env_ad2(nz_o, cv_g, cv_v, attack=1.0, decay=25.0)
voice_modules += [mf, cv, nz, ae]
voice_outs.append(ae_o)

# ── 43 SUB KICK ──────────────────────────────────────────────────────────────
mf, mf_o = midi_filter(MIDI_BUS, 43)
cv, cv_k, cv_g, cv_v = midi_to_cv(mf_o)
sk, sk_o = an_kick(cv_g, freq_start=-0.55, pitch_decay=0.03)  # low, slow sweep
voice_modules += [mf, cv, sk]
voice_outs.append(sk_o)

# ── Master drum mixer ─────────────────────────────────────────────────────────
dm, dm_o = drum_mixer(voice_outs)
voice_modules.append(dm)

# ── Assemble the project ─────────────────────────────────────────────────────
with open(TEMPLATE, 'rb') as f:
    proj = plistlib.load(f)

proj['projectName'] = 'drum-machine'

tracks = proj['tracks']
sub_tracks = tracks.get('modules', [])

# ── Inject atom-sq-drums.moz script into Mozaic (sub-track 1) ────────────────
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

# Route sub-track 1 MIDI output to ATOM SQ so LED commands reach the hardware
sub_tracks[0]['midiDstExtPort'] = 'ATOM SQ'
sub_tracks[0]['midiDstExtChn'] = -1
sub_tracks[0].pop('destNode1', None)   # absent = route to Drambo master bus

# ── Replace sub-track 2 modules with drum voices ──────────────────────────────
# sub_tracks[1] is the second BSDramboRackModule (already wired to Ext.Out 1 or 2).
# Its iinputs assign opid=58 for incoming MIDI — our BSMidiFilterModules use that.
drum_track = sub_tracks[1]
drum_track['modules'] = voice_modules
drum_track['name'] = 'Drums'
drum_track.pop('destNode1', None)   # absent = route to Drambo master bus
drum_track['outputs'] = [
    {'nm': 'Out',  'pid': 50, 'tp': 0},
    {'nm': 'MIDI', 'pid': 51, 'tp': 5},
]
# Wire the drum mixer's audio output to the sub-track's audio output.
# iinputs.opid is how Drambo routes an internal module's output to the rack's
# external output — it must reference the drum mixer's output pid (dm_o).
# Without this, synthesized audio is floating and never reaches the track output.
drum_track['iinputs'] = [
    {'ac': True, 'ace': True, 'opid': dm_o, 'tp': 0},    # drum bus audio → track out
    {'ac': True, 'ace': True, 'opid': MIDI_BUS, 'tp': 5}, # MIDI passthrough
]

# Drop the 6 unused stub tracks that came from the template (only keep LED + Drums)
tracks['modules'] = sub_tracks[:2]

# ── Save ──────────────────────────────────────────────────────────────────────
OUTPUT.parent.mkdir(exist_ok=True)
with open(OUTPUT, 'wb') as f:
    plistlib.dump(proj, f, fmt=plistlib.FMT_BINARY)

print(f'Written: {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)')
