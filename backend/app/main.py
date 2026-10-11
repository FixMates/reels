import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .services.ffmpeg_utils import init_ffmpeg_paths
from .api import projects, media, tts, render, system

from .config import FRONTEND_DIST_DIR
STATIC_FRONTEND_DIR = FRONTEND_DIST_DIR

app = FastAPI(
    title="AI Content-to-Video Studio API",
    description="Full-stack desktop-grade engine converting PDFs and images into professional short-form videos with local TTS and synchronized captions.",
    version="2.0.0"
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    init_ffmpeg_paths()

# Register API Routers
app.include_router(projects.router)
app.include_router(projects.scene_router)
app.include_router(media.router)
app.include_router(tts.router)
app.include_router(render.router)
app.include_router(system.router)

# Mount frontend static files if built
if STATIC_FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_FRONTEND_DIR), html=True), name="frontend")
