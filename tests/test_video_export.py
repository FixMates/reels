import os
import sys
import time
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.project_service import create_project, add_scenes_to_project, get_project
from backend.app.services.video_renderer import start_render_job, get_job_status
from backend.app.services.ffmpeg_utils import probe_media_file

def test_full_video_export_pipeline():
    # 1. Create a project
    p = create_project({
        "title": "E2E Automated Reel Test",
        "aspect_ratio": "9:16",
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "default_scene_duration": 3.0,
        "end_padding_seconds": 0.6
    })
    project_id = p["id"]
    
    # 2. Generate 2 distinct test images
    img_dir = Path(__file__).resolve().parent.parent / "backend" / "storage" / "projects" / project_id / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    
    img1_p = img_dir / "test_1.png"
    img2_p = img_dir / "test_2.png"
    
    im1 = Image.new("RGB", (720, 720), (14, 165, 233))
    d1 = ImageDraw.Draw(im1)
    d1.text((50, 300), "Slide 1 Content", fill=(255, 255, 255))
    im1.save(img1_p)
    
    im2 = Image.new("RGB", (720, 720), (168, 85, 247))
    d2 = ImageDraw.Draw(im2)
    d2.text((50, 300), "Slide 2 Content", fill=(255, 255, 255))
    im2.save(img2_p)
    
    scenes_data = [
        {
            "item_type": "image",
            "source_filename": "test_1.png",
            "original_image_path": str(img1_p),
            "thumbnail_path": str(img1_p),
            "headline": "First Automated Hook",
            "caption": "Step 1: Check market structure",
            "narration_script": "First step is to always check the market structure before entering.",
            "crop": {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0},
            "fit_mode": "blur_bg"
        },
        {
            "item_type": "image",
            "source_filename": "test_2.png",
            "original_image_path": str(img2_p),
            "thumbnail_path": str(img2_p),
            "headline": "Second Key Rule",
            "caption": "Step 2: Execute with precision",
            "narration_script": "Second step is to execute cleanly once structure is confirmed.",
            "crop": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8},
            "fit_mode": "card"
        }
    ]
    
    add_scenes_to_project(project_id, scenes_data)
    
    # 3. Start render job
    print("Launching video render job...")
    job_id = start_render_job(project_id, {
        "burn_subtitles": True,
        "quality_preset": "ultrafast",
        "crf": 26
    })
    
    # 4. Poll until completed or timeout (60 seconds)
    start_wait = time.time()
    final_status = None
    while time.time() - start_wait < 60:
        st = get_job_status(job_id)
        if st and st["status"] in ("completed", "failed", "cancelled"):
            final_status = st
            break
        time.sleep(1)
        print(f"Render progress: {st.get('progress_pct', 0)}% - {st.get('stage', '')} - {st.get('message', '')}")
        
    assert final_status is not None, "Render job timed out"
    assert final_status["status"] == "completed", f"Render failed: {final_status.get('error')}"
    
    output_filename = final_status["output_filename"]
    exports_dir = Path(__file__).resolve().parent.parent / "backend" / "storage" / "exports"
    out_mp4 = exports_dir / output_filename
    
    assert out_mp4.exists(), f"Rendered MP4 file does not exist: {out_mp4}"
    assert out_mp4.stat().st_size > 50000, f"Rendered MP4 too small: {out_mp4.stat().st_size} bytes"
    
    # 5. FFprobe validation
    probe = probe_media_file(out_mp4)
    streams = probe.get("streams", [])
    v_stream = next((s for s in streams if s["codec_type"] == "video"), None)
    a_stream = next((s for s in streams if s["codec_type"] == "audio"), None)
    
    assert v_stream is not None, "No video stream found in rendered MP4"
    assert a_stream is not None, "No audio stream found in rendered MP4"
    assert v_stream["width"] == 1080, f"Expected width 1080, got {v_stream['width']}"
    assert v_stream["height"] == 1920, f"Expected height 1920, got {v_stream['height']}"
    assert v_stream["codec_name"] == "h264", f"Expected h264 codec, got {v_stream['codec_name']}"
    assert a_stream["codec_name"] == "aac", f"Expected aac audio, got {a_stream['codec_name']}"
    
    duration = float(probe["format"]["duration"])
    assert duration > 3.0, f"Rendered duration too short: {duration}s"
    print(f"Validation passed! Rendered {output_filename}: {duration:.2f}s, {v_stream['width']}x{v_stream['height']}, {v_stream['codec_name']}/{a_stream['codec_name']}")

if __name__ == "__main__":
    test_full_video_export_pipeline()
    print("test_video_export passed successfully!")
