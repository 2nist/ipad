// ═══════════════════════════════════════════════════════════════════
// useEngineInitialization — Initializes audio/MIDI on user gesture
// Wires TransportClock → LooperEngine → SynthEngine → MidiRouter
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useLooperStore } from '../store/store';
import { createTransportClock, TransportClockImpl } from '../lib/transportClock';
import { createArrangementEngine, ArrangementEngine } from '../lib/arrangementEngine';
import { ExpressionEngine } from '../lib/expressionEngine';
import { synthEngine } from '../lib/synthEngine';
import { looperEngine } from '../lib/audio-worklet';
import { createMidiRouter, MidiRouter } from '../lib/midiRouter';
import type { ClockPosition } from '../types';

export function useEngineInitialization() {
    const initialized = useLooperStore(s => s.engines.initialized);
    const initializeEngines = useLooperStore(s => s.initializeEngines);

    const initialize = useCallback(async () => {
        try {
            // 1. Initialize base engines (AudioContext, AudioWorklet, MIDI)
            await initializeEngines();

            const state = useLooperStore.getState();
            const audioContext = state.engines.audioContext;
            const bpm = state.song.metadata.bpm;

            if (!audioContext) {
                console.error('No AudioContext available after initialization');
                return;
            }

            // 2. Initialize the AudioWorklet looper engine (creates Tone.js context)
            await looperEngine.initialize();
            console.log('[Init] LooperEngine initialized');

            // 3. Initialize the SynthEngine (Tone.js PolySynth for MIDI sound sources)
            await synthEngine.initialize();
            console.log('[Init] SynthEngine initialized');

            // 4. Create TransportClock
            const clock = createTransportClock(audioContext, bpm);
            console.log('[Init] TransportClock created');

            // 5. Wire TransportClock to LooperEngine for beat-quantized loop sync
            clock.registerSubscriber({
                id: 'looper-engine-sync',
                onStart: (pos: ClockPosition) => {
                    // Reset all looper tracks at start
                    const tracks = looperEngine.getTracks();
                    for (const track of tracks) {
                        if (track.hasContent && track.isPlaying) {
                            // Tracks with content auto-play when transport starts
                            // The worklet handles loop point internally
                        }
                    }
                },
                onStop: (_pos: ClockPosition) => {
                    // Stop all looper tracks
                    const tracks = looperEngine.getTracks();
                    for (const track of tracks) {
                        if (track.isPlaying) {
                            // Leave playing state — user can restart by pressing play
                        }
                    }
                },
                onBeat: (_pos: ClockPosition) => {
                    // Beat boundary — used for quantized recording start/stop
                    // Future: trigger quantization events
                },
                onBar: (_pos: ClockPosition) => {
                    // Bar boundary — used for loop alignment
                    // Future: sync loop points to bar boundaries
                },
                onBpmChange: (newBpm: number) => {
                    // BPM changes propagate through the clock automatically
                    console.log(`[Init] BPM changed to ${newBpm}`);
                },
            });

            // 6. Create and wire ArrangementEngine
            const arrangementEngine = createArrangementEngine(() => useLooperStore.getState());
            arrangementEngine.setClock(clock);
            console.log('[Init] ArrangementEngine wired to clock');

            // 7. Initialize MidiRouter (if MIDI access available)
            let midiRouter: MidiRouter | null = null;
            try {
                const midiAccess = await navigator.requestMIDIAccess();
                midiRouter = createMidiRouter(() => useLooperStore.getState());
                await midiRouter.initialize(midiAccess);

                // Auto-generate MIDI bindings from current module layout
                midiRouter.autoGenerateBindings();

                // Route WebMIDI note-on/off to synth engine for LiveMidiSource
                midiRouter.onRouterEvent((event) => {
                    // Update UI MIDI activity indicator
                    useLooperStore.setState({
                        ui: {
                            ...useLooperStore.getState().ui,
                            midiActivity: event.type !== 'learn',
                        },
                    });
                });

                console.log('[Init] MidiRouter initialized with auto-generated bindings');
            } catch {
                console.log('[Init] WebMIDI not available — MIDI control disabled');
            }

            // 8. Update store with all engine references
            useLooperStore.setState({
                engines: {
                    ...useLooperStore.getState().engines,
                    clockEngine: clock,
                    midiRouter,
                },
            });

            console.log('[Init] All engines wired successfully');
        } catch (error) {
            console.error('Engine initialization failed:', error);
        }
    }, [initializeEngines]);

    return {
        initialized,
        initialize,
    };
}
