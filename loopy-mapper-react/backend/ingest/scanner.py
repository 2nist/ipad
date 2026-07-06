#!/usr/bin/env python3
"""
MIDI Dataset Ingest Scanner
Scans e-gmd and Tegridy dataset directories, extracts musical features via
pretty_midi, and stores metadata in SQLite for fast API queries.

Usage:
    python -m backend.ingest.scanner --dataset-dir /path/to/datasets

Expected directory structure:
    datasets/
      e-gmd/
        groovemania/
          4-4/
            *.mid
          3-4/
            *.mid
      tegridy/
        *.mid
"""

import argparse
import hashlib
import os
import sqlite3
import sys
from pathlib import Path
from typing import Optional

try:
    import pretty_midi
except ImportError:
    pretty_midi = None

# ── Schema ──

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS midi_clips (
    id              TEXT PRIMARY KEY,
    file_path       TEXT NOT NULL,
    dataset         TEXT NOT NULL,
    subdir          TEXT DEFAULT '',
    bar_length      INTEGER DEFAULT 0,
    note_density    REAL DEFAULT 0.0,
    detected_key    TEXT DEFAULT '',
    detected_scale  TEXT DEFAULT '',
    time_sig_num    INTEGER DEFAULT 4,
    time_sig_den    INTEGER DEFAULT 4,
    tempo           REAL DEFAULT 120.0,
    pitch_classes   TEXT DEFAULT '',
    micro_timing    REAL DEFAULT 0.0,
    note_count      INTEGER DEFAULT 0,
    duration_bars   REAL DEFAULT 0.0,
    file_size       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_midi_clips_key ON midi_clips(detected_key);
CREATE INDEX IF NOT EXISTS idx_midi_clips_scale ON midi_clips(detected_scale);
CREATE INDEX IF NOT EXISTS idx_midi_clips_dataset ON midi_clips(dataset);
CREATE INDEX IF NOT EXISTS idx_midi_clips_density ON midi_clips(note_density);
"""

# ── Feature extraction ──

def extract_features(filepath: str) -> dict:
    """Extract musical features from a MIDI file using pretty_midi."""
    # Always compute file-based metadata (no MIDI parsing needed)
    with open(filepath, "rb") as f:
        data = f.read()

    result = {
        "id": hashlib.sha256(data).hexdigest()[:16],
        "file_size": len(data),
        "bar_length": 0,
        "note_density": 0.0,
        "detected_key": "C",
        "detected_scale": "major",
        "time_sig_num": 4,
        "time_sig_den": 4,
        "tempo": 120.0,
        "pitch_classes": "",
        "micro_timing": 0.0,
        "note_count": 0,
        "duration_bars": 0.0,
    }

    if pretty_midi is None:
        return result

    try:
        pm = pretty_midi.PrettyMIDI(filepath)
    except Exception:
        return result

    # Time signature
    if pm.time_signature_changes:
        ts = pm.time_signature_changes[0]
        result["time_sig_num"] = ts.numerator
        result["time_sig_den"] = ts.denominator

    # Tempo
    if pm.get_tempo_changes()[1].size > 0:
        result["tempo"] = float(pm.get_tempo_changes()[1][0])

    # Key detection (estimate from pitch class histogram)
    pitches = []
    for inst in pm.instruments:
        if not inst.is_drum:
            for note in inst.notes:
                pitches.append(note.pitch % 12)

    if pitches:
        # Pitch class distribution
        from collections import Counter
        pc_counts = Counter(pitches)
        total = sum(pc_counts.values())
        # Normalized pitch class string for SETLE harmony
        result["pitch_classes"] = ",".join(
            f"{p}:{c/total:.3f}" for p, c in sorted(pc_counts.items())
        )
        # Simple key heuristic: most common pitch = root
        root = pc_counts.most_common(1)[0][0]
        # Map to note name
        note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        result["detected_key"] = note_names[root]

        # Scale detection: check for major vs minor thirds
        has_major_third = pc_counts.get((root + 4) % 12, 0) > 0
        has_minor_third = pc_counts.get((root + 3) % 12, 0) > 0
        if has_major_third and not has_minor_third:
            result["detected_scale"] = "major"
        elif has_minor_third and not has_major_third:
            result["detected_scale"] = "minor"
        else:
            # Ambiguous — check for blues/dominant patterns
            has_dom7 = pc_counts.get((root + 10) % 12, 0) > 0
            result["detected_scale"] = "dominant" if has_dom7 else "major"

    # Note density & timing analysis — include ALL notes (drums + melodic)
    all_melodic_notes = []
    all_drum_notes = []
    for inst in pm.instruments:
        if inst.is_drum:
            all_drum_notes.extend(inst.notes)
        else:
            all_melodic_notes.extend(inst.notes)

    all_notes = all_melodic_notes + all_drum_notes
    result["note_count"] = len(all_notes)

    # If only drum notes, mark key as percussion
    if all_drum_notes and not all_melodic_notes:
        result["detected_key"] = "percussion"

    if all_notes:
        # Duration in beats (approximate)
        if pm.time_signature_changes:
            beat_dur = 60.0 / max(result["tempo"], 1)
        else:
            beat_dur = 0.5

        total_beats = pm.get_end_time() / max(beat_dur, 0.001)
        bars = total_beats / max(result["time_sig_num"], 1)
        result["duration_bars"] = round(bars, 2)
        result["bar_length"] = max(1, round(bars))

        # Note density (notes per beat)
        density = len(all_notes) / max(total_beats, 1)
        result["note_density"] = round(density, 4)

        # Micro-timing deviation (average onset offset from quantized grid)
        if result["time_sig_den"] > 0:
            ticks_per_beat = pm.resolution
            deviations = []
            for note in all_notes[:1000]:  # sample first 1000
                # Ideal quantized position (nearest 16th note)
                beat_pos = note.start / beat_dur if beat_dur > 0 else 0
                sixteenth = beat_pos * 4
                nearest = round(sixteenth)
                dev = abs(sixteenth - nearest) / 4.0  # fraction of a beat
                deviations.append(dev)
            if deviations:
                result["micro_timing"] = round(sum(deviations) / len(deviations), 4)

    return result


# ── Database operations ──

def init_db(db_path: str):
    """Initialize the SQLite database and create schema."""
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()


def insert_clip(conn: sqlite3.Connection, clip: dict):
    """Insert or update a clip record."""
    conn.execute(
        """INSERT OR REPLACE INTO midi_clips
           (id, file_path, dataset, subdir, bar_length, note_density,
            detected_key, detected_scale, time_sig_num, time_sig_den,
            tempo, pitch_classes, micro_timing, note_count, duration_bars, file_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            clip["id"],
            clip["file_path"],
            clip["dataset"],
            clip.get("subdir", ""),
            clip["bar_length"],
            clip["note_density"],
            clip["detected_key"],
            clip["detected_scale"],
            clip["time_sig_num"],
            clip["time_sig_den"],
            clip["tempo"],
            clip["pitch_classes"],
            clip["micro_timing"],
            clip["note_count"],
            clip["duration_bars"],
            clip["file_size"],
        ),
    )


def scan_directory(dataset_dir: str, dataset_name: str, conn: sqlite3.Connection):
    """Recursively scan a dataset directory and ingest all .mid files."""
    base = Path(dataset_dir)
    if not base.exists():
        print(f"  [SKIP] Directory not found: {base}")
        return

    count = 0
    for mid_path in base.rglob("*.mid"):
        rel_path = mid_path.relative_to(base.parent)
        subdir = str(mid_path.relative_to(base).parent) if mid_path.parent != base else ""

        features = extract_features(str(mid_path))
        features["file_path"] = str(rel_path)
        features["dataset"] = dataset_name
        features["subdir"] = subdir

        insert_clip(conn, features)
        count += 1

        if count % 500 == 0:
            conn.commit()
            print(f"    ... {count} files ingested")

    conn.commit()
    print(f"  Finished: {count} files from {dataset_name}")


# ── CLI entry point ──

def main():
    parser = argparse.ArgumentParser(description="MIDI Dataset Ingest Scanner")
    parser.add_argument(
        "--dataset-dir",
        default="./datasets",
        help="Root directory containing e-gmd/ and tegridy/",
    )
    parser.add_argument(
        "--db",
        default="midi_library.db",
        help="SQLite database path (default: midi_library.db)",
    )
    args = parser.parse_args()

    db_path = args.db
    dataset_root = Path(args.dataset_dir)

    print(f"Initializing database: {db_path}")
    init_db(db_path)

    conn = sqlite3.connect(db_path)

    # Scan known datasets or all directories in dataset_root
    known_datasets = ["e-gmd", "tegridy", "downloads"]
    scanned_any = False

    for ds_name in known_datasets:
        ds_dir = dataset_root / ds_name
        if ds_dir.exists():
            print(f"\nScanning {ds_name}: {ds_dir}")
            scan_directory(str(ds_dir), ds_name, conn)
            scanned_any = True

    # Also scan any other dirs in dataset_root not already scanned
    if dataset_root.exists():
        for child in dataset_root.iterdir():
            if child.is_dir() and child.name not in known_datasets:
                print(f"\nScanning {child.name}: {child}")
                scan_directory(str(child), child.name, conn)
                scanned_any = True

    if not scanned_any:
        print(f"\n[WARN] No dataset directories found in {dataset_root}")
        print("Place .mid files in subdirectories like datasets/e-gmd/ or datasets/downloads/")

    conn.close()

    # Summary
    conn2 = sqlite3.connect(db_path)
    row = conn2.execute("SELECT COUNT(*) FROM midi_clips").fetchone()
    conn2.close()
    print(f"\nDone. Total clips in database: {row[0] if row else 0}")


if __name__ == "__main__":
    main()