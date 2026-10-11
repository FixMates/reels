# PDF-to-Reels Engine (Local Windows)

A local-first starter app that converts selected PDF pages into vertical Instagram Reel MP4 videos with cropped page content, a logo, top/bottom text, and offline text-to-speech.

## Requirements
- Windows 10/11
- Python 3.11 or 3.12 (install from python.org; enable **Add Python to PATH**)
- FFmpeg installed and available on PATH (see below)

## Start
1. Extract this ZIP to a normal folder, e.g. `C:\PDFReels`.
2. Install FFmpeg:
   - Install from https://www.gyan.dev/ffmpeg/builds/ (essentials build), extract it, and add its `bin` folder to your Windows PATH.
   - Open a new Command Prompt and run `ffmpeg -version` to verify.
3. Double-click `run.bat`. First launch installs Python packages.
4. Open `http://127.0.0.1:8000` in Chrome or Edge.
5. Upload a PDF, select pages, drag on a page preview to crop, add logo and text, add narration for each page, then click **Render MP4**.

## Offline voice
The app uses `pyttsx3`, which uses the Windows built-in speech engine (SAPI) and needs no API key. Available voices depend on the voices installed in Windows. Voice quality can be more basic than cloud TTS.
You can add Windows voices from **Settings → Time & language → Speech**.

## How it works
- PDF pages are rendered locally using PyMuPDF.
- Crop selections are stored as relative coordinates per page.
- Pillow composes 1080x1920 vertical slides with logo, headline and footer.
- `pyttsx3` generates local WAV narration per slide.
- FFmpeg combines slides and narration into H.264/AAC MP4, timing each slide to its narration plus a short pause.

## Troubleshooting
- `ffmpeg is not recognized`: install FFmpeg and add the `bin` folder to PATH, then reopen the terminal.
- `py is not recognized`: install Python 3.11/3.12 and enable PATH.
- No speech/audio: check Windows text-to-speech voices in Settings.
- If the PDF is very large, start with a smaller PDF for the first test.
- This app binds to `127.0.0.1` only; it is not exposed to the internet.

## Notes
- Keep the app window/terminal open while rendering.
- Generated files are saved in the project's `output` folder and a download link is shown in the UI.
- This is a working MVP foundation. Crop, text, logo and narration are supported; transitions and advanced audio mixing can be added next.
