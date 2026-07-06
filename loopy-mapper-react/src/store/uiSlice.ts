// ═══════════════════════════════════════════════════════════════════
// UI SLICE — Modal state, editor panels, canvas view, MIDI learn
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import type {
    LooperStore, ModalDialog, EditorPanel, CanvasViewState,
} from '../types';

export interface UiSlice {
    ui: {
        activeModal: ModalDialog;
        activeEditorPanel: EditorPanel;
        editingModuleId: string | null;
        editingTrackIndex: number | null;
        clipBrowserOpen: boolean;
        sidebarVisible: boolean;
        rightPanelVisible: boolean;
        lyrics: string;
        lyricsSectionId: string | null;
        canvasView: CanvasViewState;
        midiLearnTarget: string | null;
        midiActivity: boolean;
        midiDeviceConnected: boolean;
        audioInitialized: boolean;
        canvasLockSize: boolean;
        canvasLockPosition: boolean;
        assigningModuleId: string | null;
        midiEditorOpen: boolean;
        midiEditorModuleId: string | null;
        midiEditorTrackIndex: number | null;
        drumBrowserOpen: boolean;
    };
    setModal: (modal: ModalDialog) => void;
    closeModal: () => void;
    setEditorPanel: (panel: EditorPanel, moduleId?: string, trackIndex?: number) => void;
    closeEditor: () => void;
    setCanvasView: (view: Partial<CanvasViewState>) => void;
    setMidiLearnTarget: (target: string | null) => void;
    toggleClipBrowser: () => void;
    toggleRightPanel: () => void;
    setLyrics: (text: string) => void;
    assignLyricsToSection: (sectionId: string | null) => void;
    toggleLockSize: () => void;
    toggleLockPosition: () => void;
    toggleLockBoth: () => void;
    setAssigningModule: (moduleId: string | null) => void;
    openMidiEditor: (moduleId: string, trackIndex: number) => void;
    closeMidiEditor: () => void;
    toggleDrumBrowser: () => void;
}

export const DEFAULT_CANVAS_VIEW: CanvasViewState = {
    viewLevel: "sectionsOnly",
    selectedSectionIds: [],
    selectedModuleIds: [],
    zoomLevel: 50,
    scrollPosition: 0,
    chordEditorOpen: false,
    chordEditorBarIndex: null,
    isPlaying: false,
    playheadPosition: 0,
};

// Single source of truth for the ui slice's shape — reused wherever the ui
// state needs to be reset (e.g. songSlice.newSong) so new fields can't drift
// out of sync between the initial state and reset call sites.
export const DEFAULT_UI: UiSlice['ui'] = {
    activeModal: { type: "none" },
    activeEditorPanel: { type: "none" },
    editingModuleId: null,
    editingTrackIndex: null,
    clipBrowserOpen: false,
    sidebarVisible: true,
    rightPanelVisible: true,
    lyrics: "",
    lyricsSectionId: null,
    canvasView: { ...DEFAULT_CANVAS_VIEW },
    midiLearnTarget: null,
    midiActivity: false,
    midiDeviceConnected: false,
    audioInitialized: false,
    canvasLockSize: false,
    canvasLockPosition: false,
    assigningModuleId: null,
    midiEditorOpen: false,
    midiEditorModuleId: null,
    midiEditorTrackIndex: null,
    drumBrowserOpen: false,
};

export const createUiSlice: StateCreator<
    LooperStore,
    [],
    [],
    UiSlice
> = (set, get) => ({
    ui: { ...DEFAULT_UI },

    setModal: (modal: ModalDialog) => {
        set(state => ({
            ui: { ...state.ui, activeModal: modal },
        }));
    },

    closeModal: () => {
        set(state => ({
            ui: { ...state.ui, activeModal: { type: "none" } },
        }));
    },

    setEditorPanel: (panel: EditorPanel, moduleId?: string, trackIndex?: number) => {
        set(state => ({
            ui: {
                ...state.ui,
                activeEditorPanel: panel,
                editingModuleId: moduleId ?? null,
                editingTrackIndex: trackIndex ?? null,
            },
        }));
    },

    closeEditor: () => {
        set(state => ({
            ui: {
                ...state.ui,
                activeEditorPanel: { type: "none" },
                editingModuleId: null,
                editingTrackIndex: null,
            },
        }));
    },

    setCanvasView: (view: Partial<CanvasViewState>) => {
        set(state => ({
            ui: {
                ...state.ui,
                canvasView: { ...state.ui.canvasView, ...view },
            },
        }));
    },

    setMidiLearnTarget: (target: string | null) => {
        set(state => ({
            ui: { ...state.ui, midiLearnTarget: target },
        }));
    },

    toggleClipBrowser: () => {
        set(state => ({
            ui: { ...state.ui, clipBrowserOpen: !state.ui.clipBrowserOpen },
        }));
    },

    toggleRightPanel: () => {
        set(state => ({
            ui: { ...state.ui, rightPanelVisible: !state.ui.rightPanelVisible },
        }));
    },

    setLyrics: (text: string) => {
        set(state => ({
            ui: { ...state.ui, lyrics: text },
        }));
    },

    assignLyricsToSection: (sectionId: string | null) => {
        set(state => ({
            ui: { ...state.ui, lyricsSectionId: sectionId },
        }));
    },

    toggleLockSize: () => {
        set(state => {
            const next = !state.ui.canvasLockSize;
            console.log('[Lock] Size lock:', next);
            return { ui: { ...state.ui, canvasLockSize: next } };
        });
    },

    toggleLockPosition: () => {
        set(state => {
            const nextPos = !state.ui.canvasLockPosition;
            const nextSize = !nextPos ? state.ui.canvasLockSize : true;
            console.log('[Lock] Position lock:', nextPos, 'Size lock:', nextSize);
            return {
                ui: {
                    ...state.ui,
                    canvasLockPosition: nextPos,
                    canvasLockSize: nextSize,
                },
            };
        });
    },

    toggleLockBoth: () => {
        set(state => {
            const both = state.ui.canvasLockSize && state.ui.canvasLockPosition;
            const next = !both;
            console.log('[Lock] Both lock:', next);
            return {
                ui: {
                    ...state.ui,
                    canvasLockSize: next,
                    canvasLockPosition: next,
                },
            };
        });
    },

    setAssigningModule: (moduleId: string | null) => {
        set(state => ({
            ui: { ...state.ui, assigningModuleId: moduleId },
        }));
    },

    openMidiEditor: (moduleId: string, trackIndex: number) => {
        set(state => ({
            ui: {
                ...state.ui,
                midiEditorOpen: true,
                midiEditorModuleId: moduleId,
                midiEditorTrackIndex: trackIndex,
            },
        }));
    },

    closeMidiEditor: () => {
        set(state => ({
            ui: {
                ...state.ui,
                midiEditorOpen: false,
                midiEditorModuleId: null,
                midiEditorTrackIndex: null,
            },
        }));
    },

    toggleDrumBrowser: () => {
        set(state => ({
            ui: { ...state.ui, drumBrowserOpen: !state.ui.drumBrowserOpen },
        }));
    },
});
