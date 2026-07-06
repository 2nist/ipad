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
    private scheduledCallbacks: Map<number, Array<() => void>> = new Map();
    private currentSectionBars: number = 8;
    private currentSectionId: string = "";
    private rafId: number | null = null;
    private lastBeatFloor: number = -1;
    private lastBarFloor: number = -1;
    private startWallTime: number = 0;

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
        Tone.Transport.bpm.value = this.bpm;
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
        this.startWallTime = performance.now();
        this.lastBeatFloor = -1;
        this.lastBarFloor = -1;

        console.log('[Clock] Starting at BPM:', this.bpm, 'Wall time:', this.startWallTime);

        // Notify onStart
        const pos = this.getPosition();
        for (const entry of this.subscribers) {
            entry.subscriber.onStart?.(pos);
        }

        this.startScheduler();
    }

    stop(): void {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.stopScheduler();

        const pos = this.getPosition();
        for (const entry of this.subscribers) {
            entry.subscriber.onStop?.(pos);
        }

        console.log('[Clock] Stopped at beat:', pos.absoluteBeat.toFixed(2));
    }

    toggle(): void {
        if (this.isPlaying) this.stop();
        else this.start();
    }

    tapTempo(): void { /* handled in store */ }

    advance(deltaTimeMs: number): void {
        if (!this.isPlaying) return;
        const deltaBeats = deltaTimeMs / 1000 / this.secondsPerBeat;
    }

    getPosition(): ClockPosition {
        const elapsedSec = this.isPlaying
            ? (performance.now() - this.startWallTime) / 1000
            : 0;
        const absoluteBeat = elapsedSec / this.secondsPerBeat;

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

    scheduleAt(beat: number, callback: () => void): void {
        const beatTime = beat * this.secondsPerBeat;
        const now = (performance.now() - this.startWallTime) / 1000;
        const delayMs = (beatTime - now) * 1000;
        if (delayMs > 0) {
            setTimeout(callback, Math.max(0, delayMs));
        } else {
            callback();
        }
    }

    scheduleBeat(offset: number, callback: () => void): void {
        const currentBeat = (performance.now() - this.startWallTime) / 1000 / this.secondsPerBeat;
        this.scheduleAt(Math.floor(currentBeat) + offset, callback);
    }

    scheduleBar(offset: number, callback: () => void): void {
        const currentBeat = (performance.now() - this.startWallTime) / 1000 / this.secondsPerBeat;
        const currentBarBeat = Math.floor(currentBeat / this.beatsPerBar) * this.beatsPerBar;
        this.scheduleAt(currentBarBeat + (offset * this.beatsPerBar), callback);
    }

    scheduleTick(offset: number, callback: () => void): void {
        const currentBeat = (performance.now() - this.startWallTime) / 1000 / this.secondsPerBeat;
        this.scheduleAt(currentBeat + (offset / this.tickResolution), callback);
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
        const loop = () => {
            if (!this.isPlaying) return;
            this.rafId = requestAnimationFrame(loop);

            const pos = this.getPosition();
            const ab = pos.absoluteBeat;

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
    // Previously `bpm` was accepted but never applied, so every clock silently
    // booted at the class default (120) regardless of the song's actual tempo.
    clock.setBpm(bpm);
    return clock;
}