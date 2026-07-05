// ═══════════════════════════════════════════════════════════════════
// ACTION LIBRARY — The 52-action vocabulary filtered by module type
// ═══════════════════════════════════════════════════════════════════

import type { ActionDef } from '../types';

export const ACTION_LIBRARY: ActionDef[] = [
    // ── Rhythm Module Actions ──
    {
        id: "record", name: "Record", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "playStop", name: "Play/Stop", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "overdub", name: "Overdub", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "clear", name: "Clear", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "mute", name: "Mute", category: "clip", appliesTo: ["rhythm", "harmonic", "arrangement"],
    },
    {
        id: "solo", name: "Solo", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "reverse", name: "Reverse Clip", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "multiplyLength", name: "Multiply Length", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "divideLength", name: "Divide Length", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "peelLayers", name: "Peel Layers", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "play", name: "Play", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    {
        id: "stop", name: "Stop", category: "clip", appliesTo: ["rhythm", "harmonic"],
    },
    // ── Global / Transport Actions ──
    {
        id: "globalPlay", name: "Toggle Global Play", category: "global", appliesTo: ["arrangement"],
    },
    {
        id: "globalStop", name: "Global Stop", category: "global", appliesTo: ["arrangement"],
    },
    {
        id: "globalRecord", name: "Global Record", category: "global", appliesTo: ["arrangement"],
    },
    {
        id: "tapTempo", name: "Tap Tempo", category: "clock", appliesTo: ["arrangement"],
    },
    {
        id: "setBpm", name: "Set BPM", category: "clock", appliesTo: ["arrangement"],
        paramSchema: {
            fields: [{ key: "bpm", type: "float", label: "BPM", default: 120, min: 60, max: 200 }],
        },
    },
    {
        id: "nudgeForward", name: "Nudge Forward", category: "clock", appliesTo: ["arrangement"],
    },
    {
        id: "nudgeBackward", name: "Nudge Backward", category: "clock", appliesTo: ["arrangement"],
    },
    {
        id: "adjustMasterVolume", name: "Adjust Master Volume", category: "global", appliesTo: ["arrangement"],
        paramSchema: {
            fields: [{ key: "volume", type: "float", label: "Volume", default: 1.0, min: 0, max: 1 }],
        },
    },
    {
        id: "undo", name: "Undo", category: "session", appliesTo: ["arrangement"],
    },
    {
        id: "redo", name: "Redo", category: "session", appliesTo: ["arrangement"],
    },
    // ── Section Trigger Actions ──
    {
        id: "nextSection", name: "Next Section", category: "session", appliesTo: ["arrangement"],
    },
    {
        id: "previousSection", name: "Previous Section", category: "session", appliesTo: ["arrangement"],
    },
    {
        id: "jumpToSection", name: "Jump to Section N", category: "session", appliesTo: ["arrangement"],
        paramSchema: {
            fields: [{ key: "sectionIndex", type: "int", label: "Section Index", default: 0, min: 0, max: 31 }],
        },
    },
    {
        id: "transitionMode", name: "Transition Mode", category: "session", appliesTo: ["arrangement"],
    },
    // ── Expression Actions ──
    {
        id: "triggerExpression", name: "Trigger Expression", category: "clip", appliesTo: ["rhythm", "harmonic", "arrangement"],
    },
];

// Pre-filtered lists for each module type
export const RHYTHM_TRACK_ACTIONS = ACTION_LIBRARY.filter(a => a.appliesTo.includes("rhythm"));
export const HARMONIC_TRACK_ACTIONS = ACTION_LIBRARY.filter(a => a.appliesTo.includes("harmonic"));
export const ARRANGEMENT_ACTIONS = ACTION_LIBRARY.filter(a => a.appliesTo.includes("arrangement"));

export function getActionById(id: string): ActionDef | undefined {
    return ACTION_LIBRARY.find(a => a.id === id);
}