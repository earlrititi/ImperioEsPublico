"""Build the free reading booklet and render a local visual proof."""
import json
from shutil import copyfile
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "src/config/siglo-de-oro.json").read_text(encoding="utf-8"))
output = ROOT / "public/recursos/7-historias-del-siglo-de-oro.pdf"
output.parent.mkdir(parents=True, exist_ok=True)
proof = ROOT / "tmp/pdfs/siglo-de-oro"
proof.mkdir(parents=True, exist_ok=True)

serif, bold = "Times-Roman", "Times-Bold"
if Path("C:/Windows/Fonts/georgia.ttf").is_file():
    pdfmetrics.registerFont(TTFont("ImperioSerif", "C:/Windows/Fonts/georgia.ttf"))
    pdfmetrics.registerFont(TTFont("ImperioSerifBold", "C:/Windows/Fonts/georgiab.ttf"))
    serif, bold = "ImperioSerif", "ImperioSerifBold"

red = colors.HexColor("#b42132")
ink = colors.HexColor("#151517")
muted = colors.HexColor("#55555b")
styles = {
    "brand": ParagraphStyle("Brand", fontName=bold, fontSize=19, leading=24, textColor=ink, spaceAfter=20),
    "cover": ParagraphStyle("Cover", fontName=bold, fontSize=34, leading=41, textColor=ink, spaceAfter=24),
    "title": ParagraphStyle("Title", fontName=bold, fontSize=19, leading=25, textColor=ink, spaceAfter=9),
    "body": ParagraphStyle("Body", fontName=serif, fontSize=11, leading=17, textColor=ink, spaceAfter=10, alignment=TA_LEFT),
    "meta": ParagraphStyle("Meta", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=red, spaceAfter=9),
    "source": ParagraphStyle("Source", fontName="Helvetica", fontSize=8.5, leading=12, textColor=muted, spaceAfter=12),
}

def para(text, style="body"):
    return Paragraph(escape(text), styles[style])

def page_frame(canvas, doc):
    canvas.setStrokeColor(red)
    canvas.setLineWidth(1)
    canvas.line(44, A4[1] - 30, A4[0] - 44, A4[1] - 30)
    canvas.setFillColor(muted)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(44, 25, "IMPERIO E | imperioes.com | " + data["edition"])
    canvas.drawRightString(A4[0] - 44, 25, str(doc.page))

flow = [Spacer(1, 30), para("IMPERIO E", "brand"), para(data["title"], "cover"),
        para(data["intro"]), Spacer(1, 16), para(data["note"], "source"), Spacer(1, 18)]
for index, story in enumerate(data["stories"], 1):
    flow.append(para(f'{index:02d}  {story["title"]}', "body"))
flow.append(PageBreak())

for index, story in enumerate(data["stories"], 1):
    source = story["source"]
    block = [para(f'{index:02d} / {story["place"]}', "meta"), para(story["title"], "title")]
    block += [para(text) for text in story["paragraphs"]]
    block += [Paragraph(f'Fuente: <a href="{escape(source["url"], quote=True)}" color="#b42132">'
                        f'{escape(source["institution"])}. {escape(source["title"])}</a>', styles["source"])]
    flow.append(KeepTogether(block))
    if index % 2 == 0:
        flow.append(PageBreak())
    else:
        flow.append(Spacer(1, 26))

flow += [Spacer(1, 20), para("Sigue el hilo", "title"),
         para("Cada historia es un comienzo. Vuelve a las fuentes enlazadas, compara el documento con su contexto y descubre el archivo de Imperio E."),
         Paragraph('<a href="https://imperioes.com/archivo" color="#b42132">Explorar el archivo de Imperio E</a>', styles["body"]),
         para("Texto editorial de Imperio E. Referencias institucionales consultadas el 18 de octubre de 2026. No reproducimos im\u00e1genes ni pasajes extensos de terceros.", "source")]
doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=50, bottomMargin=48,
                        title=data["title"], author="Imperio E", pageCompression=1)
doc.build(flow, onFirstPage=page_frame, onLaterPages=page_frame)
deliverable = ROOT / "output/pdf/7-historias-del-siglo-de-oro.pdf"
deliverable.parent.mkdir(parents=True, exist_ok=True)
copyfile(output, deliverable)

from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

reader = PdfReader(output)
text = "\n".join(page.extract_text() for page in reader.pages)
assert len(reader.pages) == 5, f"Unexpected pagination: {len(reader.pages)} pages"
for story in data["stories"]:
    assert story["title"] in text
assert sum(len(page.get("/Annots", [])) for page in reader.pages) >= 8
pdf = pdfium.PdfDocument(str(output))
thumbs = []
for index, page in enumerate(pdf):
    rendered = page.render(scale=1.3).to_pil().convert("RGB")
    rendered.save(proof / f"page-{index + 1}.png")
    thumb = ImageOps.contain(rendered, (390, 552))
    thumbs.append(thumb)
sheet = Image.new("RGB", (390 * 3, 582 * 2), "#dedee1")
draw = ImageDraw.Draw(sheet)
for index, thumb in enumerate(thumbs):
    x, y = (index % 3) * 390, (index // 3) * 582
    sheet.paste(thumb, (x, y))
    draw.text((x + 12, y + 557), f"PAGE {index + 1}", fill="black")
sheet.save(proof / "contact-sheet.png")
print(f"Verified {len(reader.pages)} pages, 7 stories and source links: {output}")
