"use strict";

// Loopy Pro action library.
//
// Each entry maps a friendly name to the SERIALIZED identifier Loopy writes into
// a .controllerprofile (the two differ — e.g. the UI's "Clear" serializes as
// "Clear Track"). `id` is that serialized string; `verified: true` means it was
// confirmed by decoding a real Loopy export. Entries with `id: null` are known
// to exist (from the public Action List) but their serialized identifier has not
// been harvested yet — this doubles as the to-do backlog.
//
// Harvest workflow: set the action up in Loopy, export the project, run
// tools/decode-lpproj.js on it, and copy the real identifier in here as verified.

(function (root) {
  const actions = [
    // ---- Clip actions ----
    { name: "Play/Stop", id: "Track Play/Stop", category: "clip", verified: true, aliases: ["play/stop", "playstop", "toggle play/stop", "play", "stop"] },
    { name: "Clear", id: "Clear Track", category: "clip", verified: true, aliases: ["clear", "clear clip", "clear track", "erase"] },
    { name: "Record", id: null, category: "clip", verified: false, aliases: ["record"] },
    { name: "Overdub", id: null, category: "clip", verified: false, aliases: ["overdub"] },
    { name: "Mute", id: null, category: "clip", verified: false, aliases: ["mute"] },
    { name: "Toggle Mute", id: null, category: "clip", verified: false, aliases: ["toggle mute"] },
    { name: "Solo", id: null, category: "clip", verified: false, aliases: ["solo"] },
    { name: "Select", id: null, category: "clip", verified: false, aliases: ["select"] },
    { name: "Peel/Replace Layers", id: null, category: "clip", verified: false, aliases: ["peel", "peel/replace layers", "replace layers", "undo layer"] },
    { name: "Adjust Parameter", id: null, category: "clip", verified: false, aliases: ["adjust parameter", "parameter"] },
    { name: "Adjust Clip Playhead", id: null, category: "clip", verified: false, aliases: ["adjust clip playhead", "playhead", "scrub"] },
    { name: "Merge/Move", id: null, category: "clip", verified: false, aliases: ["merge/move", "merge", "move"] },
    { name: "Multiply Clip Length", id: null, category: "clip", verified: false, aliases: ["multiply clip length", "multiply"] },
    { name: "Divide Clip Length", id: null, category: "clip", verified: false, aliases: ["divide clip length", "divide"] },
    { name: "Show Detail Screen", id: null, category: "clip", verified: false, aliases: ["show detail screen", "detail"] },
    { name: "Phase Align Clip", id: null, category: "clip", verified: false, aliases: ["phase align clip", "phase align"] },
    { name: "Reverse Clip", id: null, category: "clip", verified: false, aliases: ["reverse clip", "reverse"] },
    { name: "Cancel Count Ins/Outs", id: null, category: "clip", verified: false, aliases: ["cancel count ins/outs", "cancel count"] },

    // ---- Session actions ----
    { name: "Undo", id: null, category: "session", verified: false, aliases: ["undo"] },
    { name: "Redo", id: null, category: "session", verified: false, aliases: ["redo"] },
    { name: "Start New Project", id: null, category: "session", verified: false, aliases: ["start new project", "new project"] },
    { name: "Load Project", id: null, category: "session", verified: false, aliases: ["load project"] },
    { name: "Save Project", id: null, category: "session", verified: false, aliases: ["save project"] },
    { name: "Adjust Master Volume", id: null, category: "session", verified: false, aliases: ["adjust master volume", "master volume"] },
    { name: "Cancel Pending Actions", id: null, category: "session", verified: false, aliases: ["cancel pending actions", "cancel pending"] },
    { name: "Toggle Sequence", id: null, category: "session", verified: false, aliases: ["toggle sequence"] },
    { name: "Toggle Mixer", id: null, category: "session", verified: false, aliases: ["toggle mixer"] }
  ];

  // Targeting modifiers (the `Subject` field). "index" = a concrete track index
  // ("8"); Loopy normalizes it to an entity id ("#20") on import. The serialized
  // forms for the dynamic targets are still unverified — harvest them the same way.
  const targets = [
    { name: "Specific track", encoding: "index", verified: true },
    { name: "Selected / Last Touched", encoding: null, verified: false },
    { name: "Next", encoding: null, verified: false },
    { name: "Previous", encoding: null, verified: false },
    { name: "All Clips", encoding: null, verified: false },
    { name: "Active Group", encoding: null, verified: false }
  ];

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

  const LoopyActions = { actions, targets, resolveAction };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = LoopyActions;
  } else {
    root.LoopyActions = LoopyActions;
  }
})(typeof self !== "undefined" ? self : this);
