// ═══════════════════════════════════════════════════════════════════
// MODULE CARD RENDERER — Dispatches to correct card type
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import type { ModuleCard } from '../../types';
import { DualPolygonSVG, rhythmShapeFromTimeSig } from './DualPolygonSVG';

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
    return (
        <div className="px-3 py-1">
            {module.tracks.map(track => (
                <div key={track.index} className="flex items-center gap-2 text-[10px] text-zinc-400 py-0.5">
                    <span className="w-12 truncate">{track.label}</span>
                    <span className="text-zinc-600">·</span>
                    <span>Note {track.midiNote}</span>
                    <span className="text-zinc-600">·</span>
                    <span>Pan {Math.round(track.pan * 100)}</span>
                    <span className="text-zinc-600">·</span>
                    <span className={track.soundSource.type === 'midiClip' && track.soundSource.clipId ? 'text-green-400' : 'text-zinc-600'}>
                        {track.soundSource.type === 'audioInput' ? '🎤' : track.soundSource.type === 'midiClip' ? (track.soundSource.clipId ? '🎹' : '▢') : '🎛'}
                    </span>
                </div>
            ))}
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
                    {/* Simplified hexagon representation */}
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
            return <RhythmModuleCard module={module} />;
        case 'harmonic':
            return <HarmonicModuleCard module={module} />;
        case 'arrangement':
            return <ArrangementModuleCard module={module} />;
        default:
            return null;
    }
};

export default ModuleCardRenderer;