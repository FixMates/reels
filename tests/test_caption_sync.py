import pytest
from backend.app.services.subtitle_service import (
    export_subtitles_ass,
    parse_srt_or_vtt,
    generate_scene_subtitles
)
from backend.app.services.timeline_service import compute_timeline
from pathlib import Path

def test_ass_positioning_and_inactive_colors(tmp_path):
    subtitles = [
        {
            "start": 0.5,
            "end": 2.5,
            "text": "Federal Reserve Cuts Rates",
            "words": [
                {"word": "Federal", "start": 0.5, "end": 1.0},
                {"word": "Reserve", "start": 1.0, "end": 1.5},
                {"word": "Cuts", "start": 1.5, "end": 2.0},
                {"word": "Rates", "start": 2.0, "end": 2.5}
            ]
        }
    ]
    
    ass_file = tmp_path / "test.ass"
    style = {
        "x": 0.5,
        "y": 0.75,
        "mode": "word_highlight",
        "highlight_color": "#FACC15",
        "inactive_color": "#94A3B8",
        "text_color": "#FFFFFF",
        "bg_color": "#000000",
        "font_size": 42
    }
    
    export_subtitles_ass(subtitles, ass_file, width=1080, height=1920, style_config=style)
    assert ass_file.exists()
    content = ass_file.read_text(encoding="utf-8")
    
    # Check pos tag
    assert r"\pos(540,1440)" in content
    # Check inactive color tag and highlight color tag
    assert r"\c&H00" in content

def test_srt_vtt_parsing():
    sample_srt = """1
00:00:01,000 --> 00:00:03,500
Inflation report released today.

2
00:00:03,600 --> 00:00:06,200
Markets reacted with high volatility.
"""
    segments = parse_srt_or_vtt(sample_srt)
    assert len(segments) == 2
    assert segments[0]["start"] == 1.0
    assert segments[0]["end"] == 3.5
    assert segments[0]["text"] == "Inflation report released today."
    assert segments[1]["text"] == "Markets reacted with high volatility."

def test_timeline_custom_segments():
    scenes = [
        {
            "id": "s1",
            "is_included": True,
            "scene_duration": 4.0,
            "custom_segments": [
                {"start": 0.2, "end": 1.8, "text": "First point"},
                {"start": 2.0, "end": 3.6, "text": "Second point"}
            ]
        }
    ]
    
    tl = compute_timeline(scenes)
    assert tl["total_duration"] == 4.0
    assert len(tl["subtitles"]) == 2
    assert tl["subtitles"][0]["text"] == "First point"
    assert tl["subtitles"][0]["start"] == 0.2
    assert tl["subtitles"][1]["start"] == 2.0
