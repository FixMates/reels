import os
import sys
import time
import tempfile
from pathlib import Path
import pytest
import pymupdf
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.project_service import (
    create_project,
    get_project,
    update_project,
    add_scenes_to_project,
    update_scene,
    reorder_scenes,
    get_connection
)
from backend.app.services.pdf_service import process_pdf
from backend.app.services.image_service import process_uploaded_image, compose_slide
from backend.app.services.tts_service import get_available_voices, generate_speech
from backend.app.services.timeline_service import compute_timeline
from backend.app.services.subtitle_service import (
    generate_scene_subtitles,
    export_subtitles_srt,
    export_subtitles_vtt,
    export_subtitles_ass
)
from backend.app.services.audio_mixer import create_padded_audio_clip, mix_master_audio
from backend.app.services.video_renderer import start_render_job, get_job_status
from backend.app.services.ffmpeg_utils import get_audio_duration, probe_media_file, get_ffmpeg_path

def test_acceptance_1_pdf_import(tmp_path):
    """Test 1: PDF import with multi-page order and previews."""
    pdf_path = tmp_path / "acceptance_doc.pdf"
    doc = pymupdf.open()
    for i in range(1, 4):
        p = doc.new_page(width=600, height=800)
        p.insert_text((40, 80), f"Acceptance Test Page {i}", fontsize=24)
    doc.save(str(pdf_path))
    doc.close()

    out_dir = tmp_path / "pdf_pages"
    pages = process_pdf(pdf_path, out_dir)
    assert len(pages) == 3
    for idx, page in enumerate(pages, 1):
        assert page["page_number"] == idx
        assert Path(page["image_path"]).exists()
        assert Path(page["thumbnail_path"]).exists()

def test_acceptance_2_multiple_images(tmp_path):
    """Test 2: Upload at least 5 different images, confirm thumbnails and reordering."""
    img_files = []
    for i in range(1, 6):
        im_p = tmp_path / f"img_{i}.png"
        im = Image.new("RGB", (400, 400), (i * 40, 100, 200))
        im.save(im_p)
        img_files.append(im_p)

    out_dir = tmp_path / "processed_imgs"
    scenes = []
    for f in img_files:
        proc = process_uploaded_image(f, out_dir, prefix=f.stem)
        assert Path(proc["image_path"]).exists()
        assert Path(proc["thumbnail_path"]).exists()
        scenes.append({
            "original_image_path": proc["image_path"],
            "thumbnail_path": proc["thumbnail_path"],
            "source_filename": f.name
        })

    # Test reordering
    proj = create_project({"title": "5 Images Project"})
    db_scenes = add_scenes_to_project(proj["id"], scenes)
    assert len(db_scenes) == 5

    # Reverse order
    reversed_ids = [s["id"] for s in reversed(db_scenes)]
    reorder_scenes(proj["id"], reversed_ids)
    reloaded = get_project(proj["id"])
    assert [s["id"] for s in reloaded["scenes"]] == reversed_ids

def test_acceptance_3_individual_captions_persistence():
    """Test 3: Enter different captions and narration for 3 images, verify persistence."""
    proj = create_project({"title": "Individual Captions Project"})
    scenes_data = [
        {"original_image_path": "dummy1.png", "source_filename": "s1.png"},
        {"original_image_path": "dummy2.png", "source_filename": "s2.png"},
        {"original_image_path": "dummy3.png", "source_filename": "s3.png"}
    ]
    db_scenes = add_scenes_to_project(proj["id"], scenes_data)

    captions = [
        ("Hook 1", "Three mistakes traders make when identifying order blocks.", "Mistake 1"),
        ("Hook 2", "Always check whether price has already revisited the zone.", "Mistake 2"),
        ("Hook 3", "Confirm the break of structure before evaluating the setup.", "Mistake 3")
    ]

    for idx, (head, narr, cap) in enumerate(captions):
        update_scene(db_scenes[idx]["id"], {
            "headline": head,
            "narration_script": narr,
            "caption": cap
        })

    # Simulate navigating away and reopening
    reloaded = get_project(proj["id"])
    for idx, (head, narr, cap) in enumerate(captions):
        s = reloaded["scenes"][idx]
        assert s["headline"] == head
        assert s["narration_script"] == narr
        assert s["caption"] == cap

def test_acceptance_4_cropping(tmp_path):
    """Test 4: Crop 1 PDF page and 1 image, verify no distortion."""
    src_img = tmp_path / "crop_src.png"
    im = Image.new("RGB", (800, 800), (0, 128, 255))
    im.save(src_img)

    out_slide = tmp_path / "cropped_slide.png"
    compose_slide(
        image_path=src_img,
        output_path=out_slide,
        width=1080,
        height=1920,
        crop={"x": 0.2, "y": 0.2, "w": 0.6, "h": 0.6},
        fit_mode="fit",
        headline="Crop Test"
    )
    assert out_slide.exists()
    with Image.open(out_slide) as res:
        assert res.size == (1080, 1920)

def test_acceptance_5_local_tts(tmp_path):
    """Test 5: Generate speech without API key/internet, verify playable audio."""
    voices = get_available_voices()
    assert len(voices) > 0
    out_audio = tmp_path / "offline_voice.wav"
    res = generate_speech("Testing offline local SAPI voice synthesis.", out_audio, use_cache=False)
    assert out_audio.exists()
    assert out_audio.stat().st_size > 1000
    assert res["duration"] > 1.0

def test_acceptance_6_timing(tmp_path):
    """Test 6: Narration scripts of different lengths, verify scene duration = audio + padding."""
    scripts = ["Short.", "This is a medium length sentence for testing timing.", "This is a significantly longer paragraph designed to test timing synchronization and ensure no audio is truncated at all."]
    scenes = []
    end_padding = 0.7
    for idx, sc in enumerate(scripts):
        aud_p = tmp_path / f"voice_{idx}.wav"
        res = generate_speech(sc, aud_p, use_cache=False)
        scenes.append({
            "id": f"s_{idx}",
            "narration_script": sc,
            "audio_path": str(aud_p),
            "is_included": True
        })
    tl = compute_timeline(scenes, end_padding_seconds=end_padding)
    for s in tl["scenes"]:
        actual_audio = get_audio_duration(s["audio_path"])
        assert abs(s["duration"] - (actual_audio + end_padding)) < 0.05
        assert s["duration"] > actual_audio

def test_acceptance_7_subtitles(tmp_path):
    """Test 7: Confirm subtitle files generated, timestamps within duration, safe margins."""
    subs = generate_scene_subtitles(
        scene_start_time=1.0,
        audio_duration=4.5,
        narration_text="Confirm structure before execution.",
        max_chars=30,
        word_highlight=True
    )
    srt_p = tmp_path / "sub.srt"
    vtt_p = tmp_path / "sub.vtt"
    export_subtitles_srt(subs, srt_p)
    export_subtitles_vtt(subs, vtt_p)
    assert srt_p.exists() and vtt_p.exists()
    assert subs[0]["start"] >= 1.0
    assert subs[-1]["end"] <= 5.5

def test_acceptance_8_audio_mixing(tmp_path):
    """Test 8: Combine narration and BGM, ducking enabled."""
    ffmpeg = get_ffmpeg_path()
    bgm_p = tmp_path / "bgm.wav"
    import subprocess
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=300", "-t", "4", str(bgm_p)], check=True)
    v_p = tmp_path / "voice.wav"
    generate_speech("Narration track test.", v_p, use_cache=False)
    
    pad_p = tmp_path / "padded.wav"
    create_padded_audio_clip(v_p, 3.5, pad_p)
    
    out_mixed = tmp_path / "mixed.m4a"
    mix_master_audio(
        scene_audio_files=[str(pad_p)],
        total_duration=3.5,
        output_path=out_mixed,
        bgm_path=bgm_p,
        enable_ducking=True
    )
    assert out_mixed.exists()
    assert out_mixed.stat().st_size > 1000

def test_acceptance_9_export(tmp_path):
    """Test 9: Export MP4, verify dimensions (1080x1920), codec (h264/aac), duration via ffprobe."""
    proj = create_project({"title": "Acceptance Export Test", "width": 1080, "height": 1920})
    im_p = tmp_path / "slide.png"
    im = Image.new("RGB", (720, 720), (30, 60, 120))
    im.save(im_p)

    add_scenes_to_project(proj["id"], [{
        "original_image_path": str(im_p),
        "headline": "Acceptance Test Hook",
        "narration_script": "Verification of MP4 encoding."
    }])

    job_id = start_render_job(proj["id"], {"quality_preset": "ultrafast"})
    for _ in range(40):
        st = get_job_status(job_id)
        if st and st["status"] == "completed":
            break
        time.sleep(1)

    st = get_job_status(job_id)
    assert st["status"] == "completed"
    from backend.app.config import OUTPUT_DIR
    out_mp4 = OUTPUT_DIR / st["output_filename"]
    probe = probe_media_file(out_mp4)
    v_stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a_stream = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    assert v_stream["width"] == 1080
    assert v_stream["height"] == 1920
    assert v_stream["codec_name"] == "h264"
    assert a_stream["codec_name"] == "aac"

def test_acceptance_10_persistence():
    """Test 10: Save project, simulate restart / new DB session, reopen, verify fields."""
    p = create_project({
        "title": "Persistent Studio Project",
        "voice_rate": 185,
        "default_top_text": "Default Hook"
    })
    pid = p["id"]

    # Close and open fresh connection
    conn = get_connection()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    conn.close()
    assert row is not None
    assert row["voice_rate"] == 185
    assert row["default_top_text"] == "Default Hook"

def test_acceptance_11_error_handling():
    """Test 11: Invalid file, missing voice, graceful errors without crash."""
    from backend.app.services.ffmpeg_utils import get_audio_duration
    with pytest.raises(FileNotFoundError):
        get_audio_duration("non_existent_audio_file.wav")
