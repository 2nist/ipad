"use strict";

const TEMPLATE_ROOT = "template/drum-looper.lpproj";

// The project's ACTIVE control profile, named "Default" in Project.sqlite
// (activeControlProfileNames = ["Default"]), lives in this singular folder.
// Loopy enumerates every <Device>.<Type>.<Name>.controllerprofile inside it and
// binds those devices on load. The generated device profile MUST land here to
// take effect — see ACTIVE_PROFILE_DIR usage in exportProject().
const ACTIVE_PROFILE_DIR = "Control Profile.lpcontrolprofile";
// The named "Drums" library profile (plural folder) is inactive on import; we keep
// it in sync as a convenience for users who later switch profiles by name.
const LIBRARY_PROFILE_DIR = "Control Profiles/Drums.lpcontrolprofile";

// The foot-controller profile is a fixed device (CC20-23 ch1 -> loop tracks 8-11).
// It is fetched from the template and, like the generated pad profile, written into
// BOTH the active folder (so the pedals work on import) and the library folder.
const FOOTCTRL_PROFILE_FILE = "FootCtrl Bluetooth.MIDI.FootCtrl Bluetooth.controllerprofile";

// Files copied verbatim from the template into a single destination. The generated
// pad profile and the foot-controller profile are NOT listed here — they are
// written into both profile folders in exportProject().
const TEMPLATE_FILES = [
  "Info.plist",
  "Project.sqlite",
  "Resources.plist",
  `${ACTIVE_PROFILE_DIR}/Internal.Internal.controllerprofile`
];

// Action library (loopy-actions.js, loaded before this script). Lets the YAML use
// friendly names ("clear") that resolve to verified serialized identifiers
// ("Clear Track"). Falls back gracefully if the file is missing.
const ACTION_LIB = typeof LoopyActions !== "undefined" ? LoopyActions : null;

// Default quantization keys and adjustment types — mirrors loopy-actions.js
// so the YAML editor can validate even if the library failed to load.
const QUANTIZATION_KEYS = ["none", "1_tick", "1_16", "1_8", "1_4", "1_bar", "2_bars", "4_bars"];
const ADJUSTMENT_TYPES = ["absolute", "relative", "toggle"];
const DEFAULT_TARGET_TYPES = ["clip", "mixerChannel", "effect", "clock", "widget", "colorGroup", "midiSource"];

// CSS Grid → Loopy canvas layout constants (from the .md coordinate system)
const CELL_WIDTH_UNIT = 80;
const CELL_HEIGHT_UNIT = 80;
const CANVAS_PADDING = 10;

const DEFAULT_YAML = `# Loopy Mapper configuration
# ── Project ──
project:
  name: Generated Loopy Mapping

# ── Device ──
device:
  name: ATM SQ
  display_name: ATM SQ
  type: MIDI

# ── Layout (optional) ──
# Defines the visual canvas and mixer channels generated alongside bindings.
# If omitted, only the controller profile is generated (no canvas/widgets).
#
# layout:
#   tracks: 8           # Number of loop tracks
#   rows: 2             # Grid rows on canvas (default 2)
#   cols: 4             # Grid columns on canvas (default 4)
#   archetype: grid     # grid | linear | custom
#   canvas:
#     width: 1024
#     height: 768
#   mixer:
#     - track: 0
#       name: "Kick"
#       color: "#ff4444"
#     - track: 7
#       name: "Hi Tom"
#       volume: 0.85

# ── Bindings ──
bindings:
  - label: Kick
    trigger: { kind: note, channel: 10, note: 36 }
    actions:
      - identifier: Track Play/Stop
        subject: "0"
        timing: Sequential
        parameters: {}

  - label: Snare
    trigger: { kind: note, channel: 10, note: 37 }
    actions:
      - identifier: Track Play/Stop
        subject: "1"
        timing: Sequential
        parameters: {}

  - label: Closed HH
    trigger: { kind: note, channel: 10, note: 38 }
    actions:
      - identifier: Track Play/Stop
        subject: "2"
        timing: Sequential
        parameters: {}

  - label: Open HH
    trigger: { kind: note, channel: 10, note: 39 }
    actions:
      - identifier: Track Play/Stop
        subject: "3"
        timing: Sequential
        parameters: {}

  - label: Lo Tom
    trigger: { kind: note, channel: 10, note: 40 }
    actions:
      - identifier: Track Play/Stop
        subject: "4"
        timing: Sequential
        parameters: {}

  - label: Mid Tom
    trigger: { kind: note, channel: 10, note: 41 }
    actions:
      - identifier: Track Play/Stop
        subject: "5"
        timing: Sequential
        parameters: {}

  - label: Hi Tom
    trigger: { kind: note, channel: 10, note: 42 }
    actions:
      - identifier: Track Play/Stop
        subject: "6"
        timing: Sequential
        parameters: {}

  - label: Crash
    trigger: { kind: note, channel: 10, note: 43 }
    actions:
      - identifier: Track Play/Stop
        subject: "7"
        timing: Sequential
        parameters: {}
`;

// ---- DOM references ----
const yamlInput = document.getElementById("yamlInput");
const validateButton = document.getElementById("validateButton");
const exportProfileButton = document.getElementById("exportProfileButton");
const exportProjectButton = document.getElementById("exportProjectButton");
const previewBody = document.getElementById("previewBody");
const bindingCount = document.getElementById("bindingCount");
const messageBox = document.getElementById("messageBox");
const statusLine = document.getElementById("statusLine");
const loadButton = document.getElementById("loadButton");
const resetButton = document.getElementById("resetButton");
const loadFile = document.getElementById("loadFile");

// ---- Init ----
yamlInput.value = DEFAULT_YAML;
scheduleBuild();

// ---- Event wiring ----
yamlInput.addEventListener("input", scheduleBuild);
validateButton.addEventListener("click", () => runBuild());
exportProfileButton.addEventListener("click", exportProfile);
exportProjectButton.addEventListener("click", exportProject);
loadButton.addEventListener("click", () => loadFile.click());
loadFile.addEventListener("change", handleLoadFile);
resetButton.addEventListener("click", () => { yamlInput.value = DEFAULT_YAML; scheduleBuild(); });

// ---- YAML validation & normalization ----

function buildFromYaml(source) {
  const errors = [];
  const warnings = [];
  let parsed;
  try {
    parsed = parseYaml(source);
  } catch (error) {
    errors.push(error.message || String(error));
    return { config: {}, bindings: [], layout: {}, errors, warnings };
  }

  const project = parsed && typeof parsed.project === "object" ? parsed.project : {};
  const device = parsed && typeof parsed.device === "object" ? parsed.device : {};
  const rawBindings = Array.isArray(parsed && parsed.bindings) ? parsed.bindings : [];
  const layoutConfig = parsed && typeof parsed.layout === "object" ? parsed.layout : {};

  if (!project.name) warnings.push("Missing project.name; using 'Generated Loopy Mapping'.");
  if (!device.name) warnings.push("Missing device.name; using 'ATM SQ'.");
  if (!device.display_name) warnings.push("Missing device.display_name; device.name will be used.");
  if (!device.type) warnings.push("Missing device.type; MIDI will be used.");

  // Expand repeat blocks into concrete bindings
  const expandedBindings = [];
  for (const binding of rawBindings) {
    expandedBindings.push(...expandBinding(binding, errors));
  }

  const seenTriggers = new Map();
  const normalized = [];

  expandedBindings.forEach((binding, index) => {
    const row = normalizeBinding(binding, index, errors, warnings);
    normalized.push(row);
    if (row.triggerString) {
      if (seenTriggers.has(row.triggerString)) {
        errors.push(`Duplicate trigger ${row.triggerString} on "${row.label}" and "${seenTriggers.get(row.triggerString)}".`);
      } else {
        seenTriggers.set(row.triggerString, row.label);
      }
    }
  });

  if (normalized.length === 0) {
    errors.push("At least one binding is required.");
  }

  // Normalize layout config
  const layout = normalizeLayoutConfig(layoutConfig, normalized, warnings);

  return { config: { project, device }, bindings: normalized, layout, errors, warnings };
}

// Expand a `repeat: N` binding into N concrete bindings. Per step (index 0..N-1):
//   - trigger.note / trigger.cc increments by step.note / step.cc (default 1)
//   - each numeric action.subject increments by step.subject (default 1)
//   - label tokens: %n (1-based), %i (0-based), %note, %cc, %subject
// A plain binding (no `repeat`) passes through unchanged.
function expandBinding(binding, errors) {
  if (!binding || typeof binding !== "object" || binding.repeat === undefined) {
    return [binding];
  }
  const count = Number(binding.repeat);
  if (!Number.isInteger(count) || count < 1 || count > 256) {
    errors.push(`"${binding.label || "repeat block"}" has an invalid repeat (1..256).`);
    return [binding];
  }
  const step = binding.step && typeof binding.step === "object" ? binding.step : {};
  const noteStep = step.note === undefined ? 1 : Number(step.note);
  const ccStep = step.cc === undefined ? 1 : Number(step.cc);
  const subjStep = step.subject === undefined ? 1 : Number(step.subject);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    const trigger = Object.assign({}, binding.trigger);
    if (trigger && typeof trigger === "object") {
      if (trigger.note !== undefined) trigger.note = Number(trigger.note) + i * noteStep;
      if (trigger.cc !== undefined) trigger.cc = Number(trigger.cc) + i * ccStep;
    }
    const actions = (Array.isArray(binding.actions) ? binding.actions : []).map((a) => {
      const copy = Object.assign({}, a);
      if (copy.subject !== undefined && /^-?\d+$/.test(String(copy.subject))) {
        copy.subject = String(Number(copy.subject) + i * subjStep);
      }
      return copy;
    });
    const tokens = {
      "%n": String(i + 1),
      "%i": String(i),
      "%note": trigger && trigger.note !== undefined ? String(trigger.note) : "",
      "%cc": trigger && trigger.cc !== undefined ? String(trigger.cc) : "",
      "%subject": actions[0] && actions[0].subject !== undefined ? String(actions[0].subject) : ""
    };
    const label = applyTokens(binding.label === undefined ? `Step %n` : String(binding.label), tokens);
    out.push({ label, trigger, actions });
  }
  return out;
}

function applyTokens(text, tokens) {
  return text.replace(/%note|%cc|%subject|%n|%i/g, (t) => (t in tokens ? tokens[t] : t));
}

function normalizeBinding(binding, index, errors, warnings) {
  const label = String(binding && binding.label ? binding.label : `Binding ${index + 1}`);
  const actions = Array.isArray(binding && binding.actions) ? binding.actions : [];

  if (!binding || typeof binding !== "object") {
    errors.push(`Binding ${index + 1} must be an object.`);
  }
  if (!binding || !binding.trigger) {
    errors.push(`"${label}" is missing trigger.`);
  }
  if (actions.length === 0) {
    errors.push(`"${label}" needs at least one action.`);
  }

  const triggerString = binding && binding.trigger ? encodeTrigger(binding.trigger, label, errors) : "";
  const normalizedActions = actions.map((action, actionIndex) => {
    if (!action || typeof action !== "object") {
      errors.push(`"${label}" action ${actionIndex + 1} must be an object.`);
      return { identifier: "", subject: "", timing: "Sequential", parameters: {}, valuePayload: null };
    }

    const rawId = action.identifier || action.action || "";
    let identifier = String(rawId);
    if (!rawId) {
      errors.push(`"${label}" action ${actionIndex + 1} is missing identifier.`);
    } else {
      const found = ACTION_LIB && ACTION_LIB.resolveAction(rawId);
      if (!found) {
        warnings.push(`"${label}" action "${rawId}" is not in the action library; exported as-is.`);
      } else if (found.id) {
        identifier = found.id; // resolve friendly name/alias -> verified serialized id
      }
    }

    // --- valuePayload support for Adjust Parameter ---
    // The YAML can include a `value_payload` key at the action level, or
    // individual keys (`value`, `adjustment`, `ramp_time_ms`) that get
    // synthesized into the payload structure.
    let valuePayload = null;
    if (identifier === "Track Parameter" || identifier === "Effect Parameter" || identifier === "Widget Parameter") {
      valuePayload = buildValuePayload(action, warnings, label);
    }

    return {
      identifier,
      subject: action.subject === undefined ? "" : String(action.subject),
      timing: action.timing ? String(action.timing) : "Sequential",
      parameters: action.parameters && typeof action.parameters === "object" ? action.parameters : {},
      valuePayload
    };
  });

  return { label, trigger: binding ? binding.trigger : null, triggerString, actions: normalizedActions };
}

// Build the valuePayload dict for parameter-adjustment actions.
// Accepts either a structured `value_payload` object or shorthand fields:
//   value, adjustment, ramp_time_ms
function buildValuePayload(action, warnings, label) {
  // First check for explicit value_payload
  if (action.value_payload && typeof action.value_payload === "object") {
    const vp = action.value_payload;
    const adj = vp.adjustmentType || vp.adjustment_type || vp.adjustment;
    const val = vp.value !== undefined ? normalizeFloatValue(vp.value, label, warnings) : 0.707;
    const ramp = vp.rampTimeMs !== undefined ? Number(vp.rampTimeMs) : (vp.ramp_time_ms !== undefined ? Number(vp.ramp_time_ms) : 0);
    return {
      adjustmentType: validateAdjustmentType(adj),
      value: val,
      rampTimeMs: isNaN(ramp) ? 0 : Math.max(0, ramp)
    };
  }

  // Fall back to shorthand fields on the action itself
  if (action.value === undefined && action.adjustment === undefined && action.ramp_time_ms === undefined) {
    return null; // no parameter data supplied
  }

  const adj = action.adjustment;
  const rawValue = action.value;
  const ramp = action.ramp_time_ms !== undefined ? Number(action.ramp_time_ms) : 0;

  return {
    adjustmentType: validateAdjustmentType(adj),
    value: rawValue !== undefined ? normalizeFloatValue(rawValue, label, warnings) : 0.707,
    rampTimeMs: isNaN(ramp) ? 0 : Math.max(0, ramp)
  };
}

// Validate and normalize the adjustment type string.
function validateAdjustmentType(value) {
  if (!value || typeof value !== "string") return "absolute";
  const v = value.toLowerCase().trim();
  if (ADJUSTMENT_TYPES.indexOf(v) !== -1) return v;
  return "absolute"; // default fallback
}

// Normalize a value to Loopy's 0.0-1.0 float range.
// Accepts:
//   - A number 0.0-1.0 (pass through)
//   - A MIDI integer 0-127 (auto-convert via sqrt curve)
//   - A percentage string like "70.7%" (convert percentage)
function normalizeFloatValue(raw, label, warnings) {
  if (raw === null || raw === undefined) return 0.707;

  // Percentage string
  if (typeof raw === "string" && raw.endsWith("%")) {
    const pct = parseFloat(raw);
    if (isNaN(pct)) {
      warnings.push(`"${label}" has invalid percentage value "${raw}". Using default 0.707.`);
      return 0.707;
    }
    // 100% → 1.0, 70.7% → 0.707
    return Math.round(Math.min(pct / 100, 1.0) * 10000) / 10000;
  }

  const num = Number(raw);
  if (isNaN(num)) {
    warnings.push(`"${label}" has non-numeric value "${raw}". Using default 0.707.`);
    return 0.707;
  }

  // If it looks like a MIDI integer (0-127), use the conversion curve
  if (Number.isInteger(num) && num >= 0 && num <= 127) {
    // Only treat as MIDI if explicitly noted, or if > 1.0 (since MIDI)
    if (num > 1) {
      return ACTION_LIB ? ACTION_LIB.midiToFloat(num) : Math.round(Math.sqrt(num / 127) * 10000) / 10000;
    }
  }

  // Clamp to 0.0-1.0 float
  return Math.max(0, Math.min(1, Math.round(num * 10000) / 10000));
}

// ===== Layout configuration normalization =====

function normalizeLayoutConfig(layout, bindings, warnings) {
  if (!layout || Object.keys(layout).length === 0) return {};

  const tracks = layout.tracks !== undefined ? Math.max(1, Math.min(64, Number(layout.tracks))) : 8;
  const archetype = layout.archetype || (tracks > 8 ? "grid" : "linear");
  const rows = layout.rows !== undefined ? Math.max(1, Math.min(8, Number(layout.rows))) : (archetype === "linear" ? 1 : 2);
  const cols = layout.cols !== undefined ? Math.max(1, Math.min(16, Number(layout.cols))) : Math.ceil(tracks / rows);
  const canvasW = (layout.canvas && layout.canvas.width) || 1024;
  const canvasH = (layout.canvas && layout.canvas.height) || 768;
  const mixerChannels = Array.isArray(layout.mixer) ? layout.mixer : [];

  // Detect up to `tracks` mixer definitions from bindings if not provided
  if (mixerChannels.length === 0 && bindings.length > 0 && tracks > 0) {
    for (let t = 0; t < Math.min(tracks, bindings.length); t += 1) {
      mixerChannels.push({ track: t, name: bindings[t].label || `Track ${t + 1}` });
    }
  }

  return {
    enabled: true,
    tracks,
    archetype,
    rows,
    cols,
    canvas: { width: canvasW, height: canvasH },
    mixer: mixerChannels
  };
}

// ===== Controller Profile XML generation =====

function generateControllerProfile(config, bindings) {
  const device = config.device || {};
  const deviceName = device.name || "ATM SQ";
  const displayName = device.display_name || deviceName;
  const type = device.type || "MIDI";
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    `\t<key>Bindings</key>`,
    `\t<array>`
  ];

  for (const binding of bindings) {
    lines.push(`\t\t<!-- ${escapeXmlComment(binding.label)} -->`);
    lines.push(`\t\t<dict>`);
    lines.push(`\t\t\t<key>Actions</key>`);
    lines.push(`\t\t\t<array>`);
    for (const action of binding.actions) {
      lines.push(`\t\t\t\t<dict>`);
      lines.push(`\t\t\t\t\t<key>Identifier</key>`);
      lines.push(`\t\t\t\t\t<string>${escapeXml(action.identifier)}</string>`);
      lines.push(`\t\t\t\t\t<key>Parameters</key>`);
      lines.push(formatPlistValue(action.parameters, 5));
      lines.push(`\t\t\t\t\t<key>Subject</key>`);
      lines.push(`\t\t\t\t\t<string>${escapeXml(action.subject)}</string>`);
      lines.push(`\t\t\t\t\t<key>Timing</key>`);
      lines.push(`\t\t\t\t\t<string>${escapeXml(action.timing)}</string>`);
      // Include valuePayload if present (for Adjust Parameter actions)
      if (action.valuePayload) {
        lines.push(`\t\t\t\t\t<key>ValuePayload</key>`);
        lines.push(formatPlistValue(action.valuePayload, 5));
      }
      lines.push(`\t\t\t\t</dict>`);
    }
    lines.push(`\t\t\t</array>`);
    lines.push(`\t\t\t<key>Trigger</key>`);
    lines.push(`\t\t\t<string>${escapeXml(binding.triggerString)}</string>`);
    lines.push(`\t\t</dict>`);
  }

  lines.push(`\t</array>`);
  lines.push(`\t<key>Device</key>`);
  lines.push(`\t<string>${escapeXml(deviceName)}</string>`);
  lines.push(`\t<key>Device Name</key>`);
  lines.push(`\t<string>${escapeXml(displayName)}</string>`);
  lines.push(`\t<key>Type</key>`);
  lines.push(`\t<string>${escapeXml(type)}</string>`);
  lines.push(`</dict>`);
  lines.push(`</plist>`);
  return `${lines.join("\n")}\n`;
}

function formatPlistValue(value, indentLevel) {
  const indent = "\t".repeat(indentLevel);
  const childIndent = "\t".repeat(indentLevel + 1);

  if (value === null || value === undefined) return `${indent}<string></string>`;
  if (typeof value === "boolean") return `${indent}<${value ? "true" : "false"}/>`;
  if (typeof value === "number") {
    return Number.isInteger(value) ? `${indent}<integer>${value}</integer>` : `${indent}<real>${value}</real>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}<array/>`;
    return [
      `${indent}<array>`,
      ...value.map((item) => formatPlistValue(item, indentLevel + 1)),
      `${indent}</array>`
    ].join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${indent}<dict/>`;
    const lines = [`${indent}<dict>`];
    for (const [key, childValue] of entries) {
      lines.push(`${childIndent}<key>${escapeXml(key)}</key>`);
      lines.push(formatPlistValue(childValue, indentLevel + 1));
    }
    lines.push(`${indent}</dict>`);
    return lines.join("\n");
  }
  return `${indent}<string>${escapeXml(String(value))}</string>`;
}

// ===== Loopy canvas layout (document.json) generation =====

function generateCanvasLayout(layout) {
  if (!layout || !layout.enabled) return null;

  const { tracks, rows, cols, archetype, canvas } = layout;

  // Build mixerChannels array
  const mixerChannels = [];
  const mixerMeta = layout.mixer || [];
  for (let t = 0; t < tracks; t += 1) {
    const meta = mixerMeta.find((m) => Number(m.track) === t) || {};
    mixerChannels.push({
      id: `strip_audio_${t + 1}`,
      type: "audioTrack",
      name: meta.name || `Loop Track ${t + 1}`,
      volume: meta.volume !== undefined ? Math.max(0, Math.min(1, Number(meta.volume))) : 0.707,
      pan: meta.pan !== undefined ? Math.max(-1, Math.min(1, Number(meta.pan))) : 0
    });
  }

  // Build canvasLayout widgets
  let widgets;
  if (archetype === "linear") {
    widgets = generateLinearLayout(tracks, canvas);
  } else {
    // Default: grid layout
    widgets = generateGridLayout(tracks, rows, cols, canvas);
  }

  // Build the document skeleton
  return {
    version: "2.0",
    mixerChannels,
    canvasLayout: {
      pages: [
        {
          id: "page_performance_1",
          name: "Main Grid",
          widgets
        }
      ]
    }
  };
}

function generateGridLayout(tracks, rows, cols, canvas) {
  const widgets = [];
  const cellW = Math.floor((canvas.width - CANVAS_PADDING * 2) / cols);
  const cellH = Math.floor((canvas.height - CANVAS_PADDING * 2) / rows);

  for (let t = 0; t < tracks; t += 1) {
    const col = t % cols;
    const row = Math.floor(t / cols);
    widgets.push({
      id: `widget_loop_${t}`,
      type: "clipTrigger",
      targetClipIdentifier: `group_0_track_${t}`,
      frame: {
        x: CANVAS_PADDING + col * cellW,
        y: CANVAS_PADDING + row * cellH,
        width: cellW - 4,
        height: cellH - 4
      }
    });
  }
  return widgets;
}

function generateLinearLayout(tracks, canvas) {
  const widgets = [];
  const stripCount = Math.max(1, tracks);
  const stripW = Math.floor((canvas.width - CANVAS_PADDING * 2) / stripCount);

  for (let t = 0; t < stripCount; t += 1) {
    // Each strip: record button (top), play/stop (middle), volume (bottom)
    const x = CANVAS_PADDING + t * stripW;
    const buttonH = Math.floor((canvas.height - CANVAS_PADDING * 2) / 3);

    // Record button
    widgets.push({
      id: `widget_rec_${t}`,
      type: "recordButton",
      targetClipIdentifier: `group_0_track_${t}`,
      frame: { x, y: CANVAS_PADDING, width: stripW - 4, height: buttonH - 4 }
    });
    // Play/Stop
    widgets.push({
      id: `widget_play_${t}`,
      type: "clipTrigger",
      targetClipIdentifier: `group_0_track_${t}`,
      frame: { x, y: CANVAS_PADDING + buttonH, width: stripW - 4, height: buttonH - 4 }
    });
    // Volume fader
    widgets.push({
      id: `widget_vol_${t}`,
      type: "mixerSlider",
      targetClipIdentifier: `group_0_track_${t}`,
      frame: { x, y: CANVAS_PADDING + buttonH * 2, width: stripW - 4, height: buttonH - 4 }
    });
  }
  return widgets;
}

// ===== Trigger encoding =====

function encodeTrigger(trigger, label, errors) {
  if (typeof trigger === "string") return trigger;
  if (!trigger || typeof trigger !== "object") {
    errors.push(`"${label}" trigger must be an object or raw string.`);
    return "";
  }

  if (trigger.raw !== undefined) return String(trigger.raw);

  const kind = String(trigger.kind || "").toLowerCase();
  const channel = Number(trigger.channel);
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
    errors.push(`"${label}" trigger.channel must be 1..16.`);
    return "";
  }

  // Loopy encodes triggers as HEX MIDI bytes: <status><data1>[<value>].
  // A press/tap includes the value byte (default 0x7f / 127); a hold gesture
  // is prefixed "h:" and omits the value byte (e.g. h:b215 = hold CC21 ch3).
  // Status nibble: 9 = NoteOn, b = CC; low nibble = 0-based channel.
  const channelIndex = channel - 1;
  const hold = trigger.hold === true || String(trigger.gesture || "").toLowerCase() === "hold";
  const value = trigger.value === undefined ? 127 : Number(trigger.value);

  if (kind === "note") {
    const note = Number(trigger.note);
    if (!Number.isInteger(note) || note < 0 || note > 127) {
      errors.push(`"${label}" trigger.note must be 0..127.`);
      return "";
    }
    const status = 0x90 | channelIndex;
    return hold ? `h:${midiHex(status)}${midiHex(note)}` : `${midiHex(status)}${midiHex(note)}${midiHex(value)}`;
  }

  if (kind === "cc") {
    const cc = Number(trigger.cc);
    if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
      errors.push(`"${label}" trigger.cc must be 0..127.`);
      return "";
    }
    const status = 0xb0 | channelIndex;
    return hold ? `h:${midiHex(status)}${midiHex(cc)}` : `${midiHex(status)}${midiHex(cc)}${midiHex(value)}`;
  }

  errors.push(`"${label}" trigger.kind must be note, cc, or use raw.`);
  return "";
}

// Two-digit lowercase hex for a single MIDI byte.
function midiHex(n) {
  return (n & 0xff).toString(16).padStart(2, "0");
}

// ===== Preview rendering =====

function renderResult(result) {
  previewBody.replaceChildren();
  bindingCount.textContent = `${result.bindings.length} ${result.bindings.length === 1 ? "binding" : "bindings"}`;

  if (result.layout && result.layout.enabled) {
    const widgetCount = estimateWidgetCount(result.layout);
    bindingCount.textContent += ` · ${widgetCount} canvas widgets`;
  }

  if (result.errors.length > 0) {
    setMessage(result.errors.join(" "), "bad");
    setStatus("Validation failed");
  } else if (result.warnings.length > 0) {
    setMessage(result.warnings.join(" "), "warn");
    setStatus("Validated with warnings");
  } else {
    setMessage("Ready to export.", "good");
    setStatus("Validated");
  }

  if (result.bindings.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty";
    cell.textContent = "No bindings.";
    row.append(cell);
    previewBody.append(row);
    return;
  }

  for (const binding of result.bindings) {
    const row = document.createElement("tr");
    const actionsText = binding.actions.map((a) => {
      let text = a.identifier;
      if (a.valuePayload) {
        text += ` (${a.valuePayload.adjustmentType}: ${a.valuePayload.value})`;
      }
      return text;
    }).join(", ");
    row.append(
      textCell(binding.label),
      codeCell(binding.triggerString || "invalid"),
      textCell(actionsText),
      textCell(binding.actions.map((action) => action.subject).join(", "))
    );
    previewBody.append(row);
  }
}

function estimateWidgetCount(layout) {
  if (!layout || !layout.enabled) return 0;
  if (layout.archetype === "linear") return layout.tracks * 3; // rec + play + vol per track
  return layout.tracks; // one widget per track
}

function textCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function codeCell(value) {
  const cell = document.createElement("td");
  const code = document.createElement("code");
  code.textContent = value;
  cell.append(code);
  return cell;
}

function setMessage(text, tone) {
  messageBox.textContent = text;
  messageBox.className = `messageBox ${tone || ""}`.trim();
}

function setStatus(text) {
  statusLine.textContent = text;
}

// ===== Export functions =====

async function exportProfile() {
  const result = buildFromYaml(yamlInput.value);
  renderResult(result);
  if (result.errors.length > 0) return;

  const xml = generateControllerProfile(result.config, result.bindings);
  const deviceName = sanitizeFilePart(result.config.device && result.config.device.name || "ATM SQ");
  downloadBlob(new Blob([xml], { type: "application/xml" }), `${deviceName}.MIDI.${deviceName}.controllerprofile`);
  setStatus("Profile exported");
}

async function exportProject() {
  const result = buildFromYaml(yamlInput.value);
  renderResult(result);
  if (result.errors.length > 0) return;

  try {
    setStatus("Building project zip...");
    const projectName = sanitizeFilePart(result.config.project && result.config.project.name || "Generated Loopy Mapping");
    const root = `${projectName}.lpproj`;
    const profileXml = generateControllerProfile(result.config, result.bindings);
    const deviceName = sanitizeFilePart(result.config.device && result.config.device.name || "ATM SQ");
    const profileFileName = `${deviceName}.MIDI.${deviceName}.controllerprofile`;
    const profileBytes = new TextEncoder().encode(profileXml);
    const footCtrlBytes = await fetchTemplateFile(`${LIBRARY_PROFILE_DIR}/${FOOTCTRL_PROFILE_FILE}`);
    const files = [];

    // Copy the static template files verbatim.
    for (const relativePath of TEMPLATE_FILES) {
      files.push({
        name: `${root}/${relativePath}`,
        data: await fetchTemplateFile(relativePath)
      });
    }

    // Write the generated pad profile AND the foot-controller profile into the
    // ACTIVE profile folder so both devices attach on import, plus the named
    // library folder to keep the "Drums" profile in sync.
    for (const dir of [ACTIVE_PROFILE_DIR, LIBRARY_PROFILE_DIR]) {
      files.push({ name: `${root}/${dir}/${profileFileName}`, data: profileBytes });
      files.push({ name: `${root}/${dir}/${FOOTCTRL_PROFILE_FILE}`, data: footCtrlBytes });
    }

    // If a layout is configured, generate a document.json stub with
    // mixerChannels and canvasLayout, and include it in the bundle.
    const docJson = generateCanvasLayout(result.layout);
    if (docJson) {
      files.push({
        name: `${root}/document.json`,
        data: new TextEncoder().encode(JSON.stringify(docJson, null, 2))
      });
    }

    const zip = createZip(files);
    downloadBlob(new Blob([zip], { type: "application/zip" }), `${projectName}.lpproj.zip`);
    setStatus("Project zip exported");
  } catch (error) {
    setMessage(error.message || String(error), "bad");
    setStatus("Export failed");
  }
}

async function fetchTemplateFile(relativePath) {
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${TEMPLATE_ROOT}/${encodedPath}`);
  if (!response.ok) {
    throw new Error(`Could not load template file: ${relativePath}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// ===== YAML Parser (minimal, no external dependency) =====

function parseYaml(source) {
  const lines = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw, index) => ({ raw, index: index + 1, text: stripComment(raw) }))
    .filter((line) => line.text.trim() !== "")
    .map((line) => ({
      number: line.index,
      indent: line.text.match(/^ */)[0].length,
      text: line.text.trim()
    }));

  if (lines.length === 0) return {};

  let cursor = 0;

  function parseNode(indent) {
    if (cursor >= lines.length) return null;
    if (lines[cursor].indent < indent) return null;
    if (lines[cursor].indent === indent && lines[cursor].text.startsWith("- ")) {
      return parseArray(indent);
    }
    return parseObject(indent);
  }

  function parseArray(indent) {
    const items = [];
    while (cursor < lines.length && lines[cursor].indent === indent && lines[cursor].text.startsWith("- ")) {
      const rest = lines[cursor].text.slice(2).trim();
      cursor += 1;

      if (rest === "") {
        items.push(parseNode(nextIndent(indent)));
        continue;
      }

      const pair = splitKeyValue(rest);
      if (pair) {
        const item = {};
        item[pair.key] = pair.value === "" ? parseNode(nextIndent(indent)) : parseValue(pair.value);
        if (cursor < lines.length && lines[cursor].indent > indent) {
          Object.assign(item, parseObject(lines[cursor].indent));
        }
        items.push(item);
      } else {
        items.push(parseValue(rest));
      }
    }
    return items;
  }

  function parseObject(indent) {
    const object = {};
    while (cursor < lines.length && lines[cursor].indent >= indent) {
      const line = lines[cursor];
      if (line.indent < indent) break;
      if (line.indent > indent) break;
      if (line.text.startsWith("- ")) break;

      const pair = splitKeyValue(line.text);
      if (!pair) {
        throw new Error(`Line ${line.number}: expected key: value.`);
      }

      cursor += 1;
      object[pair.key] = pair.value === "" ? parseNode(nextIndent(indent)) : parseValue(pair.value);
    }
    return object;
  }

  function nextIndent(fallback) {
    return cursor < lines.length ? lines[cursor].indent : fallback + 2;
  }

  const parsed = parseNode(lines[0].indent);
  if (cursor < lines.length) {
    throw new Error(`Line ${lines[cursor].number}: could not parse "${lines[cursor].text}".`);
  }
  return parsed;
}

function splitKeyValue(text) {
  let inQuote = "";
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuote) {
      if (char === inQuote && text[i - 1] !== "\\") inQuote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      inQuote = char;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") depth -= 1;
    if (char === ":" && depth === 0) {
      return { key: text.slice(0, i).trim(), value: text.slice(i + 1).trim() };
    }
  }
  return null;
}

function parseValue(value) {
  const trimmed = value.trim();
  if (trimmed === "{}") return {};
  if (trimmed === "[]") return [];
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, "\"").replace(/\\'/g, "'");
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineMap(trimmed.slice(1, -1));
  }
  return trimmed;
}

function parseInlineMap(body) {
  const object = {};
  for (const part of splitTopLevel(body, ",")) {
    if (part.trim() === "") continue;
    const pair = splitKeyValue(part.trim());
    if (!pair) throw new Error(`Invalid inline map item: ${part}`);
    object[pair.key] = parseValue(pair.value);
  }
  return object;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let start = 0;
  let inQuote = "";
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuote) {
      if (char === inQuote && text[i - 1] !== "\\") inQuote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      inQuote = char;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function stripComment(raw) {
  let inQuote = "";
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inQuote) {
      if (char === inQuote && raw[i - 1] !== "\\") inQuote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      inQuote = char;
      continue;
    }
    if (char === "#") return raw.slice(0, i);
  }
  return raw;
}

// ===== ZIP creation (no JSZip dependency) =====

function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const { time, date } = getDosDateTime();

  for (const file of files) {
    const name = encoder.encode(file.name.replace(/\\/g, "/"));
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const flags = 0x0800;
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, flags, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, data);

    const headerOffset = offset;
    offset += local.length + data.length;

    const center = new Uint8Array(46 + name.length);
    const centerView = new DataView(center.buffer);
    centerView.setUint32(0, 0x02014b50, true);
    centerView.setUint16(4, 20, true);
    centerView.setUint16(6, 20, true);
    centerView.setUint16(8, flags, true);
    centerView.setUint16(10, 0, true);
    centerView.setUint16(12, time, true);
    centerView.setUint16(14, date, true);
    centerView.setUint32(16, crc, true);
    centerView.setUint32(20, data.length, true);
    centerView.setUint32(24, data.length, true);
    centerView.setUint16(28, name.length, true);
    centerView.setUint16(30, 0, true);
    centerView.setUint16(32, 0, true);
    centerView.setUint16(34, 0, true);
    centerView.setUint16(36, 0, true);
    centerView.setUint32(38, 0, true);
    centerView.setUint32(42, headerOffset, true);
    center.set(name, 46);
    central.push(center);
  }

  const centralOffset = offset;
  const centralSize = central.reduce((total, chunk) => total + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return concatUint8([...chunks, ...central, end]);
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

let crcTable = null;

function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[i] = c >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime() {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilePart(value) {
  return String(value || "Loopy Mapping")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Loopy Mapping";
}

function escapeXml(value) {
  return String(value)
    .replace(/[&]/g, function (m) { return "&" + "amp;"; })
    .replace(/</g, function (m) { return "&" + "lt;"; })
    .replace(/>/g, function (m) { return "&" + "gt;"; })
    .replace(/"/g, function (m) { return "&" + "quot;"; })
    .replace(/'/g, function (m) { return "&" + "apos;"; });
}

function escapeXmlComment(value) {
  return String(value).replace(/--/g, "- -").replace(/[<>]/g, "");
}

// ===== Build scheduling =====

let _buildTimer = 0;
function scheduleBuild() {
  clearTimeout(_buildTimer);
  _buildTimer = setTimeout(() => runBuild(), 150);
}

function runBuild() {
  const result = buildFromYaml(yamlInput.value);
  renderResult(result);
}