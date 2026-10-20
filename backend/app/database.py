import sqlite3
import json
import tempfile
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import re
from .config import STORAGE_DIR, MEDIA_BUCKET

DB_PATH = STORAGE_DIR / "studio.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
_SQLITE_LOCK = threading.RLock()
_DB_RESTORED = False


class _PersistentSQLiteConnection:
    def __init__(self, raw):
        self._raw = raw
        self._closed = False

    def __getattr__(self, name):
        return getattr(self._raw, name)

    def commit(self):
        self._raw.commit()
        try:
            _backup_sqlite_database(self._raw)
        except Exception:
            # A failed GCS snapshot must not leave the process-wide SQLite lock
            # held forever. The transaction is committed locally; callers will
            # see the persistence error and can report it.
            self.close()
            raise

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self._raw.close()
        finally:
            _SQLITE_LOCK.release()


def _restore_sqlite_database():
    global _DB_RESTORED
    if _DB_RESTORED or not MEDIA_BUCKET or DB_PATH.exists():
        _DB_RESTORED = True
        return
    from google.cloud import storage
    bucket = storage.Client().bucket(MEDIA_BUCKET)
    backup = bucket.blob("database/studio.db")
    if backup.exists():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        backup.download_to_filename(str(DB_PATH))
    _DB_RESTORED = True


def _backup_sqlite_database(connection):
    if not MEDIA_BUCKET:
        return
    from google.cloud import storage
    descriptor, temp_name = tempfile.mkstemp(prefix="studio-db-backup-", suffix=".db", dir=STORAGE_DIR)
    os.close(descriptor)
    try:
        with sqlite3.connect(temp_name) as snapshot:
            connection.backup(snapshot)
        storage.Client().bucket(MEDIA_BUCKET).blob("database/studio.db").upload_from_filename(
            temp_name, content_type="application/x-sqlite3"
        )
    finally:
        try:
            Path(temp_name).unlink(missing_ok=True)
        except OSError:
            pass


class _IndexedDict(dict):
    """Mapping row with sqlite-compatible positional indexing."""
    def __getitem__(self, key):
        if isinstance(key, int):
            key = tuple(self.keys())[key]
        return super().__getitem__(key)


class _PostgresCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=()):
        self._cursor.execute(re.sub(r"\?", "%s", query), params)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return _IndexedDict(row) if row is not None else None

    def fetchall(self):
        return [_IndexedDict(row) for row in self._cursor.fetchall()]


class _PostgresConnection:
    def __init__(self, raw):
        self._raw = raw

    def execute(self, query, params=()):
        cursor = self.cursor()
        return cursor.execute(query, params)

    def cursor(self):
        return _PostgresCursor(self._raw.cursor(row_factory=_postgres_row_factory))

    def commit(self):
        self._raw.commit()

    def close(self):
        self._raw.close()


def _postgres_row_factory(cursor):
    columns = [column.name for column in cursor.description]
    return lambda values: _IndexedDict(zip(columns, values))

def get_connection() -> sqlite3.Connection:
    if DATABASE_URL:
        import psycopg
        return _PostgresConnection(psycopg.connect(DATABASE_URL))
    _restore_sqlite_database()
    _SQLITE_LOCK.acquire()
    try:
        conn = sqlite3.connect(str(DB_PATH))
    except Exception:
        _SQLITE_LOCK.release()
        raise
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return _PersistentSQLiteConnection(conn)

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

    # Safe column migrations for both SQLite and Postgres.
    if DATABASE_URL:
        cursor.execute("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?", ("scenes",))
        scene_cols = [row["name"] for row in cursor.fetchall()]
        cursor.execute("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?", ("projects",))
        proj_cols = [row["name"] for row in cursor.fetchall()]
    else:
        cursor.execute("PRAGMA table_info(scenes)")
        scene_cols = [row["name"] for row in cursor.fetchall()]
        cursor.execute("PRAGMA table_info(projects)")
        proj_cols = [row["name"] for row in cursor.fetchall()]
    if "layers_json" not in scene_cols:
        cursor.execute("ALTER TABLE scenes ADD COLUMN layers_json TEXT DEFAULT '[]'")
    if "custom_segments_json" not in scene_cols:
        cursor.execute("ALTER TABLE scenes ADD COLUMN custom_segments_json TEXT DEFAULT '[]'")

    if "pronunciation_dict_json" not in proj_cols:
        cursor.execute("ALTER TABLE projects ADD COLUMN pronunciation_dict_json TEXT DEFAULT '{}'")

    # Safe migration for older project rows with empty or missing subtitle_style_json
    default_sub_json = json.dumps({
        "burn_in": True,
        "font_family": "Arial",
        "font_size": 44,
        "text_color": "#FFFFFF",
        "highlight_color": "#FACC15",
        "bg_color": "#000000",
        "bg_opacity": 0.65,
        "position": "bottom",
        "position_y": "bottom",
        "x": 0.5,
        "y": 0.72,
        "max_chars_per_line": 34,
        "safe_margin_pct": 12.0,
        "mode": "word_highlight",
        "highlight_style": "word_color",
        "outline_color": "#000000",
        "outline_width": 2
    })
    cursor.execute("""
        UPDATE projects 
        SET subtitle_style_json = ? 
        WHERE subtitle_style_json IS NULL OR subtitle_style_json = '' OR subtitle_style_json = '{}'
    """, (default_sub_json,))

    conn.commit()
    conn.close()

init_db()
