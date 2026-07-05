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
        const chordTones = intervals.map(interval => rootNote + interval + octave * 12);
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
}

// Singleton
export const harmonyEngine = new HarmonyEngineCore();