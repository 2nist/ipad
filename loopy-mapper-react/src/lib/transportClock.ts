// ═══════════════════════════════════════════════════════════════════
// TRANSPORT CLOCK — Central timing singleton for the looper
// Syncs AudioWorklet, MIDI scheduler, and UI animations
// ═══════════════════════════════════════════════════════════════════

import type {
    TransportClock, ClockPosition, ClockSubscriber, TimeSignature,
    InternalClockConfig,
} from '../types';

type SubscriberEntry = {
    subscriber: ClockSubscriber;
    id: string;
};

export class TransportClockImpl implements TransportClock {
    public bpm: number = 120;
    public timeSignature: TimeSignature = { numerator: 4, denominator: 4 };
    public isPlaying: boolean = false;
    public currentBeat: number = 0;
    public currentBar: number = 0;
    public currentTick: number = 0;
    public tickResolution: number = 960;

    private audioContext: AudioContext;
    private scheduleAhead: number;
    private schedulerInterval: number;
    private schedulerId: number | null = null;
    private startTime: number = 0;
    private absoluteBeat: number = 0;
    private subscribers: SubscriberEntry[] = [];
    private scheduledCallbacks: Map<number, Array<() => void>> = new Map();
    private currentSectionBars: number = 8;
    private currentSectionId: string = "";
    private lastBeatFired: number = -1;
    private lastBarFired: number = -1;
    private secondsPerBeat: number = 0.5; // 120 BPM default

    constructor(config: InternalClockConfig) {
        this.audioContext = config.audioContext;
        this.scheduleAhead = config.scheduleAhead ?? 0.1;
        this.schedulerInterval = config.schedulerInterval ?? 0.025;
        this.updateSecondsPerBeat();
    }

    get beatsPerBar(): number {
        return this.timeSignature.numerator * (4 / this.timeSignature.denominator);
    }

    private updateSecondsPerBeat(): void {
        this.secondsPerBeat = 60 / this.bpm;
    }

    setBpm(bpm: number): void {
        this.bpm = Math.min(200, Math.max(60, bpm));
        this.updateSecondsPerBeat();
        for (const entry of this.subscribers) {
            entry.subscriber.onBpmChange?.(this.bpm);
        }
    }

    setTimeSignature(ts: TimeSignature): void {
        this.timeSignature = ts;
        this.updateSecondsPerBeat();
        for (const entry of this.subscribers) {
            entry.subscriber.onTimeSignatureChange?.(ts);
        }
    }

    start(): void {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        this.absoluteBeat = 0;
        this.currentBeat = 0;
        this.currentBar = 0;
        this.currentTick = 0;
        this.lastBeatFired = -1;
        this.lastBarFired = -1;

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
    }

    toggle(): void {
        if (this.isPlaying) this.stop();
        else this.start();
    }

    tapTempo(): void {
        // Tap tempo is handled in store/transportSlice.ts
        // This method is here for API compatibility
    }

    advance(deltaTimeMs: number): void {
        if (!this.isPlaying) return;
        const deltaBeats = deltaTimeMs / 1000 / this.secondsPerBeat;
        this.absoluteBeat += deltaBeats;
        this.currentBeat = this.absoluteBeat % this.beatsPerBar;

        const totalBeatsInSection = this.beatsPerBar * this.currentSectionBars;
        const sectionBeat = this.absoluteBeat % totalBeatsInSection;
        this.currentBar = Math.floor(sectionBeat / this.beatsPerBar);
        this.currentTick = (this.absoluteBeat % 1) * this.tickResolution;
    }

    getPosition(): ClockPosition {
        const totalBeatsInSection = this.beatsPerBar * this.currentSectionBars;
        const sectionBeat = this.absoluteBeat % totalBeatsInSection;
        const barInSection = Math.floor(sectionBeat / this.beatsPerBar);
        const beatInBar = sectionBeat % this.beatsPerBar;
        const elapsed = sectionBeat;
        const remaining = totalBeatsInSection - sectionBeat;

        return {
            absoluteBeat: this.absoluteBeat,
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
        const key = Math.floor(beat);
        if (!this.scheduledCallbacks.has(key)) {
            this.scheduledCallbacks.set(key, []);
        }
        this.scheduledCallbacks.get(key)!.push(callback);
    }

    scheduleBeat(offset: number, callback: () => void): void {
        const targetBeat = Math.floor(this.absoluteBeat) + offset;
        this.scheduleAt(targetBeat, callback);
    }

    scheduleBar(offset: number, callback: () => void): void {
        const currentBarBeat = Math.floor(this.absoluteBeat / this.beatsPerBar) * this.beatsPerBar;
        const targetBeat = currentBarBeat + (offset * this.beatsPerBar);
        this.scheduleAt(targetBeat, callback);
    }

    scheduleTick(offset: number, callback: () => void): void {
        const targetBeat = this.absoluteBeat + (offset / this.tickResolution);
        this.scheduleAt(targetBeat, callback);
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
        const tick = () => {
            if (!this.isPlaying) return;

            const elapsed = this.audioContext.currentTime - this.startTime;
            const newAbsoluteBeat = elapsed / this.secondsPerBeat;

            // Fire beat callbacks
            const beatFloor = Math.floor(newAbsoluteBeat);
            const barFloor = Math.floor(newAbsoluteBeat / this.beatsPerBar);

            if (beatFloor > this.lastBeatFired) {
                this.lastBeatFired = beatFloor;
                this.absoluteBeat = newAbsoluteBeat;
                const pos = this.getPosition();
                for (const entry of this.subscribers) {
                    entry.subscriber.onBeat?.(pos);
                }

                // Fire scheduled callbacks at this beat
                const callbacks = this.scheduledCallbacks.get(beatFloor);
                if (callbacks) {
                    for (const cb of callbacks) cb();
                    this.scheduledCallbacks.delete(beatFloor);
                }
            }

            if (barFloor > this.lastBarFired) {
                this.lastBarFired = barFloor;
                const pos = this.getPosition();
                for (const entry of this.subscribers) {
                    entry.subscriber.onBar?.(pos);
                }
            }

            // Fire tick callbacks
            this.absoluteBeat = newAbsoluteBeat;
            const pos = this.getPosition();
            for (const entry of this.subscribers) {
                entry.subscriber.onTick?.(pos);
            }

            this.schedulerId = window.setTimeout(tick, this.schedulerInterval * 1000);
        };

        this.schedulerId = window.setTimeout(tick, 0);
    }

    private stopScheduler(): void {
        if (this.schedulerId !== null) {
            clearTimeout(this.schedulerId);
            this.schedulerId = null;
        }
    }
}

/**
 * Factory function to create a TransportClockImpl
 */
export function createTransportClock(audioContext: AudioContext, bpm: number = 120, scheduleAhead: number = 0.1, schedulerInterval: number = 0.025): TransportClockImpl {
    return new TransportClockImpl({
        source: "internal",
        audioContext,
        scheduleAhead,
        schedulerInterval,
    });
}