/**
 * Looper AudioWorkletProcessor
 *
 * Runs on the browser's dedicated audio rendering thread (AudioWorklet).
 * Handles real-time recording and loop playback without touching the main UI thread.
 *
 * Architecture:
 *   Receives audio input from MediaStream → records into Float32Array buffer
 *   Plays back looped buffer → outputs to destination
 *   Controlled via postMessage() commands from the main thread
 */

class LooperProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.isRecording = false;
        this.isPlaying = false;
        this.buffer = []; // Accumulated Float32 samples
        this.playIndex = 0;
        this.loopLength = 0;
        this.sampleRate = sampleRate; // global AudioWorklet constant

        // Listen for control commands from the main thread
        this.port.onmessage = (event) => {
            const { command, data } = event.data;

            switch (command) {

                // ── Recording commands ──

                case 'record_toggle':
                    this.isRecording = !this.isRecording;
                    if (this.isRecording) {
                        this.buffer = [];
                        this.playIndex = 0;
                        this.loopLength = 0;
                    }
                    break;

                case 'record_start':
                    this.isRecording = true;
                    this.buffer = [];
                    this.playIndex = 0;
                    this.loopLength = 0;
                    break;

                case 'record_stop':
                    this.isRecording = false;
                    this.loopLength = this.buffer.length;
                    break;

                // ── Playback commands ──

                case 'play_toggle':
                    this.isPlaying = !this.isPlaying;
                    if (this.isPlaying && this.loopLength > 0) {
                        this.playIndex = 0;
                    }
                    break;

                case 'play_start':
                    this.isPlaying = true;
                    this.playIndex = 0;
                    break;

                case 'play_stop':
                    this.isPlaying = false;
                    break;

                // ── Utility commands ──

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

                case 'get_state':
                    // Reply with current buffer stats (no audio data — just metadata)
                    this.port.postMessage({
                        type: 'state',
                        isRecording: this.isRecording,
                        isPlaying: this.isPlaying,
                        loopLength: this.loopLength,
                        bufferSize: this.buffer.length
                    });
                    break;

                default:
                    break;
            }
        };
    }

    /**
     * Main audio processing callback. Called by the audio system
     * on the worklet thread with sample-accurate timing.
     */
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        // ── Record ──
        // Capture incoming audio if the record state is active
        if (this.isRecording && input && input[0]) {
            const inputChannel = input[0];
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer.push(inputChannel[i]);
            }
            this.loopLength = this.buffer.length;
        }

        // ── Play ──
        // Play back buffered data if play state is active and buffer exists
        if (this.isPlaying && this.loopLength > 0) {
            // Write the same loop to all output channels
            for (let channel = 0; channel < output.length; channel++) {
                const outputChannel = output[channel];
                if (!outputChannel) continue;

                for (let i = 0; i < outputChannel.length; i++) {
                    // Wrap around seamlessly for flawless loop playback
                    outputChannel[i] = this.buffer[this.playIndex] || 0;
                    this.playIndex = (this.playIndex + 1) % this.loopLength;
                }
            }
        }

        // Return true to keep the processor alive
        return true;
    }
}

registerProcessor('looper-processor', LooperProcessor);