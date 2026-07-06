"""
FastAPI router for MIDI clip queries and streaming.

Endpoints:
    GET  /api/clips         — Filtered clip search
    GET  /api/clips/<id>    — Single clip metadata
    GET  /api/clips/<id>/stream — Raw MIDI binary for browser playback
"""

import os
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(prefix="/api/clips", tags=["clips"])

# Allow override via env var for deployment
DB_PATH = os.environ.get("MIDI_LIBRARY_DB", "midi_library.db")
DATASET_ROOT = os.environ.get("MIDI_DATASET_ROOT", "./datasets")


def get_db():
    """Dependency: yields a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ── Pydantic models ──

class ClipMetadata(BaseModel):
    id: str
    file_path: str
    dataset: str
    subdir: str = ""
    bar_length: int
    note_density: float
    detected_key: str
    detected_scale: str
    time_sig_num: int = 4
    time_sig_den: int = 4
    tempo: float = 120.0
    pitch_classes: str = ""
    micro_timing: float = 0.0
    note_count: int = 0
    duration_bars: float = 0.0
    file_size: int = 0


class ClipSearchParams(BaseModel):
    key: str = Query("", description="Root key filter (C, D#, F, ...)")
    scale: str = Query("", description="Scale filter (major, minor, dominant)")
    min_density: float = Query(0.0, ge=0.0, description="Minimum note density")
    max_density: float = Query(10.0, ge=0.0, description="Maximum note density")
    dataset: str = Query("", description="Dataset filter (e-gmd, tegridy)")
    min_bars: int = Query(0, ge=0)
    max_bars: int = Query(256, ge=1)
    limit: int = Query(50, ge=1, le=500)
    offset: int = Query(0, ge=0)


# ── Endpoints ──

@router.get("", response_model=dict)
def get_filtered_clips(
    params: ClipSearchParams = Depends(),
    conn: sqlite3.Connection = Depends(get_db),
):
    """
    Search the MIDI library by key, scale, density, and dataset.
    Returns a paginated result set.
    """
    conditions = []
    query_params = []

    if params.key:
        conditions.append("detected_key = ?")
        query_params.append(params.key.upper())
    if params.scale:
        conditions.append("detected_scale = ?")
        query_params.append(params.scale.lower())
    if params.dataset:
        conditions.append("dataset = ?")
        query_params.append(params.dataset.lower())
    if params.min_density > 0:
        conditions.append("note_density >= ?")
        query_params.append(params.min_density)
    if params.max_density < 10:
        conditions.append("note_density <= ?")
        query_params.append(params.max_density)
    if params.min_bars > 0:
        conditions.append("bar_length >= ?")
        query_params.append(params.min_bars)
    if params.max_bars < 256:
        conditions.append("bar_length <= ?")
        query_params.append(params.max_bars)

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # Count total matching
    count_query = f"SELECT COUNT(*) FROM midi_clips WHERE {where_clause}"
    total = conn.execute(count_query, query_params).fetchone()[0]

    # Fetch page
    data_query = f"""
        SELECT id, file_path, dataset, subdir, bar_length, note_density,
               detected_key, detected_scale, time_sig_num, time_sig_den,
               tempo, pitch_classes, micro_timing, note_count, duration_bars, file_size
        FROM midi_clips
        WHERE {where_clause}
        ORDER BY note_density DESC
        LIMIT ? OFFSET ?
    """
    rows = conn.execute(data_query, query_params + [params.limit, params.offset]).fetchall()

    clips = [
        ClipMetadata(
            id=r["id"], file_path=r["file_path"], dataset=r["dataset"],
            subdir=r["subdir"], bar_length=r["bar_length"],
            note_density=r["note_density"], detected_key=r["detected_key"],
            detected_scale=r["detected_scale"], time_sig_num=r["time_sig_num"],
            time_sig_den=r["time_sig_den"], tempo=r["tempo"],
            pitch_classes=r["pitch_classes"], micro_timing=r["micro_timing"],
            note_count=r["note_count"], duration_bars=r["duration_bars"],
            file_size=r["file_size"],
        )
        for r in rows
    ]

    return {
        "total": total,
        "limit": params.limit,
        "offset": params.offset,
        "clips": [c.model_dump() for c in clips],
    }


@router.get("/{clip_id}", response_model=ClipMetadata)
def get_clip(clip_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Get metadata for a single clip by ID."""
    row = conn.execute(
        "SELECT * FROM midi_clips WHERE id = ?", (clip_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clip not found")
    return ClipMetadata(**dict(row))


@router.get("/{clip_id}/stream")
def stream_clip(clip_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Stream the raw MIDI binary for browser playback."""
    row = conn.execute(
        "SELECT file_path, dataset FROM midi_clips WHERE id = ?", (clip_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Clip not found")

    # Resolve full path
    file_path = Path(DATASET_ROOT) / row["dataset"] / row["file_path"]
    if not file_path.exists():
        # Try alternative: maybe the path is absolute or relative differently
        file_path = Path(DATASET_ROOT) / row["file_path"]
        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"MIDI file not found on disk: {file_path}",
            )

    midi_bytes = file_path.read_bytes()
    return Response(
        content=midi_bytes,
        media_type="audio/midi",
        headers={
            "Content-Disposition": f'inline; filename="{file_path.name}"',
            "Content-Length": str(len(midi_bytes)),
        },
    )