// ═══════════════════════════════════════════════════════════════════
// MIDI ROUTER — Receives WebMIDI input, auto-maps to module tracks,
// dispatches to LooperEngine (audio) or SynthEngine (MIDI)
// ═══════════════════════════════════════════════════════════════════

import type { LooperStoreType } from "../store/store";
import type {
    MidiBinding, MidiTrigger, MidiAction, ModuleCard,
    ModuleTrackConfig, MidiEvent, LiveMidiSource,
} from "../types";
import { synthEngine } from "./synthEngine";
import { looperEngine } from "./audio-worklet";

export type RouterEventCallback = (event: {
    type: "noteOn" | "noteOff" | "cc" | "learn";
    note?: number;
    value?: number;
    channel?: number;
    moduleId?: string;
    trackIndex?: number;
    action?: string;
}) => void;

/**
 * MidiRouter — the central MIDI dispatch hub.
 *
 * Architecture:
 *   [[WebMIDI Input]] → MidiRouter.handleMidiMessage()
 *       ├── If MIDI learn active → store binding
 *       ├── Else match note → ModuleTrackConfig via auto-mapping
 *       │   ├── AudioInputSource track → LooperEngine.toggleRecord()
 *       │   ├── MidiClipSource track → SynthEngine.noteOn/noteOff()
 *       │   └── LiveMidiSource track → SynthEngine.noteOn/noteOff()
 *       └── Fire action callbacks for UI sync
 */
export class MidiRouter {
    private store: () => LooperStoreType;
    private midiAccess: MIDIAccess | null = null;
    private inputs: MIDIInput[] = [];
    private bindings: Map<string, MidiBinding> = new Map(); // key: `${channel}:${noteOrCC}`
    private learnMode = false;
    private learnTarget: string | null = null;
    private onEvent: RouterEventCallback | null = null;
    private initialized = false;

    constructor(store: () => LooperStoreType) {
        this.store = store;
    }

    /** Register a callback for UI event visualization. */
    onRouterEvent(callback: RouterEventCallback): void {
        this.onEvent = callback;
    }

    /** Initialize WebMIDI and start listening. */
    async initialize(midiAccess: MIDIAccess): Promise<void> {
        if (this.initialized) return;

        this.midiAccess = midiAccess;

        // Connect existing inputs
        for (const input of midiAccess.inputs.values()) {
            this.connectInput(input);
        }

        // Listen for new inputs being connected
        midiAccess.onstatechange = (event: Event) => {
            const midiEvent = event as MIDIConnectionEvent;
            if (midiEvent.port && midiEvent.port.type === "input") {
                if (midiEvent.port.state === "connected") {
                    this.connectInput(midiEvent.port as MIDIInput);
                } else if (midiEvent.port.state === "disconnected") {
                    this.disconnectInput(midiEvent.port as MIDIInput);
                }
            }
        };

        // Build initial bindings from song data
        this.rebuildBindings();

        this.initialized = true;
        console.log(`[MidiRouter] Initialized with ${this.inputs.length} input(s)`);
    }

    /** Connect a MIDI input port. */
    private connectInput(input: MIDIInput): void {
        if (this.inputs.find(i => i.id === input.id)) return;
        input.onmidimessage = (event: MIDIMessageEvent) => {
            if (event.data) {
                this.handleMidiMessage(event.data);
            }
        };
        this.inputs.push(input);
        console.log(`[MidiRouter] Connected input: ${input.name ?? input.id}`);
    }

    /** Disconnect a MIDI input port. */
    private disconnectInput(input: MIDIInput): void {
        this.inputs = this.inputs.filter(i => i.id !== input.id);
        input.onmidimessage = null;
        console.log(`[MidiRouter] Disconnected input: ${input.name ?? input.id}`);
    }

    /** Handle an incoming MIDI message. */
    private handleMidiMessage(data: Uint8Array): void {
        if (data.length < 2) return;

        const status = data[0];
        const data1 = data[1];
        const data2 = data.length > 2 ? data[2] : 0;
        const msgType = status & 0xf0;
        const channel = (status & 0x0f) + 1;
        const velocity = data2 / 127;

        // Note On (0x90) with velocity > 0
        if (msgType === 0x90 && velocity > 0) {
            this.handleNoteOn(channel, data1, velocity);
        }
        // Note Off (0x80) OR Note On with velocity = 0
        else if (msgType === 0x80 || (msgType === 0x90 && velocity === 0)) {
            this.handleNoteOff(channel, data1);
        }
        // CC (0xB0)
        else if (msgType === 0xB0) {
            this.handleCC(channel, data1, velocity);
        }
    }

    /** Handle a Note On message. */
    private handleNoteOn(channel: number, note: number, velocity: number): void {
        // 1. MIDI Learn mode — capture binding
        if (this.learnMode) {
            this.captureLearnBinding(channel, "noteOn", note);
            return;
        }

        // 2. Check explicit bindings first
        const bindingKey = `${channel}:note:${note}`;
        const binding = this.bindings.get(bindingKey);
        if (binding) {
            this.executeBinding(binding, velocity);
            return;
        }

        // 3. Auto-map: find module track by baseMidiNote
        const match = this.findTrackByNote(note);
        if (match) {
            this.executeTrackAction(match.module, match.track, "noteOn", note, velocity);
        }

        this.onEvent?.({
            type: "noteOn", note, value: velocity, channel,
            moduleId: match?.module.id,
            trackIndex: match?.track.index,
        });
    }

    /** Handle a Note Off message. */
    private handleNoteOff(channel: number, note: number): void {
        // 1. Check explicit bindings
        const bindingKey = `${channel}:note:${note}`;
        const binding = this.bindings.get(bindingKey);
        if (binding) {
            this.executeBinding(binding, 0);
            return;
        }

        // 2. Auto-map: find module track by baseMidiNote
        const match = this.findTrackByNote(note);
        if (match) {
            this.executeTrackAction(match.module, match.track, "noteOff", note, 0);
        }

        this.onEvent?.({
            type: "noteOff", note, value: 0, channel,
            moduleId: match?.module.id,
            trackIndex: match?.track.index,
        });
    }

    /** Handle a CC message. */
    private handleCC(channel: number, ccNumber: number, value: number): void {
        if (this.learnMode) {
            this.captureLearnBinding(channel, "cc", ccNumber);
            return;
        }

        const bindingKey = `${channel}:cc:${ccNumber}`;
        const binding = this.bindings.get(bindingKey);
        if (binding) {
            this.executeBinding(binding, value);
        }

        // Also route to LooperEngine for volume control (CC7)
        if (ccNumber === 7) {
            const trackId = channel - 1;
            if (trackId >= 0 && trackId < looperEngine.maxTracks) {
                looperEngine.setVolume(trackId, value);
            }
        }

        this.onEvent?.({
            type: "cc", note: ccNumber, value, channel,
        });
    }

    /**
     * Auto-map: Find the module track whose baseMidiNote + track index
     * matches the incoming MIDI note.
     */
    private findTrackByNote(note: number): { module: ModuleCard; track: ModuleTrackConfig } | null {
        const store = this.store();
        for (const module of store.song.modules) {
            if (module.type === "arrangement") continue; // Arrangement has no audio tracks
            for (const track of module.tracks) {
                const trackNote = module.baseMidiNote + track.index;
                if (trackNote === note) {
                    return { module, track };
                }
            }
        }
        return null;
    }

    /**
     * Execute an action on a module track based on MIDI note.
     * This is the core dispatch — routes to LooperEngine or SynthEngine.
     */
    private executeTrackAction(
        module: ModuleCard,
        track: ModuleTrackConfig,
        eventType: "noteOn" | "noteOff",
        note: number,
        velocity: number,
    ): void {
        const voiceId = `${module.id}:${track.index}`;
        const soundSource = track.soundSource;

        switch (soundSource.type) {
            case "audioInput": {
                // Audio input tracks → LooperEngine record/play
                if (eventType === "noteOn") {
                    looperEngine.toggleRecord(track.index);
                }
                break;
            }

            case "midiClip": {
                // MIDI clip tracks → SynthEngine note on/off
                if (eventType === "noteOn") {
                    synthEngine.noteOn(voiceId, note, velocity);
                } else {
                    synthEngine.noteOff(voiceId, note);
                }
                break;
            }

            case "liveMidi": {
                // Live MIDI passthrough → SynthEngine note on/off
                if (eventType === "noteOn") {
                    synthEngine.noteOn(voiceId, note, velocity);
                    if (soundSource.recordMidi) {
                        this.appendRecordedEvent(module.id, track.index, soundSource, {
                            deltaTime: 0,
                            type: "noteOn",
                            note,
                            velocity: Math.round(velocity * 127),
                        });
                    }
                } else {
                    synthEngine.noteOff(voiceId, note);
                    if (soundSource.recordMidi) {
                        this.appendRecordedEvent(module.id, track.index, soundSource, {
                            deltaTime: 0,
                            type: "noteOff",
                            note,
                            velocity: 0,
                        });
                    }
                }
                break;
            }
        }

        // Also update track runtime state in the store
        const store = this.store();
        if (eventType === "noteOn") {
            const modState = store.moduleStates[module.id];
            if (modState?.tracks[track.index]) {
                // Update track state based on action
                // The looperEngine.toggleRecord already handles recording state
            }
        }
    }

    /** Append a MIDI event to a liveMidi track's recorded sequence through the store. */
    private appendRecordedEvent(
        moduleId: string,
        trackIndex: number,
        soundSource: LiveMidiSource,
        event: MidiEvent,
    ): void {
        this.store().updateTrack(moduleId, trackIndex, {
            soundSource: {
                ...soundSource,
                recordedSequence: [...(soundSource.recordedSequence ?? []), event],
            },
        });
    }

    /** Execute an explicit MidiBinding. */
    private executeBinding(binding: MidiBinding, value: number): void {
        for (const action of binding.actions) {
            this.executeMidiAction(binding.moduleId, action, value);
        }
    }

    /** Execute a single MidiAction from a binding. */
    private executeMidiAction(moduleId: string, action: MidiAction, value: number): void {
        const store = this.store();
        const module = store.song.modules.find(m => m.id === moduleId);
        if (!module) return;

        switch (action.command) {
            case "record":
                looperEngine.toggleRecord(0); // Default to first track
                break;
            case "playStop":
                // Toggle playback
                break;
            case "mute":
                store.setSectionMuted(moduleId, value > 0);
                break;
            case "clear":
                looperEngine.clearTrack(0);
                break;
            case "volume":
                looperEngine.setVolume(0, value);
                break;
            case "bpm":
                store.setBpm(60 + value * 140); // Map 0-1 to 60-200 BPM
                break;
            case "sectionTrigger":
                if (action.sectionIndex !== undefined) {
                    store.jumpToSection(store.song.arrangement[action.sectionIndex]?.id ?? "");
                }
                break;
        }

        // Handle param changes
        if (action.param) {
            switch (action.param.type) {
                case "volume":
                    looperEngine.setVolume(parseInt(action.param.target), action.param.value);
                    break;
                case "pan":
                    // Pan handling — future
                    break;
            }
        }
    }

    // ─── MIDI Learn ──────────────────────────────────────────────────

    /** Enter MIDI learn mode. */
    startLearn(target: string | null = null): void {
        this.learnMode = true;
        this.learnTarget = target;
        console.log(`[MidiRouter] Learn mode started (target: ${target ?? "any"})`);
        this.onEvent?.({ type: "learn" });
    }

    /** Exit MIDI learn mode. */
    stopLearn(): void {
        this.learnMode = false;
        this.learnTarget = null;
        console.log("[MidiRouter] Learn mode stopped");
    }

    /** Check if MIDI learn is active. */
    get isLearning(): boolean {
        return this.learnMode;
    }

    /** Capture a MIDI binding from learn mode. */
    private captureLearnBinding(channel: number, triggerType: "noteOn" | "cc", value: number): void {
        if (!this.learnTarget) return;

        const store = this.store();
        const trigger: MidiTrigger = {
            type: triggerType,
            channel,
            ...(triggerType === "noteOn" ? { note: value } : { ccNumber: value }),
        };

        const binding: MidiBinding = {
            id: `learn-${Date.now()}`,
            trigger,
            target: this.learnTarget,
            actions: [{ command: "custom", param: { type: "learn", target: this.learnTarget, value: 0 } }],
            moduleId: "",
            autoGenerated: true,
            label: `MIDI Learn: ${triggerType} ${value} (ch ${channel})`,
        };

        // Add to store
        store.addMidiBinding(binding);
        this.bindings.set(`${channel}:${triggerType === "noteOn" ? "note" : "cc"}:${value}`, binding);

        console.log(`[MidiRouter] Learned binding: ${binding.label}`);

        // Auto-exit learn mode
        this.stopLearn();
        this.onEvent?.({
            type: "learn",
            note: value,
            channel,
        });
    }

    // ─── Binding Management ──────────────────────────────────────────

    /** Rebuild the binding lookup map from the store's MidiBinding list. */
    rebuildBindings(): void {
        this.bindings.clear();
        const store = this.store();
        for (const binding of store.song.midiBindings) {
            const key = this.bindingKey(binding.trigger);
            if (key) {
                this.bindings.set(key, binding);
            }
        }
    }

    /** Generate a lookup key from a MidiTrigger. */
    private bindingKey(trigger: MidiTrigger): string | null {
        const ch = trigger.channel ?? "*";
        switch (trigger.type) {
            case "noteOn":
            case "noteOff":
                if (trigger.note === undefined) return null;
                return `${ch}:note:${trigger.note}`;
            case "cc":
                if (trigger.ccNumber === undefined) return null;
                return `${ch}:cc:${trigger.ccNumber}`;
            default:
                return null;
        }
    }

    /**
     * Auto-generate MidiBindings from the current module layout.
     * Called when modules are added/removed/reconfigured.
     */
    autoGenerateBindings(): void {
        const store = this.store();
        const newBindings: MidiBinding[] = [];

        for (const module of store.song.modules) {
            if (module.type === "arrangement") continue;

            for (const track of module.tracks) {
                const note = module.baseMidiNote + track.index;
                const binding: MidiBinding = {
                    id: `auto-${module.id}-${track.index}`,
                    trigger: {
                        type: "noteOn",
                        note,
                        channel: null, // Any channel
                    },
                    target: `${module.id}:${track.index}`,
                    actions: track.actions.map(a => ({
                        command: a.actionId,
                    })),
                    moduleId: module.id,
                    autoGenerated: true,
                    label: `${module.label} — ${track.label} (note ${note})`,
                };
                newBindings.push(binding);
            }
        }

        // Merge with existing manual bindings (keep non-auto-generated ones)
        const manualBindings = store.song.midiBindings.filter(b => !b.autoGenerated);
        store.setMidiBindings([...manualBindings, ...newBindings]);
        this.rebuildBindings();

        console.log(`[MidiRouter] Auto-generated ${newBindings.length} bindings`);
    }

    /** Get all current bindings. */
    getBindings(): MidiBinding[] {
        return Array.from(this.bindings.values());
    }

    /** Check if initialized. */
    get isInitialized(): boolean {
        return this.initialized;
    }

    /** Clean up. */
    dispose(): void {
        for (const input of this.inputs) {
            input.onmidimessage = null;
        }
        this.inputs = [];
        this.bindings.clear();
        this.midiAccess = null;
        this.initialized = false;
        console.log("[MidiRouter] Disposed");
    }
}

/**
 * Factory to create MidiRouter bound to store.
 */
export function createMidiRouter(store: () => LooperStoreType): MidiRouter {
    return new MidiRouter(store);
}
