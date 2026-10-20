import os
import uuid
import time
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..database import get_connection
from ..config import STORAGE_DIR, PROJECTS_DIR, ROOT_DIR
from .timeline_service import compute_timeline

DEFAULT_SUBTITLE_STYLE: Dict[str, Any] = {
    "burn_in": True,
    "font_family": "Arial",
    "font_size": 44,
    "text_color": "#FFFFFF",
    "highlight_color": "#FACC15",
    "inactive_color": "#FFFFFF",
    "bg_color": "#000000",
    "bg_opacity": 0.65,
    "position": "bottom",
    "position_y": "bottom",
    "x": 0.5,
    # Keep burned-in dialogue above the platform's lower caption/handle area.
    "y": 0.72,
    "max_chars_per_line": 34,
    "safe_margin_pct": 12.0,
    "mode": "word_highlight",
    "highlight_style": "word_color",
    "outline_color": "#000000",
    "outline_width": 2
}

DEFAULT_BRANDING: Dict[str, Any] = {
    "logo_path": None,
    "logo_position": "top_center",
    "brand_name": "",
    "handle": "",
    "accent_color": "#38bdf8",
    "font_family": "Arial",
    "show_border": True,
    "watermark_opacity": 0.85
}

DEFAULT_AUDIO_SETTINGS: Dict[str, Any] = {
    "bgm_filename": None,
    "bgm_volume": 0.25,
    "narration_volume": 1.0,
    "enable_ducking": True,
    "ducking_db": -14.0,
    "duck_attack_ms": 80.0,
    "duck_release_ms": 350.0,
    "fade_duration": 1.0,
    "music_fade_in": 0.5,
    "music_fade_out": 1.5,
    "target_lufs": -16.0,
    "enable_limiter": True,
    "audio_bitrate": "192k"
}

def project_row_to_dict(row, scenes=None) -> Dict[str, Any]:
    d = dict(row)
    stored_branding = json.loads(d.get("branding_json") or "{}")
    stored_subtitles = json.loads(d.get("subtitle_style_json") or "{}")
    stored_audio = json.loads(d.get("audio_settings_json") or "{}")
    
    d["branding"] = {**DEFAULT_BRANDING, **stored_branding}
    d["subtitle_style"] = {**DEFAULT_SUBTITLE_STYLE, **stored_subtitles}
    d["audio_settings"] = {**DEFAULT_AUDIO_SETTINGS, **stored_audio}
    d["pronunciation_dict"] = json.loads(d.get("pronunciation_dict_json") or "{}")
    d["scenes"] = scenes or []
    d["total_scenes"] = len(scenes) if scenes else 0
    d["total_duration"] = sum(s.get("scene_duration", 3.5) for s in d["scenes"] if s.get("is_included", True))
    return d

def scene_row_to_dict(row) -> Dict[str, Any]:
    s = dict(row)
    s["crop"] = json.loads(s.get("crop_json")) if s.get("crop_json") else None
    s["is_included"] = bool(s.get("is_included", 1))
    s["flip_h"] = bool(s.get("flip_h", 0))
    s["image_url"] = f"/api/media/file?path={s['original_image_path']}"
    s["thumbnail_url"] = f"/api/media/file?path={s['thumbnail_path']}" if s.get("thumbnail_path") else s["image_url"]
    s["audio_url"] = f"/api/media/file?path={s['audio_path']}" if s.get("audio_path") else None
    
    # Layers deserialization with safe fallback synthesis
    raw_layers = json.loads(s.get("layers_json") or "[]")
    if not raw_layers:
        synthesized = []
        if s.get("headline", "").strip():
            synthesized.append({
                "id": f"head_{s['id'][:6]}",
                "type": "headline",
                "text": s["headline"].strip(),
                "x": 0.5,
                "y": 0.12,
                "w": 0.88,
                "align": "center",
                "font_family": "Arial",
                "font_size": 38,
                "font_weight": "bold",
                "color": "#FFFFFF",
                "bg_color": "#071020",
                "bg_opacity": 0.85,
                "bg_padding": 16,
                "bg_radius": 18,
                "outline_color": "#38bdf8",
                "outline_width": 2,
                "z_index": 2,
                "is_visible": True,
                "is_locked": False
            })
        if s.get("caption", "").strip():
            synthesized.append({
                "id": f"cap_{s['id'][:6]}",
                "type": "caption",
                "text": s["caption"].strip(),
                "x": 0.5,
                "y": 0.78,
                "w": 0.88,
                "align": "center",
                "font_family": "Arial",
                "font_size": 32,
                "font_weight": "bold",
                "color": "#F1F5F9",
                "bg_color": "#050A16",
                "bg_opacity": 0.85,
                "bg_padding": 14,
                "bg_radius": 16,
                "outline_color": "#475569",
                "outline_width": 1,
                "z_index": 2,
                "is_visible": True,
                "is_locked": False
            })
        s["layers"] = synthesized
    else:
        s["layers"] = raw_layers
        
    s["custom_segments"] = json.loads(s.get("custom_segments_json") or "[]")
    return s

def create_project(data: Dict[str, Any]) -> Dict[str, Any]:
    pid = uuid.uuid4().hex[:12]
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    voice_engine = data.get("voice_engine", "sapi")
    if voice_engine == "sapi" and os.name != "nt":
        voice_engine = "espeak"
    
    p_dir = PROJECTS_DIR / pid
    p_dir.mkdir(parents=True, exist_ok=True)
    
    conn = get_connection()
    conn.execute(
        """INSERT INTO projects (
            id, title, created_at, updated_at, aspect_ratio, width, height, fps,
            voice_engine, voice_id, voice_rate, voice_volume, default_top_text, default_bottom_text,
            default_scene_duration, end_padding_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            pid,
            data.get("title", "Untitled Video Project"),
            now,
            now,
            data.get("aspect_ratio", "9:16"),
            int(data.get("width", 1080)),
            int(data.get("height", 1920)),
            int(data.get("fps", 30)),
            voice_engine,
            data.get("voice_id", ""),
            int(data.get("voice_rate", 175)),
            int(data.get("voice_volume", 100)),
            data.get("default_top_text", ""),
            data.get("default_bottom_text", ""),
            float(data.get("default_scene_duration", 3.5)),
            float(data.get("end_padding_seconds", 0.7))
        )
    )
    conn.commit()
    conn.close()
    return get_project(pid)

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    p_row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not p_row:
        conn.close()
        return None
        
    s_rows = conn.execute(
        "SELECT * FROM scenes WHERE project_id = ? ORDER BY scene_order ASC",
        (project_id,)
    ).fetchall()
    conn.close()
    
    scenes = [scene_row_to_dict(s) for s in s_rows]
    return project_row_to_dict(p_row, scenes)

def list_projects() -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
    result = []
    for r in rows:
        scene_count = conn.execute("SELECT COUNT(*) FROM scenes WHERE project_id = ?", (r["id"],)).fetchone()[0]
        p = project_row_to_dict(r)
        p["total_scenes"] = scene_count
        result.append(p)
    conn.close()
    return result


def update_project(project_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    fields = []
    values = []
    
    for k, v in updates.items():
        if k in ("branding", "subtitle_style", "audio_settings"):
            if v is not None and isinstance(v, dict):
                curr_row = conn.execute(f"SELECT {k}_json FROM projects WHERE id = ?", (project_id,)).fetchone()
                existing = json.loads(curr_row[0] or "{}") if curr_row and curr_row[0] else {}
                defaults = DEFAULT_SUBTITLE_STYLE if k == "subtitle_style" else (DEFAULT_BRANDING if k == "branding" else DEFAULT_AUDIO_SETTINGS)
                merged = {**defaults, **existing, **v}
                fields.append(f"{k}_json = ?")
                values.append(json.dumps(merged))
            else:
                fields.append(f"{k}_json = ?")
                values.append(json.dumps(v))
        elif k in (
            "title", "aspect_ratio", "width", "height", "fps", "default_top_text",
            "default_bottom_text", "end_padding_seconds", "default_scene_duration",
            "voice_engine", "voice_id", "voice_rate", "voice_volume", "read_mode",
            "transition_type", "transition_duration", "ken_burns_enabled", "progress_bar_enabled"
        ):
            fields.append(f"{k} = ?")
            values.append(v)
        elif k == "pronunciation_dict":
            fields.append("pronunciation_dict_json = ?")
            values.append(json.dumps(v if v is not None else {}))
            
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    fields.append("updated_at = ?")
    values.append(now)
    values.append(project_id)
    
    if fields:
        sql = f"UPDATE projects SET {', '.join(fields)} WHERE id = ?"
        conn.execute(sql, values)
        conn.commit()
    conn.close()
    return get_project(project_id)

def duplicate_project(project_id: str) -> Optional[Dict[str, Any]]:
    original = get_project(project_id)
    if not original:
        return None
        
    new_pid = uuid.uuid4().hex[:12]
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    # Copy project media directory
    orig_dir = PROJECTS_DIR / project_id
    new_dir = PROJECTS_DIR / new_pid
    if orig_dir.exists():
        shutil.copytree(orig_dir, new_dir)
    else:
        new_dir.mkdir(parents=True, exist_ok=True)
        
    conn = get_connection()
    conn.execute(
        """INSERT INTO projects (
            id, title, created_at, updated_at, aspect_ratio, width, height, fps,
            default_top_text, default_bottom_text, end_padding_seconds, default_scene_duration,
            voice_engine, voice_id, voice_rate, voice_volume, read_mode,
            branding_json, subtitle_style_json, audio_settings_json, pronunciation_dict_json,
            transition_type, transition_duration, ken_burns_enabled, progress_bar_enabled
        ) SELECT
            ?, title || ' (Copy)', ?, ?, aspect_ratio, width, height, fps,
            default_top_text, default_bottom_text, end_padding_seconds, default_scene_duration,
            voice_engine, voice_id, voice_rate, voice_volume, read_mode,
            branding_json, subtitle_style_json, audio_settings_json, pronunciation_dict_json,
            transition_type, transition_duration, ken_burns_enabled, progress_bar_enabled
        FROM projects WHERE id = ?""",
        (new_pid, now, now, project_id)
    )
    
    # Copy scenes
    scenes = original.get("scenes", [])
    for s in scenes:
        new_sid = uuid.uuid4().hex[:12]
        # Rewrite relative paths from old project_id to new_pid
        old_img = s.get("original_image_path", "")
        new_img = old_img.replace(project_id, new_pid)
        old_thumb = s.get("thumbnail_path", "")
        new_thumb = old_thumb.replace(project_id, new_pid)
        old_aud = s.get("audio_path", "")
        new_aud = old_aud.replace(project_id, new_pid) if old_aud else None
        
        conn.execute(
            """INSERT INTO scenes (
                id, project_id, scene_order, item_type, source_filename,
                original_image_path, thumbnail_path, page_number, crop_json,
                rotation, flip_h, fit_mode, headline, caption, narration_script,
                voice_override, audio_path, measured_audio_duration, scene_duration,
                is_included, transition_override, layers_json, custom_segments_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                new_sid, new_pid, s["scene_order"], s["item_type"], s["source_filename"],
                new_img, new_thumb, s.get("page_number"),
                json.dumps(s.get("crop")) if s.get("crop") else None,
                s.get("rotation", 0), 1 if s.get("flip_h") else 0,
                s.get("fit_mode", "fit"), s.get("headline", ""), s.get("caption", ""),
                s.get("narration_script", ""), s.get("voice_override"),
                new_aud, s.get("measured_audio_duration", 0.0),
                s.get("scene_duration", 3.5), 1 if s.get("is_included", True) else 0,
                s.get("transition_override"),
                json.dumps(s.get("layers")) if s.get("layers") else None,
                json.dumps(s.get("custom_segments")) if s.get("custom_segments") else None
            )
        )
    conn.commit()
    conn.close()
    return get_project(new_pid)

def delete_project(project_id: str) -> bool:
    conn = get_connection()
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    
    p_dir = PROJECTS_DIR / project_id
    if p_dir.exists():
        shutil.rmtree(p_dir, ignore_errors=True)
    return True

def add_scenes_to_project(project_id: str, scene_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    conn = get_connection()
    # Find current max scene_order
    res = conn.execute("SELECT MAX(scene_order) FROM scenes WHERE project_id = ?", (project_id,)).fetchone()
    current_order = (res[0] + 1) if (res and res[0] is not None) else 0
    
    added_ids = []
    for item in scene_items:
        sid = uuid.uuid4().hex[:12]
        crop_json = json.dumps(item.get("crop")) if item.get("crop") else None
        layers_json = json.dumps(item.get("layers")) if item.get("layers") else None
        custom_segments_json = json.dumps(item.get("custom_segments")) if item.get("custom_segments") else None
        conn.execute(
            """INSERT INTO scenes (
                id, project_id, scene_order, item_type, source_filename,
                original_image_path, thumbnail_path, page_number, crop_json,
                rotation, flip_h, fit_mode, headline, caption, narration_script,
                voice_override, audio_path, measured_audio_duration, scene_duration,
                is_included, transition_override, layers_json, custom_segments_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                sid,
                project_id,
                current_order,
                item.get("item_type", "image"),
                item.get("source_filename", ""),
                item.get("original_image_path", ""),
                item.get("thumbnail_path", ""),
                item.get("page_number"),
                crop_json,
                int(item.get("rotation", 0)),
                1 if item.get("flip_h") else 0,
                item.get("fit_mode", "fit"),
                item.get("headline", ""),
                item.get("caption", ""),
                item.get("narration_script", ""),
                item.get("voice_override"),
                item.get("audio_path"),
                float(item.get("measured_audio_duration", 0.0)),
                float(item.get("scene_duration", 3.5)),
                1 if item.get("is_included", True) else 0,
                item.get("transition_override"),
                layers_json,
                custom_segments_json
            )
        )
        current_order += 1
        added_ids.append(sid)
        
    conn.commit()
    conn.close()
    return get_project(project_id)["scenes"]

def update_scene(scene_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    fields = []
    values = []
    
    for k, v in updates.items():
        if k == "crop":
            fields.append("crop_json = ?")
            values.append(json.dumps(v) if v else None)
        elif k == "layers":
            fields.append("layers_json = ?")
            values.append(json.dumps(v) if v is not None else None)
        elif k == "custom_segments":
            fields.append("custom_segments_json = ?")
            values.append(json.dumps(v) if v is not None else None)
        elif k in ("flip_h", "is_included"):
            fields.append(f"{k} = ?")
            values.append(1 if v else 0)
        elif k in (
            "scene_order", "rotation", "fit_mode", "headline", "caption",
            "narration_script", "voice_override", "audio_path",
            "measured_audio_duration", "scene_duration", "transition_override"
        ):
            fields.append(f"{k} = ?")
            values.append(v)
            
    values.append(scene_id)
    if fields:
        sql = f"UPDATE scenes SET {', '.join(fields)} WHERE id = ?"
        conn.execute(sql, values)
        conn.commit()
        
    row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    conn.close()
    return scene_row_to_dict(row) if row else None

def reorder_scenes(project_id: str, scene_ids: List[str]) -> bool:
    conn = get_connection()
    for idx, sid in enumerate(scene_ids):
        conn.execute("UPDATE scenes SET scene_order = ? WHERE id = ? AND project_id = ?", (idx, sid, project_id))
    conn.commit()
    conn.close()
    return True

def delete_scene(scene_id: str) -> bool:
    conn = get_connection()
    conn.execute("DELETE FROM scenes WHERE id = ?", (scene_id,))
    conn.commit()
    conn.close()
    return True

def duplicate_scene(scene_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    s_row = conn.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,)).fetchone()
    if not s_row:
        conn.close()
        return None
    s = dict(s_row)
    new_sid = uuid.uuid4().hex[:12]
    new_order = s["scene_order"] + 1
    
    # Increment scene_order for following scenes
    conn.execute("UPDATE scenes SET scene_order = scene_order + 1 WHERE project_id = ? AND scene_order >= ?", (s["project_id"], new_order))
    
    conn.execute(
        """INSERT INTO scenes (
            id, project_id, scene_order, item_type, source_filename,
            original_image_path, thumbnail_path, page_number, crop_json,
            rotation, flip_h, fit_mode, headline, caption, narration_script,
            voice_override, audio_path, measured_audio_duration, scene_duration,
            is_included, transition_override, layers_json, custom_segments_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            new_sid, s["project_id"], new_order, s["item_type"], s["source_filename"],
            s["original_image_path"], s["thumbnail_path"], s["page_number"],
            s["crop_json"], s["rotation"], s["flip_h"], s["fit_mode"],
            s["headline"], s["caption"], s["narration_script"],
            s["voice_override"], s["audio_path"], s["measured_audio_duration"],
            s["scene_duration"], s["is_included"], s["transition_override"],
            s.get("layers_json"), s.get("custom_segments_json")
        )
    )
    conn.commit()
    new_row = conn.execute("SELECT * FROM scenes WHERE id = ?", (new_sid,)).fetchone()
    conn.close()
    return scene_row_to_dict(new_row)
    conn.commit()
    new_row = conn.execute("SELECT * FROM scenes WHERE id = ?", (new_sid,)).fetchone()
    conn.close()
    return scene_row_to_dict(new_row)

def list_exports() -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT e.*, p.title as project_title FROM exports e
           LEFT JOIN projects p ON e.project_id = p.id
           ORDER BY e.created_at DESC LIMIT 50"""
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["download_url"] = f"/api/exports/download/{d['filename']}" if d.get("status") == "success" else None
        result.append(d)
    return result

def get_storage_stats() -> Dict[str, Any]:
    def get_dir_size(path: Path) -> int:
        if not path.exists():
            return 0
        total = 0
        for p in path.rglob("*"):
            if p.is_file():
                try:
                    total += p.stat().st_size
                except Exception:
                    pass
        return total

    conn = get_connection()
    p_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    s_count = conn.execute("SELECT COUNT(*) FROM scenes").fetchone()[0]
    e_count = conn.execute("SELECT COUNT(*) FROM exports WHERE status = 'success'").fetchone()[0]
    conn.close()

    total_storage = get_dir_size(STORAGE_DIR)
    work_storage = get_dir_size(STORAGE_DIR / "work")
    cache_storage = get_dir_size(STORAGE_DIR / "tts_cache")
    exports_storage = get_dir_size(STORAGE_DIR / "exports")

    return {
        "projects_count": p_count,
        "scenes_count": s_count,
        "exports_count": e_count,
        "total_storage_bytes": total_storage,
        "temp_storage_bytes": work_storage,
        "cache_storage_bytes": cache_storage,
        "exports_storage_bytes": exports_storage
    }

def clear_temp_files() -> int:
    work_dir = STORAGE_DIR / "work"
    bytes_freed = 0
    if work_dir.exists():
        for item in work_dir.iterdir():
            try:
                if item.is_file():
                    bytes_freed += item.stat().st_size
                    item.unlink()
                elif item.is_dir():
                    for sub in item.rglob("*"):
                        if sub.is_file():
                            bytes_freed += sub.stat().st_size
                    shutil.rmtree(item, ignore_errors=True)
            except Exception:
                pass
    return bytes_freed
