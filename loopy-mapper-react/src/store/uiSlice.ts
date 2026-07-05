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

export const createUiSlice: StateCreator<
    LooperStore,
    [],
    [],
    UiSlice
> = (set, get) => ({
    ui: {
        activeModal: { type: "none" },
        activeEditorPanel: { type: "none" },
        editingModuleId: null,
        editingTrackIndex: null,
        clipBrowserOpen: false,
        sidebarVisible: true,
        rightPanelVisible: false,
        lyrics: "",
        lyricsSectionId: null,
        canvasView: { ...DEFAULT_CANVAS_VIEW },
        midiLearnTarget: null,
        midiActivity: false,
        midiDeviceConnected: false,
        audioInitialized: false,
    },

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
});
