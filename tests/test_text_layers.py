import pytest
import uuid
from backend.app.services import project_service
from backend.app.services.image_service import compose_slide, get_system_font
from pathlib import Path
from PIL import Image

def test_layer_persistence_and_synthesis():
    proj = project_service.create_project({"title": "Layer Test Project"})
    pid = proj["id"]
    
    # Add a scene
    scenes = project_service.add_scenes_to_project(pid, [{
        "item_type": "image",
        "headline": "Crypto Breakdown",
        "caption": "Bullish Pennant Forming"
    }])
    sid = scenes[0]["id"]
    
    # Retrieve scene - should synthesize default layers for backwards compatibility
    s = project_service.get_project(pid)["scenes"][0]
    assert "layers" in s
    assert len(s["layers"]) >= 2
    
    headline_layer = next(l for l in s["layers"] if l["type"] == "headline")
    assert headline_layer["text"] == "Crypto Breakdown"
    assert headline_layer["y"] == 0.12
    
    # Update with custom layers (dragged position)
    custom_layers = [
        {
            "id": "layer_head_1",
            "type": "headline",
            "text": "SOL/USDT Analysis",
            "x": 0.50,
            "y": 0.22,
            "width": 0.85,
            "font_size": 44,
            "font_family": "Segoe UI",
            "font_weight": "bold",
            "text_color": "#38BDF8",
            "bg_color": "#0F172A",
            "bg_opacity": 0.9,
            "bg_padding": 16,
            "border_radius": 20,
            "stroke_color": "#38BDF8",
            "stroke_width": 2,
            "visible": True,
            "locked": False,
            "z_index": 1
        },
        {
            "id": "layer_callout_1",
            "type": "callout",
            "text": "Support Zone: $142",
            "x": 0.35,
            "y": 0.55,
            "width": 0.45,
            "font_size": 28,
            "font_family": "Arial",
            "font_weight": "bold",
            "text_color": "#4ADE80",
            "bg_color": "#052E16",
            "bg_opacity": 0.85,
            "bg_padding": 10,
            "border_radius": 12,
            "visible": True,
            "locked": True,
            "z_index": 2
        }
    ]
    
    updated = project_service.update_scene(sid, {"layers": custom_layers})
    assert len(updated["layers"]) == 2
    assert updated["layers"][0]["text"] == "SOL/USDT Analysis"
    assert updated["layers"][1]["locked"] is True
    assert updated["layers"][1]["x"] == 0.35
    
    # Clean up
    project_service.delete_project(pid)

def test_compose_slide_with_layers(tmp_path):
    # Create test source image
    src_img = tmp_path / "test_src.png"
    Image.new("RGB", (800, 800), (20, 30, 50)).save(src_img)
    
    out_slide = tmp_path / "composed_slide.png"
    
    layers = [
        {
            "id": "l1",
            "type": "headline",
            "text": "Bitcoin Dominance At 58%",
            "x": 0.5,
            "y": 0.15,
            "width": 0.8,
            "font_size": 40,
            "text_color": "#FFFFFF",
            "bg_color": "#0B132B",
            "bg_opacity": 0.8,
            "visible": True,
            "z_index": 0
        },
        {
            "id": "l2",
            "type": "callout",
            "text": "Target Resistance",
            "x": 0.7,
            "y": 0.45,
            "width": 0.4,
            "font_size": 30,
            "text_color": "#FACC15",
            "bg_color": "#1C1917",
            "bg_opacity": 0.9,
            "visible": True,
            "z_index": 1
        }
    ]
    
    res = compose_slide(
        image_path=src_img,
        output_path=out_slide,
        width=1080,
        height=1920,
        layers=layers
    )
    
    assert Path(res).exists()
    with Image.open(res) as img:
        assert img.width == 1080
        assert img.height == 1920
