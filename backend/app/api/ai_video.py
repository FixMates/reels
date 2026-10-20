from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.ai_video_service import get_job_status, start_video_job

router = APIRouter(prefix="/api/ai-video", tags=["AI video generation"])


class CreateAIVideoRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=500)
    title: Optional[str] = Field(default=None, max_length=120)
    audience: str = Field(default="curious general audience", max_length=200)
    language: str = Field(default="English", max_length=80)
    style: str = Field(default="clear, friendly, energetic educator", max_length=200)


@router.post("/create")
def create_ai_video(request: CreateAIVideoRequest):
    try:
        job_id = start_video_job(request.model_dump())
        return {"ok": True, "job_id": job_id, "status": "running"}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/status/{job_id}")
def ai_video_status(job_id: str):
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="AI video job not found. It may have expired after a server restart.")
    return status
