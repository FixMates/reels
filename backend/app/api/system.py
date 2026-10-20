import sys
import platform
from fastapi import APIRouter
from typing import Dict, Any

from ..services.ffmpeg_utils import check_ffmpeg_available
from ..services.tts_service import get_available_voices
from ..services.project_service import get_storage_stats, clear_temp_files

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/health")
def system_health() -> Dict[str, Any]:
    ffmpeg_info = check_ffmpeg_available()
    voices = get_available_voices()
    storage = get_storage_stats()
    
    return {
        "status": "healthy" if ffmpeg_info["ffmpeg_available"] and voices else "degraded",
        "ffmpeg": ffmpeg_info,
        "tts": {
            "voices_count": len(voices),
            "sapi_available": any(v.get("engine") == "sapi" for v in voices),
            "piper_available": any(v.get("engine") == "piper" for v in voices),
            "espeak_available": any(v.get("engine") == "espeak" for v in voices),
            "available_engines": sorted({v.get("engine") for v in voices if v.get("engine")}),
            "available": bool(voices),
            "voices": voices
        },
        "storage": storage,
        "platform": {
            "os": platform.system(),
            "os_release": platform.release(),
            "python_version": sys.version.split()[0]
        }
    }

@router.post("/clear-temp")
def trigger_clear_temp():
    freed = clear_temp_files()
    return {"ok": True, "bytes_freed": freed, "mb_freed": round(freed / (1024 * 1024), 2)}
