# AI Content-to-Video Studio Dockerfile (Mode B - Hosted Deployment)
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies: FFmpeg, TrueType fonts, ALSA
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    espeak-ng \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and pre-compiled frontend distribution
COPY backend/ ./backend/
COPY frontend/dist/ ./frontend/dist/

# Create persistent storage directories
RUN mkdir -p backend/storage/projects \
             backend/storage/exports \
             backend/storage/work \
             backend/storage/tts_cache \
             backend/storage/bgm

# Volume mount point for persistent SQLite DB and generated reels
VOLUME ["/app/backend/storage"]

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/api/health || exit 1

# Start FastAPI application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
