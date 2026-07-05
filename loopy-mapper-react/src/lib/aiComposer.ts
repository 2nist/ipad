// ═══════════════════════════════════════════════════════════════════
// AI COMPOSER — Template song structures, chord suggestions,
// and module-to-section assignment
// ═══════════════════════════════════════════════════════════════════

import type { SongSection, ChordStep, ModuleCard, ChordQuality } from '../types';

export interface SongTemplate {
    name: string;
    genre: string;
    sections: {
        name: string;
        bars: number;
        suggestedModules: string[]; // tags
    }[];
}

export const SONG_TEMPLATES: SongTemplate[] = [
    {
        name: "Pop",
        genre: "Pop",
        sections: [
            { name: "Intro", bars: 4, suggestedModules: ["drums", "bass"] },
            { name: "Verse", bars: 8, suggestedModules: ["drums", "bass", "pad", "rhythm"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "pad", "lead", "rhythm"] },
            { name: "Verse", bars: 8, suggestedModules: ["drums", "bass", "pad", "rhythm"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "pad", "lead", "rhythm"] },
            { name: "Bridge", bars: 8, suggestedModules: ["pad", "bass"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "pad", "lead", "rhythm"] },
            { name: "Outro", bars: 4, suggestedModules: ["drums", "bass"] },
        ],
    },
    {
        name: "Rock",
        genre: "Rock",
        sections: [
            { name: "Intro", bars: 4, suggestedModules: ["drums", "rhythm"] },
            { name: "Verse", bars: 8, suggestedModules: ["drums", "bass", "rhythm"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "lead", "rhythm"] },
            { name: "Verse", bars: 8, suggestedModules: ["drums", "bass", "rhythm"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "lead", "rhythm"] },
            { name: "Bridge", bars: 4, suggestedModules: ["bass", "pad"] },
            { name: "Solo", bars: 8, suggestedModules: ["drums", "bass", "lead"] },
            { name: "Chorus", bars: 8, suggestedModules: ["drums", "bass", "lead", "rhythm"] },
            { name: "Outro", bars: 4, suggestedModules: ["drums", "bass"] },
        ],
    },
    {
        name: "Blues",
        genre: "Blues",
        sections: [
            { name: "Intro", bars: 4, suggestedModules: ["guitar", "bass"] },
            { name: "Verse", bars: 12, suggestedModules: ["drums", "bass", "guitar"] },
            { name: "Chorus", bars: 12, suggestedModules: ["drums", "bass", "guitar", "lead"] },
            { name: "Verse", bars: 12, suggestedModules: ["drums", "bass", "guitar"] },
            { name: "Chorus", bars: 12, suggestedModules: ["drums", "bass", "guitar", "lead"] },
            { name: "Outro", bars: 4, suggestedModules: ["guitar", "bass"] },
        ],
    },
    {
        name: "Electronic",
        genre: "Electronic",
        sections: [
            { name: "Intro", bars: 8, suggestedModules: ["pad", "rhythm"] },
            { name: "Build", bars: 8, suggestedModules: ["drums", "pad", "bass"] },
            { name: "Drop", bars: 16, suggestedModules: ["drums", "bass", "lead", "pad", "rhythm"] },
            { name: "Break", bars: 8, suggestedModules: ["pad"] },
            { name: "Build", bars: 8, suggestedModules: ["drums", "pad", "bass"] },
            { name: "Drop", bars: 16, suggestedModules: ["drums", "bass", "lead", "pad", "rhythm"] },
            { name: "Outro", bars: 8, suggestedModules: ["pad"] },
        ],
    },
    {
        name: "Jazz",
        genre: "Jazz",
        sections: [
            { name: "Intro", bars: 4, suggestedModules: ["piano", "bass"] },
            { name: "Head", bars: 16, suggestedModules: ["drums", "bass", "piano"] },
            { name: "Solo 1", bars: 16, suggestedModules: ["drums", "bass", "piano", "lead"] },
            { name: "Solo 2", bars: 16, suggestedModules: ["drums", "bass", "piano", "lead"] },
            { name: "Head", bars: 16, suggestedModules: ["drums", "bass", "piano"] },
            { name: "Outro", bars: 4, suggestedModules: ["piano", "bass"] },
        ],
    },
];

/**
 * Suggest a song structure from a template
 */
export function suggestStructure(genre: string): SongSection[] | null {
    const template = SONG_TEMPLATES.find(t =>
        t.genre.toLowerCase() === genre.toLowerCase()
    );
    if (!template) return null;

    return template.sections.map((s, i) => ({
        id: `template-${i}`,
        name: s.name,
        bars: s.bars,
        transition: "nextBar" as const,
        chordProgression: [],
        activeModules: [],
    }));
}

/**
 * Get available genres
 */
export function getAvailableGenres(): string[] {
    return SONG_TEMPLATES.map(t => t.genre);
}

/**
 * Auto-assign modules to sections based on tag matching
 */
export function arrangeModulesToSections(
    modules: ModuleCard[],
    sections: SongSection[],
    template: SongTemplate | null,
): SongSection[] {
    if (!template) return sections;

    return sections.map((section, i) => {
        const templateSection = template.sections[i];
        if (!templateSection) return section;

        // Match module labels to suggested tags (case-insensitive fuzzy match)
        const activeModules: string[] = [];
        for (const mod of modules) {
            const modLabel = mod.label.toLowerCase();
            const matches = templateSection.suggestedModules.some(tag =>
                modLabel.includes(tag) || mod.type === tag
            );
            // Also match by module type
            const typeMatch = templateSection.suggestedModules.some(tag => {
                if (tag === 'drums' || tag === 'rhythm') return mod.type === 'rhythm';
                if (tag === 'pad' || tag === 'lead' || tag === 'piano' || tag === 'harmonic') return mod.type === 'harmonic';
                if (tag === 'bass' || tag === 'guitar') return mod.type === 'harmonic';
                return false;
            });

            if (matches || typeMatch) {
                activeModules.push(mod.id);
            }
        }

        return { ...section, activeModules };
    });
}

/**
 * Common chord progressions by key and style
 */
export const COMMON_PROGRESSIONS: Record<string, Array<{ degrees: number[]; qualities: ChordQuality[] }>> = {
    major: [
        { degrees: [1, 4, 5, 1], qualities: ['maj', 'maj', 'maj', 'maj'] },
        { degrees: [1, 5, 6, 4], qualities: ['maj', 'maj', 'min', 'maj'] },
        { degrees: [1, 6, 4, 5], qualities: ['maj', 'min', 'maj', 'maj'] },
        { degrees: [2, 5, 1], qualities: ['min', 'dom7', 'maj'] },
        { degrees: [1, 4, 6, 5], qualities: ['maj', 'maj', 'min', 'maj'] },
        { degrees: [1, 3, 4, 4], qualities: ['maj', 'min', 'maj', 'maj'] },
        { degrees: [6, 4, 1, 5], qualities: ['min', 'maj', 'maj', 'maj'] },
    ],
    minor: [
        { degrees: [1, 4, 5, 1], qualities: ['min', 'min', 'min', 'min'] },
        { degrees: [1, 6, 7, 1], qualities: ['min', 'maj', 'maj', 'min'] },
        { degrees: [1, 4, 7, 6], qualities: ['min', 'min', 'maj', 'maj'] },
        { degrees: [2, 5, 1], qualities: ['dim', 'dom7', 'min'] },
        { degrees: [1, 6, 4, 5], qualities: ['min', 'maj', 'min', 'min'] },
        { degrees: [1, 4, 6, 5], qualities: ['min', 'min', 'maj', 'min'] },
    ],
};

/**
 * Suggest chords for a section based on key and scale
 */
export function suggestChords(
    key: string,
    scale: string,
    sectionBars: number,
    style?: string,
): ChordStep[] {
    const isMajor = scale === 'major';
    const pool = isMajor ? COMMON_PROGRESSIONS.major : COMMON_PROGRESSIONS.minor;

    // Pick a progression (deterministic based on key + bars)
    const index = (key.charCodeAt(0) + sectionBars) % pool.length;
    const prog = pool[index];
    if (!prog) return [];

    // Distribute across section bars
    return prog.degrees.map((degree, i) => {
        const stepBars = Math.floor(sectionBars / prog.degrees.length);
        const isLast = i === prog.degrees.length - 1;
        return {
            degree,
            quality: prog.qualities[i] || 'maj',
            duration: isLast ? sectionBars - stepBars * i : stepBars,
        };
    });
}