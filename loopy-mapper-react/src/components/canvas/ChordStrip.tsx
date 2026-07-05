// ═══════════════════════════════════════════════════════════════════
// CHORD STRIP — Bar-by-bar chord progression editor
// Opens when a section is selected
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import { useCurrentSection } from '../../store/selectors';
import { harmonyEngine } from '../../lib/harmonyEngine';
import type { ChordQuality, ChordStep } from '../../types';

const QUALITY_LABELS: Record<ChordQuality, string> = {
    maj: '',
    min: 'm',
    dim: '°',
    aug: '+',
    dom7: '7',
    maj7: 'Δ',
    min7: 'm7',
};

const QUALITY_LIST: ChordQuality[] = ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7'];

const ChordPaletteInline: React.FC<{
    onSelect: (step: ChordStep) => void;
    currentKey: string;
    currentScale: string;
}> = ({ onSelect, currentKey, currentScale }) => {
    const naturals = currentScale === 'major'
        ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
        : ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'];

    const naturalQualities = currentScale === 'major'
        ? (['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] as ChordQuality[])
        : (['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] as ChordQuality[]);

    return (
        <div className="p-2 bg-zinc-800 border border-zinc-600 rounded-lg">
            <div className="text-[10px] text-zinc-500 mb-1">Key: {currentKey} {currentScale}</div>
            <div className="flex gap-1">
                {naturals.map((label, i) => (
                    <button
                        key={i}
                        onClick={() =>
                            onSelect({
                                degree: i + 1,
                                quality: naturalQualities[i],
                                duration: 1,
                            })
                        }
                        className="flex flex-col items-center px-2 py-1 rounded bg-zinc-700 hover:bg-blue-700 text-xs text-zinc-200"
                    >
                        <span>{label}</span>
                        <span className="text-[10px] text-zinc-400">
                            {qualToLabel(naturalQualities[i])}
                        </span>
                    </button>
                ))}
            </div>
            <div className="flex gap-1 mt-1">
                <span className="text-[10px] text-zinc-500 self-center">Ext:</span>
                {QUALITY_LIST.map(q => (
                    <button
                        key={q}
                        onClick={() => null}
                        className="px-1 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-400"
                    >
                        {qualToLabel(q)}
                    </button>
                ))}
            </div>
        </div>
    );
};

function qualToLabel(q: ChordQuality): string {
    return q === 'maj' ? 'M' : q === 'min' ? 'm' : q === 'dim' ? '°' : q === 'aug' ? '+' : q === 'dom7' ? '7' : q === 'maj7' ? 'Δ' : 'm7';
}

export const ChordStrip: React.FC = () => {
    const key = useLooperStore(s => s.song.metadata.key);
    const scale = useLooperStore(s => s.song.metadata.scale);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedSectionIds);
    const chordEditorOpen = useLooperStore(s => s.ui.canvasView.chordEditorOpen);
    const setChordStep = useLooperStore(s => s.setChordStep);
    const updateSection = useLooperStore(s => s.updateSection);
    const setCanvasView = useLooperStore(s => s.setCanvasView);
    const setModal = useLooperStore(s => s.setModal);

    const selectedSectionId = selectedIds[0] || null;
    const selectedSection = useLooperStore(s =>
        selectedSectionId ? s.song.arrangement.find(sec => sec.id === selectedSectionId) ?? null : null
    );

    if (!chordEditorOpen || !selectedSection) return null;

    const progression = selectedSection.chordProgression;
    const totalBars = selectedSection.bars;

    const handleChordSelect = (barIndex: number) => {
        return (step: ChordStep) => {
            setChordStep(selectedSection.id, barIndex, step);
        };
    };

    return (
        <div className="mt-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-300">
                    Chord Strip: {selectedSection.name}
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() =>
                            updateSection(selectedSection.id, {
                                chordProgression: Array.from({ length: totalBars }, (_, i) => ({
                                    degree: 1,
                                    quality: 'maj' as ChordQuality,
                                    duration: 1,
                                })),
                            })
                        }
                        className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-400"
                    >
                        Fill
                    </button>
                    <button
                        onClick={() => {
                            const prog = harmonyEngine.suggestProgression(key, scale, totalBars);
                            // Expand to fill all bars
                            const fullProg: ChordStep[] = [];
                            for (let i = 0; i < totalBars; i++) {
                                const step = prog[i % prog.length];
                                fullProg.push({ ...step, duration: 1 });
                            }
                            updateSection(selectedSection.id, { chordProgression: fullProg });
                        }}
                        className="px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-[10px] text-white"
                    >
                        Suggest
                    </button>
                    <button
                        onClick={() => updateSection(selectedSection.id, { chordProgression: [] })}
                        className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-400"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setCanvasView({ chordEditorOpen: false })}
                        className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-[10px] text-zinc-400"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Bar Grid */}
            <div className="flex gap-1 overflow-x-auto pb-2">
                {Array.from({ length: totalBars }, (_, barIdx) => {
                    const chord = progression[barIdx];
                    return (
                        <div key={barIdx} className="flex flex-col items-center min-w-[48px]">
                            <span className="text-[10px] text-zinc-600 mb-1">{barIdx + 1}</span>
                            <button
                                onClick={() => {
                                    const newChord = {
                                        degree: chord?.degree || 1,
                                        quality: chord?.quality || 'maj',
                                        duration: 1,
                                    };
                                    setChordStep(selectedSection.id, barIdx, newChord);
                                }}
                                onDoubleClick={() => null}
                                className={`w-12 h-10 rounded border flex items-center justify-center text-xs font-mono transition-all ${chord
                                    ? 'bg-blue-900/30 border-blue-700 text-blue-200'
                                    : 'bg-zinc-800 border-zinc-600 text-zinc-500'
                                    }`}
                            >
                                {chord
                                    ? `${chord.degree}${QUALITY_LABELS[chord.quality]}`
                                    : '—'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Inline Chord Palette for the selected bar */}
            {(useLooperStore.getState().ui.canvasView.chordEditorBarIndex !== null) && (
                <ChordPaletteInline
                    onSelect={handleChordSelect(useLooperStore.getState().ui.canvasView.chordEditorBarIndex!)}
                    currentKey={key}
                    currentScale={scale}
                />
            )}
        </div>
    );
};

export default ChordStrip;