// ═══════════════════════════════════════════════════════════════════
// MODULE STATE SLICE — Runtime state for each module instance
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import type {
    LooperStore, ModuleRuntimeState, TrackRuntimeState,
} from '../types';

export interface ModuleStateSlice {
    moduleStates: Record<string, ModuleRuntimeState>;
    initModuleState: (moduleId: string, trackCount: number) => void;
    updateModuleState: (moduleId: string, updates: Partial<ModuleRuntimeState>) => void;
    clearModuleState: (moduleId: string) => void;
    setTrackState: (moduleId: string, trackIndex: number, updates: Partial<TrackRuntimeState>) => void;
    setEffectiveVolume: (moduleId: string, volume: number) => void;
    setSectionMuted: (moduleId: string, muted: boolean) => void;
}

export const createModuleStateSlice: StateCreator<
    LooperStore,
    [],
    [],
    ModuleStateSlice
> = (set, get) => ({
    moduleStates: {},

    initModuleState: (moduleId: string, trackCount: number) => {
        const tracks: TrackRuntimeState[] = Array.from({ length: trackCount }, (_, i) => ({
            trackIndex: i,
            state: "empty" as const,
            volume: 0.8,
            pan: 0,
            activeTranspose: 0,
            levelLeft: 0,
            levelRight: 0,
        }));

        const newState: ModuleRuntimeState = {
            moduleId,
            isActive: false,
            tracks,
            repeatCount: 0,
            effectiveVolume: 1.0,
            isSectionMuted: false,
        };

        set(state => ({
            moduleStates: {
                ...state.moduleStates,
                [moduleId]: newState,
            },
        }));
    },

    updateModuleState: (moduleId: string, updates: Partial<ModuleRuntimeState>) => {
        set(state => {
            const existing = state.moduleStates[moduleId];
            if (!existing) return state;
            return {
                moduleStates: {
                    ...state.moduleStates,
                    [moduleId]: { ...existing, ...updates },
                },
            };
        });
    },

    clearModuleState: (moduleId: string) => {
        set(state => {
            const { [moduleId]: _, ...rest } = state.moduleStates;
            return { moduleStates: rest };
        });
    },

    setTrackState: (moduleId: string, trackIndex: number, updates: Partial<TrackRuntimeState>) => {
        set(state => {
            const existing = state.moduleStates[moduleId];
            if (!existing) return state;
            return {
                moduleStates: {
                    ...state.moduleStates,
                    [moduleId]: {
                        ...existing,
                        tracks: existing.tracks.map(t =>
                            t.trackIndex === trackIndex ? { ...t, ...updates } : t
                        ),
                    },
                },
            };
        });
    },

    setEffectiveVolume: (moduleId: string, volume: number) => {
        set(state => {
            const existing = state.moduleStates[moduleId];
            if (!existing) return state;
            return {
                moduleStates: {
                    ...state.moduleStates,
                    [moduleId]: { ...existing, effectiveVolume: volume },
                },
            };
        });
    },

    setSectionMuted: (moduleId: string, muted: boolean) => {
        set(state => {
            const existing = state.moduleStates[moduleId];
            if (!existing) return state;
            return {
                moduleStates: {
                    ...state.moduleStates,
                    [moduleId]: { ...existing, isSectionMuted: muted },
                },
            };
        });
    },
});