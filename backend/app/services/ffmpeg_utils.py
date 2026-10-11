import os
import sys
import shutil
import subprocess
import json
import wave
import contextlib
from pathlib import Path
from typing import Optional, Dict, Any

_FFMPEG_PATH: Optional[str] = None
_FFPROBE_PATH: Optional[str] = None

def init_ffmpeg_paths():
    global _FFMPEG_PATH, _FFPROBE_PATH
    
    # 1. Check if already in PATH
    ffmpeg_in_path = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    ffprobe_in_path = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
    if ffmpeg_in_path:
        _FFMPEG_PATH = ffmpeg_in_path
    if ffprobe_in_path:
        _FFPROBE_PATH = ffprobe_in_path

    # 2. Try static_ffmpeg package if either is missing
    if not _FFMPEG_PATH or not _FFPROBE_PATH:
        try:
            import static_ffmpeg
            static_ffmpeg.add_paths()
            if not _FFMPEG_PATH:
                _FFMPEG_PATH = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
            if not _FFPROBE_PATH:
                _FFPROBE_PATH = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
        except Exception:
            pass

    # 3. Try imageio_ffmpeg for ffmpeg if still missing
    if not _FFMPEG_PATH:
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and os.path.exists(exe):
                _FFMPEG_PATH = exe
        except Exception:
            pass

    # 4. Check typical Windows WinGet Gyan FFmpeg locations
    if not _FFMPEG_PATH or not _FFPROBE_PATH:
        winget_dir = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
        if winget_dir.exists():
            for gyan_dir in winget_dir.glob("*Gyan*FFmpeg*"):
                for bin_dir in gyan_dir.rglob("bin"):
                    cand_ffmpeg = bin_dir / "ffmpeg.exe"
                    cand_ffprobe = bin_dir / "ffprobe.exe"
                    if not _FFMPEG_PATH and cand_ffmpeg.exists():
                        _FFMPEG_PATH = str(cand_ffmpeg)
                    if not _FFPROBE_PATH and cand_ffprobe.exists():
                        _FFPROBE_PATH = str(cand_ffprobe)

def get_ffmpeg_path() -> str:
    global _FFMPEG_PATH
    if not _FFMPEG_PATH or not os.path.exists(_FFMPEG_PATH):
        init_ffmpeg_paths()
    if not _FFMPEG_PATH:
        raise RuntimeError("FFmpeg executable not found. Please install FFmpeg.")
    return _FFMPEG_PATH

def get_ffprobe_path() -> Optional[str]:
    global _FFPROBE_PATH
    if not _FFPROBE_PATH or not os.path.exists(_FFPROBE_PATH):
        init_ffmpeg_paths()
    return _FFPROBE_PATH

def check_ffmpeg_available() -> Dict[str, Any]:
    init_ffmpeg_paths()
    ffmpeg_ok = False
    ffprobe_ok = False
    version_str = "Unknown"
    
    if _FFMPEG_PATH and os.path.exists(_FFMPEG_PATH):
        try:
            res = subprocess.run([_FFMPEG_PATH, "-version"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                ffmpeg_ok = True
                first_line = res.stdout.splitlines()[0] if res.stdout else ""
                version_str = first_line
        except Exception:
            pass
            
    if _FFPROBE_PATH and os.path.exists(_FFPROBE_PATH):
        try:
            res = subprocess.run([_FFPROBE_PATH, "-version"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                ffprobe_ok = True
        except Exception:
            pass
            
    return {
        "ffmpeg_available": ffmpeg_ok,
        "ffmpeg_path": _FFMPEG_PATH,
        "ffprobe_available": ffprobe_ok,
        "ffprobe_path": _FFPROBE_PATH,
        "version": version_str
    }

def get_audio_duration(file_path: str | Path) -> float:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")
    
    # Try native wave module first for WAV files (extremely fast & zero process overhead)
    if path.suffix.lower() == ".wav":
        try:
            with contextlib.closing(wave.open(str(path), 'rb')) as w:
                frames = w.getnframes()
                rate = float(w.getframerate())
                if rate > 0:
                    return frames / rate
        except Exception:
            pass
            
    # Try ffprobe
    ffprobe = get_ffprobe_path()
    if ffprobe and os.path.exists(ffprobe):
        try:
            cmd = [
                ffprobe,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10, check=True)
            val = float(res.stdout.strip())
            return val
        except Exception:
            pass

    # Fallback to ffmpeg stderr duration parse
    ffmpeg = get_ffmpeg_path()
    try:
        cmd = [ffmpeg, "-i", str(path)]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        # Look for Duration: 00:00:05.12
        for line in res.stderr.splitlines():
            if "Duration:" in line:
                part = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = part.split(":")
                return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception as e:
        raise RuntimeError(f"Could not determine audio duration for {file_path}: {e}")

    return 3.0

def probe_media_file(file_path: str | Path) -> Dict[str, Any]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Media file not found: {file_path}")
        
    ffprobe = get_ffprobe_path()
    if not ffprobe:
        return {
            "size_bytes": path.stat().st_size,
            "filename": path.name,
            "exists": True
        }
        
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=15, check=True)
    return json.loads(res.stdout)
