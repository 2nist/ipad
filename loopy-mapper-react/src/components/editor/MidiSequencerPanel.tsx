// ═══════════════════════════════════════════════════════════════════
// MIDI SEQUENCER PANEL — Step sequencer that slides up from the
// bottom toolbar. Contextual to a clicked module track.
// Uses Tone.Transport for playback scheduling and SynthEngine for audio.
//
// Persistence: every edit auto-saves to the track's clipData immediately —
// there is no separate "Save" step. Switching to a different pad, or
// closing the panel, must never lose or reset what's on the grid.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { Play, Square, Trash2, ChevronDown, Grid3X3 } from 'lucide-react';
import { useLooperStore } from '../../store/store';
import { synthEngine } from '../../lib/synthEngine';
import {
  STEP_COUNT as STEPS, encodeStepsToEvents, encodeStepsToClipData, decodeClipDataToSteps, emptyGrid,
} from '../../lib/stepPattern';
import type { Step } from '../../lib/stepPattern';

export const MidiSequencerPanel: React.FC = () => {
  const moduleId = useLooperStore(s => s.ui.midiEditorModuleId);
  const trackIndex = useLooperStore(s => s.ui.midiEditorTrackIndex);
  const isOpen = useLooperStore(s => s.ui.midiEditorOpen);
  const closeMidiEditor = useLooperStore(s => s.closeMidiEditor);
  const isPlaying = useLooperStore(s => s.transport.isPlaying);
  const position = useLooperStore(s => s.transport.position);

  const module = useLooperStore(s => moduleId ? s.song.modules.find(m => m.id === moduleId) : null);
  const track = module?.tracks[trackIndex ?? 0];

  // A track's sound source only carries a persistable pattern (clipData) if
  // it's midiClip or sample — audioInput/liveMidi have no such field.
  const canPersist = track?.soundSource.type === 'midiClip' || track?.soundSource.type === 'sample';
  const voiceId = module && track ? `${module.id}:${track.index}` : null;

  const [steps, setSteps] = useState<Step[]>(() => emptyGrid());
  const [currentStep, setCurrentStep] = useState(0);

  // Keep the latest step data in a ref so Transport callbacks (registered
  // once per play) always read current edits without needing to reschedule.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Load the track's saved pattern into the grid whenever the track changes.
  // Previously this unconditionally reset to an empty grid — which both
  // discarded unsaved edits AND made already-saved patterns look erased the
  // moment you switched pads. Now it decodes whatever is actually persisted.
  useEffect(() => {
    if (!track) return;
    if (canPersist) {
      const src = track.soundSource as { clipData?: ArrayBuffer };
      setSteps(decodeClipDataToSteps(src.clipData));
    } else {
      setSteps(emptyGrid());
    }
  }, [moduleId, trackIndex]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-load on track identity change, not on every store update

  // Visual playhead only — purely cosmetic, safe to depend on track/module
  // since its cleanup only clears ITS OWN scheduleRepeat (never touches audio).
  useEffect(() => {
    if (!isPlaying || !isOpen || !track) return;
    const ticksPerStep = Tone.Transport.PPQ / 4; // one 16th note
    const eventId = Tone.Transport.scheduleRepeat((time) => {
      const idx = Math.round(Tone.Transport.getTicksAtTime(time) / ticksPerStep) % STEPS;
      Tone.Draw.schedule(() => setCurrentStep(idx), time);
    }, '16n', 0);
    return () => { Tone.Transport.clear(eventId); };
  }, [isPlaying, isOpen, track, module]);

  // Re-arm on play-start: if steps were edited while paused, make sure what's
  // actually scheduled matches the grid the instant Play is pressed. Keyed
  // ONLY on isPlaying (see below) — every other pad keeps looping via
  // whatever the global scheduler or a prior edit already set up.
  useEffect(() => {
    if (!isPlaying || !isOpen || !track || !voiceId) return;
    const events = encodeStepsToEvents(stepsRef.current, track.midiNote);
    synthEngine.stopSequence(voiceId);
    if (events.length > 0) synthEngine.playSequence(voiceId, events, true);
    // No cleanup: switching tracks or closing the panel must NOT silence this
    // pattern — it keeps looping in the background like every other pad.
    // Deliberately depends ONLY on isPlaying — re-running on every track
    // switch would re-arm (and audibly restart) whichever pad happens to be
    // open every time you tap to a different one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (!isOpen || !module || !track || !voiceId) return null;

  // Persist + (if playing) hot-swap the audible loop to match, in one place.
  // This is the ONLY path that writes steps — every handler below computes
  // the next grid and routes it through here.
  const commitPattern = (nextSteps: Step[]) => {
    setSteps(nextSteps);

    const src = track.soundSource;
    if (src.type === 'midiClip' || src.type === 'sample') {
      useLooperStore.getState().updateTrack(module.id, track.index, {
        soundSource: { ...src, clipData: encodeStepsToClipData(nextSteps, track.midiNote) },
      });
    }

    if (isPlaying) {
      // Replace whatever is currently scheduled for this voice (whether from
      // the global scheduler at transport-start, or a previous edit here) with
      // the freshly edited pattern. stopSequence cancels the old Transport
      // callbacks outright, so this can never double-trigger or leave a stale
      // loop running alongside the new one.
      synthEngine.stopSequence(voiceId);
      const events = encodeStepsToEvents(nextSteps, track.midiNote);
      if (events.length > 0) synthEngine.playSequence(voiceId, events, true);
    }
  };

  const toggleStep = (index: number) => {
    const next = [...steps];
    next[index] = { ...next[index], active: !next[index].active };
    commitPattern(next);

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
    const next = [...steps];
    const newVel = Math.max(0, Math.min(1, (next[index].velocity || 0.8) + delta));
    next[index] = { ...next[index], velocity: newVel };
    commitPattern(next);
  };

  const clearAll = () => {
    commitPattern(emptyGrid(STEPS));
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
          {canPersist ? (
            <span className="text-[9px] text-zinc-500 italic">Saves as you edit</span>
          ) : (
            <span
              className="text-[9px] text-amber-500 italic"
              title="This track type has no pattern storage — edits here won't be remembered."
            >
              Not saved on this track type
            </span>
          )}
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            title="Clear all steps"
          >
            <Trash2 size={12} />
            Clear
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
