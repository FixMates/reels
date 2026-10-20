import os
import sys
import uuid
import time
import shutil
import threading
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

from ..database import get_connection
from ..config import STORAGE_DIR, OUTPUT_DIR, WORK_DIR, ROOT_DIR
from .ffmpeg_utils import get_ffmpeg_path, get_ffprobe_path, probe_media_file
from .image_service import compose_slide
from .tts_service import generate_speech
from .subtitle_service import (
    generate_scene_subtitles,
    export_subtitles_srt,
    export_subtitles_vtt,
    export_subtitles_ass
)
from .timeline_service import compute_timeline
from .audio_mixer import create_padded_audio_clip, mix_master_audio

# Thread-safe in-memory registry for live background jobs
_JOBS: Dict[str, Dict[str, Any]] = {}
_JOBS_LOCK = threading.Lock()

def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None

def update_job_status(job_id: str, progress: int, stage: str, message: str, **kwargs):
    with _JOBS_LOCK:
        if job_id in _JOBS:
            _JOBS[job_id]["progress_pct"] = progress
            _JOBS[job_id]["stage"] = stage
            _JOBS[job_id]["message"] = message
            for k, v in kwargs.items():
                _JOBS[job_id][k] = v

def cancel_job(job_id: str):
    with _JOBS_LOCK:
        if job_id in _JOBS:
            _JOBS[job_id]["status"] = "cancelled"
            _JOBS[job_id]["message"] = "Render cancelled by user."

def render_worker(job_id: str, project_id: str, options: Dict[str, Any]):
    job_dir = WORK_DIR / f"render_{job_id}"
    job_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        update_job_status(job_id, 5, "preparing", "Loading project data and assets...")
        
        # 1. Fetch project and scenes from DB
        conn = get_connection()
        proj_row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj_row:
            raise RuntimeError(f"Project not found: {project_id}")
            
        scene_rows = conn.execute(
            "SELECT * FROM scenes WHERE project_id = ? AND is_included = 1 ORDER BY scene_order ASC",
            (project_id,)
        ).fetchall()
        conn.close()
        
        if not scene_rows:
            raise RuntimeError("No scenes selected for rendering.")
            
        project = dict(proj_row)
        scenes = [dict(s) for s in scene_rows]
        
        import json
        branding = json.loads(project.get("branding_json") or "{}")
        subtitle_style = json.loads(project.get("subtitle_style_json") or "{}")
        audio_settings = json.loads(project.get("audio_settings_json") or "{}")
        
        width = int(project.get("width", 1080))
        height = int(project.get("height", 1920))
        fps = int(project.get("fps", 30))
        end_padding = float(project.get("end_padding_seconds", 0.7))
        default_dur = float(project.get("default_scene_duration", 3.5))
        
        # 2. Check & Generate Voiceovers
        update_job_status(job_id, 15, "voiceover", "Generating and validating voice narration...")
        
        for idx, scene in enumerate(scenes):
            with _JOBS_LOCK:
                if _JOBS.get(job_id, {}).get("status") == "cancelled":
                    return

            narration = (scene.get("narration_script") or "").strip()
            audio_path = scene.get("audio_path")
            
            # If audio doesn't exist or narration was updated, generate it
            if not audio_path or not Path(audio_path).exists():
                scene_audio = job_dir / f"scene_{idx:03d}_voice.wav"
                engine = scene.get("voice_override") or project.get("voice_engine", "sapi")
                voice_id = project.get("voice_id")
                rate = int(project.get("voice_rate", 175))
                vol = int(project.get("voice_volume", 100))
                
                tts_res = generate_speech(
                    text=narration,
                    output_path=scene_audio,
                    engine=engine,
                    voice_id=voice_id,
                    rate=rate,
                    volume=vol
                )
                scene["audio_path"] = str(scene_audio)
                scene["measured_audio_duration"] = tts_res["duration"]
                
        # 3. Compute Timeline & Timestamps
        update_job_status(job_id, 30, "timeline", "Computing audio synchronization and subtitles...")
        timeline = compute_timeline(
            scenes=scenes,
            end_padding_seconds=end_padding,
            default_scene_duration=default_dur,
            subtitle_style=subtitle_style
        )
        timed_scenes = timeline["scenes"]
        total_duration = timeline["total_duration"]
        all_subtitles = timeline["subtitles"]
        
        # 4. Compose Slides
        burn_subs = options.get("burn_subtitles", True) and bool(all_subtitles) and subtitle_style.get("burn_in", True)
        update_job_status(job_id, 45, "composition", "Composing visual slides and branding...")
        slide_paths = []
        
        for idx, s in enumerate(timed_scenes):
            with _JOBS_LOCK:
                if _JOBS.get(job_id, {}).get("status") == "cancelled":
                    return

            slide_out = job_dir / f"slide_{idx:03d}.png"
            crop_dict = json.loads(s.get("crop_json")) if s.get("crop_json") else None
            layers_list = json.loads(s.get("layers_json")) if s.get("layers_json") else None
            
            # If scene has a caption/subtitle layer, synchronize subtitle_style coordinates
            if layers_list:
                for lyr in layers_list:
                    if lyr.get("type") in ("caption", "subtitle") and lyr.get("visible", True):
                        subtitle_style["x"] = lyr.get("x", subtitle_style.get("x", 0.5))
                        subtitle_style["y"] = lyr.get("y", subtitle_style.get("y", 0.72))
                        break
            
            # Resolve original image path
            orig_img_p = Path(s["original_image_path"])
            if not orig_img_p.is_absolute():
                orig_img_p = ROOT_DIR / s["original_image_path"]
                
            compose_slide(
                image_path=orig_img_p,
                output_path=slide_out,
                width=width,
                height=height,
                crop=crop_dict,
                rotation=int(s.get("rotation", 0)),
                flip_h=bool(s.get("flip_h", False)),
                fit_mode=s.get("fit_mode", "fit"),
                headline=s.get("headline", "") or project.get("default_top_text", ""),
                caption=s.get("caption", "") or project.get("default_bottom_text", ""),
                branding=branding,
                logo_path=branding.get("logo_path"),
                layers=layers_list,
                skip_caption_layers=burn_subs
            )
            slide_paths.append(str(slide_out))

        # 5. Export Subtitle Files
        srt_file = job_dir / "subtitles.srt"
        vtt_file = job_dir / "subtitles.vtt"
        ass_file = job_dir / "subtitles.ass"
        
        export_subtitles_srt(all_subtitles, srt_file)
        export_subtitles_vtt(all_subtitles, vtt_file)
        export_subtitles_ass(all_subtitles, ass_file, width=width, height=height, style_config=subtitle_style)

        # 6. Render individual video clips with exact durations
        update_job_status(job_id, 60, "video_encoding", "Encoding video scenes...")
        ffmpeg = get_ffmpeg_path()
        clip_paths = []
        padded_audio_paths = []
        
        for idx, s in enumerate(timed_scenes):
            with _JOBS_LOCK:
                if _JOBS.get(job_id, {}).get("status") == "cancelled":
                    return

            clip_dur = s["duration"]
            slide_img = slide_paths[idx]
            
            # Create padded audio matching clip_dur
            pad_audio = job_dir / f"audio_padded_{idx:03d}.wav"
            create_padded_audio_clip(s.get("audio_path"), clip_dur, pad_audio)
            padded_audio_paths.append(str(pad_audio))
            
            clip_out = job_dir / f"clip_{idx:03d}.mp4"
            
            # Ken Burns effect option
            vf_filters = [f"scale={width}:{height}", "format=yuv420p"]
            if project.get("ken_burns_enabled"):
                total_frames = int(clip_dur * fps)
                vf_filters.insert(0, f"zoompan=z='min(zoom+0.0006,1.06)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}")
                
            vf_str = ",".join(vf_filters)
            
            cmd_clip = [
                ffmpeg, "-y", "-loglevel", "error",
                "-loop", "1", "-framerate", str(fps),
                "-i", str(slide_img),
                "-t", f"{clip_dur:.3f}",
                "-vf", vf_str,
                "-r", str(fps),
                "-c:v", "libx264", "-preset", options.get("quality_preset", "veryfast"),
                "-crf", str(options.get("crf", 21)),
                str(clip_out)
            ]
            subprocess.run(cmd_clip, check=True)
            clip_paths.append(clip_out)

        # 7. Concatenate Video Clips
        update_job_status(job_id, 75, "concatenation", "Assembling video scenes...")
        clip_list_file = job_dir / "clips_list.txt"
        clip_list_content = "".join(f"file '{p.as_posix().replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'\n" for p in clip_paths)
        clip_list_file.write_text(clip_list_content, encoding="utf-8")
        
        unmuxed_video = job_dir / "video_raw.mp4"
        cmd_concat_v = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0",
            "-i", str(clip_list_file),
            "-c:v", "copy",
            str(unmuxed_video)
        ]
        subprocess.run(cmd_concat_v, check=True)

        # 8. Mix Master Audio
        update_job_status(job_id, 82, "audio_mixing", "Mixing narration, background music, and audio ducking...")
        master_audio = job_dir / "master_audio.m4a"
        
        bgm_path = audio_settings.get("bgm_filename")
        if bgm_path:
            bgm_full_p = STORAGE_DIR / "bgm" / bgm_path
            if not bgm_full_p.exists():
                bgm_full_p = None
        else:
            bgm_full_p = None
            
        mix_master_audio(
            scene_audio_files=padded_audio_paths,
            total_duration=total_duration,
            output_path=master_audio,
            bgm_path=bgm_full_p,
            narration_vol=float(audio_settings.get("narration_volume", 1.0)),
            bgm_vol=float(audio_settings.get("bgm_volume", 0.25)),
            enable_ducking=bool(audio_settings.get("enable_ducking", True)),
            ducking_db=float(audio_settings.get("ducking_db", -14.0)),
            fade_duration=float(audio_settings.get("fade_duration", 1.0)),
            ducking_attack_ms=float(audio_settings.get("ducking_attack_ms", 80.0)),
            ducking_release_ms=float(audio_settings.get("ducking_release_ms", 350.0)),
            target_lufs=float(audio_settings.get("target_lufs", -16.0)) if audio_settings.get("target_lufs") is not None else -16.0,
            enable_limiter=bool(audio_settings.get("enable_limiter", True))
        )

        # 9. Final Mux & Subtitle Burn-In
        update_job_status(job_id, 90, "subtitles_mux", "Applying subtitles and finalizing MP4 container...")
        final_filename = f"reel_{project_id[:8]}_{int(time.time())}.mp4"
        final_output_path = OUTPUT_DIR / final_filename
        local_final_path = job_dir / final_filename
        
        burn_subs = options.get("burn_subtitles", True) and bool(all_subtitles) and subtitle_style.get("burn_in", True)
        
        if burn_subs and ass_file.exists():
            # Burn subtitles into video stream
            # Notice FFmpeg escape for Windows colon in path: C:/... -> C\:/...
            escaped_ass = ass_file.as_posix().replace(":", r"\:")
            cmd_final = [
                ffmpeg, "-y", "-loglevel", "error",
                "-i", str(unmuxed_video),
                "-i", str(master_audio),
                "-vf", f"ass='{escaped_ass}'",
                "-c:v", "libx264", "-preset", options.get("quality_preset", "veryfast"),
                "-crf", str(options.get("crf", 21)),
                "-c:a", "aac", "-b:a", "192k",
                "-shortest", "-movflags", "+faststart",
                str(local_final_path)
            ]
        else:
            # Direct stream mux
            cmd_final = [
                ffmpeg, "-y", "-loglevel", "error",
                "-i", str(unmuxed_video),
                "-i", str(master_audio),
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest", "-movflags", "+faststart",
                str(local_final_path)
            ]
            
        subprocess.run(cmd_final, check=True)

        # 10. Validate Final MP4 using FFprobe
        update_job_status(job_id, 98, "validation", "Validating video streams and integrity...")
        if not local_final_path.exists() or local_final_path.stat().st_size < 1000:
            raise RuntimeError("Render failed: final MP4 is missing or corrupted.")
            
        probe_data = probe_media_file(local_final_path)
        streams = probe_data.get("streams", [])
        has_video = any(s.get("codec_type") == "video" for s in streams)
        has_audio = any(s.get("codec_type") == "audio" for s in streams)
        
        if not has_video:
            raise RuntimeError("Validation error: rendered file does not contain a video stream.")

        # Encode locally for FFmpeg random-access writes, then copy the finished
        # artifact into the configured persistent media store (for example GCS).
        update_job_status(job_id, 99, "saving", "Saving the finished video to project storage...")
        shutil.copy2(local_final_path, final_output_path)
        output_size = final_output_path.stat().st_size

        # Save to SQLite export history
        conn = get_connection()
        conn.execute(
            """INSERT INTO exports (id, project_id, filename, file_path, duration_seconds, resolution, created_at, file_size_bytes, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                job_id,
                project_id,
                final_filename,
                str(final_output_path),
                total_duration,
                f"{width}x{height}",
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                output_size,
                "success"
            )
        )
        conn.commit()
        conn.close()

        # Copy SRT and VTT alongside video in exports
        if srt_file.exists():
            shutil.copy2(srt_file, OUTPUT_DIR / f"{final_output_path.stem}.srt")
        if vtt_file.exists():
            shutil.copy2(vtt_file, OUTPUT_DIR / f"{final_output_path.stem}.vtt")

        update_job_status(
            job_id, 100, "completed", "Video rendered successfully!",
            status="completed",
            output_filename=final_filename,
            download_url=f"/api/exports/download/{final_filename}",
            video_duration=total_duration,
            file_size_bytes=output_size
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        update_job_status(
            job_id, 100, "failed", f"Render failed: {str(e)}",
            status="failed",
            error=str(e)
        )
        # Log failure to exports table
        try:
            conn = get_connection()
            conn.execute(
                """INSERT INTO exports (id, project_id, filename, file_path, created_at, status, error_message)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    job_id,
                    project_id,
                    "failed",
                    "",
                    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "failed",
                    str(e)
                )
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

def start_render_job(project_id: str, options: Dict[str, Any]) -> str:
    job_id = uuid.uuid4().hex[:10]
    with _JOBS_LOCK:
        _JOBS[job_id] = {
            "job_id": job_id,
            "project_id": project_id,
            "status": "rendering",
            "progress_pct": 0,
            "stage": "starting",
            "message": "Initializing render pipeline...",
            "created_at": time.time(),
            "output_filename": None,
            "download_url": None,
            "video_duration": 0.0,
            "error": None
        }
        
    thread = threading.Thread(target=render_worker, args=(job_id, project_id, options), daemon=True)
    thread.start()
    return job_id
