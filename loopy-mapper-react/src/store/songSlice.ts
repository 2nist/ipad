// ═══════════════════════════════════════════════════════════════════
// SONG SLICE — SongObject data: modules, sections, metadata
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
    SongObject, SongMetadata, SongSection, ModuleCard, ModulePreset,
    ModuleTrackConfig, SoundSource, SoundEngine, ChordStep, SectionMarker, TransitionMode,
    LooperStore, LooperStoreActions,
} from '../types';
import { getPresetById } from './presets';

const DEFAULT_CANVAS_VIEW = {
    viewLevel: "sectionsOnly" as const,
    selectedSectionIds: [] as string[],
    selectedModuleIds: [] as string[],
    zoomLevel: 50,
    scrollPosition: 0,
    chordEditorOpen: false,
    chordEditorBarIndex: null as number | null,
    isPlaying: false,
    playheadPosition: 0,
};
export const DEFAULT_SONG_METADATA: SongMetadata = {
    title: "Untitled Song",
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    key: "C",
    scale: "major",
};

const DEFAULT_SECTION: Omit<SongSection, 'id'> = {
    name: "Section",
    bars: 8,
    transition: "nextBar",
    chordProgression: [],
    activeModules: [],
};

export interface SongSlice {
    // State is part of LooperStore.song
    // Actions:
    addModule: LooperStoreActions['addModule'];
    removeModule: LooperStoreActions['removeModule'];
    updateModule: LooperStoreActions['updateModule'];
    moveModule: LooperStoreActions['moveModule'];
    addSection: LooperStoreActions['addSection'];
    removeSection: LooperStoreActions['removeSection'];
    updateSection: LooperStoreActions['updateSection'];
    moveSection: LooperStoreActions['moveSection'];
    setChordStep: LooperStoreActions['setChordStep'];
    addSectionMarker: LooperStoreActions['addSectionMarker'];
    removeSectionMarker: LooperStoreActions['removeSectionMarker'];
    setSongMetadata: LooperStoreActions['setSongMetadata'];
    updateTrack: LooperStoreActions['updateTrack'];
    assignClipToTrack: LooperStoreActions['assignClipToTrack'];
    setSoundSource: LooperStoreActions['setSoundSource'];
    setSoundEngine: LooperStoreActions['setSoundEngine'];
    newSong: LooperStoreActions['newSong'];
    saveSong: LooperStoreActions['saveSong'];
    loadSong: LooperStoreActions['loadSong'];
    exportSong: LooperStoreActions['exportSong'];
    saveModulePreset: LooperStoreActions['saveModulePreset'];
    loadModulePreset: LooperStoreActions['loadModulePreset'];
    deleteUserPreset: LooperStoreActions['deleteUserPreset'];
}

export const createDefaultSong = (): SongObject => ({
    metadata: { ...DEFAULT_SONG_METADATA },
    modules: [],
    arrangement: [],
    midiBindings: [],
});

export const createSongSlice: StateCreator<
    LooperStore,
    [],
    [],
    SongSlice
> = (set, get) => ({
    addModule: (preset: ModulePreset) => {
        const id = uuid();
        const newModule: ModuleCard = {
            ...JSON.parse(JSON.stringify(preset.defaults)),
            id,
        };
        set(state => ({
            song: {
                ...state.song,
                modules: [...state.song.modules, newModule],
            },
        }));
        return id;
    },

    removeModule: (moduleId: string) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.filter(m => m.id !== moduleId),
                arrangement: state.song.arrangement.map(section => ({
                    ...section,
                    activeModules: section.activeModules.filter(m => m !== moduleId),
                })),
            },
        }));
    },

    updateModule: (moduleId: string, updates: Partial<ModuleCard>) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.map(m =>
                    m.id === moduleId ? { ...m, ...updates } : m
                ),
            },
        }));
    },

    moveModule: (moduleId: string, newIndex: number) => {
        set(state => {
            const modules = [...state.song.modules];
            const idx = modules.findIndex(m => m.id === moduleId);
            if (idx === -1) return state;
            const [moved] = modules.splice(idx, 1);
            modules.splice(newIndex, 0, moved);
            return { song: { ...state.song, modules } };
        });
    },

    addSection: (afterIndex?: number) => {
        const id = uuid();
        const name = `Section ${get().song.arrangement.length + 1}`;
        const newSection: SongSection = {
            ...DEFAULT_SECTION,
            id,
            name,
        };
        set(state => {
            const arr = [...state.song.arrangement];
            const insertAt = afterIndex !== undefined ? afterIndex + 1 : arr.length;
            arr.splice(insertAt, 0, newSection);
            return { song: { ...state.song, arrangement: arr } };
        });
        return id;
    },

    removeSection: (sectionId: string) => {
        set(state => ({
            song: {
                ...state.song,
                arrangement: state.song.arrangement.filter(s => s.id !== sectionId),
            },
        }));
    },

    updateSection: (sectionId: string, updates: Partial<SongSection>) => {
        set(state => ({
            song: {
                ...state.song,
                arrangement: state.song.arrangement.map(s =>
                    s.id === sectionId ? { ...s, ...updates } : s
                ),
            },
        }));
    },

    moveSection: (sectionId: string, newIndex: number) => {
        set(state => {
            const arr = [...state.song.arrangement];
            const idx = arr.findIndex(s => s.id === sectionId);
            if (idx === -1) return state;
            const [moved] = arr.splice(idx, 1);
            arr.splice(newIndex, 0, moved);
            return { song: { ...state.song, arrangement: arr } };
        });
    },

    setChordStep: (sectionId: string, barIndex: number, chord: ChordStep) => {
        set(state => ({
            song: {
                ...state.song,
                arrangement: state.song.arrangement.map(s => {
                    if (s.id !== sectionId) return s;
                    const prog = [...s.chordProgression];
                    prog[barIndex] = chord;
                    return { ...s, chordProgression: prog };
                }),
            },
        }));
    },

    addSectionMarker: (sectionId: string, marker: SectionMarker) => {
        set(state => ({
            song: {
                ...state.song,
                arrangement: state.song.arrangement.map(s =>
                    s.id === sectionId
                        ? { ...s, markers: [...(s.markers || []), marker] }
                        : s
                ),
            },
        }));
    },

    removeSectionMarker: (sectionId: string, markerIndex: number) => {
        set(state => ({
            song: {
                ...state.song,
                arrangement: state.song.arrangement.map(s =>
                    s.id === sectionId
                        ? { ...s, markers: (s.markers || []).filter((_, i) => i !== markerIndex) }
                        : s
                ),
            },
        }));
    },

    setSongMetadata: (updates: Partial<SongMetadata>) => {
        set(state => ({
            song: {
                ...state.song,
                metadata: { ...state.song.metadata, ...updates },
            },
        }));
    },

    updateTrack: (moduleId: string, trackIndex: number, updates: Partial<ModuleTrackConfig>) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.map(m =>
                    m.id === moduleId
                        ? {
                            ...m,
                            tracks: m.tracks.map(t =>
                                t.index === trackIndex ? { ...t, ...updates } : t
                            ),
                        }
                        : m
                ),
            },
        }));
    },

    assignClipToTrack: (moduleId: string, trackIndex: number, clipId: string) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.map(m =>
                    m.id === moduleId
                        ? {
                            ...m,
                            tracks: m.tracks.map(t =>
                                t.index === trackIndex && t.soundSource.type === "midiClip"
                                    ? {
                                        ...t,
                                        soundSource: {
                                            ...(t.soundSource as { type: "midiClip" }),
                                            clipId,
                                        } as any,
                                    }
                                    : t
                            ),
                        }
                        : m
                ),
            },
        }));
    },

    setSoundSource: (moduleId: string, trackIndex: number, source: SoundSource) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.map(m =>
                    m.id === moduleId
                        ? {
                            ...m,
                            tracks: m.tracks.map(t =>
                                t.index === trackIndex ? { ...t, soundSource: source } : t
                            ),
                        }
                        : m
                ),
            },
        }));
    },

    setSoundEngine: (moduleId: string, trackIndex: number, engine: SoundEngine) => {
        set(state => ({
            song: {
                ...state.song,
                modules: state.song.modules.map(m =>
                    m.id === moduleId
                        ? {
                            ...m,
                            tracks: m.tracks.map(t =>
                                t.index === trackIndex
                                    ? {
                                        ...t,
                                        soundSource: { ...t.soundSource, soundEngine: engine } as any,
                                    }
                                    : t
                            ),
                        }
                        : m
                ),
            },
        }));
    },

    newSong: (metadata: SongMetadata) => {
        set({
            song: createDefaultSong(),
            transport: {
                isPlaying: false,
                isRecording: false,
                position: {
                    absoluteBeat: 0, barInSection: 0, beatInBar: 0, tickInBeat: 0,
                    sectionId: "", beatInSection: 0, elapsedBeatsInSection: 0, remainingBeatsInSection: 0,
                },
                activeSectionId: null,
                activeSectionIndex: 0,
            },
            moduleStates: {},
            ui: {
                activeModal: { type: "none" },
                activeEditorPanel: { type: "none" },
                editingModuleId: null,
                editingTrackIndex: null,
                clipBrowserOpen: false,
                sidebarVisible: true,
                canvasView: DEFAULT_CANVAS_VIEW,
                midiLearnTarget: null,
                midiActivity: false,
                midiDeviceConnected: false,
                audioInitialized: false,
            },
        });
        if (metadata) {
            get().setSongMetadata(metadata);
        }
    },

    saveSong: () => get().song,

    loadSong: (song: SongObject) => {
        set({
            song,
            transport: {
                isPlaying: false,
                isRecording: false,
                position: {
                    absoluteBeat: 0, barInSection: 0, beatInBar: 0, tickInBeat: 0,
                    sectionId: "", beatInSection: 0, elapsedBeatsInSection: 0, remainingBeatsInSection: 0,
                },
                activeSectionId: null,
                activeSectionIndex: 0,
            },
        });
    },

    exportSong: () => {
        const song = get().song;
        const json = JSON.stringify(song, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${song.metadata.title || 'song'}.songobject.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    saveModulePreset: (moduleId: string, name: string, description: string) => {
        const module = get().song.modules.find(m => m.id === moduleId);
        if (!module) return;
        // Save to localStorage for now
        const preset = {
            id: uuid(),
            name,
            description,
            moduleType: module.type,
            defaults: module,
            tags: [module.type],
        };
        const stored = JSON.parse(localStorage.getItem('user-presets') || '[]');
        stored.push(preset);
        localStorage.setItem('user-presets', JSON.stringify(stored));
    },

    loadModulePreset: (presetId: string) => {
        const stored = JSON.parse(localStorage.getItem('user-presets') || '[]');
        const preset = stored.find((p: any) => p.id === presetId);
        if (preset) return JSON.parse(JSON.stringify(preset.defaults));
        const builtin = getPresetById(presetId);
        if (builtin) return JSON.parse(JSON.stringify(builtin.defaults));
        throw new Error(`Preset ${presetId} not found`);
    },

    deleteUserPreset: (presetId: string) => {
        const stored = JSON.parse(localStorage.getItem('user-presets') || '[]');
        const filtered = stored.filter((p: any) => p.id !== presetId);
        localStorage.setItem('user-presets', JSON.stringify(filtered));
    },
});