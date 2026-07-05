// ═══════════════════════════════════════════════════════════════════
// VOICING ENGINE — Chord voicing strategies with voice leading
// ═══════════════════════════════════════════════════════════════════

import type { ResolvedChord, VoicingConfig, VoicingStrategy } from '../types';
import { CHORD_INTERVALS } from './harmonyEngine';

export const VOICING_PRESETS: Record<string, VoicingConfig> = {
    piano: {
        strategy: "closeRoot",
        minNote: 48,
        maxNote: 84,
        smoothVoiceLeading: true,
        voiceCount: 4,
        rootDoubling: false,
    },
    pad: {
        strategy: "open",
        minNote: 48,
        maxNote: 96,
        smoothVoiceLeading: true,
        voiceCount: 4,
        rootDoubling: false,
    },
    strings: {
        strategy: "drop2",
        minNote: 48,
        maxNote: 84,
        smoothVoiceLeading: true,
        voiceCount: 4,
        rootDoubling: false,
    },
    jazz: {
        strategy: "spread",
        minNote: 48,
        maxNote: 84,
        smoothVoiceLeading: true,
        voiceCount: 3,
        rootDoubling: false,
    },
    bass: {
        strategy: "closeRoot",
        minNote: 24,
        maxNote: 60,
        smoothVoiceLeading: false,
        voiceCount: 2,
        rootDoubling: true,
    },
};

export class VoicingEngine {
    /**
     * Voice a chord according to the given configuration.
     * Returns an array of MIDI note numbers.
     */
    voiceChord(
        chord: ResolvedChord,
        previousChord: ResolvedChord | null,
        config: VoicingConfig,
    ): number[] {
        const basicTones = this.getBasicTones(chord, config);

        switch (config.strategy) {
            case "closeRoot":
                return this.closeRoot(basicTones, chord, config, previousChord);
            case "closeFirst":
                return this.closeFirst(basicTones, chord, config, previousChord);
            case "closeSecond":
                return this.closeSecond(basicTones, chord, config, previousChord);
            case "open":
                return this.open(basicTones, chord, config, previousChord);
            case "drop2":
                return this.drop2(basicTones, chord, config, previousChord);
            case "drop3":
                return this.drop3(basicTones, chord, config, previousChord);
            case "spread":
                return this.spread(basicTones, chord, config, previousChord);
            default:
                return this.closeRoot(basicTones, chord, config, previousChord);
        }
    }

    private getBasicTones(chord: ResolvedChord, config: VoicingConfig): number[] {
        const intervals = CHORD_INTERVALS[chord.quality] || CHORD_INTERVALS.maj;
        const rootNote = chord.rootNote + chord.rootOctave * 12;

        // Get unique tones in the chord, limited to voiceCount
        const toneCount = Math.min(config.voiceCount, intervals.length);
        return intervals.slice(0, toneCount).map(i => rootNote + i);
    }

    private closeRoot(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        let result = [...tones];
        if (config.rootDoubling) {
            result = [tones[0] - 12, ...result];
        }
        return this.clampRange(result, config);
    }

    private closeFirst(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // First inversion: move root up an octave
        const inv = [...tones.slice(1), tones[0] + 12];
        return this.clampRange(inv, config);
    }

    private closeSecond(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // Second inversion: move root and third up an octave
        const inv = [...tones.slice(2), tones[0] + 12, tones[1] + 12];
        return this.clampRange(inv.slice(0, config.voiceCount), config);
    }

    private open(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // Spread voicing: root in bass, then remaining tones spread across octaves
        if (tones.length < 3) return this.closeRoot(tones, chord, config, previous);
        const root = tones[0];
        const spread = [root, tones[1] + 12, tones[2] + 12];
        if (tones.length > 3) spread.push(tones[3] + 24);
        if (config.smoothVoiceLeading && previous) {
            return this.applyVoiceLeading(spread, previous.chordTones, config);
        }
        return this.clampRange(spread, config);
    }

    private drop2(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // Drop-2: take the 2nd voice from top and drop it an octave
        if (tones.length < 4) return this.closeRoot(tones, chord, config, previous);
        const dropped = [tones[0], tones[1], tones[3] - 12, tones[2]];
        if (config.smoothVoiceLeading && previous) {
            return this.applyVoiceLeading(dropped, previous.chordTones, config);
        }
        return this.clampRange(dropped, config);
    }

    private drop3(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // Drop-3: take the 3rd voice from top and drop it an octave
        if (tones.length < 4) return this.closeRoot(tones, chord, config, previous);
        const dropped = [tones[0], tones[2] - 12, tones[1], tones[3]];
        if (config.smoothVoiceLeading && previous) {
            return this.applyVoiceLeading(dropped, previous.chordTones, config);
        }
        return this.clampRange(dropped, config);
    }

    private spread(
        tones: number[],
        chord: ResolvedChord,
        config: VoicingConfig,
        previous: ResolvedChord | null,
    ): number[] {
        // Rootless spread: skip root, spread 3rd, 5th, 7th across range
        if (tones.length < 3) return this.closeRoot(tones, chord, config, previous);
        const rootless = tones.slice(1);
        const spread = [rootless[0], rootless[rootless.length - 1] - 12];
        if (rootless.length > 2) {
            spread.push(rootless[1]);
            spread.push(rootless[rootless.length - 1]);
        }
        if (config.smoothVoiceLeading && previous) {
            return this.applyVoiceLeading(spread, previous.chordTones, config);
        }
        return this.clampRange(spread, config);
    }

    private applyVoiceLeading(
        current: number[],
        previousTones: number[],
        config: VoicingConfig,
    ): number[] {
        if (previousTones.length === 0) return current;

        // For each voice, find the closest note in the next octave range
        return current.map((note, i) => {
            const prev = previousTones[i % previousTones.length];
            if (prev === undefined) return note;

            // Try note, note-12, note+12, find closest to prev
            const candidates = [note, note - 12, note + 12];
            let best = note;
            let minDist = Infinity;
            for (const c of candidates) {
                if (c < config.minNote || c > config.maxNote) continue;
                const dist = Math.abs(c - prev);
                if (dist < minDist) {
                    minDist = dist;
                    best = c;
                }
            }
            return best;
        });
    }

    private clampRange(notes: number[], config: VoicingConfig): number[] {
        return notes.map(n => {
            if (n < config.minNote) return n + 12;
            if (n > config.maxNote) return n - 12;
            return n;
        });
    }
}

// Singleton
export const voicingEngine = new VoicingEngine();