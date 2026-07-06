import { describe, test, expect } from 'vitest';
import {
    STEP_COUNT, emptyGrid, encodeStepsToEvents, encodeStepsToClipData,
    decodeEventsToSteps, decodeClipDataToSteps, decodeClipDataToEvents,
} from '../lib/stepPattern';
import type { Step } from '../lib/stepPattern';

function gridFromActiveIndices(active: Record<number, number>): Step[] {
    const steps = emptyGrid();
    for (const [idx, velocity] of Object.entries(active)) {
        steps[Number(idx)] = { active: true, velocity };
    }
    return steps;
}

describe('encode/decode round-trip', () => {
    test('empty grid encodes to zero events and decodes back to empty', () => {
        const steps = emptyGrid();
        const events = encodeStepsToEvents(steps, 36);
        expect(events).toEqual([]);
        expect(decodeEventsToSteps(events)).toEqual(emptyGrid());
    });

    test('single active step at index 0 round-trips', () => {
        const steps = gridFromActiveIndices({ 0: 0.8 });
        const events = encodeStepsToEvents(steps, 36);
        const decoded = decodeEventsToSteps(events);
        expect(decoded[0].active).toBe(true);
        expect(decoded[0].velocity).toBeCloseTo(0.8, 2);
        for (let i = 1; i < STEP_COUNT; i++) expect(decoded[i].active).toBe(false);
    });

    test('single active step at a middle index round-trips (deltaTime accumulation)', () => {
        const steps = gridFromActiveIndices({ 7: 0.5 });
        const events = encodeStepsToEvents(steps, 38);
        const decoded = decodeEventsToSteps(events);
        expect(decoded[7].active).toBe(true);
        expect(decoded[7].velocity).toBeCloseTo(0.5, 2);
        expect(decoded.filter(s => s.active).length).toBe(1);
    });

    test('every step active round-trips exactly', () => {
        const steps = emptyGrid().map((_, i) => ({ active: true, velocity: (i % 4) / 4 + 0.25 }));
        const events = encodeStepsToEvents(steps, 42);
        const decoded = decodeEventsToSteps(events);
        for (let i = 0; i < STEP_COUNT; i++) {
            expect(decoded[i].active).toBe(true);
            expect(decoded[i].velocity).toBeCloseTo(steps[i].velocity, 2);
        }
    });

    test('sparse pattern (kick on 0, 8; snare-ish on 4, 12) round-trips', () => {
        const steps = gridFromActiveIndices({ 0: 1.0, 4: 0.6, 8: 1.0, 12: 0.6 });
        const events = encodeStepsToEvents(steps, 36);
        const decoded = decodeEventsToSteps(events);
        expect(decoded.map(s => s.active)).toEqual(
            emptyGrid().map((_, i) => [0, 4, 8, 12].includes(i))
        );
    });

    test('total encoded duration spans exactly one bar (16 * 0.25 beats)', () => {
        const steps = gridFromActiveIndices({ 15: 0.9 }); // last step active
        const events = encodeStepsToEvents(steps, 36);
        const total = events.reduce((sum, e) => sum + e.deltaTime, 0);
        // noteOn deltaTime (accumulated gaps to reach step 15) + noteOff gate (0.8*0.25)
        expect(total).toBeCloseTo(15 * 0.25 + 0.25 * 0.8, 5);
    });
});

describe('encodeStepsToClipData / decodeClipDataToSteps', () => {
    test('round-trips through the ArrayBuffer wire format', () => {
        const steps = gridFromActiveIndices({ 0: 1.0, 6: 0.4, 10: 0.75 });
        const clipData = encodeStepsToClipData(steps, 49);
        const decoded = decodeClipDataToSteps(clipData);
        expect(decoded[0].active).toBe(true);
        expect(decoded[6].active).toBe(true);
        expect(decoded[10].active).toBe(true);
        expect(decoded.filter(s => s.active).length).toBe(3);
    });

    test('missing clipData decodes to an empty grid, not a throw', () => {
        expect(decodeClipDataToSteps(undefined)).toEqual(emptyGrid());
    });

    test('corrupt clipData decodes to an empty grid, not a throw', () => {
        const garbage = new TextEncoder().encode('not json').buffer;
        expect(decodeClipDataToSteps(garbage)).toEqual(emptyGrid());
    });

    test('zero-length clipData decodes to an empty grid', () => {
        expect(decodeClipDataToSteps(new ArrayBuffer(0))).toEqual(emptyGrid());
    });
});

describe('decodeClipDataToEvents', () => {
    test('round-trips raw events for playback scheduling', () => {
        const steps = gridFromActiveIndices({ 2: 0.9 });
        const clipData = encodeStepsToClipData(steps, 40);
        const events = decodeClipDataToEvents(clipData);
        expect(events.length).toBe(2); // one noteOn + one noteOff
        expect(events[0].type).toBe('noteOn');
        expect(events[0].note).toBe(40);
    });

    test('missing/corrupt data returns an empty array, not a throw', () => {
        expect(decodeClipDataToEvents(undefined)).toEqual([]);
        expect(decodeClipDataToEvents(new TextEncoder().encode('garbage').buffer)).toEqual([]);
    });
});
