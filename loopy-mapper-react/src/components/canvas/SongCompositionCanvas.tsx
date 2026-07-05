// ═══════════════════════════════════════════════════════════════════
// SONG COMPOSITION CANVAS — Main composition view
// Three toggleable views: Sections Only, + Modules, Full Composition
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import { SectionTimeline } from './SectionTimeline';
import { ModuleLanes } from './ModuleLanes';
import { ChordStrip } from './ChordStrip';
import { PlayheadOverlay } from './PlayheadOverlay';

export const SongCompositionCanvas: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const viewLevel = useLooperStore(s => s.ui.canvasView.viewLevel);
    const initialized = useLooperStore(s => s.engines.initialized);
    const initializeEngines = useLooperStore(s => s.initializeEngines);

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            {/* Audio initialization prompt */}
            {!initialized && (
                <div className="flex items-center justify-center py-8 bg-zinc-900 border-b border-zinc-700">
                    <button
                        onClick={() => initializeEngines()}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
                    >
                        Initialize Audio & MIDI
                    </button>
                    <span className="ml-3 text-zinc-500 text-xs">
                        Required for playback
                    </span>
                </div>
            )}

            {/* Main canvas area */}
            <div className="flex-1 overflow-auto p-4">
                <div className="relative">
                    {/* Section Timeline */}
                    <SectionTimeline />

                    {/* Module Lanes (views 2 and 3) */}
                    {viewLevel !== 'sectionsOnly' && <ModuleLanes />}

                    {/* Chord Strip (when a section is selected) */}
                    <ChordStrip />

                    {/* Full Composition extras (view 3 only) */}
                    {viewLevel === 'fullComposition' && (
                        <div className="mt-4 p-3 bg-zinc-800/20 border border-dashed border-zinc-700 rounded-lg">
                            <span className="text-[10px] text-zinc-500">
                                Full Composition View — Expression markers, MIDI mapping, and audio meters
                                will appear here.
                            </span>
                        </div>
                    )}

                    {/* Empty state */}
                    {sections.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                            <div className="text-4xl mb-4">🎵</div>
                            <h2 className="text-lg font-semibold mb-2">Start a new song</h2>
                            <p className="text-sm text-zinc-500 mb-4">
                                Add sections and modules to build your arrangement.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => useLooperStore.getState().addSection()}
                                    className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                                >
                                    + Add Section
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Playhead overlay */}
                    <PlayheadOverlay />
                </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-1 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-500">
                <div className="flex items-center gap-4">
                    <span>{viewLevel === 'sectionsOnly' ? 'Sections Only' : viewLevel === 'sectionsWithModules' ? 'Sections + Modules' : 'Full Composition'}</span>
                    <span>{sections.length} sections</span>
                    <span>{useLooperStore.getState().song.modules.length} modules</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${useLooperStore.getState().engines.initialized ? 'bg-green-500' : 'bg-zinc-600'}`} />
                    <span>{useLooperStore.getState().engines.initialized ? 'Audio Ready' : 'Audio Offline'}</span>
                </div>
            </div>
        </div>
    );
};

export default SongCompositionCanvas;