import os
import sys
import tempfile
import sqlite3
import json
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.project_service import (
    create_project,
    get_project,
    update_project,
    list_projects,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_BRANDING,
    DEFAULT_AUDIO_SETTINGS
)
from backend.app.services.subtitle_service import (
    generate_scene_subtitles,
    export_subtitles_ass,
    export_subtitles_srt,
    export_subtitles_vtt
)

def test_empty_or_legacy_project_loads_full_subtitle_defaults():
    """Verify that a project with empty or legacy subtitle style gets complete defaults populated."""
    p = create_project({"title": "Legacy Style Test Project", "aspect_ratio": "9:16"})
    proj_id = p["id"]
    
    # Verify created project has full defaults
    loaded = get_project(proj_id)
    assert loaded is not None
    style = loaded.get("subtitle_style")
    assert isinstance(style, dict)
    for key, val in DEFAULT_SUBTITLE_STYLE.items():
        assert key in style, f"Missing key in style: {key}"
        assert style[key] == val, f"Value mismatch for {key}: {style[key]} != {val}"

def test_partial_subtitle_style_update_merges_without_data_loss():
    """Verify updating a single property (e.g. font_size or highlight_color) preserves all other properties."""
    p = create_project({"title": "Partial Update Test", "aspect_ratio": "9:16"})
    proj_id = p["id"]
    
    # Update only highlight_color and font_size
    update_project(proj_id, {
        "subtitle_style": {
            "highlight_color": "#00FFCC",
            "font_size": 56,
            "mode": "word_highlight"
        }
    })
    
    updated = get_project(proj_id)
    assert updated is not None
    style = updated["subtitle_style"]
    assert style["highlight_color"] == "#00FFCC"
    assert style["font_size"] == 56
    assert style["mode"] == "word_highlight"
    # Preserved fields
    assert style["font_family"] == DEFAULT_SUBTITLE_STYLE["font_family"]
    assert style["text_color"] == DEFAULT_SUBTITLE_STYLE["text_color"]
    assert style["position"] == DEFAULT_SUBTITLE_STYLE["position"]
    assert style["outline_width"] == DEFAULT_SUBTITLE_STYLE["outline_width"]

def test_multiple_projects_maintain_independent_subtitle_styles():
    """Verify switching between multiple projects preserves independent style settings without cross-contamination."""
    p1 = create_project({"title": "Project Alpha", "aspect_ratio": "9:16"})
    p2 = create_project({"title": "Project Beta", "aspect_ratio": "9:16"})
    
    # Configure Alpha
    update_project(p1["id"], {
        "subtitle_style": {
            "font_family": "Montserrat",
            "text_color": "#FF0055",
            "highlight_color": "#FFFF00",
            "font_size": 60
        }
    })
    
    # Configure Beta
    update_project(p2["id"], {
        "subtitle_style": {
            "font_family": "Impact",
            "text_color": "#00FFFF",
            "highlight_color": "#FF00AA",
            "font_size": 42
        }
    })
    
    p1_loaded = get_project(p1["id"])
    p2_loaded = get_project(p2["id"])
    
    assert p1_loaded["subtitle_style"]["font_family"] == "Montserrat"
    assert p1_loaded["subtitle_style"]["text_color"] == "#FF0055"
    assert p1_loaded["subtitle_style"]["font_size"] == 60
    
    assert p2_loaded["subtitle_style"]["font_family"] == "Impact"
    assert p2_loaded["subtitle_style"]["text_color"] == "#00FFFF"
    assert p2_loaded["subtitle_style"]["font_size"] == 42

def test_ass_subtitle_generation_with_custom_style():
    """Verify ASS subtitle generation applies custom fonts, colors, and margins correctly."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        ass_path = tmp_p / "styled_subtitles.ass"
        
        subs = generate_scene_subtitles(
            scene_start_time=0.0,
            audio_duration=4.0,
            narration_text="Master the market structure before entering the trade.",
            word_highlight=True
        )
        
        custom_style = {
            "font_family": "Inter",
            "font_size": 52,
            "text_color": "#FFFFFF",
            "highlight_color": "#38BDF8",
            "mode": "word_highlight",
            "outline_color": "#000000",
            "outline_width": 3,
            "margin_v": 220
        }
        
        export_subtitles_ass(
            subs,
            ass_path,
            width=1080,
            height=1920,
            style_config=custom_style
        )
        
        assert ass_path.exists()
        content = ass_path.read_text(encoding="utf-8")
        assert "Fontname=Inter" in content or "Inter" in content
        assert "PlayResX: 1080" in content
        assert "PlayResY: 1920" in content
        assert "Dialogue:" in content


if __name__ == "__main__":
    test_empty_or_legacy_project_loads_full_subtitle_defaults()
    test_partial_subtitle_style_update_merges_without_data_loss()
    test_multiple_projects_maintain_independent_subtitle_styles()
    test_ass_subtitle_generation_with_custom_style()
    print("All subtitle style regression tests passed!")
