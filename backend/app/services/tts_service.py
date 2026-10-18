import os
import sys
import subprocess
import hashlib
import json
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional

from .ffmpeg_utils import get_audio_duration, get_ffmpeg_path
from ..config import CACHE_DIR, PIPER_DIR

_TTS_LOCK = threading.Lock()

def get_available_voices() -> List[Dict[str, Any]]:
    voices = []
    
    # 1. Discover Windows SAPI voices via pyttsx3
    try:
        import pyttsx3
        engine = pyttsx3.init()
        sapi_voices = engine.getProperty("voices") or []
        for idx, v in enumerate(sapi_voices):
            v_id = getattr(v, "id", f"sapi_{idx}")
            v_name = getattr(v, "name", f"Windows Voice {idx+1}")
            langs = getattr(v, "languages", ["en-US"])
            gender = getattr(v, "gender", "unknown")
            voices.append({
                "id": v_id,
                "name": v_name,
                "engine": "sapi",
                "language": langs[0] if langs else "en-US",
                "gender": str(gender),
                "is_default": idx == 0,
                "is_installed": True,
                "quality": "standard"
            })
        try:
            engine.stop()
        except Exception:
            pass
    except Exception as e:
        print(f"Warning: Error discovering SAPI voices: {e}")
        
    # 2. Check for Piper models in PIPER_DIR
    piper_models = list(PIPER_DIR.glob("*.onnx"))
    for m in piper_models:
        voices.append({
            "id": str(m),
            "name": f"Piper Neural ({m.stem})",
            "engine": "piper",
            "language": "en-US",
            "gender": "neural",
            "is_default": False,
            "is_installed": True,
            "quality": "neural"
        })

    # If no voices discovered, provide at least a fallback descriptor
    if not voices:
        voices.append({
            "id": "default",
            "name": "System Default Voice",
            "engine": "sapi",
            "language": "en-US",
            "gender": "unknown",
            "is_default": True,
            "is_installed": True,
            "quality": "standard"
        })

    return voices

def get_cache_key(text: str, engine: str, voice_id: str, rate: int, volume: int) -> str:
    raw = f"{engine}:{voice_id}:{rate}:{volume}:{text.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def _run_pyttsx3_worker(text: str, output_path: str, voice_id: Optional[str] = None, rate: int = 175, volume: int = 100):
    script = """
import sys, pyttsx3

text = sys.argv[1]
out_path = sys.argv[2]
voice_id = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "NONE" else None
rate = int(sys.argv[4]) if len(sys.argv) > 4 else 175
volume = float(sys.argv[5])/100.0 if len(sys.argv) > 5 else 1.0

engine = pyttsx3.init()
engine.setProperty("rate", rate)
engine.setProperty("volume", max(0.0, min(1.0, volume)))

if voice_id:
    try:
        engine.setProperty("voice", voice_id)
    except Exception:
        pass

engine.save_to_file(text if text.strip() else " ", out_path)
engine.runAndWait()
engine.stop()
"""
    v_param = voice_id if voice_id else "NONE"
    res = subprocess.run(
        [sys.executable, "-c", script, text, str(output_path), v_param, str(rate), str(volume)],
        capture_output=True,
        text=True,
        timeout=30
    )
    if res.returncode != 0:
        raise RuntimeError(f"TTS synthesis failed: {res.stderr}")
    
    if not Path(output_path).exists() or Path(output_path).stat().st_size < 200:
        raise RuntimeError("TTS generation resulted in an empty audio file.")

import re

def apply_pronunciation_overrides(text: str, pronunciation_dict: Optional[Dict[str, str]] = None) -> str:
    if not text or not pronunciation_dict:
        return text
    processed = text
    for word, replacement in pronunciation_dict.items():
        if word and replacement:
            pattern = r'\b' + re.escape(word.strip()) + r'\b'
            processed = re.sub(pattern, replacement.strip(), processed, flags=re.IGNORECASE)
    return processed

def generate_speech(
    text: str,
    output_path: str | Path,
    engine: str = "sapi",
    voice_id: Optional[str] = None,
    rate: int = 175,
    volume: int = 100,
    use_cache: bool = True,
    pronunciation_dict: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    
    clean_text = text.strip()
    
    # If text is empty, generate 2 seconds of silent audio using ffmpeg
    if not clean_text:
        ffmpeg = get_ffmpeg_path()
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2.0", str(out_p)],
            check=True,
            timeout=10
        )
        return {
            "audio_path": str(out_p),
            "duration": 2.0,
            "cached": False,
            "is_silent": True
        }

    # Apply pronunciation overrides
    effective_text = apply_pronunciation_overrides(clean_text, pronunciation_dict)

    # Check cache
    cache_key = get_cache_key(effective_text, engine, voice_id or "", rate, volume)
    cache_file = CACHE_DIR / f"{cache_key}.wav"
    
    if use_cache and cache_file.exists() and cache_file.stat().st_size > 500:
        import shutil
        shutil.copy2(cache_file, out_p)
        dur = get_audio_duration(out_p)
        return {
            "audio_path": str(out_p),
            "duration": dur,
            "cached": True,
            "is_silent": False
        }

    with _TTS_LOCK:
        if engine == "piper" and voice_id and Path(voice_id).exists():
            # Piper TTS execution
            cmd = [
                sys.executable, "-m", "piper",
                "--model", voice_id,
                "--output_file", str(cache_file)
            ]
            res = subprocess.run(cmd, input=effective_text, text=True, capture_output=True, timeout=30)
            if res.returncode != 0:
                # Fallback to SAPI
                _run_pyttsx3_worker(effective_text, str(cache_file), None, rate, volume)
        else:
            # Default to SAPI (pyttsx3 worker)
            _run_pyttsx3_worker(effective_text, str(cache_file), voice_id, rate, volume)

    # Copy cached file to desired destination
    import shutil
    shutil.copy2(cache_file, out_p)
    dur = get_audio_duration(out_p)
    
    return {
        "audio_path": str(out_p),
        "duration": dur,
        "cached": False,
        "is_silent": False
    }
