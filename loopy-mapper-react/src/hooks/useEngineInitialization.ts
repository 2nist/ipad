// ═══════════════════════════════════════════════════════════════════
// useEngineInitialization — Single entry point for audio/MIDI init
// 1. Calls store.initializeEngines() (MIDI access request)
// 2. Starts Tone.js → gets shared AudioContext
// 3. Initializes LooperEngine + SynthEngine
// 4. Creates TransportClock
// 5. Wires ArrangementEngine to clock
// 6. Sets up MidiRouter
// 7. Creates synth voices for all existing module tracks
// 8. Stores engine references back into the store
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import * as Tone from 'tone';
import { useLooperStore } from '../store/store';
import { createTransportClock, TransportClockImpl } from '../lib/transportClock';
import { createArrangementEngine, ArrangementEngine } from '../lib/arrangementEngine';
import { ExpressionEngine, createExpressionEngine } from '../lib/expressionEngine';
import { synthEngine } from '../lib/synthEngine';
import { looperEngine } from '../lib/audio-worklet';
import { createMidiRouter, MidiRouter } from '../lib/midiRouter';
import type { ClockPosition } from '../types';

export function useEngineInitialization() {
    const initialized = useLooperStore(s => s.engines.initialized);
    const initializeEngines = useLooperStore(s => s.initializeEngines);

    const initialize = useCallback(async () => {
        try {
            // Step 1: Mark initialized in store (requests MIDI access)
            await initializeEngines();

            // Step 2: Start Tone.js — this creates the shared AudioContext
            await Tone.start();
            const audioContext = Tone.getContext().rawContext as AudioContext;
            console.log('[Init] Tone.js started, AudioContext:', audioContext.state);

            // Step 3: Initialize LooperEngine (AudioWorklet) with the shared AudioContext
            await looperEngine.initialize(audioContext);
            console.log('[Init] LooperEngine initialized');

            // Step 4: Initialize SynthEngine (Tone.js PolySynth)
            await synthEngine.initialize();
            console.log('[Init] SynthEngine initialized');

            // Step 5: Create TransportClock
            const store = useLooperStore.getState();
            const bpm = store.song.metadata.bpm;
            const clock = createTransportClock(audioContext, bpm);
            console.log('[Init] TransportClock created');

            // Step 6: Wire TransportClock to LooperEngine + SynthEngine
            // Metronome state
            let beatCount = 0;
            const metronomeOnBeat0Note = 72; // High C (accent beat 1)
            const metronomeOtherBeatNote = 60; // Middle C (weak beats)

            // Track active pattern sequences for cleanup on stop/pause
            const activeSequenceVoices = new Set<string>();

            const scheduleTrackPatterns = () => {
                const store = useLooperStore.getState();
                const modules = store.song.modules;

                for (const mod of modules) {
                    if (mod.type === 'arrangement') continue;

                    for (const track of mod.tracks) {
                        const voiceId = `${mod.id}:${track.index}`;
                        const src = track.soundSource;

                        // Skip audio input tracks — they don't have sequenced patterns
                        if (src.type === 'audioInput') continue;

                        // Check for stored sequencer pattern data (clipData on midiClip sources)
                        const clipData = (src as any).clipData as ArrayBuffer | undefined;
                        if (!clipData || clipData.byteLength === 0) continue;

                        try {
                            const decoded = new TextDecoder().decode(clipData);
                            const events = JSON.parse(decoded) as Array<{
                                deltaTime: number;
                                type: 'noteOn' | 'noteOff';
                                note: number;
                                velocity: number;
                            }>;

                            if (events.length === 0) continue;

                            // Only (re)create the voice if it doesn't exist yet, to avoid
                            // destroying/recreating Tone.Sampler instances whose buffers are
                            // already loaded.
                            if (!synthEngine.isVoiceReady(voiceId)) {
                                synthEngine.setVoice(voiceId, src.soundEngine, track.volume);
                            }

                            // Stop any existing sequence for this voice first
                            synthEngine.stopSequence(voiceId);

                            // Schedule the pattern for looping playback via Tone.Transport
                            synthEngine.playSequence(voiceId, events, true);
                            activeSequenceVoices.add(voiceId);
                            console.log(`[Clock] Scheduled pattern for ${voiceId} — ${events.length} events`);
                        } catch (err) {
                            console.warn(`[Clock] Failed to decode pattern for ${voiceId}:`, err);
                        }
                    }
                }
            };

            const stopAllSequences = () => {
                for (const voiceId of activeSequenceVoices) {
                    synthEngine.stopSequence(voiceId);
                }
                activeSequenceVoices.clear();
            };

            clock.registerSubscriber({
                id: 'engine-sync',
                onStart: (_pos: ClockPosition) => {
                    console.log('[Clock] Transport started');
                    beatCount = 0;
                    // Sync initial position to store
                    useLooperStore.setState({
                        transport: {
                            ...useLooperStore.getState().transport,
                            isPlaying: true,
                            position: clock.getPosition(),
                        },
                    });

                    // Schedule all stored track patterns for playback
                    scheduleTrackPatterns();
                },
                onStop: (_pos: ClockPosition) => {
                    console.log('[Clock] Transport stopped');
                    stopAllSequences();
                    useLooperStore.setState({
                        transport: {
                            ...useLooperStore.getState().transport,
                            isPlaying: false,
                            position: clock.getPosition(),
                        },
                    });
                },
                onTick: (pos: ClockPosition) => {
                    // ~40Hz — update store position so TimelineRuler + modules see it
                    useLooperStore.setState({
                        transport: {
                            ...useLooperStore.getState().transport,
                            position: pos,
                        },
                    });
                },
                onBeat: (pos: ClockPosition) => {
                    // Play metronome click through SynthEngine
                    const note = pos.beatInBar === 0
                        ? metronomeOnBeat0Note
                        : metronomeOtherBeatNote;
                    const velocity = pos.beatInBar === 0 ? 0.9 : 0.5;
                    synthEngine.noteOn('__metronome__', note, velocity);
                    setTimeout(() => {
                        synthEngine.noteOff('__metronome__', note);
                    }, 50);
                    beatCount++;

                    // Notify modules on beat boundaries (for quantized actions)
                    const modules = useLooperStore.getState().song.modules;
                    for (const mod of modules) {
                        if (mod.type === 'arrangement') continue;
                        const modPos = mod.position;
                        if (modPos) {
                            const active = pos.absoluteBeat >= modPos.startBeat &&
                                pos.absoluteBeat < modPos.startBeat + modPos.lengthBeats;
                            // Update module active state
                            const current = useLooperStore.getState().moduleStates[mod.id];
                            if (current && current.isActive !== active) {
                                useLooperStore.getState().updateModuleState(mod.id, { isActive: active });
                            }
                        }
                    }
                },
                onBar: (pos: ClockPosition) => {
                    // Bar boundary — trigger arrangement section evaluation
                },
                onBpmChange: (newBpm: number) => {
                    Tone.Transport.bpm.value = newBpm;
                    console.log(`[Clock] BPM synced to ${newBpm}`);
                },
            });

            // Step 7: Create and wire ArrangementEngine
            const arrangementEngine = createArrangementEngine(() => useLooperStore.getState());
            arrangementEngine.setClock(clock);
            console.log('[Init] ArrangementEngine wired to clock');

            // Step 8: Initialize MidiRouter (if MIDI access available)
            let midiRouter: MidiRouter | null = null;
            try {
                const midiAccess = await navigator.requestMIDIAccess();
                midiRouter = createMidiRouter(() => useLooperStore.getState());
                await midiRouter.initialize(midiAccess);
                midiRouter.autoGenerateBindings();

                midiRouter.onRouterEvent((event) => {
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

            // Step 9: Create synth voices for all existing module tracks
            const currentModules = useLooperStore.getState().song.modules;
            for (const module of currentModules) {
                if (module.type === 'arrangement') continue;
                for (const track of module.tracks) {
                    const soundSource = track.soundSource;
                    if (soundSource.type === 'midiClip' || soundSource.type === 'liveMidi') {
                        const voiceId = `${module.id}:${track.index}`;
                        const engine = soundSource.soundEngine;
                        synthEngine.setVoice(voiceId, engine, track.volume);
                    }
                }
            }

            // Create a built-in metronome voice so clicks play through the SynthEngine
            synthEngine.setVoice('__metronome__', {
                type: 'tonejsPolySynth',
                synthConfig: { oscillatorType: 'square', attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
            }, 0.3);
            console.log(`[Init] Created synth voices for ${synthEngine.voiceCount} tracks (including metronome)`);

            // Step 10: Update store with all engine references
            useLooperStore.setState({
                engines: {
                    ...useLooperStore.getState().engines,
                    audioContext,
                    looperEngine,
                    clockEngine: clock,
                    midiRouter,
                },
            });

            console.log('[Init] All engines wired successfully. AudioContext state:', audioContext.state);
        } catch (error) {
            console.error('Engine initialization failed:', error);
        }
    }, [initializeEngines]);

    return {
        initialized,
        initialize,
    };
}