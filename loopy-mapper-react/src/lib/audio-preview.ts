/**
 * Audio Preview Engine
 * Zero-latency browser preview of MIDI clips using Tone.js and Web Audio API.
 *
 * Usage:
 *   import { audioPreview } from "@/lib/audio-preview";
 *   await audioPreview.previewClip(midiArrayBuffer, tempo);
 *   audioPreview.stop();
 */

import * as Tone from "tone";

class AudioPreviewEngine {
    private synth: Tone.PolySynth | null = null;
    private scheduledParts: Tone.Part[] = [];
    private isPlaying = false;
    private transportStarted = false;

    /**
     * Preview a parsed MIDI note array through a polyphonic synth.
     * Plays immediately synced to the global Tone.Transport.
     */
    async previewClip(midiArrayBuffer: ArrayBuffer, tempo = 120): Promise<void> {
        await Tone.start();
        this.stop();

        // Parse MIDI bytes into notes client-side
        const notes = this.parseMidiNotes(midiArrayBuffer);
        if (notes.length === 0) return;

        // Create or reuse synth
        if (!this.synth) {
            this.synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
            }).toDestination();
        }

        // Set tempo
        Tone.Transport.bpm.value = tempo;

        // Schedule notes
        const events: Array<[number, { pitch: number; time: number; duration: number; velocity: number }]> =
            notes.map((n) => [n.time, n]);
        const part = new Tone.Part((time, note) => {
            if (this.synth) {
                this.synth.triggerAttackRelease(
                    Tone.Frequency(note.pitch, "midi").toNote(),
                    note.duration,
                    time,
                    note.velocity
                );
            }
        }, events);

        part.loop = false;
        part.start(0);

        this.scheduledParts.push(part);
        this.isPlaying = true;

        if (!this.transportStarted) {
            Tone.Transport.start();
            this.transportStarted = true;
        }

        // Auto-stop after duration
        const endTime = notes.length > 0 ? Math.max(...notes.map((n) => n.time + n.duration)) + 0.5 : 2;
        setTimeout(() => this.stop(), endTime * 1000);
    }

    /** Stop all preview audio immediately. */
    stop(): void {
        for (const part of this.scheduledParts) {
            part.stop();
            part.dispose();
        }
        this.scheduledParts = [];
        this.isPlaying = false;
    }

    /** Check if the preview engine is currently playing. */
    get playing(): boolean {
        return this.isPlaying;
    }

    /**
     * Minimal MIDI parser — reads note-on events from a raw MIDI file buffer.
     * Extracts pitch (MIDI note number), start time, duration, and velocity.
     */
    private parseMidiNotes(buffer: ArrayBuffer): Array<{ pitch: number; time: number; duration: number; velocity: number }> {
        const bytes = new Uint8Array(buffer);
        const notes: Array<{ pitch: number; time: number; duration: number; velocity: number }> = [];
        const activeNotes: Map<number, { startTick: number; velocity: number }> = new Map();

        let ticksPerBeat = 480;
        let tempo = 500000; // default 120 BPM in microseconds/beat
        let tickTime = 0;
        let deltaTicks = 0;

        // Parse header
        let i = 0;
        if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) {
            // MThd
            const headerLen = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
            ticksPerBeat = (bytes[i + 12] << 8) | bytes[i + 13];
            i += 14 + headerLen - 6;
        }

        // Helper: parse variable-length quantity
        function readVLQ(): number {
            let value = 0;
            let byte = 0;
            do {
                byte = bytes[i++];
                value = (value << 7) | (byte & 0x7f);
            } while (byte & 0x80);
            return value;
        }

        // Calculate tick-to-seconds conversion
        function ticksToSeconds(ticks: number): number {
            const beatDuration = tempo / 1_000_000; // seconds per beat
            return (ticks / ticksPerBeat) * beatDuration;
        }

        let absoluteTicks = 0;
        let runningStatus = 0;

        // Parse tracks
        while (i < bytes.length - 8) {
            if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x6b) {
                // MTrk
                const trackLen = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
                const trackEnd = i + 8 + trackLen;
                i += 8;

                while (i < trackEnd) {
                    const delta = readVLQ();
                    absoluteTicks += delta;

                    let status = bytes[i];
                    if (status & 0x80) {
                        runningStatus = status;
                        i += 1;
                    } else {
                        status = runningStatus;
                    }

                    const msgType = status & 0xf0;
                    const channel = status & 0x0f;

                    if (msgType === 0x90 || msgType === 0x80) {
                        const note = bytes[i];
                        const velocity = bytes[i + 1];
                        i += 2;

                        if (msgType === 0x90 && velocity > 0) {
                            // Note On — store start
                            activeNotes.set(note, { startTick: absoluteTicks, velocity: velocity / 127 });
                        } else if (activeNotes.has(note)) {
                            // Note Off — finalize
                            const start = activeNotes.get(note)!;
                            const durTicks = absoluteTicks - start.startTick;
                            notes.push({
                                pitch: note,
                                time: ticksToSeconds(start.startTick),
                                duration: ticksToSeconds(durTicks) || 0.1, // minimum duration
                                velocity: start.velocity,
                            });
                            activeNotes.delete(note);
                        }
                    } else if (msgType === 0xb0) {
                        // CC
                        i += 2;
                    } else if (msgType === 0xe0) {
                        // Pitch bend
                        i += 2;
                    } else if (status === 0xff) {
                        // Meta event
                        const metaType = bytes[i++];
                        const len = readVLQ();
                        if (metaType === 0x51) {
                            // Set Tempo
                            tempo = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
                        }
                        i += len;
                    } else {
                        break;
                    }
                }
            } else {
                i += 1;
            }
        }

        // Close any hanging notes
        const endTick = absoluteTicks + ticksPerBeat * 4;
        for (const [note, start] of activeNotes) {
            notes.push({
                pitch: note,
                time: ticksToSeconds(start.startTick),
                duration: ticksToSeconds(endTick - start.startTick),
                velocity: start.velocity,
            });
        }

        return notes;
    }

    /** Dispose of all resources. */
    dispose(): void {
        this.stop();
        if (this.synth) {
            this.synth.dispose();
            this.synth = null;
        }
        Tone.Transport.stop();
        this.transportStarted = false;
    }
}

/** Singleton audio preview engine. */
export const audioPreview = new AudioPreviewEngine();