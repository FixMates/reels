@echo off
cd /d "%~dp0"
if not exist .venv (
  echo Creating Python environment...
  py -3 -m venv .venv
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3.11 or 3.12 and tick "Add Python to PATH".
    pause
    exit /b 1
  )
)
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Starting PDF-to-Reels Engine...
echo Open http://127.0.0.1:8000 in your browser.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
