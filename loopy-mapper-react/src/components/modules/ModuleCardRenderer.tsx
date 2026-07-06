// ═══════════════════════════════════════════════════════════════════
// MODULE CARD RENDERER — Dispatches to correct card type
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useRef } from 'react';
import { useLooperStore } from '../../store/store';
import type { ModuleCard } from '../../types';
import { DualPolygonSVG, rhythmShapeFromTimeSig } from './DualPolygonSVG';
import { synthEngine } from '../../lib/synthEngine';
import { looperEngine } from '../../lib/audio-worklet';
import { DrumModuleCard } from './DrumModuleCard';

const BUS_COLORS: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
};

const BUS_BG: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
    green: 'bg-green-500/10 border-green-500/30',
};

const TYPE_LABELS: Record<string, string> = {
    rhythm: '🔴 Rhythm',
    harmonic: '🔵 Harmonic',
    arrangement: '🟢 Arrangement',
};

const ModuleHeader: React.FC<{ module: ModuleCard }> = ({ module }) => {
    const setEditorPanel = useLooperStore(s => s.setEditorPanel);
    const removeModule = useLooperStore(s => s.removeModule);

    return (
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BUS_COLORS[module.bus] }} />
                <span className="text-xs font-semibold text-zinc-200">{module.label}</span>
            </div>
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">{TYPE_LABELS[module.type]}</span>
                <button
                    onClick={() => setEditorPanel({ type: 'module', moduleId: module.id })}
                    className="text-zinc-500 hover:text-blue-400 text-xs px-1"
                >
                    Edit
                </button>
                <button
                    onClick={() => removeModule(module.id)}
                    className="text-zinc-500 hover:text-red-400 text-xs"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

const TrackRow: React.FC<{ module: ModuleCard }> = ({ module }) => {
    const setTrackState = useLooperStore(s => s.setTrackState);
    const moduleState = useLooperStore(s => s.moduleStates[module.id]);

    const getTrackState = (trackIndex: number) =>
        moduleState?.tracks.find(t => t.trackIndex === trackIndex)?.state ?? 'empty';

    const handlePlayTest = useCallback((trackIndex: number) => {
        const voiceId = `${module.id}:${trackIndex}`;
        const track = module.tracks[trackIndex];
        if (!track) return;
        const note = track.midiNote;
        const source = track.soundSource;

        // Only MIDI-based sources can trigger synth notes
        if (source.type === 'audioInput') return;

        // Ensure synth voice exists for MIDI sources
        synthEngine.setVoice(voiceId, source.soundEngine, track.volume);

        // Play a short test note (300ms)
        synthEngine.noteOn(voiceId, note, 0.8);
        setTimeout(() => {
            synthEngine.noteOff(voiceId, note);
        }, 300);
    }, [module.id, module.tracks]);

    const handleToggleMute = useCallback((trackIndex: number) => {
        const currentState = getTrackState(trackIndex);
        const newState = currentState === 'muted' ? 'empty' : 'muted';
        setTrackState(module.id, trackIndex, { state: newState });

        const track = module.tracks[trackIndex];
        if (track && track.soundSource.type === 'audioInput' && newState !== 'muted') {
            looperEngine.toggleRecord(trackIndex);
        }
    }, [module.id, setTrackState, getTrackState, module.tracks]);

    const handleToggleSolo = useCallback((trackIndex: number) => {
        const currentState = getTrackState(trackIndex);
        const newState = currentState === 'soloed' ? 'empty' : 'soloed';
        setTrackState(module.id, trackIndex, { state: newState });
    }, [module.id, setTrackState, getTrackState]);

    const handleVolumeChange = useCallback((trackIndex: number, volume: number) => {
        const voiceId = `${module.id}:${trackIndex}`;
        synthEngine.setVoiceVolume(voiceId, volume);
    }, [module.id]);

    return (
        <div className="px-2 py-1 space-y-0.5">
            {module.tracks.map(track => {
                const trackState = getTrackState(track.index);
                const isMuted = trackState === 'muted';
                const isSoloed = trackState === 'soloed';

                return (
                    <div key={track.index}
                        className="flex items-center gap-1.5 text-[10px] text-zinc-400 py-1 px-1 rounded hover:bg-zinc-800/50"
                    >
                        {/* Track label */}
                        <span className={`w-12 truncate font-medium ${isMuted ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                            {track.label}
                        </span>

                        {/* Sound source icon */}
                        <span className="w-4 text-center flex-shrink-0" title={track.soundSource.type}>
                            {track.soundSource.type === 'audioInput' ? '🎤' : track.soundSource.type === 'midiClip' ? (track.soundSource.clipId ? '🎹' : '▢') : '🎛'}
                        </span>

                        {/* Note trigger button — ALWAYS visible */}
                        <button
                            onClick={() => handlePlayTest(track.index)}
                            className="px-1.5 py-0.5 rounded bg-blue-700 hover:bg-blue-500 text-[10px] text-white transition-colors flex-shrink-0"
                            title={`Test note ${track.midiNote} — click to hear`}
                        >
                            ▶
                        </button>

                        {/* MIDI note number */}
                        <span className="text-zinc-600 font-mono w-4 text-center flex-shrink-0">{track.midiNote}</span>

                        {/* Mute toggle */}
                        <button
                            onClick={() => handleToggleMute(track.index)}
                            className={`px-1 rounded text-[9px] font-bold transition-colors flex-shrink-0 ${isMuted ? 'bg-red-900/60 text-red-400' : 'bg-zinc-800 text-zinc-500 hover:text-yellow-400'}`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            M
                        </button>

                        {/* Solo toggle */}
                        <button
                            onClick={() => handleToggleSolo(track.index)}
                            className={`px-1 rounded text-[9px] font-bold transition-colors flex-shrink-0 ${isSoloed ? 'bg-yellow-900/60 text-yellow-400' : 'bg-zinc-800 text-zinc-500 hover:text-yellow-400'}`}
                            title={isSoloed ? 'Unsolo' : 'Solo'}
                        >
                            S
                        </button>

                        {/* Volume slider — always visible */}
                        <div className="flex items-center gap-1 ml-auto min-w-0">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(track.volume * 100)}
                                onChange={e => {
                                    const vol = Number(e.target.value) / 100;
                                    handleVolumeChange(track.index, vol);
                                }}
                                className="w-10 h-1 cursor-pointer accent-blue-500"
                                title="Volume"
                            />
                            <span className="text-zinc-600 w-6 text-right flex-shrink-0">{Math.round(track.volume * 100)}%</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ExpressionBadge: React.FC<{ module: ModuleCard }> = ({ module }) => {
    if (!module.expression?.enabled) return null;
    const label = module.expression.type === 'fill' ? 'FILL' : module.expression.type === 'variation' ? 'VAR' : 'TRANS';
    return (
        <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${label === 'FILL' ? 'bg-red-900/50 text-red-300' :
                label === 'VAR' ? 'bg-blue-900/50 text-blue-300' :
                    'bg-green-900/50 text-green-300'
            }`}>
            {label} {module.expression.trigger.type === 'everyNRepeats' ? `×${module.expression.trigger.everyN}` : ''}
        </span>
    );
};

export const RhythmModuleCard: React.FC<{ module: ModuleCard }> = ({ module }) => {
    const runtimeState = useLooperStore(s => s.moduleStates[module.id]);
    const ts = useLooperStore(s => s.song.metadata.timeSignature);

    return (
        <div className={`rounded-lg border ${BUS_BG[module.bus]} p-3`}>
            <ModuleHeader module={module} />
            <div className="flex items-center gap-3 px-3 py-2">
                <DualPolygonSVG
                    timeSignature={ts}
                    busColor={BUS_COLORS[module.bus]}
                    beatCount={runtimeState?.repeatCount || 0}
                    totalBeats={module.tracks.length}
                    size={56}
                />
                <div className="flex-1">
                    <div className="text-[10px] text-zinc-500">
                        {module.tracks.length} tracks · Quant: {module.quantization.replace('_', ' ')}
                    </div>
                    <div className="flex gap-1 mt-1">
                        <ExpressionBadge module={module} />
                        <span className="text-[10px] text-zinc-600">
                            MIDI {module.baseMidiNote}–{module.baseMidiNote + module.tracks.length - 1}
                        </span>
                    </div>
                </div>
            </div>
            <TrackRow module={module} />
        </div>
    );
};

export const HarmonicModuleCard: React.FC<{ module: ModuleCard }> = ({ module }) => {
    const runtimeState = useLooperStore(s => s.moduleStates[module.id]);
    const activeChord = runtimeState?.harmony?.activeChord;

    return (
        <div className={`rounded-lg border ${BUS_BG[module.bus]} p-3`}>
            <ModuleHeader module={module} />
            <div className="px-3 py-2">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                        style={{ borderColor: BUS_COLORS[module.bus], color: BUS_COLORS[module.bus] }}>
                        {activeChord ? `${activeChord.degree}${activeChord.quality === 'maj' ? '' : activeChord.quality === 'min' ? 'm' : activeChord.quality}` : 'I'}
                    </div>
                    <div className="flex-1">
                        {activeChord ? (
                            <div className="text-xs text-zinc-200 font-mono">
                                {activeChord.noteNames.join(' · ')}
                            </div>
                        ) : (
                            <div className="text-[10px] text-zinc-500">No active chord</div>
                        )}
                        <div className="flex gap-1 mt-1">
                            <ExpressionBadge module={module} />
                            <span className="text-[10px] text-zinc-600">
                                {module.tracks.length}tr
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <TrackRow module={module} />
        </div>
    );
};

export const ArrangementModuleCard: React.FC<{ module: ModuleCard }> = ({ module }) => {
    const sections = useLooperStore(s => s.song.arrangement);
    const activeSectionIndex = useLooperStore(s => s.transport.activeSectionIndex);
    const isPlaying = useLooperStore(s => s.transport.isPlaying);

    return (
        <div className={`rounded-lg border ${BUS_BG[module.bus]} p-3`}>
            <ModuleHeader module={module} />
            <div className="px-3 py-2">
                <div className="text-xs text-zinc-300">
                    {sections.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {sections.map((s, i) => (
                                <span key={s.id} className={`px-1.5 py-0.5 rounded text-[10px] ${i === activeSectionIndex && isPlaying
                                        ? 'bg-green-700/50 text-green-200 font-bold'
                                        : 'bg-zinc-700/50 text-zinc-400'
                                    }`}>
                                    {s.name} ({s.bars})
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-zinc-500">No sections</span>
                    )}
                </div>
                <div className="flex gap-2 mt-2 text-[10px] text-zinc-500">
                    <span>{sections.length} sections</span>
                    <span>·</span>
                    <span>{module.tracks.length} tracks</span>
                </div>
            </div>
        </div>
    );
};

export const ModuleCardRenderer: React.FC<{ module: ModuleCard }> = ({ module }) => {
    switch (module.type) {
        case 'rhythm':
            return <DrumModuleCard module={module} />;
        case 'harmonic':
            return <HarmonicModuleCard module={module} />;
        case 'arrangement':
            return <ArrangementModuleCard module={module} />;
        default:
            return null;
    }
};

export default ModuleCardRenderer;