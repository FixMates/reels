import os
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

def get_system_font(size: int = 36, bold: bool = True, italic: bool = False, family: str = "Segoe UI") -> ImageFont.ImageFont:
    font_candidates = []
    fam_lower = family.lower() if family else "segoe ui"
    if os.name == "nt":
        windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
        fonts_dir = windir / "Fonts"
        if "arial" in fam_lower:
            suffix = "bi.ttf" if (bold and italic) else ("bd.ttf" if bold else ("i.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"arial{suffix}")
        elif "impact" in fam_lower:
            font_candidates.append(fonts_dir / "impact.ttf")
        elif "calibri" in fam_lower:
            suffix = "z.ttf" if (bold and italic) else ("b.ttf" if bold else ("i.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"calibri{suffix}")
        elif "georgia" in fam_lower:
            suffix = "z.ttf" if (bold and italic) else ("b.ttf" if bold else ("i.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"georgia{suffix}")
        elif "times" in fam_lower:
            suffix = "bi.ttf" if (bold and italic) else ("bd.ttf" if bold else ("i.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"times{suffix}")
        elif "trebuchet" in fam_lower:
            suffix = "bi.ttf" if (bold and italic) else ("bd.ttf" if bold else ("it.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"trebuc{suffix}")
        else:
            suffix = "z.ttf" if (bold and italic) else ("b.ttf" if bold else ("i.ttf" if italic else ".ttf"))
            font_candidates.append(fonts_dir / f"segoeui{suffix}")
            
        if bold:
            font_candidates += [fonts_dir / "segoeuib.ttf", fonts_dir / "arialbd.ttf", fonts_dir / "calibrib.ttf"]
        else:
            font_candidates += [fonts_dir / "segoeui.ttf", fonts_dir / "arial.ttf", fonts_dir / "calibri.ttf"]
            
    for p in font_candidates:
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:
                pass
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()

def process_uploaded_image(src_path: str | Path, output_dir: str | Path, prefix: str = "img") -> Dict[str, Any]:
    src = Path(src_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with Image.open(src) as img:
        # Normalize EXIF orientation
        img = ImageOps.exif_transpose(img) or img
        rgb_img = img.convert("RGB")
        
        orig_filename = f"{prefix}_orig.png"
        thumb_filename = f"{prefix}_thumb.png"
        orig_path = out_dir / orig_filename
        thumb_path = out_dir / thumb_filename
        
        rgb_img.save(orig_path, format="PNG")
        
        thumb = rgb_img.copy()
        thumb.thumbnail((400, 400))
        thumb.save(thumb_path, format="PNG")
        
        return {
            "image_filename": orig_filename,
            "image_path": str(orig_path),
            "thumbnail_filename": thumb_filename,
            "thumbnail_path": str(thumb_path),
            "width": rgb_img.width,
            "height": rgb_img.height
        }

def wrap_text_to_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines = []
    current_line = ""
    for word in words:
        candidate = f"{current_line} {word}".strip() if current_line else word
        bbox = draw.textbbox((0, 0), candidate, font=font)
        line_w = bbox[2] - bbox[0]
        if line_w <= max_width:
            current_line = candidate
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    if current_line:
        lines.append(current_line)
    return lines

def hex_to_rgb(hex_str: str, default: Tuple[int, int, int] = (56, 189, 248)) -> Tuple[int, int, int]:
    try:
        hex_str = hex_str.lstrip("#")
        if len(hex_str) == 6:
            return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
        if len(hex_str) == 3:
            return tuple(int(hex_str[i]*2, 16) for i in range(3))
    except Exception:
        pass
    return default

def hex_to_rgba(hex_str: str, opacity: float = 1.0, default: Tuple[int, int, int, int] = (255, 255, 255, 255)) -> Tuple[int, int, int, int]:
    try:
        rgb = hex_to_rgb(hex_str, default[:3])
        alpha = int(max(0.0, min(1.0, opacity)) * 255)
        return (rgb[0], rgb[1], rgb[2], alpha)
    except Exception:
        return default

def draw_layer_on_canvas(canvas: Image.Image, layer: Dict[str, Any], width: int, height: int):
    if not layer.get("visible", True):
        return
    text = (layer.get("text") or "").strip()
    if not text:
        return
        
    font_size = max(12, int(layer.get("font_size", 36)))
    font_family = layer.get("font_family", "Segoe UI")
    is_bold = layer.get("font_weight", "bold") == "bold"
    is_italic = bool(layer.get("italic", False))
    font = get_system_font(size=font_size, bold=is_bold, italic=is_italic, family=font_family)
    
    # Text transform
    transform = layer.get("text_transform", "none")
    if transform == "uppercase":
        text = text.upper()
    elif transform == "lowercase":
        text = text.lower()
    elif transform == "capitalize":
        text = text.title()
        
    # Dimensions & coordinates (center-based normalized coords)
    x_norm = float(layer.get("x", 0.5))
    y_norm = float(layer.get("y", 0.5))
    w_norm = float(layer.get("width", 0.8))
    
    center_x = int(x_norm * width)
    center_y = int(y_norm * height)
    max_box_w = max(100, int(w_norm * width))
    
    pad = int(layer.get("bg_padding", 14))
    temp_draw = ImageDraw.Draw(canvas)
    lines = wrap_text_to_lines(temp_draw, text, font, max_box_w - (pad * 2))
    if not lines:
        return
        
    line_height = int(font_size * float(layer.get("line_height", 1.25)))
    
    # Calculate measured dimensions
    line_widths = []
    for l in lines:
        bb = temp_draw.textbbox((0, 0), l, font=font)
        line_widths.append(bb[2] - bb[0])
    max_text_w = max(line_widths) if line_widths else 50
    
    # If fit_content is set, snug fit; otherwise use configured box width for exact canvas parity
    if layer.get("fit_content", False):
        content_w = max_text_w + (pad * 2)
    else:
        content_w = max(max_box_w, max_text_w + (pad * 2))
    content_h = (len(lines) * line_height) + (pad * 2)
    
    # Create isolated overlay image for this layer to handle opacity & rotation
    layer_img = Image.new("RGBA", (content_w + 40, content_h + 40), (0, 0, 0, 0))
    layer_draw = ImageDraw.Draw(layer_img)
    
    offset_x = 20
    offset_y = 20
    
    # Background badge
    bg_op = float(layer.get("bg_opacity", 0.0))
    if bg_op > 0.01:
        bg_col = hex_to_rgba(layer.get("bg_color", "#000000"), bg_op)
        radius = int(layer.get("border_radius", 14))
        stroke_w = int(layer.get("stroke_width", 0))
        stroke_col = hex_to_rgba(layer.get("stroke_color", "#38bdf8"), 1.0) if stroke_w > 0 else None
        
        layer_draw.rounded_rectangle(
            (offset_x, offset_y, offset_x + content_w, offset_y + content_h),
            radius=radius,
            fill=bg_col,
            outline=stroke_col,
            width=stroke_w
        )
        
    # Text drawing
    text_color = hex_to_rgba(layer.get("text_color", "#FFFFFF"), float(layer.get("text_opacity", 1.0)))
    text_align = layer.get("text_align", "center")
    
    curr_y = offset_y + pad
    for idx, line in enumerate(lines):
        lw = line_widths[idx]
        if text_align == "center":
            tx = offset_x + (content_w - lw) // 2
        elif text_align == "right":
            tx = offset_x + content_w - pad - lw
        else: # left
            tx = offset_x + pad
            
        # Shadow if enabled
        shadow_blur = int(layer.get("shadow_blur", 0))
        if shadow_blur > 0 or layer.get("shadow_offset_x") or layer.get("shadow_offset_y"):
            sh_col = hex_to_rgba(layer.get("shadow_color", "#000000"), 0.7)
            sh_x = tx + int(layer.get("shadow_offset_x", 2))
            sh_y = curr_y + int(layer.get("shadow_offset_y", 2))
            layer_draw.text((sh_x, sh_y), line, font=font, fill=sh_col)
            
        # Stroke if no bg outline
        if int(layer.get("stroke_width", 0)) > 0 and bg_op <= 0.01:
            stk_col = hex_to_rgba(layer.get("stroke_color", "#000000"), 1.0)
            stk_w = int(layer.get("stroke_width", 1))
            layer_draw.text((tx, curr_y), line, font=font, fill=text_color, stroke_width=stk_w, stroke_fill=stk_col)
        else:
            layer_draw.text((tx, curr_y), line, font=font, fill=text_color)
            
        curr_y += line_height
        
    # Rotation
    rot = float(layer.get("rotation", 0))
    if abs(rot) > 0.01:
        layer_img = layer_img.rotate(-rot, expand=True, resample=Image.Resampling.BILINEAR)
        
    # Paste onto canvas centered at (center_x, center_y)
    paste_x = center_x - (layer_img.width // 2)
    paste_y = center_y - (layer_img.height // 2)
    canvas.paste(layer_img, (paste_x, paste_y), layer_img)

def compose_slide(
    image_path: str | Path,
    output_path: str | Path,
    width: int = 1080,
    height: int = 1920,
    crop: Optional[Dict[str, float]] = None,
    rotation: int = 0,
    flip_h: bool = False,
    fit_mode: str = "fit",
    headline: str = "",
    caption: str = "",
    branding: Optional[Dict[str, Any]] = None,
    logo_path: Optional[str] = None,
    layers: Optional[list] = None,
    skip_caption_layers: bool = False
) -> str:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    
    branding = branding or {}
    accent_rgb = hex_to_rgb(branding.get("accent_color", "#38bdf8"))
    
    # 1. Base Canvas (rich modern dark studio gradient)
    canvas = Image.new("RGBA", (width, height), (10, 15, 29, 255))
    
    # Open and process the content image
    content_img = Image.open(image_path)
    content_img = ImageOps.exif_transpose(content_img) or content_img
    
    # Apply rotation
    if rotation in (90, 180, 270):
        content_img = content_img.rotate(-rotation, expand=True)
    if flip_h:
        content_img = content_img.transpose(Image.FLIP_LEFT_RIGHT)
        
    content_img = content_img.convert("RGBA")
    
    # Apply normalized crop
    if crop:
        cx = max(0.0, min(1.0, float(crop.get("x", 0.0))))
        cy = max(0.0, min(1.0, float(crop.get("y", 0.0))))
        cw = max(0.01, min(1.0 - cx, float(crop.get("w", 1.0))))
        ch = max(0.01, min(1.0 - cy, float(crop.get("h", 1.0))))
        
        left = int(cx * content_img.width)
        top = int(cy * content_img.height)
        right = int((cx + cw) * content_img.width)
        bottom = int((cy + ch) * content_img.height)
        if right > left and bottom > top:
            content_img = content_img.crop((left, top, right, bottom))

    # Calculate Header and Footer reserved spaces
    safe_margin_x = int(width * 0.05)
    max_content_w = width - (safe_margin_x * 2)
    
    # Reserve header area
    header_height = int(height * 0.06)
    if logo_path and Path(logo_path).exists():
        header_height += 110
    if headline.strip():
        header_height += 120
    if layers:
        for lyr in layers:
            if lyr.get("visible", True) and float(lyr.get("y", 0.5)) < 0.28:
                header_height = max(header_height, int(height * (float(lyr.get("y", 0.12)) + 0.08)))
    header_height = max(int(height * 0.08), min(header_height, int(height * 0.28)))

    # Reserve footer area
    footer_height = int(height * 0.06)
    if caption.strip():
        footer_height += 140
    if layers:
        for lyr in layers:
            if lyr.get("visible", True) and float(lyr.get("y", 0.5)) > 0.72:
                footer_height = max(footer_height, int(height * (1.0 - float(lyr.get("y", 0.84)) + 0.08)))
    footer_height = max(int(height * 0.08), min(footer_height, int(height * 0.25)))

    # Center bounding box for the visual content
    box_left = safe_margin_x
    box_top = header_height
    box_right = width - safe_margin_x
    box_bottom = height - footer_height
    box_w = max(100, box_right - box_left)
    box_h = max(100, box_bottom - box_top)

    # 2. Composition based on fit_mode
    if fit_mode in ("blur_bg", "fit"):
        # Create stylish blurred ambient background
        bg_scale = max(width / content_img.width, height / content_img.height) * 1.05
        bg_w = max(width, int(content_img.width * bg_scale))
        bg_h = max(height, int(content_img.height * bg_scale))
        bg_img = content_img.resize((bg_w, bg_h), Image.Resampling.BILINEAR)
        # Center crop bg to canvas
        bg_left = (bg_w - width) // 2
        bg_top = (bg_h - height) // 2
        bg_cropped = bg_img.crop((bg_left, bg_top, bg_left + width, bg_top + height))
        bg_blurred = bg_cropped.filter(ImageFilter.GaussianBlur(radius=38))
        # Darken blurred background
        dark_overlay = Image.new("RGBA", (width, height), (5, 9, 20, 165))
        bg_blurred.paste(dark_overlay, (0, 0), dark_overlay)
        canvas = bg_blurred

        # `fit` preserves a correctly sized 9:16 source at full canvas size.
        # The separate `blur_bg` mode keeps the subject inside the social safe area.
        fit_w = width if fit_mode == "fit" else box_w
        fit_h = height if fit_mode == "fit" else box_h
        fit_x = 0 if fit_mode == "fit" else box_left
        fit_y = 0 if fit_mode == "fit" else box_top
        scale = min(fit_w / content_img.width, fit_h / content_img.height)
        fg_w = max(1, int(content_img.width * scale))
        fg_h = max(1, int(content_img.height * scale))
        fg_img = content_img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        
        fg_x = fit_x + (fit_w - fg_w) // 2
        fg_y = fit_y + (fit_h - fg_h) // 2
        
        # Add a subtle card border/shadow behind the foreground image
        card_backing = Image.new("RGBA", (fg_w + 12, fg_h + 12), (0, 0, 0, 120))
        canvas.paste(card_backing, (fg_x - 6, fg_y - 6), card_backing)
        canvas.paste(fg_img, (fg_x, fg_y), fg_img)

    elif fit_mode == "fill":
        # Cover entire center box
        scale = max(box_w / content_img.width, box_h / content_img.height)
        fg_w = int(content_img.width * scale)
        fg_h = int(content_img.height * scale)
        fg_img = content_img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        crop_x = (fg_w - box_w) // 2
        crop_y = (fg_h - box_h) // 2
        fg_cropped = fg_img.crop((crop_x, crop_y, crop_x + box_w, crop_y + box_h))
        canvas.paste(fg_cropped, (box_left, box_top), fg_cropped)

    elif fit_mode == "card":
        # Floating card inside box with styled background
        scale = min((box_w - 40) / content_img.width, (box_h - 40) / content_img.height)
        fg_w = max(1, int(content_img.width * scale))
        fg_h = max(1, int(content_img.height * scale))
        fg_img = content_img.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
        fg_x = box_left + (box_w - fg_w) // 2
        fg_y = box_top + (box_h - fg_h) // 2
        
        # Draw floating card outline
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle(
            (fg_x - 8, fg_y - 8, fg_x + fg_w + 8, fg_y + fg_h + 8),
            radius=16,
            fill=(15, 23, 42, 230),
            outline=accent_rgb,
            width=3
        )
        canvas.paste(fg_img, (fg_x, fg_y), fg_img)

    # Editable text layers bypass the legacy branding block below, so keep the
    # uploaded logo visible in layered scenes as well.
    if layers and logo_path and Path(logo_path).exists():
        try:
            with Image.open(logo_path) as logo:
                logo = logo.convert("RGBA")
                logo.thumbnail((220, 110))
                logo_pos = branding.get("logo_position", "top_center")
                if logo_pos == "top_left":
                    lx = safe_margin_x
                elif logo_pos == "top_right":
                    lx = width - safe_margin_x - logo.width
                else:
                    lx = (width - logo.width) // 2
                canvas.paste(logo, (lx, int(height * 0.025)), logo)
        except Exception:
            pass

    # Render layers or fallback to legacy overlays
    if layers and len(layers) > 0:
        sorted_layers = sorted(layers, key=lambda l: l.get("z_index", 0))
        for lyr in sorted_layers:
            if skip_caption_layers and lyr.get("type") in ("caption", "subtitle"):
                continue
            draw_layer_on_canvas(canvas, lyr, width, height)
    else:
        # 3. Draw Branding & Logo
        draw = ImageDraw.Draw(canvas)
        current_y = int(height * 0.035)

        if logo_path and Path(logo_path).exists():
            try:
                with Image.open(logo_path) as logo:
                    logo = logo.convert("RGBA")
                    logo.thumbnail((220, 110))
                    logo_pos = branding.get("logo_position", "top_center")
                    if logo_pos == "top_left":
                        lx = safe_margin_x
                    elif logo_pos == "top_right":
                        lx = width - safe_margin_x - logo.width
                    else:  # top_center
                        lx = (width - logo.width) // 2
                    canvas.paste(logo, (lx, current_y), logo)
                    current_y += logo.height + 14
            except Exception:
                pass

        # Brand Title / Handle text (if present)
        brand_name = branding.get("brand_name", "").strip()
        brand_handle = branding.get("handle", "").strip()
        if brand_name or brand_handle:
            brand_font = get_system_font(size=24, bold=True)
            brand_str = f"{brand_name} {brand_handle}".strip()
            bb = draw.textbbox((0, 0), brand_str, font=brand_font)
            bw = bb[2] - bb[0]
            draw.text(((width - bw) // 2, current_y), brand_str, font=brand_font, fill=(203, 213, 225, 230))
            current_y += 34

        # 4. Top Headline Overlay
        if headline.strip():
            head_font = get_system_font(size=38, bold=True)
            max_text_w = width - (safe_margin_x * 2) - 40
            lines = wrap_text_to_lines(draw, headline.strip(), head_font, max_text_w)
            if lines:
                line_h = 48
                pad_y = 16
                block_h = len(lines) * line_h + (pad_y * 2)
                
                # Badge overlay
                badge_overlay = Image.new("RGBA", (width, block_h), (0, 0, 0, 0))
                b_draw = ImageDraw.Draw(badge_overlay)
                b_draw.rounded_rectangle(
                    (safe_margin_x, 0, width - safe_margin_x, block_h),
                    radius=18,
                    fill=(7, 16, 32, 225),
                    outline=accent_rgb,
                    width=2
                )
                
                ty = pad_y
                for line in lines:
                    l_box = b_draw.textbbox((0, 0), line, font=head_font)
                    lw = l_box[2] - l_box[0]
                    b_draw.text(((width - lw) // 2, ty), line, font=head_font, fill=(255, 255, 255, 255))
                    ty += line_h
                    
                canvas.paste(badge_overlay, (0, current_y), badge_overlay)

        # 5. Bottom Caption Overlay
        if caption.strip():
            cap_font = get_system_font(size=32, bold=True)
            max_cap_w = width - (safe_margin_x * 2) - 40
            cap_lines = wrap_text_to_lines(draw, caption.strip(), cap_font, max_cap_w)
            if cap_lines:
                line_h = 42
                pad_y = 16
                block_h = len(cap_lines) * line_h + (pad_y * 2)
                by = height - footer_height - block_h + 10
                
                cap_overlay = Image.new("RGBA", (width, block_h), (0, 0, 0, 0))
                c_draw = ImageDraw.Draw(cap_overlay)
                c_draw.rounded_rectangle(
                    (safe_margin_x, 0, width - safe_margin_x, block_h),
                    radius=16,
                    fill=(5, 10, 22, 230),
                    outline=(71, 85, 105, 180),
                    width=1
                )
                ty = pad_y
                for line in cap_lines:
                    c_box = c_draw.textbbox((0, 0), line, font=cap_font)
                    cw = c_box[2] - c_box[0]
                    c_draw.text(((width - cw) // 2, ty), line, font=cap_font, fill=(241, 245, 249, 255))
                    ty += line_h
                canvas.paste(cap_overlay, (0, by), cap_overlay)

    # 6. Outer Border / Accent indicator
    if branding.get("show_border", True):
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle(
            (16, 16, width - 16, height - 16),
            radius=24,
            outline=(*accent_rgb, 120),
            width=3
        )

    # Save composed image as RGB JPEG/PNG
    final_rgb = canvas.convert("RGB")
    final_rgb.save(out_p, format="PNG", quality=95)
    return str(out_p)
