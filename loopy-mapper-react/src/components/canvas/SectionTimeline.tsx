// ═══════════════════════════════════════════════════════════════════
// SECTION TIMELINE — Draggable, resizable section blocks
// Three views: sections only, with modules, full composition
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import { useCurrentSection } from '../../store/selectors';
import type { TransitionMode } from '../../types';

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
    const updateSection = useLooperStore(s => s.updateSection);
    const moveSection = useLooperStore(s => s.moveSection);
    const removeSection = useLooperStore(s => s.removeSection);

    if (!section) return null;

    const chordSummary = section.chordProgression.length > 0
        ? section.chordProgression.slice(0, 3).map(c =>
            `${c.degree}${c.quality === 'maj' ? '' : c.quality === 'min' ? 'm' : c.quality === 'dom7' ? '7' : c.quality === 'maj7' ? 'Δ' : c.quality}`
        ).join(' ')
        : '';

    return (
        <div
            className={`relative flex flex-col border-2 rounded-lg cursor-pointer transition-all duration-150 min-w-[80px] ${isActive
                    ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/20'
                    : 'border-zinc-600 bg-zinc-800/50 hover:border-zinc-500'
                }`}
            style={{ width: `${Math.max(80, section.bars * 24)}px` }}
            onClick={() => onSelect(section.id)}
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
                    className="text-zinc-500 hover:text-red-400 text-xs ml-1"
                >
                    ×
                </button>
            </div>

            {/* Bar Count + Transition */}
            <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-zinc-400">{section.bars} bars</span>
                {index > 0 && (
                    <span className={`text-xs px-1 rounded ${TRANSITION_COLORS[section.transition]}`}>
                        {TRANSITION_LABELS[section.transition]}
                    </span>
                )}
            </div>

            {/* Chord Summary */}
            {chordSummary && (
                <div className="px-2 pb-1">
                    <span className="text-[10px] text-zinc-500 font-mono">{chordSummary}</span>
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
                        const barDelta = Math.round(delta / 24);
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

            {/* Transition arrow to next */}
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                <span className={`text-lg ${TRANSITION_COLORS[section.transition].replace('bg-', 'text-')}`}>
                    {'→'}
                </span>
            </div>
        </div>
    );
};

export const SectionTimeline: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedSectionIds);
    const activeSectionId = useLooperStore(s => s.transport.activeSectionId);
    const setCanvasView = useLooperStore(s => s.setCanvasView);
    const updateSection = useLooperStore(s => s.updateSection);
    const moveSection = useLooperStore(s => s.moveSection);
    const setModal = useLooperStore(s => s.setModal);

    const handleSelect = (id: string) => {
        setCanvasView({ selectedSectionIds: [id], chordEditorOpen: true });
    };

    const handleResize = (id: string, delta: number) => {
        const section = sections.find(s => s.id === id);
        if (section) {
            updateSection(id, { bars: Math.max(1, section.bars + delta) });
        }
    };

    // Drag state
    const dragRef = React.useRef<{ id: string; startX: number; startIndex: number } | null>(null);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-zinc-500 px-1 mb-1">
                <span>Timeline</span>
                <span className="text-zinc-600">|</span>
                <span>{sections.length} sections</span>
            </div>

            <div className="flex items-start gap-5 relative overflow-x-auto pb-2">
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

                {sections.length === 0 && (
                    <div className="text-zinc-500 text-sm italic py-4">
                        No sections yet. Click "+ Section" to add one.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SectionTimeline;