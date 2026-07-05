"""
FastAPI backend for Loopy Mapper React.
Provides MIDI clip search, streaming, and Loopy project generation.

Run with:
    uvicorn backend.main:app --reload --port 8766
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import clips as clips_router

app = FastAPI(
    title="Loopy Mapper API",
    version="1.0.0",
    description="MIDI dataset search, streaming, and Loopy Pro project generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clips_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "loopy-mapper-api"}