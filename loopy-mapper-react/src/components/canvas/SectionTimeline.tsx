// ═══════════════════════════════════════════════════════════════════
// SECTION TIMELINE — Draggable, resizable section blocks with
// module assignment badges and chord progression display.
// Three views: sections only, with modules, full composition
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import type { TransitionMode } from '../../types';

const BUS_COLORS: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
};

const SIZE_LABELS: Record<string, string> = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
};

const TRANSITION_LABELS: Record<TransitionMode, string> = {
    instant: '→',
    nextBar: '|→',
    fade: '~→',
};

const TRANSITION_COLORS: Record<TransitionMode, string> = {
    instant: 'bg-amber-500',
    nextBar: 'bg-blue-500',
    fade: 'bg-purple-500',
};

const SectionBlock: React.FC<{
    sectionId: string;
    index: number;
    isActive: boolean;
    onSelect: (id: string) => void;
    onResize: (id: string, delta: number) => void;
}> = ({ sectionId, index, isActive, onSelect, onResize }) => {
    const section = useLooperStore(s => s.song.arrangement.find(sec => sec.id === sectionId));
    const modules = useLooperStore(s => s.song.modules);
    const updateSection = useLooperStore(s => s.updateSection);
    const removeSection = useLooperStore(s => s.removeSection);
    const assigningModuleId = useLooperStore(s => s.ui.assigningModuleId);
    const setAssigningModule = useLooperStore(s => s.setAssigningModule);

    if (!section) return null;

    const chordSummary = section.chordProgression.length > 0
        ? section.chordProgression.slice(0, 4).map(c =>
            `${c.degree}${c.quality === 'maj' ? '' : c.quality === 'min' ? 'm' : c.quality === 'dom7' ? '7' : c.quality === 'maj7' ? 'Δ' : c.quality}`
        ).join(' ')
        : '';

    // Get active modules in this section
    const activeModuleObjs = modules.filter(m => section.activeModules.includes(m.id));

    // Check if we're in assign mode
    const isAssignMode = assigningModuleId !== null;
    const assignedModule = assigningModuleId ? modules.find(m => m.id === assigningModuleId) : null;
    const isTargetSection = section.activeModules.includes(assigningModuleId ?? '');

    const handleClick = () => {
        if (isAssignMode && assigningModuleId) {
            // Assign module to this section
            const updated = section.activeModules.includes(assigningModuleId)
                ? section.activeModules.filter(m => m !== assigningModuleId)
                : [...section.activeModules, assigningModuleId];
            updateSection(sectionId, { activeModules: updated });
            setAssigningModule(null); // Exit assign mode
        } else {
            onSelect(section.id);
        }
    };

    return (
        <div
            className={`
                relative flex flex-col border-2 rounded-lg cursor-pointer transition-all duration-150 min-w-[100px]
                ${isAssignMode
                    ? isTargetSection ? 'border-yellow-400 bg-yellow-900/30 animate-pulse' : 'border-yellow-600/50 bg-yellow-900/10 hover:border-yellow-400'
                    : isActive
                        ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/20'
                        : 'border-zinc-600 bg-zinc-800/50 hover:border-zinc-500'
                }
            `}
            style={{ width: `${Math.max(100, section.bars * 20 + 20)}px` }}
            onClick={handleClick}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-700">
                <input
                    type="text"
                    value={section.name}
                    onChange={e => updateSection(section.id, { name: e.target.value })}
                    className="bg-transparent text-xs font-bold text-white w-full focus:outline-none"
                    onClick={e => e.stopPropagation()}
                />
                <button
                    onClick={e => {
                        e.stopPropagation();
                        removeSection(section.id);
                    }}
                    className="text-zinc-500 hover:text-red-400 text-xs ml-1 flex-shrink-0"
                    title="Remove section"
                >
                    ×
                </button>
            </div>

            {/* Bar Count + Transition */}
            <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] text-zinc-400 font-mono">{section.bars} bars</span>
                {index > 0 && (
                    <span className={`text-[10px] px-1 rounded text-white font-mono ${TRANSITION_COLORS[section.transition]}`}>
                        {TRANSITION_LABELS[section.transition]}
                    </span>
                )}
            </div>

            {/* Chord Summary */}
            {chordSummary && (
                <div className="px-2 pb-1">
                    <span className="text-[9px] text-zinc-500 font-mono">{chordSummary}</span>
                </div>
            )}

            {/* Active Module Badges */}
            {activeModuleObjs.length > 0 && (
                <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                    {activeModuleObjs.map(mod => (
                        <span
                            key={mod.id}
                            className="text-[8px] px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]"
                            style={{
                                backgroundColor: `${mod.colorAccent}20`,
                                color: mod.colorAccent,
                                border: `1px solid ${mod.colorAccent}40`,
                            }}
                            title={mod.label}
                        >
                            {mod.type === 'rhythm' ? '🔴' : mod.type === 'harmonic' ? '🔵' : '🟢'} {mod.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Assign mode hint */}
            {isAssignMode && assignedModule && (
                <div className="px-2 pb-1">
                    <span className="text-[8px] text-yellow-400 italic">
                        {isTargetSection ? `✓ ${assignedModule.label}` : `Click to assign ${assignedModule.label}`}
                    </span>
                </div>
            )}

            {/* Resize Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30 rounded-r"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startBars = section.bars;

                    const onMove = (ev: MouseEvent) => {
                        const delta = ev.clientX - startX;
                        const barDelta = Math.round(delta / 20);
                        const newBars = Math.max(1, Math.min(64, startBars + barDelta));
                        if (newBars !== section.bars) {
                            updateSection(section.id, { bars: newBars });
                        }
                    };

                    const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };

                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                }}
            />
        </div>
    );
};

export const SectionTimeline: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedSectionIds);
    const activeSectionId = useLooperStore(s => s.transport.activeSectionId);
    const viewLevel = useLooperStore(s => s.ui.canvasView.viewLevel);
    const setCanvasView = useLooperStore(s => s.setCanvasView);
    const addSection = useLooperStore(s => s.addSection);
    const assigningModuleId = useLooperStore(s => s.ui.assigningModuleId);
    const setAssigningModule = useLooperStore(s => s.setAssigningModule);

    // Don't show in full composition view (just the infinite canvas)
    if (viewLevel === 'fullComposition') return null;

    const handleSelect = (id: string) => {
        setCanvasView({ selectedSectionIds: [id], chordEditorOpen: true });
    };

    const handleResize = (id: string, delta: number) => {
        const section = sections.find(s => s.id === id);
        if (section) {
            useLooperStore.getState().updateSection(id, { bars: Math.max(1, section.bars + delta) });
        }
    };

    return (
        <div className="flex flex-col gap-1 px-2">
            {/* Header */}
            <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <span>Sections</span>
                    <span className="text-zinc-600">|</span>
                    <span>{sections.length} sections</span>
                    <span className="text-zinc-600">|</span>
                    <span className="font-mono">{sections.reduce((sum, s) => sum + s.bars, 0)} bars</span>
                </div>

                {assigningModuleId && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-yellow-400 animate-pulse">
                            Assigning module — click a section
                        </span>
                        <button
                            onClick={() => setAssigningModule(null)}
                            className="text-[10px] text-zinc-500 hover:text-white px-1.5 py-0.5 rounded bg-zinc-700"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Section blocks */}
            <div className="flex items-start gap-4 overflow-x-auto pb-3">
                {sections.map((section, index) => (
                    <SectionBlock
                        key={section.id}
                        sectionId={section.id}
                        index={index}
                        isActive={section.id === activeSectionId || selectedIds.includes(section.id)}
                        onSelect={handleSelect}
                        onResize={handleResize}
                    />
                ))}

                {/* Add section button */}
                <button
                    onClick={() => addSection()}
                    className="flex-shrink-0 w-12 h-full min-h-[60px] border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
                    title="Add section"
                >
                    <span className="text-lg">+</span>
                </button>

                {sections.length === 0 && (
                    <div className="text-zinc-500 text-sm italic py-4">
                        No sections yet. Click "+" to add one, then assign modules to it.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SectionTimeline;