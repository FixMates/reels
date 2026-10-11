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

class SubtitleStyleConfig(BaseModel):
    burn_in: bool = True
    font_family: str = "Arial"
    font_size: int = 44
    text_color: str = "#FFFFFF"
    highlight_color: str = "#FACC15"  # vibrant yellow word highlight
    bg_color: str = "#000000"
    bg_opacity: float = 0.65
    position_y: str = "bottom"  # bottom, center, top
    max_chars_per_line: int = 34
    safe_margin_pct: float = 12.0
    mode: str = "sentence"  # sentence, word_highlight, none

class AudioSettingsConfig(BaseModel):
    bgm_filename: Optional[str] = None
    bgm_volume: float = 0.25
    narration_volume: float = 1.0
    enable_ducking: bool = True
    ducking_db: float = -14.0
    fade_duration: float = 1.0

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
