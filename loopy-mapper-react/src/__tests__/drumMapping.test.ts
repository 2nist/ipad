import { describe, test, expect } from 'vitest';
import { detectDrumNote, buildKitNoteMap, ROLE_NOTES } from '../lib/drumMapping';

describe('detectDrumNote', () => {
    // Real filenames sampled from the library (Roland/Linn/DMX/MPC naming).
    const cases: Array<[string, number]> = [
        ['TR-909Kick 01.wav', ROLE_NOTES.kick],
        ['LinnKick01.wav', ROLE_NOTES.kick],
        ['MaxV - Roland808 - 808_boom 01.wav', ROLE_NOTES.kick],
        ['BD0050 16.wav', ROLE_NOTES.kick],
        ['bd1.wav', ROLE_NOTES.kick],
        ['LinnSnare01.wav', ROLE_NOTES.snare],
        ['big esnare.wav', ROLE_NOTES.snare],
        ['MaxV - Roland808 - 808Rs 12.wav', ROLE_NOTES.rimshot],
        ['LinnRimshot.wav', ROLE_NOTES.rimshot],
        ['909RIM 08.wav', ROLE_NOTES.rimshot],
        ['909CLAP 03.wav', ROLE_NOTES.clap],
        ['MaxV - Roland808 - 808Cp 05.wav', ROLE_NOTES.clap],
        ['LinnHat_C.wav', ROLE_NOTES.closedHat],
        ['MaxV - Roland808 - 808Ch 03.wav', ROLE_NOTES.closedHat],
        ['MaxV - HiHat Closed.wav', ROLE_NOTES.closedHat],
        ['808HH 06.wav', ROLE_NOTES.closedHat],
        ['LinnHat_O.wav', ROLE_NOTES.openHat],
        ['MaxV - HiHat Open.wav', ROLE_NOTES.openHat],
        ['MaxV - Roland808 - 808Oh25 11.wav', ROLE_NOTES.openHat],
        ['LinnHat_P.wav', ROLE_NOTES.pedalHat],
        ['909RIDE 07.wav', ROLE_NOTES.ride],
        ['TR-909Crash.wav', ROLE_NOTES.crash],
        ['LinnCowbell.wav', ROLE_NOTES.cowbell],
        ['MaxV - Roland808 - 808Cb 02.wav', ROLE_NOTES.cowbell],
        ['LinnTamborine.wav', ROLE_NOTES.tambourine],
        ['DMXCabasa.wav', ROLE_NOTES.shaker],
        ['LinnShaker.wav', ROLE_NOTES.shaker],
        ['MaxV - Roland808 - 808Ma 10.wav', ROLE_NOTES.shaker],
        ['MaxV - Roland808 - 808Cl 04.wav', ROLE_NOTES.clave],
        ['MaxV - Roland808 - 808Lc00 08.wav', ROLE_NOTES.conga],
        ['DMXTomHi.wav', ROLE_NOTES.highTom],
        ['DMXTomLo.wav', ROLE_NOTES.lowTom],
        ['DMXTomMid.wav', ROLE_NOTES.midTom],
        ['MaxV - Roland808 - 808Lt00 09.wav', ROLE_NOTES.lowTom],
        ['MaxV - Roland808 - 808Ht00 07.wav', ROLE_NOTES.highTom],
    ];

    test.each(cases)('%s -> %i', (filename, note) => {
        expect(detectDrumNote(filename)).toBe(note);
    });

    test('the "MaxV" brand prefix does not read as maraca/shaker', () => {
        expect(detectDrumNote('MaxV - Kick.wav')).toBe(ROLE_NOTES.kick);
    });

    test('unknown names return null', () => {
        expect(detectDrumNote('doink.wav')).toBeNull();
        expect(detectDrumNote('clank.wav')).toBeNull();
    });
});

describe('buildKitNoteMap', () => {
    test('distinct notes; duplicates and unknowns spill without collision', () => {
        const files = ['Kick.wav', 'Kick2.wav', 'Snare.wav', 'doink.wav'];
        const map = buildKitNoteMap(files);
        const notes = Object.values(map);
        expect(new Set(notes).size).toBe(notes.length); // all unique
        expect(map['Kick.wav']).toBe(ROLE_NOTES.kick);
        expect(map['Kick2.wav']).not.toBe(ROLE_NOTES.kick); // spilled
        expect(map['Snare.wav']).toBe(ROLE_NOTES.snare);
        expect(map['doink.wav']).toBeGreaterThanOrEqual(60); // unknown -> high range
    });
});
