// ═══════════════════════════════════════════════════════════════════
// MIDI SEQUENCER PANEL — Step sequencer that slides up from the
// bottom toolbar. Contextual to a clicked module track.
// Uses Tone.Transport for playback scheduling and SynthEngine for audio.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Trash2, ChevronDown, Grid3X3, Plus, Minus } from 'lucide-react';
import { useLooperStore } from '../../store/store';
import { synthEngine } from '../../lib/synthEngine';
import type { MidiEvent } from '../../types';

const STEPS = 16; // 16 steps = 1 bar of 16th notes
const VELOCITY_LEVELS = 4; // 4 velocity levels

interface Step {
  active: boolean;
  velocity: number; // 0.0-1.0
}

export const MidiSequencerPanel: React.FC = () => {
  const moduleId = useLooperStore(s => s.ui.midiEditorModuleId);
  const trackIndex = useLooperStore(s => s.ui.midiEditorTrackIndex);
  const isOpen = useLooperStore(s => s.ui.midiEditorOpen);
  const closeMidiEditor = useLooperStore(s => s.closeMidiEditor);
  const isPlaying = useLooperStore(s => s.transport.isPlaying);
  const position = useLooperStore(s => s.transport.position);

  const module = useLooperStore(s => moduleId ? s.song.modules.find(m => m.id === moduleId) : null);
  const track = module?.tracks[trackIndex ?? 0];

  // Step grid state
  const [steps, setSteps] = useState<Step[]>(() =>
    Array.from({ length: STEPS }, () => ({ active: false, velocity: 0.8 }))
  );
  const [currentStep, setCurrentStep] = useState(0);
  const prevBeatRef = useRef(-1);

  // Load existing MIDI data into steps when track changes
  useEffect(() => {
    if (!track || track.soundSource.type === 'audioInput') return;
    // Reset to empty grid
    setSteps(Array.from({ length: STEPS }, () => ({ active: false, velocity: 0.8 })));
  }, [moduleId, trackIndex]);

  // Follow transport position
  useEffect(() => {
    if (!isPlaying) return;
    const sixteenthBeat = Math.floor(position.beatInBar * 4) % STEPS;
    if (sixteenthBeat !== prevBeatRef.current) {
      prevBeatRef.current = sixteenthBeat;
      setCurrentStep(sixteenthBeat);

      // Play active steps on beat
      if (steps[sixteenthBeat]?.active && track && module) {
        const voiceId = `${module.id}:${track.index}`;
        const vel = steps[sixteenthBeat].velocity;
        synthEngine.noteOn(voiceId, track.midiNote, vel);
        // Short note-off for one-shot feel
        setTimeout(() => {
          synthEngine.noteOff(voiceId, track.midiNote);
        }, 100);
      }
    }
  }, [position.beatInBar, isPlaying, steps, track, module]);

  if (!isOpen || !module || !track) return null;

  const voiceId = `${module.id}:${track.index}`;
  const currentVelocity = steps[currentStep]?.velocity ?? 0.8;

  const toggleStep = (index: number) => {
    setSteps(prev => {
      const next = [...prev];
      next[index] = { ...next[index], active: !next[index].active };
      return next;
    });

    // Preview the step sound
    if (track.soundSource.type !== 'audioInput') {
      synthEngine.setVoice(voiceId, track.soundSource.type === 'sample'
        ? track.soundSource.soundEngine
        : { type: 'tonejsPolySynth', synthConfig: { oscillatorType: 'triangle', attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 } },
        track.volume);
      synthEngine.noteOn(voiceId, track.midiNote, 0.6);
      setTimeout(() => synthEngine.noteOff(voiceId, track.midiNote), 80);
    }
  };

  const adjustVelocity = (index: number, delta: number) => {
    setSteps(prev => {
      const next = [...prev];
      const newVel = Math.max(0, Math.min(1, (next[index].velocity || 0.8) + delta));
      next[index] = { ...next[index], velocity: newVel };
      return next;
    });
  };

  const clearAll = () => {
    setSteps(Array.from({ length: STEPS }, () => ({ active: false, velocity: 0.8 })));
  };

  // Convert steps to MidiEvent[] and save to track
  const savePattern = () => {
    const events: MidiEvent[] = [];
    let deltaTime = 0;
    const stepDuration = 0.25; // 16th note at 4/4 = 0.25 beats

    for (const step of steps) {
      if (step.active) {
        events.push({ deltaTime, type: 'noteOn', note: track.midiNote, velocity: Math.round(step.velocity * 127) });
        events.push({ deltaTime: stepDuration * 0.8, type: 'noteOff', note: track.midiNote, velocity: 0 });
        deltaTime = stepDuration * 0.2;
      } else {
        deltaTime += stepDuration;
      }
    }

    // Store the pattern on the track
    const store = useLooperStore.getState();
    store.updateTrack(module.id, track.index, {
      soundSource: {
        ...track.soundSource,
        clipData: new TextEncoder().encode(JSON.stringify(events)).buffer as any,
      } as any,
    });
    closeMidiEditor();
  };

  return (
    <div className="flex flex-col bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} className="text-zinc-400" />
          <div>
            <span className="text-xs font-semibold text-zinc-200">
              {module.label} — {track.label}
            </span>
            <span className="text-[10px] text-zinc-500 ml-2 font-mono">
              MIDI {track.midiNote} · 16 steps · {Math.round(track.volume * 100)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Clear all steps"
          >
            <Trash2 size={12} />
            Clear
          </button>
          <button
            onClick={savePattern}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium transition-colors"
          >
            Save Pattern
          </button>
          <button
            onClick={closeMidiEditor}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Close sequencer"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Beat labels */}
      <div className="flex px-3 py-1 bg-zinc-850 border-b border-zinc-800">
        <div className="w-12 flex-shrink-0" /> {/* Velocity label spacer */}
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className="flex-1 text-center">
            <span className={`text-[8px] font-mono ${i % 4 === 0 ? 'text-zinc-400 font-bold' : 'text-zinc-600'}`}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Velocity row */}
      <div className="flex px-3 py-1 items-center bg-zinc-900/50">
        <span className="w-12 text-[8px] text-zinc-500 font-mono flex-shrink-0">VEL</span>
        {steps.map((step, i) => {
          const isCurrent = i === currentStep && isPlaying;
          const vel = step.velocity;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-0.5 px-0.5"
              onClick={() => adjustVelocity(i, vel >= 1 ? -0.75 : 0.25)}
              title={`Step ${i + 1}: velocity ${Math.round(vel * 100)}% (click to adjust)`}
            >
              <div
                className={`w-full h-1.5 rounded-sm cursor-pointer transition-colors ${isCurrent ? 'ring-1 ring-yellow-400' : ''}`}
                style={{
                  backgroundColor: vel > 0.75 ? '#22c55e' : vel > 0.5 ? '#eab308' : vel > 0.25 ? '#f97316' : '#ef4444',
                  opacity: step.active ? 1 : 0.2,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Step grid */}
      <div className="flex px-3 py-2 gap-0">
        <div className="w-12 flex-shrink-0 flex items-center">
          <span className="text-[9px] text-zinc-500 font-mono">STEP</span>
        </div>
        {steps.map((step, i) => {
          const isCurrent = i === currentStep && isPlaying;
          const isBeat = i % 4 === 0;
          return (
            <button
              key={i}
              onClick={() => toggleStep(i)}
              className={`
                flex-1 aspect-square max-h-12 rounded-md border transition-all duration-75 cursor-pointer
                ${isBeat ? 'border-zinc-600' : 'border-zinc-700/50'}
                ${isCurrent ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900' : ''}
                ${step.active
                  ? step.velocity > 0.75
                    ? 'bg-green-500/80 hover:bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                    : step.velocity > 0.5
                    ? 'bg-yellow-500/80 hover:bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                    : step.velocity > 0.25
                    ? 'bg-orange-500/80 hover:bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                    : 'bg-red-500/80 hover:bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                  : 'bg-zinc-800 hover:bg-zinc-700'
                }
              `}
              title={`Step ${i + 1}: ${step.active ? 'ON (' + Math.round(step.velocity * 100) + '%)' : 'OFF'}${isCurrent ? ' ← playing' : ''}`}
            />
          );
        })}
      </div>

      {/* Transport bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const store = useLooperStore.getState();
              if (isPlaying) store.globalStop(); else store.globalPlay();
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isPlaying ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
          >
            {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
          </button>

          <div className="flex items-center gap-1 text-[10px] text-zinc-400">
            <span className="font-mono">{STEPS} steps</span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono">{Math.floor(position.absoluteBeat)} beats</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <span>Click grid to toggle steps</span>
          <span className="text-zinc-700">·</span>
          <span>Click velocity bar to adjust</span>
        </div>
      </div>
    </div>
  );
};

export default MidiSequencerPanel;