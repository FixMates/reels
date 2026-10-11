from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Path as FPath
from fastapi.responses import FileResponse

from ..models.project import RenderJobRequest
from ..services.video_renderer import start_render_job, get_job_status, cancel_job
from ..services import project_service

router = APIRouter(prefix="/api", tags=["render"])

from ..config import OUTPUT_DIR

@router.post("/render/{project_id}")
def trigger_render(project_id: str, req: RenderJobRequest = RenderJobRequest()):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    scenes = [s for s in p.get("scenes", []) if s.get("is_included", True)]
    if not scenes:
        raise HTTPException(status_code=400, detail="Cannot render a project with no included scenes.")
        
    job_id = start_render_job(project_id, req.model_dump())
    return {
        "ok": True,
        "job_id": job_id,
        "status": "rendering",
        "message": "Render job launched in background."
    }

@router.get("/render/status/{job_id}")
def check_render_status(job_id: str):
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Render job not found.")
    return status

@router.post("/render/cancel/{job_id}")
def abort_render(job_id: str):
    cancel_job(job_id)
    return {"ok": True, "message": "Cancellation requested."}

@router.get("/exports")
def get_exports():
    return project_service.list_exports()

@router.get("/exports/download/{filename}")
def download_export(filename: str):
    # Secure filename
    safe_name = Path(filename).name
    target = OUTPUT_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Export file not found.")
        
    suffix = target.suffix.lower()
    media_type = "video/mp4" if suffix == ".mp4" else "text/plain"
    return FileResponse(target, media_type=media_type, filename=safe_name)

@router.get("/exports/preview/{filename}")
def preview_export(filename: str):
    safe_name = Path(filename).name
    target = OUTPUT_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Export file not found.")
    return FileResponse(target, media_type="video/mp4")
