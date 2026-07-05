// ═══════════════════════════════════════════════════════════════════
// MAIN ZUSTAND STORE — Compose all slices into a single store
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { LooperStore } from '../types';
import { createSongSlice, type SongSlice } from './songSlice';
import { createTransportSlice, type TransportSlice } from './transportSlice';
import { createEngineSlice, type EngineSlice } from './engineSlice';
import { createUiSlice, type UiSlice } from './uiSlice';
import { createModuleStateSlice, type ModuleStateSlice } from './moduleStateSlice';
import { createClipBrowserSlice, type ClipBrowserSlice } from './clipBrowserSlice';

// Combined store type = LooperStore data + all slice actions
export type LooperStoreType = LooperStore &
    SongSlice &
    TransportSlice &
    EngineSlice &
    UiSlice &
    ModuleStateSlice &
    ClipBrowserSlice;

export const useLooperStore = create<LooperStoreType>()((...a) => {
    const [set, get, store] = a;
    return {
        // Data from slices
        ...createSongSlice(...a),
        ...createTransportSlice(...a),
        ...createEngineSlice(...a),
        ...createUiSlice(...a),
        ...createModuleStateSlice(...a),
        ...createClipBrowserSlice(...a),
    } as LooperStoreType;
});

export default useLooperStore;