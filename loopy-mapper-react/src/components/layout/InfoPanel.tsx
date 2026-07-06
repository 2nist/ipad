// ═══════════════════════════════════════════════════════════════════
// INFO PANEL — Right side resizable panel
// Primary: Conductor (arrangement section navigator)
// Secondary: Song info, transport status, lyrics
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLooperStore } from '../../store/store';
import { ModuleSettingsPanel } from '../editor/ModuleSettingsPanel';

export const InfoPanel: React.FC = () => {
    const visible = useLooperStore(s => s.ui.rightPanelVisible);
    const toggleRightPanel = useLooperStore(s => s.toggleRightPanel);
    const editorPanel = useLooperStore(s => s.ui.activeEditorPanel);
    const setEditorPanel = useLooperStore(s => s.setEditorPanel);
    const [width, setWidth] = useState(300);

    const resizing = useRef(false);
    const handleMouseDown = useCallback(() => {
        resizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizing.current) return;
            setWidth(w => Math.max(200, Math.min(500, w - e.movementX)));
        };
        const handleMouseUp = () => {
            if (resizing.current) {
                resizing.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="flex flex-col bg-zinc-900 border-l border-zinc-800 overflow-hidden relative flex-shrink-0 h-full" style={{ width }}>
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 z-10"
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300">Arrangement</span>
                <button
                    onClick={toggleRightPanel}
                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white"
                    title="Close panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {editorPanel.type === 'module' && editorPanel.moduleId ? (
                    <ModuleSettingsPanel moduleId={editorPanel.moduleId} />
                ) : (
                    <div className="px-3 py-3 space-y-4 text-xs">
                        <SectionNavigator />
                        <ConductorInfo />
                        <SongInfo />
                        <TransportReadout />
                        <LyricsSection />
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Section Navigator — "Now Playing / Up Next" ─────────────────

const SectionNavigator: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const activeIndex = useLooperStore(s => s.transport.activeSectionIndex);
    const isPlaying = useLooperStore(s => s.transport.isPlaying);
    const position = useLooperStore(s => s.transport.position);
    const jumpToSection = useLooperStore(s => s.jumpToSection);

    if (sections.length === 0) {
        return (
            <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sections</h3>
                <p className="text-zinc-600 italic text-[10px]">No sections yet. Add one from the toolbar.</p>
            </div>
        );
    }

    const totalBars = sections.reduce((sum, s) => sum + s.bars, 0);
    const currentSection = sections[activeIndex];
    const nextSection = activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null;

    return (
        <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                {isPlaying ? 'Now Playing' : 'Arrangement'}
            </h3>

            {/* Now playing / active section */}
            {currentSection && (
                <div className="mb-2 p-2 rounded bg-green-800/30 border border-green-700/30">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-green-300">
                            {isPlaying ? '▶ ' : ''}{currentSection.name}
                        </span>
                        <span className="text-[10px] text-green-600">{currentSection.bars} bars</span>
                    </div>
                    {isPlaying && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span>Bar {position.barInSection + 1} / {currentSection.bars}</span>
                            <span className="text-zinc-600">·</span>
                            <span>Beat {Math.floor(position.beatInBar) + 1}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Up next */}
            {isPlaying && nextSection && (
                <div className="mb-2 p-2 rounded bg-zinc-800/50 border border-zinc-700/30">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Up next: <span className="text-zinc-300">{nextSection.name}</span></span>
                        <span className="text-[10px] text-zinc-600">{nextSection.bars} bars</span>
                    </div>
                </div>
            )}

            {/* Full section list */}
            <div className="space-y-0.5 mt-1">
                {sections.map((s, i) => {
                    const isActive = i === activeIndex && isPlaying;
                    const isPast = i < activeIndex && isPlaying;
                    return (
                        <button
                            key={s.id}
                            onClick={() => jumpToSection(s.id)}
                            className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center justify-between transition-colors ${
                                isActive
                                    ? 'bg-green-700/40 text-green-200'
                                    : isPast
                                    ? 'bg-zinc-800/20 text-zinc-500'
                                    : 'bg-zinc-800/40 text-zinc-400 hover:bg-zinc-700/40 hover:text-zinc-300'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    isActive ? 'bg-green-400' : isPast ? 'bg-zinc-600' : 'bg-zinc-600'
                                }`} />
                                <span>{i + 1}. {s.name}</span>
                            </div>
                            <span className="text-zinc-600 text-[9px]">{s.bars} bars</span>
                        </button>
                    );
                })}
            </div>

            {/* Total */}
            <div className="mt-1.5 pt-1.5 border-t border-zinc-800 flex justify-between text-[9px] text-zinc-600">
                <span>{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                <span>{totalBars} bars total</span>
            </div>
        </div>
    );
};

// ─── Conductor Info ───────────────────────────────────────────────

const ConductorInfo: React.FC = () => {
    const modules = useLooperStore(s => s.song.modules);
    const setBpm = useLooperStore(s => s.setBpm);
    const bpm = useLooperStore(s => s.song.metadata.bpm);
    const timeSig = useLooperStore(s => s.song.metadata.timeSignature);

    const arrModule = modules.find(m => m.type === 'arrangement');
    if (!arrModule) return null;

    return (
        <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Conductor</h3>
            <div className="space-y-1.5">
                <div className="flex justify-between">
                    <span className="text-zinc-500">BPM</span>
                    <input
                        type="number"
                        min={60}
                        max={200}
                        value={bpm}
                        onChange={e => setBpm(Number(e.target.value))}
                        className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-right text-zinc-300 text-[10px] font-mono"
                    />
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Time Sig</span>
                    <span className="text-zinc-300 font-mono text-[10px]">{timeSig.numerator}/{timeSig.denominator}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">MIDI base</span>
                    <span className="text-zinc-300 font-mono text-[10px]">{arrModule.baseMidiNote}</span>
                </div>
            </div>
        </div>
    );
};

// ─── Song Info ────────────────────────────────────────────────────

const SongInfo: React.FC = () => {
    const metadata = useLooperStore(s => s.song.metadata);
    const modules = useLooperStore(s => s.song.modules);
    const soundModules = modules.filter(m => m.type !== 'arrangement');

    return (
        <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Song</h3>
            <div className="space-y-1 text-zinc-400">
                <div className="flex justify-between">
                    <span className="text-zinc-500">Title</span>
                    <span className="text-zinc-300">{metadata.title}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Key</span>
                    <span className="text-zinc-300">{metadata.key} {metadata.scale}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Modules</span>
                    <span className="text-zinc-300">{soundModules.length} sound</span>
                </div>
            </div>
        </div>
    );
};

// ─── Transport Readout ────────────────────────────────────────────

const TransportReadout: React.FC = () => {
    const transport = useLooperStore(s => s.transport);
    const initialized = useLooperStore(s => s.engines.initialized);

    return (
        <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Transport</h3>
            <div className="space-y-1 text-zinc-400">
                <div className="flex justify-between">
                    <span className="text-zinc-500">State</span>
                    <span className={transport.isPlaying ? 'text-green-400' : 'text-zinc-500'}>
                        {!initialized ? 'Not initialized' : transport.isPlaying ? 'Playing' : 'Stopped'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Beat</span>
                    <span className="text-zinc-300 font-mono">{Math.floor(transport.position.absoluteBeat)}</span>
                </div>
            </div>
        </div>
    );
};

// ─── Lyrics ───────────────────────────────────────────────────────

const LyricsSection: React.FC = () => {
    const lyrics = useLooperStore(s => s.ui.lyrics);
    const setLyrics = useLooperStore(s => s.setLyrics);

    return (
        <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Lyrics</h3>
            <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Type or paste lyrics..."
                className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300 resize-none focus:outline-none focus:border-blue-500 placeholder-zinc-600"
            />
        </div>
    );
};

export default InfoPanel;