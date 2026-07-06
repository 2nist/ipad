// ═══════════════════════════════════════════════════════════════════
// CLIP BROWSER SLICE — Search filters, results, preview state
// ═══════════════════════════════════════════════════════════════════

import type { StateCreator } from 'zustand';
import type { LooperStore, ClipBrowserFilters } from '../types';
import { searchClips } from '../lib/api';
import type { ClipSearchResponse } from '../lib/api';

// Re-export the API response type as the store's search result type
export type ClipBrowserSearchResult = ClipSearchResponse;

export interface ClipBrowserSlice {
    clipBrowser: {
        filters: ClipBrowserFilters;
        results: ClipSearchResponse | null;
        loading: boolean;
        error: string | null;
        activePreviewId: string | null;
    };
    setFilters: (filters: Partial<ClipBrowserFilters>) => void;
    searchClips: () => Promise<void>;
    setResults: (results: ClipSearchResponse | null) => void;
    setLoading: (loading: boolean) => void;
    setActivePreview: (clipId: string | null) => void;
}

const DEFAULT_FILTERS: ClipBrowserFilters = {
    key: null,
    scale: null,
    dataset: null,
    minDensity: null,
    maxDensity: null,
    minBars: null,
    maxBars: null,
};

export const createClipBrowserSlice: StateCreator<
    LooperStore,
    [],
    [],
    ClipBrowserSlice
> = (set, get) => ({
    clipBrowser: {
        filters: { ...DEFAULT_FILTERS },
        results: null,
        loading: false,
        error: null,
        activePreviewId: null,
    },

    setFilters: (filters: Partial<ClipBrowserFilters>) => {
        set(state => ({
            clipBrowser: {
                ...state.clipBrowser,
                filters: { ...state.clipBrowser.filters, ...filters },
            },
        }));
    },

    searchClips: async (pageOffset?: number) => {
        const { filters } = get().clipBrowser;
        set(state => ({
            clipBrowser: { ...state.clipBrowser, loading: true, error: null },
        }));

        try {
            const apiFilters: Record<string, string | number> = {};
            if (filters.key) apiFilters.key = filters.key;
            if (filters.scale) apiFilters.scale = filters.scale;
            if (filters.dataset) apiFilters.dataset = filters.dataset;
            if (filters.minDensity !== null) apiFilters.min_density = filters.minDensity;
            if (filters.maxDensity !== null) apiFilters.max_density = filters.maxDensity;
            if (filters.minBars !== null) apiFilters.min_bars = filters.minBars;
            if (filters.maxBars !== null) apiFilters.max_bars = filters.maxBars;
            apiFilters.limit = 24;
            apiFilters.offset = pageOffset ?? 0;

            const result = await searchClips(apiFilters as any);
            set(state => ({
                clipBrowser: {
                    ...state.clipBrowser,
                    results: result,
                    loading: false,
                },
            }));
        } catch (error) {
            set(state => ({
                clipBrowser: {
                    ...state.clipBrowser,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Search failed',
                },
            }));
        }
    },

    setResults: (results: ClipSearchResponse | null) => {
        set(state => ({
            clipBrowser: { ...state.clipBrowser, results },
        }));
    },

    setLoading: (loading: boolean) => {
        set(state => ({
            clipBrowser: { ...state.clipBrowser, loading },
        }));
    },

    setActivePreview: (clipId: string | null) => {
        set(state => ({
            clipBrowser: { ...state.clipBrowser, activePreviewId: clipId },
        }));
    },
});