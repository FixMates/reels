import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

from .ffmpeg_utils import get_ffmpeg_path, get_audio_duration

def create_padded_audio_clip(
    input_audio: Optional[str | Path],
    target_duration: float,
    output_path: str | Path
) -> str:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = get_ffmpeg_path()
    
    # If no input audio or file doesn't exist, create pure silence of target_duration
    if not input_audio or not Path(input_audio).exists():
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
            "-t", f"{target_duration:.3f}",
            "-c:a", "pcm_s16le", str(out_p)
        ]
        subprocess.run(cmd, check=True)
        return str(out_p)
        
    actual_dur = get_audio_duration(input_audio)
    padding_needed = max(0.0, target_duration - actual_dur)
    
    if padding_needed > 0.01:
        # Pad with silence at the end using apad and atrim to target_duration
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", str(input_audio),
            "-af", f"apad,atrim=0:{target_duration:.3f}",
            "-c:a", "pcm_s16le", str(out_p)
        ]
        subprocess.run(cmd, check=True)
    else:
        # Audio is equal or longer, trim exactly to target_duration
        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", str(input_audio),
            "-af", f"atrim=0:{target_duration:.3f}",
            "-c:a", "pcm_s16le", str(out_p)
        ]
        subprocess.run(cmd, check=True)
        
    return str(out_p)

def mix_master_audio(
    scene_audio_files: List[str],
    total_duration: float,
    output_path: str | Path,
    bgm_path: Optional[str | Path] = None,
    narration_vol: float = 1.0,
    bgm_vol: float = 0.25,
    enable_ducking: bool = True,
    ducking_db: float = -14.0,
    fade_duration: float = 1.0,
    ducking_attack_ms: float = 80.0,
    ducking_release_ms: float = 350.0,
    target_lufs: Optional[float] = -16.0,
    enable_limiter: bool = True
) -> str:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = get_ffmpeg_path()
    
    # Step 1: Concatenate scene audio files into a unified narration track
    concat_list = out_p.parent / "narration_concat.txt"
    concat_content = "".join(f"file '{Path(p).as_posix().replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'\n" for p in scene_audio_files)
    concat_list.write_text(concat_content, encoding="utf-8")
    
    narr_unified = out_p.parent / "narration_unified.wav"
    cmd_concat = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "pcm_s16le",
        str(narr_unified)
    ]
    subprocess.run(cmd_concat, check=True)

    # Post-processing chain (loudness normalization and peak limiter)
    post_chain = []
    if target_lufs is not None:
        post_chain.append(f"loudnorm=I={target_lufs:.1f}:TP=-1.5:LRA=11")
    if enable_limiter:
        post_chain.append("alimiter=limit=0.95:attack=5:release=50")

    # Step 2: Mix with BGM if provided and exists
    if bgm_path and Path(bgm_path).exists():
        fade_st = max(0.0, total_duration - fade_duration)
        att = max(10.0, float(ducking_attack_ms))
        rel = max(50.0, float(ducking_release_ms))
        
        # Audio filter graph with sidechain ducking and volume adjustments
        if enable_ducking:
            filter_graph = (
                f"[0:a]volume={narration_vol:.2f},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[narr];"
                f"[1:a]volume={bgm_vol:.2f},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[bgm_in];"
                f"[bgm_in][narr]sidechaincompress=threshold=0.07:ratio=6:attack={att:.0f}:release={rel:.0f}[ducked_bgm];"
                f"[narr][ducked_bgm]amix=inputs=2:duration=first:dropout_transition=2[mixed];"
                f"[mixed]afade=t=out:st={fade_st:.2f}:d={fade_duration:.2f}"
            )
        else:
            filter_graph = (
                f"[0:a]volume={narration_vol:.2f}[narr];"
                f"[1:a]volume={bgm_vol:.2f}[bgm_in];"
                f"[narr][bgm_in]amix=inputs=2:duration=first:dropout_transition=2[mixed];"
                f"[mixed]afade=t=out:st={fade_st:.2f}:d={fade_duration:.2f}"
            )
            
        if post_chain:
            filter_graph += "," + ",".join(post_chain)
        filter_graph += "[outa]"
            
        cmd_mix = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", str(narr_unified),
            "-stream_loop", "-1", "-i", str(bgm_path),
            "-filter_complex", filter_graph,
            "-map", "[outa]",
            "-t", f"{total_duration:.3f}",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
            str(out_p)
        ]
        subprocess.run(cmd_mix, check=True)
    else:
        solo_filters = [f"volume={narration_vol:.2f}"]
        if post_chain:
            solo_filters.extend(post_chain)
            
        cmd_solo = [
            ffmpeg, "-y", "-loglevel", "error",
            "-i", str(narr_unified),
            "-af", ",".join(solo_filters),
            "-t", f"{total_duration:.3f}",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
            str(out_p)
        ]
        subprocess.run(cmd_solo, check=True)
        
    return str(out_p)
