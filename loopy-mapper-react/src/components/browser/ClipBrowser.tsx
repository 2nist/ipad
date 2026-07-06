/**
 * ClipBrowser — MIDI dataset browser with preview.
 *
 * Fetches from the FastAPI backend using SETLE-based filters,
 * displays clips as visual cards, and plays MIDI previews via
 * the Audio Preview Engine.
 */

import { useEffect, useCallback } from "react";
import { Search, Play, Square, Music, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLooperStore } from "@/store/store";
import type { ClipMetadata } from "@/lib/api";
import { fetchMidiBinary } from "@/lib/api";
import { audioPreview } from "@/lib/audio-preview";

// ── key/scale options for SETLE harmony filtering ──

const KEY_OPTIONS = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
const SCALE_OPTIONS = ["major", "minor", "dominant"];
const DENSITY_OPTIONS = [
    { label: "Any", value: -1 },
    { label: "Sparse (< 2 n/b)", value: 2 },
    { label: "Medium (2-5)", value: 3 },
    { label: "Dense (5+)", value: 5 },
];

export default function ClipBrowser() {
    // ── Read from Zustand store ──
    const filters = useLooperStore(s => s.clipBrowser.filters);
    const results = useLooperStore(s => s.clipBrowser.results);
    const loading = useLooperStore(s => s.clipBrowser.loading);
    const error = useLooperStore(s => s.clipBrowser.error);
    const activePreviewId = useLooperStore(s => s.clipBrowser.activePreviewId);

    const setFilters = useLooperStore(s => s.setFilters);
    const searchClips = useLooperStore(s => s.searchClips);
    const setActivePreview = useLooperStore(s => s.setActivePreview);
    const toggleClipBrowser = useLooperStore(s => s.toggleClipBrowser);

    // ── Load datasets from available DB datasets ──
    const datasetOptions = useLooperStore(s => {
        const dsets = new Set<string>();
        if (s.clipBrowser.results) {
            for (const c of s.clipBrowser.results.clips) dsets.add(c.dataset);
        }
        return ["", ...Array.from(dsets)];
    });

    // ── Auto-search on filter change ──
    const fetchClips = useCallback(() => {
        searchClips();
    }, [searchClips]);

    // Fetch on mount
    useEffect(() => {
        if (!results) fetchClips();
    }, [results, fetchClips]);

    // ── Preview handler ──
    const handlePreview = async (clip: ClipMetadata) => {
        if (activePreviewId === clip.id) {
            audioPreview.stop();
            setActivePreview(null);
            return;
        }
        audioPreview.stop();
        setActivePreview(clip.id);
        try {
            const buffer = await fetchMidiBinary(clip.id);
            await audioPreview.previewClip(buffer, clip.tempo);
        } catch (err) {
            console.error("Preview failed:", err);
            setActivePreview(null);
        }
    };

    // ── Pagination ──
    const limit = 24;
    const totalClips = results?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalClips / limit));
    const page = Math.floor((results?.offset ?? 0) / limit);

    const goToPage = (p: number) => {
        const offset = p * limit;
        setFilters({ key: null, scale: null, dataset: null, minDensity: null, maxDensity: null, minBars: null, maxBars: null });
        // Trigger search with page offset via the store
        const currentFilters = useLooperStore.getState().clipBrowser.filters;
        useLooperStore.getState().setFilters(currentFilters);
        // Re-run search manually with pagination
        const params = new URLSearchParams();
        if (filters.key) params.set("key", filters.key);
        if (filters.scale) params.set("scale", filters.scale);
        if (filters.dataset) params.set("dataset", filters.dataset);
        if (filters.minDensity !== null) params.set("min_density", String(filters.minDensity));
        if (filters.maxDensity !== null) params.set("max_density", String(filters.maxDensity));
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        // Use the store's searchClips which reads from current filter state
        useLooperStore.getState().setFilters({
            ...useLooperStore.getState().clipBrowser.filters,
        });
        // Force re-search manually
        window.dispatchEvent(new CustomEvent('clipbrowser:page', { detail: { offset } }));
    };

    // ── Density label ──
    const densityLabel = (d: number) => {
        if (d < 2) return "Sparse";
        if (d < 5) return "Medium";
        if (d < 10) return "Dense";
        return "Very Dense";
    };

    const handleDensityChange = (value: string) => {
        const v = Number(value);
        if (v === -1) {
            setFilters({ minDensity: null, maxDensity: null });
        } else if (v === 2) {
            setFilters({ minDensity: null, maxDensity: 2 });
        } else if (v === 3) {
            setFilters({ minDensity: 2, maxDensity: 5 });
        } else {
            setFilters({ minDensity: 5, maxDensity: null });
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* ─── Header with close ─── */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">Clip Library</h2>
                    {results && (
                        <span className="text-xs text-zinc-500">({results.total} clips)</span>
                    )}
                </div>
                <button
                    onClick={toggleClipBrowser}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* ─── Filter Bar ─── */}
            <div className="flex flex-wrap gap-2 p-3 border-b border-zinc-800 bg-zinc-900/50">
                <select
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                    value={filters.key ?? ""}
                    onChange={(e) => setFilters({ key: e.target.value || null })}
                >
                    <option value="">All Keys</option>
                    {KEY_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>

                <select
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                    value={filters.scale ?? ""}
                    onChange={(e) => setFilters({ scale: e.target.value || null })}
                >
                    <option value="">All Scales</option>
                    {SCALE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                    value={filters.dataset ?? ""}
                    onChange={(e) => setFilters({ dataset: e.target.value || null })}
                >
                    {datasetOptions.map((d) => (
                        <option key={d} value={d}>{d || "All Datasets"}</option>
                    ))}
                </select>

                <select
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                    value={filters.maxDensity ?? -1}
                    onChange={(e) => handleDensityChange(e.target.value)}
                >
                    {DENSITY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                </select>

                <div className="flex-1" />

                <button
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                    onClick={fetchClips}
                >
                    <Search className="w-3 h-3" />
                    Search
                </button>

                {activePreviewId && (
                    <button
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                        onClick={() => { audioPreview.stop(); setActivePreview(null); }}
                    >
                        <Square className="w-3 h-3" />
                        Stop
                    </button>
                )}
            </div>

            {/* ─── Clip Grid ─── */}
            <div className="flex-1 overflow-y-auto p-3">
                {loading && (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {!loading && !error && results && results.clips.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                        <Music className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">No clips found.</p>
                        <p className="text-xs mt-1">Try different filters or run the ingest pipeline.</p>
                    </div>
                )}

                {!loading && !error && results && results.clips.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {results.clips.map((clip) => (
                            <div
                                key={clip.id}
                                className={cn(
                                    "group relative flex flex-col gap-1 p-2.5 rounded-lg border transition-all cursor-pointer",
                                    "border-zinc-800 hover:border-blue-600/50 hover:bg-blue-950/20",
                                    activePreviewId === clip.id && "border-blue-500 bg-blue-950/30 ring-1 ring-blue-500"
                                )}
                                onClick={() => handlePreview(clip)}
                            >
                                {/* Preview button overlay */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {activePreviewId === clip.id ? (
                                        <Square className="w-4 h-4 text-red-400" />
                                    ) : (
                                        <Play className="w-4 h-4 text-blue-400" />
                                    )}
                                </div>

                                {/* Clip name */}
                                <div className="flex items-center gap-1.5">
                                    <Music className="w-3 h-3 text-zinc-500 shrink-0" />
                                    <span className="text-xs font-medium text-zinc-200 truncate pr-6">
                                        {clip.file_path.split("/").pop()?.replace(/\.mid$/i, "") || clip.id}
                                    </span>
                                </div>

                                {/* Metadata tags */}
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-medium">
                                        {clip.detected_key} {clip.detected_scale}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                        {densityLabel(clip.note_density)}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                        {clip.bar_length}b
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                        {clip.dataset}
                                    </span>
                                </div>

                                {/* Mini density bar */}
                                <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500/40 rounded-full transition-all"
                                        style={{ width: `${Math.min(clip.note_density / 10 * 100, 100)}%` }}
                                    />
                                </div>

                                {/* Footer stats */}
                                <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                                    <span>{Math.round(clip.tempo)} BPM</span>
                                    <span>{clip.time_sig_num}/{clip.time_sig_den}</span>
                                    <span>{clip.note_count} notes</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Pagination ─── */}
            {results && totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 p-2 border-t border-zinc-800 bg-zinc-900">
                    <button
                        className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 text-zinc-400"
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 0}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-xs text-zinc-500 px-2">
                        {page + 1} / {totalPages}
                    </span>

                    <button
                        className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 text-zinc-400"
                        onClick={() => goToPage(page + 1)}
                        disabled={page + 1 >= totalPages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
