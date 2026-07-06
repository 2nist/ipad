// ═══════════════════════════════════════════════════════════════════
// HARMONY ENGINE — Chord progression stepper, scale/chord resolution,
// cadence detection, scale snap
// ═══════════════════════════════════════════════════════════════════

import type {
    ChordStep, ChordQuality, ResolvedChord, HarmonyState,
    ScaleSnapMode,
} from '../types';

export const SCALE_INTERVALS: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    melodic: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
};

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const DEFAULT_NATURAL_QUALITIES_MAJOR: ChordQuality[] = ["maj", "min", "min", "maj", "maj", "min", "dim"];
export const DEFAULT_NATURAL_QUALITIES_MINOR: ChordQuality[] = ["min", "dim", "maj", "min", "min", "maj", "maj"];

export const DEFAULT_AVAILABLE_QUALITIES: Record<number, ChordQuality[]> = {
    1: ["maj", "maj7", "dom7", "min", "min7"],
    2: ["min", "min7", "dim"],
    3: ["min", "min7", "maj", "maj7"],
    4: ["maj", "maj7", "min", "min7"],
    5: ["maj", "dom7", "min", "min7"],
    6: ["min", "min7", "maj", "maj7"],
    7: ["dim", "dom7"],
};

export class HarmonyEngineCore {
    /**
     * Resolve a scale degree to a root MIDI note number (0-11, where C=0).
     */
    degreeToRootNote(key: string, scale: string, degree: number): number {
        const keyIndex = NOTE_NAMES.indexOf(key);
        if (keyIndex === -1) {
            console.warn(`Unknown key: ${key}, defaulting to C`);
            return degree - 1; // fallback: treat degree as index
        }
        const intervals = SCALE_INTERVALS[scale];
        if (!intervals) {
            console.warn(`Unknown scale: ${scale}, defaulting to major`);
            return (keyIndex + (degree - 1) * 2) % 12; // rough fallback
        }
        const interval = intervals[(degree - 1) % 7];
        return (keyIndex + interval) % 12;
    }

    /**
     * Resolve a chord from key, scale, degree, quality.
     */
    resolveChord(key: string, scale: string, degree: number, quality: ChordQuality, octave: number = 3): ResolvedChord {
        const rootNote = this.degreeToRootNote(key, scale, degree);
        const intervals = CHORD_INTERVALS[quality] || CHORD_INTERVALS.maj;
        // Scientific pitch notation (C4 = MIDI 60), matching SynthEngine.midiToNote
        // and Tone.js's own note naming — "octave 3" means (octave+1)*12.
        const chordTones = intervals.map(interval => rootNote + interval + (octave + 1) * 12);
        const noteNames = intervals.map(interval => {
            const noteIndex = (rootNote + interval) % 12;
            return `${NOTE_NAMES[noteIndex]}${octave + Math.floor((rootNote + interval) / 12)}`;
        });

        return {
            degree,
            quality,
            rootNote,
            rootOctave: octave,
            chordTones,
            noteNames,
        };
    }

    /**
     * Advance the chord progression stepper by one step.
     */
    stepProgression(
        progression: ChordStep[],
        currentStepIndex: number,
        beatInStep: number,
        beatsPerBar: number,
    ): { newStepIndex: number; beatInStep: number; advanced: boolean } {
        if (progression.length === 0) return { newStepIndex: 0, beatInStep: 0, advanced: false };

        const step = progression[currentStepIndex];
        if (!step) return { newStepIndex: 0, beatInStep: 0, advanced: false };

        const stepBeats = step.duration * beatsPerBar;
        const newBeatInStep = beatInStep + 1;

        if (newBeatInStep >= stepBeats) {
            // Advance to next step
            const newIndex = (currentStepIndex + 1) % progression.length;
            return { newStepIndex: newIndex, beatInStep: 0, advanced: true };
        }

        return { newStepIndex: currentStepIndex, beatInStep: newBeatInStep, advanced: false };
    }

    /**
     * Detect cadence type from the last two steps of a progression.
     */
    detectCadence(progression: ChordStep[], key: string, scale: string): "authentic" | "plagal" | "deceptive" | "half" | "none" {
        if (progression.length < 2) return "none";

        const lastStep = progression[progression.length - 1];
        const secondLast = progression[progression.length - 2];

        const rootNoteOf = (step: ChordStep) => this.degreeToRootNote(key, scale, step.degree);

        // Authentic: V → I (or V7 → I)
        if (lastStep.degree === 1 && [5, 7].includes(secondLast.degree)) {
            if (secondLast.quality === "dom7" || secondLast.quality === "maj" || secondLast.quality === "min") {
                return "authentic";
            }
        }

        // Plagal: IV → I
        if (lastStep.degree === 1 && secondLast.degree === 4) {
            return "plagal";
        }

        // Deceptive: V → vi
        if (lastStep.degree === 6 && [5, 7].includes(secondLast.degree)) {
            return "deceptive";
        }

        // Half: ends on V
        if (lastStep.degree === 5) {
            return "half";
        }

        return "none";
    }

    /**
     * Get all scale notes for a key + scale combination.
     */
    getScaleNotes(key: string, scale: string): number[] {
        const keyIndex = NOTE_NAMES.indexOf(key);
        if (keyIndex === -1) return [];
        const intervals = SCALE_INTERVALS[scale];
        if (!intervals) return [];
        return intervals.map(interval => (keyIndex + interval) % 12);
    }

    /**
     * Snap a MIDI note to the nearest legal note based on mode.
     */
    snapNote(note: number, scaleNotes: number[], chordTones: number[], mode: ScaleSnapMode): number | null {
        const noteClass = note % 12;

        switch (mode) {
            case "off":
                return note;

            case "scale": {
                if (scaleNotes.includes(noteClass)) return note;
                // Find nearest scale note
                let minDist = 12;
                let bestNote = note;
                for (const sn of scaleNotes) {
                    const dist = Math.min(Math.abs(noteClass - sn), 12 - Math.abs(noteClass - sn));
                    if (dist < minDist) {
                        minDist = dist;
                        bestNote = note - (noteClass - sn);
                    }
                }
                return bestNote;
            }

            case "chordTones": {
                if (chordTones.length === 0) return this.snapNote(note, scaleNotes, [], "scale");
                const ctClasses = chordTones.map(ct => ct % 12);
                if (ctClasses.includes(noteClass)) return note;
                let minDist = 12;
                let bestNote = note;
                for (const ct of ctClasses) {
                    const dist = Math.min(Math.abs(noteClass - ct), 12 - Math.abs(noteClass - ct));
                    if (dist < minDist) {
                        minDist = dist;
                        bestNote = note - (noteClass - ct);
                    }
                }
                return bestNote;
            }

            case "chordTonesStrict": {
                const ctClasses = chordTones.map(ct => ct % 12);
                if (ctClasses.includes(noteClass)) return note;
                return null; // suppress
            }

            default:
                return note;
        }
    }

    /**
     * Suggest common chord progressions for a given key/scale.
     */
    suggestProgression(key: string, scale: string, bars: number): ChordStep[] {
        const isMajor = scale === "major";
        const progressions: number[][] = isMajor
            ? [[1, 4, 5, 1], [1, 5, 6, 4], [2, 5, 1], [1, 6, 4, 5], [1, 4, 6, 5]]
            : [[1, 4, 5, 1], [1, 6, 7, 1], [1, 4, 7, 6], [2, 5, 1], [1, 6, 4, 5]];

        const qualities: ChordQuality[] = isMajor
            ? ["maj", "min", "min", "maj", "maj", "min", "dim"]
            : ["min", "dim", "maj", "min", "min", "maj", "maj"];

        const prog = progressions[Math.floor(Math.random() * progressions.length)];
        const steps = Math.min(prog.length, Math.ceil(bars / 2));

        return prog.slice(0, steps).map((degree, i) => ({
            degree,
            quality: qualities[degree - 1] || "maj",
            duration: i === steps - 1 ? bars - (steps - 1) * 2 : 2,
        }));
    }

    /**
     * Convert a MIDI note number to a note name in scientific pitch notation
     * (C4 = MIDI 60), matching resolveChord's tone convention.
     */
    midiToNoteName(midi: number): string {
        const octave = Math.floor(midi / 12) - 1;
        const noteClass = ((midi % 12) + 12) % 12;
        return `${NOTE_NAMES[noteClass]}${octave}`;
    }

    /**
     * Which progression step is active at a given beat offset within a section.
     * Step durations are in bars; the progression loops, so beats past the total
     * wrap around. Returns the active index plus how far into / until the step end
     * we are (useful for UI countdowns and re-resolution timing).
     */
    stepIndexAtBeat(
        progression: ChordStep[],
        beatInSection: number,
        beatsPerBar: number,
    ): { index: number; beatsIntoStep: number; beatsUntilNext: number } {
        if (progression.length === 0) {
            return { index: 0, beatsIntoStep: 0, beatsUntilNext: 0 };
        }
        const durations = progression.map(s => Math.max(s.duration, 0) * beatsPerBar);
        const total = durations.reduce((a, b) => a + b, 0);
        if (total <= 0) return { index: 0, beatsIntoStep: 0, beatsUntilNext: 0 };

        let pos = ((beatInSection % total) + total) % total;
        for (let i = 0; i < progression.length; i++) {
            if (pos < durations[i]) {
                return { index: i, beatsIntoStep: pos, beatsUntilNext: durations[i] - pos };
            }
            pos -= durations[i];
        }
        // Floating-point fallback: land on the last step's end.
        const last = progression.length - 1;
        return { index: last, beatsIntoStep: durations[last], beatsUntilNext: 0 };
    }

    /**
     * Minimal voice-leading: shift each new chord tone by whole octaves to sit as
     * close as possible to the corresponding voice of the previous chord. Avoids the
     * root-position octave jumps that sound jarring on every change in a looping
     * context. Voices are matched by index; if the previous chord had fewer voices,
     * extra new voices lead against its last voice.
     */
    voiceLead(current: number[], previous: number[] | null): number[] {
        if (!previous || previous.length === 0) return [...current];
        return current.map((note, i) => {
            const target = previous[Math.min(i, previous.length - 1)];
            let best = note;
            let bestDist = Math.abs(note - target);
            for (const shift of [-24, -12, 12, 24]) {
                const cand = note + shift;
                const dist = Math.abs(cand - target);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = cand;
                }
            }
            return best;
        });
    }
}

// Singleton
export const harmonyEngine = new HarmonyEngineCore();