"""
FastAPI router for drum kit sample browsing and streaming.
Serves WAV files from the local Drums directory.

Endpoints:
    GET /api/drums           — List all available drum kits
    GET /api/drums/{kit}     — List samples in a kit
    GET /api/drums/{kit}/{sample} — Stream WAV audio
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

router = APIRouter(prefix="/api/drums", tags=["drums"])

# Allow override via env var for deployment
DRUMS_ROOT = os.environ.get("DRUMS_ROOT", "/Users/Matthew/Drums")


class KitEntry(BaseModel):
    name: str
    sampleCount: int
    path: str


class SampleEntry(BaseModel):
    filename: str
    url: str
    size: int


# ── Endpoints ──

@router.get("", response_model=list[KitEntry])
def list_kits():
    """List all available drum kits (directories containing .wav files)."""
    root = Path(DRUMS_ROOT)
    if not root.exists():
        raise HTTPException(status_code=404, detail=f"Drums directory not found: {DRUMS_ROOT}")

    kits = []
    for entry in sorted(root.iterdir()):
        if entry.is_dir() and not entry.name.startswith('.'):
            # Count .wav files (excluding .asd Ableton analysis files)
            wavs = [f for f in entry.iterdir() if f.suffix.lower() in ('.wav', '.aiff', '.mp3')]
            if wavs:
                kits.append(KitEntry(
                    name=entry.name,
                    sampleCount=len(wavs),
                    path=str(entry),
                ))

    return kits


@router.get("/{kit_name}", response_model=list[SampleEntry])
def list_samples(kit_name: str):
    """List all samples in a drum kit."""
    root = Path(DRUMS_ROOT)
    kit_dir = root / kit_name

    if not kit_dir.exists() or not kit_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Kit not found: {kit_name}")

    samples = []
    for f in sorted(kit_dir.iterdir()):
        if f.suffix.lower() in ('.wav', '.aiff', '.mp3'):
            samples.append(SampleEntry(
                filename=f.name,
                url=f"/api/drums/{kit_name}/{f.name}",
                size=f.stat().st_size,
            ))

    return samples


@router.get("/{kit_name}/{sample_name}")
def stream_sample(kit_name: str, sample_name: str):
    """Stream a drum sample as WAV audio."""
    root = Path(DRUMS_ROOT)
    file_path = root / kit_name / sample_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample not found")

    # Determine content type
    ext = file_path.suffix.lower()
    media_type = {
        '.wav': 'audio/wav',
        '.aiff': 'audio/aiff',
        '.aif': 'audio/aiff',
        '.mp3': 'audio/mpeg',
    }.get(ext, 'audio/wav')

    return FileResponse(
        str(file_path),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{file_path.name}"',
            "Content-Length": str(file_path.stat().st_size),
            "Cache-Control": "public, max-age=86400",
        },
    )