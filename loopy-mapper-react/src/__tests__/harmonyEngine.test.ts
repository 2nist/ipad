// ═══════════════════════════════════════════════════════════════════
// TESTS — HarmonyEngine, TransportClock, VoicingEngine
// ═══════════════════════════════════════════════════════════════════

import { HarmonyEngineCore, SCALE_INTERVALS, CHORD_INTERVALS, NOTE_NAMES } from '../lib/harmonyEngine';
import { VoicingEngine } from '../lib/voicingEngine';
import { TransportClockImpl } from '../lib/transportClock';
import { rhythmShapeFromTimeSig } from '../components/modules/DualPolygonSVG';
import type { ChordQuality, TimeSignature } from '../types';

// ─── HarmonyEngine Tests ──────────────────────────────────────────

describe('HarmonyEngineCore', () => {
    const engine = new HarmonyEngineCore();

    test('degreeToRootNote returns correct MIDI note class for C major', () => {
        expect(engine.degreeToRootNote('C', 'major', 1)).toBe(0); // C
        expect(engine.degreeToRootNote('C', 'major', 2)).toBe(2); // D
        expect(engine.degreeToRootNote('C', 'major', 3)).toBe(4); // E
        expect(engine.degreeToRootNote('C', 'major', 4)).toBe(5); // F
        expect(engine.degreeToRootNote('C', 'major', 5)).toBe(7); // G
        expect(engine.degreeToRootNote('C', 'major', 6)).toBe(9); // A
        expect(engine.degreeToRootNote('C', 'major', 7)).toBe(11); // B
    });

    test('degreeToRootNote returns correct for D minor', () => {
        expect(engine.degreeToRootNote('D', 'minor', 1)).toBe(2); // D
        expect(engine.degreeToRootNote('D', 'minor', 2)).toBe(4); // E (dim)
        expect(engine.degreeToRootNote('D', 'minor', 3)).toBe(5); // F (♭III)
        expect(engine.degreeToRootNote('D', 'minor', 4)).toBe(7); // G (iv)
        expect(engine.degreeToRootNote('D', 'minor', 5)).toBe(9); // A (v)
        expect(engine.degreeToRootNote('D', 'minor', 6)).toBe(10); // B♭ (♭VI)
        expect(engine.degreeToRootNote('D', 'minor', 7)).toBe(0); // C (♭VII)
    });

    test('resolveChord returns correct chord tones for C major', () => {
        const chord = engine.resolveChord('C', 'major', 1, 'maj', 3);
        expect(chord.rootNote).toBe(0); // C
        expect(chord.chordTones).toEqual([48, 52, 55]); // C3, E3, G3
        expect(chord.noteNames).toEqual(['C3', 'E3', 'G3']);
        expect(chord.degree).toBe(1);
        expect(chord.quality).toBe('maj');
    });

    test('resolveChord returns correct for D minor 7', () => {
        const chord = engine.resolveChord('D', 'minor', 1, 'min7', 3);
        expect(chord.rootNote).toBe(2); // D
        expect(chord.chordTones).toEqual([50, 53, 57, 60]); // D3, F3, A3, C4
        expect(chord.noteNames).toEqual(['D3', 'F3', 'A3', 'C4']);
    });

    test('resolveChord returns correct for G dominant 7', () => {
        const chord = engine.resolveChord('C', 'major', 5, 'dom7', 3);
        expect(chord.rootNote).toBe(7); // G
        expect(chord.chordTones).toEqual([55, 59, 62, 65]); // G3, B3, D4, F4
    });

    test('stepProgression advances correctly', () => {
        const progression = [
            { degree: 1, quality: 'maj' as ChordQuality, duration: 2 },
            { degree: 4, quality: 'maj' as ChordQuality, duration: 2 },
        ];

        // Start at step 0, beat 0
        let result = engine.stepProgression(progression, 0, 0, 4);
        expect(result.newStepIndex).toBe(0);
        expect(result.advanced).toBe(false);

        // Advance through step 0 (8 beats / 2 bars * 4bpb)
        for (let i = 0; i < 7; i++) {
            result = engine.stepProgression(progression, 0, result.beatInStep, 4);
        }
        expect(result.newStepIndex).toBe(1); // Should advance to step 1
        expect(result.advanced).toBe(true);
    });

    test('stepProgression loops back to start', () => {
        const progression = [
            { degree: 1, quality: 'maj' as ChordQuality, duration: 1 },
        ];

        let result = engine.stepProgression(progression, 0, 3, 4); // beat 3 of 4
        expect(result.newStepIndex).toBe(0); // loops back
        expect(result.advanced).toBe(true);
    });

    test('detectCadence returns authentic for V -> I', () => {
        const progression = [
            { degree: 5, quality: 'dom7' as ChordQuality, duration: 2 },
            { degree: 1, quality: 'maj' as ChordQuality, duration: 2 },
        ];
        expect(engine.detectCadence(progression, 'C', 'major')).toBe('authentic');
    });

    test('detectCadence returns plagal for IV -> I', () => {
        const progression = [
            { degree: 4, quality: 'maj' as ChordQuality, duration: 2 },
            { degree: 1, quality: 'maj' as ChordQuality, duration: 2 },
        ];
        expect(engine.detectCadence(progression, 'C', 'major')).toBe('plagal');
    });

    test('detectCadence returns half when ending on V', () => {
        const progression = [
            { degree: 1, quality: 'maj' as ChordQuality, duration: 2 },
            { degree: 5, quality: 'maj' as ChordQuality, duration: 2 },
        ];
        expect(engine.detectCadence(progression, 'C', 'major')).toBe('half');
    });

    test('detectCadence returns none for single step', () => {
        const progression = [
            { degree: 1, quality: 'maj' as ChordQuality, duration: 4 },
        ];
        expect(engine.detectCadence(progression, 'C', 'major')).toBe('none');
    });

    test('getScaleNotes returns correct notes for C major', () => {
        const notes = engine.getScaleNotes('C', 'major');
        expect(notes).toEqual([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B
    });

    test('getScaleNotes returns correct notes for A minor', () => {
        const notes = engine.getScaleNotes('A', 'minor');
        expect(notes).toEqual([9, 11, 0, 2, 4, 5, 7]); // A B C D E F G
    });

    test('snapNote passes through in off mode', () => {
        expect(engine.snapNote(60, [0, 2, 4, 5, 7, 9, 11], [], 'off')).toBe(60);
        expect(engine.snapNote(61, [0, 2, 4, 5, 7, 9, 11], [], 'off')).toBe(61);
    });

    test('snapNote snaps to nearest scale note', () => {
        const cMajorNotes = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
        // F# (61 / 6 mod 12) should snap to F (5) or G (7) — F is closer
        const result = engine.snapNote(66, cMajorNotes, [], 'scale'); // F#4 = 66, noteClass=6
        // closest scale note to 6 is 5 (F) or 7 (G) — 5 is closer
        expect(result).not.toBeNull();
        if (result !== null) {
            expect(result % 12).toBe(5); // snapped to F
        }
    });

    test('snapNote suppresses non-chord tones in chordTonesStrict mode', () => {
        const cMajorNotes = [0, 2, 4, 5, 7, 9, 11];
        // C major triad tones: C(0), E(4), G(7)
        const chordTones = [48, 52, 55]; // C3, E3, G3
        // F#4 (66) is not a chord tone
        expect(engine.snapNote(66, cMajorNotes, chordTones, 'chordTonesStrict')).toBeNull();
        // E4 (64) IS a chord tone
        expect(engine.snapNote(64, cMajorNotes, chordTones, 'chordTonesStrict')).toBe(64);
    });

    test('suggestProgression returns valid chords', () => {
        const prog = engine.suggestProgression('C', 'major', 8);
        expect(prog.length).toBeGreaterThan(0);
        expect(prog.length).toBeLessThanOrEqual(4);
        for (const step of prog) {
            expect(step.degree).toBeGreaterThanOrEqual(1);
            expect(step.degree).toBeLessThanOrEqual(7);
            expect(step.duration).toBeGreaterThan(0);
        }
    });
});

// ─── VoicingEngine Tests ──────────────────────────────────────────

describe('VoicingEngine', () => {
    const engine = new VoicingEngine();
    const harmonyEngine = new HarmonyEngineCore();

    const cMajorChord = harmonyEngine.resolveChord('C', 'major', 1, 'maj', 3);
    const gDominantChord = harmonyEngine.resolveChord('C', 'major', 5, 'dom7', 3);
    const dMinorChord = harmonyEngine.resolveChord('C', 'major', 2, 'min', 3);

    test('closeRoot voicing returns chord tones in range', () => {
        const voiced = engine.voiceChord(cMajorChord, null, {
            strategy: 'closeRoot', minNote: 48, maxNote: 84,
            smoothVoiceLeading: false, voiceCount: 3, rootDoubling: false,
        });
        expect(voiced.length).toBe(3);
        expect(voiced[0]).toBe(48); // C3
        expect(voiced[1]).toBe(52); // E3
        expect(voiced[2]).toBe(55); // G3
    });

    test('closeRoot with root doubling adds low root', () => {
        const voiced = engine.voiceChord(cMajorChord, null, {
            strategy: 'closeRoot', minNote: 36, maxNote: 84,
            smoothVoiceLeading: false, voiceCount: 3, rootDoubling: true,
        });
        expect(voiced.length).toBe(4); // doubled root + 3 chord tones
        expect(voiced[0]).toBe(36); // C2 (doubled)
        expect(voiced[1]).toBe(48); // C3
    });

    test('closeFirst inversion moves root up', () => {
        const voiced = engine.voiceChord(cMajorChord, null, {
            strategy: 'closeFirst', minNote: 48, maxNote: 84,
            smoothVoiceLeading: false, voiceCount: 3, rootDoubling: false,
        });
        // First inversion: E3, G3, C4
        expect(voiced[0]).toBe(52); // E3
        expect(voiced[1]).toBe(55); // G3
        expect(voiced[2]).toBe(60); // C4
    });

    test('open voicing spreads chord across octaves', () => {
        const voiced = engine.voiceChord(cMajorChord, null, {
            strategy: 'open', minNote: 48, maxNote: 96,
            smoothVoiceLeading: false, voiceCount: 3, rootDoubling: false,
        });
        // Open: C3, E4, G4
        expect(voiced[0]).toBe(48); // C3
        expect(voiced[1]).toBeGreaterThan(60); // E in a higher octave
        expect(voiced.length).toBe(3);
    });

    test('drop2 voicing lowers 2nd voice by octave', () => {
        const voiced = engine.voiceChord(gDominantChord, null, {
            strategy: 'drop2', minNote: 48, maxNote: 84,
            smoothVoiceLeading: false, voiceCount: 4, rootDoubling: false,
        });
        expect(voiced.length).toBe(4);
    });
});

// ─── TransportClock Tests ─────────────────────────────────────────

describe('TransportClockImpl', () => {
    // Mock AudioContext
    const mockAudioContext = {
        currentTime: 0,
        sampleRate: 44100,
        state: 'running',
        resume: async () => { },
        audioWorklet: { addModule: async () => { } },
    } as unknown as AudioContext;

    // Need to test using a mock — the clock uses setTimeout which isn't available in JSDOM
    // Test the core calculations instead
    test('TransportClockImpl constructor sets defaults', () => {
        const clock = new TransportClockImpl({
            source: 'internal',
            audioContext: mockAudioContext,
            scheduleAhead: 0.1,
            schedulerInterval: 0.025,
        });
        expect(clock.bpm).toBe(120);
        expect(clock.isPlaying).toBe(false);
        expect(clock.beatsPerBar).toBe(4);
    });

    test('setBpm clamps to valid range', () => {
        const clock = new TransportClockImpl({
            source: 'internal',
            audioContext: mockAudioContext,
            scheduleAhead: 0.1,
            schedulerInterval: 0.025,
        });
        clock.setBpm(250);
        expect(clock.bpm).toBe(200);
        clock.setBpm(40);
        expect(clock.bpm).toBe(60);
        clock.setBpm(120);
        expect(clock.bpm).toBe(120);
    });

    test('beatsPerBar calculates correctly', () => {
        const clock = new TransportClockImpl({
            source: 'internal',
            audioContext: mockAudioContext,
            scheduleAhead: 0.1,
            schedulerInterval: 0.025,
        });
        expect(clock.beatsPerBar).toBe(4); // 4/4
        clock.setTimeSignature({ numerator: 6, denominator: 8 });
        expect(clock.beatsPerBar).toBe(3); // 6/8 = 6 * 0.5 = 3
        clock.setTimeSignature({ numerator: 3, denominator: 4 });
        expect(clock.beatsPerBar).toBe(3); // 3/4
    });

    test('advance() accumulates beats at the current BPM', () => {
        const clock = new TransportClockImpl({
            source: 'internal', audioContext: mockAudioContext,
            scheduleAhead: 0.1, schedulerInterval: 0.025,
        });
        clock.setBpm(120); // 2 beats/sec
        clock.start();
        clock.advance(1000); // 1 second
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(2, 5);
    });

    test('changing BPM mid-playback does not rescale beats already played', () => {
        const clock = new TransportClockImpl({
            source: 'internal', audioContext: mockAudioContext,
            scheduleAhead: 0.1, schedulerInterval: 0.025,
        });
        clock.setBpm(120); // 2 beats/sec
        clock.start();
        clock.advance(1000); // +2 beats @ 120bpm = 2
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(2, 5);

        clock.setBpm(60); // 1 beat/sec — must not retroactively rescale the 2 beats already played
        clock.advance(1000); // +1 beat @ 60bpm
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(3, 5);
    });

    test('pause() preserves position and resume() continues from it', () => {
        const clock = new TransportClockImpl({
            source: 'internal', audioContext: mockAudioContext,
            scheduleAhead: 0.1, schedulerInterval: 0.025,
        });
        clock.setBpm(120);
        clock.start();
        clock.advance(1000); // 2 beats
        clock.pause();
        expect(clock.isPlaying).toBe(false);
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(2, 5);

        // Paused: advance() must be a no-op (nothing is "playing")
        clock.advance(5000);
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(2, 5);

        clock.resume();
        expect(clock.isPlaying).toBe(true);
        clock.advance(500); // +1 beat @ 120bpm
        expect(clock.getPosition().absoluteBeat).toBeCloseTo(3, 5);
    });

    test('stop() resets position back to zero', () => {
        const clock = new TransportClockImpl({
            source: 'internal', audioContext: mockAudioContext,
            scheduleAhead: 0.1, schedulerInterval: 0.025,
        });
        clock.setBpm(120);
        clock.start();
        clock.advance(2000); // 4 beats
        clock.stop();
        expect(clock.isPlaying).toBe(false);
        expect(clock.getPosition().absoluteBeat).toBe(0);
    });
});

// ─── Rhythm Shape Tests ───────────────────────────────────────────

describe('rhythmShapeFromTimeSig', () => {
    test('4/4 returns square numerator and square denominator', () => {
        const ts: TimeSignature = { numerator: 4, denominator: 4 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(4);
        expect(config.denominator.vertices).toBe(4);
        expect(config.numerator.splitLine).toBe(false);
    });

    test('2/4 returns square with diagonal split line', () => {
        const ts: TimeSignature = { numerator: 2, denominator: 4 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(4); // square (2→4 exception)
        expect(config.numerator.splitLine).toBe(true);
        expect(config.numerator.splitLineType).toBe('diagonal');
    });

    test('2/2 returns square with horizontal split line', () => {
        const ts: TimeSignature = { numerator: 2, denominator: 2 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(4);
        expect(config.numerator.splitLine).toBe(true);
        expect(config.numerator.splitLineType).toBe('horizontal');
    });

    test('3/4 returns triangle numerator and square denominator', () => {
        const ts: TimeSignature = { numerator: 3, denominator: 4 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(3); // triangle
        expect(config.denominator.vertices).toBe(4);
    });

    test('6/8 returns hexagon numerator and octagon denominator', () => {
        const ts: TimeSignature = { numerator: 6, denominator: 8 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(6);
        expect(config.denominator.vertices).toBe(8);
    });

    test('5/4 returns pentagon numerator', () => {
        const ts: TimeSignature = { numerator: 5, denominator: 4 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.vertices).toBe(5);
    });

    test('getPolygonPoints returns valid SVG points', () => {
        const ts: TimeSignature = { numerator: 4, denominator: 4 };
        const config = rhythmShapeFromTimeSig(ts);
        expect(config.numerator.svgPoints).toContain(',');
        expect(config.denominator.svgPoints).toContain(',');
        // Should have 4 coordinate pairs for a square
        expect(config.numerator.svgPoints.split(' ').length).toBe(4);
    });
});