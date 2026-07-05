/**
 * ClipBrowser — MIDI dataset browser with preview.
 *
 * Fetches from the FastAPI backend using SETLE-based filters,
 * displays clips as visual cards, and plays MIDI previews via
 * the Audio Preview Engine.
 */

import { useEffect, useState, useCallback } from "react";
import { Search, Play, Square, Music, FileDown, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    ClipMetadata,
    ClipSearchFilters,
    ClipSearchResponse,
    searchClips,
    fetchMidiBinary,
} from "@/lib/api";
import { audioPreview } from "@/lib/audio-preview";

// ── key/scale options for SETLE harmony filtering ──

const KEY_OPTIONS = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
const SCALE_OPTIONS = ["major", "minor", "dominant", ""];
const DATASET_OPTIONS = ["", "e-gmd", "tegridy"];
const DENSITY_OPTIONS = [
    { label: "Any", value: 0 },
    { label: "Sparse (< 2 n/b)", value: 2 },
    { label: "Medium (2-5 n/b)", value: 5 },
    { label: "Dense (5-10 n/b)", value: 10 },
];

export default function ClipBrowser() {
    const [filters, setFilters] = useState<ClipSearchFilters>({
        key: "",
        scale: "",
        dataset: "",
        limit: 24,
        offset: 0,
    });
    const [response, setResponse] = useState<ClipSearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

    const fetchClips = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await searchClips(filters);
            setResponse(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch clips");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchClips();
    }, [fetchClips]);

    // ── Preview handler ──

    const handlePreview = async (clip: ClipMetadata) => {
        if (previewingId === clip.id) {
            audioPreview.stop();
            setPreviewingId(null);
            return;
        }

        audioPreview.stop();
        setPreviewLoadingId(clip.id);

        try {
            const buffer = await fetchMidiBinary(clip.id);
            await audioPreview.previewClip(buffer, clip.tempo);
            setPreviewingId(clip.id);
        } catch (err) {
            console.error("Preview failed:", err);
        } finally {
            setPreviewLoadingId(null);
        }
    };

    // ── Pagination ──

    const totalPages = response ? Math.ceil(response.total / filters.limit!) : 0;
    const currentPage = Math.floor(filters.offset! / filters.limit!) + 1;

    const goToPage = (page: number) => {
        setFilters((f) => ({ ...f, offset: (page - 1) * f.limit! }));
    };

    // ── Density label ──

    const densityLabel = (d: number) => {
        if (d < 2) return "Sparse";
        if (d < 5) return "Medium";
        if (d < 10) return "Dense";
        return "Very Dense";
    };

    return (
        <div className="flex flex-col h-full">
            {/* ─── Filter Bar ─── */}
            <div className="flex flex-wrap gap-2 p-3 border-b border-border items-center bg-background/80 sticky top-0 z-10">
                <Music className="w-4 h-4 text-muted" />
                <select
                    className="bg-background border border-border rounded px-2 py-1 text-sm"
                    value={filters.key}
                    onChange={(e) => setFilters((f) => ({ ...f, key: e.target.value, offset: 0 }))}
                >
                    <option value="">All Keys</option>
                    {KEY_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>

                <select
                    className="bg-background border border-border rounded px-2 py-1 text-sm"
                    value={filters.scale}
                    onChange={(e) => setFilters((f) => ({ ...f, scale: e.target.value, offset: 0 }))}
                >
                    <option value="">All Scales</option>
                    {SCALE_OPTIONS.filter(Boolean).map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    className="bg-background border border-border rounded px-2 py-1 text-sm"
                    value={filters.dataset}
                    onChange={(e) => setFilters((f) => ({ ...f, dataset: e.target.value, offset: 0 }))}
                >
                    {DATASET_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d || "All Datasets"}</option>
                    ))}
                </select>

                <select
                    className="bg-background border border-border rounded px-2 py-1 text-sm"
                    value={filters.max_density}
                    onChange={(e) => setFilters((f) => ({ ...f, max_density: Number(e.target.value), offset: 0 }))}
                >
                    {DENSITY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                </select>

                <div className="flex-1" />

                {response && (
                    <span className="text-xs text-muted">
                        {response.total} clips
                    </span>
                )}

                <button
                    className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
                    onClick={fetchClips}
                >
                    <Search className="w-3 h-3" />
                    Search
                </button>

                {/* Close button for when preview is playing */}
                {previewingId && (
                    <button
                        className="flex items-center gap-1 px-3 py-1 bg-destructive text-white rounded text-sm"
                        onClick={() => { audioPreview.stop(); setPreviewingId(null); }}
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
                        <Loader2 className="w-6 h-6 animate-spin text-muted" />
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded text-sm">
                        {error}
                    </div>
                )}

                {!loading && !error && response && response.clips.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-muted">
                        <Music className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">No clips match your filters.</p>
                        <p className="text-xs">Try a different key or scale, or ingest datasets first.</p>
                    </div>
                )}

                {!loading && !error && response && response.clips.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {response.clips.map((clip) => (
                            <div
                                key={clip.id}
                                className={cn(
                                    "group relative flex flex-col gap-1 p-3 rounded-lg border transition-all cursor-pointer",
                                    "hover:border-primary/50 hover:bg-primary/5",
                                    previewingId === clip.id && "border-primary bg-primary/10 ring-1 ring-primary"
                                )}
                                onClick={() => handlePreview(clip)}
                            >
                                {/* Preview button overlay */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {previewLoadingId === clip.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-muted" />
                                    ) : previewingId === clip.id ? (
                                        <Square className="w-4 h-4 text-destructive" />
                                    ) : (
                                        <Play className="w-4 h-4 text-primary" />
                                    )}
                                </div>

                                {/* Clip name */}
                                <div className="flex items-center gap-1.5">
                                    <Music className="w-3.5 h-3.5 text-muted shrink-0" />
                                    <span className="text-sm font-medium truncate">
                                        {clip.file_path.split("/").pop()?.replace(".mid", "") || clip.id}
                                    </span>
                                </div>

                                {/* Metadata tags */}
                                <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                        {clip.detected_key} {clip.detected_scale}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted">
                                        {densityLabel(clip.note_density)}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted">
                                        {clip.bar_length} bars
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted">
                                        {clip.dataset}
                                    </span>
                                </div>

                                {/* Mini density bar */}
                                <div className="mt-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary/40 rounded-full transition-all"
                                        style={{ width: `${Math.min(clip.note_density / 10 * 100, 100)}%` }}
                                    />
                                </div>

                                {/* Footer stats */}
                                <div className="flex justify-between text-[10px] text-muted mt-0.5">
                                    <span>{clip.tempo} BPM</span>
                                    <span>{clip.time_sig_num}/{clip.time_sig_den}</span>
                                    <span>{clip.note_count} notes</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Pagination ─── */}
            {response && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
                    <button
                        className="p-1 rounded hover:bg-muted/20 disabled:opacity-30"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const page = Math.max(1, Math.min(currentPage - 3, totalPages - 6)) + i;
                        if (page < 1 || page > totalPages) return null;
                        return (
                            <button
                                key={page}
                                className={cn(
                                    "px-2 py-1 text-sm rounded transition-colors",
                                    page === currentPage
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted/20"
                                )}
                                onClick={() => goToPage(page)}
                            >
                                {page}
                            </button>
                        );
                    })}

                    <button
                        className="p-1 rounded hover:bg-muted/20 disabled:opacity-30"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}