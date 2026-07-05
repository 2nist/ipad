// ═══════════════════════════════════════════════════════════════════
// MODULE LANES — Shows which modules are active per section
// Visible in views 2 (sectionsWithModules) and 3 (fullComposition)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';

const BUS_COLORS: Record<string, string> = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
};

const MODULE_ICONS: Record<string, string> = {
    rhythm: '🔴',
    harmonic: '🔵',
    arrangement: '🟢',
};

export const ModuleLanes: React.FC = () => {
    const modules = useLooperStore(s => s.song.modules);
    const sections = useLooperStore(s => s.song.arrangement);
    const updateSection = useLooperStore(s => s.updateSection);
    const activeSectionId = useLooperStore(s => s.transport.activeSectionId);
    const viewLevel = useLooperStore(s => s.ui.canvasView.viewLevel);

    // Only show in views 2 and 3
    if (viewLevel === 'sectionsOnly') return null;

    const toggleModuleInSection = (sectionId: string, moduleId: string) => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;
        const isActive = section.activeModules.includes(moduleId);
        const updated = isActive
            ? section.activeModules.filter(m => m !== moduleId)
            : [...section.activeModules, moduleId];
        updateSection(sectionId, { activeModules: updated });
    };

    return (
        <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-1 text-xs text-zinc-500 px-1 mb-1">
                <span>Modules</span>
                <span className="text-zinc-600">|</span>
                <span>{modules.length} modules</span>
            </div>

            {modules.length === 0 ? (
                <div className="text-zinc-600 text-xs italic px-2">No modules yet. Click "+ Module" to add one.</div>
            ) : (
                <div className="flex flex-col gap-1">
                    {modules.map(mod => (
                        <div key={mod.id} className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-800/30">
                            {/* Bus color indicator */}
                            <div className={`w-2 h-2 rounded-full ${BUS_COLORS[mod.bus] || 'bg-zinc-500'}`} />

                            {/* Module label */}
                            <span className="text-xs text-zinc-300 w-24 truncate" title={mod.label}>
                                {MODULE_ICONS[mod.type]} {mod.label}
                            </span>

                            {/* Track count */}
                            <span className="text-[10px] text-zinc-500">
                                {mod.tracks.length}tr
                            </span>

                            {/* Per-section activity bars */}
                            <div className="flex gap-0.5 flex-1">
                                {sections.map(section => {
                                    const isActive = section.activeModules.includes(mod.id);
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => toggleModuleInSection(section.id, mod.id)}
                                            className={`h-4 rounded-sm transition-all ${isActive
                                                    ? `${BUS_COLORS[mod.bus] || 'bg-zinc-400'} w-6`
                                                    : 'bg-zinc-700 w-4 hover:bg-zinc-600'
                                                }`}
                                            title={`${section.name}: ${isActive ? 'Active' : 'Inactive'}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModuleLanes;