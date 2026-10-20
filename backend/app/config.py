import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

STORAGE_DIR = BACKEND_DIR / "storage"
PROJECTS_DIR = STORAGE_DIR / "projects"
OUTPUT_DIR = STORAGE_DIR / "exports"
WORK_DIR = STORAGE_DIR / "work"
BGM_DIR = STORAGE_DIR / "bgm"
CACHE_DIR = STORAGE_DIR / "tts_cache"
PIPER_DIR = STORAGE_DIR / "piper_models"
FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-3.8-flash").strip()
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-nano-banana-2.1").strip()

# Ensure all primary storage directories exist
for d in (STORAGE_DIR, PROJECTS_DIR, OUTPUT_DIR, WORK_DIR, BGM_DIR, CACHE_DIR, PIPER_DIR):
    d.mkdir(parents=True, exist_ok=True)
