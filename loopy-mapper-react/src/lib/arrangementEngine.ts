// ═══════════════════════════════════════════════════════════════════
// ARRANGEMENT ENGINE — Section activation, transition execution,
// slave module management
// ═══════════════════════════════════════════════════════════════════

import type {
    SongSection, SectionContext, TransitionMode, ClockSubscriber, ClockPosition,
    SectionModuleOverride, ModuleCard,
} from '../types';
import type { TransportClockImpl } from './transportClock';
import type { LooperStoreType } from '../store/store';

export class ArrangementEngine {
    private store: () => LooperStoreType;
    private clock: TransportClockImpl | null = null;
    private isTransitioning: boolean = false;
    private transitionStartTime: number = 0;

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

        // If harmonic module with followChordProgression, set harmony state
        const mod = store.song.modules.find(m => m.id === moduleId);
        if (mod?.type === 'harmonic' && context.chordProgression && context.chordProgression.length > 0) {
            store.updateModuleState(moduleId, {
                harmony: {
                    progression: context.chordProgression,
                    currentStepIndex: 0,
                    activeChord: {
                        degree: context.chordProgression[0].degree,
                        quality: context.chordProgression[0].quality,
                        rootNote: 0,
                        rootOctave: 3,
                        chordTones: [],
                        noteNames: [],
                    },
                    previousChord: null,
                    beatsInStep: context.chordProgression[0].duration * 4,
                    beatsUntilNext: context.chordProgression[0].duration * 4,
                    cadenceType: 'none',
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
        // Wait for next bar boundary (handled in onBar callback)
        this.isTransitioning = true;
        // The onBar callback will complete the transition
        this.activateSection(to.id);
        this.isTransitioning = false;
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

        // Schedule volume ramp back up for the new section
        setTimeout(() => {
            for (const modId of to.activeModules) {
                store.updateModuleState(modId, { effectiveVolume: 1.0 });
            }
            this.isTransitioning = false;
        }, 1000); // 1 bar at 120 BPM
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
        // Check for boundary triggers at section end
        const store = this.store();
        const currentSection = store.song.arrangement[store.transport.activeSectionIndex];
        if (!currentSection) return;

        const beatsPerBar = store.song.metadata.timeSignature.numerator * (4 / store.song.metadata.timeSignature.denominator);
        const totalBeats = currentSection.bars * beatsPerBar;

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
        // Check expression triggers
        const store = this.store();
        const currentSection = store.song.arrangement[store.transport.activeSectionIndex];
        if (!currentSection) return;

        // Check for markers that trigger expressions
        if (currentSection.markers) {
            for (const marker of currentSection.markers) {
                if (marker.type === 'expressionTrigger' && pos.beatInSection >= marker.beat) {
                    // Fire expression on the target module
                    if (marker.targetModuleId) {
                        const mod = store.song.modules.find(m => m.id === marker.targetModuleId);
                        if (mod?.expression?.enabled && mod.expression.type === 'fill') {
                            store.updateModuleState(marker.targetModuleId, {
                                expression: {
                                    isActive: true,
                                    remainingBeats: mod.expression.durationBeats,
                                    nextTriggerRepeat: 0,
                                },
                            });
                        }
                    }
                }
            }
        }
    }
}

/**
 * Factory to create the arrangement engine and wire it to the store
 */
export function createArrangementEngine(store: () => LooperStoreType): ArrangementEngine {
    return new ArrangementEngine(store);
}