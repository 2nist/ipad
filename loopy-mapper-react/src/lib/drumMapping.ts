// ═══════════════════════════════════════════════════════════════════
// DRUM MAPPING — Guess a General-MIDI drum note from a sample filename.
// Shared by the bundled-kit loader and the upload feature so both place
// samples on pads the same way. Heuristic + always overridable by hand.
// ═══════════════════════════════════════════════════════════════════

// General-MIDI-ish target notes per drum role.
export const ROLE_NOTES = {
    kick: 36,
    rimshot: 37,
    snare: 38,
    clap: 39,
    closedHat: 42,
    pedalHat: 44,
    lowTom: 45,
    openHat: 46,
    midTom: 47,
    tom: 48,
    crash: 49,
    highTom: 50,
    ride: 51,
    tambourine: 54,
    cowbell: 56,
    conga: 63,
    shaker: 70,
    clave: 75,
} as const;

// Word rules (checked first): substrings on the lowercased name. Order matters —
// e.g. "open hat" before "hat", specific toms before generic "tom".
// Boundaries use (?<![a-z]) / (?![a-z]) — NOT \b — because filenames glue role
// words to machine numbers ("909clap", "808_boom"), where digits and "_" are
// regex word chars and would defeat \b.
const WORD_RULES: Array<[RegExp, number]> = [
    [/open[\s_-]?hat|hat[\s_-]?open|hat[\s_-]?o(?![a-z])|(?<![a-z])ohh?(?![a-z])/, ROLE_NOTES.openHat],
    [/pedal[\s_-]?hat|hat[\s_-]?p(edal)?(?![a-z])/, ROLE_NOTES.pedalHat],
    [/closed[\s_-]?hat|hat[\s_-]?c(losed)?(?![a-z])|hi[\s_-]?hat|hihat|(?<![a-z])hat(?![a-z])/, ROLE_NOTES.closedHat],
    [/crash/, ROLE_NOTES.crash],
    [/ride/, ROLE_NOTES.ride],
    [/cowbell/, ROLE_NOTES.cowbell],
    [/tambou?rine/, ROLE_NOTES.tambourine],
    [/cabasa|shaker|maraca/, ROLE_NOTES.shaker],
    [/clave/, ROLE_NOTES.clave],
    [/conga|bongo/, ROLE_NOTES.conga],
    [/rim[\s_-]?shot|rimshot|side[\s_-]?stick|(?<![a-z])rim(?![a-z])/, ROLE_NOTES.rimshot],
    [/hand[\s_-]?clap|(?<![a-z])clap(?![a-z])/, ROLE_NOTES.clap],
    [/low[\s_-]?tom|lo[\s_-]?tom|tom[\s_-]?lo(w)?|doomtom/, ROLE_NOTES.lowTom],
    [/mid[\s_-]?tom|tom[\s_-]?mid/, ROLE_NOTES.midTom],
    [/high?[\s_-]?tom|tom[\s_-]?hi(gh)?|big[\s_-]?tom/, ROLE_NOTES.highTom],
    [/(?<![a-z])tom(?![a-z])|timbale/, ROLE_NOTES.tom],
    [/snare|esnare/, ROLE_NOTES.snare],
    [/kick|bass[\s_-]?drum|(?<![a-z])boom(?![a-z])/, ROLE_NOTES.kick],
];

// 2-letter machine codes (Roland etc). Must be bounded by non-letters on BOTH
// sides so "MaxV" doesn't read as "ma"(raca) and "roland" doesn't read as
// "rd"(ride). Digits/spaces/punct count as boundaries, so "808Ch", "BD0050",
// "Oh25", "Lt00" all match. Checked after word rules.
const CODE_NOTES: Record<string, number> = {
    bd: ROLE_NOTES.kick, sd: ROLE_NOTES.snare, rs: ROLE_NOTES.rimshot,
    cp: ROLE_NOTES.clap, oh: ROLE_NOTES.openHat, ph: ROLE_NOTES.pedalHat,
    ch: ROLE_NOTES.closedHat, hh: ROLE_NOTES.closedHat, cy: ROLE_NOTES.crash,
    rd: ROLE_NOTES.ride, rc: ROLE_NOTES.ride, cb: ROLE_NOTES.cowbell,
    ma: ROLE_NOTES.shaker, cl: ROLE_NOTES.clave, lc: ROLE_NOTES.conga,
    mc: ROLE_NOTES.conga, hc: ROLE_NOTES.conga, lt: ROLE_NOTES.lowTom,
    mt: ROLE_NOTES.midTom, ht: ROLE_NOTES.highTom,
};

/** Guess the drum note for a single filename, or null if nothing matches. */
export function detectDrumNote(filename: string): number | null {
    const name = filename.replace(/\.[a-z0-9]+$/i, '').toLowerCase();

    for (const [re, note] of WORD_RULES) {
        if (re.test(name)) return note;
    }
    for (const [code, note] of Object.entries(CODE_NOTES)) {
        if (new RegExp(`(?:^|[^a-z])${code}(?:$|[^a-z])`).test(name)) return note;
    }
    return null;
}

/**
 * Assign a whole kit's filenames to distinct MIDI notes.
 * - Detected samples take their role note; a second sample wanting the same
 *   note spills to the next free note so nothing is silently overwritten.
 * - Undetected samples spill into a high range so they're still playable.
 * Returns filename -> note.
 */
export function buildKitNoteMap(filenames: string[]): Record<string, number> {
    const used = new Set<number>();
    const map: Record<string, number> = {};

    const claimFrom = (start: number): number => {
        let n = start;
        while (used.has(n) && n < 127) n++;
        used.add(n);
        return n;
    };

    // First pass: detected samples get their role note (or nearest free above).
    const undetected: string[] = [];
    for (const f of filenames) {
        const note = detectDrumNote(f);
        if (note === null) { undetected.push(f); continue; }
        map[f] = used.has(note) ? claimFrom(note + 1) : (used.add(note), note);
    }

    // Second pass: undetected samples spill starting at 60 (C4), skipping used.
    for (const f of undetected) {
        map[f] = claimFrom(60);
    }

    return map;
}
