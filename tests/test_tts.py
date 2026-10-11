import os
import sys
import tempfile
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.tts_service import get_available_voices, generate_speech
from backend.app.services.ffmpeg_utils import get_audio_duration

def test_local_tts_generation():
    # 1. Verify voice discovery returns installed voices
    voices = get_available_voices()
    assert len(voices) > 0, "No TTS voices were discovered"
    print(f"Found {len(voices)} local voices: {[v['name'] for v in voices]}")
    
    # 2. Test generation without internet / without API key
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        out_wav = tmp_p / "test_narration.wav"
        
        test_script = "This is a local offline test narration demonstrating crystal-clear speech without any external API."
        res = generate_speech(
            text=test_script,
            output_path=out_wav,
            engine="sapi",
            rate=175,
            volume=100,
            use_cache=False
        )
        
        assert out_wav.exists(), "TTS WAV audio file was not created"
        file_size = out_wav.stat().st_size
        assert file_size > 5000, f"TTS WAV file is too small ({file_size} bytes)"
        
        dur = get_audio_duration(out_wav)
        assert dur > 1.5, f"Audio duration too short ({dur:.2f}s)"
        print(f"Generated {dur:.2f}s of audio ({file_size} bytes)")

if __name__ == "__main__":
    test_local_tts_generation()
    print("test_tts passed successfully!")
