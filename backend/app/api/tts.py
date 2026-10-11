import uuid
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

from ..services.tts_service import get_available_voices, generate_speech
from ..services import project_service

router = APIRouter(prefix="/api/tts", tags=["tts"])

from ..config import PROJECTS_DIR, WORK_DIR
TEMP_DIR = WORK_DIR / "preview_tts"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

class TTSPreviewRequest(BaseModel):
    text: str
    engine: str = "sapi"
    voice_id: Optional[str] = None
    rate: int = 175
    volume: int = 100

class SceneTTSRequest(BaseModel):
    scene_id: str
    voice_id: Optional[str] = None
    rate: Optional[int] = None
    volume: Optional[int] = None

@router.get("/voices")
def list_voices():
    return get_available_voices()

@router.post("/preview")
def preview_voice(req: TTSPreviewRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    preview_id = uuid.uuid4().hex[:8]
    out_audio = TEMP_DIR / f"preview_{preview_id}.wav"
    
    try:
        res = generate_speech(
            text=req.text,
            output_path=out_audio,
            engine=req.engine,
            voice_id=req.voice_id,
            rate=req.rate,
            volume=req.volume,
            use_cache=True
        )
        return {
            "ok": True,
            "duration": res["duration"],
            "audio_url": f"/api/media/file?path={out_audio}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

@router.post("/generate-scene")
def generate_scene_voice(req: SceneTTSRequest):
    conn = project_service.get_connection()
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (req.scene_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Scene not found.")
        
    s = dict(row)
    p_row = conn.execute("SELECT * FROM projects WHERE id = ?", (s["project_id"],)).fetchone()
    conn.close()
    
    if not p_row:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    p = dict(p_row)
    narration = (s.get("narration_script") or "").strip()
    if not narration:
        raise HTTPException(status_code=400, detail="Cannot generate voice for empty narration.")
        
    project_id = s["project_id"]
    audio_dir = PROJECTS_DIR / project_id / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    out_audio = audio_dir / f"scene_{req.scene_id[:8]}.wav"
    
    engine = s.get("voice_override") or p.get("voice_engine", "sapi")
    voice_id = req.voice_id or p.get("voice_id")
    rate = req.rate or int(p.get("voice_rate", 175))
    volume = req.volume or int(p.get("voice_volume", 100))
    end_padding = float(p.get("end_padding_seconds", 0.7))
    
    try:
        res = generate_speech(
            text=narration,
            output_path=out_audio,
            engine=engine,
            voice_id=voice_id,
            rate=rate,
            volume=volume,
            use_cache=True
        )
        dur = res["duration"]
        new_scene_dur = round(dur + end_padding, 3)
        
        updated_scene = project_service.update_scene(req.scene_id, {
            "audio_path": str(out_audio),
            "measured_audio_duration": dur,
            "scene_duration": new_scene_dur
        })
        
        return {
            "ok": True,
            "scene": updated_scene,
            "audio_url": f"/api/media/file?path={out_audio}",
            "duration": dur
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@router.post("/generate-all/{project_id}")
def generate_all_voices(project_id: str):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    scenes = p.get("scenes", [])
    updated_scenes = []
    
    audio_dir = PROJECTS_DIR / project_id / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    engine = p.get("voice_engine", "sapi")
    voice_id = p.get("voice_id")
    rate = int(p.get("voice_rate", 175))
    volume = int(p.get("voice_volume", 100))
    end_padding = float(p.get("end_padding_seconds", 0.7))
    
    for s in scenes:
        narration = (s.get("narration_script") or "").strip()
        if not narration or not s.get("is_included", True):
            continue
            
        out_audio = audio_dir / f"scene_{s['id'][:8]}.wav"
        try:
            res = generate_speech(
                text=narration,
                output_path=out_audio,
                engine=engine,
                voice_id=voice_id,
                rate=rate,
                volume=volume,
                use_cache=True
            )
            dur = res["duration"]
            new_dur = round(dur + end_padding, 3)
            
            up = project_service.update_scene(s["id"], {
                "audio_path": str(out_audio),
                "measured_audio_duration": dur,
                "scene_duration": new_dur
            })
            updated_scenes.append(up)
        except Exception as e:
            print(f"Error generating voice for scene {s['id']}: {e}")
            
    return {"ok": True, "generated_count": len(updated_scenes)}
