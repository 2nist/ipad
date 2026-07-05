import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Loopy Pro float calibration: MIDI 0-127 → 0.0-1.0 via sqrt curve. Unity gain (0 dB) ≈ 0.707. */
export function midiToFloat(midiValue: number): number {
    const v = Math.max(0, Math.min(127, Math.round(midiValue)));
    return Math.round(Math.sqrt(v / 127) * 10000) / 10000;
}

/** Percentage string "70.7%" → 0.707 */
export function percentToFloat(percent: number | string): number {
    const v = typeof percent === "string" ? parseFloat(percent) : percent;
    if (isNaN(v)) return 0.707;
    return Math.round(Math.min(v / 100, 1) * 10000) / 10000;
}

/** Normalize a value to Loopy's 0.0-1.0 float range. */
export function normalizeFloatValue(raw: unknown): number {
    if (raw == null) return 0.707;
    if (typeof raw === "string" && raw.endsWith("%")) {
        return percentToFloat(raw.slice(0, -1));
    }
    const num = Number(raw);
    if (isNaN(num)) return 0.707;
    if (Number.isInteger(num) && num >= 0 && num <= 127 && num > 1) {
        return midiToFloat(num);
    }
    return Math.max(0, Math.min(1, Math.round(num * 10000) / 10000));
}

/** Two-digit lowercase hex for a single MIDI byte. */
export function midiHex(n: number): string {
    return (n & 0xff).toString(16).padStart(2, "0");
}