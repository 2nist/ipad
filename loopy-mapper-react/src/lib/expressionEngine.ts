// ═══════════════════════════════════════════════════════════════════
// EXPRESSION ENGINE — Conditional override system for fills,
// variations, and transitions
// ═══════════════════════════════════════════════════════════════════

import type {
    ModuleExpression, RhythmExpression, HarmonicExpression,
    ArrangementExpression, ExpressionTrigger, ExpressionBehavior,
    ModuleRuntimeState,
} from '../types';
import type { LooperStoreType } from '../store/store';

export class ExpressionEngine {
    private store: () => LooperStoreType;

    constructor(store: () => LooperStoreType) {
        this.store = store;
    }

    /**
     * Check if an expression should fire based on its trigger config.
     */
    shouldFire(
        expression: ModuleExpression,
        repeatCount: number,
        sectionContext?: { fromSection?: string; toSection?: string },
    ): boolean {
        if (!expression.enabled) return false;

        const trigger = expression.trigger;
        switch (trigger.type) {
            case 'everyNRepeats':
                if (!trigger.everyN || trigger.everyN <= 0) return false;
                return repeatCount > 0 && repeatCount % trigger.everyN === 0;

            case 'onSectionChange':
                if (!sectionContext) return false;
                if (trigger.fromSection && trigger.fromSection !== sectionContext.fromSection) return false;
                if (trigger.toSection && trigger.toSection !== sectionContext.toSection) return false;
                return true;

            case 'manual':
                // Manual triggers are dispatched via MIDI or UI buttons
                return false;

            case 'random':
                if (!trigger.probability) return false;
                return Math.random() < trigger.probability;

            default:
                return false;
        }
    }

    /**
     * Execute an expression. Returns a cleanup function.
     */
    execute(
        expression: ModuleExpression,
        moduleId: string,
    ): () => void {
        const store = this.store();

        switch (expression.behavior) {
            case 'replace':
                // Mute parent tracks
                store.updateModuleState(moduleId, { isSectionMuted: true });
                break;

            case 'layer':
                // Keep parent playing, expression plays on top
                store.updateModuleState(moduleId, {
                    expression: {
                        isActive: true,
                        remainingBeats: this.getDurationBeats(expression),
                        nextTriggerRepeat: 0,
                    },
                });
                break;

            case 'morph':
                // Crossfade — handled by arrangement engine
                store.updateModuleState(moduleId, { effectiveVolume: 0.5 });
                break;
        }

        // Return cleanup function
        return () => {
            store.updateModuleState(moduleId, {
                isSectionMuted: false,
                effectiveVolume: 1.0,
                expression: {
                    isActive: false,
                    remainingBeats: 0,
                    nextTriggerRepeat: 0,
                },
            });
        };
    }

    private getDurationBeats(expression: ModuleExpression): number {
        switch (expression.type) {
            case 'fill':
                return expression.durationBeats;
            case 'variation':
                return (expression.durationBars || 4) * 4;
            case 'transition':
                return expression.durationBeats;
            default:
                return 4;
        }
    }

    /**
     * Get the auto-assigned MIDI note for an expression trigger.
     */
    getExpressionMidiNote(moduleId: string): number {
        const store = this.store();
        const mod = store.song.modules.find(m => m.id === moduleId);
        if (!mod) return 0;
        return mod.baseMidiNote + mod.tracks.length;
    }
}

// Singleton
export const expressionEngine = new ExpressionEngine(
    () => { throw new Error('ExpressionEngine not initialized: store not set'); }
);

export function createExpressionEngine(
    getStore: () => LooperStoreType,
): ExpressionEngine {
    return new ExpressionEngine(getStore);
}