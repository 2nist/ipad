// ═══════════════════════════════════════════════════════════════════
// LEFT NAV — Narrow sidebar with Lucide icon navigation
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useLooperStore } from '../../store/store';
import { MODULE_PRESETS } from '../../store/presets';

// Lucide icons as simple SVG components (no external dependency needed)
const Icons = {
    LayoutGrid: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
    ),
    Music: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
    ),
    Layers: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
    ),
    Disc3: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="8" />
        </svg>
    ),
    Settings: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    ),
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    ),
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    ),
};

type NavItem = {
    id: string;
    icon: React.ReactNode;
    label: string;
    action: () => void;
};

export const LeftNav: React.FC = () => {
    const sidebarVisible = useLooperStore(s => s.ui.sidebarVisible);
    const [expanded, setExpanded] = useState(false);

    if (!sidebarVisible) {
        return (
            <div className="flex flex-col items-center py-2 bg-zinc-900 border-r border-zinc-800 w-10">
                <button
                    onClick={() => useLooperStore.getState().setCanvasView({ viewLevel: "sectionsOnly" })}
                    className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    title="Show sidebar"
                >
                    <Icons.ChevronRight />
                </button>
            </div>
        );
    }

    const sections = useLooperStore(s => s.song.arrangement);
    const modules = useLooperStore(s => s.song.modules);
    const setModal = useLooperStore(s => s.setModal);
    const toggleClipBrowser = useLooperStore(s => s.toggleClipBrowser);
    const toggleDrumBrowser = useLooperStore(s => s.toggleDrumBrowser);
    const addSection = useLooperStore(s => s.addSection);
    const setCanvasView = useLooperStore(s => s.setCanvasView);
    const selectSection = (id: string) => setCanvasView({ selectedSectionIds: [id] });

    const addModule = useLooperStore(s => s.addModule);

    const navItems: NavItem[] = [
        {
            id: 'add-module',
            icon: <Icons.Plus />,
            label: 'Add Module',
            action: () => setModal({ type: 'addModule' }),
        },
        {
            id: 'quick-rhythm',
            icon: <span className="text-red-400">🔴</span>,
            label: 'Rhythm Module',
            action: () => {
                const preset = MODULE_PRESETS.find(p => p.id === 'preset-rhythm-4tk');
                if (preset) addModule(preset);
            },
        },
        {
            id: 'quick-harmonic',
            icon: <span className="text-blue-400">🔵</span>,
            label: 'Pad Module',
            action: () => {
                const preset = MODULE_PRESETS.find(p => p.id === 'preset-harmonic-1tk');
                if (preset) addModule(preset);
            },
        },
        {
            id: 'sections',
            icon: <Icons.LayoutGrid />,
            label: 'Sections',
            action: () => setCanvasView({ viewLevel: 'sectionsOnly' }),
        },
        {
            id: 'modules',
            icon: <Icons.Music />,
            label: 'Modules',
            action: () => setCanvasView({ viewLevel: 'sectionsWithModules' }),
        },
        {
            id: 'drums',
            icon: <span className="text-orange-400">🥁</span>,
            label: 'Drum Kits',
            action: () => toggleDrumBrowser(),
        },
        {
            id: 'clips',
            icon: <Icons.Disc3 />,
            label: 'Clip Library',
            action: () => toggleClipBrowser(),
        },
        {
            id: 'settings',
            icon: <Icons.Settings />,
            label: 'Settings',
            action: () => setModal({ type: 'about' }),
        },
    ];

    return (
        <div className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-150 ${expanded ? 'w-44' : 'w-12'} overflow-hidden`}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            {/* Toggle button */}
            <div className="flex items-center justify-between px-1.5 py-2 border-b border-zinc-800">
                <span className={`text-[10px] text-zinc-500 uppercase tracking-wider ${expanded ? 'block' : 'hidden'}`}>
                    Navigate
                </span>
                <button
                    onClick={() => useLooperStore.getState().toggleClipBrowser()}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                    title="Hide sidebar"
                >
                    <Icons.ChevronLeft />
                </button>
            </div>

            {/* Navigation icons */}
            <div className="flex-1 py-2 space-y-1">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-left"
                        title={item.label}
                    >
                        <span className="flex-shrink-0 w-5 flex justify-center">{item.icon}</span>
                        <span className={`text-xs truncate ${expanded ? 'block' : 'hidden'}`}>{item.label}</span>
                    </button>
                ))}

                {/* Section list (only visible when expanded) */}
                {expanded && sections.length > 0 && (
                    <>
                        <div className="pt-2 mt-2 border-t border-zinc-800">
                            <div className="flex items-center justify-between px-2 mb-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sections</span>
                                <button
                                    onClick={() => addSection()}
                                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                                    title="Add section"
                                >
                                    <Icons.Plus />
                                </button>
                            </div>
                            {sections.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={() => selectSection(s.id)}
                                    className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white text-left"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 flex-shrink-0" />
                                    <span className="text-xs truncate">{s.name}</span>
                                    <span className="text-[10px] text-zinc-600 ml-auto">{s.bars} bars</span>
                                </button>
                            ))}
                        </div>

                        {/* Module count */}
                        {modules.length > 0 && (
                            <div className="px-2 pt-2 mt-2 border-t border-zinc-800">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                    {modules.length} module{modules.length !== 1 ? 's' : ''}
                                </span>
                                <div className="mt-1 space-y-0.5">
                                    {modules.map(m => (
                                        <div key={m.id} className="flex items-center gap-2 px-1 py-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: m.colorAccent || '#666' }} />
                                            <span className="text-[11px] text-zinc-400 truncate">{m.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LeftNav;