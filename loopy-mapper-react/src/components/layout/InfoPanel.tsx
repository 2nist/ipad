// ═══════════════════════════════════════════════════════════════════
// INFO PANEL — Right side resizable panel with context info & lyrics
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLooperStore } from '../../store/store';

export const InfoPanel: React.FC = () => {
    const visible = useLooperStore(s => s.ui.rightPanelVisible);
    const toggleRightPanel = useLooperStore(s => s.toggleRightPanel);
    const [width, setWidth] = useState(320);
    const resizing = useRef(false);

    const handleMouseDown = useCallback(() => {
        resizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizing.current) return;
            setWidth(w => Math.max(200, Math.min(600, w - e.movementX)));
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
        <div
            className="flex flex-col bg-zinc-900 border-l border-zinc-800 overflow-hidden relative"
            style={{ width }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 z-10"
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300">Info</span>
                <button
                    onClick={toggleRightPanel}
                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white"
                    title="Close panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
                <SongMetadataSection />
                <SelectedSectionSection />
                <SelectedModuleSection />
                <HarmonyStateSection />
                <TransportSection />
                <LyricsSection />
            </div>
        </div>
    );
};

// ─── Song Metadata ────────────────────────────────────────────────

const SongMetadataSection: React.FC = () => {
    const metadata = useLooperStore(s => s.song.metadata);
    return (
        <Section title="Song">
            <div className="space-y-1 text-zinc-400">
                <Row label="Title" value={metadata.title} />
                <Row label="BPM" value={String(metadata.bpm)} />
                <Row label="Time" value={`${metadata.timeSignature.numerator}/${metadata.timeSignature.denominator}`} />
                <Row label="Key" value={`${metadata.key} ${metadata.scale}`} />
            </div>
        </Section>
    );
};

// ─── Selected Section ─────────────────────────────────────────────

const SelectedSectionSection: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedSectionIds);
    const section = sections.find(s => selectedIds.includes(s.id));

    if (!section) {
        return (
            <Section title="Section">
                <p className="text-zinc-600 italic">No section selected</p>
            </Section>
        );
    }

    return (
        <Section title={`Section: ${section.name}`}>
            <div className="space-y-1 text-zinc-400">
                <Row label="Bars" value={String(section.bars)} />
                <Row label="Transition" value={section.transition} />
                <Row label="Active Modules" value={String(section.activeModules.length)} />
                <Row label="Chords" value={section.chordProgression.length > 0
                    ? section.chordProgression.map(c => `${c.degree}${c.quality}`).join(', ')
                    : 'None'}
                />
            </div>
        </Section>
    );
};

// ─── Selected Module ──────────────────────────────────────────────

const SelectedModuleSection: React.FC = () => {
    const modules = useLooperStore(s => s.song.modules);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedModuleIds);
    const mod = modules.find(m => selectedIds.includes(m.id));

    if (!mod) return null;

    return (
        <Section title={`Module: ${mod.label}`}>
            <div className="space-y-1 text-zinc-400">
                <Row label="Type" value={mod.type} />
                <Row label="Size" value={mod.size} />
                <Row label="Bus" value={mod.bus} />
                <Row label="Tracks" value={String(mod.tracks.length)} />
                <Row label="Quantization" value={mod.quantization} />
                <div className="pt-1">
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Tracks</span>
                    {mod.tracks.map(t => (
                        <div key={t.index} className="flex items-center gap-2 py-0.5">
                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                            <span>{t.label}</span>
                            <span className="text-zinc-600 ml-auto">CH{t.midiNote - 35}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
};

// ─── Harmony State ────────────────────────────────────────────────

const HarmonyStateSection: React.FC = () => {
    const sections = useLooperStore(s => s.song.arrangement);
    const modStates = useLooperStore(s => s.moduleStates);
    const harmonyState = Object.values(modStates).find(ms => ms.harmony);

    // Show chord progression from active section
    const activeSectionId = useLooperStore(s => s.transport.activeSectionId);
    const activeSection = sections.find(s => s.id === activeSectionId);

    return (
        <Section title="Harmony">
            {activeSection && activeSection.chordProgression.length > 0 ? (
                <div className="space-y-1">
                    <span className="text-zinc-500 text-[10px]">Progression</span>
                    <div className="flex flex-wrap gap-1">
                        {activeSection.chordProgression.map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                                {['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'][c.degree - 1] || c.degree}
                                {c.quality !== 'maj' ? c.quality : ''}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-zinc-600 italic">No chord progression</p>
            )}
            {harmonyState?.harmony && (
                <div className="mt-2 text-zinc-500">
                    <Row label="Cadence" value={harmonyState.harmony.cadenceType} />
                </div>
            )}
        </Section>
    );
};

// ─── Transport State ──────────────────────────────────────────────

const TransportSection: React.FC = () => {
    const transport = useLooperStore(s => s.transport);
    const sections = useLooperStore(s => s.song.arrangement);
    const activeSection = sections.find(s => s.id === transport.activeSectionId);

    return (
        <Section title="Transport">
            <div className="space-y-1 text-zinc-400">
                <Row label="Playing" value={transport.isPlaying ? 'Yes' : 'No'} />
                <Row label="Recording" value={transport.isRecording ? 'Yes' : 'No'} />
                <Row label="Section" value={activeSection?.name || '—'} />
                <Row label="Position" value={`Beat ${transport.position.absoluteBeat}`} />
            </div>
        </Section>
    );
};

// ─── Lyrics ───────────────────────────────────────────────────────

const LyricsSection: React.FC = () => {
    const lyrics = useLooperStore(s => s.ui.lyrics);
    const lyricsSectionId = useLooperStore(s => s.ui.lyricsSectionId);
    const setLyrics = useLooperStore(s => s.setLyrics);
    const assignLyricsToSection = useLooperStore(s => s.assignLyricsToSection);
    const sections = useLooperStore(s => s.song.arrangement);
    const selectedIds = useLooperStore(s => s.ui.canvasView.selectedSectionIds);

    const handleHighlight = () => {
        if (selectedIds.length > 0) {
            assignLyricsToSection(selectedIds[0]);
        }
    };

    return (
        <Section title="Lyrics">
            <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Type or paste lyrics here..."
                className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300 resize-none focus:outline-none focus:border-blue-500 placeholder-zinc-600"
            />
            <div className="flex items-center justify-between mt-1">
                <span className="text-zinc-600 text-[10px]">
                    {lyricsSectionId
                        ? `Assigned to: ${sections.find(s => s.id === lyricsSectionId)?.name || '?'}`
                        : 'Unassigned'}
                </span>
                <button
                    onClick={handleHighlight}
                    disabled={selectedIds.length === 0 || !lyrics.trim()}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-[10px] transition-colors"
                >
                    Assign to Section
                </button>
            </div>
        </Section>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">{title}</h3>
        {children}
    </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300">{value}</span>
    </div>
);

export default InfoPanel;