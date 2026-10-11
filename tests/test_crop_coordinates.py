import os
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.image_service import compose_slide

def test_crop_and_composition():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        src_img_p = tmp_p / "test_source.png"
        
        # Create a test 800x600 image with 4 distinct colored quadrants
        img = Image.new("RGB", (800, 600), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 0, 400, 300), fill=(255, 0, 0))      # Top-left Red
        draw.rectangle((400, 0, 800, 300), fill=(0, 255, 0))    # Top-right Green
        draw.rectangle((0, 300, 400, 600), fill=(0, 0, 255))    # Bottom-left Blue
        draw.rectangle((400, 300, 800, 600), fill=(255, 255, 0))# Bottom-right Yellow
        img.save(src_img_p)
        
        # 1. Test crop of top-right quadrant: x=0.5, y=0.0, w=0.5, h=0.5
        out_slide_1 = tmp_p / "slide_crop.png"
        compose_slide(
            image_path=src_img_p,
            output_path=out_slide_1,
            width=1080,
            height=1920,
            crop={"x": 0.5, "y": 0.0, "w": 0.5, "h": 0.5},
            rotation=0,
            flip_h=False,
            fit_mode="fit",
            headline="Quadrant Test",
            caption="Green Quadrant Crop"
        )
        assert out_slide_1.exists(), "Output slide was not created"
        
        with Image.open(out_slide_1) as out_img:
            assert out_img.size == (1080, 1920), f"Expected (1080, 1920), got {out_img.size}"
            
        # 2. Test rotation 90 degrees and blur_bg mode
        out_slide_2 = tmp_p / "slide_rotated.png"
        compose_slide(
            image_path=src_img_p,
            output_path=out_slide_2,
            width=1080,
            height=1920,
            crop=None,
            rotation=90,
            flip_h=True,
            fit_mode="blur_bg",
            headline="Rotated & Flipped",
            caption=""
        )
        assert out_slide_2.exists()
        with Image.open(out_slide_2) as out_img2:
            assert out_img2.size == (1080, 1920)

if __name__ == "__main__":
    test_crop_and_composition()
    print("test_crop_coordinates passed successfully!")
