@echo off
setlocal enabledelayedexpansion

echo ===================================================================
echo     AI Content-to-Video Studio (Mobile & LAN Network Mode)
echo ===================================================================
echo.
echo [*] This mode allows you to control the studio from your smartphone
echo     or tablet connected to the SAME trusted home/office Wi-Fi.
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found on your PATH.
    echo Please install Python from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

echo [*] Initializing static FFmpeg and dependencies...
python -c "import static_ffmpeg; static_ffmpeg.add_paths()" >nul 2>nul

echo [*] Detecting your PC's Local Network IP address...
for /f "tokens=*" %%a in ('powershell -Command "Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress -First 1"') do set LAN_IP=%%a

if "%LAN_IP%"=="" (
    for /f "tokens=*" %%a in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress)[0]"') do set LAN_IP=%%a
)

echo.
echo ===================================================================
echo   HOW TO CONNECT FROM YOUR MOBILE PHONE:
echo.
echo   1. Connect your phone to the SAME Wi-Fi network as this PC.
echo   2. Open your phone's browser (Safari, Chrome, etc.).
echo   3. Navigate to:
echo.
if not "%LAN_IP%"=="" (
    echo       http://%LAN_IP%:8000
) else (
    echo       http://YOUR-PC-IP-ADDRESS:8000
)
echo.
echo   IMPORTANT NOTICE:
echo   - Do NOT enter "127.0.0.1" on your phone! 127.0.0.1 on a phone
echo     points to the phone itself, not this Windows computer.
echo   - If the page does not load, allow port 8000 through Windows Defender
echo     Firewall (Private Networks).
echo ===================================================================
echo.
echo [*] Starting Studio on 0.0.0.0:8000 (all network interfaces)...
echo [*] Local desktop access: http://127.0.0.1:8000

python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

pause
