import os
from pathlib import Path
from typing import List, Dict, Any
import pymupdf

def process_pdf(pdf_path: str | Path, output_dir: str | Path) -> List[Dict[str, Any]]:
    pdf_p = Path(pdf_path)
    out_d = Path(output_dir)
    out_d.mkdir(parents=True, exist_ok=True)
    
    if not pdf_p.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
    doc = pymupdf.open(str(pdf_p))
    pages_data = []
    
    try:
        for i, page in enumerate(doc):
            page_num = i + 1
            # 2.0 scale provides sharp rendering for 1080x1920 video
            matrix = pymupdf.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            
            img_filename = f"page_{page_num:03d}.png"
            img_path = out_d / img_filename
            pix.save(str(img_path))
            
            # Thumbnail for UI gallery
            thumb_matrix = pymupdf.Matrix(0.4, 0.4)
            thumb_pix = page.get_pixmap(matrix=thumb_matrix, alpha=False)
            thumb_filename = f"thumb_{page_num:03d}.png"
            thumb_path = out_d / thumb_filename
            thumb_pix.save(str(thumb_path))
            
            # Extract text to provide smart initial narration/caption suggestion
            extracted_text = page.get_text().strip()
            # Clean text: take first clean lines
            first_sentence = ""
            if extracted_text:
                lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
                if lines:
                    first_sentence = " ".join(lines[:3])[:200]
            
            pages_data.append({
                "page_number": page_num,
                "image_filename": img_filename,
                "image_path": str(img_path),
                "thumbnail_filename": thumb_filename,
                "thumbnail_path": str(thumb_path),
                "width": pix.width,
                "height": pix.height,
                "suggested_text": first_sentence
            })
    finally:
        doc.close()
        
    return pages_data
