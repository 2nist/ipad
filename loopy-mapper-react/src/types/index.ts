/** Loopy Pro action types and data structures */

export interface ActionEntry {
    name: string;
    id: string | null;
    category: string;
    verified: boolean;
    aliases: string[];
    params?: { key: string; type: string; description: string }[];
}

export interface TargetEntry {
    name: string;
    encoding: string | null;
    verified: boolean;
}

export interface ValuePayload {
    adjustmentType: "absolute" | "relative" | "toggle";
    value: number;
    rampTimeMs: number;
}

export interface NormalizedAction {
    identifier: string;
    subject: string;
    timing: string;
    parameters: Record<string, unknown>;
    valuePayload: ValuePayload | null;
}

export interface NormalizedBinding {
    label: string;
    trigger: Record<string, unknown> | null;
    triggerString: string;
    actions: NormalizedAction[];
}

export interface LayoutConfig {
    enabled?: boolean;
    tracks?: number;
    archetype?: "grid" | "linear";
    rows?: number;
    cols?: number;
    canvas?: { width: number; height: number };
    mixer?: { track: number; name?: string; volume?: number; pan?: number }[];
}

export interface DeviceConfig {
    name: string;
    display_name?: string;
    type?: string;
}

export interface ProjectConfig {
    name: string;
}

export interface AppConfig {
    project: ProjectConfig;
    device: DeviceConfig;
}

export interface BuildResult {
    config: AppConfig;
    bindings: NormalizedBinding[];
    layout: LayoutConfig;
    errors: string[];
    warnings: string[];
}

/** Widget description for canvasLayout generation */
export interface LayoutWidget {
    id: string;
    type: "clipTrigger" | "recordButton" | "mixerSlider";
    targetClipIdentifier: string;
    frame: { x: number; y: number; width: number; height: number };
}

/** Mixer channel entry */
export interface MixerChannel {
    id: string;
    type: "audioTrack";
    name: string;
    volume: number;
    pan: number;
}

/** Full document skeleton for Loopy's document.json */
export interface LoopyDocument {
    version: string;
    mixerChannels: MixerChannel[];
    canvasLayout: {
        pages: { id: string; name: string; widgets: LayoutWidget[] }[];
    };
}

/** Controller profile binding (XML serialization) */
export interface ProfileBinding {
    label: string;
    triggerString: string;
    actions: { identifier: string; subject: string; timing: string; parameters: Record<string, unknown>; valuePayload: ValuePayload | null }[];
}