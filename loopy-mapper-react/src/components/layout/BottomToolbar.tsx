// ═══════════════════════════════════════════════════════════════════
// BOTTOM TOOLBAR — Status indicators, canvas lock buttons, panel toggle
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';

export const BottomToolbar: React.FC = () => {
    const initialized = useLooperStore(s => s.engines.initialized);
    const midiConnected = useLooperStore(s => s.ui.midiDeviceConnected);
    const sections = useLooperStore(s => s.song.arrangement);
    const activeSectionIndex = useLooperStore(s => s.transport.activeSectionIndex);
    const modules = useLooperStore(s => s.song.modules);
    const toggleRightPanel = useLooperStore(s => s.toggleRightPanel);
    const rightPanelVisible = useLooperStore(s => s.ui.rightPanelVisible);
    const bpm = useLooperStore(s => s.song.metadata.bpm);

    const lockSize = useLooperStore(s => s.ui.canvasLockSize);
    const lockPosition = useLooperStore(s => s.ui.canvasLockPosition);
    const bothLocked = lockSize && lockPosition;

    const toggleLockBoth = () => {
        const both = lockSize && lockPosition;
        useLooperStore.setState(state => ({
            ui: {
                ...state.ui,
                canvasLockSize: !both,
                canvasLockPosition: !both,
            },
        }));
    };

    return (
        <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-500">
            {/* Left: Canvas lock buttons */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={toggleLockBoth}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${bothLocked
                            ? 'bg-amber-600/30 text-amber-300 border border-amber-600/40'
                            : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700'
                        }`}
                    title="Lock/unlock canvas modules"
                >
                    {bothLocked ? '🔒 Locked' : '� Unlocked'}
                </button>
            </div>

            {/* Center: Section breadcrumb */}
            <div className="flex items-center gap-3">
                {sections.length > 0 && (
                    <div className="flex items-center gap-1">
                        {sections.slice(0, 8).map((s, i) => (
                            <React.Fragment key={s.id}>
                                {i > 0 && <span className="text-zinc-700">/</span>}
                                <span className={`px-1 py-0.5 rounded ${i === activeSectionIndex ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500'}`}>
                                    {s.name}
                                </span>
                            </React.Fragment>
                        ))}
                        {sections.length > 8 && <span className="text-zinc-600">+{sections.length - 8}</span>}
                    </div>
                )}
            </div>

            {/* Right: Status indicators */}
            <div className="flex items-center gap-3">
                <span className="text-zinc-600 font-mono">{bpm} BPM</span>

                <div className="w-px h-4 bg-zinc-700" />

                <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${initialized ? 'bg-green-500' : 'bg-zinc-600'}`} />
                    <span>{initialized ? 'Audio' : 'Offline'}</span>
                </div>

                <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${midiConnected ? 'bg-blue-500' : 'bg-zinc-600'}`} />
                    <span>MIDI</span>
                </div>

                <div className="w-px h-4 bg-zinc-700" />

                <span>{modules.length} mod</span>

                <button
                    onClick={toggleRightPanel}
                    className={`p-0.5 rounded ${rightPanelVisible ? 'text-blue-400 bg-blue-600/20' : 'text-zinc-500 hover:text-white'}`}
                    title="Toggle info panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default BottomToolbar;