# AI Content-to-Video Studio (Desktop Windows Application)

A complete, production-grade, local-first Windows desktop web application that converts **PDF documents, individual images, and collections of images** into professional vertical videos with offline AI-generated narration, synchronized captions, transitions, branding, and background music with audio ducking.

---

## 1. Architectural Highlights & Improvements over Reference Prototype

The starter reference (`pdf_to_reels_engine`) provided a basic proof-of-concept with major limitations:
- **In-Memory Registry**: All projects and state were lost on server restart.
- **Single PDF Only**: Could not import standalone JPG, PNG, or WebP images; could not mix PDFs with images.
- **Monolithic UI**: Single basic HTML file with no timeline, no multi-track visualization, and no individual item workflow.
- **No Background Video Pipeline**: Blocking endpoint that timed out on longer videos; no progress percentage, no stage tracking, no cancellation.
- **No Real Audio Synchronization**: Did not generate SRT/VTT subtitles, lacked word-level highlight animation, and lacked audio ducking.

### What was built:
1. **Modular Multi-Tier Architecture**:
   - Clean separation of concerns: `backend/app/services/` (`pdf_service`, `image_service`, `tts_service`, `subtitle_service`, `timeline_service`, `audio_mixer`, `video_renderer`, `project_service`).
   - SQLite persistent database (`backend/storage/studio.db`) tracking projects, scenes, export history, and branding presets.
2. **Modern Desktop Studio Interface**:
   - Built with React, Vite, TypeScript, and Tailwind CSS.
   - 8-step guided studio workflow: Media Browser, Item-by-Item Caption Editor, Crop & Layout Framing, Timeline Lane Visualizer, Captions & Subtitles Engine, Channel Branding, Audio Mixer & Ducking, and Video Export Player.
3. **Audio-Driven Scene Duration & Timing Pipeline**:
   - Actual duration of generated local voiceovers measured using FFprobe / wave analysis.
   - Scene duration dynamically computed as: `narration duration + end padding`.
   - Timestamps for subtitles and scene transitions precisely locked to speech boundaries.
4. **Local Speech (Zero Paid APIs)**:
   - Windows uses installed SAPI voices (`pyttsx3`); Linux and Render use eSpeak NG, which is installed in the Docker image.
   - The voice panel discovers engines available on the running server and reports missing engines instead of showing a fake fallback voice.
   - Voice speed (WPM) and volume adjustments.
   - Audio caching to prevent redundant synthesis.
   - Support for custom audio file overrides per scene.
5. **Burned-in High-Retention Subtitles**:
   - Supports both **Word-Highlight Mode** (high-retention TikTok/Reels style with active word color illumination) and **Sentence Mode**.
   - Dual export to `.srt` and `.vtt` subtitles alongside `.mp4`.
   - Customizable fonts, font sizes, text colors, highlight colors, background opacity, and vertical safe margins.
6. **Social Media Safe Zone Guides**:
   - Interactive overlays showing exact bounding boxes for Instagram Reels, TikTok, and YouTube Shorts UI controls (like/comment buttons, handle ticker).
7. **Broadcast Audio Mixing**:
   - Background music mixing with FFmpeg `sidechaincompress` audio ducking (-14 dB attenuation while narration speaks).
   - End fade-out and volume leveling.

---

## 2. System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Python**: Python 3.11, 3.12, 3.13, or 3.14 (with `pip`)
- **Node.js**: Node.js 18+ (bundled with `npm` for building frontend; pre-compiled `dist/` is also bundled)
- **FFmpeg**: Bundled and auto-configured via `static-ffmpeg` and Gyan FFmpeg essentials build.

---

## 3. Quickstart & Windows Launch

### Automated Gemini Video Generation
From the dashboard, choose **Create Reel with Gemini**, enter a topic, and start the workflow. Gemini creates a grounded seven-scene script and seven 9:16 scene images. The server fits images to exactly 1080 × 1920, adds editable top headlines and supporting captions, generates narration with the installed local TTS engine, and renders an MP4 with burned-in subtitles. The result opens in the studio for edits; the MP4 and copy package are available from the completion screen and project folder.

Configure `GEMINI_API_KEY` on the server. For local use, copy `.env.example` to `.env` and paste the key in that file. For Cloud Run, store it in Secret Manager as `gemini-api-key` and grant the Cloud Run service identity access. The key stays server-side and is never entered into the browser. Optional `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL` settings are documented in `.env.example`.

### Firebase production deployment

The Firebase deployment uses Firebase Hosting for the React app and Cloud Run for the FastAPI renderer. It stores project media and exports in a Cloud Storage bucket. The deployment script creates or reuses the dedicated `reels-studio` Hosting site, so it does not replace the project's existing default Hosting site.

1. Install and authenticate the Google Cloud CLI and Firebase CLI (`gcloud auth login` and `firebase login`).
2. In Google Cloud Console, enable Secret Manager for the project, create a secret named `gemini-api-key`, and add the Gemini API key as its latest version. Do not commit the key or put it in the deployment script.
3. From the repository root, run `./firebase-deploy.ps1 -ProjectId earner-paytm-cash` in PowerShell.
4. Open `https://reels-studio.web.app` after both Cloud Run and Hosting deploy successfully.

Cloud Run is configured with one always-on instance because render progress and jobs currently live in process memory. This improves job stability but incurs ongoing Cloud Run, Cloud Storage, and Gemini API charges. The app currently has no sign-in; restrict access before sharing the public URL broadly.

The process uses one text generation, seven image generations, local narration, and one render. Gemini API usage can incur charges. The app's job progress is held in server memory while processing; a server restart interrupts an active job. This app has no sign-in, so put a public deployment behind access control before enabling the generation endpoint.

### Option A: Launch with 1-Click Batch Script
Double-click `launch_studio.bat` in the project root:
```bat
launch_studio.bat
```
This automatically:
1. Verifies Python and installs any missing packages from `requirements.txt`.
2. Initializes portable FFmpeg / FFprobe binaries.
3. Launches the FastAPI backend server on `http://127.0.0.1:8000`.
4. Automatically opens `http://127.0.0.1:8000` in your default browser.

### Option B: Manual Command Line Launch
1. Install dependencies:
   ```cmd
   pip install -r requirements.txt
   ```
2. Start the server:
   ```cmd
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```
3. Open `http://127.0.0.1:8000` in Chrome, Edge, or Brave.

---

## 4. Complete Application Workflow

### Step 1: Project Creation (Dashboard & Wizard)
- Click **Create New Project**.
- Choose your aspect ratio:
  - **9:16 Vertical (1080 × 1920)** — Default for Instagram Reels, TikTok, YouTube Shorts.
  - **16:9 Landscape (1920 × 1080)** — For YouTube Desktop.
  - **1:1 Square (1080 × 1080)** — For Instagram Feed.
  - **4:5 Portrait (1080 × 1350)** — For Feed Portrait.

### Step 2: Media Import (Sheet Browser)
- Upload a multi-page PDF (e.g. `sample_assets/trading_cheat_sheet.pdf`).
- Upload individual or batches of images (e.g. `sample_assets/slide_1.png` through `slide_5.png`).
- Reorder slides using Move Left / Move Right buttons.
- Rotate slides (+90°), flip horizontally, duplicate, or delete.

### Step 3: Item-by-Item Caption & Narration Workflow (CRITICAL)
- Guided single-item editor with stepper (`Slide 1 of 5`, Previous / Next).
- Enter **Top Headline** (punchy bold hook badge).
- Enter **Bottom Caption** (optional permanent footer).
- Enter **Spoken AI Narration Script** (e.g., *"Rule 1: Always check for high-timeframe liquidity sweep before looking for entries."*).
- Real-time word count and estimated speech duration counter.
- Discrepancy warning alerts you if caption and narration differ significantly.
- Click **Generate Voice for Slide** to synthesize local speech and preview with the built-in waveform player.
- Optional bulk button to apply the current branding / footer to all slides.

### Step 4: Crop & Visual Framing
- Interactive crop box with aspect ratio presets (Freeform, 9:16, 1:1, 16:9).
- Framing modes:
  - **Fit (Ambient Blur)**: Sharp centered visual over an ambient blurred background.
  - **Fill**: Cover canvas without distortion.
  - **Card**: Floating card with border and shadow on dark gradient background.
- Toggle **Reels Safe Guides** to verify captions don't collide with social media like buttons.

### Step 5: Subtitle & Caption Engine
- Choose between **Word Highlight Mode** (words light up dynamically in bright yellow/cyan as spoken) or **Sentence Block Mode**.
- Customize font family, font size, primary text color, highlight color, background box opacity, and safe margins.

### Step 6: Branding & Templates
- Upload channel logo (transparent PNG supported) and choose placement (Top Center, Top Left, Top Right).
- Add channel name and social handle (e.g., `@apex_trader`).
- Select brand accent colors or 1-click templates (*Trading Breakdown, Educational Explainer, Product Showcase, Minimalist Quote*).

### Step 7: Audio Mixing & Ducking
- Adjust narration voiceover volume (0% to 200%).
- Select or upload background music (e.g. `sample_assets/sample_ambient_bgm.wav`).
- Enable **Automatic Audio Ducking**: BGM volume dynamically drops by -14 dB whenever the voice speaks and swells back during pauses.

### Step 8: Multi-Track Timeline & Video Export
- Inspect the 4-track visual timeline: Visual Slides, Voiceover Clips, Captions, and BGM.
- Select encoding quality preset (`ultrafast`, `veryfast`, `medium`).
- Click **Render MP4 Reel Now**.
- Watch real-time progress percentage and stage logs.
- Preview the finalized MP4 in the studio player.
- Direct download buttons for `.mp4`, `.srt`, and `.vtt` files.

---

## 5. Automated Acceptance Test Results

All 18 automated tests passed successfully with 100% pass rate:

| Test File | Test Suite | Description | Result |
| :--- | :--- | :--- | :--- |
| `test_pdf_import.py` | Test 1 | Multi-page PDF page extraction, order, and thumbnail rendering | **PASSED** |
| `test_crop_coordinates.py` | Test 4 | Normalized crop coordinates, rotation, flip, and canvas composition | **PASSED** |
| `test_tts.py` | Test 5 | Local SAPI speech generation without API keys or internet | **PASSED** |
| `test_timing.py` | Test 6 | Audio duration measurement, scene duration = audio + padding | **PASSED** |
| `test_subtitles.py` | Test 7 | SRT, WebVTT, and ASS generation, timestamps within duration | **PASSED** |
| `test_audio_mixer.py` | Test 8 | Audio clip padding, BGM mixing, and sidechain ducking | **PASSED** |
| `test_video_export.py` | Test 9 | Full video rendering, FFprobe stream validation (1080x1920, h264/aac) | **PASSED** |
| `test_acceptance.py` | Tests 1-11 | Comprehensive end-to-end acceptance suite covering all 11 criteria | **PASSED** |

To re-run the full automated test suite:
```cmd
python -m pytest tests -v
```
or double-click:
```bat
run_tests.bat
```

---

## 6. Project Structure

```
c:/Users/Sundar/Desktop/tool/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── projects.py         # Project & scene CRUD, reordering
│   │   │   ├── media.py            # PDF & image batch upload, BGM, streaming
│   │   │   ├── tts.py              # Voice discovery, scene synthesis, preview
│   │   │   ├── render.py           # Background render queue, progress, downloads
│   │   │   └── system.py           # System diagnostics & storage management
│   │   ├── models/
│   │   │   └── project.py          # Pydantic data schemas
│   │   ├── services/
│   │   │   ├── ffmpeg_utils.py     # FFmpeg discovery, probes, duration utils
│   │   │   ├── pdf_service.py      # PyMuPDF rendering & text extraction
## 5. Mobile & Network Access (Mode A)

You can operate the studio comfortably from your smartphone or tablet (iOS Safari, Android Chrome):

1. Double-click `launch_studio_lan.bat`:
   ```bat
   launch_studio_lan.bat
   ```
2. The script detects your PC's Wi-Fi / Local Area Network IP (e.g. `192.168.1.45`) and binds to `0.0.0.0:8000`.
3. Connect your mobile phone to the **same Wi-Fi network**.
4. Open `http://<YOUR_PC_IP>:8000` in your mobile browser.
5. **Notice:** Do not enter `127.0.0.1` on your phone! On a phone, `127.0.0.1` refers to the phone itself, not the Windows PC.
6. **Firewall:** If the connection times out, ensure Windows Defender Firewall allows inbound traffic on port 8000 for Private Networks.

The UI automatically adapts to mobile viewports (320px to 430px) with touch-friendly sliders, collapsible canvas preview, mobile card timeline, and quick-jump navigation.

---

## 6. Hosted Deployment (Mode B)

For Linux and cloud container hosting (Docker, AWS ECS, Railway, DigitalOcean):

```bash
# Build and run with Docker Compose (includes persistent volume for DB & media)
docker-compose up -d --build
```

### Important Technical Considerations for Hosted Mode:
- **TTS:** Windows SAPI is Windows-only. The provided Docker image installs eSpeak NG for Linux and Render, and existing projects that still say SAPI automatically use eSpeak NG on Linux. eSpeak NG is a lighter, more robotic voice than neural services; Piper can be used when its runtime and voice model are installed.
- **Storage Persistence:** A persistent volume (`studio-data` mounted at `/app/backend/storage`) is required so SQLite projects, uploaded PDFs, and exported MP4s survive container redeployments.
- **Background Renders:** The application utilizes background task rendering and status polling (`/api/render/status/{job_id}`) to ensure lengthy FFmpeg exports do not hit HTTP request timeouts.

### Render setup

Create a **Web Service** from this GitHub repository, select the **Docker** runtime, and build from the repository root so Render uses `Dockerfile`. Attach a persistent disk at `/app/backend/storage`, then deploy. After each push to the connected branch, Render rebuilds the Docker image and redeploys it. The Health / Diagnostics panel should show `eSpeak NG: Ready` on the Linux host. If it says `Not installed`, confirm the service is using the Docker runtime and redeploy the latest commit.

The app currently has no user sign-in. Keep a public deployment behind an access-control layer until authentication is added; uploaded media and project exports are otherwise reachable through the app's API.

### Firebase Hosting and Cloud Run

Firebase Hosting serves the React frontend; Cloud Run runs the Python/FastAPI, FFmpeg, and TTS backend. The Firebase Hosting rewrite in `firebase.json` connects `/api/**` to the `reels-api` Cloud Run service. `firebase-deploy.ps1` builds and deploys both parts, and uses the Cloud Run URL directly for API and media calls so uploads and MP4 downloads do not pass through Hosting's 60-second proxy timeout.

Prerequisites: a selected Firebase project on the Blaze plan, Firebase CLI, Google Cloud CLI, Cloud Run and Cloud Build APIs enabled, and a Secret Manager secret named `gemini-api-key`. After setting up the project and secret, deploy with:

```powershell
gcloud auth login
firebase login
.\firebase-deploy.ps1 -ProjectId YOUR_FIREBASE_PROJECT_ID
```

**Storage migration is required before production use.** This app stores SQLite and project/media files under `backend/storage`. Cloud Run's local filesystem is ephemeral, and Cloud Storage volume mounts do not support SQLite locking. The current Firebase deployment script is for setup/validation; migrate metadata to a managed database and media/exports to durable object storage before storing production projects.

---

## 7. Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── api/                    # FastAPI routes (projects, media, tts, render, exports, health)
│   │   ├── services/
│   │   │   ├── pdf_service.py      # PyMuPDF rasterization & text extraction
│   │   │   ├── image_service.py    # Pillow slide composition, fit modes, crops
│   │   │   ├── tts_service.py      # Local Windows SAPI & Piper TTS engine
│   │   │   ├── subtitle_service.py # SRT, WebVTT, ASS styling & word highlights
│   │   │   ├── timeline_service.py # Timeline synchronization & duration logic
│   │   │   ├── audio_mixer.py      # Duration padding, BGM mix, audio ducking
│   │   │   ├── video_renderer.py   # Async background rendering & FFprobe verify
│   │   │   └── project_service.py  # SQLite persistence & storage handlers
│   │   ├── config.py               # Canonical paths & directories
│   │   ├── database.py             # SQLite database connection & schema
│   │   └── main.py                 # FastAPI application & static mount
│   └── storage/
│       ├── studio.db               # SQLite database
│       ├── projects/               # Local project assets & manifests
│       ├── exports/                # Exported MP4, SRT, VTT files
│       ├── tts_cache/              # SHA-256 hashed audio cache
│       ├── bgm/                    # Background music library
│       └── work/                   # Temporary render scratch workspaces
├── frontend/
│   ├── src/
│   │   ├── components/             # Navbar, ErrorBoundary, SafeZoneOverlay, AudioWaveformPlayer, SystemHealthModal
│   │   ├── editor/                 # MediaBrowser, ItemCaptionEditor, Crop, Voice, Subtitles, Branding, Audio, Timeline, Export
│   │   ├── pages/                  # DashboardPage, StudioPage, NewProjectModal
│   │   ├── types/                  # TypeScript interfaces
│   │   ├── api/client.ts           # Typed API client
│   │   ├── App.tsx                 # Root application state & navigation
│   │   ├── main.tsx                # React DOM entrypoint
│   │   └── index.css               # Design system & dark mode tokens
│   ├── dist/                       # Pre-compiled production bundle
│   ├── package.json
│   └── vite.config.ts
├── sample_assets/                  # Non-copyright test assets (PDF, 5 slides, logo, BGM)
├── tests/                          # 22 automated unit & regression tests
├── Dockerfile                      # Production Docker container
├── docker-compose.yml              # Multi-container / persistent storage orchestration
├── launch_studio.bat               # Windows local desktop startup script (127.0.0.1)
├── launch_studio_lan.bat           # Windows Wi-Fi LAN mobile startup script (0.0.0.0)
├── run_tests.bat                   # Test runner script
├── requirements.txt                # Python dependencies
├── .env.example                    # Configuration template
└── .gitignore                      # Git exclusion rules
```

---

## 8. Known Limitations & Technical Details

1. **Local TTS Voice Quality**:
   - Windows uses Windows SAPI voices (`pyttsx3`); Linux hosts such as Render use eSpeak NG from the Docker image.
   - Voice quality depends on the installed engine. eSpeak NG is compact and offline but sounds more synthetic than neural voices. Custom recorded audio can be attached directly to any slide as a fallback.
2. **Word-Level Subtitle Alignment**:
   - With local engines that do not provide word timings, subtitle timestamps are proportionally estimated from measured audio duration and punctuation cadence.
3. **Render Times**:
   - Render times depend on CPU core count. The studio defaults to `-preset veryfast` for rapid compilation. Use `ultrafast` for near-instant preview rendering.

