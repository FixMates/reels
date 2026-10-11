from pathlib import Path
from typing import List, Dict, Any, Tuple
from .ffmpeg_utils import get_audio_duration
from .subtitle_service import generate_scene_subtitles

def compute_timeline(
    scenes: List[Dict[str, Any]],
    end_padding_seconds: float = 0.7,
    default_scene_duration: float = 3.5,
    subtitle_style: Dict[str, Any] = None
) -> Dict[str, Any]:
    calculated_scenes = []
    current_time = 0.0
    all_subtitles = []
    
    style = subtitle_style or {}
    max_chars = int(style.get("max_chars_per_line", 34))
    is_word_mode = style.get("mode", "sentence") == "word_highlight"
    
    for idx, scene in enumerate(scenes):
        if not scene.get("is_included", True):
            continue
            
        audio_path = scene.get("audio_path")
        narration = (scene.get("narration_script") or "").strip()
        
        # Determine actual audio duration
        audio_dur = 0.0
        if audio_path and Path(audio_path).exists():
            try:
                audio_dur = get_audio_duration(audio_path)
            except Exception:
                audio_dur = 0.0
                
        # Scene duration logic:
        # If narration audio is present: duration = audio_duration + end_padding
        # Else: user configured scene_duration or default_scene_duration
        if audio_dur > 0:
            duration = round(audio_dur + end_padding_seconds, 3)
        else:
            duration = float(scene.get("scene_duration") or default_scene_duration)
            duration = max(1.5, duration)
            
        start_time = round(current_time, 3)
        end_time = round(current_time + duration, 3)
        
        # Generate subtitles for this scene
        scene_subs = []
        if narration and audio_dur > 0:
            scene_subs = generate_scene_subtitles(
                scene_start_time=start_time,
                audio_duration=audio_dur,
                narration_text=narration,
                max_chars=max_chars,
                word_highlight=is_word_mode
            )
            all_subtitles.extend(scene_subs)

        scene_entry = dict(scene)
        scene_entry["scene_order"] = idx
        scene_entry["start_time"] = start_time
        scene_entry["end_time"] = end_time
        scene_entry["duration"] = duration
        scene_entry["measured_audio_duration"] = round(audio_dur, 3)
        scene_entry["subtitles"] = scene_subs
        
        calculated_scenes.append(scene_entry)
        current_time += duration

    total_duration = round(current_time, 3)
    
    return {
        "scenes": calculated_scenes,
        "total_duration": total_duration,
        "subtitles": all_subtitles,
        "total_scenes": len(calculated_scenes)
    }
