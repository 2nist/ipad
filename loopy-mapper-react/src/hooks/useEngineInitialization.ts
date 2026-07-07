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
import { findControllerProfile, CONTROLLER_PROFILES } from '../lib/controllerPresets';
import { decodeClipDataToSteps } from '../lib/stepPattern';
import type { ClockPosition } from '../types';

export function useEngineInitialization() {
    const initialized = useLooperStore(s => s.engines.initialized);
    const initializeEngines = useLooperStore(s => s.initializeEngines);

    const initialize = useCallback(async () => {
        try {
            // Step 1: Start Tone.js FIRST, before anything else async. This
            // must happen synchronously-ish inside the user gesture that
            // triggered `initialize()` — Chrome's autoplay policy requires
            // AudioContext.resume() to ride the browser's transient
            // user-activation window, which an intervening `await` (like the
            // MIDI permission prompt below) can burn through, especially if
            // it shows its own browser UI. Previously MIDI access was
            // requested first, which left the AudioContext stuck suspended
            // ("AudioContext was not allowed to start") and cascaded into the
            // AudioWorkletNode/Sampler failures downstream. WebMIDI access
            // doesn't need a user gesture, so it's safe to request after.
            await Tone.start();
            const audioContext = Tone.getContext().rawContext as AudioContext;
            console.log('[Init] Tone.js started, AudioContext:', audioContext.state);

            // Step 2: Mark initialized in store (requests MIDI access)
            await initializeEngines();

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

                        // Only midiClip and sample sources carry a step-sequencer pattern
                        // (clipData); audioInput/liveMidi have no such field.
                        if (src.type !== 'midiClip' && src.type !== 'sample') continue;

                        const initialSteps = decodeClipDataToSteps(src.clipData);
                        if (!initialSteps.some(s => s.active)) continue;

                        // Only (re)create the voice if it doesn't exist yet, to avoid
                        // destroying/recreating Tone.Sampler instances whose buffers are
                        // already loaded.
                        if (!synthEngine.isVoiceReady(voiceId)) {
                            synthEngine.setVoice(voiceId, src.soundEngine, track.volume);
                        }

                        // getSteps re-reads the store fresh on every 16th-note tick (not
                        // just once at schedule time), so an edit auto-saved by the
                        // sequencer panel is picked up on its very next tick — no explicit
                        // re-scheduling needed when the user edits a pad while it plays.
                        synthEngine.startPatternLoop(voiceId, track.midiNote, () => {
                            const liveTrack = useLooperStore.getState().song.modules
                                .find(m => m.id === mod.id)?.tracks[track.index];
                            const liveSrc = liveTrack?.soundSource;
                            if (!liveSrc || (liveSrc.type !== 'midiClip' && liveSrc.type !== 'sample')) return [];
                            return decodeClipDataToSteps(liveSrc.clipData);
                        });
                        activeSequenceVoices.add(voiceId);
                        console.log(`[Clock] Scheduled pattern loop for ${voiceId}`);
                    }
                }
            };

            const stopAllSequences = () => {
                for (const voiceId of activeSequenceVoices) {
                    synthEngine.stopPatternLoop(voiceId);
                }
                activeSequenceVoices.clear();
            };

            // ── Metronome on the AUDIO clock, not requestAnimationFrame ──
            // Firing clicks from the rAF onBeat callback made them land on
            // whatever frame happened to detect the beat crossing — up to a
            // full (dropped) frame late. That jitter is the "speeding up /
            // slowing down". Tone.Transport.scheduleRepeat runs on the audio
            // thread and passes an exact `time`, so clicks are sample-accurate
            // and stay locked to the patterns (which already use Transport).
            let metronomeEventId: number | null = null;

            const startMetronome = () => {
                if (metronomeEventId !== null) {
                    Tone.Transport.clear(metronomeEventId);
                    metronomeEventId = null;
                }
                let beat = 0;
                metronomeEventId = Tone.Transport.scheduleRepeat((time) => {
                    const state = useLooperStore.getState();
                    const ts = state.song.metadata.timeSignature;
                    const beatsPerBar = ts.numerator * (4 / ts.denominator);
                    const isDownbeat = (beat % beatsPerBar) === 0;
                    beat++;
                    // Advance the beat counter unconditionally so re-enabling
                    // mid-playback still lands the accent on the downbeat.
                    if (!state.metronome.enabled) return;
                    const note = isDownbeat ? metronomeOnBeat0Note : metronomeOtherBeatNote;
                    const velocity = isDownbeat ? 0.9 : 0.5;
                    // Pass the scheduled `time` so both attack and release are
                    // placed precisely on the audio timeline.
                    synthEngine.noteOn('__metronome__', note, velocity, time);
                    synthEngine.noteOff('__metronome__', note, time + 0.05);
                }, '4n', 0);
            };

            const stopMetronome = () => {
                if (metronomeEventId !== null) {
                    Tone.Transport.clear(metronomeEventId);
                    metronomeEventId = null;
                }
            };

            // Throttle store position writes to ~30Hz. Pushing on every rAF
            // frame re-rendered every subscribed component 60×/sec, starving
            // the main thread and causing the very frame drops that made the
            // rAF-timed metronome jitter. 30Hz is plenty smooth for a playhead.
            let lastPositionPush = 0;

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

                    // Start the sample-accurate metronome (audio-clock timed)
                    startMetronome();
                },
                onStop: (_pos: ClockPosition) => {
                    console.log('[Clock] Transport stopped');
                    stopMetronome();
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
                    // Throttle to ~30Hz — pushing every rAF frame re-rendered
                    // all subscribers 60×/sec and caused the frame drops that
                    // jittered timing. See lastPositionPush note above.
                    const now = performance.now();
                    if (now - lastPositionPush < 33) return;
                    lastPositionPush = now;
                    useLooperStore.setState({
                        transport: {
                            ...useLooperStore.getState().transport,
                            position: pos,
                        },
                    });
                },
                onBeat: (pos: ClockPosition) => {
                    // Metronome is scheduled on Tone.Transport (startMetronome),
                    // NOT fired here — rAF beat detection was too jittery.
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

                // Load controller profile if device matches a known preset
                let loadedProfileName: string | null = null;
                const inputNames: string[] = [];
                for (const input of midiAccess.inputs.values()) {
                    const name = input.name ?? "(unnamed)";
                    inputNames.push(name);
                    const profile = findControllerProfile(name);
                    if (profile) {
                        midiRouter.loadProfile(profile.bindings);
                        loadedProfileName = profile.name;
                        console.log(`[Init] Loaded controller profile: ${profile.name} for "${name}"`);
                    }
                }
                console.log(`[Init] MIDI inputs detected: ${inputNames.join(", ") || "none"}`);
                if (!loadedProfileName && inputNames.length > 0) {
                    console.log(`[Init] No controller profile matched. Known profiles: ${
                        CONTROLLER_PROFILES.map(p => p.deviceMatch).join(", ")
                    }. Connected: ${inputNames.join(", ")}`);
                }
                loadedProfileName = loadedProfileName ?? inputNames[0] ?? null;

                midiRouter.onRouterEvent((event) => {
                    useLooperStore.setState({
                        ui: {
                            ...useLooperStore.getState().ui,
                            midiDeviceConnected: true,
                            midiActivity: event.type !== 'learn',
                            connectedMidiDevice: loadedProfileName ?? undefined,
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
            }, useLooperStore.getState().metronome.volume);
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