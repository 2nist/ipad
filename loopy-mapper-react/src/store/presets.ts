// ═══════════════════════════════════════════════════════════════════
// DEFAULT MODULE PRESETS
// ═══════════════════════════════════════════════════════════════════

import type { ModulePreset } from '../types';

const DEFAULT_SYNTH_CONFIG = {
    oscillatorType: "triangle" as const,
    attack: 0.005,
    decay: 0.1,
    sustain: 0.3,
    release: 0.5,
};

export const MODULE_PRESETS: ModulePreset[] = [
    // ── Rhythm Presets ──
    {
        id: "preset-rhythm-4tk",
        name: "Rhythm — 4 Track",
        description: "Standard 4-track rhythm section with MIDI pad control",
        moduleType: "rhythm",
        tags: ["drums", "rhythm", "4-track", "default"],
        defaults: {
            id: "",
            type: "rhythm",
            label: "Drum Kit",
            size: "md",
            colorAccent: "#ef4444",
            bus: "red",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 36,
            isPreset: true,
            presetId: "preset-rhythm-4tk",
            tracks: [
                {
                    index: 0, label: "Kick", midiNote: 36, pan: -0.6, volume: 0.8,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
                {
                    index: 1, label: "Snare", midiNote: 38, pan: 0.2, volume: 0.8,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
                {
                    index: 2, label: "Hi-Hat", midiNote: 42, pan: -0.3, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
                {
                    index: 3, label: "Perc", midiNote: 44, pan: 0.5, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
            ],
        },
    },
    {
        id: "preset-rhythm-2tk",
        name: "Rhythm — 2 Track",
        description: "Compact 2-track rhythm section",
        moduleType: "rhythm",
        tags: ["drums", "rhythm", "2-track", "compact"],
        defaults: {
            id: "",
            type: "rhythm",
            label: "Simple Drums",
            size: "sm",
            colorAccent: "#ef4444",
            bus: "red",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 36,
            isPreset: true,
            presetId: "preset-rhythm-2tk",
            tracks: [
                {
                    index: 0, label: "Kick", midiNote: 36, pan: -0.4, volume: 0.8,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
                {
                    index: 1, label: "Snare", midiNote: 38, pan: 0.4, volume: 0.8,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: { type: "midiClip", clipId: null, soundEngine: { type: "tonejsPolySynth", synthConfig: DEFAULT_SYNTH_CONFIG }, transpose: 0, velocityScale: 1.0 },
                },
            ],
        },
    },
    // ── Harmonic Presets ──
    {
        id: "preset-harmonic-1tk",
        name: "Harmonic — Pad",
        description: "Single-track harmonic pad with chord progression support",
        moduleType: "harmonic",
        tags: ["pad", "harmonic", "chords", "default"],
        defaults: {
            id: "",
            type: "harmonic",
            label: "Pad",
            size: "md",
            colorAccent: "#3b82f6",
            bus: "blue",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 48,
            isPreset: true,
            presetId: "preset-harmonic-1tk",
            tracks: [
                {
                    index: 0, label: "Pad", midiNote: 48, pan: 0, volume: 0.7,
                    actions: [{ actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 100,
                    soundSource: {
                        type: "midiClip", clipId: null,
                        soundEngine: { type: "tonejsPolySynth", synthConfig: { ...DEFAULT_SYNTH_CONFIG, sustain: 0.6, release: 1.5 } },
                        transpose: 0, velocityScale: 0.9,
                        followChordProgression: true,
                    },
                },
            ],
        },
    },
    {
        id: "preset-harmonic-2tk",
        name: "Harmonic — Pad + Lead",
        description: "Two-track harmonic section with pad and lead",
        moduleType: "harmonic",
        tags: ["pad", "lead", "harmonic", "chords"],
        defaults: {
            id: "",
            type: "harmonic",
            label: "Harmonic Section",
            size: "lg",
            colorAccent: "#3b82f6",
            bus: "blue",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 48,
            isPreset: true,
            presetId: "preset-harmonic-2tk",
            tracks: [
                {
                    index: 0, label: "Pad", midiNote: 48, pan: -0.3, volume: 0.7,
                    actions: [{ actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 100,
                    soundSource: {
                        type: "midiClip", clipId: null,
                        soundEngine: { type: "tonejsPolySynth", synthConfig: { ...DEFAULT_SYNTH_CONFIG, sustain: 0.6, release: 1.5 } },
                        transpose: 0, velocityScale: 0.9,
                        followChordProgression: true,
                    },
                },
                {
                    index: 1, label: "Lead", midiNote: 60, pan: 0.3, volume: 0.7,
                    actions: [{ actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 20,
                    soundSource: {
                        type: "midiClip", clipId: null,
                        soundEngine: { type: "tonejsPolySynth", synthConfig: { ...DEFAULT_SYNTH_CONFIG, sustain: 0.2, release: 0.3 } },
                        transpose: 0, velocityScale: 0.8,
                        followChordProgression: true,
                    },
                },
            ],
        },
    },
    // ── Arrangement Preset ──
    {
        id: "preset-arrangement",
        name: "Arrangement — Conductor",
        description: "Default arrangement conductor with transport control",
        moduleType: "arrangement",
        tags: ["arrangement", "conductor", "transport", "default"],
        defaults: {
            id: "",
            type: "arrangement",
            label: "Main Conductor",
            size: "lg",
            colorAccent: "#22c55e",
            bus: "green",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 60,
            isPreset: true,
            presetId: "preset-arrangement",
            tracks: [],
        },
    },
];

export function getPresetById(id: string): ModulePreset | undefined {
    return MODULE_PRESETS.find(p => p.id === id);
}

export function getPresetsByType(type: string): ModulePreset[] {
    return MODULE_PRESETS.filter(p => p.moduleType === type);
}