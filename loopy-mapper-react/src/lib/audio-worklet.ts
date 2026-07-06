/**
 * AudioWorklet-based looper engine.
 * Runs on an isolated audio thread for sample-accurate recording/playback.
 *
 * This is the core replacement for Loopy Pro's audio engine — running
 * entirely in the browser with sub-10ms latency via AudioWorklet.
 *
 * Architecture:
 *   [[MediaStream (mic/input)]] → AudioWorkletNode (looper-processor)
 *       ↓ records into       ↓ plays from
 *   [[ RingBuffer per track ]]  ←── WebMIDI / UI triggers
 */

import * as Tone from "tone";

// --- AudioWorklet Processor Code (inlined as blob URL) ---
const PROCESSOR_CODE = `
class LooperProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.isRecording = false;
        this.isPlaying = false;
        this.buffer = []; // Float32Array segments
        this.playIndex = 0;
        this.loopLength = 0;

        this.port.onmessage = (event) => {
            const { command, data } = event.data;
            switch (command) {
                case 'record_toggle':
                    this.isRecording = !this.isRecording;
                    if (this.isRecording) {
                        this.buffer = [];
                        this.playIndex = 0;
                    }
                    break;
                case 'play_toggle':
                    this.isPlaying = !this.isPlaying;
                    if (this.isPlaying && this.buffer.length > 0) {
                        this.playIndex = 0;
                    }
                    break;
                case 'record_start':
                    this.isRecording = true;
                    this.buffer = [];
                    this.playIndex = 0;
                    break;
                case 'record_stop':
                    this.isRecording = false;
                    this.loopLength = this.buffer.length;
                    break;
                case 'play_start':
                    this.isPlaying = true;
                    this.playIndex = 0;
                    break;
                case 'play_stop':
                    this.isPlaying = false;
                    break;
                case 'clear':
                    this.buffer = [];
                    this.playIndex = 0;
                    this.loopLength = 0;
                    this.isPlaying = false;
                    this.isRecording = false;
                    break;
                case 'set_loop':
                    if (data && data.length > 0) {
                        this.buffer = new Float32Array(data);
                        this.loopLength = this.buffer.length;
                    }
                    break;
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        // 1. Record incoming audio if record state is active
        if (this.isRecording && input && input[0]) {
            this.buffer.push(...input[0]);
        }

        // 2. Play back buffered data if play state is active
        if (this.isPlaying && this.buffer.length > 0) {
            for (let channel = 0; channel < output.length; channel++) {
                const outputChannel = output[channel];
                if (!outputChannel) continue;
                for (let i = 0; i < outputChannel.length; i++) {
                    outputChannel[i] = this.buffer[this.playIndex] || 0;
                    this.playIndex = (this.playIndex + 1) % this.buffer.length;
                }
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('looper-processor', LooperProcessor);
`;

// --- Multi-track looper engine ---

export interface LooperTrack {
    id: number;
    name: string;
    isRecording: boolean;
    isPlaying: boolean;
    hasContent: boolean;
    volume: number;
}

export type LooperEventCallback = (tracks: LooperTrack[]) => void;

export class LooperEngine {
    private audioContext: AudioContext | null = null;
    private nodes: Map<number, AudioWorkletNode> = new Map();
    private gainNodes: Map<number, GainNode> = new Map();
    private tracks: Map<number, LooperTrack> = new Map();
    private inputStream: MediaStream | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private onTracksChanged: LooperEventCallback | null = null;
    private processorBlobUrl: string | null = null;
    private processorModuleUrl: string | null = null;
    private initialized = false;

    /** Total number of loop tracks. */
    readonly maxTracks = 8;

    constructor() {
        for (let i = 0; i < this.maxTracks; i++) {
            this.tracks.set(i, {
                id: i,
                name: `Loop Track ${i + 1}`,
                isRecording: false,
                isPlaying: false,
                hasContent: false,
                volume: 0.75,
            });
        }
    }

    /** Register a callback for track state changes. */
    onTracksChange(callback: LooperEventCallback): void {
        this.onTracksChanged = callback;
    }

    /** Notify listeners of track state changes. */
    private notify(): void {
        if (this.onTracksChanged) {
            this.onTracksChanged(Array.from(this.tracks.values()));
        }
    }

    /**
     * Initialize the audio context and processor.
     * Accepts an optional external AudioContext — when provided it is used
     * directly instead of obtaining one from Tone.js, which avoids subtle
     * issues where Tone.getContext().rawContext returns a stale or
     * incompatible object (e.g. on iOS/Safari or when the context is
     * suspended at creation time).
     */
    async initialize(externalAudioContext?: AudioContext): Promise<void> {
        if (this.initialized) return;

        // Prefer an externally-provided AudioContext (from the
        // useEngineInitialization hook which already awaits Tone.start()).
        // Fall back to obtaining it ourselves.
        if (externalAudioContext && this.isValidAudioContext(externalAudioContext)) {
            this.audioContext = externalAudioContext;
        } else {
            await Tone.start();
            const raw = Tone.getContext().rawContext;
            if (!this.isValidAudioContext(raw)) {
                throw new Error(
                    "Invalid AudioContext from Tone.js — the browser may have " +
                    "blocked audio context creation. Ensure a user gesture " +
                    "(click/tap) precedes audio initialization."
                );
            }
            this.audioContext = raw as AudioContext;
        }

        // Load the AudioWorkletProcessor from the public file.
        // Vite serves files from /public at the root.
        try {
            await this.audioContext.audioWorklet.addModule("/looper-processor.js");
        } catch (err) {
            console.warn("Loading looper-processor.js from root failed, trying blob fallback...");
            try {
                const blob = new Blob([PROCESSOR_CODE], { type: "application/javascript" });
                this.processorBlobUrl = URL.createObjectURL(blob);
                await this.audioContext.audioWorklet.addModule(this.processorBlobUrl);
            } catch (err2) {
                console.error("AudioWorklet initialization failed:", err2);
                throw new Error("AudioWorklet not supported in this browser");
            }
        }

        this.initialized = true;

        // Create the worklet nodes for each track
        for (let i = 0; i < this.maxTracks; i++) {
            await this.createTrackNode(i);
        }
    }

    /** Verify the provided value is a usable AudioContext. */
    private isValidAudioContext(ctx: unknown): ctx is AudioContext {
        return (
            ctx !== null &&
            ctx !== undefined &&
            typeof (ctx as AudioContext).sampleRate === "number" &&
            typeof (ctx as AudioContext).destination === "object" &&
            (ctx as AudioContext).audioWorklet !== undefined
        );
    }

    /** Create an AudioWorkletNode for a track. */
    private async createTrackNode(trackId: number): Promise<void> {
        if (!this.audioContext) {
            console.warn(`[LooperEngine] Skipping track ${trackId} — no AudioContext`);
            return;
        }

        // Defensive check: ensure the context is still alive and usable
        if (!this.isValidAudioContext(this.audioContext)) {
            console.error(
                `[LooperEngine] Cannot create AudioWorkletNode — ` +
                `AudioContext is invalid or has been closed.`
            );
            return;
        }

        const node = new AudioWorkletNode(this.audioContext, "looper-processor");
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.tracks.get(trackId)?.volume || 0.75;

        node.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        this.nodes.set(trackId, node);
        this.gainNodes.set(trackId, gainNode);
    }

    /** Connect an audio input source (mic, instrument, or loopback). */
    async connectInput(stream: MediaStream): Promise<void> {
        if (!this.audioContext) return;

        this.inputStream = stream;
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

        // Route audio input to all active track nodes
        for (const [id, node] of this.nodes) {
            this.mediaStreamSource.connect(node);
        }
    }

    /** Disconnect audio input. */
    disconnectInput(): void {
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }
        this.inputStream = null;
    }

    /** Toggle recording on a specific track. */
    toggleRecord(trackId: number): void {
        const track = this.tracks.get(trackId);
        if (!track) return;

        const node = this.nodes.get(trackId);
        if (!node) return;

        // Stop playback if changing modes
        if (track.isPlaying) {
            node.port.postMessage({ command: "play_stop" });
            track.isPlaying = false;
        }

        track.isRecording = !track.isRecording;
        node.port.postMessage({ command: track.isRecording ? "record_start" : "record_stop" });

        if (!track.isRecording && track.hasContent) {
            // After recording stops, auto-start playback
            track.isPlaying = true;
            node.port.postMessage({ command: "play_start" });
        }

        track.hasContent = track.isRecording || track.hasContent;
        this.notify();
    }

    /** Toggle playback on a specific track. */
    togglePlay(trackId: number): void {
        const track = this.tracks.get(trackId);
        if (!track) return;

        const node = this.nodes.get(trackId);
        if (!node) return;

        if (!track.hasContent) return; // Nothing to play

        track.isPlaying = !track.isPlaying;
        node.port.postMessage({ command: track.isPlaying ? "play_start" : "play_stop" });
        this.notify();
    }

    /** Clear a track's audio content. */
    clearTrack(trackId: number): void {
        const track = this.tracks.get(trackId);
        if (!track) return;

        const node = this.nodes.get(trackId);
        if (!node) return;

        track.isPlaying = false;
        track.isRecording = false;
        track.hasContent = false;
        node.port.postMessage({ command: "clear" });
        this.notify();
    }

    /** Set track volume (0.0 – 1.0). */
    setVolume(trackId: number, volume: number): void {
        const gainNode = this.gainNodes.get(trackId);
        if (!gainNode) return;

        const v = Math.max(0, Math.min(1, volume));
        gainNode.gain.linearRampToValueAtTime(v, this.audioContext?.currentTime || 0);

        const track = this.tracks.get(trackId);
        if (track) {
            track.volume = v;
            this.notify();
        }
    }

    /** Get current track states. */
    getTracks(): LooperTrack[] {
        return Array.from(this.tracks.values());
    }

    /** Send a raw MIDI command to trigger tracks (for WebMIDI integration). */
    handleMidiCommand(status: number, data1: number, data2: number): void {
        const msgType = status & 0xf0;
        const velocity = data2 / 127;

        // Map note-on (0x90) with velocity > 0 to track triggers
        if (msgType === 0x90 && velocity > 0) {
            // Note 36-43 = tracks 0-7 (standard ATOM SQ / drum pad mapping)
            const trackId = data1 - 36;
            if (trackId >= 0 && trackId < this.maxTracks) {
                this.toggleRecord(trackId);
            }
        }

        // Map CC to volume (CC7 = channel volume)
        if (msgType === 0xb0 && data1 === 7) {
            const channel = (status & 0x0f) + 1;
            const trackId = channel - 1;
            if (trackId >= 0 && trackId < this.maxTracks) {
                this.setVolume(trackId, velocity);
            }
        }
    }

    /** Clean up all resources. */
    dispose(): void {
        this.disconnectInput();

        for (const [id, node] of this.nodes) {
            node.port.postMessage({ command: "clear" });
            node.disconnect();
        }
        this.nodes.clear();
        this.gainNodes.clear();
        this.tracks.clear();

        if (this.processorBlobUrl) {
            URL.revokeObjectURL(this.processorBlobUrl);
        }
        this.initialized = false;
    }
}

/** Singleton looper engine instance. */
export const looperEngine = new LooperEngine();