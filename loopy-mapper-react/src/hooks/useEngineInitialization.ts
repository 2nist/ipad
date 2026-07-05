// ═══════════════════════════════════════════════════════════════════
// useEngineInitialization — Initializes audio/MIDI on user gesture
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useLooperStore } from '../store/store';
import { createTransportClock } from '../lib/transportClock';
import { createArrangementEngine } from '../lib/arrangementEngine';
import { createExpressionEngine } from '../lib/expressionEngine';

export function useEngineInitialization() {
    const initialized = useLooperStore(s => s.engines.initialized);
    const initializeEngines = useLooperStore(s => s.initializeEngines);

    const initialize = useCallback(async () => {
        try {
            await initializeEngines();

            // After engines are initialized, set up the transport clock
            const state = useLooperStore.getState();
            const audioContext = state.engines.audioContext;
            const bpm = state.song.metadata.bpm;

            if (audioContext) {
                const clock = createTransportClock(audioContext, bpm);

                // Wire arrangement engine to clock
                const arrangementEngine = createArrangementEngine(() => useLooperStore.getState());
                arrangementEngine.setClock(clock);

                // Update store with clock reference
                useLooperStore.setState({
                    engines: {
                        ...useLooperStore.getState().engines,
                        clockEngine: clock,
                    },
                });
            }
        } catch (error) {
            console.error('Engine initialization failed:', error);
        }
    }, [initializeEngines]);

    return {
        initialized,
        initialize,
    };
}