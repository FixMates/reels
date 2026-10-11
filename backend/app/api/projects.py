from fastapi import APIRouter, HTTPException, Path, Body
from typing import List, Dict, Any
from ..models.project import ProjectCreate, ProjectUpdate, SceneUpdate
from ..services import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("", response_model=Dict[str, Any])
def create_project(data: ProjectCreate):
    return project_service.create_project(data.model_dump())

@router.get("", response_model=List[Dict[str, Any]])
def list_projects():
    return project_service.list_projects()

@router.get("/{project_id}", response_model=Dict[str, Any])
def get_project(project_id: str):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

@router.patch("/{project_id}", response_model=Dict[str, Any])
def update_project(project_id: str, updates: ProjectUpdate):
    data = {k: v for k, v in updates.model_dump(exclude_unset=True).items()}
    p = project_service.update_project(project_id, data)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p

@router.post("/{project_id}/duplicate", response_model=Dict[str, Any])
def duplicate_project(project_id: str):
    p = project_service.duplicate_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found to duplicate")
    return p

@router.delete("/{project_id}")
def delete_project(project_id: str):
    success = project_service.delete_project(project_id)
    return {"ok": success}

@router.post("/{project_id}/reorder-scenes")
def reorder_scenes(project_id: str, scene_ids: List[str] = Body(..., embed=True)):
    project_service.reorder_scenes(project_id, scene_ids)
    return {"ok": True}

# Scene endpoints
scene_router = APIRouter(prefix="/api/scenes", tags=["scenes"])

@scene_router.patch("/{scene_id}", response_model=Dict[str, Any])
def update_scene(scene_id: str, updates: SceneUpdate):
    data = {k: v for k, v in updates.model_dump(exclude_unset=True).items()}
    if "crop" in data and data["crop"]:
        data["crop"] = data["crop"]  # dict
    s = project_service.update_scene(scene_id, data)
    if not s:
        raise HTTPException(status_code=404, detail="Scene not found")
    return s

@scene_router.post("/{scene_id}/duplicate", response_model=Dict[str, Any])
def duplicate_scene(scene_id: str):
    s = project_service.duplicate_scene(scene_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scene not found to duplicate")
    return s

@scene_router.delete("/{scene_id}")
def delete_scene(scene_id: str):
    success = project_service.delete_scene(scene_id)
    return {"ok": success}
