import pytest
from backend.app.services.tts_service import apply_pronunciation_overrides
from backend.app.services.audio_mixer import mix_master_audio, create_padded_audio_clip
from pathlib import Path

def test_pronunciation_overrides():
    text = "The SEC approved BTC and ETH ETFs for Wall St traders."
    overrides = {
        "SEC": "S. E. C.",
        "BTC": "Bitcoin",
        "ETH": "Ethereum",
        "ETFs": "E. T. Fs"
    }
    result = apply_pronunciation_overrides(text, overrides)
    assert "Bitcoin" in result
    assert "Ethereum" in result
    assert "S. E. C." in result
    assert "E. T. Fs" in result

def test_audio_mixer_loudnorm_and_limiter(tmp_path):
    clip1 = tmp_path / "clip1.wav"
    create_padded_audio_clip(None, 2.0, clip1)
    
    out_master = tmp_path / "master.m4a"
    mix_master_audio(
        scene_audio_files=[str(clip1)],
        total_duration=2.0,
        output_path=out_master,
        target_lufs=-16.0,
        enable_limiter=True
    )
    
    assert out_master.exists()
    assert out_master.stat().st_size > 1000
