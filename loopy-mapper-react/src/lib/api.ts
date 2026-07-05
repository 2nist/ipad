/**
 * API client for the Python FastAPI backend.
 * Handles clip search and MIDI streaming.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8766";

export interface ClipMetadata {
    id: string;
    file_path: string;
    dataset: string;
    subdir: string;
    bar_length: number;
    note_density: number;
    detected_key: string;
    detected_scale: string;
    time_sig_num: number;
    time_sig_den: number;
    tempo: number;
    pitch_classes: string;
    micro_timing: number;
    note_count: number;
    duration_bars: number;
    file_size: number;
}

export interface ClipSearchResponse {
    total: number;
    limit: number;
    offset: number;
    clips: ClipMetadata[];
}

export interface ClipSearchFilters {
    key?: string;
    scale?: string;
    min_density?: number;
    max_density?: number;
    dataset?: string;
    min_bars?: number;
    max_bars?: number;
    limit?: number;
    offset?: number;
}

export async function searchClips(filters: ClipSearchFilters = {}): Promise<ClipSearchResponse> {
    const params = new URLSearchParams();
    if (filters.key) params.set("key", filters.key);
    if (filters.scale) params.set("scale", filters.scale);
    if (filters.min_density !== undefined && filters.min_density > 0) params.set("min_density", String(filters.min_density));
    if (filters.max_density !== undefined && filters.max_density < 10) params.set("max_density", String(filters.max_density));
    if (filters.dataset) params.set("dataset", filters.dataset);
    if (filters.min_bars !== undefined && filters.min_bars > 0) params.set("min_bars", String(filters.min_bars));
    if (filters.max_bars !== undefined && filters.max_bars < 256) params.set("max_bars", String(filters.max_bars));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.offset !== undefined) params.set("offset", String(filters.offset));

    const res = await fetch(`${API_BASE}/api/clips?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
}

export async function getClip(clipId: string): Promise<ClipMetadata> {
    const res = await fetch(`${API_BASE}/api/clips/${clipId}`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
}

export function getStreamUrl(clipId: string): string {
    return `${API_BASE}/api/clips/${clipId}/stream`;
}

/**
 * Fetch the raw MIDI binary for a clip and parse it client-side.
 * Returns the MIDI as an ArrayBuffer for Tone.js or Web Audio parsing.
 */
export async function fetchMidiBinary(clipId: string): Promise<ArrayBuffer> {
    const res = await fetch(getStreamUrl(clipId));
    if (!res.ok) throw new Error(`Stream error: ${res.status}`);
    return res.arrayBuffer();
}