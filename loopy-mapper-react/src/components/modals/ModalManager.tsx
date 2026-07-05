// ═══════════════════════════════════════════════════════════════════
// MODAL MANAGER — Renders modals based on activeModal state
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useLooperStore } from '../../store/store';
import { MODULE_PRESETS } from '../../store/presets';
import type { ModulePreset } from '../../types';

export const ModalManager: React.FC = () => {
    const activeModal = useLooperStore(s => s.ui.activeModal);
    const closeModal = useLooperStore(s => s.closeModal);

    if (activeModal.type === 'none') return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) closeModal();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto mx-4">
                {activeModal.type === 'addModule' && <AddModuleModal />}
                {activeModal.type === 'aiStructure' && <AiStructureModal />}
                {activeModal.type === 'aiArrange' && <AiArrangeModal />}
                {(activeModal.type === 'moduleEditor' || activeModal.type === 'sectionEditor') && (
                    <div className="p-6 text-center text-zinc-500 text-sm">
                        Editor for {activeModal.type} — coming soon
                        <button onClick={closeModal} className="block mx-auto mt-4 px-4 py-2 bg-zinc-700 rounded text-white text-xs">Close</button>
                    </div>
                )}
                {activeModal.type === 'aiChords' && (
                    <div className="p-6 text-center text-zinc-500 text-sm">
                        AI Chord Generation — coming soon
                        <button onClick={closeModal} className="block mx-auto mt-4 px-4 py-2 bg-zinc-700 rounded text-white text-xs">Close</button>
                    </div>
                )}
                {activeModal.type === 'about' && (
                    <div className="p-6 text-center text-zinc-500 text-sm">
                        Loopy Mapper React v1.0.0
                        <button onClick={closeModal} className="block mx-auto mt-4 px-4 py-2 bg-zinc-700 rounded text-white text-xs">Close</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Add Module Modal ──────────────────────────────────────────────

const AddModuleModal: React.FC = () => {
    const closeModal = useLooperStore(s => s.closeModal);
    const addModule = useLooperStore(s => s.addModule);
    const addSection = useLooperStore(s => s.addSection);

    const handleAddPreset = (preset: ModulePreset) => {
        const sections = useLooperStore.getState().song.arrangement;
        if (sections.length === 0) {
            addSection();
        }
        addModule(preset);
        closeModal();
    };

    const byType = (type: string) => MODULE_PRESETS.filter(p => p.moduleType === type);

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Add Module</h2>
                <button
                    onClick={closeModal}
                    className="text-zinc-500 hover:text-white text-xl leading-none"
                >
                    ✕
                </button>
            </div>

            {/* Rhythm Modules */}
            <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Rhythm</h3>
                <div className="grid grid-cols-2 gap-3">
                    {byType('rhythm').map(preset => (
                        <PresetCard key={preset.id} preset={preset} onAdd={handleAddPreset} />
                    ))}
                </div>
            </div>

            {/* Harmonic Modules */}
            <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Harmonic</h3>
                <div className="grid grid-cols-2 gap-3">
                    {byType('harmonic').map(preset => (
                        <PresetCard key={preset.id} preset={preset} onAdd={handleAddPreset} />
                    ))}
                </div>
            </div>

            {/* Arrangement Modules */}
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3">Arrangement</h3>
                <div className="grid grid-cols-2 gap-3">
                    {byType('arrangement').map(preset => (
                        <PresetCard key={preset.id} preset={preset} onAdd={handleAddPreset} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Preset Card ──────────────────────────────────────────────────

const PresetCard: React.FC<{ preset: ModulePreset; onAdd: (p: ModulePreset) => void }> = ({ preset, onAdd }) => (
    <button
        onClick={() => onAdd(preset)}
        className="text-left p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
    >
        <div className="font-medium text-white text-sm mb-1">{preset.name}</div>
        <div className="text-[11px] text-zinc-400 line-clamp-2">{preset.description}</div>
        <div className="mt-2 flex gap-1">
            {preset.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                    {tag}
                </span>
            ))}
        </div>
    </button>
);

// ─── AI Structure Modal (placeholder) ─────────────────────────────

const AiStructureModal: React.FC = () => {
    const closeModal = useLooperStore(s => s.closeModal);
    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">AI: Structure</h2>
                <button onClick={closeModal} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Generate a song structure using AI.</p>
            <div className="flex gap-3">
                <button className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm">Generate Structure</button>
                <button onClick={closeModal} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm">Cancel</button>
            </div>
        </div>
    );
};

// ─── AI Arrange Modal (placeholder) ───────────────────────────────

const AiArrangeModal: React.FC = () => {
    const closeModal = useLooperStore(s => s.closeModal);
    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">AI: Arrange</h2>
                <button onClick={closeModal} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Automatically arrange your modules across sections.</p>
            <div className="flex gap-3">
                <button className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm">Auto-Arrange</button>
                <button onClick={closeModal} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm">Cancel</button>
            </div>
        </div>
    );
};

export default ModalManager;