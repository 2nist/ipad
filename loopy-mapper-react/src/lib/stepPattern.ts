// ═══════════════════════════════════════════════════════════════════
// STEP PATTERN — Shared encode/decode between the step-sequencer grid
// UI and the persisted clipData (JSON-encoded MidiEvent[] in an
// ArrayBuffer, stored on the track's sound source).
//
// This is the single source of truth for the wire format so the grid
// (MidiSequencerPanel) and the playback engine (synthEngine.playSequence,
// scheduled in useEngineInitialization) can never drift out of sync.
// ═══════════════════════════════════════════════════════════════════

import type { MidiEvent } from '../types';

export const STEP_COUNT = 16; // 16 steps = 1 bar of 16th notes
export const STEP_DURATION_BEATS = 0.25; // a 16th note at 4/4

export interface Step {
    active: boolean;
    velocity: number; // 0.0-1.0
}

export function emptyGrid(stepCount: number = STEP_COUNT): Step[] {
    return Array.from({ length: stepCount }, () => ({ active: false, velocity: 0.8 }));
}

/**
 * Encode a step grid into a MidiEvent[] delta-time stream, one bar long.
 * Each active step becomes a noteOn followed by a noteOff at 80% of the
 * step's duration (a short gate); deltaTime accumulates across inactive
 * steps so the total span is always `stepCount * STEP_DURATION_BEATS`.
 */
export function encodeStepsToEvents(steps: Step[], note: number): MidiEvent[] {
    const events: MidiEvent[] = [];
    let deltaTime = 0;

    for (const step of steps) {
        if (step.active) {
            events.push({ deltaTime, type: 'noteOn', note, velocity: Math.round(step.velocity * 127) });
            events.push({ deltaTime: STEP_DURATION_BEATS * 0.8, type: 'noteOff', note, velocity: 0 });
            deltaTime = STEP_DURATION_BEATS * 0.2;
        } else {
            deltaTime += STEP_DURATION_BEATS;
        }
    }

    return events;
}

export function encodeStepsToClipData(steps: Step[], note: number): ArrayBuffer {
    const events = encodeStepsToEvents(steps, note);
    return new TextEncoder().encode(JSON.stringify(events)).buffer;
}

/**
 * Inverse of encodeStepsToEvents: walk the cumulative deltaTime (same
 * accumulation Tone.Transport.schedule uses for `+${currentTime}`) and place
 * each noteOn at its rounded step index.
 */
export function decodeEventsToSteps(events: MidiEvent[], stepCount: number = STEP_COUNT): Step[] {
    const steps = emptyGrid(stepCount);
    let t = 0;
    for (const ev of events) {
        t += ev.deltaTime;
        if (ev.type === 'noteOn') {
            const idx = Math.round(t / STEP_DURATION_BEATS);
            if (idx >= 0 && idx < stepCount) {
                steps[idx] = { active: true, velocity: Math.max(0, Math.min(1, ev.velocity / 127)) };
            }
        }
    }
    return steps;
}

/** Parse a track's persisted clipData back into a step grid. Never throws —
 *  missing/corrupt data just yields an empty grid. */
export function decodeClipDataToSteps(clipData: ArrayBuffer | undefined, stepCount: number = STEP_COUNT): Step[] {
    if (!clipData || clipData.byteLength === 0) return emptyGrid(stepCount);
    try {
        const events = JSON.parse(new TextDecoder().decode(clipData)) as MidiEvent[];
        return decodeEventsToSteps(events, stepCount);
    } catch {
        return emptyGrid(stepCount);
    }
}

/** Parse a track's persisted clipData into raw MidiEvent[] (for playback
 *  scheduling, where the grid shape doesn't matter). Never throws. */
export function decodeClipDataToEvents(clipData: ArrayBuffer | undefined): MidiEvent[] {
    if (!clipData || clipData.byteLength === 0) return [];
    try {
        return JSON.parse(new TextDecoder().decode(clipData)) as MidiEvent[];
    } catch {
        return [];
    }
}
