// ═══════════════════════════════════════════════════════════════════
// LOOPY MAPPER REACT — Complete Domain Model
// Source: Developstage3 architecture documents (arrangement overview,
//         arrangementconcept, compositioncanvasconcept, expressionconcept,
//         harmonicengineconcept, Looperconcept, rhythmconcept,
//         Songsectionconcept, Soundconcept)
// ═══════════════════════════════════════════════════════════════════

// ─── Module Core Types ─────────────────────────────────────────────

export type ModuleType = "rhythm" | "harmonic" | "arrangement";
export type ModuleSize = "sm" | "md" | "lg";
export type LoopBehavior = "toggle" | "recordAutoPlay" | "recordWait" | "oneShot";
export type QuantizationPreset = "1_16" | "1_8" | "1_4" | "1_bar" | "2_bar" | "4_bar" | "8_bar";
export type BusColor = "red" | "blue" | "green";
export type TrackState = "empty" | "recording" | "playing" | "muted" | "soloed";

export type RhythmMode = "loop" | "fill" | "clip";

export interface ModuleCard {
    id: string;
    type: ModuleType;
    label: string;
    size: ModuleSize;
    colorAccent: string;
    bus: BusColor;
    tracks: ModuleTrackConfig[];
    quantization: QuantizationPreset;
    quantizationEnabled: boolean;
    baseMidiNote: number;
    isPreset: boolean;
    presetId?: string;
    readonly shapeConfig?: RhythmShapeConfig;
    expression?: ModuleExpression;
    /** Rhythm modules: loop mode (continuously loop), fill (triggered variation), clip (play once) */
    rhythmMode?: RhythmMode;
    /** Auto-assigned pattern name from mineral list (e.g., "Quartz", "Onyx"). Used for display labels. */
    patternName?: string;
    /** Optional timeline positioning. If set, module only activates when playhead is within range. */
    position?: {
        startBeat: number;
        lengthBeats: number;
    };
    /** Optional canvas position for infinite canvas. x/y in logical pixels. */
    canvasPosition?: {
        x: number;
        y: number;
    };
}

export interface ModuleTrackConfig {
    index: number;
    label: string;
    midiNote: number;
    pan: number;
    volume: number;
    actions: ModuleActionRef[];
    loopBehavior: LoopBehavior;
    loopCount?: number;
    volumeRampMs: number;
    muteGroup?: string;
    soundSource: SoundSource;
    /** Sample-specific: start offset in ms, duration in ms */
    sampleStart?: number;
    sampleDuration?: number;
}

export interface ModuleActionRef {
    actionId: string;
    enabled: boolean;
    triggerNote?: number;
    quantizationOverride?: QuantizationPreset;
}

// ─── Module Presets ────────────────────────────────────────────────

export interface ModulePreset {
    id: string;
    name: string;
    description: string;
    moduleType: ModuleType;
    defaults: ModuleCard;
    tags: string[];
}

// ─── Sound Source Types ────────────────────────────────────────────

export type SoundSourceType = "audioInput" | "midiClip" | "liveMidi" | "sample";

export interface AudioInputSource {
    type: "audioInput";
    inputChannel: number;
    monitorEnabled: boolean;
}

export interface MidiClipSource {
    type: "midiClip";
    clipId: string | null;
    clipData?: ArrayBuffer;
    soundEngine: SoundEngine;
    transpose: number;
    velocityScale: number;
    followChordProgression?: boolean;
    transposeScaleAware?: boolean;
}

export interface LiveMidiSource {
    type: "liveMidi";
    midiChannel: number;
    soundEngine: SoundEngine;
    recordMidi: boolean;
    recordedSequence?: MidiEvent[];
}

export interface SampleSource {
    type: "sample";
    sampleId: string | null;
    sampleUrl?: string;
    sampleName?: string;
    sampleDurationMs?: number;
    soundEngine: SamplerEngine;
    transpose: number;
    velocityScale: number;
    triggerMode: "oneShot" | "gate";
}

export type SoundSource = AudioInputSource | MidiClipSource | LiveMidiSource | SampleSource;

export interface MidiEvent {
    deltaTime: number;
    type: "noteOn" | "noteOff";
    note: number;
    velocity: number;
}

// ─── Sound Engine Types ────────────────────────────────────────────

export type SoundEngineType = "tonejsPolySynth" | "sampler" | "midiOut";

export interface ToneJsPolySynthEngine {
    type: "tonejsPolySynth";
    synthConfig?: {
        oscillatorType: "triangle" | "sine" | "square" | "sawtooth";
        attack: number;
        decay: number;
        sustain: number;
        release: number;
    };
}

export interface SamplerEngine {
    type: "sampler";
    sampleMap: Record<number, string>;
    rootNote: number;
}

export interface MidiOutEngine {
    type: "midiOut";
    outputDeviceId: string;
    outputChannel: number;
}

export type SoundEngine = ToneJsPolySynthEngine | SamplerEngine | MidiOutEngine;

// ─── Song Structure Types ──────────────────────────────────────────

export interface SongObject {
    metadata: SongMetadata;
    modules: ModuleCard[];
    arrangement: SongSection[];
    midiBindings: MidiBinding[];
}

/** External Song Object format for import/export — aligns with schemas/song-object.schema.json */
export interface SongObjectExport {
    schemaVersion: string;
    metadata: SongMetadata;
    structure: SongSection[];
    modules: ModuleCard[];
    midiBindings?: MidiBinding[];
    provenance?: SongProvenance;
}

export interface SongProvenance {
    sourceUrl?: string;
    sourceName?: string;
    confidence?: number;
    generatedBy?: string;
    generatedAt?: string;
    references?: ProvenanceReference[];
}

export interface ProvenanceReference {
    type: "lrclib" | "spotify" | "musicbrainz" | "hooktheory" | "manual" | "aiInference";
    url?: string;
    id?: string;
    retrievedAt?: string;
}

export interface SongMetadata {
    title: string;
    artist?: string;
    bpm: number;
    timeSignature: TimeSignature;
    key: string;
    scale: string;
    genre?: string;
    tags?: string[];
    duration?: number;
    difficulty?: number;
}

export interface TimeSignature {
    numerator: TimeSignatureNumerator;
    denominator: TimeSignatureDenominator;
}

export type TimeSignatureNumerator = 2 | 3 | 4 | 5 | 6 | 7 | 9 | 12;
export type TimeSignatureDenominator = 2 | 4 | 8 | 16;

export type TransitionMode = "instant" | "nextBar" | "fade";

export interface LyricLine {
    text: string;
    timestampMs?: number;
    durationMs?: number;
}

export interface SongSection {
    id: string;
    name: string;
    bars: number;
    transition: TransitionMode;
    chordProgression: ChordStep[];
    activeModules: string[];
    markers?: SectionMarker[];
    lyrics?: LyricLine[];
    sourceTimestamps?: {
        startMs: number;
        endMs: number;
    };
}

export interface SectionMarker {
    beat: number;
    label: string;
    type: "cue" | "loopPoint" | "expressionTrigger";
    targetModuleId?: string;
}

export type ChordQuality = "maj" | "min" | "dim" | "aug" | "dom7" | "maj7" | "min7";

export interface ChordStep {
    degree: number;
    quality: ChordQuality;
    duration: number;
}

// ─── Arrangement Module Types ──────────────────────────────────────

export interface ArrangementModuleConfig {
    sections: SongSection[];
    activeSectionIndex: number;
    endBehavior: "loop" | "stop" | "continue";
    defaultTransition: TransitionMode;
    defaultFadeBars: number;
    defaultFadeCurve: "linear" | "equalPower" | "slowFade";
    allowSkip: boolean;
    allowRepeat: boolean;
    quantizeTriggers: boolean;
    holdOnSectionEnd: boolean;
    metronomeEnabled: boolean;
    metronomeVolume: number;
    metronomeSound: "classic" | "electronic" | "sidestick";
    slaveModuleIds: string[];
    activeSlaves: Record<string, string[]>;
}

export interface TransitionState {
    type: TransitionMode;
    progress: number;
    fadingOut: string[];
    fadingIn: string[];
    expressionActive: boolean;
}

export interface SectionContext {
    sectionId: string;
    sectionName: string;
    bars: number;
    timeSignature: TimeSignature;
    chordProgression?: ChordStep[];
    transition: TransitionMode;
}

export interface SectionModuleOverride {
    moduleId: string;
    sectionId: string;
    volume?: number;
    mute?: boolean;
    transpose?: number;
    expressionForceTrigger?: boolean;
}

// ─── Transport & Clock Types ───────────────────────────────────────

export interface ClockPosition {
    absoluteBeat: number;
    barInSection: number;
    beatInBar: number;
    tickInBeat: number;
    sectionId: string;
    beatInSection: number;
    elapsedBeatsInSection: number;
    remainingBeatsInSection: number;
}

export interface TransportClock {
    bpm: number;
    timeSignature: TimeSignature;
    isPlaying: boolean;
    currentBeat: number;
    currentBar: number;
    currentTick: number;
    advance(deltaTimeMs: number): void;
    scheduleAt(beat: number, callback: () => void): void;
    start(): void;
    stop(): void;
    /** Stop the scheduler but preserve position — pairs with resume(). */
    pause(): void;
    /** Resume playback from the position left by pause(). */
    resume(): void;
    toggle(): void;
    setBpm(bpm: number): void;
    tapTempo(): void;
    getPosition(): ClockPosition;
    scheduleBeat(offset: number, callback: () => void): void;
    scheduleBar(offset: number, callback: () => void): void;
    scheduleTick(offset: number, callback: () => void): void;
    registerSubscriber(subscriber: ClockSubscriber): void;
    unregisterSubscriber(id: string): void;
}

export type ClockSource = "internal" | "midiClock";

export interface InternalClockConfig {
    source: "internal";
    audioContext: AudioContext;
    scheduleAhead: number;
    schedulerInterval: number;
}

export interface MidiClockConfig {
    source: "midiClock";
    midiInputId: string;
    incomingPpqn: number;
    autoStart: boolean;
}

export interface ClockSubscriber {
    id: string;
    onTick?: (position: ClockPosition) => void;
    onStart?: (position: ClockPosition) => void;
    onStop?: (position: ClockPosition) => void;
    onBeat?: (position: ClockPosition) => void;
    onBar?: (position: ClockPosition) => void;
    onBpmChange?: (bpm: number) => void;
    onTimeSignatureChange?: (ts: TimeSignature) => void;
}

// ─── MIDI Types ────────────────────────────────────────────────────

export interface MidiBinding {
    id: string;
    trigger: MidiTrigger;
    target: string;
    actions: MidiAction[];
    moduleId: string;
    autoGenerated: boolean;
    label?: string;
}

export interface MidiTrigger {
    type: "noteOn" | "noteOff" | "cc" | "programChange" | "pitchBend";
    note?: number;
    ccNumber?: number;
    channel: number | null;
    velocityMin?: number;
    velocityMax?: number;
}

export interface MidiAction {
    command: string;
    param?: ParamChange;
    sectionIndex?: number;
}

export interface ParamChange {
    type: string;
    target: string;
    value: number;
    rampTimeMs?: number;
}

// ─── Action Library Types ──────────────────────────────────────────

export interface ActionDef {
    id: string;
    name: string;
    category: "clip" | "global" | "clock" | "session" | "effect";
    appliesTo: ModuleType[];
    paramSchema?: ParamSchema;
}

export interface ParamSchema {
    fields: {
        key: string;
        type: "float" | "int" | "choice" | "bool";
        label: string;
        default: number | string | boolean;
        choices?: { label: string; value: string }[];
        min?: number;
        max?: number;
    }[];
}

// ─── Harmony Engine Types ──────────────────────────────────────────

export interface HarmonyState {
    progression: ChordStep[];
    currentStepIndex: number;
    beatInStep: number;
    beatsUntilNextStep: number;
    activeChord: ResolvedChord;
    previousChord: ResolvedChord | null;
    isLooping: boolean;
    cadenceType: "authentic" | "plagal" | "deceptive" | "half" | "none";
}

export interface ResolvedChord {
    degree: number;
    quality: ChordQuality;
    rootNote: number;
    rootOctave: number;
    chordTones: number[];
    noteNames: string[];
}

export interface HarmonicModuleConfig {
    scaleDegrees: ScaleDegreeMap;
    detectCadence: boolean;
    allowBorrowedChords: boolean;
    voicing: VoicingConfig;
    clipFilter: ClipFilterConfig;
    scaleSnapMode: ScaleSnapMode;
    showProgressionTimeline: boolean;
    showNoteNames: boolean;
}

export interface ScaleDegreeMap {
    natural: ChordQuality[];
    available: Record<number, ChordQuality[]>;
}

export type VoicingStrategy = "closeRoot" | "closeFirst" | "closeSecond" | "open" | "drop2" | "drop3" | "spread";

export interface VoicingConfig {
    strategy: VoicingStrategy;
    minNote: number;
    maxNote: number;
    smoothVoiceLeading: boolean;
    voiceCount: number;
    rootDoubling: boolean;
}

export type ClipFilterMode = "keyMatch" | "chordToneMatch" | "progressionMatch";

export interface ClipFilterConfig {
    mode: ClipFilterMode;
    minDensity: number;
    maxDensity: number;
    datasets: ("e-gmd" | "tegridy")[];
    autoAssign: boolean;
    matchThreshold: number;
}

export type ScaleSnapMode = "off" | "scale" | "chordTones" | "chordTonesStrict";

export interface ClipSuggestion {
    clipId: string;
    metadata: ClipMetadata;
    matchScore: number;
    chordStepIndex: number;
}

export interface ClipMetadata {
    key: string;
    scale: string;
    density: number;
    bars: number;
    dataset: string;
    name: string;
    pitchClassVector: number[];
}

// ─── Rhythm Shape Types ────────────────────────────────────────────

export interface RhythmShapeConfig {
    numerator: {
        vertices: number;
        svgPoints: string;
        splitLine: boolean;
        splitLineType: "none" | "diagonal" | "horizontal";
    };
    denominator: {
        vertices: number;
        svgPoints: string;
        scale: number;
    };
}

// ─── Expression Submodule Types ────────────────────────────────────

export type ExpressionBehavior = "replace" | "layer" | "morph";

export interface ExpressionTrigger {
    type: "everyNRepeats" | "onSectionChange" | "manual" | "random";
    everyN?: number;
    probability?: number;
    fromSection?: string;
    toSection?: string;
}

export interface RhythmExpression {
    type: "fill";
    clipId: string | null;
    clipData?: ArrayBuffer;
    trigger: ExpressionTrigger;
    offsetBeats: number;
    durationBeats: number;
    behavior: ExpressionBehavior;
    soundEngine: SoundEngine;
    transpose: number;
    enabled: boolean;
}

export interface HarmonicExpression {
    type: "variation";
    chordProgressionOverride?: ChordStep[];
    clipId?: string | null;
    clipData?: ArrayBuffer;
    trigger: ExpressionTrigger;
    durationBars?: number;
    behavior: ExpressionBehavior;
    soundEngine?: SoundEngine;
    transpose: number;
    enabled: boolean;
}

export interface ArrangementExpression {
    type: "transition";
    fromSection: string;
    toSection: string;
    trigger: ExpressionTrigger;
    clipId: string | null;
    clipData?: ArrayBuffer;
    offsetBeats: number;
    durationBeats: number;
    behavior: ExpressionBehavior;
    soundEngine: SoundEngine;
    transpose: number;
    enabled: boolean;
}

export type ModuleExpression = RhythmExpression | HarmonicExpression | ArrangementExpression;

// ─── Runtime State Types ───────────────────────────────────────────

export interface ModuleRuntimeState {
    moduleId: string;
    isActive: boolean;
    tracks: TrackRuntimeState[];
    harmony?: HarmonyRuntimeState;
    expression?: ExpressionRuntimeState;
    repeatCount: number;
    effectiveVolume: number;
    isSectionMuted: boolean;
}

export interface TrackRuntimeState {
    trackIndex: number;
    state: TrackState;
    volume: number;
    pan: number;
    activeTranspose: number;
    levelLeft: number;
    levelRight: number;
}

export interface HarmonyRuntimeState {
    progression: ChordStep[];
    currentStepIndex: number;
    activeChord: ResolvedChord;
    previousChord: ResolvedChord | null;
    beatsInStep: number;
    beatsUntilNext: number;
    cadenceType: string;
}

export interface ExpressionRuntimeState {
    isActive: boolean;
    remainingBeats: number;
    nextTriggerRepeat: number;
}

// ─── UI State Types ────────────────────────────────────────────────

export type ModalDialog =
    | { type: "none" }
    | { type: "addModule" }
    | { type: "moduleEditor"; moduleId: string }
    | { type: "sectionEditor"; sectionId: string }
    | { type: "aiStructure" }
    | { type: "aiChords"; sectionId: string }
    | { type: "aiArrange" }
    | { type: "about" };

export type EditorPanel =
    | { type: "none" }
    | { type: "track"; moduleId: string; trackIndex: number }
    | { type: "module"; moduleId: string }
    | { type: "section"; sectionId: string }
    | { type: "expression"; moduleId: string };

export interface CanvasViewState {
    viewLevel: "sectionsOnly" | "sectionsWithModules" | "fullComposition";
    selectedSectionIds: string[];
    selectedModuleIds: string[];
    zoomLevel: number;
    scrollPosition: number;
    chordEditorOpen: boolean;
    chordEditorBarIndex: number | null;
    isPlaying: boolean;
    playheadPosition: number;
}

export interface ClipBrowserFilters {
    key: string | null;
    scale: string | null;
    dataset: string | null;
    minDensity: number | null;
    maxDensity: number | null;
    minBars: number | null;
    maxBars: number | null;
}

// Imported from lib/api.ts — ClipSearchResponse is the canonical search result type
export type ClipSearchResult = {
    total: number;
    limit: number;
    offset: number;
    clips: any[];
};

// ─── Store Type ────────────────────────────────────────────────────

export interface LooperStore {
    song: SongObject;
    transport: {
        isPlaying: boolean;
        isRecording: boolean;
        position: ClockPosition;
        activeSectionId: string | null;
        activeSectionIndex: number;
    };
    engines: {
        audioContext: AudioContext | null;
        looperEngine: unknown | null;
        clockEngine: TransportClock | null;
        midiRouter: import('../lib/midiRouter').MidiRouter | null;
        initialized: boolean;
    };
    ui: {
        activeModal: ModalDialog;
        activeEditorPanel: EditorPanel;
        editingModuleId: string | null;
        editingTrackIndex: number | null;
        clipBrowserOpen: boolean;
        sidebarVisible: boolean;
        rightPanelVisible: boolean;
        lyrics: string;
        lyricsSectionId: string | null;
        canvasView: CanvasViewState;
        midiLearnTarget: string | null;
        midiActivity: boolean;
        midiDeviceConnected: boolean;
        audioInitialized: boolean;
        canvasLockSize: boolean;
        canvasLockPosition: boolean;
        assigningModuleId: string | null;
        midiEditorOpen: boolean;
        midiEditorModuleId: string | null;
        midiEditorTrackIndex: number | null;
        drumBrowserOpen: boolean;
    };
    moduleStates: Record<string, ModuleRuntimeState>;
    clipBrowser: {
        filters: ClipBrowserFilters;
        results: ClipSearchResult | null;
        loading: boolean;
        error: string | null;
        activePreviewId: string | null;
    };
}

// ─── Store Actions ─────────────────────────────────────────────────

export interface LooperStoreActions {
    // Song actions
    addModule(preset: ModulePreset): string;
    removeModule(moduleId: string): void;
    updateModule(moduleId: string, updates: Partial<ModuleCard>): void;
    moveModule(moduleId: string, newIndex: number): void;
    addSection(afterIndex?: number): string;
    removeSection(sectionId: string): void;
    updateSection(sectionId: string, updates: Partial<SongSection>): void;
    moveSection(sectionId: string, newIndex: number): void;
    setChordStep(sectionId: string, barIndex: number, chord: ChordStep): void;
    addSectionMarker(sectionId: string, marker: SectionMarker): void;
    removeSectionMarker(sectionId: string, markerIndex: number): void;
    setSongMetadata(updates: Partial<SongMetadata>): void;

    // Track actions
    updateTrack(moduleId: string, trackIndex: number, updates: Partial<ModuleTrackConfig>): void;
    assignClipToTrack(moduleId: string, trackIndex: number, clipId: string): void;
    setSoundSource(moduleId: string, trackIndex: number, source: SoundSource): void;
    setSoundEngine(moduleId: string, trackIndex: number, engine: SoundEngine): void;

    // Transport actions
    globalPlay(): void;
    globalStop(): void;
    globalRecord(): void;
    setBpm(bpm: number): void;
    tapTempo(): void;
    nudgeBpm(delta: number): void;
    jumpToSection(sectionId: string): void;
    nextSection(): void;
    previousSection(): void;
    setTransitionMode(mode: TransitionMode): void;

    // Engine actions
    initializeEngines(): Promise<void>;
    suspendEngines(): void;
    resumeEngines(): void;

    // UI actions
    setModal(modal: ModalDialog): void;
    closeModal(): void;
    setEditorPanel(panel: EditorPanel, moduleId?: string, trackIndex?: number): void;
    closeEditor(): void;
    setCanvasView(view: Partial<CanvasViewState>): void;
    setMidiLearnTarget(target: string | null): void;
    toggleClipBrowser(): void;

    // File actions
    newSong(metadata: SongMetadata): void;
    saveSong(): SongObject;
    loadSong(song: SongObject): void;
    exportSong(): void;

    // Preset actions
    saveModulePreset(moduleId: string, name: string, description: string): void;
    loadModulePreset(presetId: string): ModuleCard;
    deleteUserPreset(presetId: string): void;
}

// ─── Legacy Loopy Pro Types (kept for reference / backward compat) ──

export interface ActionEntry {
    name: string;
    id: string | null;
    category: string;
    verified: boolean;
    aliases: string[];
    params?: { key: string; type: string; description: string }[];
}

export interface TargetEntry {
    name: string;
    encoding: string | null;
    verified: boolean;
}

export interface ValuePayload {
    adjustmentType: "absolute" | "relative" | "toggle";
    value: number;
    rampTimeMs: number;
}

export interface NormalizedAction {
    identifier: string;
    subject: string;
    timing: string;
    parameters: Record<string, unknown>;
    valuePayload: ValuePayload | null;
}

export interface NormalizedBinding {
    label: string;
    trigger: Record<string, unknown> | null;
    triggerString: string;
    actions: NormalizedAction[];
}