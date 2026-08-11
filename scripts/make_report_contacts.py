from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat
from pdf2image import convert_from_path


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "report-work" / "doc-renders"
PAGE_DIR = ROOT / "report-work" / "doc-pages"
CONTACT_DIR = ROOT / "report-work" / "contacts"
SHEET_DIR = ROOT / "report-work" / "previews"
POPPLER = Path(r"C:\Users\tuann\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin")
PAGE_DIR.mkdir(parents=True, exist_ok=True)
CONTACT_DIR.mkdir(parents=True, exist_ok=True)


def contact(images, labels, output, cols=4, thumb=(300, 420)):
    rows = (len(images) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * (thumb[0] + 18), rows * (thumb[1] + 42)), "#e5e7eb")
    draw = ImageDraw.Draw(canvas)
    for i, (im, label) in enumerate(zip(images, labels)):
        im = im.convert("RGB"); im.thumbnail(thumb)
        x = (i % cols) * (thumb[0] + 18) + 9
        y = (i // cols) * (thumb[1] + 42) + 28
        canvas.paste(im, (x, y))
        draw.text((x, 8 + (i // cols) * (thumb[1] + 42)), label[:48], fill="black")
    canvas.save(output)


for pdf in sorted(PDF_DIR.glob("*.pdf")):
    pages = convert_from_path(pdf, dpi=110, poppler_path=str(POPPLER))
    target = PAGE_DIR / pdf.stem
    target.mkdir(parents=True, exist_ok=True)
    stats = []
    for i, page in enumerate(pages, 1):
        page.save(target / f"page-{i:03d}.png")
        gray = page.convert("L")
        stats.append((i, round(ImageStat.Stat(gray).mean[0], 2), gray.getbbox()))
    for start in range(0, len(pages), 16):
        chunk = pages[start:start+16]
        contact(chunk, [f"p.{i}" for i in range(start+1,start+len(chunk)+1)], CONTACT_DIR / f"DOC__{pdf.stem}__{start//16+1:02d}.png")
    print(f"DOC {pdf.name}: pages={len(pages)} brightness={[s[1] for s in stats]}")


groups = {}
for png in sorted(SHEET_DIR.glob("*.png")):
    stem = png.name.split("__", 1)[0]
    groups.setdefault(stem, []).append(png)
for stem, files in groups.items():
    images = [Image.open(p) for p in files]
    for start in range(0, len(images), 12):
        chunk = images[start:start+12]
        contact(chunk, [p.stem.split("__",1)[-1] for p in files[start:start+12]], CONTACT_DIR / f"XLSX__{stem}__{start//12+1:02d}.png", cols=3, thumb=(420,300))
    print(f"XLSX {stem}: sheets={len(files)}")
