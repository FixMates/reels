import os
import sys
import tempfile
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.subtitle_service import (
    generate_scene_subtitles,
    export_subtitles_srt,
    export_subtitles_vtt,
    export_subtitles_ass
)

def test_subtitle_generation_and_export():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        
        narration = "Confirm the break of structure before evaluating the setup. Never enter without liquidity sweep."
        scene_start = 2.5
        audio_dur = 6.2
        
        subs = generate_scene_subtitles(
            scene_start_time=scene_start,
            audio_duration=audio_dur,
            narration_text=narration,
            max_chars=32,
            word_highlight=True
        )
        
        assert len(subs) > 0, "No subtitle chunks were produced"
        
        # Verify timing boundaries
        for s in subs:
            assert s["start"] >= scene_start, f"Subtitle starts before scene: {s['start']} < {scene_start}"
            assert s["end"] <= scene_start + audio_dur + 0.1, f"Subtitle exceeds audio end: {s['end']} > {scene_start + audio_dur}"
            assert len(s["text"]) > 0
            if s.get("words"):
                for w in s["words"]:
                    assert w["start"] >= s["start"]
                    assert w["end"] <= s["end"]
                    
        # 1. Test SRT export
        srt_f = tmp_p / "test.srt"
        export_subtitles_srt(subs, srt_f)
        assert srt_f.exists()
        srt_content = srt_f.read_text(encoding="utf-8")
        assert "-->" in srt_content
        assert "Confirm the break" in srt_content
        
        # 2. Test VTT export
        vtt_f = tmp_p / "test.vtt"
        export_subtitles_vtt(subs, vtt_f)
        assert vtt_f.exists()
        vtt_content = vtt_f.read_text(encoding="utf-8")
        assert "WEBVTT" in vtt_content
        
        # 3. Test ASS export
        ass_f = tmp_p / "test.ass"
        export_subtitles_ass(
            subs,
            ass_f,
            width=1080,
            height=1920,
            style_config={
                "font_family": "Arial",
                "font_size": 48,
                "text_color": "#FFFFFF",
                "highlight_color": "#FACC15",
                "mode": "word_highlight"
            }
        )
        assert ass_f.exists()
        ass_content = ass_f.read_text(encoding="utf-8")
        assert "[Script Info]" in ass_content
        assert "[V4+ Styles]" in ass_content
        assert "Dialogue:" in ass_content

if __name__ == "__main__":
    test_subtitle_generation_and_export()
    print("test_subtitles passed successfully!")
