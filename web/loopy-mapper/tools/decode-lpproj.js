"use strict";

// Decode a Loopy Pro project export and harvest its control-profile bindings.
//
//   node tools/decode-lpproj.js <path-to.lpproj | .zip | .log>
//
// Prints every controller profile's bindings (trigger -> action -> subject) and a
// harvest summary: which serialized action identifiers are already verified in
// loopy-actions.js and which are NEW (candidates to add as verified). Transparently
// repairs the UTF-8 mangling that happens when a binary export is committed as text
// (every high byte expanded to a c2/c3 sequence) by reversing it via latin1.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

let LIB = null;
try { LIB = require("../loopy-actions.js"); } catch (e) { /* optional */ }

const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/decode-lpproj.js <path-to .lpproj/.zip/.log>");
  process.exit(1);
}

let buf = fs.readFileSync(file);
// If it doesn't start with a zip signature but is valid UTF-8, it was likely a
// binary committed as text (ISO-8859-1 -> UTF-8). Reverse it.
if (buf.slice(0, 4).toString("hex") !== "504b0304") {
  const asUtf8 = buf.toString("utf8");
  const recovered = Buffer.from(asUtf8, "latin1");
  if (recovered.slice(0, 4).toString("hex") === "504b0304") {
    console.log("(note: input was UTF-8-mangled; recovered the original zip bytes)\n");
    buf = recovered;
  }
}

// Parse the central directory (authoritative for offsets/sizes/names).
const CD = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const entries = [];
let i = 0;
while ((i = buf.indexOf(CD, i)) >= 0) {
  const fnl = buf.readUInt16LE(i + 28);
  entries.push({
    method: buf.readUInt16LE(i + 10),
    csize: buf.readUInt32LE(i + 20),
    lho: buf.readUInt32LE(i + 42),
    name: buf.slice(i + 46, i + 46 + fnl).toString("latin1")
  });
  i += 4;
}
if (entries.length === 0) {
  console.error("No zip central directory found — file may be corrupted beyond repair.");
  process.exit(2);
}

function inflate(rec) {
  const lfnl = buf.readUInt16LE(rec.lho + 26);
  const lexl = buf.readUInt16LE(rec.lho + 28);
  const start = rec.lho + 30 + lfnl + lexl;
  const data = buf.slice(start, start + rec.csize);
  return (rec.method === 0 ? data : zlib.inflateRawSync(data)).toString("utf8");
}

const BIND_RE = /<key>Identifier<\/key>\s*<string>([^<]*)<\/string>[\s\S]*?<key>Subject<\/key>\s*<string>([^<]*)<\/string>[\s\S]*?<key>Trigger<\/key>\s*<string>([^<]*)<\/string>/g;
const seenIds = new Set();

for (const rec of entries.filter((e) => /controllerprofile$/.test(e.name))) {
  const xml = inflate(rec);
  const dev = (xml.match(/<key>Device Name<\/key>\s*<string>([^<]*)/) || [])[1]
    || (xml.match(/<key>Device<\/key>\s*<string>([^<]*)/) || [])[1] || "?";
  console.log(`\n### ${rec.name}`);
  console.log(`    Device: ${dev}`);
  let m;
  while ((m = BIND_RE.exec(xml))) {
    const [, id, subject, trigger] = m;
    seenIds.add(id);
    console.log(`    ${trigger.padEnd(8)} -> ${id.padEnd(18)} subject ${subject}`);
  }
}

// Harvest summary.
console.log("\n========== ACTION HARVEST ==========");
const verified = new Set();
const unverifiedKnown = new Map(); // id -> friendly name
if (LIB) {
  for (const a of LIB.actions) {
    if (a.id) verified.add(a.id);
  }
}
const newIds = [];
for (const id of seenIds) {
  if (verified.has(id)) {
    console.log(`  [verified] ${id}`);
  } else {
    newIds.push(id);
  }
}
if (newIds.length) {
  console.log("\n  NEW identifiers (add to loopy-actions.js as verified):");
  for (const id of newIds) console.log(`    + ${id}`);
} else {
  console.log("\n  No new identifiers — library already covers this export.");
}
