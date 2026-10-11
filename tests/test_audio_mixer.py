import os
import sys
import tempfile
import subprocess
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.ffmpeg_utils import get_ffmpeg_path, get_audio_duration
from backend.app.services.tts_service import generate_speech
from backend.app.services.audio_mixer import create_padded_audio_clip, mix_master_audio

def test_audio_mixing_and_ducking():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        ffmpeg = get_ffmpeg_path()
        
        # 1. Generate 2 spoken voiceover tracks
        v1_p = tmp_p / "v1.wav"
        v2_p = tmp_p / "v2.wav"
        generate_speech("First point to observe.", v1_p, rate=180, use_cache=False)
        generate_speech("Second point to consider.", v2_p, rate=180, use_cache=False)
        
        dur1 = get_audio_duration(v1_p)
        dur2 = get_audio_duration(v2_p)
        
        target1 = dur1 + 1.0
        target2 = dur2 + 1.0
        total_dur = target1 + target2
        
        # Pad clips
        pad1 = tmp_p / "pad1.wav"
        pad2 = tmp_p / "pad2.wav"
        create_padded_audio_clip(v1_p, target1, pad1)
        create_padded_audio_clip(v2_p, target2, pad2)
        
        assert abs(get_audio_duration(pad1) - target1) < 0.05
        assert abs(get_audio_duration(pad2) - target2) < 0.05
        
        # 2. Synthesize a clean 440Hz ambient tone as background music (BGM)
        bgm_p = tmp_p / "ambient_bgm.wav"
        cmd_bgm = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100",
            "-t", "5.0",
            "-c:a", "pcm_s16le", str(bgm_p)
        ]
        subprocess.run(cmd_bgm, check=True)
        
        # 3. Mix master audio with ducking
        master_out = tmp_p / "master_mixed.m4a"
        mix_master_audio(
            scene_audio_files=[str(pad1), str(pad2)],
            total_duration=total_dur,
            output_path=master_out,
            bgm_path=bgm_p,
            narration_vol=1.0,
            bgm_vol=0.2,
            enable_ducking=True
        )
        
        assert master_out.exists(), "Master mixed audio was not created"
        out_dur = get_audio_duration(master_out)
        assert abs(out_dur - total_dur) < 0.1, f"Mixed audio duration mismatch: {out_dur} vs {total_dur}"
        print(f"Master mixed audio generated successfully ({out_dur:.2f}s, ducking enabled)")

if __name__ == "__main__":
    test_audio_mixing_and_ducking()
    print("test_audio_mixer passed successfully!")
