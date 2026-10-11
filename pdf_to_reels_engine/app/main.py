from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import fitz
import pyttsx3
import subprocess, shutil, uuid, os, json, wave, contextlib, re

BASE = Path(__file__).resolve().parent.parent
STATIC = BASE / "app" / "static"
WORK = BASE / "work"
OUTPUT = BASE / "output"
WORK.mkdir(exist_ok=True)
OUTPUT.mkdir(exist_ok=True)

app = FastAPI(title="PDF-to-Reels Engine")
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

# In-memory project registry for this local MVP.
projects = {}

class PageSettings(BaseModel):
    page_number: int
    selected: bool = True
    crop: dict | None = None  # normalized x/y/w/h from 0 to 1
    narration: str = ""
    top_text: str = ""
    bottom_text: str = ""

class RenderRequest(BaseModel):
    project_id: str
    page_settings: list[PageSettings]
    logo_data_url: str | None = None
    default_top: str = ""
    default_bottom: str = ""
    seconds_after_voice: float = Field(default=0.7, ge=0, le=5)
    voice_rate: int = Field(default=175, ge=100, le=250)

@app.get("/", response_class=HTMLResponse)
def home():
    return (STATIC / "index.html").read_text(encoding="utf-8")

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    project_id = uuid.uuid4().hex[:12]
    project_dir = WORK / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = project_dir / "source.pdf"
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(413, "PDF exceeds the 100 MB MVP limit.")
    pdf_path.write_bytes(data)
    try:
        doc = fitz.open(pdf_path)
        pages = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
            img_path = project_dir / f"page_{i+1:03}.png"
            pix.save(img_path)
            pages.append({"page_number": i+1, "image_url": f"/api/page/{project_id}/{i+1}", "width": pix.width, "height": pix.height})
        doc.close()
    except Exception as e:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise HTTPException(400, f"Could not read PDF: {e}")
    projects[project_id] = {"dir": project_dir, "pages": pages}
    return {"project_id": project_id, "pages": pages}

@app.get("/api/page/{project_id}/{page_number}")
def get_page(project_id: str, page_number: int):
    proj = projects.get(project_id)
    if not proj:
        raise HTTPException(404, "Project not found. Upload the PDF again.")
    path = proj["dir"] / f"page_{page_number:03}.png"
    if not path.exists():
        raise HTTPException(404, "Page not found.")
    return FileResponse(path, media_type="image/png")

@app.get("/api/output/{filename}")
def get_output(filename: str):
    # Restrict to files directly in output.
    safe = Path(filename).name
    path = OUTPUT / safe
    if not path.exists():
        raise HTTPException(404, "Output not found.")
    return FileResponse(path, media_type="video/mp4", filename=safe)

def find_font(bold=False):
    candidates = []
    if os.name == "nt":
        windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
        candidates += [windir / "Fonts" / ("arialbd.ttf" if bold else "arial.ttf"),
                      windir / "Fonts" / ("segoeuib.ttf" if bold else "segoeui.ttf")]
    candidates += [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for p in candidates:
        if p.exists():
            return ImageFont.truetype(str(p), 46)
    return ImageFont.load_default()

def find_font_path(bold=False):
    if os.name == "nt":
        base = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
        for name in (["arialbd.ttf","segoeuib.ttf"] if bold else ["arial.ttf","segoeui.ttf"]):
            p = base/name
            if p.exists(): return str(p)
    p = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return str(p) if p.exists() else ""

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, line = [], ""
    for word in words:
        candidate = (line + " " + word).strip()
        if draw.textbbox((0,0), candidate, font=font)[2] <= max_width or not line:
            line = candidate
        else:
            lines.append(line); line = word
    if line: lines.append(line)
    return lines

def text_block(draw, text, y, size, max_width=920, bg=(4,10,20,220)):
    if not text.strip(): return y
    font_path = find_font_path(True)
    try: font = ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()
    except Exception: font = ImageFont.load_default()
    lines = wrap_text(draw, text, font, max_width)
    line_h = int(size * 1.25); pad = 18; h = line_h*len(lines)+pad*2
    overlay = Image.new("RGBA", (1080, h), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle((35,0,1045,h), radius=18, fill=bg)
    yy = pad
    for line in lines:
        box = od.textbbox((0,0), line, font=font)
        od.text(((1080-(box[2]-box[0]))/2, yy), line, font=font, fill=(255,255,255,255))
        yy += line_h
    return overlay, h

def create_slide(page_path, crop, logo_path, top, bottom, out_path):
    W,H=1080,1920
    bg=(7,16,29)
    canvas=Image.new("RGB",(W,H),bg)
    draw=ImageDraw.Draw(canvas)
    accent=(56,189,248)
    draw.rounded_rectangle((24,24,W-24,H-24),radius=28,outline=accent,width=5)
    y=55
    if logo_path and Path(logo_path).exists():
        try:
            logo=Image.open(logo_path).convert("RGBA")
            logo.thumbnail((190,115))
            canvas.paste(logo,((W-logo.width)//2,y),logo)
            y += logo.height + 14
        except Exception: pass
    if top.strip():
        block,h=text_block(draw,top,y,40)
        canvas.paste(block,(0,y),block)
        y += h+22
    img=Image.open(page_path).convert("RGB")
    if crop:
        x=max(0,min(1,float(crop.get("x",0)))); yy=max(0,min(1,float(crop.get("y",0))))
        cw=max(.01,min(1-x,float(crop.get("w",1)))); ch=max(.01,min(1-yy,float(crop.get("h",1))))
        l=int(x*img.width); t=int(yy*img.height); r=int((x+cw)*img.width); b=int((yy+ch)*img.height)
        img=img.crop((l,t,max(l+1,r),max(t+1,b)))
    bottom_lines = max(1, len(bottom.split())//5+1) if bottom.strip() else 0
    bottom_reserve = min(360, bottom_lines*42+100) if bottom.strip() else 100
    top_limit = max(250, y)
    box=(55,top_limit,1025,H-bottom_reserve)
    bw,bh=box[2]-box[0],box[3]-box[1]
    scale=min(bw/img.width,bh/img.height)
    img=img.resize((max(1,int(img.width*scale)),max(1,int(img.height*scale))),Image.Resampling.LANCZOS)
    x=box[0]+(bw-img.width)//2; yy=box[1]+(bh-img.height)//2
    canvas.paste(img,(x,yy))
    if bottom.strip():
        try: font=ImageFont.truetype(find_font_path(True),32)
        except Exception: font=ImageFont.load_default()
        lines=wrap_text(draw,bottom,font,920); line_h=42; h=len(lines)*line_h+34; by=H-h-75
        overlay=Image.new("RGBA",(W,h),(0,0,0,0)); od=ImageDraw.Draw(overlay)
        od.rounded_rectangle((35,0,1045,h),radius=18,fill=(4,10,20,230))
        ty=17
        for line in lines:
            bb=od.textbbox((0,0),line,font=font)
            od.text(((W-(bb[2]-bb[0]))/2,ty),line,font=font,fill=(255,255,255,255));ty+=line_h
        canvas.paste(overlay,(0,by),overlay)
    ImageDraw.Draw(canvas).line((70,H-48,W-70,H-48),fill=accent,width=5)
    canvas.save(out_path,quality=95)

def generate_tts(text, out_wav, rate=175):
    engine = pyttsx3.init()
    engine.setProperty("rate", int(rate))
    # Pick a usable installed Windows voice if available; default voice otherwise.
    engine.save_to_file(text if text.strip() else " ", str(out_wav))
    engine.runAndWait()
    engine.stop()
    if not out_wav.exists() or out_wav.stat().st_size < 1000:
        raise RuntimeError("Local TTS did not create an audio file. Check Windows speech voices.")

def wav_duration(path):
    with contextlib.closing(wave.open(str(path),'rb')) as w:
        return w.getnframes()/float(w.getframerate())

@app.post("/api/render")
def render(req: RenderRequest):
    proj = projects.get(req.project_id)
    if not proj: raise HTTPException(404, "Project expired. Upload the PDF again.")
    if not shutil.which("ffmpeg"):
        raise HTTPException(500, "FFmpeg not found. Install FFmpeg and add its bin folder to PATH.")
    selected = [p for p in req.page_settings if p.selected]
    if not selected: raise HTTPException(400, "Select at least one sheet.")
    job = uuid.uuid4().hex[:8]
    jobdir = WORK / req.project_id / ("render_"+job)
    jobdir.mkdir(parents=True, exist_ok=True)
    logo_path = None
    if req.logo_data_url and "," in req.logo_data_url:
        import base64
        try:
            header, payload = req.logo_data_url.split(",",1)
            ext = ".png" if "png" in header else ".jpg"
            logo_path = jobdir / ("logo"+ext)
            logo_path.write_bytes(base64.b64decode(payload))
        except Exception: logo_path = None
    concat_file = jobdir / "concat.txt"
    slide_paths=[]
    try:
        for idx, setting in enumerate(selected):
            page_path = proj["dir"] / f"page_{setting.page_number:03}.png"
            if not page_path.exists(): continue
            top = setting.top_text.strip() or req.default_top.strip()
            bottom = setting.bottom_text.strip() or req.default_bottom.strip()
            slide_path = jobdir / f"slide_{idx:03}.png"
            create_slide(page_path, setting.crop, logo_path, top, bottom, slide_path)
            narration = setting.narration.strip()
            audio_path = jobdir / f"voice_{idx:03}.wav"
            if narration:
                generate_tts(narration, audio_path, req.voice_rate)
                duration = wav_duration(audio_path) + req.seconds_after_voice
            else:
                # Silent page is held for a default duration if narration is blank.
                duration = max(3.0, req.seconds_after_voice + 2.3)
                subprocess.run(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i","anullsrc=r=44100:cl=stereo","-t",str(duration),str(audio_path)],check=True)
            # Create one encoded clip per sheet with audio, ensuring slide duration matches narration.
            clip_path = jobdir / f"clip_{idx:03}.mp4"
            cmd=["ffmpeg","-y","-hide_banner","-loglevel","error","-loop","1","-framerate","30","-i",str(slide_path),"-i",str(audio_path),
                 "-t",f"{duration:.3f}","-vf","scale=1080:1920,format=yuv420p","-r","30","-c:v","libx264","-preset","veryfast","-crf","21",
                 "-c:a","aac","-b:a","128k","-ar","44100","-shortest","-movflags","+faststart",str(clip_path)]
            subprocess.run(cmd,check=True)
            slide_paths.append(clip_path)
        if not slide_paths: raise RuntimeError("No selected pages could be rendered.")
        list_path=jobdir/"clips.txt"
        list_path.write_text("".join(f"file '{p.as_posix().replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'\n" for p in slide_paths),encoding="utf-8")
        outname=f"reel_{job}.mp4"; outpath=OUTPUT/outname
        subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",str(list_path),"-c","copy","-movflags","+faststart",str(outpath)],check=True)
        return {"ok":True,"filename":outname,"download_url":f"/api/output/{outname}","pages_rendered":len(slide_paths)}
    except Exception as e:
        raise HTTPException(500, f"Render failed: {e}")
