import re
from pathlib import Path
from typing import List, Dict, Any, Optional

def format_timestamp_srt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

def format_timestamp_ass(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"

def hex_to_ass_color(hex_str: str, alpha: int = 0) -> str:
    # ASS uses &HAABBGGRR where AA is 00 (opaque) to FF (transparent)
    clean = hex_str.lstrip("#")
    if len(clean) == 3:
        clean = "".join([c*2 for c in clean])
    if len(clean) != 6:
        clean = "FFFFFF"
    r = clean[0:2]
    g = clean[2:4]
    b = clean[4:6]
    a = f"{alpha:02X}"
    return f"&H{a}{b}{g}{r}"

def chunk_text(text: str, max_chars: int = 34) -> List[str]:
    # Clean text
    clean = " ".join(text.strip().split())
    if not clean:
        return []
    
    # Split by strong sentence punctuation first
    sentence_tokens = re.split(r'([.?!]+)', clean)
    sentences = []
    i = 0
    while i < len(sentence_tokens):
        s = sentence_tokens[i].strip()
        if not s:
            i += 1
            continue
        punct = sentence_tokens[i+1].strip() if i+1 < len(sentence_tokens) else ""
        full_s = f"{s}{punct}".strip()
        sentences.append(full_s)
        i += 2

    chunks = []
    for sent in sentences:
        words = sent.split()
        curr_chunk = []
        curr_len = 0
        for w in words:
            if curr_len + len(w) + 1 <= max_chars or not curr_chunk:
                curr_chunk.append(w)
                curr_len += len(w) + 1
            else:
                chunks.append(" ".join(curr_chunk))
                curr_chunk = [w]
                curr_len = len(w)
        if curr_chunk:
            chunks.append(" ".join(curr_chunk))
            
    return chunks

def generate_scene_subtitles(
    scene_start_time: float,
    audio_duration: float,
    narration_text: str,
    max_chars: int = 34,
    word_highlight: bool = False
) -> List[Dict[str, Any]]:
    chunks = chunk_text(narration_text, max_chars)
    if not chunks:
        return []
        
    total_chars = sum(len(c) for c in chunks)
    if total_chars == 0:
        return []
        
    sub_entries = []
    current_time = scene_start_time
    # Leave slight pause at end of narration if audio is longer
    active_duration = min(audio_duration, max(0.8, audio_duration - 0.15))
    
    for chunk in chunks:
        # Proportion of active duration allocated to this chunk
        ratio = len(chunk) / total_chars
        chunk_duration = max(0.5, ratio * active_duration)
        chunk_start = current_time
        chunk_end = min(scene_start_time + audio_duration, current_time + chunk_duration)
        
        words = chunk.split()
        word_timings = []
        if word_highlight and words:
            w_time = chunk_start
            w_total_len = sum(len(w) for w in words)
            for w in words:
                w_ratio = len(w) / max(1, w_total_len)
                w_dur = max(0.12, w_ratio * (chunk_end - chunk_start))
                w_start = w_time
                w_end = min(chunk_end, w_time + w_dur)
                word_timings.append({
                    "word": w,
                    "start": round(w_start, 3),
                    "end": round(w_end, 3)
                })
                w_time = w_end
                
        sub_entries.append({
            "start": round(chunk_start, 3),
            "end": round(chunk_end, 3),
            "text": chunk,
            "words": word_timings,
            "timing_type": "estimated_proportional"
        })
        current_time = chunk_end
        
    return sub_entries

def export_subtitles_srt(subtitles: List[Dict[str, Any]], out_path: str | Path):
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for idx, sub in enumerate(subtitles, 1):
        lines.append(str(idx))
        start_str = format_timestamp_srt(sub["start"])
        end_str = format_timestamp_srt(sub["end"])
        lines.append(f"{start_str} --> {end_str}")
        lines.append(sub["text"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")

def export_subtitles_vtt(subtitles: List[Dict[str, Any]], out_path: str | Path):
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["WEBVTT", ""]
    for idx, sub in enumerate(subtitles, 1):
        start_str = format_timestamp_vtt(sub["start"])
        end_str = format_timestamp_vtt(sub["end"])
        lines.append(f"{start_str} --> {end_str}")
        lines.append(sub["text"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")

def export_subtitles_ass(
    subtitles: List[Dict[str, Any]],
    out_path: str | Path,
    width: int = 1080,
    height: int = 1920,
    style_config: Optional[Dict[str, Any]] = None
):
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    style = style_config or {}
    
    font_name = style.get("font_family", "Arial")
    font_size = int(style.get("font_size", 46))
    primary_col = hex_to_ass_color(style.get("text_color", "#FFFFFF"), 0)
    highlight_col = hex_to_ass_color(style.get("highlight_color", "#FACC15"), 0)
    bg_col = hex_to_ass_color(style.get("bg_color", "#000000"), int((1.0 - style.get("bg_opacity", 0.75)) * 255))
    outline_col = "&H00000000"
    
    pos_y = style.get("position_y", "bottom")
    alignment = 2  # bottom center
    margin_v = int(height * 0.14)
    if pos_y == "center":
        alignment = 5
        margin_v = 0
    elif pos_y == "top":
        alignment = 8
        margin_v = int(height * 0.14)
        
    margin_lr = int(width * 0.08)
    
    header = f"""[Script Info]
Title: AI Studio Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_col},{highlight_col},{outline_col},{bg_col},-1,0,0,0,100,100,0,0,3,10,3,{alignment},{margin_lr},{margin_lr},{margin_v},1
Style: Highlight,{font_name},{font_size},{highlight_col},{primary_col},{outline_col},{bg_col},-1,0,0,0,100,100,0,0,3,10,3,{alignment},{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    mode = style.get("mode", "sentence")
    
    for sub in subtitles:
        start_str = format_timestamp_ass(sub["start"])
        end_str = format_timestamp_ass(sub["end"])
        
        # Word highlight animation
        if mode == "word_highlight" and sub.get("words"):
            # Emit per word sub-segment highlighting current word
            for w_idx, w_item in enumerate(sub["words"]):
                w_start = format_timestamp_ass(w_item["start"])
                w_end = format_timestamp_ass(w_item["end"])
                # Construct sentence with highlighted word
                styled_parts = []
                for other_idx, other_item in enumerate(sub["words"]):
                    if other_idx == w_idx:
                        styled_parts.append(f"{{\\c{highlight_col}}}{other_item['word']}{{\\c{primary_col}}}")
                    else:
                        styled_parts.append(other_item['word'])
                styled_text = " ".join(styled_parts)
                events.append(f"Dialogue: 0,{w_start},{w_end},Default,,0,0,0,,{styled_text}")
        else:
            events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{sub['text']}")
            
    content = header + "\n".join(events) + "\n"
    path.write_text(content, encoding="utf-8")
