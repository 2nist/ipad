// ═══════════════════════════════════════════════════════════════════
// ARRANGEMENT ENGINE — Section activation, transition execution,
// slave module management
// ═══════════════════════════════════════════════════════════════════

import type {
    SongSection, SectionContext, TransitionMode, ClockPosition,
    SectionModuleOverride, TimeSignature, HarmonyRuntimeState, ChordStep,
} from '../types';
import type { TransportClockImpl } from './transportClock';
import type { LooperStoreType } from '../store/store';
import { harmonyEngine } from './harmonyEngine';

/** Beats per bar for a time signature (denominator-aware; 6/8 → 3). */
export function beatsPerBar(ts: TimeSignature): number {
    return ts.numerator * (4 / ts.denominator);
}

/** Real wall-clock duration of one bar in ms, at a given BPM + time signature. */
export function barDurationMs(bpm: number, ts: TimeSignature): number {
    const secondsPerBeat = 60 / Math.max(bpm, 1);
    return beatsPerBar(ts) * secondsPerBeat * 1000;
}

/** Resolve a chord step into pitches, voice-led against the previous chord's tones. */
function resolveVoicedChord(
    key: string,
    scale: string,
    step: ChordStep,
    previousTones: number[] | null,
): HarmonyRuntimeState['activeChord'] {
    const resolved = harmonyEngine.resolveChord(key, scale, step.degree, step.quality, 3);
    const voiced = harmonyEngine.voiceLead(resolved.chordTones, previousTones);
    return {
        ...resolved,
        chordTones: voiced,
        noteNames: voiced.map(n => harmonyEngine.midiToNoteName(n)),
    };
}

export class ArrangementEngine {
    private store: () => LooperStoreType;
    private clock: TransportClockImpl | null = null;
    private isTransitioning: boolean = false;
    private transitionStartTime: number = 0;
    // For 'nextBar' transitions: the section to activate on the next bar boundary.
    private pendingTransitionSectionId: string | null = null;

    constructor(store: () => LooperStoreType) {
        this.store = store;
    }

    setClock(clock: TransportClockImpl): void {
        this.clock = clock;
        clock.registerSubscriber({
            id: 'arrangement-engine',
            onBar: (pos) => this.onBar(pos),
            onBeat: (pos) => this.onBeat(pos),
            onStart: (pos) => this.onStart(pos),
            onStop: (pos) => this.onStop(pos),
        });
    }

    activateSection(sectionId: string): void {
        const store = this.store();
        const section = store.song.arrangement.find(s => s.id === sectionId);
        if (!section) return;

        const { modules } = store.song;
        const previouslyActive = modules.filter(m => {
            const prevSection = store.song.arrangement[store.transport.activeSectionIndex];
            return prevSection?.activeModules.includes(m.id);
        });

        // Build section context
        const context: SectionContext = {
            sectionId: section.id,
            sectionName: section.name,
            bars: section.bars,
            timeSignature: store.song.metadata.timeSignature,
            chordProgression: section.chordProgression.length > 0 ? section.chordProgression : undefined,
            transition: section.transition,
        };

        // Deactivate modules no longer in this section
        for (const mod of previouslyActive) {
            if (!section.activeModules.includes(mod.id)) {
                this.deactivateModule(mod.id);
            }
        }

        // Activate modules in this section
        for (const modId of section.activeModules) {
            const mod = modules.find(m => m.id === modId);
            if (mod) {
                this.activateModule(mod.id, context);
            }
        }

        // Update clock's section context
        if (this.clock) {
            this.clock.setSectionContext(section.bars, section.id);
        }

        store.jumpToSection(sectionId);
    }

    private activateModule(moduleId: string, context: SectionContext): void {
        const store = this.store();
        store.initModuleState(moduleId, store.song.modules.find(m => m.id === moduleId)?.tracks.length || 0);
        store.updateModuleState(moduleId, { isActive: true });

        // If harmonic module with a chord progression, resolve the opening chord for real.
        const mod = store.song.modules.find(m => m.id === moduleId);
        if (mod?.type === 'harmonic' && context.chordProgression && context.chordProgression.length > 0) {
            const { key, scale } = store.song.metadata;
            const progression = context.chordProgression;
            const bpb = beatsPerBar(context.timeSignature);
            // No previous chord at activation → root-position voicing (previousTones = null).
            const activeChord = resolveVoicedChord(key, scale, progression[0], null);
            store.updateModuleState(moduleId, {
                harmony: {
                    progression,
                    currentStepIndex: 0,
                    activeChord,
                    previousChord: null,
                    beatsInStep: 0,
                    beatsUntilNext: progression[0].duration * bpb,
                    cadenceType: harmonyEngine.detectCadence(progression, key, scale),
                },
            });
        }
    }

    /**
     * Advance every active harmonic module's chord to whichever progression step the
     * playhead is now in, re-resolving pitches (voice-led against the prior chord) only
     * when the step actually changes. Also reverts any expired HarmonicExpression override.
     * Called from onBeat — chord granularity is bar/beat, not per-frame.
     */
    private updateHarmony(pos: ClockPosition): void {
        const store = this.store();
        const { key, scale, timeSignature } = store.song.metadata;
        const bpb = beatsPerBar(timeSignature);

        for (const mod of store.song.modules) {
            if (mod.type !== 'harmonic') continue;
            const state = store.moduleStates[mod.id];
            if (!state?.isActive || !state.harmony) continue;

            let harmony = state.harmony;

            // Revert an expired override back to the section's base progression.
            if (harmony.overrideUntilBeat !== undefined && pos.beatInSection >= harmony.overrideUntilBeat) {
                const section = store.song.arrangement[store.transport.activeSectionIndex];
                const base = section?.chordProgression ?? [];
                if (base.length > 0) {
                    harmony = { ...harmony, progression: base, overrideUntilBeat: undefined };
                }
            }

            if (harmony.progression.length === 0) continue;

            const { index, beatsIntoStep, beatsUntilNext } =
                harmonyEngine.stepIndexAtBeat(harmony.progression, pos.beatInSection, bpb);

            const overrideChanged = harmony !== state.harmony;
            if (index === harmony.currentStepIndex && !overrideChanged) continue;

            const step = harmony.progression[index];
            const activeChord = resolveVoicedChord(key, scale, step, harmony.activeChord.chordTones);
            store.updateModuleState(mod.id, {
                harmony: {
                    ...harmony,
                    previousChord: harmony.activeChord,
                    currentStepIndex: index,
                    activeChord,
                    beatsInStep: beatsIntoStep,
                    beatsUntilNext,
                },
            });
        }
    }

    private deactivateModule(moduleId: string): void {
        this.store().updateModuleState(moduleId, { isActive: false });
    }

    executeTransition(fromSection: SongSection, toSection: SongSection, mode: TransitionMode): void {
        switch (mode) {
            case 'instant':
                this.executeInstantTransition(fromSection, toSection);
                break;
            case 'nextBar':
                this.executeNextBarTransition(fromSection, toSection);
                break;
            case 'fade':
                this.executeFadeTransition(fromSection, toSection);
                break;
        }
    }

    private executeInstantTransition(from: SongSection, to: SongSection): void {
        this.isTransitioning = true;
        this.activateSection(to.id);
        this.isTransitioning = false;
    }

    private executeNextBarTransition(from: SongSection, to: SongSection): void {
        // Defer activation to the next bar boundary. onBar consumes the pending
        // transition — previously this activated immediately, making 'nextBar'
        // behave identically to 'instant'.
        this.isTransitioning = true;
        this.pendingTransitionSectionId = to.id;
    }

    private executeFadeTransition(from: SongSection, to: SongSection): void {
        // Fade: overlap transition
        this.isTransitioning = true;
        this.transitionStartTime = this.clock?.getPosition().absoluteBeat || 0;

        // Deactivate outgoing modules with fade
        const store = this.store();
        for (const modId of from.activeModules) {
            store.updateModuleState(modId, { effectiveVolume: 0 });
        }

        // Activate incoming modules
        this.activateSection(to.id);

        // Ramp the new section's volume back up over one real bar — computed from the
        // current BPM + time signature, not a fixed 1000ms (which only matched 120 BPM 4/4).
        const { bpm, timeSignature } = store.song.metadata;
        setTimeout(() => {
            for (const modId of to.activeModules) {
                store.updateModuleState(modId, { effectiveVolume: 1.0 });
            }
            this.isTransitioning = false;
        }, barDurationMs(bpm, timeSignature));
    }

    getEffectiveOverrides(moduleId: string, sectionId: string): SectionModuleOverride | null {
        const store = this.store();
        // Check if there are any overrides in the arrangement config
        const section = store.song.arrangement.find(s => s.id === sectionId);
        if (!section) return null;

        // Volume override based on whether the module is in activeModules
        if (!section.activeModules.includes(moduleId)) {
            return { moduleId, sectionId, volume: 0, mute: true };
        }

        return null;
    }

    private onStart(pos: ClockPosition): void {
        const store = this.store();
        const sections = store.song.arrangement;
        if (sections.length > 0) {
            this.activateSection(sections[0].id);
        }
    }

    private onStop(pos: ClockPosition): void {
        const store = this.store();
        for (const mod of store.song.modules) {
            this.deactivateModule(mod.id);
        }
    }

    private onBeat(pos: ClockPosition): void {
        const store = this.store();

        // Advance harmonic modules' chords to the current progression step.
        this.updateHarmony(pos);

        // Check for boundary triggers at section end
        const currentSection = store.song.arrangement[store.transport.activeSectionIndex];
        if (!currentSection) return;

        const totalBeats = currentSection.bars * beatsPerBar(store.song.metadata.timeSignature);

        // Check if we're at the section boundary
        if (pos.elapsedBeatsInSection >= totalBeats - 1 && pos.beatInBar === 0) {
            const nextIndex = store.transport.activeSectionIndex + 1;
            if (nextIndex < store.song.arrangement.length) {
                const nextSection = store.song.arrangement[nextIndex];
                this.executeTransition(currentSection, nextSection, currentSection.transition);
            } else {
                // End of song
                store.globalStop();
            }
        }
    }

    private onBar(pos: ClockPosition): void {
        const store = this.store();

        // Complete any deferred 'nextBar' transition now that we're on a bar line.
        if (this.pendingTransitionSectionId) {
            const target = this.pendingTransitionSectionId;
            this.pendingTransitionSectionId = null;
            this.activateSection(target);
            this.isTransitioning = false;
            return;
        }

        const currentSection = store.song.arrangement[store.transport.activeSectionIndex];
        if (!currentSection) return;

        // Check for markers that trigger expressions
        if (currentSection.markers) {
            for (const marker of currentSection.markers) {
                if (marker.type === 'expressionTrigger' && pos.beatInSection >= marker.beat) {
                    if (marker.targetModuleId) {
                        this.fireExpressionMarker(marker.targetModuleId, pos);
                    }
                }
            }
        }
    }

    /** Apply an expressionTrigger marker to its target module's expression. */
    private fireExpressionMarker(moduleId: string, pos: ClockPosition): void {
        const store = this.store();
        const mod = store.song.modules.find(m => m.id === moduleId);
        const expression = mod?.expression;
        if (!expression?.enabled) return;

        if (expression.type === 'fill') {
            store.updateModuleState(moduleId, {
                expression: {
                    isActive: true,
                    remainingBeats: expression.durationBeats,
                    nextTriggerRepeat: 0,
                },
            });
            return;
        }

        // Harmonic 'variation' with a chord override: swap in the override progression
        // (behavior 'replace') until durationBars elapse, then updateHarmony reverts it.
        // 'layer' (both progressions sounding) and 'morph' (pitch-level crossfade) require
        // per-chord audio voices that don't exist yet — deferred to the harmonic playback pass.
        if (expression.type === 'variation' && expression.chordProgressionOverride?.length) {
            const state = store.moduleStates[moduleId];
            if (!state?.harmony) return;
            const bpb = beatsPerBar(store.song.metadata.timeSignature);
            const durationBeats = (expression.durationBars ?? 4) * bpb;
            store.updateModuleState(moduleId, {
                harmony: {
                    ...state.harmony,
                    progression: expression.chordProgressionOverride,
                    currentStepIndex: -1, // force updateHarmony to re-resolve on the next beat
                    overrideUntilBeat: pos.beatInSection + durationBeats,
                },
            });
        }
    }
}

/**
 * Factory to create the arrangement engine and wire it to the store
 */
export function createArrangementEngine(store: () => LooperStoreType): ArrangementEngine {
    return new ArrangementEngine(store);
}