"""
FastAPI router for drum kit sample browsing and streaming.
Serves WAV files from a configurable local Drums directory.

Endpoints:
    GET  /api/drums              — List all available drum kits
    GET  /api/drums/config       — Get the current drums directory + status
    POST /api/drums/config       — Set the drums directory (validated + persisted)
    GET  /api/drums/{kit}        — List samples in a kit
    GET  /api/drums/{kit}/{sample} — Stream WAV audio
"""

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/drums", tags=["drums"])

# The directory is configurable at runtime (POST /api/drums/config) and
# persisted to this file so it survives restarts. Precedence on startup:
#   persisted config  >  DRUMS_ROOT env var  >  ./drums (portable default)
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "drums_config.json"
_DEFAULT_ROOT = os.environ.get("DRUMS_ROOT", "./drums")


def _load_root() -> str:
    """Read the persisted drums root, falling back to the default."""
    try:
        if _CONFIG_PATH.exists():
            data = json.loads(_CONFIG_PATH.read_text())
            root = data.get("root")
            if isinstance(root, str) and root:
                return root
    except (json.JSONDecodeError, OSError):
        pass
    return _DEFAULT_ROOT


def _save_root(root: str) -> None:
    """Persist the drums root so it survives restarts."""
    _CONFIG_PATH.write_text(json.dumps({"root": root}, indent=2))


# Current root, held in a module-level singleton so config changes take effect
# without a restart. Endpoints read it via get_drums_root().
_current_root: str = _load_root()


def get_drums_root() -> str:
    return _current_root


def _expand(root: str) -> Path:
    """Expand ~ and resolve to an absolute path."""
    return Path(os.path.expanduser(root))


class KitEntry(BaseModel):
    name: str
    sampleCount: int
    path: str


class SampleEntry(BaseModel):
    filename: str
    url: str
    size: int


class DrumsConfig(BaseModel):
    root: str


class DrumsConfigStatus(BaseModel):
    root: str
    exists: bool
    kitCount: int


def _resolve_within_root(root: Path, *parts: str) -> Path:
    """Resolve `root/*parts`, rejecting any path that escapes `root`.

    kit_name/sample_name come straight from the URL, so without this a
    request like `kit_name=..` could walk outside the drums root.
    """
    resolved_root = root.resolve()
    candidate = root.joinpath(*parts).resolve()
    if not candidate.is_relative_to(resolved_root):
        raise HTTPException(status_code=404, detail="Not found")
    return candidate


def _count_kits(root: Path) -> int:
    """Number of immediate subdirectories that contain at least one sample."""
    if not root.exists() or not root.is_dir():
        return 0
    count = 0
    for entry in root.iterdir():
        if entry.is_dir() and not entry.name.startswith('.'):
            if any(f.suffix.lower() in ('.wav', '.aiff', '.mp3') for f in entry.iterdir()):
                count += 1
    return count


# ── Endpoints ──

@router.get("", response_model=list[KitEntry])
def list_kits():
    """List all available drum kits (directories containing .wav files)."""
    root = _expand(get_drums_root())
    if not root.exists():
        raise HTTPException(status_code=404, detail=f"Drums directory not found: {root}")

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


# NOTE: /config must be declared BEFORE /{kit_name}, otherwise FastAPI would
# match "config" as a kit name.
@router.get("/config", response_model=DrumsConfigStatus)
def get_config():
    """Return the current drums directory and whether it exists / how many kits."""
    root = _expand(get_drums_root())
    return DrumsConfigStatus(
        root=get_drums_root(),
        exists=root.exists() and root.is_dir(),
        kitCount=_count_kits(root),
    )


@router.post("/config", response_model=DrumsConfigStatus)
def set_config(cfg: DrumsConfig):
    """Set + persist the drums directory. Rejects paths that don't exist."""
    global _current_root
    candidate = _expand(cfg.root)
    if not candidate.exists() or not candidate.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {cfg.root}")

    _current_root = cfg.root
    _save_root(cfg.root)
    return DrumsConfigStatus(
        root=cfg.root,
        exists=True,
        kitCount=_count_kits(candidate),
    )


@router.get("/{kit_name}", response_model=list[SampleEntry])
def list_samples(kit_name: str):
    """List all samples in a drum kit."""
    root = _expand(get_drums_root())
    kit_dir = _resolve_within_root(root, kit_name)

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
    root = _expand(get_drums_root())
    file_path = _resolve_within_root(root, kit_name, sample_name)

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
