import os
import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse

from ..services.pdf_service import process_pdf
from ..services.image_service import process_uploaded_image
from ..services.ffmpeg_utils import get_audio_duration
from ..services import project_service

router = APIRouter(prefix="/api/media", tags=["media"])

from ..config import STORAGE_DIR, PROJECTS_DIR, BGM_DIR, ROOT_DIR

@router.post("/upload-pdf")
async def upload_pdf(
    project_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")
        
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    p_media_dir = PROJECTS_DIR / project_id / "pdf_pages"
    p_media_dir.mkdir(parents=True, exist_ok=True)
    
    src_pdf_path = PROJECTS_DIR / project_id / f"source_{uuid.uuid4().hex[:6]}.pdf"
    content = await file.read()
    if len(content) > 150 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF exceeds 150 MB limit.")
    src_pdf_path.write_bytes(content)
    
    try:
        pages = process_pdf(src_pdf_path, p_media_dir)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse PDF: {str(e)}")
        
    scene_items = []
    for page in pages:
        # Default headline and caption
        scene_items.append({
            "item_type": "pdf_page",
            "source_filename": file.filename,
            "original_image_path": str(page["image_path"]),
            "thumbnail_path": str(page["thumbnail_path"]),
            "page_number": page["page_number"],
            "headline": f"Page {page['page_number']}",
            "caption": "",
            "narration_script": page.get("suggested_text") or f"This is page {page['page_number']}.",
            "scene_duration": p.get("default_scene_duration", 3.5),
            "is_included": True
        })
        
    updated_scenes = project_service.add_scenes_to_project(project_id, scene_items)
    return {"ok": True, "scenes": updated_scenes, "pages_imported": len(pages)}

@router.post("/upload-images")
async def upload_images(
    project_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    allowed_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
    p_img_dir = PROJECTS_DIR / project_id / "images"
    p_img_dir.mkdir(parents=True, exist_ok=True)
    
    scene_items = []
    for idx, f in enumerate(files):
        ext = Path(f.filename).suffix.lower()
        if ext not in allowed_exts:
            continue
            
        temp_id = uuid.uuid4().hex[:8]
        temp_src = p_img_dir / f"raw_{temp_id}{ext}"
        content = await f.read()
        temp_src.write_bytes(content)
        
        try:
            processed = process_uploaded_image(temp_src, p_img_dir, prefix=f"img_{temp_id}")
            scene_items.append({
                "item_type": "image",
                "source_filename": f.filename,
                "original_image_path": processed["image_path"],
                "thumbnail_path": processed["thumbnail_path"],
                "headline": "",
                "caption": "",
                "narration_script": "",
                "scene_duration": p.get("default_scene_duration", 3.5),
                "is_included": True
            })
        except Exception as e:
            print(f"Error processing image {f.filename}: {e}")
            continue
            
    if not scene_items:
        raise HTTPException(status_code=400, detail="No valid images could be imported.")
        
    updated_scenes = project_service.add_scenes_to_project(project_id, scene_items)
    return {"ok": True, "scenes": updated_scenes, "images_imported": len(scene_items)}

@router.post("/upload-logo")
async def upload_logo(
    project_id: str = Form(...),
    file: UploadFile = File(...)
):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    p_dir = PROJECTS_DIR / project_id
    p_dir.mkdir(parents=True, exist_ok=True)
    
    ext = Path(file.filename).suffix.lower() or ".png"
    logo_path = p_dir / f"logo{ext}"
    content = await file.read()
    logo_path.write_bytes(content)
    
    branding = p.get("branding", {})
    branding["logo_path"] = str(logo_path)
    
    project_service.update_project(project_id, {"branding": branding})
    return {"ok": True, "logo_url": f"/api/media/file?path={logo_path}"}

@router.post("/upload-bgm")
async def upload_bgm(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in (".mp3", ".wav", ".aac", ".m4a", ".ogg"):
        raise HTTPException(status_code=400, detail="Audio file must be MP3, WAV, AAC, M4A, or OGG.")
        
    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
    target = BGM_DIR / safe_name
    content = await file.read()
    target.write_bytes(content)
    
    try:
        dur = get_audio_duration(target)
    except Exception:
        dur = 0.0
        
    return {
        "ok": True,
        "filename": safe_name,
        "duration": dur,
        "download_url": f"/api/media/file?path={target}"
    }

@router.get("/bgm-list")
def list_bgm():
    tracks = []
    if BGM_DIR.exists():
        for f in BGM_DIR.iterdir():
            if f.is_file() and f.suffix.lower() in (".mp3", ".wav", ".m4a", ".aac"):
                try:
                    dur = get_audio_duration(f)
                except Exception:
                    dur = 0.0
                tracks.append({
                    "filename": f.name,
                    "duration": dur,
                    "url": f"/api/media/file?path={f}"
                })
    return tracks

@router.post("/upload-audio-override")
async def upload_audio_override(
    scene_id: str = Form(...),
    file: UploadFile = File(...)
):
    conn = project_service.get_connection()
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Scene not found.")
        
    s = dict(row)
    p_id = s["project_id"]
    p_audio_dir = PROJECTS_DIR / p_id / "audio"
    p_audio_dir.mkdir(parents=True, exist_ok=True)
    
    ext = Path(file.filename).suffix.lower() or ".wav"
    out_audio = p_audio_dir / f"override_{scene_id[:8]}{ext}"
    content = await file.read()
    out_audio.write_bytes(content)
    
    dur = get_audio_duration(out_audio)
    
    updated = project_service.update_scene(scene_id, {
        "audio_path": str(out_audio),
        "measured_audio_duration": dur,
        "scene_duration": dur + 0.7
    })
    return {"ok": True, "scene": updated}

@router.get("/file")
def get_media_file(path: str = Query(...)):
    p = Path(path)
    if not p.is_absolute():
        p = ROOT_DIR / path
        
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="Media file not found.")
        
    suffix = p.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".mp4": "video/mp4",
        ".srt": "text/plain",
        ".vtt": "text/vtt"
    }
    media_type = media_types.get(suffix, "application/octet-stream")
    return FileResponse(p, media_type=media_type)
