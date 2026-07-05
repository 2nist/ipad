interface SongSection {
    id: string;
    name: string;
    bars: number;
    transition: TransitionMode;
    chordProgression: ChordStep[];
    activeModules: string[];      // ModuleCard IDs active in this section
    
    // NEW: optional markers/regions within the section
    markers?: SectionMarker[];
}

interface SectionMarker {
    beat: number;                 // Beat offset from section start
    label: string;                // "Fill here", "Drop", "Solo start"
    type: "cue" | "loopPoint" | "expressionTrigger";
    /** Optional: which module this marker targets */
    targetModuleId?: string;
}
