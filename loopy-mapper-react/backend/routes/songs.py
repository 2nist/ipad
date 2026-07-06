"""
FastAPI router for Song Object import, export, and validation.
Integrates with schemas/song-object.schema.json for validation.
"""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/songs", tags=["songs"])

# Path to the JSON schema relative to this file
SCHEMA_PATH = Path(__file__).parent.parent.parent / "schemas" / "song-object.schema.json"

# Cache the schema
_schema_cache: Optional[dict] = None


def load_schema() -> dict:
    """Load the song object JSON schema (cached)."""
    global _schema_cache
    if _schema_cache is not None:
        return _schema_cache
    with open(SCHEMA_PATH) as f:
        _schema_cache = json.load(f)
    return _schema_cache


# ── Pydantic models ──

class ValidateRequest(BaseModel):
    song: dict


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = []
    schemaVersion: str


class ExportRequest(BaseModel):
    """Optional metadata to attach to the exported song object."""
    title: str = "Untitled Song"
    artist: str = ""
    bpm: float = 120.0
    key: str = "C"
    scale: str = "major"


# ── Endpoints ──

@router.get("/schema", response_model=dict)
def get_schema():
    """Return the Song Object JSON Schema for client-side validation."""
    schema = load_schema()
    return schema


@router.post("/validate", response_model=ValidateResponse)
def validate_song(body: ValidateRequest):
    """
    Validate a song object against the schema.
    Returns { valid: bool, errors: [...] }.
    """
    schema = load_schema()

    errors = []

    # Required top-level fields
    required_fields = schema.get("required", [])
    for field in required_fields:
        if field not in body.song:
            errors.append(f"Missing required field: {field}")

    # Check metadata required fields
    metadata_schema = body.song.get("metadata", {})
    meta_req = schema["$defs"]["SongMetadata"]["required"]
    for field in meta_req:
        if field not in metadata_schema:
            errors.append(f"metadata.{field} is required")

    # Check structure array
    structure = body.song.get("structure", [])
    if not isinstance(structure, list) or len(structure) == 0:
        errors.append("structure must be a non-empty array")

    # Check modules array
    modules = body.song.get("modules", [])
    if not isinstance(modules, list):
        errors.append("modules must be an array")

    # Check each section
    for i, section in enumerate(structure):
        section_req = schema["$defs"]["SongSection"]["required"]
        for field in section_req:
            if field not in section:
                errors.append(f"structure[{i}].{field} is required")

    # Check each module
    module_req = schema["$defs"]["ModuleCard"]["required"]
    for i, module in enumerate(modules):
        for field in module_req:
            if field not in module:
                errors.append(f"modules[{i}].{field} is required")

    return ValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
        schemaVersion=schema.get("schemaVersion", "1.0.0"),
    )


@router.post("/import", response_model=dict)
async def import_song(file: UploadFile = File(...)):
    """
    Import a Song Object from an uploaded .songobject.json file.
    Validates and returns the parsed song.
    """
    if not file.filename or not file.filename.endswith((".json", ".songobject.json")):
        raise HTTPException(
            status_code=400,
            detail="File must be a .json or .songobject.json file",
        )

    try:
        content = await file.read()
        song = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    # Validate
    validation = validate_song(ValidateRequest(song=song))
    if not validation.valid:
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid song object", "errors": validation.errors},
        )

    return {
        "status": "ok",
        "message": f"Imported '{song.get('metadata', {}).get('title', 'Untitled')}' successfully",
        "song": song,
        "warnings": validation.errors if validation.errors else [],
    }


@router.post("/export", response_model=dict)
def export_song_template(body: ExportRequest):
    """
    Generate a minimal valid Song Object template with the given metadata.
    Useful for AI agents to get a starting scaffold.
    """
    schema = load_schema()

    template = {
        "schemaVersion": schema.get("schemaVersion", "1.0.0"),
        "metadata": {
            "title": body.title,
            "artist": body.artist,
            "bpm": body.bpm,
            "key": body.key,
            "scale": body.scale,
            "timeSignature": {"numerator": 4, "denominator": 4},
            "genre": "",
            "tags": [],
            "duration": 0,
            "difficulty": 3,
        },
        "structure": [],
        "modules": [],
        "midiBindings": [],
        "provenance": {
            "sourceName": "Loopy Mapper Template",
            "generatedBy": "loopy-mapper-api",
            "generatedAt": "",
        },
    }

    return {
        "status": "ok",
        "template": template,
        "schemaUrl": "/api/songs/schema",
    }