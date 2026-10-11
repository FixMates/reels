@echo off
setlocal enabledelayedexpansion

echo ===================================================================
echo     AI Content-to-Video Studio (Desktop Windows Edition)
echo ===================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found on your PATH.
    echo Please install Python 3.11 or 3.12 from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

echo [*] Checking Python dependencies...
python -m pip install -q -r requirements.txt

echo [*] Initializing static FFmpeg and FFprobe binaries...
python -c "import static_ffmpeg; static_ffmpeg.add_paths()" >nul 2>nul

echo [*] Verifying system health...
python -c "from backend.app.services.ffmpeg_utils import check_ffmpeg_available; h=check_ffmpeg_available(); print('    FFmpeg ready:', h['ffmpeg_available'])"

echo.
echo [*] Starting Studio Web Server on http://127.0.0.1:8000 ...
echo [*] Opening Studio in your default browser...
start "" "http://127.0.0.1:8000"

python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

pause
