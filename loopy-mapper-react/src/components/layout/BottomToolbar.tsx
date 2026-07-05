// ═══════════════════════════════════════════════════════════════════
// BOTTOM TOOLBAR — Quick actions, status, and context-sensitive tools
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';

export const BottomToolbar: React.FC = () => {
    const isPlaying = useLooperStore(s => s.transport.isPlaying);
    const isRecording = useLooperStore(s => s.transport.isRecording);
    const globalPlay = useLooperStore(s => s.globalPlay);
    const globalRecord = useLooperStore(s => s.globalRecord);
    const addSection = useLooperStore(s => s.addSection);
    const setModal = useLooperStore(s => s.setModal);
    const initialized = useLooperStore(s => s.engines.initialized);
    const midiConnected = useLooperStore(s => s.ui.midiDeviceConnected);
    const sections = useLooperStore(s => s.song.arrangement);
    const activeSectionIndex = useLooperStore(s => s.transport.activeSectionIndex);
    const modules = useLooperStore(s => s.song.modules);
    const toggleRightPanel = useLooperStore(s => s.toggleRightPanel);
    const rightPanelVisible = useLooperStore(s => s.ui.rightPanelVisible);
    const songTitle = useLooperStore(s => s.song.metadata.title);
    const bpm = useLooperStore(s => s.song.metadata.bpm);

    return (
        <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-500">
            {/* Left: Quick actions */}
            <div className="flex items-center gap-1.5">
                <ToolButton
                    onClick={globalPlay}
                    active={isPlaying}
                    activeColor={isPlaying ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}
                    label={isPlaying ? 'Stop' : 'Play'}
                    shortcut="Space"
                >
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                    )}
                </ToolButton>

                <ToolButton
                    onClick={globalRecord}
                    active={isRecording}
                    activeColor={isRecording ? 'bg-red-600 text-white' : ''}
                    label="Record"
                    shortcut="R"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
                </ToolButton>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                <ToolButton
                    onClick={() => addSection()}
                    label="+ Section"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </ToolButton>

                <ToolButton
                    onClick={() => setModal({ type: 'addModule' })}
                    label="+ Module"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                </ToolButton>
            </div>

            {/* Center: Status & breadcrumb */}
            <div className="flex items-center gap-3">
                {/* Section breadcrumb */}
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
                <span className="text-zinc-600">{songTitle}</span>
                <span className="text-zinc-600 font-mono">{bpm} BPM</span>

                <div className="w-px h-4 bg-zinc-700" />

                {/* Audio status */}
                <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${initialized ? 'bg-green-500' : 'bg-zinc-600'}`} />
                    <span>{initialized ? 'Audio' : 'Offline'}</span>
                </div>

                {/* MIDI status */}
                <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${midiConnected ? 'bg-blue-500' : 'bg-zinc-600'}`} />
                    <span>MIDI</span>
                </div>

                <div className="w-px h-4 bg-zinc-700" />

                {/* Module count */}
                <span>{modules.length} mod</span>

                {/* Info panel toggle */}
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

// ─── Tool Button ──────────────────────────────────────────────────

const ToolButton: React.FC<{
    onClick: () => void;
    label: string;
    active?: boolean;
    activeColor?: string;
    shortcut?: string;
    children: React.ReactNode;
}> = ({ onClick, label, active, activeColor, shortcut, children }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors
            ${activeColor || 'hover:bg-zinc-800 text-zinc-400 hover:text-white'}
            ${active && !activeColor ? 'text-blue-400' : ''}`}
        title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
        {children}
        <span className="hidden sm:inline">{label}</span>
    </button>
);

export default BottomToolbar;