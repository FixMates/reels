import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
from .config import STORAGE_DIR

DB_PATH = STORAGE_DIR / "studio.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        aspect_ratio TEXT DEFAULT '9:16',
        width INTEGER DEFAULT 1080,
        height INTEGER DEFAULT 1920,
        fps INTEGER DEFAULT 30,
        default_top_text TEXT DEFAULT '',
        default_bottom_text TEXT DEFAULT '',
        end_padding_seconds REAL DEFAULT 0.7,
        default_scene_duration REAL DEFAULT 3.5,
        voice_engine TEXT DEFAULT 'sapi',
        voice_id TEXT DEFAULT '',
        voice_rate INTEGER DEFAULT 175,
        voice_volume INTEGER DEFAULT 100,
        read_mode TEXT DEFAULT 'narration_only',
        branding_json TEXT DEFAULT '{}',
        subtitle_style_json TEXT DEFAULT '{}',
        audio_settings_json TEXT DEFAULT '{}',
        transition_type TEXT DEFAULT 'cut',
        transition_duration REAL DEFAULT 0.5,
        ken_burns_enabled INTEGER DEFAULT 0,
        progress_bar_enabled INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        scene_order INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        source_filename TEXT DEFAULT '',
        original_image_path TEXT NOT NULL,
        thumbnail_path TEXT DEFAULT '',
        page_number INTEGER,
        crop_json TEXT DEFAULT NULL,
        rotation INTEGER DEFAULT 0,
        flip_h INTEGER DEFAULT 0,
        fit_mode TEXT DEFAULT 'fit',
        headline TEXT DEFAULT '',
        caption TEXT DEFAULT '',
        narration_script TEXT DEFAULT '',
        voice_override TEXT DEFAULT NULL,
        audio_path TEXT DEFAULT NULL,
        measured_audio_duration REAL DEFAULT 0.0,
        scene_duration REAL DEFAULT 3.5,
        is_included INTEGER DEFAULT 1,
        transition_override TEXT DEFAULT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        duration_seconds REAL DEFAULT 0.0,
        resolution TEXT DEFAULT '1080x1920',
        created_at TEXT NOT NULL,
        file_size_bytes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'success',
        error_message TEXT DEFAULT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS brand_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        preset_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    # Safe migration for older project rows with empty or missing subtitle_style_json
    default_sub_json = json.dumps({
        "burn_in": True,
        "font_family": "Arial",
        "font_size": 44,
        "text_color": "#FFFFFF",
        "highlight_color": "#FACC15",
        "bg_color": "#000000",
        "bg_opacity": 0.65,
        "position_y": "bottom",
        "max_chars_per_line": 34,
        "safe_margin_pct": 12.0,
        "mode": "word_highlight"
    })
    cursor.execute("""
        UPDATE projects 
        SET subtitle_style_json = ? 
        WHERE subtitle_style_json IS NULL OR subtitle_style_json = '' OR subtitle_style_json = '{}'
    """, (default_sub_json,))

    conn.commit()
    conn.close()

init_db()
