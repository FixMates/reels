import os
import sys
import tempfile
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.tts_service import generate_speech
from backend.app.services.ffmpeg_utils import get_audio_duration
from backend.app.services.timeline_service import compute_timeline

def test_scene_duration_and_timing():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        
        # 3 different script lengths
        scripts = [
            ("Short hook", "Welcome traders."),
            ("Medium explanation", "Here is why order blocks fail when market structure is not aligned."),
            ("Long breakdown", "Always remember that high time frame liquidity pools dictate the direction before low time frame entries are confirmed. Never rush into early entries.")
        ]
        
        scenes = []
        for idx, (label, text) in enumerate(scripts):
            audio_f = tmp_p / f"voice_{idx}.wav"
            tts_res = generate_speech(text, audio_f, rate=180, use_cache=False)
            measured_dur = tts_res["duration"]
            scenes.append({
                "id": f"scene_{idx}",
                "scene_order": idx,
                "narration_script": text,
                "audio_path": str(audio_f),
                "is_included": True
            })
            
        end_padding = 0.8
        timeline = compute_timeline(scenes, end_padding_seconds=end_padding)
        
        assert len(timeline["scenes"]) == 3
        prev_end = 0.0
        
        for idx, s in enumerate(timeline["scenes"]):
            actual_audio_dur = get_audio_duration(s["audio_path"])
            expected_scene_dur = round(actual_audio_dur + end_padding, 3)
            
            # Assert duration matches actual audio + padding
            assert abs(s["duration"] - expected_scene_dur) < 0.05, f"Scene {idx} duration mismatch: {s['duration']} vs {expected_scene_dur}"
            assert s["start_time"] == round(prev_end, 3), f"Scene {idx} does not start where previous ended"
            assert s["duration"] > actual_audio_dur, f"Scene {idx} would truncate audio!"
            prev_end = s["end_time"]
            
        assert timeline["total_duration"] == round(prev_end, 3)
        print(f"Total calculated duration: {timeline['total_duration']}s across 3 scenes")

if __name__ == "__main__":
    test_scene_duration_and_timing()
    print("test_timing passed successfully!")
