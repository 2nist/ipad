// ═══════════════════════════════════════════════════════════════════
// SELECTORS — Derived state computed from the LooperStore
// ═══════════════════════════════════════════════════════════════════

import type {
    ModuleCard, SongSection, ResolvedChord,
    ModuleRuntimeState, ExpressionRuntimeState, MidiBinding,
} from '../types';
import { useLooperStore } from './store';

/**
 * Get all modules of a specific type
 */
export function useModulesByType(type: string): ModuleCard[] {
    return useLooperStore(state => state.song.modules.filter(m => m.type === type));
}

/**
 * Get all rhythm modules
 */
export function useRhythmModules(): ModuleCard[] {
    return useModulesByType('rhythm');
}

/**
 * Get all harmonic modules
 */
export function useHarmonicModules(): ModuleCard[] {
    return useModulesByType('harmonic');
}

/**
 * Get all arrangement modules
 */
export function useArrangementModules(): ModuleCard[] {
    return useModulesByType('arrangement');
}

/**
 * Get the current section based on activeSectionIndex
 */
export function useCurrentSection(): SongSection | null {
    return useLooperStore(state => {
        const index = state.transport.activeSectionIndex;
        return state.song.arrangement[index] ?? null;
    });
}

/**
 * Get modules active in the current section
 */
export function useActiveModules(): ModuleCard[] {
    return useLooperStore(state => {
        const currentSection = state.song.arrangement[state.transport.activeSectionIndex];
        if (!currentSection) return [];
        return state.song.modules.filter(m =>
            currentSection.activeModules.includes(m.id)
        );
    });
}

/**
 * Get the active chord for a harmonic module
 */
export function useCurrentChord(moduleId: string): ResolvedChord | undefined {
    return useLooperStore(state =>
        state.moduleStates[moduleId]?.harmony?.activeChord
    );
}

/**
 * Get all MIDI bindings
 */
export function useAllBindings(): MidiBinding[] {
    return useLooperStore(() => []); // Will be populated by MidiRouter
}

/**
 * Get expression state for a module
 */
export function useExpressionState(moduleId: string): ExpressionRuntimeState | undefined {
    return useLooperStore(state =>
        state.moduleStates[moduleId]?.expression
    );
}

/**
 * Check if transport is in a transition
 */
export function useIsTransitioning(): boolean {
    return useLooperStore(state => {
        const currentSection = state.song.arrangement[state.transport.activeSectionIndex];
        if (!currentSection || currentSection.transition !== 'fade') return false;
        const fadeBars = state.song.metadata.bpm > 0 ? 1 : 0;
        return state.transport.position.remainingBeatsInSection <= fadeBars * 4;
    });
}

/**
 * Get effective volume for a module (after section overrides)
 */
export function useEffectiveModuleVolume(moduleId: string): number {
    return useLooperStore(state =>
        state.moduleStates[moduleId]?.effectiveVolume ?? 1.0
    );
}

/**
 * Get a specific module by ID
 */
export function useModule(moduleId: string): ModuleCard | undefined {
    return useLooperStore(state =>
        state.song.modules.find(m => m.id === moduleId)
    );
}

/**
 * Get runtime state for a module
 */
export function useModuleRuntime(moduleId: string): ModuleRuntimeState | undefined {
    return useLooperStore(state =>
        state.moduleStates[moduleId]
    );
}

/**
 * Check if any module is currently active
 */
export function useHasActiveModules(): boolean {
    return useLooperStore(state =>
        Object.values(state.moduleStates).some(m => m.isActive)
    );
}