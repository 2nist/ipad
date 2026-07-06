// ═══════════════════════════════════════════════════════════════════
// ENGINE SLICE — AudioContext, TransportClock, SynthEngine, MidiRouter lifecycle
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import type { LooperStore } from '../types';
import { type TransportClockImpl } from '../lib/transportClock';
import { type MidiRouter } from '../lib/midiRouter';

export interface EngineSlice {
    engines: {
        audioContext: AudioContext | null;
        looperEngine: unknown | null;
        clockEngine: unknown | null;
        midiRouter: unknown | null;
        initialized: boolean;
    };
    initializeEngines: () => Promise<void>;
    suspendEngines: () => void;
    resumeEngines: () => void;
}

export const createEngineSlice: StateCreator<
    LooperStore,
    [],
    [],
    EngineSlice
> = (set, get) => ({
    engines: {
        audioContext: null,
        looperEngine: null,
        clockEngine: null,
        midiRouter: null,
        initialized: false,
    },

    initializeEngines: async () => {
        try {
            // Step 1: Request MIDI access early (may prompt user)
            let midiAccess: MIDIAccess | null = null;
            try {
                midiAccess = await navigator.requestMIDIAccess();
                set(state => ({
                    ui: { ...state.ui, midiDeviceConnected: true },
                }));
            } catch {
                console.log('[EngineSlice] WebMIDI not available');
            }

            // Step 2: Mark initialized — actual engine creation happens in useEngineInitialization hook
            // which wires SynthEngine, TransportClock, LooperEngine, and MidiRouter together
            // using a shared AudioContext from Tone.js
            set({
                engines: {
                    audioContext: null, // Will be set after Tone.start() in the hook
                    looperEngine: null,
                    clockEngine: null,
                    midiRouter: null,
                    initialized: true,
                },
                ui: { ...get().ui, audioInitialized: true },
            });

            console.log('[EngineSlice] Initialization scaffolded. MIDI available:', !!midiAccess);
        } catch (error) {
            console.error('Failed to initialize engines:', error);
            throw error;
        }
    },

    suspendEngines: () => {
        const { audioContext } = get().engines;
        if (audioContext?.state === 'running') {
            audioContext.suspend();
        }
    },

    resumeEngines: () => {
        const { audioContext } = get().engines;
        if (audioContext?.state === 'suspended') {
            audioContext.resume();
        }
    },
});
