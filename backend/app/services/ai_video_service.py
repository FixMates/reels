"""Background Gemini-to-video generation pipeline."""
import base64
import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image, ImageOps

from ..config import GEMINI_API_KEY, GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL, PROJECTS_DIR
from . import project_service
from .image_service import process_uploaded_image
from .tts_service import generate_speech
from .video_renderer import get_job_status as get_render_status, start_render_job

_JOBS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()

_SCHEMA = {
    "type": "object",
    "properties": {
        "video_title": {"type": "string"},
        "video_description": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "sources": {"type": "array", "items": {"type": "object", "properties": {
            "title": {"type": "string"}, "url": {"type": "string"}
        }, "required": ["title", "url"], "additionalProperties": False}},
        "scenes": {"type": "array", "minItems": 7, "maxItems": 7, "items": {
            "type": "object", "properties": {
                "headline": {"type": "string"}, "supporting_caption": {"type": "string"},
                "narration": {"type": "string"}, "visual_prompt": {"type": "string"}
            }, "required": ["headline", "supporting_caption", "narration", "visual_prompt"],
            "additionalProperties": False
        }}
    },
    "required": ["video_title", "video_description", "hashtags", "sources", "scenes"],
    "additionalProperties": False
}


def _update(job_id: str, progress: int, stage: str, message: str, **fields):
    with _LOCK:
        if job_id in _JOBS:
            _JOBS[job_id].update({"progress_pct": progress, "stage": stage, "message": message, **fields})


def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None


def _client():
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured. Set GEMINI_API_KEY in the server environment and restart the app.")
    try:
        from google import genai
    except ImportError as exc:
        raise RuntimeError("The Gemini SDK is missing. Install backend requirements and restart the app.") from exc
    return genai.Client(api_key=GEMINI_API_KEY)


def _generate_script(client, topic: str, audience: str, language: str, style: str) -> Dict[str, Any]:
    prompt = f"""Create a polished, factual Instagram Reel script about: {topic}
Audience: {audience}. Language: {language}. Tone: {style}.
Return exactly seven sequential scenes for a 45-60 second educational Reel.
Make scene 1 a strong hook and scene 7 a useful takeaway/CTA. Each headline must be 2-6 words; each supporting_caption must be a distinct, concise sentence or phrase (maximum 12 words), not a duplicate of its headline; each narration should sound natural aloud and be 20-35 words. Keep one clear idea per scene and connect the story across scenes.
Use Google Search grounding to check factual claims when available. Do not invent statistics, citations, or URLs. Only include sources actually used. If a claim is uncertain, qualify it rather than presenting it as fact.
Visual prompts must describe one photorealistic, premium editorial image relevant to that scene. Request a full-bleed vertical 9:16 composition, no text, lettering, watermark, logos, UI, frame, or empty bands. Compose the key subject centrally with breathing room near the top and bottom for app captions. Keep visual style consistent across all seven scenes."""
    config = {"response_format": {"type": "text", "mime_type": "application/json", "schema": _SCHEMA},
              "tools": [{"type": "google_search"}]}
    try:
        result = client.interactions.create(model=GEMINI_TEXT_MODEL, input=prompt, **config)
    except Exception:
        # Some model/account combinations may not yet allow Search with structured output.
        config.pop("tools", None)
        result = client.interactions.create(model=GEMINI_TEXT_MODEL, input=prompt, **config)
    text = getattr(result, "output_text", None)
    if not text:
        raise RuntimeError("Gemini returned no script text.")
    content = json.loads(text)
    if len(content.get("scenes", [])) != 7:
        raise RuntimeError("Gemini did not return the requested seven scenes. Please try again.")
    return content


def _generate_image(client, prompt: str, output_path: Path):
    result = client.interactions.create(
        model=GEMINI_IMAGE_MODEL,
        input=("Create a single premium educational Reel background image. "
               "Full-bleed portrait 9:16. NO text, typography, logos, watermarks, frames, "
               "collages, or blank bars. Place the main subject in the central safe area. " + prompt),
        response_format={"type": "image", "aspect_ratio": "9:16", "image_size": "1K"}
    )
    image_output = getattr(result, "output_image", None)
    image_data = getattr(image_output, "data", None) if image_output else None
    if not image_data:
        raise RuntimeError("Gemini did not return image data.")
    raw = base64.b64decode(image_data)
    with Image.open(__import__("io").BytesIO(raw)) as source:
        portrait = ImageOps.fit(source.convert("RGB"), (1080, 1920), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        portrait.save(output_path, "JPEG", quality=94, optimize=True)


def _make_layer(layer_id: str, kind: str, text: str, y: float, size: int, color: str, bg: str, opacity: float):
    return {"id": layer_id, "type": kind, "text": text, "x": 0.5, "y": y, "width": 0.88,
            "font_family": "Arial", "font_size": size, "font_weight": "bold", "text_color": color,
            "text_opacity": 1, "bg_color": bg, "bg_opacity": opacity, "bg_padding": 16,
            "border_radius": 18, "stroke_color": "#38bdf8", "stroke_width": 0,
            "text_align": "center", "rotation": 0, "visible": True, "locked": False, "z_index": 4}


def _worker(job_id: str, request: Dict[str, str]):
    project_id = None
    try:
        client = _client()
        _update(job_id, 3, "script", "Researching the topic and writing seven scenes...")
        package = _generate_script(client, request["topic"], request["audience"], request["language"], request["style"])
        title = (request.get("title") or package["video_title"]).strip()[:120]
        project = project_service.create_project({"title": title, "aspect_ratio": "9:16", "width": 1080, "height": 1920,
                                                  "fps": 30, "voice_engine": "sapi", "voice_rate": 165,
                                                  "default_scene_duration": 7.0, "end_padding_seconds": 0.45})
        project_id = project["id"]
        # Leave a separate safe band between timed narration and the supporting footer.
        project_service.update_project(project_id, {"subtitle_style": {"x": 0.5, "y": 0.66, "font_size": 38}})
        project_dir = PROJECTS_DIR / project_id
        img_dir = project_dir / "images"
        img_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "ai_package.json").write_text(json.dumps(package, ensure_ascii=False, indent=2), encoding="utf-8")

        scene_rows = []
        for index, scene in enumerate(package["scenes"], start=1):
            progress = 8 + int((index - 1) * 48 / 7)
            _update(job_id, progress, "images", f"Generating portrait image {index} of 7...")
            raw_path = img_dir / f"gemini_{index:02d}.jpg"
            _generate_image(client, scene["visual_prompt"], raw_path)
            processed = process_uploaded_image(raw_path, img_dir, prefix=f"scene_{index:02d}")
            scene_rows.append({
                "item_type": "image", "source_filename": f"Gemini generated scene {index}",
                "original_image_path": processed["image_path"], "thumbnail_path": processed["thumbnail_path"],
                "fit_mode": "fill", "headline": scene["headline"], "caption": scene["supporting_caption"],
                "narration_script": scene["narration"], "scene_duration": 7.0, "is_included": True,
                "layers": [
                    _make_layer(f"ai_head_{index}", "headline", scene["headline"], 0.12, 42, "#FFFFFF", "#071020", 0.82),
                    _make_layer(f"ai_support_{index}", "label", scene["supporting_caption"], 0.83, 30, "#FFFFFF", "#050A16", 0.82)
                ]
            })
        scenes = project_service.add_scenes_to_project(project_id, scene_rows)

        current = project_service.get_project(project_id)
        audio_dir = project_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        for index, scene in enumerate(scenes, start=1):
            _update(job_id, 58 + int((index - 1) * 18 / len(scenes)), "narration", f"Creating narration {index} of {len(scenes)}...")
            audio_path = audio_dir / f"scene_{scene['id'][:8]}.wav"
            audio = generate_speech(scene["narration_script"], audio_path, engine=current["voice_engine"],
                                    voice_id=current.get("voice_id"), rate=current.get("voice_rate", 165),
                                    volume=current.get("voice_volume", 100), use_cache=True)
            project_service.update_scene(scene["id"], {"audio_path": str(audio_path),
                "measured_audio_duration": audio["duration"],
                "scene_duration": round(audio["duration"] + current.get("end_padding_seconds", 0.45), 3)})

        _update(job_id, 77, "rendering", "Rendering the finished Reel...")
        render_id = start_render_job(project_id, {"burn_subtitles": True, "export_srt": True, "export_vtt": True,
                                                   "quality_preset": "veryfast", "crf": 21})
        while True:
            render = get_render_status(render_id)
            if not render:
                raise RuntimeError("The renderer stopped before returning a status.")
            if render.get("status") == "completed":
                _update(job_id, 100, "completed", "Your Reel is ready.", status="completed", project_id=project_id,
                        output_filename=render.get("output_filename"), download_url=render.get("download_url"),
                        video_duration=render.get("video_duration"), video_title=title, content_package=package)
                return
            if render.get("status") in ("failed", "cancelled"):
                raise RuntimeError(render.get("error") or render.get("message") or "The render failed.")
            pct = 77 + int((render.get("progress_pct", 0) or 0) * 0.22)
            _update(job_id, pct, "rendering", render.get("message") or "Rendering video...")
            time.sleep(2)
    except Exception as exc:
        _update(job_id, 100, "failed", str(exc), status="failed", error=str(exc), project_id=project_id)


def start_video_job(request: Dict[str, str]) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured. Set GEMINI_API_KEY in the server environment and restart the app.")
    job_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _JOBS[job_id] = {"job_id": job_id, "status": "running", "progress_pct": 0, "stage": "queued",
                         "message": "Starting the video workflow...", "created_at": time.time(),
                         "project_id": None, "output_filename": None, "download_url": None, "error": None}
    threading.Thread(target=_worker, args=(job_id, request), daemon=True).start()
    return job_id
