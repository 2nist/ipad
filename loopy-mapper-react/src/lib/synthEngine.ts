// ═══════════════════════════════════════════════════════════════════
// SYNTH ENGINE — Tone.js PolySynth wrapper for MidiClipSource
// and LiveMidiSource rendering
// ═══════════════════════════════════════════════════════════════════

import * as Tone from "tone";
import type {
    SoundEngine, ToneJsPolySynthEngine, SamplerEngine, MidiOutEngine,
    MidiEvent,
} from "../types";

export type SynthVoiceId = string; // `${moduleId}:${trackIndex}`
export type SynthCallback = (voiceId: SynthVoiceId, event: "noteOn" | "noteOff", note: number, velocity: number) => void;

/**
 * Manages a pool of Tone.js PolySynth voices, one per module track
 * that uses a MIDI sound source (MidiClipSource or LiveMidiSource).
 */
export class SynthEngine {
    private audioContext: AudioContext | null = null;
    private voices: Map<SynthVoiceId, Tone.PolySynth | Tone.Sampler> = new Map();
    private gains: Map<SynthVoiceId, Tone.Gain> = new Map();
    private masterGain: Tone.Gain | null = null;
    private output: Tone.ToneAudioNode | null = null;
    private initialized = false;
    private onNoteCallback: SynthCallback | null = null;

    constructor() {}

    /** Register a callback for note events (for UI visualization). */
    onNote(callback: SynthCallback): void {
        this.onNoteCallback = callback;
    }

    /** Initialize shared audio graph. Must be called from a user gesture. */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await Tone.start();
        this.audioContext = Tone.getContext().rawContext as AudioContext;

        // Master gain for the entire synth engine
        this.masterGain = new Tone.Gain(0.8).toDestination();
        this.output = this.masterGain;

        this.initialized = true;
        console.log("[SynthEngine] Initialized");
    }

    /** Get the shared AudioContext. */
    getAudioContext(): AudioContext | null {
        return this.audioContext;
    }

    /**
     * Create or update a synth voice for a specific module track.
     * Called when a module track's sound engine config changes.
     */
    setVoice(
        voiceId: SynthVoiceId,
        engine: SoundEngine,
        volume: number = 0.8,
    ): void {
        // Clean up existing voice for this ID
        this.removeVoice(voiceId);

        if (!this.initialized || !this.output || !this.masterGain) return;

        switch (engine.type) {
            case "tonejsPolySynth": {
                const config = engine.synthConfig;
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: {
                        type: config?.oscillatorType ?? "triangle",
                    },
                    envelope: {
                        attack: config?.attack ?? 0.005,
                        decay: config?.decay ?? 0.1,
                        sustain: config?.sustain ?? 0.3,
                        release: config?.release ?? 0.5,
                    },
                });
                const gain = new Tone.Gain(volume);
                synth.connect(gain);
                gain.connect(this.masterGain);

                this.voices.set(voiceId, synth);
                this.gains.set(voiceId, gain);
                break;
            }

            case "sampler": {
                // Build a Tone.Sampler from the sampleMap
                // sampleMap is { midiNote: sampleUrl }
                const samplerEngine = engine as import("../types").SamplerEngine;
                const urls: Record<string, string> = {};

                // Convert MIDI note numbers to Tone.js note names (C2, D#2, etc.)
                const midiToNote = (midi: number): string => {
                    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                    const octave = Math.floor(midi / 12) - 1;
                    const noteIndex = midi % 12;
                    return `${notes[noteIndex]}${octave}`;
                };

                for (const [midiNote, sampleUrl] of Object.entries(samplerEngine.sampleMap)) {
                    const noteName = midiToNote(Number(midiNote));
                    // Skip empty URLs — they cause Tone.Sampler fetch errors
                    if (sampleUrl && sampleUrl.length > 0) {
                        urls[noteName] = sampleUrl;
                    }
                }

                // Only create a sampler if there are real sample URLs
                if (Object.keys(urls).length > 0) {
                    const sampler = new Tone.Sampler({
                        urls,
                        baseUrl: "",
                        onload: () => {
                            console.log(`[SynthEngine] Sampler loaded for ${voiceId}`);
                        },
                    });

                    const gain = new Tone.Gain(volume);
                    sampler.connect(gain);
                    gain.connect(this.masterGain!);

                    this.voices.set(voiceId, sampler);
                    this.gains.set(voiceId, gain);
                } else {
                    // No samples yet — don't create a voice. The voice will be created
                    // when the user assigns a sample through the UI (via OUT menu).
                    console.log(`[SynthEngine] No samples for ${voiceId} — voice deferred until sample assignment`);
                }
                break;
            }

            case "midiOut": {
                // MidiOut engine — routes to external hardware
                // Handled by MidiRouter, not SynthEngine
                console.log(`[SynthEngine] midiOut engine for ${voiceId} — external routing`);
                break;
            }
        }
    }

    /** Remove a synth voice (when a track or module is removed). */
    removeVoice(voiceId: SynthVoiceId): void {
        const synth = this.voices.get(voiceId);
        if (synth) {
            try { synth.dispose(); } catch { /* ignore */ }
            this.voices.delete(voiceId);
        }
        const gain = this.gains.get(voiceId);
        if (gain) {
            try { gain.dispose(); } catch { /* ignore */ }
            this.gains.delete(voiceId);
        }
    }

    /** Play a note on a specific voice. */
    noteOn(voiceId: SynthVoiceId, note: number | string, velocity: number = 0.8, time?: number): void {
        const synth = this.voices.get(voiceId);
        if (!synth) return;

        const noteName = typeof note === "number" ? this.midiToNote(note) : note;
        try {
            synth.triggerAttack(noteName, time, velocity);
        } catch (err) {
            // Tone.Sampler throws if its buffer hasn't loaded yet — not
            // recovering here would crash React and blank the screen.
            console.warn(`[SynthEngine] triggerAttack failed for ${voiceId} (sample may not be loaded):`, err);
            return;
        }
        this.onNoteCallback?.(voiceId, "noteOn", typeof note === "number" ? note : 60, velocity);
    }

    /** Release a note on a specific voice. */
    noteOff(voiceId: SynthVoiceId, note: number | string, time?: number): void {
        const synth = this.voices.get(voiceId);
        if (!synth) return;

        const noteName = typeof note === "number" ? this.midiToNote(note) : note;
        try {
            synth.triggerRelease(noteName, time);
        } catch {
            // Silently ignore — if triggerAttack was also blocked, there's nothing to release.
        }
        this.onNoteCallback?.(voiceId, "noteOff", typeof note === "number" ? note : 60, 0);
    }

    /** Release ALL held notes on a specific voice. */
    allNotesOff(voiceId: SynthVoiceId): void {
        const synth = this.voices.get(voiceId);
        if (!synth) return;
        synth.releaseAll();
    }

    /** Set volume for a specific voice (0.0 – 1.0). */
    setVoiceVolume(voiceId: SynthVoiceId, volume: number): void {
        const gain = this.gains.get(voiceId);
        if (!gain) return;
        const now = this.audioContext?.currentTime ?? 0;
        gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), now + 0.05);
    }

    /** Set master volume (0.0 – 1.0). */
    setMasterVolume(volume: number): void {
        if (!this.masterGain) return;
        const now = this.audioContext?.currentTime ?? 0;
        this.masterGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), now + 0.05);
    }

    /**
     * Play a sequence of MIDI events through a voice (for MidiClipSource playback).
     * Uses Tone.js Transport for playback timing.
     */
    playSequence(voiceId: SynthVoiceId, events: MidiEvent[], loop: boolean = false): void {
        const synth = this.voices.get(voiceId);
        if (!synth || events.length === 0) return;

        // Schedule each event relative to the Tone.js Transport position
        let currentTime = 0;
        for (const event of events) {
            currentTime += event.deltaTime;

            if (event.type === "noteOn") {
                const noteName = this.midiToNote(event.note);
                Tone.Transport.schedule((time: number) => {
                    synth.triggerAttack(noteName, time, event.velocity / 127);
                }, `+${currentTime}`);
            } else {
                const noteName = this.midiToNote(event.note);
                Tone.Transport.schedule((time: number) => {
                    synth.triggerRelease(noteName, time);
                }, `+${currentTime}`);
            }
        }

        if (loop) {
            // Schedule loop end -> restart
            Tone.Transport.schedule((_time: number) => {
                this.playSequence(voiceId, events, true);
            }, `+${currentTime}`);
        }
    }

    /**
     * Check whether a sampler voice has finished loading its buffers.
     * Returns true for PolySynth voices (they don't need loading) and samplers
     * whose onload callback has fired.
     */
    isVoiceReady(voiceId: SynthVoiceId): boolean {
        const synth = this.voices.get(voiceId);
        if (!synth) return false;
        // PolySynth instances are always ready; Sampler instances expose .loaded
        if (synth instanceof Tone.PolySynth) return true;
        if (synth instanceof Tone.Sampler) return (synth as any).loaded === true;
        return false;
    }

    /** Stop all scheduled events for a voice. */
    stopSequence(voiceId: SynthVoiceId): void {
        const synth = this.voices.get(voiceId);
        if (!synth) return;
        synth.releaseAll();
        // Note: Tone.Transport scheduled events continue — the caller should
        // manage Tone.Transport lifecycle at a higher level
    }

    /** Convert MIDI note number to note name (e.g., 60 → "C4"). */
    private midiToNote(midi: number): string {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return `${notes[noteIndex]}${octave}`;
    }

    /** Get the count of active voices. */
    get voiceCount(): number {
        return this.voices.size;
    }

    /** Check if initialized. */
    get isInitialized(): boolean {
        return this.initialized;
    }

    /** Clean up all resources. */
    dispose(): void {
        for (const [id] of this.voices) {
            this.removeVoice(id);
        }
        if (this.masterGain) {
            try { this.masterGain.dispose(); } catch { /* ignore */ }
            this.masterGain = null;
        }
        this.output = null;
        this.initialized = false;
        console.log("[SynthEngine] Disposed");
    }
}

/** Singleton synth engine instance. */
export const synthEngine = new SynthEngine();
