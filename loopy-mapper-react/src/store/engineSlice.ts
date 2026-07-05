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
        looperEngine: unknown | null; // LooperEngine — kept as unknown due to Tone.js type issues
        clockEngine: TransportClockImpl | null;
        midiRouter: MidiRouter | null;
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
            // Step 1: Create AudioContext (requires user gesture)
            const audioContext = new AudioContext();
            const sampleRate = audioContext.sampleRate;

            // Step 2: Load AudioWorklet processor
            try {
                await audioContext.audioWorklet.addModule('/looper-processor.js');
            } catch {
                // Try blob fallback
                const blob = new Blob([
                    `// Inline looper-processor fallback
                    class LooperProcessor extends AudioWorkletProcessor {
                        constructor() { super(); this.buffer = null; this.isRecording = false; this.isPlaying = false; this.playIndex = 0; this.loopLength = 0;
                            this.port.onmessage = (e) => {
                                const msg = e.data;
                                if (msg.type === 'record_start') this.startRecording();
                                else if (msg.type === 'record_stop') this.stopRecording();
                                else if (msg.type === 'play_start') this.startPlayback();
                                else if (msg.type === 'play_stop') this.stopPlayback();
                                else if (msg.type === 'clear') this.clearBuffer();
                                else if (msg.type === 'get_state') this.port.postMessage({ type: 'state', isRecording: this.isRecording, isPlaying: this.isPlaying, loopLength: this.loopLength });
                            };
                        }
                        startRecording() { this.buffer = new Float32Array(sampleRate * 30); this.isRecording = true; this.isPlaying = false; this.playIndex = 0; this.loopLength = 0; }
                        stopRecording() { if (this.isRecording) { this.isRecording = false; this.loopLength = this.playIndex; this.playIndex = 0; this.isPlaying = true; } }
                        startPlayback() { this.isPlaying = true; this.playIndex = 0; }
                        stopPlayback() { this.isPlaying = false; }
                        clearBuffer() { this.buffer = null; this.isRecording = false; this.isPlaying = false; this.playIndex = 0; this.loopLength = 0; }
                        process(inputs, outputs) {
                            if (this.isRecording && inputs[0]?.[0]) {
                                const input = inputs[0][0];
                                if (!this.buffer) this.buffer = new Float32Array(sampleRate * 30);
                                for (let i = 0; i < input.length && this.playIndex < this.buffer.length; i++) {
                                    this.buffer[this.playIndex++] = input[i];
                                }
                            }
                            if (this.isPlaying && this.buffer && this.loopLength > 0) {
                                const output = outputs[0]?.[0];
                                if (output) {
                                    for (let i = 0; i < output.length; i++) {
                                        output[i] = this.buffer[this.playIndex % this.loopLength];
                                        this.playIndex = (this.playIndex + 1) % this.loopLength;
                                    }
                                }
                            }
                            return true;
                        }
                    }
                    registerProcessor('looper-processor', LooperProcessor);`
                ], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                await audioContext.audioWorklet.addModule(url);
                URL.revokeObjectURL(url);
            }

            // Step 3: Store the initialized AudioContext (LooperEngine/SynthEngine init separately)
            const looperEngine = { type: 'looper', initialized: true, sampleRate };

            // Step 4: Initialize MIDI if available
            let midiRouter: MidiRouter | null = null;
            try {
                const midiAccess = await navigator.requestMIDIAccess();
                // MidiRouter will be fully initialized in useEngineInitialization
                // after the SynthEngine and TransportClock are created
                midiRouter = null; // placeholder — actual MidiRouter created in hook
                set(state => ({
                    ui: { ...state.ui, midiDeviceConnected: true },
                }));
            } catch {
                console.log('WebMIDI not available');
            }

            set({
                engines: {
                    audioContext,
                    looperEngine,
                    clockEngine: null, // Clock engine created separately in hook
                    midiRouter,
                    initialized: true,
                },
                ui: { ...get().ui, audioInitialized: true },
            });
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
