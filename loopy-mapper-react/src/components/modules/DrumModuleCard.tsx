// ═══════════════════════════════════════════════════════════════════
// DRUM MODULE CARD — Sample-based rhythm module with per-track
// IN/OUT routing, Volume/Start/Duration knobs, Fill expression,
// Section assignment, Clip Chain sequencer.
//
// Wired to Zustand store, SynthEngine (Tone.Sampler), and Transport.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useRef, useState } from 'react';
import {
  Play, Square, Volume2, Settings,
  Layers, ChevronDown, Activity,
  CircleDot, GripHorizontal, Power,
  LogIn, LogOut, Disc3, Mic, Edit2, FastForward, Repeat,
  Radio, Link2, ChevronUp, Plus,
  RotateCcw, Grid3X3,
} from 'lucide-react';
import { useLooperStore } from '../../store/store';
import { synthEngine } from '../../lib/synthEngine';
import { looperEngine } from '../../lib/audio-worklet';
import type { ModuleCard, ModuleTrackConfig, ModuleExpression, SoundSource, SamplerEngine, RhythmMode } from '../../types';
import { RHYTHM_MODE_COLORS, RHYTHM_MODE_LABELS } from '../../store/presets';
import { DualPolygonSVG } from './DualPolygonSVG';

// ═══ Rotary Knob ═══

const RotaryKnob: React.FC<{
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; size?: number; label: string; colorAccent: string;
}> = ({ value, onChange, min = 0, max = 100, size = 32, label, colorAccent }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const valDelta = (deltaY / 100) * range;
    let newVal = startVal.current + valDelta;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const pct = (value - min) / (max - min);
  const angle = -135 + (pct * 270);

  return (
    <div className="flex flex-col items-center gap-1 cursor-ns-resize group/knob"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="relative rounded-full bg-zinc-800 border border-zinc-950 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center transition-transform group-hover/knob:scale-105"
        style={{ width: size, height: size }}
      >
        <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={(size / 2) - 2} fill="none" stroke="#27272a" strokeWidth="3" />
          <circle cx={size / 2} cy={size / 2} r={(size / 2) - 2} fill="none" stroke={colorAccent} strokeWidth="3"
            strokeDasharray={`${pct * ((size / 2 - 2) * 2 * Math.PI)} 999`}
            transform={`rotate(-225 ${size / 2} ${size / 2})`}
            opacity={isDragging ? 1 : 0.6} />
        </svg>
        <div
          className="absolute w-1 rounded-full bg-zinc-200 shadow-sm"
          style={{
            height: size / 2.5,
            transformOrigin: 'bottom center',
            bottom: '50%',
            transform: `rotate(${angle}deg) translateY(-2px)`,
          }}
        />
      </div>
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider group-hover/knob:text-zinc-300 transition-colors">
        {label}
      </span>
    </div>
  );
};

// ═══ Track Editor (expands when pad is clicked) ═══

const TrackEditor: React.FC<{
  module: ModuleCard;
  trackIndex: number;
  colorAccent: string;
}> = ({ module, trackIndex, colorAccent }) => {
  const updateTrack = useLooperStore(s => s.updateTrack);
  const setSoundSource = useLooperStore(s => s.setSoundSource);
  const trackState = useLooperStore(s => s.moduleStates[module.id]?.tracks.find(t => t.trackIndex === trackIndex));
  const track = module.tracks[trackIndex];
  const [showInMenu, setShowInMenu] = useState(false);
  const [showOutMenu, setShowOutMenu] = useState(false);

  if (!track) return null;

  const isMuted = trackState?.state === 'muted';
  const isSoloed = trackState?.state === 'soloed';
  const voiceId = `${module.id}:${trackIndex}`;

  const sourceType = track.soundSource.type;
  const isSample = sourceType === 'sample';

  const handleSourceChange = (type: SoundSource['type']) => {
    switch (type) {
      case 'sample':
        setSoundSource(module.id, trackIndex, {
          type: 'sample',
          sampleId: null,
          sampleName: track.label,
          soundEngine: { type: 'sampler', sampleMap: { [track.midiNote]: '' }, rootNote: track.midiNote },
          transpose: 0,
          velocityScale: 1.0,
          triggerMode: 'oneShot',
        });
        break;
      case 'midiClip':
        setSoundSource(module.id, trackIndex, {
          type: 'midiClip',
          clipId: null,
          soundEngine: { type: 'tonejsPolySynth', synthConfig: { oscillatorType: 'triangle', attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } },
          transpose: 0,
          velocityScale: 1.0,
        });
        break;
      case 'liveMidi':
        setSoundSource(module.id, trackIndex, {
          type: 'liveMidi',
          midiChannel: 1,
          soundEngine: { type: 'tonejsPolySynth', synthConfig: { oscillatorType: 'triangle', attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } },
          recordMidi: false,
        });
        break;
      case 'audioInput':
        setSoundSource(module.id, trackIndex, {
          type: 'audioInput',
          inputChannel: 0,
          monitorEnabled: true,
        });
        break;
    }
    setShowInMenu(false);
  };

  const handleToggleMute = () => {
    const store = useLooperStore.getState();
    const newState = isMuted ? 'empty' : 'muted';
    store.setTrackState(module.id, trackIndex, { state: newState });
  };

  const handleToggleSolo = () => {
    const store = useLooperStore.getState();
    const newState = isSoloed ? 'empty' : 'soloed';
    store.setTrackState(module.id, trackIndex, { state: newState });
  };

  return (
    <div className="bg-zinc-950/80 border-t border-b border-zinc-800/80 p-2 flex gap-2 overflow-visible relative animate-in fade-in slide-in-from-top-2 duration-200">

      {/* LEFT: IN SECTION */}
      <div className="relative flex flex-col justify-stretch">
        <button
          onClick={() => setShowInMenu(!showInMenu)}
          className={`flex-1 flex flex-col items-center justify-center w-10 bg-zinc-900 border border-zinc-700/50 rounded-l-md hover:bg-zinc-800 transition-colors ${showInMenu ? 'bg-zinc-800 border-zinc-500' : ''}`}
        >
          <LogIn size={14} className="text-zinc-400 mb-1" />
          <span className="text-[9px] font-bold text-zinc-500">IN</span>
        </button>
        {showInMenu && (
          <div className="absolute top-full left-0 mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-20 flex flex-col p-1">
            <button onClick={() => handleSourceChange('sample')} className={`text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 ${isSample ? 'text-green-400 bg-green-900/30' : 'text-zinc-300 hover:bg-zinc-700'}`}><Disc3 size={12} /> Sample</button>
            <button onClick={() => handleSourceChange('midiClip')} className={`text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 ${sourceType === 'midiClip' ? 'text-green-400 bg-green-900/30' : 'text-zinc-300 hover:bg-zinc-700'}`}><Disc3 size={12} /> MIDI Clip</button>
            <button onClick={() => handleSourceChange('liveMidi')} className={`text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 ${sourceType === 'liveMidi' ? 'text-green-400 bg-green-900/30' : 'text-zinc-300 hover:bg-zinc-700'}`}><Activity size={12} /> Live MIDI</button>
            <button onClick={() => handleSourceChange('audioInput')} className={`text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 ${sourceType === 'audioInput' ? 'text-green-400 bg-green-900/30' : 'text-zinc-300 hover:bg-zinc-700'}`}><Mic size={12} /> Audio In</button>
          </div>
        )}
      </div>

      {/* CENTER: MAIN CONTROLS */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md p-2 flex flex-col gap-2">
        {/* Top bar: Name and Toggles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 w-32">
            <Edit2 size={10} className="text-zinc-500" />
            <input
              type="text"
              value={track.label}
              onChange={(e) => updateTrack(module.id, trackIndex, { label: e.target.value })}
              className="bg-transparent border-none text-xs text-zinc-200 font-bold focus:outline-none w-full"
            />
          </div>

          {isSample && (
            <div className="flex items-center gap-1.5 bg-zinc-950 p-0.5 rounded border border-zinc-800">
              <button
                onClick={() => setSoundSource(module.id, trackIndex, { ...track.soundSource, triggerMode: 'oneShot' } as any)}
                className={`px-2 py-0.5 text-[9px] font-bold rounded-sm transition-colors ${(track.soundSource as any).triggerMode === 'oneShot' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                1-SHOT
              </button>
              <button
                onClick={() => setSoundSource(module.id, trackIndex, { ...track.soundSource, triggerMode: 'gate' } as any)}
                className={`px-2 py-0.5 text-[9px] font-bold rounded-sm transition-colors ${(track.soundSource as any).triggerMode === 'gate' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                GATE
              </button>
            </div>
          )}
        </div>

        {/* Bottom bar: Knobs & Mutes */}
        <div className="flex items-end justify-between pt-1">
          <div className="flex gap-4 px-2">
            <RotaryKnob
              label="Vol"
              value={track.volume * 100}
              onChange={(v) => {
                updateTrack(module.id, trackIndex, { volume: v / 100 });
                synthEngine.setVoiceVolume(voiceId, v / 100);
              }}
              colorAccent={colorAccent}
            />
            <RotaryKnob
              label="Start"
              value={track.sampleStart ?? 0}
              onChange={(v) => updateTrack(module.id, trackIndex, { sampleStart: v })}
              colorAccent={colorAccent}
            />
            <RotaryKnob
              label="Dur"
              value={track.sampleDuration ?? 100}
              onChange={(v) => updateTrack(module.id, trackIndex, { sampleDuration: v })}
              colorAccent={colorAccent}
            />
          </div>

          <div className="flex gap-1 mb-1">
            <button
              onClick={handleToggleMute}
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all border ${isMuted ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
            >
              M
            </button>
            <button
              onClick={handleToggleSolo}
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all border ${isSoloed ? 'bg-green-500/20 border-green-500 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
            >
              S
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: OUT SECTION */}
      <div className="relative flex flex-col justify-stretch">
        <button
          onClick={() => setShowOutMenu(!showOutMenu)}
          className={`flex-1 flex flex-col items-center justify-center w-10 bg-zinc-900 border border-zinc-700/50 rounded-r-md hover:bg-zinc-800 transition-colors ${showOutMenu ? 'bg-zinc-800 border-zinc-500' : ''}`}
        >
          <LogOut size={14} className="text-zinc-400 mb-1" />
          <span className="text-[9px] font-bold text-zinc-500">OUT</span>
        </button>
        {showOutMenu && (
          <div className="absolute top-full right-0 mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-20 flex flex-col p-1">
            <button
              onClick={() => {
                // Open step sequencer for this track
                const store = useLooperStore.getState();
                store.openMidiEditor(module.id, trackIndex);
                setShowOutMenu(false);
              }}
              className="text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2"
            >
              <Grid3X3 size={12} /> Edit Pattern...
            </button>
            <button
              onClick={() => {
                // Open clip browser to select a sample
                const store = useLooperStore.getState();
                store.toggleClipBrowser();
                setShowOutMenu(false);
              }}
              className="text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2"
            >
              <Disc3 size={12} /> Assign Clip...
            </button>
            <button
              onClick={() => {
                // Trigger a test hit
                const voiceId = `${module.id}:${trackIndex}`;
                const src = track.soundSource;
                // Only MIDI clip, sample, and liveMidi sources have a soundEngine
                const engine = (src.type !== 'audioInput') ? src.soundEngine : { type: 'tonejsPolySynth' as const, synthConfig: { oscillatorType: 'triangle' as const, attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } };
                synthEngine.setVoice(voiceId, engine, track.volume);
                synthEngine.noteOn(voiceId, track.midiNote, 0.8);
                setTimeout(() => synthEngine.noteOff(voiceId, track.midiNote), 200);
                setShowOutMenu(false);
              }}
              className="text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2"
            >
              <Play size={12} /> Preview Hit
            </button>
            <button
              onClick={() => {
                const store = useLooperStore.getState();
                store.setSoundSource(module.id, trackIndex, {
                  type: 'midiClip',
                  clipId: null,
                  soundEngine: { type: 'midiOut', outputDeviceId: '', outputChannel: 10 },
                  transpose: 0,
                  velocityScale: 1.0,
                });
                setShowOutMenu(false);
              }}
              className="text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2"
            >
              <Activity size={12} /> MIDI Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══ Main Drum Module Card ═══

export const DrumModuleCard: React.FC<{ module: ModuleCard }> = ({ module }) => {
  const updateModule = useLooperStore(s => s.updateModule);
  const removeModule = useLooperStore(s => s.removeModule);
  const globalPlay = useLooperStore(s => s.globalPlay);
  const globalStop = useLooperStore(s => s.globalStop);
  const isPlaying = useLooperStore(s => s.transport.isPlaying);
  const position = useLooperStore(s => s.transport.position);
  const updateSection = useLooperStore(s => s.updateSection);
  const sections = useLooperStore(s => s.song.arrangement);
  const timeSignature = useLooperStore(s => s.song.metadata.timeSignature);
  const runtimeState = useLooperStore(s => s.moduleStates[module.id]);

  const [expandedTrackIndex, setExpandedTrackIndex] = useState<number | null>(null);
  const [showExpMenu, setShowExpMenu] = useState(false);
  const [showSequences, setShowSequences] = useState(false);
  
  // Use store-level assignment state
  const isAssigningSection = useLooperStore(s => s.ui.assigningModuleId) === module.id;
  const setAssigningModule = useLooperStore(s => s.setAssigningModule);

  // Track active pad for sequencer (store-level so bottom toolbar can access)
  const activeSeqTrack = useLooperStore(s => s.ui.midiEditorTrackIndex);
  const activeSeqModule = useLooperStore(s => s.ui.midiEditorModuleId);
  const openMidiEditor = useLooperStore(s => s.openMidiEditor);

  const expression = module.expression;
  const repeatCount = runtimeState?.repeatCount ?? 0;

  // Transport position ratio for playhead bar
  const activeSection = sections.find(s => s.activeModules.includes(module.id));
  const beatsPerBar = timeSignature.numerator * (4 / timeSignature.denominator);
  const totalBeats = (activeSection?.bars ?? 8) * beatsPerBar;
  const positionRatio = totalBeats > 0 ? (position.elapsedBeatsInSection % totalBeats) / totalBeats : 0;

  const handlePlayStop = () => {
    if (isPlaying) globalStop(); else globalPlay();
  };

  const handleToggleAssign = () => {
    if (isAssigningSection) {
      setAssigningModule(null);
    } else {
      setAssigningModule(module.id);
    }
  };

  // Section assignment is now handled by SectionTimeline's click handler
  // because it reads ui.assigningModuleId from the store

  // Build "sequence chain" from the module's expression fills
  const sequenceChain: { id: string; name: string; bars: number; linked: boolean }[] = [
    { id: 'main', name: module.label, bars: activeSection?.bars ?? 4, linked: true },
  ];
  if (expression?.enabled && expression.type === 'fill') {
    sequenceChain.push({
      id: 'fill-a',
      name: 'Fill A',
      bars: Math.ceil(expression.durationBeats / beatsPerBar),
      linked: false,
    });
  }

  return (
    <div className="relative group">
      {/* Node I/O Ports */}
      <div className="absolute -left-3 top-6 w-3 h-3 rounded-full bg-zinc-700 border-2 border-zinc-900 group-hover:bg-zinc-500 transition-colors cursor-crosshair z-10" />
      <div className="absolute -right-3 top-6 w-3 h-3 rounded-full border-2 border-zinc-900 group-hover:bg-zinc-500 transition-colors cursor-crosshair z-10" style={{ backgroundColor: module.colorAccent }} />

      <div
        className={`bg-zinc-900 rounded-xl flex flex-col font-sans border border-zinc-700/60 transition-shadow duration-300 relative z-0 ${module.tracks.length > 4 ? 'w-[420px]' : 'w-[340px]'}`}
        style={{ boxShadow: `0 20px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)` }}
      >
        {/* ROW 1: HEADER */}
        <div className="px-2 py-2 flex items-center justify-between border-b border-zinc-800/80 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-t-xl cursor-grab active:cursor-grabbing relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] opacity-80" style={{ backgroundColor: module.colorAccent }} />

          <div className="flex items-center gap-2">
            <GripHorizontal size={14} className="text-zinc-600 hover:text-zinc-400" />
            <div className="flex flex-col">
              <h2 className="text-zinc-100 font-bold text-xs tracking-wide leading-none">{module.label}</h2>
              <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-zinc-500 font-mono font-medium tracking-wider uppercase">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: module.colorAccent }} />
                  {module.bus}
                </div>
                <div className="w-px h-2 bg-zinc-700 mx-0.5" />
                <button
                  onClick={handleToggleAssign}
                  className={`flex items-center gap-0.5 transition-all ${isAssigningSection ? 'text-yellow-400 animate-pulse' : 'hover:text-zinc-300'}`}
                  title="Assign to Section"
                >
                  <Layers size={9} /> Section
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            {/* Rhythm Mode Toggle Pills */}
            <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 rounded border border-zinc-800">
              {(['loop', 'fill', 'clip'] as RhythmMode[]).map(mode => {
                const isActive = module.rhythmMode === mode;
                const color = RHYTHM_MODE_COLORS[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      const newColor = RHYTHM_MODE_COLORS[mode];
                      const newLabel = `${module.patternName ?? 'Pattern'} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
                      updateModule(module.id, { rhythmMode: mode, colorAccent: newColor, label: newLabel });
                    }}
                    className={`px-1.5 py-0.5 text-[8px] font-bold rounded-sm uppercase tracking-wider transition-all ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    style={isActive ? { backgroundColor: color, boxShadow: `0 0 6px ${color}80` } : {}}
                    title={`Change to ${RHYTHM_MODE_LABELS[mode]}`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />

            <button
              onClick={() => setShowExpMenu(!showExpMenu)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded transition-all text-[9px] font-bold uppercase tracking-wider ${expression?.enabled ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'}`}
            >
              <CircleDot size={10} className={expression?.enabled ? 'text-indigo-400 animate-pulse' : ''} />
              Fill
            </button>

            <button
              onClick={() => {
                // Open module editor in right panel
                const store = useLooperStore.getState();
                store.setEditorPanel({ type: 'module', moduleId: module.id });
                store.ui.rightPanelVisible = true;
              }}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-blue-400 transition-colors"
              title="Module Settings"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => removeModule(module.id)}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:bg-red-800 hover:text-red-300"
              title="Remove module"
            >
              <Power size={12} />
            </button>
          </div>
        </div>

        {/* EXPANDED FILL MENU */}
        {showExpMenu && (
          <div className="bg-zinc-950/80 border-b border-zinc-800/80 p-2.5 flex flex-col gap-2.5 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CircleDot size={12} className="text-indigo-400" /> Fill Expression
              </span>
              <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                <input
                  type="checkbox"
                  checked={expression?.enabled ?? false}
                  onChange={e => {
                    const expr = expression ?? {
                      type: 'fill' as const,
                      clipId: null,
                      trigger: { type: 'everyNRepeats' as const, everyN: 4 },
                      offsetBeats: 0,
                      durationBeats: 4,
                      behavior: 'layer' as const,
                      soundEngine: { type: 'tonejsPolySynth', synthConfig: { oscillatorType: 'triangle' as const, attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } },
                      transpose: 0,
                      enabled: true,
                    };
                    updateModule(module.id, { expression: { ...expr, enabled: e.target.checked } });
                  }}
                  className="accent-indigo-500 w-3 h-3 rounded-sm"
                />
                Enabled
              </label>
            </div>
            <div className="flex items-center justify-between pl-1">
              <span className="text-xs text-zinc-500 font-medium">Trigger Rule</span>
              <select
                className="bg-zinc-900 border border-zinc-700 rounded text-xs p-1 text-zinc-300 focus:outline-none focus:border-zinc-500"
                value={expression?.trigger.everyN ?? 4}
                onChange={e => {
                  if (!expression) return;
                  updateModule(module.id, {
                    expression: {
                      ...expression,
                      trigger: { ...expression.trigger, everyN: Number(e.target.value) },
                    },
                  });
                }}
              >
                <option value={2}>Every 2 Repeats</option>
                <option value={4}>Every 4 Repeats</option>
                <option value={8}>Every 8 Repeats</option>
                <option value={16}>Every 16 Repeats</option>
              </select>
            </div>
          </div>
        )}

        {/* ROW 2: TRACK SELECTORS — dynamic grid based on track count */}
        <div className={`p-2 grid gap-2 bg-zinc-900/50 ${module.tracks.length <= 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
          {module.tracks.map((track, i) => {
            const sourceType = track.soundSource.type;
            const hasSample = sourceType === 'sample' && (track.soundSource as any).sampleId !== null;
            const hasClip = sourceType === 'midiClip' && (track.soundSource as any).clipId !== null;
            const isLoaded = hasClip || hasSample;
            const isActiveSeqTrack = activeSeqModule === module.id && activeSeqTrack === i;

            const handlePadClick = () => {
              // 1. Select this pad for the sequencer
              openMidiEditor(module.id, i);
              // 2. Play preview sound
              const voiceId = `${module.id}:${i}`;
              const src = track.soundSource;
              const engine = (src.type !== 'audioInput') ? src.soundEngine : { type: 'tonejsPolySynth' as const, synthConfig: { oscillatorType: 'triangle' as const, attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } };
              synthEngine.setVoice(voiceId, engine, track.volume);
              synthEngine.noteOn(voiceId, track.midiNote, 0.8);
              setTimeout(() => synthEngine.noteOff(voiceId, track.midiNote), 150);
            };

            return (
              <button
                key={i}
                onClick={handlePadClick}
                className={`relative h-12 rounded-lg flex flex-col items-center justify-center transition-all duration-75 border ${isActiveSeqTrack ? 'bg-zinc-800 border-green-500/60 shadow-[0_0_12px_rgba(34,197,94,0.15)]' : 'bg-zinc-950 border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 active:bg-zinc-700 active:scale-95'}`}
              >
                {isActiveSeqTrack && <div className="absolute inset-0 rounded-lg bg-green-500/5" />}
                <span className={`text-lg font-bold leading-none mb-0.5 ${isActiveSeqTrack ? 'text-zinc-100' : 'text-zinc-400'}`}>
                  {i + 1}
                </span>
                <span className="text-[9px] font-mono font-medium text-zinc-500 flex items-center gap-0.5">
                  <Activity size={8} /> {track.midiNote}
                </span>
                {/* Source assigned dot (larger, green) */}
                {isLoaded && (
                  <div
                    className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                    title="Sample/Clip Assigned"
                    onClick={e => {
                      e.stopPropagation();
                      // Toggle kit browser
                      useLooperStore.getState().toggleDrumBrowser();
                    }}
                  />
                )}
                {/* Edit button */}
                <button
                  className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-200"
                  title="Edit track"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedTrackIndex(expandedTrackIndex === i ? null : i);
                  }}
                >
                  <Edit2 size={8} />
                </button>
              </button>
            );
          })}
        </div>

        {/* EXPANDED TRACK EDITOR */}
        {expandedTrackIndex !== null && (
          <TrackEditor
            module={module}
            trackIndex={expandedTrackIndex}
            colorAccent={module.colorAccent}
          />
        )}

        {/* ROW 3: TRANSPORT & POSITION */}
        <div className="px-3 py-2 bg-zinc-950 rounded-b-xl border-t border-zinc-800/50 flex flex-col relative z-10 transition-all">
          <div className="flex items-center justify-between gap-3">
            {/* Rec / Play Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  // Toggle recording for audio input tracks
                  for (const t of module.tracks) {
                    if (t.soundSource.type === 'audioInput') {
                      looperEngine.toggleRecord(t.index);
                    }
                  }
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors bg-zinc-900 text-zinc-500 hover:text-red-400"
              >
                <Radio size={12} fill="currentColor" />
              </button>
              <button
                onClick={handlePlayStop}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isPlaying ? 'bg-green-500/20 text-green-500' : 'bg-zinc-900 text-zinc-500 hover:text-green-400'}`}
              >
                {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 rounded border border-zinc-800">
              <Repeat size={10} className="text-zinc-500" />
              <span className="text-[10px] font-mono text-zinc-300 font-bold w-4 text-center">{repeatCount}</span>
            </div>

            {/* Linear Position / Visualizer */}
            <div className="flex-1 h-5 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden relative flex items-center">
              {[0, 1, 2, 3].map(step => (
                <div key={step} className="absolute inset-0 flex justify-evenly px-2" style={{ left: `${step * 25}%`, width: '25%' }}>
                  <div className="w-px h-full bg-zinc-800/80" />
                </div>
              ))}
              <div
                className="h-full relative transition-none"
                style={{
                  width: `${positionRatio * 100}%`,
                  background: `linear-gradient(90deg, transparent, ${module.colorAccent} 90%)`,
                  opacity: isPlaying ? 0.8 : 0.3,
                }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_#fff]" />
              </div>
            </div>

            <button
              onClick={() => setShowSequences(!showSequences)}
              className={`w-6 h-6 flex shrink-0 items-center justify-center rounded transition-colors ${showSequences ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
            >
              {showSequences ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* EXPANDED SEQUENCE/CLIP CHAIN */}
          {showSequences && (
            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-col gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Clip Chain</span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  Total: {sequenceChain.reduce((acc, curr) => acc + curr.bars, 0)} Bars
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-2 flex-nowrap items-center px-1">
                {sequenceChain.map((seq, idx) => (
                  <React.Fragment key={seq.id}>
                    <div className="bg-zinc-900 border border-zinc-700/80 hover:border-zinc-500 rounded px-2 py-1.5 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors group/seq">
                      <Disc3 size={12} className="text-indigo-400" />
                      <span className="text-[10px] font-bold text-zinc-300 group-hover/seq:text-zinc-100">{seq.name}</span>
                      <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1 rounded">{seq.bars}B</span>
                    </div>
                    {idx < sequenceChain.length - 1 && (
                      <button
                        onClick={() => {
                          // Toggle whether fill is linked (auto-follows main)
                          if (expression?.enabled) {
                            updateModule(module.id, {
                              expression: {
                                ...expression,
                                enabled: !expression.enabled,
                              },
                            });
                          }
                        }}
                        className={`shrink-0 p-0.5 rounded transition-colors ${seq.linked ? 'text-green-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                        <Link2 size={12} />
                      </button>
                    )}
                  </React.Fragment>
                ))}
                <button
                  onClick={() => {
                    // Add a new fill expression
                    const newExpr: ModuleExpression = {
                      type: 'fill',
                      clipId: null,
                      trigger: { type: 'everyNRepeats', everyN: 8 },
                      offsetBeats: 0,
                      durationBeats: 4,
                      behavior: 'layer',
                      soundEngine: { type: 'tonejsPolySynth', synthConfig: { oscillatorType: 'triangle', attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } },
                      transpose: 0,
                      enabled: true,
                    };
                    updateModule(module.id, { expression: newExpr });
                  }}
                  className="shrink-0 ml-1 w-7 h-7 flex items-center justify-center rounded border border-zinc-800 border-dashed text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900 transition-colors"
                  title="Add fill expression"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Section assignment status */}
          {isAssigningSection && (
            <div className="mt-2 text-[9px] text-yellow-400 text-center animate-pulse">
              Click a section block above to assign this module
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrumModuleCard;