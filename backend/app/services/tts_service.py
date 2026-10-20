import os
import sys
import subprocess
import shutil
import platform
import hashlib
import json
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional

from .ffmpeg_utils import get_audio_duration, get_ffmpeg_path
from ..config import CACHE_DIR, PIPER_DIR

_TTS_LOCK = threading.Lock()


def _espeak_binary() -> Optional[str]:
    return shutil.which("espeak-ng") or shutil.which("espeak")


def _list_espeak_voices(binary: str) -> List[Dict[str, Any]]:
    try:
        result = subprocess.run([binary, "--voices"], capture_output=True, text=True, timeout=10, check=True)
    except (OSError, subprocess.SubprocessError):
        return []

    voices = []
    for line in result.stdout.splitlines()[1:]:
        columns = line.split()
        if len(columns) < 5:
            continue
        language = columns[1]
        # The language identifier (for example, en-us) is accepted by -v;
        # the file column is an internal path and isn't a stable UI identifier.
        voice_id = language
        label = columns[3] if len(columns) > 3 else language
        voices.append({
            "id": voice_id,
            "name": f"{label} (eSpeak NG)",
            "engine": "espeak",
            "language": language,
            "gender": columns[2] if columns[2] in ("M", "F") else "unknown",
            "is_default": voice_id in ("en-us", "en"),
            "is_installed": True,
            "quality": "standard"
        })
    return voices

def get_available_voices() -> List[Dict[str, Any]]:
    voices = []

    if platform.system() == "Windows":
        try:
            import pyttsx3
            engine = pyttsx3.init()
            sapi_voices = engine.getProperty("voices") or []
            for idx, voice in enumerate(sapi_voices):
                voice_id = getattr(voice, "id", f"sapi_{idx}")
                langs = getattr(voice, "languages", ["en-US"])
                voices.append({
                    "id": voice_id,
                    "name": getattr(voice, "name", f"Windows Voice {idx + 1}"),
                    "engine": "sapi",
                    "language": langs[0] if langs else "en-US",
                    "gender": str(getattr(voice, "gender", "unknown")),
                    "is_default": idx == 0,
                    "is_installed": True,
                    "quality": "standard"
                })
            engine.stop()
        except Exception as e:
            print(f"Warning: Error discovering Windows voices: {e}")
    else:
        binary = _espeak_binary()
        if binary:
            voices.extend(_list_espeak_voices(binary))
        
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


def _run_espeak(text: str, output_path: str | Path, voice_id: Optional[str], rate: int, volume: int):
    binary = _espeak_binary()
    if not binary:
        raise RuntimeError("No speech engine is installed. Install eSpeak NG or select a voice engine supported by this host.")

    available = _list_espeak_voices(binary)
    available_ids = {voice["id"] for voice in available}
    selected_voice = voice_id if voice_id in available_ids else ("en-us" if "en-us" in available_ids else None)
    command = [binary]
    if selected_voice:
        command.extend(["-v", selected_voice])
    command.extend(["-s", str(max(80, min(450, int(rate)))), "-a", str(max(0, min(200, int(volume)))), "-w", str(output_path), text])
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"eSpeak NG could not generate speech: {exc}") from exc
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "unknown eSpeak NG error"
        raise RuntimeError(f"eSpeak NG failed: {detail}")
    if not Path(output_path).exists() or Path(output_path).stat().st_size < 200:
        raise RuntimeError("eSpeak NG returned an empty audio file.")

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
                if platform.system() == "Windows":
                    _run_pyttsx3_worker(effective_text, str(cache_file), None, rate, volume)
                else:
                    _run_espeak(effective_text, cache_file, None, rate, volume)
        elif platform.system() != "Windows":
            # SAPI is Windows-only. Use the installed Linux speech engine when
            # a local project is opened on a hosted Linux instance.
            _run_espeak(effective_text, cache_file, voice_id, rate, volume)
        else:
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
