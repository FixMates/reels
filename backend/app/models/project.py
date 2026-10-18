from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CropData(BaseModel):
    x: float = Field(default=0.0, ge=0.0, le=1.0)
    y: float = Field(default=0.0, ge=0.0, le=1.0)
    w: float = Field(default=1.0, ge=0.01, le=1.0)
    h: float = Field(default=1.0, ge=0.01, le=1.0)

class BrandingConfig(BaseModel):
    logo_path: Optional[str] = None
    logo_position: str = "top_center"  # top_center, top_left, top_right, watermark_bottom_right
    brand_name: str = ""
    handle: str = ""
    accent_color: str = "#38bdf8"
    font_family: str = "Arial"
    show_border: bool = True
    watermark_opacity: float = 0.85

class OverlayLayer(BaseModel):
    id: str
    type: str = "text"  # headline, heading, subtitle, text, callout, branding, cta
    text: str = ""
    # Normalized coordinates 0.0 to 1.0 (relative to canvas dimensions)
    x: float = 0.5
    y: float = 0.5
    w: Optional[float] = None  # Normalized width, e.g. 0.85
    h: Optional[float] = None
    align: str = "center"  # left, center, right
    valign: str = "middle"  # top, middle, bottom
    font_family: str = "Arial"
    font_size: int = 44  # Base point size at 1080p
    font_weight: str = "bold"  # normal, bold, 800, 900
    italic: bool = False
    underline: bool = False
    text_transform: str = "none"  # none, uppercase, lowercase, capitalize
    color: str = "#FFFFFF"
    opacity: float = 1.0
    bg_color: Optional[str] = None
    bg_opacity: float = 0.0
    bg_padding: int = 16
    bg_radius: int = 16
    outline_color: Optional[str] = None
    outline_width: int = 0
    shadow_color: Optional[str] = None
    shadow_blur: int = 0
    shadow_offset_y: int = 0
    rotation: float = 0.0
    z_index: int = 1
    is_locked: bool = False
    is_visible: bool = True
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    animation: Optional[str] = None

class CaptionSegment(BaseModel):
    id: str
    start: float
    end: float
    text: str
    words: Optional[List[Dict[str, Any]]] = None

class SubtitleStyleConfig(BaseModel):
    burn_in: bool = True
    font_family: str = "Arial"
    font_size: int = 44
    text_color: str = "#FFFFFF"
    highlight_color: str = "#FACC15"  # vibrant yellow word highlight
    inactive_color: str = "#FFFFFF"
    bg_color: str = "#000000"
    bg_opacity: float = 0.65
    position: str = "bottom"
    position_y: str = "bottom"  # bottom, center, top, custom
    # Free positioning coordinates (normalized)
    x: float = 0.5
    y: float = 0.72
    max_chars_per_line: int = 34
    safe_margin_pct: float = 12.0
    mode: str = "word_highlight"  # sentence, word_highlight, karaoke, none
    highlight_style: str = "word_color"  # word_color, karaoke_sweep, box_glow
    outline_color: str = "#000000"
    outline_width: int = 2

class AudioSettingsConfig(BaseModel):
    bgm_filename: Optional[str] = None
    bgm_volume: float = 0.25
    narration_volume: float = 1.0
    enable_ducking: bool = True
    ducking_db: float = -14.0
    duck_attack_ms: float = 80.0
    duck_release_ms: float = 350.0
    fade_duration: float = 1.0
    music_fade_in: float = 0.5
    music_fade_out: float = 1.5
    target_lufs: float = -16.0
    enable_limiter: bool = True
    audio_bitrate: str = "192k"

class SceneBase(BaseModel):
    scene_order: int = 0
    item_type: str = "image"
    source_filename: str = ""
    original_image_path: str
    thumbnail_path: str = ""
    page_number: Optional[int] = None
    crop: Optional[CropData] = None
    rotation: int = 0
    flip_h: bool = False
    fit_mode: str = "fit"  # fit, fill, blur_bg, card
    headline: str = ""
    caption: str = ""
    narration_script: str = ""
    voice_override: Optional[str] = None
    audio_path: Optional[str] = None
    measured_audio_duration: float = 0.0
    scene_duration: float = 3.5
    is_included: bool = True
    transition_override: Optional[str] = None
    layers: List[OverlayLayer] = []
    custom_segments: List[CaptionSegment] = []

class SceneUpdate(BaseModel):
    scene_order: Optional[int] = None
    crop: Optional[CropData] = None
    rotation: Optional[int] = None
    flip_h: Optional[bool] = None
    fit_mode: Optional[str] = None
    headline: Optional[str] = None
    caption: Optional[str] = None
    narration_script: Optional[str] = None
    voice_override: Optional[str] = None
    is_included: Optional[bool] = None
    scene_duration: Optional[float] = None
    transition_override: Optional[str] = None
    layers: Optional[List[Dict[str, Any]]] = None
    custom_segments: Optional[List[Dict[str, Any]]] = None

class SceneResponse(SceneBase):
    id: str
    project_id: str
    image_url: str = ""
    thumbnail_url: str = ""
    audio_url: Optional[str] = None

class ProjectCreate(BaseModel):
    title: str = "Untitled Video Project"
    aspect_ratio: str = "9:16"
    width: int = 1080
    height: int = 1920
    fps: int = 30
    voice_engine: str = "sapi"
    voice_id: str = ""

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    aspect_ratio: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[int] = None
    default_top_text: Optional[str] = None
    default_bottom_text: Optional[str] = None
    end_padding_seconds: Optional[float] = None
    default_scene_duration: Optional[float] = None
    voice_engine: Optional[str] = None
    voice_id: Optional[str] = None
    voice_rate: Optional[int] = None
    voice_volume: Optional[int] = None
    read_mode: Optional[str] = None
    branding: Optional[BrandingConfig] = None
    subtitle_style: Optional[SubtitleStyleConfig] = None
    audio_settings: Optional[AudioSettingsConfig] = None
    transition_type: Optional[str] = None
    transition_duration: Optional[float] = None
    ken_burns_enabled: Optional[bool] = None
    progress_bar_enabled: Optional[bool] = None
    pronunciation_dict: Optional[Dict[str, str]] = None

class ProjectResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    aspect_ratio: str
    width: int
    height: int
    fps: int
    default_top_text: str
    default_bottom_text: str
    end_padding_seconds: float
    default_scene_duration: float
    voice_engine: str
    voice_id: str
    voice_rate: int
    voice_volume: int
    read_mode: str
    branding: BrandingConfig
    subtitle_style: SubtitleStyleConfig
    audio_settings: AudioSettingsConfig
    transition_type: str
    transition_duration: float
    ken_burns_enabled: bool
    progress_bar_enabled: bool
    pronunciation_dict: Dict[str, str] = {}
    scenes: List[SceneResponse] = []
    total_scenes: int = 0
    total_duration: float = 0.0

class RenderJobRequest(BaseModel):
    burn_subtitles: bool = True
    export_srt: bool = True
    export_vtt: bool = True
    quality_preset: str = "veryfast"  # ultrafast, veryfast, faster, medium
    crf: int = 21

class RenderJobStatus(BaseModel):
    job_id: str
    project_id: str
    status: str  # pending, rendering, completed, failed, cancelled
    progress_pct: int
    stage: str
    message: str
    output_filename: Optional[str] = None
    download_url: Optional[str] = None
    video_duration: float = 0.0
    error: Optional[str] = None

