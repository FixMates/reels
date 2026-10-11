import os
import sys
import tempfile
from pathlib import Path
import pytest
import pymupdf

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.pdf_service import process_pdf

def test_pdf_import_multi_page():
    # 1. Create a synthetic 3-page PDF with pymupdf
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_p = Path(tmp_dir)
        pdf_file = tmp_p / "sample_doc.pdf"
        
        doc = pymupdf.open()
        for i in range(1, 4):
            page = doc.new_page(width=595, height=842) # A4
            page.insert_text((50, 100), f"Antigravity Studio Test - Page {i}", fontsize=28)
            page.insert_text((50, 160), f"Key insight for slide {i}: Always analyze market structure.", fontsize=18)
        doc.save(str(pdf_file))
        doc.close()
        
        assert pdf_file.exists(), "Sample PDF was not created"
        
        # 2. Process PDF using pdf_service
        out_media_dir = tmp_p / "extracted"
        pages_data = process_pdf(pdf_file, out_media_dir)
        
        # 3. Assertions
        assert len(pages_data) == 3, f"Expected 3 pages, got {len(pages_data)}"
        for idx, p in enumerate(pages_data, 1):
            assert p["page_number"] == idx, f"Expected page {idx}, got {p['page_number']}"
            assert Path(p["image_path"]).exists(), f"High-res image for page {idx} does not exist"
            assert Path(p["thumbnail_path"]).exists(), f"Thumbnail for page {idx} does not exist"
            assert p["width"] > 0 and p["height"] > 0
            assert "Antigravity Studio Test" in p.get("suggested_text", "")
            
if __name__ == "__main__":
    test_pdf_import_multi_page()
    print("test_pdf_import passed successfully!")
