// ═══════════════════════════════════════════════════════════════════
// MODULE SETTINGS PANEL — Tier 2 structured editor for modules
// Opens in the InfoPanel sidebar when user clicks ⚙ on a module card
// Follows Looperconcept.md: checkboxes, dropdowns, sliders — no raw IDs
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useLooperStore } from '../../store/store';
import type { ModuleCard, ModuleTrackConfig, RhythmMode, LoopBehavior, QuantizationPreset, SoundSource } from '../../types';
import { RHYTHM_MODE_COLORS, RHYTHM_MODE_LABELS } from '../../store/presets';

// ═══ Action Catalog (from Looperconcept.md) ═══

interface ActionOption {
  id: string;
  name: string;
  tier: 'preset' | 'optional';
  description: string;
}

const RHYTHM_ACTIONS: ActionOption[] = [
  { id: 'record', name: 'Record', tier: 'preset', description: 'Record onto this track' },
  { id: 'playStop', name: 'Play/Stop', tier: 'preset', description: 'Toggle playback' },
  { id: 'overdub', name: 'Overdub', tier: 'preset', description: 'Overdub on top of recorded clip' },
  { id: 'clear', name: 'Clear', tier: 'preset', description: 'Clear the clip' },
  { id: 'mute', name: 'Mute', tier: 'preset', description: 'Silence this track' },
  { id: 'solo', name: 'Solo', tier: 'optional', description: 'Play only this track' },
  { id: 'reverse', name: 'Reverse', tier: 'optional', description: 'Reverse clip direction' },
  { id: 'multiply', name: 'Multiply Length', tier: 'optional', description: 'Double clip length' },
  { id: 'divide', name: 'Divide Length', tier: 'optional', description: 'Halve clip length' },
  { id: 'peel', name: 'Peel Layers', tier: 'optional', description: 'Remove top overdub layer' },
];

const LOOP_BEHAVIORS: { value: LoopBehavior; label: string; desc: string }[] = [
  { value: 'toggle', label: 'Toggle', desc: 'Press to start, press again to stop' },
  { value: 'recordAutoPlay', label: 'Record → Auto-Play', desc: 'Start recording, auto-play on stop' },
  { value: 'recordWait', label: 'Record → Wait', desc: 'Record, then wait for next trigger' },
  { value: 'oneShot', label: 'One-Shot', desc: 'Play once, don\'t loop' },
];

const QUANTIZATION_PRESETS: { value: QuantizationPreset; label: string }[] = [
  { value: '1_16', label: '1/16 note' },
  { value: '1_8', label: '1/8 note' },
  { value: '1_4', label: '1/4 note' },
  { value: '1_bar', label: '1 bar' },
  { value: '2_bar', label: '2 bars' },
  { value: '4_bar', label: '4 bars' },
  { value: '8_bar', label: '8 bars' },
];

// ═══ Main Panel ═══

export const ModuleSettingsPanel: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const module = useLooperStore(s => s.song.modules.find(m => m.id === moduleId));
  const updateModule = useLooperStore(s => s.updateModule);
  const updateTrack = useLooperStore(s => s.updateTrack);
  const setEditorPanel = useLooperStore(s => s.setEditorPanel);

  if (!module) {
    return <div className="p-4 text-zinc-500 text-xs">Module not found.</div>;
  }

  const isRhythm = module.type === 'rhythm';
  const isHarmonic = module.type === 'harmonic';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: module.colorAccent }} />
          <span className="text-xs font-semibold text-zinc-200">{module.label}</span>
        </div>
        <button
          onClick={() => setEditorPanel({ type: 'none' })}
          className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white"
          title="Close editor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs">
        {/* ── Module Identity ── */}
        <Section title="Identity">
          <Field label="Name">
            <input
              type="text"
              value={module.label}
              onChange={e => updateModule(moduleId, { label: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
            />
          </Field>
          <Field label="Pattern Name">
            <input
              type="text"
              value={module.patternName ?? ''}
              onChange={e => updateModule(moduleId, { patternName: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
              placeholder="e.g., Quartz"
            />
          </Field>
          <Field label="Size">
            <select
              value={module.size}
              onChange={e => updateModule(moduleId, { size: e.target.value as ModuleCard['size'] })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </Field>
        </Section>

        {/* ── Module Settings ── */}
        <Section title="Module Settings">
          <Field label="Bus">
            <select
              value={module.bus}
              onChange={e => updateModule(moduleId, { bus: e.target.value as ModuleCard['bus'] })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="red">🔴 Red (Rhythm)</option>
              <option value="blue">🔵 Blue (Harmonic)</option>
              <option value="green">🟢 Green (Arrangement)</option>
            </select>
          </Field>
          <Field label="Quantization">
            <select
              value={module.quantization}
              onChange={e => updateModule(moduleId, { quantization: e.target.value as QuantizationPreset })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs focus:outline-none focus:border-blue-500"
            >
              {QUANTIZATION_PRESETS.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Quantization Enabled</span>
            <input
              type="checkbox"
              checked={module.quantizationEnabled}
              onChange={e => updateModule(moduleId, { quantizationEnabled: e.target.checked })}
              className="accent-blue-500"
            />
          </div>
          <Field label="Base MIDI Note">
            <input
              type="number"
              min={0} max={127}
              value={module.baseMidiNote}
              onChange={e => updateModule(moduleId, { baseMidiNote: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
            />
          </Field>
        </Section>

        {/* ── Rhythm Mode (rhythm modules only) ── */}
        {isRhythm && (
          <Section title="Rhythm Mode">
            <div className="flex gap-1">
              {(['loop', 'fill', 'clip'] as RhythmMode[]).map(mode => {
                const isActive = module.rhythmMode === mode;
                const color = RHYTHM_MODE_COLORS[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      const newLabel = `${module.patternName ?? 'Pattern'} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
                      updateModule(moduleId, { rhythmMode: mode, colorAccent: color, label: newLabel });
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800'}`}
                    style={isActive ? { backgroundColor: color } : {}}
                  >
                    {RHYTHM_MODE_LABELS[mode]}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Expression ── */}
        <Section title="Expression">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Fill Enabled</span>
            <input
              type="checkbox"
              checked={module.expression?.enabled ?? false}
              onChange={e => {
                const expr = module.expression ?? {
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
                updateModule(moduleId, { expression: { ...expr, enabled: e.target.checked } });
              }}
              className="accent-indigo-500"
            />
          </div>
          {module.expression?.enabled && (
            <>
              <Field label="Trigger Every N">
                <input
                  type="number"
                  min={1} max={32}
                  value={module.expression.trigger.everyN ?? 4}
                  onChange={e => {
                    if (!module.expression) return;
                    updateModule(moduleId, {
                      expression: { ...module.expression, trigger: { ...module.expression.trigger, everyN: Number(e.target.value) } } as any,
                    });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
                />
              </Field>
              {module.expression.type !== 'variation' && (
                <Field label="Duration (beats)">
                  <input
                    type="number"
                    min={1} max={64}
                    value={(module.expression as any).durationBeats ?? 4}
                    onChange={e => {
                      if (!module.expression) return;
                      updateModule(moduleId, {
                        expression: { ...module.expression, durationBeats: Number(e.target.value) } as any,
                      });
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </Field>
              )}
              {module.expression.type === 'variation' && (
                <Field label="Duration (bars)">
                  <input
                    type="number"
                    min={1} max={64}
                    value={(module.expression as any).durationBars ?? 4}
                    onChange={e => {
                      if (!module.expression) return;
                      updateModule(moduleId, {
                        expression: { ...module.expression, durationBars: Number(e.target.value) } as any,
                      });
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </Field>
              )}
            </>
          )}
        </Section>

        {/* ── Per-Track Settings ── */}
        <Section title={`Tracks (${module.tracks.length})`}>
          {module.tracks.map((track, i) => (
            <TrackSettings
              key={track.index}
              module={module}
              track={track}
              trackIndex={i}
            />
          ))}
        </Section>

        {/* ── Preset Actions ── */}
        <Section title="Presets">
          <button
            onClick={() => {
              const store = useLooperStore.getState();
              const name = module.label || 'Custom Preset';
              store.saveModulePreset(moduleId, name, `Custom preset from ${name}`);
            }}
            className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Save as Custom Preset
          </button>
        </Section>
      </div>
    </div>
  );
};

// ═══ Sub-components ═══

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 pb-1.5 border-b border-zinc-800">
      {title}
    </h3>
    <div className="space-y-2">
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="text-[10px] text-zinc-500 block mb-0.5">{label}</span>
    {children}
  </div>
);

const TrackSettings: React.FC<{
  module: ModuleCard;
  track: ModuleTrackConfig;
  trackIndex: number;
}> = ({ module, track, trackIndex }) => {
  const updateTrack = useLooperStore(s => s.updateTrack);
  const [expanded, setExpanded] = useState(false);

  const toggleAction = (actionId: string) => {
    const existing = track.actions.find(a => a.actionId === actionId);
    if (existing) {
      updateTrack(module.id, trackIndex, {
        actions: track.actions.map(a =>
          a.actionId === actionId ? { ...a, enabled: !a.enabled } : a
        ),
      });
    } else {
      updateTrack(module.id, trackIndex, {
        actions: [...track.actions, { actionId, enabled: true }],
      });
    }
  };

  const isActionEnabled = (actionId: string) => {
    return track.actions.find(a => a.actionId === actionId)?.enabled ?? false;
  };

  return (
    <div className="bg-zinc-800/50 rounded border border-zinc-700/50 overflow-hidden">
      {/* Track header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-300">{trackIndex + 1}. {track.label}</span>
          <span className="text-[9px] text-zinc-500 font-mono">MIDI {track.midiNote}</span>
        </div>
        <span className="text-zinc-600 text-[10px]">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-zinc-700/50">
          {/* Track label + MIDI note */}
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-[9px] text-zinc-500 block mb-0.5">Label</span>
              <input
                type="text"
                value={track.label}
                onChange={e => updateTrack(module.id, trackIndex, { label: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 text-[10px] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-16">
              <span className="text-[9px] text-zinc-500 block mb-0.5">MIDI Note</span>
              <input
                type="number"
                min={0} max={127}
                value={track.midiNote}
                onChange={e => updateTrack(module.id, trackIndex, { midiNote: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 text-[10px] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Pan slider */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-0.5">Pan ({Math.round(track.pan * 100)}%)</span>
            <input
              type="range"
              min={-100} max={100}
              value={Math.round(track.pan * 100)}
              onChange={e => updateTrack(module.id, trackIndex, { pan: Number(e.target.value) / 100 })}
              className="w-full h-1 cursor-pointer accent-blue-500"
            />
          </div>

          {/* Volume slider */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-0.5">Volume ({Math.round(track.volume * 100)}%)</span>
            <input
              type="range"
              min={0} max={100}
              value={Math.round(track.volume * 100)}
              onChange={e => updateTrack(module.id, trackIndex, { volume: Number(e.target.value) / 100 })}
              className="w-full h-1 cursor-pointer accent-blue-500"
            />
          </div>

          {/* Loop behavior */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-0.5">Loop Behavior</span>
            <select
              value={track.loopBehavior}
              onChange={e => updateTrack(module.id, trackIndex, { loopBehavior: e.target.value as LoopBehavior })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 text-[10px] focus:outline-none focus:border-blue-500"
            >
              {LOOP_BEHAVIORS.map(lb => (
                <option key={lb.value} value={lb.value}>{lb.label}</option>
              ))}
            </select>
          </div>

          {/* Volume ramp */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-0.5">Volume Ramp</span>
            <select
              value={track.volumeRampMs}
              onChange={e => updateTrack(module.id, trackIndex, { volumeRampMs: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 text-[10px] focus:outline-none focus:border-blue-500"
            >
              <option value={5}>5ms (instant)</option>
              <option value={20}>20ms (fast)</option>
              <option value={100}>100ms (smooth)</option>
              <option value={500}>500ms (slow)</option>
            </select>
          </div>

          {/* Actions checklist */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-1">Actions</span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {RHYTHM_ACTIONS.map(action => {
                const enabled = isActionEnabled(action.id);
                const isPreset = action.tier === 'preset';
                return (
                  <label
                    key={action.id}
                    className={`flex items-center gap-1.5 cursor-pointer ${isPreset ? '' : 'opacity-70'}`}
                    title={action.description}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAction(action.id)}
                      className="accent-blue-500 w-3 h-3"
                    />
                    <span className={`text-[9px] ${enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {action.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mute group */}
          <div>
            <span className="text-[9px] text-zinc-500 block mb-0.5">Mute Group</span>
            <input
              type="text"
              value={track.muteGroup ?? ''}
              onChange={e => updateTrack(module.id, trackIndex, { muteGroup: e.target.value || undefined })}
              placeholder="None"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 text-[10px] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleSettingsPanel;