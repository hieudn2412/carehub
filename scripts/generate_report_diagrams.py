from __future__ import annotations

import json
import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"D:\ĐỒ ÁN\carehub")
OUT = ROOT / "report-work" / "diagrams"
OUT.mkdir(parents=True, exist_ok=True)
CANON = json.loads((ROOT / "report-work" / "canonical_baseline.json").read_text(encoding="utf-8"))

W, H = 1800, 1000
NAVY = "#1F4E78"
BLUE = "#D9EAF7"
PALE = "#F4F8FB"
CYAN = "#DDEBF7"
GREEN = "#E2F0D9"
AMBER = "#FFF2CC"
RED = "#F4CCCC"
INK = "#172B3A"
MUTED = "#5F6B76"
LINE = "#7F9DB9"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path(r"C:\Windows\Fonts") / name), size)


def canvas(title: str, subtitle: str = ""):
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((35, 30, W - 35, H - 30), radius=28, fill=WHITE, outline="#B4C7DC", width=3)
    d.rectangle((35, 30, W - 35, 145), fill=NAVY)
    d.text((85, 58), title, font=font(46, True), fill=WHITE)
    if subtitle:
        d.text((88, 112), subtitle, font=font(20), fill="#DCE8F2")
    return im, d


def wrap(text: str, width: int) -> str:
    return "\n".join(textwrap.wrap(str(text), width=max(8, width), break_long_words=False))


def box(d, xy, title, body="", fill=PALE, outline=LINE, title_fill=INK, body_fill=MUTED, radius=20):
    x1, y1, x2, y2 = xy
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=3)
    chars = max(10, int((x2 - x1) / 18))
    title_text = wrap(title, chars)
    bbox = d.multiline_textbbox((0, 0), title_text, font=font(27, True), spacing=6, align="center")
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.multiline_text(((x1 + x2 - tw) / 2, y1 + 20), title_text, font=font(27, True), fill=title_fill, spacing=6, align="center")
    if body:
        body_text = wrap(body, chars + 4)
        bbox = d.multiline_textbbox((0, 0), body_text, font=font(20), spacing=5, align="center")
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.multiline_text(((x1 + x2 - bw) / 2, y1 + 34 + th), body_text, font=font(20), fill=body_fill, spacing=5, align="center")


def arrow(d, start, end, color=NAVY, width=6):
    d.line((start, end), fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 18
    p1 = (end[0] - size * math.cos(angle - 0.55), end[1] - size * math.sin(angle - 0.55))
    p2 = (end[0] - size * math.cos(angle + 0.55), end[1] - size * math.sin(angle + 0.55))
    d.polygon([end, p1, p2], fill=color)


def label(d, xy, text, fill=NAVY):
    x, y = xy
    bbox = d.textbbox((0, 0), text, font=font(19, True))
    pad = 10
    d.rounded_rectangle((x, y, x + bbox[2] + pad * 2, y + bbox[3] + pad * 2), radius=12, fill=fill)
    d.text((x + pad, y + pad - 2), text, font=font(19, True), fill=WHITE)


def save(im, name):
    im.save(OUT / name, dpi=(180, 180), optimize=True)


# 1. System context
im, d = canvas("CareHub System Context", "Users, system boundary, integrations and operational outcomes")
actors = [("Staff", "Training, checklists, exams"), ("Manager", "Department review and reports"), ("Administrator", "Accounts, configuration, governance"), ("Evaluation roles", "Questions, sets, publishing, results")]
ys = [205, 390, 575, 760]
for (title, body), y in zip(actors, ys):
    box(d, (75, y, 430, y + 140), title, body, fill=CYAN)
    arrow(d, (430, y + 70), (630, 500))
box(d, (630, 295, 1170, 705), "CAREHUB", "One authenticated workspace\n\nTraining compliance\nQuality evaluation\nCompetency assessment\nAudit, notification and analytics", fill=BLUE, outline=NAVY)
targets = [("Hospital data", "PostgreSQL + Redis"), ("Files", "Cloudflare R2"), ("Messaging", "RabbitMQ + email"), ("AI services", "DeepSeek, E5, VietQuill")]
for (title, body), y in zip(targets, ys):
    arrow(d, (1170, 500), (1370, y + 70))
    box(d, (1370, y, 1725, y + 140), title, body, fill=GREEN if title != "AI services" else AMBER)
save(im, "01_system_context.png")

# 2. Project lifecycle
im, d = canvas("Project Delivery Lifecycle", "Evidence-driven iterations ending in controlled acceptance")
phases = [
    ("1. Discover", "Vision, scope, legacy evidence", BLUE),
    ("2. Specify", "PRD, use cases, rules, NFR", CYAN),
    ("3. Design", "Architecture, screens, APIs, jobs", AMBER),
    ("4. Build & verify", "17 features, automated tests", GREEN),
    ("5. Accept & hand over", "Performance, UAT, deployment", RED),
]
for i, (title, body, fill) in enumerate(phases):
    x = 75 + i * 340
    box(d, (x, 350, x + 270, 620), title, body, fill=fill)
    if i < len(phases) - 1:
        arrow(d, (x + 270, 485), (x + 335, 485))
d.text((110, 730), "Baseline → traceability → implementation evidence → release gates", font=font(32, True), fill=NAVY)
d.text((110, 790), "Current formal gates: controlled performance run and Product Owner UAT signature.", font=font(25), fill=MUTED)
save(im, "02_project_lifecycle.png")

# 3. Feature map
im, d = canvas("Product Capability Map", "Three operational pillars share one governance foundation")
box(d, (120, 235, 560, 585), "Training", "Records and evidence\nActivity types\nCompliance hours\nLegacy import\nManager oversight", fill=GREEN)
box(d, (680, 235, 1120, 585), "Quality Evaluation", "Form builder and versioning\nAssignments and submissions\nScoring and benchmarks\nRecalculation jobs", fill=BLUE)
box(d, (1240, 235, 1680, 585), "Competency", "Question documents and AI\nQuestion bank and sets\nExam configuration\nAttempts and classification", fill=AMBER)
box(d, (245, 705, 1555, 895), "Shared foundation", "Authentication • users and reference data • role/permission scope • notifications • audit trails • analytics • configuration", fill=CYAN, outline=NAVY)
for x in [340, 900, 1460]:
    arrow(d, (x, 585), (x, 705))
save(im, "03_feature_map.png")

# 4. Use-case landscape
im, d = canvas("Use-Case Landscape", "Actor responsibilities mapped to UC groups")
actor_boxes = [("Guest / Employee", "UC-01–UC-03"), ("Staff", "UC-04–UC-10, UC-14–UC-20"), ("Manager", "UC-08–UC-10, UC-16, UC-27–UC-31"), ("Admin / Delegates", "UC-04–UC-13, UC-21–UC-34")]
for i, (a, u) in enumerate(actor_boxes):
    y = 205 + i * 185
    box(d, (80, y, 430, y + 135), a, u, fill=CYAN)
domains = [("Access & administration", "UC-01–UC-06", BLUE), ("Training & compliance", "UC-07–UC-10", GREEN), ("Quality workflows", "UC-11–UC-16", BLUE), ("Competency & exams", "UC-17–UC-26", AMBER), ("Analytics & operations", "UC-27–UC-34", PALE)]
for i, (title, ids, fill) in enumerate(domains):
    y = 190 + i * 150
    box(d, (710, y, 1320, y + 115), title, ids, fill=fill)
for ay in [272, 457, 642, 827]:
    arrow(d, (430, ay), (690, 500), color=LINE, width=4)
for y in [247, 397, 547, 697, 847]:
    arrow(d, (690, 500), (710, y), color=NAVY, width=4)
box(d, (1420, 315, 1720, 685), "Control model", "JWT identity\nRole + permission\nOwnership and department scope\nEntity lifecycle\nOptimistic locking", fill=RED)
arrow(d, (1320, 500), (1420, 500))
save(im, "04_use_case_landscape.png")

# 5. Business flows
im, d = canvas("Business-Flow Coverage", "Twelve end-to-end outcomes grouped by operational domain")
groups = [
    ("Access", CANON["business_flows"][0:2], CYAN),
    ("Training", CANON["business_flows"][2:5], GREEN),
    ("Quality", CANON["business_flows"][5:8], BLUE),
    ("Competency & operations", CANON["business_flows"][8:12], AMBER),
]
for i, (group, flows, fill) in enumerate(groups):
    x = 70 + i * 430
    d.rounded_rectangle((x, 205, x + 380, 885), radius=24, fill=fill, outline=LINE, width=3)
    d.text((x + 25, 230), group, font=font(30, True), fill=NAVY)
    y = 305
    for flow in flows:
        text = f"{flow[0]}\n{flow[1]}"
        d.rounded_rectangle((x + 20, y, x + 360, y + 125), radius=16, fill=WHITE, outline=LINE, width=2)
        d.multiline_text((x + 38, y + 18), wrap(text, 27), font=font(19, True), fill=INK, spacing=4)
        y += 145
save(im, "05_business_flows.png")

# 6. Architecture
im, d = canvas("High-Level Technical Architecture", "Modular monolith with asynchronous and external adapters")
box(d, (90, 225, 360, 380), "Browser", "React UI users", fill=CYAN)
box(d, (475, 225, 785, 380), "React SPA", "Routes • guards • Axios", fill=BLUE)
box(d, (900, 225, 1220, 380), "Spring REST API", "Security • controllers", fill=BLUE)
box(d, (1325, 225, 1710, 380), "Domain services", "Transactions • rules • events", fill=GREEN)
for a, b in [((360, 302), (475, 302)), ((785, 302), (900, 302)), ((1220, 302), (1325, 302))]: arrow(d, a, b)
infra = [("PostgreSQL 17", "Persistent domain and audit data"), ("Redis 7", "Cache and runtime state"), ("RabbitMQ 3", "Queued email delivery"), ("Cloudflare R2", "Evidence and document objects"), ("AI adapters", "DeepSeek • E5 • VietQuill")]
for i, (title, body) in enumerate(infra):
    x = 80 + i * 340
    box(d, (x, 640, x + 290, 830), title, body, fill=PALE if i < 2 else AMBER)
    arrow(d, (1515, 380), (x + 145, 640), color=LINE, width=4)
box(d, (605, 465, 1210, 565), "AFTER_COMMIT events + scheduled workers", "Retryable, observable and idempotent follow-up work", fill=RED)
arrow(d, (1515, 380), (1210, 515), color=NAVY)
save(im, "06_architecture.png")

# 7. Domain model
im, d = canvas("Domain Data Map", "Key ownership and relationships across bounded contexts")
nodes = [
    ((90, 220, 520, 420), "Identity & Reference", "User • Role • Department • Position\nEducation level • Professional field", CYAN),
    ((90, 600, 520, 800), "Training", "TrainingRecord • Evidence • ActivityType\nChangeLog • ImportLog", GREEN),
    ((680, 220, 1120, 420), "Quality Forms", "FormTemplate • Version • Section • Item\nAssignment • Submission • Answer", BLUE),
    ((680, 600, 1120, 800), "Competency", "QuestionDocument • Question • Set\nExamConfig • Paper • Assignment • Attempt", AMBER),
    ((1290, 410, 1710, 610), "Operations", "Notification • Audit • Settings\nDashboard projections • Background jobs", RED),
]
for xy, title, body, fill in nodes: box(d, xy, title, body, fill=fill)
for a, b in [((520, 320), (680, 320)), ((520, 700), (680, 700)), ((305, 420), (305, 600)), ((900, 420), (900, 600)), ((1120, 320), (1290, 480)), ((1120, 700), (1290, 540))]: arrow(d, a, b, color=LINE, width=5)
label(d, (540, 278), "owns / scopes", NAVY); label(d, (535, 658), "employee", NAVY)
save(im, "07_domain_map.png")

# 8. Request/event lifecycle
im, d = canvas("Request and Event Lifecycle", "Synchronous consistency followed by controlled asynchronous work")
steps = [
    ("1", "SPA request", "JWT + validated input", CYAN),
    ("2", "Security", "Role, permission, ownership", RED),
    ("3", "Controller", "HTTP contract + DTO", BLUE),
    ("4", "Service", "Rules + transaction", GREEN),
    ("5", "Database", "Domain + audit commit", PALE),
    ("6", "Event / worker", "AFTER_COMMIT or schedule", AMBER),
    ("7", "Outcome", "Notification, file or AI job", CYAN),
]
for i, (num, title, body, fill) in enumerate(steps):
    x = 45 + i * 250
    box(d, (x, 330, x + 205, 610), f"{num}. {title}", body, fill=fill)
    if i < len(steps) - 1: arrow(d, (x + 205, 470), (x + 245, 470), width=5)
d.text((140, 735), "Failure rule", font=font(28, True), fill=NAVY)
d.text((330, 735), "Reject before commit, or persist a retryable failure after commit; never duplicate completed effects.", font=font(25), fill=INK)
save(im, "08_request_event.png")

# 9. Navigation map
im, d = canvas("Role-Based Navigation Map", "Visible navigation and server authorization reinforce the same scope")
roles = [("Staff", GREEN), ("Manager", BLUE), ("Administrator", CYAN), ("Evaluation delegate", AMBER)]
for i, (role, fill) in enumerate(roles):
    x = 70 + i * 430
    box(d, (x, 200, x + 360, 315), role, "Authenticated entry point", fill=fill)
    arrow(d, (x + 180, 315), (x + 180, 420))
    dashboard = "Personal dashboard" if i == 0 else "Manager dashboard" if i == 1 else "Admin dashboard" if i == 2 else "Evaluation dashboard"
    box(d, (x, 420, x + 360, 535), dashboard, "Scoped cards and alerts", fill=WHITE)
    arrow(d, (x + 180, 535), (x + 180, 635))
    body = ["Training • forms • exams", "Employees • reports • detail", "Users • settings • governance", "Questions • sets • results"][i]
    box(d, (x, 635, x + 360, 795), "Feature routes", body, fill=PALE)
d.text((180, 875), "Client guards improve usability; Spring Security and service-level scope remain authoritative.", font=font(27, True), fill=NAVY)
save(im, "09_navigation.png")

# 10. Test levels
im, d = canvas("Verification Model", "Legacy evidence is retained; v0.9 execution and acceptance remain separate")
levels = [
    ("L4 UAT", "12 business scripts • Product Owner sign-off", 520, RED),
    ("L3 System", "115 API/system cases • security and performance", 720, AMBER),
    ("L2 Integration", "93 integration cases • service/repository boundaries", 920, BLUE),
    ("L1 Unit", "217 unit cases + 116 current frontend tests", 1120, GREEN),
]
y = 205
for title, body, width, fill in levels:
    x = (W - width) // 2
    box(d, (x, y, x + width, y + 145), title, body, fill=fill)
    y += 170
box(d, (180, 885, 1620, 950), "Release gate: current rerun evidence + controlled performance report + signed UAT", fill=NAVY, title_fill=WHITE)
save(im, "10_test_levels.png")

# 11. Deployment
im, d = canvas("Deployment Topology", "Production-oriented container and integration boundaries")
box(d, (75, 360, 330, 535), "User device", "HTTPS browser", fill=CYAN)
box(d, (430, 330, 735, 565), "Reverse proxy / TLS", "Static SPA\n/api/v1 proxy\nsecurity headers", fill=BLUE)
box(d, (850, 215, 1190, 405), "Frontend", "React/Vite assets", fill=GREEN)
box(d, (850, 535, 1190, 725), "Backend", "Spring Boot :8081", fill=GREEN)
box(d, (1330, 185, 1715, 385), "Core infrastructure", "PostgreSQL 17\nRedis 7\nRabbitMQ 3", fill=PALE)
box(d, (1330, 555, 1715, 755), "External services", "Cloudflare R2\nSMTP\nDeepSeek / model files", fill=AMBER)
arrow(d, (330, 447), (430, 447)); arrow(d, (735, 410), (850, 310)); arrow(d, (735, 500), (850, 630)); arrow(d, (1190, 630), (1330, 655)); arrow(d, (1190, 600), (1330, 285))
d.text((235, 850), "Secrets via environment • health checks • backup/restore • restricted management ports", font=font(28, True), fill=NAVY)
save(im, "11_deployment.png")

# 12. User journey
im, d = canvas("Common User Journey", "The exact actions vary by role; the interaction pattern remains consistent")
steps = [("Sign in", "OTP / password / token"), ("Open dashboard", "Role-scoped priorities"), ("Complete work", "Training, form or exam"), ("Review outcome", "Status, score, evidence"), ("Follow up", "Notification, correction or report")]
for i, (title, body) in enumerate(steps):
    x = 75 + i * 345
    box(d, (x, 340, x + 275, 610), f"{i + 1}. {title}", body, fill=[CYAN, BLUE, GREEN, AMBER, RED][i])
    if i < 4: arrow(d, (x + 275, 475), (x + 340, 475))
d.text((145, 760), "At every step: loading, empty, validation, authorization and retry feedback must be explicit.", font=font(29, True), fill=NAVY)
save(im, "12_user_journey.png")

# 13. Traceability
im, d = canvas("Delivery Traceability Chain", "Every implemented outcome should remain explainable from requirement to acceptance")
steps = [("FT", "17 feature groups"), ("UC / BF", "34 use cases • 12 flows"), ("Design", "Screens • APIs • jobs"), ("L1 / L2", "Logic and integration"), ("L3", "System and security"), ("UAT", "Business acceptance"), ("Release", "Signed evidence")]
for i, (title, body) in enumerate(steps):
    x = 35 + i * 250
    fill = [CYAN, BLUE, PALE, GREEN, GREEN, AMBER, RED][i]
    box(d, (x, 335, x + 205, 610), title, body, fill=fill)
    if i < len(steps) - 1: arrow(d, (x + 205, 472), (x + 245, 472), width=5)
d.text((120, 750), "Current status", font=font(29, True), fill=NAVY)
d.text((355, 750), "Implementation and automated evidence available; performance and signed UAT remain open release gates.", font=font(25), fill=INK)
save(im, "13_traceability.png")

print(f"Generated {len(list(OUT.glob('*.png')))} diagrams in {OUT}")

# Compact visual review sheet for internal QA.
files = sorted(OUT.glob("[0-9][0-9]_*.png"))
thumb_w, thumb_h = 420, 245
sheet = Image.new("RGB", (thumb_w * 4, (thumb_h + 42) * math.ceil(len(files) / 4)), "#E5E7EB")
sd = ImageDraw.Draw(sheet)
for i, path in enumerate(files):
    preview = Image.open(path).convert("RGB")
    preview.thumbnail((thumb_w - 12, thumb_h - 12))
    x = (i % 4) * thumb_w + 6
    y = (i // 4) * (thumb_h + 42) + 34
    sheet.paste(preview, (x, y))
    sd.text((x, y - 27), path.stem, font=font(17, True), fill=INK)
sheet.save(OUT / "contact_sheet.png")
