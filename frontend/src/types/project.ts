export interface CropData {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BrandingConfig {
  logo_path?: string | null;
  logo_position?: 'top_center' | 'top_left' | 'top_right' | 'watermark_bottom_right';
  brand_name?: string;
  handle?: string;
  accent_color?: string;
  font_family?: string;
  show_border?: boolean;
  watermark_opacity?: number;
}

export interface SubtitleStyleConfig {
  burn_in: boolean;
  font_family: string;
  font_size: number;
  text_color: string;
  highlight_color: string;
  bg_color: string;
  bg_opacity: number;
  position_y: 'bottom' | 'center' | 'top';
  max_chars_per_line: number;
  safe_margin_pct: number;
  mode: 'sentence' | 'word_highlight' | 'none';
}

export interface AudioSettingsConfig {
  bgm_filename?: string | null;
  bgm_volume: number;
  narration_volume: number;
  enable_ducking: boolean;
  ducking_db: number;
  fade_duration: number;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_order: number;
  item_type: 'pdf_page' | 'image';
  source_filename: string;
  original_image_path: string;
  thumbnail_path?: string;
  page_number?: number | null;
  crop?: CropData | null;
  rotation: number;
  flip_h: boolean;
  fit_mode: 'fit' | 'fill' | 'blur_bg' | 'card';
  headline: string;
  caption: string;
  narration_script: string;
  voice_override?: string | null;
  audio_path?: string | null;
  measured_audio_duration: number;
  scene_duration: number;
  is_included: boolean;
  transition_override?: string | null;
  image_url: string;
  thumbnail_url: string;
  audio_url?: string | null;
  // Computed on timeline
  start_time?: number;
  end_time?: number;
  duration?: number;
  subtitles?: any[];
}

export interface Project {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  aspect_ratio: '9:16' | '16:9' | '1:1' | '4:5';
  width: number;
  height: number;
  fps: number;
  default_top_text: string;
  default_bottom_text: string;
  end_padding_seconds: number;
  default_scene_duration: number;
  voice_engine: string;
  voice_id: string;
  voice_rate: number;
  voice_volume: number;
  read_mode: string;
  branding: BrandingConfig;
  subtitle_style: SubtitleStyleConfig;
  audio_settings: AudioSettingsConfig;
  transition_type: string;
  transition_duration: number;
  ken_burns_enabled: boolean;
  progress_bar_enabled: boolean;
  scenes: Scene[];
  total_scenes: number;
  total_duration: number;
}

export interface TTSVoice {
  id: string;
  name: string;
  engine: 'sapi' | 'piper';
  language: string;
  gender: string;
  is_default: boolean;
  is_installed: boolean;
  quality: string;
}

export interface RenderStatus {
  job_id: string;
  project_id: string;
  status: 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress_pct: number;
  stage: string;
  message: string;
  output_filename?: string | null;
  download_url?: string | null;
  video_duration: number;
  error?: string | null;
}

export interface SystemHealth {
  status: string;
  ffmpeg: {
    ffmpeg_available: boolean;
    ffmpeg_path: string;
    ffprobe_available: boolean;
    ffprobe_path: string;
    version: string;
  };
  tts: {
    voices_count: number;
    sapi_available: boolean;
    piper_available: boolean;
    voices: TTSVoice[];
  };
  storage: {
    projects_count: number;
    scenes_count: number;
    exports_count: number;
    total_storage_bytes: number;
    temp_storage_bytes: number;
    cache_storage_bytes: number;
    exports_storage_bytes: number;
  };
  platform: {
    os: string;
    os_release: string;
    python_version: string;
  };
}

export interface ExportRecord {
  id: string;
  project_id: string;
  project_title?: string;
  filename: string;
  file_path: string;
  duration_seconds: number;
  resolution: string;
  created_at: string;
  file_size_bytes: number;
  status: string;
  error_message?: string;
  download_url?: string;
}
