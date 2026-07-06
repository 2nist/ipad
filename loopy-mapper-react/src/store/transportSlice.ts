// ═══════════════════════════════════════════════════════════════════
// TRANSPORT SLICE — Play/stop/record, position tracking, BPM
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import type { ClockPosition, TransitionMode } from '../types';
import type { LooperStoreType } from './store';

export interface TransportSlice {
    transport: {
        isPlaying: boolean;
        isRecording: boolean;
        position: ClockPosition;
        activeSectionId: string | null;
        activeSectionIndex: number;
    };
    globalPlay: () => void;
    globalStop: () => void;
    globalRecord: () => void;
    setBpm: (bpm: number) => void;
    tapTempo: () => void;
    nudgeBpm: (delta: number) => void;
    jumpToSection: (sectionId: string) => void;
    nextSection: () => void;
    previousSection: () => void;
    setTransitionMode: (mode: TransitionMode) => void;
}

const DEFAULT_POSITION: ClockPosition = {
    absoluteBeat: 0,
    barInSection: 0,
    beatInBar: 0,
    tickInBeat: 0,
    sectionId: "",
    beatInSection: 0,
    elapsedBeatsInSection: 0,
    remainingBeatsInSection: 0,
};

// Single source of truth for a reset transport state — reused by songSlice's
// newSong/loadSong so the reset shape can't drift from the initial state.
export const DEFAULT_TRANSPORT: TransportSlice['transport'] = {
    isPlaying: false,
    isRecording: false,
    position: { ...DEFAULT_POSITION },
    activeSectionId: null,
    activeSectionIndex: 0,
};

// Track last 5 tap timestamps for tap tempo
let tapTempoHistory: number[] = [];

export const createTransportSlice: StateCreator<
    LooperStoreType,
    [],
    [],
    TransportSlice
> = (set, get) => ({
    transport: { ...DEFAULT_TRANSPORT, position: { ...DEFAULT_POSITION } },

    globalPlay: () => {
        const { engines } = get();
        const isPlaying = get().transport.isPlaying;

        if (isPlaying) {
            // Stop
            engines.clockEngine?.stop();
            set({ transport: { ...get().transport, isPlaying: false } });
        } else {
            // Guard: don't claim we're playing if there's no clock to actually drive playback.
            // Without this, a play press before engine init finishes (or a silently failed
            // init) flips isPlaying to true with nothing behind it.
            if (!engines.clockEngine) {
                console.warn('[Transport] globalPlay called before engines were initialized — ignoring.');
                return;
            }

            const sections = get().song.arrangement;
            const activeIndex = get().transport.activeSectionIndex;
            const activeSection = sections[activeIndex] || null;

            // Make sure the clock's internal section bookkeeping (bar count / id) matches
            // the section we're actually about to play, before starting it.
            if (activeSection) {
                engines.clockEngine.setSectionContext(activeSection.bars, activeSection.id);
            }

            engines.clockEngine.start();
            set({
                transport: {
                    ...get().transport,
                    isPlaying: true,
                    activeSectionId: activeSection?.id || null,
                    activeSectionIndex: activeIndex,
                },
            });
        }
    },

    globalStop: () => {
        const { engines } = get();
        engines.clockEngine?.stop();
        set({
            transport: {
                isPlaying: false,
                isRecording: false,
                position: { ...DEFAULT_POSITION },
                activeSectionId: null,
                activeSectionIndex: 0,
            },
        });
    },

    globalRecord: () => {
        const isRecording = get().transport.isRecording;
        // If not playing, start playing and recording
        if (!get().transport.isPlaying) {
            get().globalPlay();
        }
        set({
            transport: {
                ...get().transport,
                isRecording: !isRecording,
            },
        });
    },

    setBpm: (bpm: number) => {
        const clamped = Math.min(200, Math.max(60, bpm));
        get().setSongMetadata({ bpm: clamped });
        get().engines.clockEngine?.setBpm(clamped);
    },

    tapTempo: () => {
        const now = Date.now();
        tapTempoHistory.push(now);

        // Keep only last 5 taps
        if (tapTempoHistory.length > 5) {
            tapTempoHistory.shift();
        }

        if (tapTempoHistory.length < 2) return;

        // Calculate average interval between taps
        const intervals: number[] = [];
        for (let i = 1; i < tapTempoHistory.length; i++) {
            intervals.push(tapTempoHistory[i] - tapTempoHistory[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // Convert ms interval to BPM
        const bpm = Math.min(200, Math.max(60, Math.round(60000 / avgInterval)));
        get().setBpm(bpm);

        // Reset after 2 seconds of inactivity
        setTimeout(() => {
            if (tapTempoHistory.length > 0 && Date.now() - tapTempoHistory[tapTempoHistory.length - 1] > 2000) {
                tapTempoHistory = [];
            }
        }, 2000);
    },

    nudgeBpm: (delta: number) => {
        const current = get().song.metadata.bpm;
        get().setBpm(current + delta);
    },

    jumpToSection: (sectionId: string) => {
        const sections = get().song.arrangement;
        const index = sections.findIndex(s => s.id === sectionId);
        if (index === -1) return;

        const section = sections[index];

        // Keep the clock's own section-relative bookkeeping (currentSectionBars /
        // currentSectionId) in sync — previously nothing ever called this, so the
        // clock always wrapped every 8 bars regardless of actual section length,
        // and this store update got overwritten by the next onTick from the clock.
        const { engines } = get();
        engines.clockEngine?.setSectionContext(section.bars, section.id);

        set({
            transport: {
                ...get().transport,
                activeSectionId: sectionId,
                activeSectionIndex: index,
                position: {
                    ...get().transport.position,
                    sectionId,
                    barInSection: 0,
                    beatInBar: 0,
                    beatInSection: 0,
                    elapsedBeatsInSection: 0,
                    remainingBeatsInSection: section.bars * (get().song.metadata.timeSignature.numerator * (4 / get().song.metadata.timeSignature.denominator)),
                },
            },
        });
    },

    nextSection: () => {
        const sections = get().song.arrangement;
        const currentIndex = get().transport.activeSectionIndex;
        if (currentIndex < sections.length - 1) {
            get().jumpToSection(sections[currentIndex + 1].id);
        } else if (sections.length > 0) {
            // Loop to first section
            get().jumpToSection(sections[0].id);
        }
    },

    previousSection: () => {
        const sections = get().song.arrangement;
        const currentIndex = get().transport.activeSectionIndex;
        if (currentIndex > 0) {
            get().jumpToSection(sections[currentIndex - 1].id);
        } else if (sections.length > 0) {
            get().jumpToSection(sections[sections.length - 1].id);
        }
    },

    setTransitionMode: (mode: TransitionMode) => {
        const sectionId = get().transport.activeSectionId;
        if (sectionId) {
            get().updateSection(sectionId, { transition: mode });
        }
    },
});