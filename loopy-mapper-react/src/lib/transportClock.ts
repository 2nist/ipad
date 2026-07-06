// ═══════════════════════════════════════════════════════════════════
// TRANSPORT CLOCK — Self-contained timing using performance.now()
// Does NOT depend on Tone.Transport for position tracking.
// Tone.Transport is only used for BPM sync and audio scheduling.
// ═══════════════════════════════════════════════════════════════════

import type {
    TransportClock, ClockPosition, ClockSubscriber, TimeSignature,
    InternalClockConfig,
} from '../types';

type SubscriberEntry = {
    subscriber: ClockSubscriber;
    id: string;
};

import * as Tone from 'tone';

export class TransportClockImpl implements TransportClock {
    public bpm: number = 120;
    public timeSignature: TimeSignature = { numerator: 4, denominator: 4 };
    public isPlaying: boolean = false;
    public currentBeat: number = 0;
    public currentBar: number = 0;
    public currentTick: number = 0;
    public tickResolution: number = 960;

    private audioContext: AudioContext;
    private subscribers: SubscriberEntry[] = [];
    private currentSectionBars: number = 8;
    private currentSectionId: string = "";
    private rafId: number | null = null;
    private lastBeatFloor: number = -1;
    private lastBarFloor: number = -1;
    private lastFrameTime: number | null = null;

    // Source of truth for position. Beats accumulate incrementally each frame
    // (see advance()) instead of being derived from `elapsedWallTime / secondsPerBeat`,
    // so changing BPM mid-playback only changes the rate of *future* accumulation —
    // it can never rescale time already played and teleport the playhead.
    private accumulatedBeats: number = 0;

    constructor(config: InternalClockConfig) {
        this.audioContext = config.audioContext;
    }

    get beatsPerBar(): number {
        return this.timeSignature.numerator * (4 / this.timeSignature.denominator);
    }

    private get secondsPerBeat(): number {
        return 60 / Math.max(this.bpm, 1);
    }

    setBpm(bpm: number): void {
        this.bpm = Math.min(200, Math.max(60, bpm));
        // Tone.Transport sync happens via the onBpmChange subscriber (see
        // useEngineInitialization) — keeping this class free of a direct Tone
        // dependency is what makes it usable outside a browser/Tone context.
        for (const entry of this.subscribers) {
            entry.subscriber.onBpmChange?.(this.bpm);
        }
    }

    setTimeSignature(ts: TimeSignature): void {
        this.timeSignature = ts;
        for (const entry of this.subscribers) {
            entry.subscriber.onTimeSignatureChange?.(ts);
        }
    }

    reset(): void {
        Tone.Transport.stop();
        Tone.Transport.position = '0:0:0';
        this.stop();
    }

    start(): void {
        if (this.isPlaying) return;

        // Ensure audio context is alive
        if (this.audioContext.state !== 'running') {
            console.log('[Clock] AudioContext is suspended, attempting resume...');
            this.audioContext.resume().then(() => {
                console.log('[Clock] AudioContext resumed:', this.audioContext.state);
            });
        }

        this.isPlaying = true;
        this.accumulatedBeats = 0;
        this.lastFrameTime = performance.now();
        this.lastBeatFloor = -1;
        this.lastBarFloor = -1;

        console.log('[Clock] Starting at BPM:', this.bpm);

        // Sync Tone.Transport so scheduled callbacks (synthEngine.playSequence)
        // fire in time with our rAF loop. BPM and position must match.
        Tone.Transport.bpm.value = this.bpm;
        Tone.Transport.position = '0:0:0';
        Tone.Transport.start();

        // Notify onStart
        const pos = this.getPosition();
        for (const entry of this.subscribers) {
            entry.subscriber.onStart?.(pos);
        }

        this.startScheduler();
    }

    /** Full stop — rewinds position to the top (beat 0). For a resumable pause, use pause(). */
    stop(): void {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.stopScheduler();
        this.accumulatedBeats = 0;
        this.lastFrameTime = null;
        this.lastBeatFloor = -1;
        this.lastBarFloor = -1;

        // Stop Tone.Transport and clear all scheduled events so patterns don't
        // continue playing on the next start with stale callbacks.
        Tone.Transport.stop();
        Tone.Transport.position = '0:0:0';
        Tone.Transport.cancel(0);

        const pos = this.getPosition();
        for (const entry of this.subscribers) {
            entry.subscriber.onStop?.(pos);
        }

        console.log('[Clock] Stopped at beat:', pos.absoluteBeat.toFixed(2));
    }

    /** Stop the scheduler but keep the current position — resume() continues from here. */
    pause(): void {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.stopScheduler();
        this.lastFrameTime = null;
        console.log('[Clock] Paused at beat:', this.accumulatedBeats.toFixed(2));
    }

    /** Resume playback from the position left by pause(), without re-firing onStart. */
    resume(): void {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        // Don't re-fire onBeat/onBar for the beat/bar we already announced before pausing.
        this.lastBeatFloor = Math.floor(this.accumulatedBeats);
        this.lastBarFloor = Math.floor(this.accumulatedBeats / this.beatsPerBar);
        this.startScheduler();
        console.log('[Clock] Resumed at beat:', this.accumulatedBeats.toFixed(2));
    }

    toggle(): void {
        if (this.isPlaying) this.stop();
        else this.start();
    }

    tapTempo(): void { /* handled in store */ }

    /**
     * Advance the clock by a fixed wall-clock delta. This is the single mechanism
     * that moves `accumulatedBeats` forward — the rAF loop calls it every frame with
     * a measured delta, and it can also be called directly (e.g. in tests) to
     * deterministically simulate time passing without a real rAF/timer.
     */
    advance(deltaTimeMs: number): void {
        if (!this.isPlaying) return;
        this.accumulatedBeats += (deltaTimeMs / 1000) / this.secondsPerBeat;
    }

    getPosition(): ClockPosition {
        const absoluteBeat = this.accumulatedBeats;

        const totalBeatsInSection = this.beatsPerBar * this.currentSectionBars;
        const sectionBeat = absoluteBeat % Math.max(totalBeatsInSection, 1);
        const barInSection = Math.floor(sectionBeat / this.beatsPerBar);
        const beatInBar = sectionBeat % this.beatsPerBar;
        const elapsed = sectionBeat;
        const remaining = totalBeatsInSection - sectionBeat;

        return {
            absoluteBeat,
            barInSection,
            beatInBar: Math.floor(beatInBar),
            tickInBeat: Math.floor((beatInBar % 1) * this.tickResolution),
            sectionId: this.currentSectionId,
            beatInSection: Math.floor(sectionBeat),
            elapsedBeatsInSection: Math.floor(elapsed),
            remainingBeatsInSection: Math.ceil(Math.max(0, remaining)),
        };
    }

    /** Schedule `callback` at an absolute beat number, timed at the current BPM. */
    scheduleAt(beat: number, callback: () => void): void {
        const beatsUntil = beat - this.accumulatedBeats;
        const delayMs = beatsUntil * this.secondsPerBeat * 1000;
        if (delayMs > 0) {
            setTimeout(callback, delayMs);
        } else {
            callback();
        }
    }

    scheduleBeat(offset: number, callback: () => void): void {
        this.scheduleAt(Math.floor(this.accumulatedBeats) + offset, callback);
    }

    scheduleBar(offset: number, callback: () => void): void {
        const currentBarBeat = Math.floor(this.accumulatedBeats / this.beatsPerBar) * this.beatsPerBar;
        this.scheduleAt(currentBarBeat + (offset * this.beatsPerBar), callback);
    }

    scheduleTick(offset: number, callback: () => void): void {
        this.scheduleAt(this.accumulatedBeats + (offset / this.tickResolution), callback);
    }

    registerSubscriber(subscriber: ClockSubscriber): void {
        if (!this.subscribers.find(e => e.id === subscriber.id)) {
            this.subscribers.push({ subscriber, id: subscriber.id });
        }
    }

    unregisterSubscriber(id: string): void {
        this.subscribers = this.subscribers.filter(e => e.id !== id);
    }

    setSectionContext(bars: number, sectionId: string): void {
        this.currentSectionBars = bars;
        this.currentSectionId = sectionId;
    }

    private startScheduler(): void {
        // No rAF in Node/test environments — advance() can still be called directly
        // (e.g. from tests) to deterministically simulate frames without a real loop.
        if (typeof requestAnimationFrame === 'undefined') return;

        const loop = () => {
            if (!this.isPlaying) return;
            this.rafId = requestAnimationFrame(loop);

            const now = performance.now();
            const deltaMs = now - (this.lastFrameTime ?? now);
            this.lastFrameTime = now;
            this.advance(deltaMs);

            const pos = this.getPosition();
            const ab = pos.absoluteBeat;
            this.currentBeat = pos.beatInBar;
            this.currentBar = pos.barInSection;
            this.currentTick = pos.tickInBeat;

            // Fire tick (~60fps)
            for (const entry of this.subscribers) {
                entry.subscriber.onTick?.(pos);
            }

            // Fire beat
            const bf = Math.floor(ab);
            if (bf > this.lastBeatFloor) {
                this.lastBeatFloor = bf;
                for (const entry of this.subscribers) {
                    entry.subscriber.onBeat?.(pos);
                }
            }

            // Fire bar
            const barFloor = Math.floor(ab / this.beatsPerBar);
            if (barFloor > this.lastBarFloor) {
                this.lastBarFloor = barFloor;
                for (const entry of this.subscribers) {
                    entry.subscriber.onBar?.(pos);
                }
            }
        };
        this.rafId = requestAnimationFrame(loop);
    }

    private stopScheduler(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
}

/**
 * Factory function to create a TransportClockImpl
 */
export function createTransportClock(audioContext: AudioContext, bpm: number = 120): TransportClockImpl {
    const clock = new TransportClockImpl({
        source: "internal",
        audioContext,
        scheduleAhead: 0.1,
        schedulerInterval: 0.025,
    });
    clock.setBpm(bpm);
    return clock;
}
