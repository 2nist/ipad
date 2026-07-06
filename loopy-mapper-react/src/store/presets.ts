// ═══════════════════════════════════════════════════════════════════
// DEFAULT MODULE PRESETS
// ═══════════════════════════════════════════════════════════════════

import type { ModulePreset, RhythmMode } from '../types';

// ── Pattern name pool (minerals/geologic — innocuous, memorable) ──

const PATTERN_NAMES = [
    "Quartz", "Onyx", "Jasper", "Flint", "Mica", "Slate", "Shale",
    "Agate", "Topaz", "Beryl", "Chert", "Opal", "Jade", "Obsidian",
    "Garnet", "Zircon", "Spinel", "Olivine", "Hematite", "Magnetite",
    "Pyrite", "Galena", "Calcite", "Dolomite", "Gypsum", "Talc",
    "Graphite", "Sulfur", "Halite", "Fluorite", "Apatite", "Corundum",
];

let _patternIndex = 0;

export function nextPatternName(): string {
    const name = PATTERN_NAMES[_patternIndex % PATTERN_NAMES.length];
    _patternIndex++;
    return name;
}

/** Reset pattern name index (for new songs) */
export function resetPatternNames(): void {
    _patternIndex = 0;
}

// ── Mode-based colors ──

export const RHYTHM_MODE_COLORS: Record<RhythmMode, string> = {
    loop: "#dc2626",   // dark red
    fill: "#ef4444",   // red
    clip: "#f97316",   // orange-red
};

export const RHYTHM_MODE_LABELS: Record<RhythmMode, string> = {
    loop: "Loop",
    fill: "Fill",
    clip: "Clip",
};

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
        id: "preset-rhythm-8tk",
        name: "Rhythm — 8 Track",
        description: "Full 8-track drum kit: Kick, Snare, Hi-Hat, Tom Hi, Tom Mid, Tom Low, Crash, Ride",
        moduleType: "rhythm",
        tags: ["drums", "rhythm", "8-track", "full", "sampler"],
        defaults: {
            id: "",
            type: "rhythm",
            label: "Drum Kit",
            size: "lg",
            colorAccent: "#ef4444",
            bus: "red",
            quantization: "1_bar",
            quantizationEnabled: true,
            baseMidiNote: 36,
            isPreset: true,
            presetId: "preset-rhythm-8tk",
            tracks: [
                { index: 0, label: "Kick", midiNote: 36, pan: 0, volume: 0.9,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Kick", soundEngine: { type: "sampler", sampleMap: { 36: "" }, rootNote: 36 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 1, label: "Snare", midiNote: 38, pan: 0, volume: 0.85,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Snare", soundEngine: { type: "sampler", sampleMap: { 38: "" }, rootNote: 38 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 2, label: "Hi-Hat", midiNote: 42, pan: 0, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Hi-Hat", soundEngine: { type: "sampler", sampleMap: { 42: "" }, rootNote: 42 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 3, label: "Tom Hi", midiNote: 48, pan: -0.3, volume: 0.75,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Tom Hi", soundEngine: { type: "sampler", sampleMap: { 48: "" }, rootNote: 48 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 4, label: "Tom Mid", midiNote: 45, pan: 0.1, volume: 0.75,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Tom Mid", soundEngine: { type: "sampler", sampleMap: { 45: "" }, rootNote: 45 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 5, label: "Tom Low", midiNote: 41, pan: 0.3, volume: 0.75,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Tom Low", soundEngine: { type: "sampler", sampleMap: { 41: "" }, rootNote: 41 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 6, label: "Crash", midiNote: 49, pan: -0.5, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Crash", soundEngine: { type: "sampler", sampleMap: { 49: "" }, rootNote: 49 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
                { index: 7, label: "Ride", midiNote: 51, pan: 0.5, volume: 0.65,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: { type: "sample", sampleId: null, sampleName: "Ride", soundEngine: { type: "sampler", sampleMap: { 51: "" }, rootNote: 51 }, transpose: 0, velocityScale: 1.0, triggerMode: "oneShot" },
                },
            ],
        },
    },
    {
        id: "preset-rhythm-4tk",
        name: "Rhythm — 4 Track",
        description: "Standard 4-track rhythm section with sample-based drum pads",
        moduleType: "rhythm",
        tags: ["drums", "rhythm", "4-track", "default", "sampler"],
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
                    index: 0, label: "Kick", midiNote: 36, pan: 0, volume: 0.9,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Kick",
                        soundEngine: { type: "sampler", sampleMap: { 36: "" }, rootNote: 36 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
                },
                {
                    index: 1, label: "Snare", midiNote: 38, pan: 0, volume: 0.85,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Snare",
                        soundEngine: { type: "sampler", sampleMap: { 38: "" }, rootNote: 38 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
                },
                {
                    index: 2, label: "Hi-Hat", midiNote: 42, pan: 0, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Hi-Hat",
                        soundEngine: { type: "sampler", sampleMap: { 42: "" }, rootNote: 42 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
                },
                {
                    index: 3, label: "Perc", midiNote: 44, pan: 0.2, volume: 0.7,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Perc",
                        soundEngine: { type: "sampler", sampleMap: { 44: "" }, rootNote: 44 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
                },
            ],
        },
    },
    {
        id: "preset-rhythm-2tk",
        name: "Rhythm — 2 Track",
        description: "Compact 2-track rhythm section with sample-based pads",
        moduleType: "rhythm",
        tags: ["drums", "rhythm", "2-track", "compact", "sampler"],
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
                    index: 0, label: "Kick", midiNote: 36, pan: 0, volume: 0.9,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Kick",
                        soundEngine: { type: "sampler", sampleMap: { 36: "" }, rootNote: 36 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
                },
                {
                    index: 1, label: "Snare", midiNote: 38, pan: 0, volume: 0.85,
                    actions: [{ actionId: "record", enabled: true }, { actionId: "playStop", enabled: true }, { actionId: "mute", enabled: true }, { actionId: "clear", enabled: true }],
                    loopBehavior: "toggle", volumeRampMs: 5,
                    soundSource: {
                        type: "sample", sampleId: null, sampleName: "Snare",
                        soundEngine: { type: "sampler", sampleMap: { 38: "" }, rootNote: 38 },
                        transpose: 0, velocityScale: 1.0, triggerMode: "oneShot",
                    },
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