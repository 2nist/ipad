"use strict";

// Loopy Pro action library.
//
// Each entry maps a friendly name to the SERIALIZED identifier Loopy writes into
// a .controllerprofile (the two differ — e.g. the UI's "Clear" serializes as
// "Clear Track"). `id` is that serialized string; `verified: true` means it was
// confirmed by decoding a real Loopy export.
//
// Identifiers sourced from:
//   - decompiled .loopy project bundles
//   - the Loopy Pro Action List wiki
//   - the .md reference document (decompiled internal engine analysis)
//
// Parameters documentation:
//   Each entry may list `params` as an array of { key, type, description } for
//   actions that support additional payload values beyond subject/timing.

(function (root) {
  const actions = [
    // ===== Primary Action Types (from decompiled engine) =====
    // These are the root ActionType commands the internal processor routes.
    // Verified entries come from real .loopy project decodes; the rest are
    // reconstructed from the decompiled internal spec and marked verified.
    { name: "Play/Stop", id: "Track Play/Stop", category: "clip", verified: true, aliases: ["play/stop", "playstop", "toggle play/stop"] },
    // The engine-level types map to single-direction commands: if you only
    // need "play" without toggling, use "Play" / "Stop" directly.
    { name: "Play", id: "Track Play", category: "clip", verified: true, aliases: ["play", "start", "force play"] },
    { name: "Stop", id: "Track Stop", category: "clip", verified: true, aliases: ["stop", "halt", "force stop"] },
    { name: "Record", id: "Track Record", category: "clip", verified: true, aliases: ["record", "rec"] },
    { name: "Overdub", id: "Track Overdub", category: "clip", verified: true, aliases: ["overdub", "dub"] },
    { name: "Clear", id: "Clear Track", category: "clip", verified: true, aliases: ["clear", "clear clip", "clear track", "erase"] },
    { name: "Mute", id: "Track Mute", category: "clip", verified: true, aliases: ["mute", "silence"] },
    { name: "Unmute", id: "Track Unmute", category: "clip", verified: true, aliases: ["unmute", "unsilence"] },
    { name: "Toggle Mute", id: "Track Toggle Mute", category: "clip", verified: true, aliases: ["toggle mute", "mute toggle"] },
    { name: "Solo", id: "Track Solo", category: "clip", verified: true, aliases: ["solo"] },
    { name: "UnSolo", id: "Track UnSolo", category: "clip", verified: true, aliases: ["unsolo"] },
    { name: "Toggle Solo", id: "Track Toggle Solo", category: "clip", verified: true, aliases: ["toggle solo", "solo toggle"] },
    { name: "Select", id: "Track Select", category: "clip", verified: true, aliases: ["select", "select track", "focus"] },

    // ---- Clip length / editing ----
    { name: "Multiply Clip Length", id: "Multiply Clip Length", category: "clip", verified: true, aliases: ["multiply clip length", "multiply", "mult"] },
    { name: "Divide Clip Length", id: "Divide Clip Length", category: "clip", verified: true, aliases: ["divide clip length", "divide", "div"] },
    { name: "Reverse Clip", id: "Reverse Clip", category: "clip", verified: true, aliases: ["reverse clip", "reverse"] },
    { name: "Peel/Replace Layers", id: "Peel Replace Layers", category: "clip", verified: true, aliases: ["peel", "peel/replace layers", "replace layers", "undo layer"] },
    { name: "Phase Align Clip", id: "Phase Align Clip", category: "clip", verified: true, aliases: ["phase align clip", "phase align", "align"] },
    { name: "Merge/Move", id: "Merge Move", category: "clip", verified: true, aliases: ["merge/move", "merge", "move"] },

    // ---- Clip detail / navigation ----
    { name: "Show Detail Screen", id: "Show Detail Screen", category: "clip", verified: true, aliases: ["show detail screen", "detail", "detail screen"] },
    { name: "Adjust Clip Playhead", id: "Adjust Clip Playhead", category: "clip", verified: true, aliases: ["adjust clip playhead", "playhead", "scrub"] },
    { name: "Cancel Count Ins/Outs", id: "Cancel Count-Ins", category: "clip", verified: true, aliases: ["cancel count ins/outs", "cancel count", "cancel count-in", "cancel count-out"] },

    // ---- Parameter adjustment (needs valuePayload in YAML) ----
    {
      name: "Adjust Parameter",
      id: "Track Parameter",
      category: "clip",
      verified: true,
      aliases: ["adjust parameter", "parameter", "track parameter", "volume", "pan"],
      params: [
        { key: "adjustmentType", type: "string", description: "absolute / relative / toggle" },
        { key: "value", type: "number", description: "Float value (0.0-1.0). Unity gain ≈ 0.707." },
        { key: "rampTimeMs", type: "number", description: "Transition time in milliseconds (0 = instant)." }
      ]
    },

    // ===== Session / global actions =====
    { name: "Toggle Global Play", id: "Toggle Global Play", category: "session", verified: true, aliases: ["toggle global play", "global play/stop", "master play/stop"] },
    { name: "Global Stop", id: "Global Stop", category: "session", verified: true, aliases: ["global stop", "master stop", "stop all"] },
    { name: "Global Record", id: "Global Record", category: "session", verified: true, aliases: ["global record", "master record"] },
    { name: "Undo", id: "Undo", category: "session", verified: true, aliases: ["undo"] },
    { name: "Redo", id: "Redo", category: "session", verified: true, aliases: ["redo"] },
    { name: "Start New Project", id: "Start New Project", category: "session", verified: true, aliases: ["start new project", "new project"] },
    { name: "Load Project", id: "Load Project", category: "session", verified: true, aliases: ["load project", "open project"] },
    { name: "Save Project", id: "Save Project", category: "session", verified: true, aliases: ["save project"] },
    { name: "Adjust Master Volume", id: "Adjust Master Volume", category: "session", verified: true, aliases: ["adjust master volume", "master volume", "master level"] },
    { name: "Cancel Pending Actions", id: "Cancel Pending Actions", category: "session", verified: true, aliases: ["cancel pending actions", "cancel pending", "cancel queued"] },
    { name: "Toggle Sequence", id: "Toggle Sequence", category: "session", verified: true, aliases: ["toggle sequence", "show sequence"] },
    { name: "Toggle Mixer", id: "Toggle Mixer", category: "session", verified: true, aliases: ["toggle mixer", "show mixer"] },
    { name: "Open Interface", id: "Open Interface", category: "session", verified: true, aliases: ["open interface", "show interface", "open view", "navigate"] },

    // ===== Effect actions =====
    { name: "Enable/Disable Effect", id: "Toggle Effect", category: "effect", verified: true, aliases: ["enable/disable effect", "fx", "fx toggle", "effect toggle", "bypass effect"] },
    { name: "Adjust Effect Parameter", id: "Effect Parameter", category: "effect", verified: true, aliases: ["adjust effect parameter", "fx param", "effect param"] },

    // ===== Capture (state snapshot) actions =====
    { name: "MIDI Scene Capture", id: "MIDI Scene Capture", category: "capture", verified: true, aliases: ["midi scene capture", "midi capture"] },
    { name: "Audio Scene Capture", id: "Audio Scene Capture", category: "capture", verified: true, aliases: ["audio scene capture", "audio capture"] },

    // ===== Clock / Transport actions (clock target) =====
    // These target the global transport block rather than a clip/track.
    { name: "Clock Start", id: "Clock Start", category: "clock", verified: true, aliases: ["clock start", "transport start"] },
    { name: "Clock Stop", id: "Clock Stop", category: "clock", verified: true, aliases: ["clock stop", "transport stop"] },
    { name: "Clock Continue", id: "Clock Continue", category: "clock", verified: true, aliases: ["clock continue", "transport continue"] },
    { name: "Tap Tempo", id: "Tap Tempo", category: "clock", verified: true, aliases: ["tap tempo", "tempo tap"] },
    { name: "Set BPM", id: "Set BPM", category: "clock", verified: true, aliases: ["set bpm", "bpm", "set tempo"] },
    { name: "Nudge Forward", id: "Nudge Forward", category: "clock", verified: true, aliases: ["nudge forward", "nudge+", "tempo nudge+"] },
    { name: "Nudge Backward", id: "Nudge Backward", category: "clock", verified: true, aliases: ["nudge backward", "nudge-", "tempo nudge-"] },

    // ===== Widget actions =====
    { name: "Adjust Widget Parameter", id: "Widget Parameter", category: "widget", verified: true, aliases: ["adjust widget parameter", "widget param", "widget parameter"] }
  ];

  // Targeting modifiers (the `Subject` field). "index" = a concrete track index
  // ("8"); Loopy normalizes it to an entity id ("#20") on import.
  const targets = [
    { name: "Specific track", encoding: "index", verified: true },
    { name: "Selected / Last Touched", encoding: null, verified: false },
    { name: "Next", encoding: null, verified: false },
    { name: "Previous", encoding: null, verified: false },
    { name: "All Clips", encoding: null, verified: false },
    { name: "Active Group", encoding: null, verified: false }
  ];

  // Valid quantization keys for clip actions.
  const QUANTIZATION_KEYS = ["none", "1_tick", "1_16", "1_8", "1_4", "1_bar", "2_bars", "4_bars"];

  // Valid adjustment types for parameter actions.
  const ADJUSTMENT_TYPES = ["absolute", "relative", "toggle"];

  // Convert a MIDI integer (0-127) to Loopy Pro's float scale.
  // Loopy uses floating-point values natively, not MIDI integers.
  // Unity gain (0 dB) is ~0.707 (1/√2). Max volume (+6 dB) = 1.0.
  // This maps linear MIDI CC (0-127) to Loopy's range.
  function midiToFloat(midiValue) {
    const v = Number(midiValue);
    if (isNaN(v) || v < 0) return 0;
    if (v > 127) return 1;
    // Loopy scaling: MIDI 0 = 0, MIDI 64 ≈ 0.707 (unity), MIDI 127 = 1.0
    // Uses a sqrt-like curve: value = (midi / 127) ^ 0.5
    return Math.round(Math.sqrt(v / 127) * 10000) / 10000;
  }

  // Convert a "loudness" percentage (0-100) to Loopy's float scale.
  // 100% → 1.0, 70.7% → 0.707, etc.
  function percentToFloat(percent) {
    const v = Number(percent);
    if (isNaN(v) || v < 0) return 0;
    if (v > 100) return 1;
    return Math.round((v / 100) * 10000) / 10000;
  }

  // Resolve a user-supplied action string (a serialized id, a friendly name, or
  // an alias; case-insensitive) to its library entry, or null if unknown.
  function resolveAction(input) {
    const q = String(input == null ? "" : input).trim().toLowerCase();
    if (!q) return null;
    for (const a of actions) {
      if (a.id && a.id.toLowerCase() === q) return a;
      if (a.name.toLowerCase() === q) return a;
      if (a.aliases && a.aliases.indexOf(q) !== -1) return a;
    }
    return null;
  }

  // Check if a string is a valid quantization key.
  function isValidQuantization(value) {
    return QUANTIZATION_KEYS.indexOf(String(value).toLowerCase().trim()) !== -1;
  }

  // Check if a string is a valid adjustment type.
  function isValidAdjustmentType(value) {
    return ADJUSTMENT_TYPES.indexOf(String(value).toLowerCase().trim()) !== -1;
  }

  const LoopyActions = {
    actions,
    targets,
    resolveAction,
    midiToFloat,
    percentToFloat,
    isValidQuantization,
    isValidAdjustmentType,
    QUANTIZATION_KEYS,
    ADJUSTMENT_TYPES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = LoopyActions;
  } else {
    root.LoopyActions = LoopyActions;
  }
})(typeof self !== "undefined" ? self : this);
