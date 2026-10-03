"""Agent 2 — Geometric Transformation Stress Agent (100 tests)"""
import os, sys, time, json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (make_logger, run_detection, blur_variance, save_failure,
                     make_doc_image, TEST_IMG, LOG_BASE, _VF_ROOT)

import cv2, numpy as np

TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
log, fh = make_logger(os.path.join(LOG_BASE, f"agent2_geometry_{TS}.log"))
results = []

base = cv2.imread(TEST_IMG) if os.path.isfile(TEST_IMG) else make_doc_image()
if base is None: base = make_doc_image()
log(f"[AGENT2] Base image: {base.shape}")
log("[AGENT2] Starting 100 tests...")

def record(name, img, desc):
    ok, conf, msg, ms = run_detection(img)
    verdict = "PASS" if ok else "FAIL"
    log(f"[AGENT2][{name}] {desc} → {verdict}  conf={conf:.3f}  {ms:.1f}ms")
    if not ok: save_failure(name, img)
    results.append({"name": name, "pass": ok, "ms": ms, "reason": msg})

def rotate_image(img, angle):
    h, w = img.shape[:2]
    M    = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
    cos  = abs(M[0,0]); sin = abs(M[0,1])
    nw   = int(h*sin + w*cos); nh = int(h*cos + w*sin)
    M[0,2] += (nw - w)/2; M[1,2] += (nh - h)/2
    return cv2.warpAffine(img, M, (nw, nh), borderValue=(128,128,128))

# ── ROTATION (36) ─────────────────────────────────────────────────────────────
log("[AGENT2] === ROTATION TESTS ===")
for angle in range(0, 360, 10):
    img = rotate_image(base, angle)
    record(f"rotation_{angle}deg", img, f"rotation={angle}°")

# ── PERSPECTIVE DISTORTION (20) ───────────────────────────────────────────────
log("[AGENT2] === PERSPECTIVE DISTORTION ===")
def perspective_tilt(img, x_tilt=0, y_tilt=0):
    h, w = img.shape[:2]
    xf = x_tilt / 100.0
    yf = y_tilt / 100.0
    src = np.float32([[0,0],[w,0],[w,h],[0,h]])
    dst = np.float32([
        [w*max(0,xf),    h*max(0,yf)],
        [w*(1-max(0,-xf)),h*max(0,-yf)],
        [w*(1-max(0,xf)), h*(1-max(0,yf))],
        [w*max(0,-xf),   h*(1-max(0,-yf))],
    ])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (w, h), borderValue=(128,128,128))

count = 0
for x_tilt in [-30, -20, -10, 0, 10, 20, 30]:
    for y_tilt in [-20, 0, 20]:
        img = perspective_tilt(base, x_tilt, y_tilt)
        record(f"persp_x{x_tilt}_y{y_tilt}", img, f"perspective x={x_tilt} y={y_tilt}")
        count += 1
        if count >= 20: break
    if count >= 20: break

# ── CARD SIZE IN FRAME (15) ───────────────────────────────────────────────────
log("[AGENT2] === CARD SIZE IN FRAME ===")

for size_pct in [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 98, 100]:
    bg     = np.full((600, 800, 3), 80, dtype=np.uint8)
    factor = (size_pct / 100.0) ** 0.5
    cw     = max(20, int(500 * factor))
    ch     = max(12, int(300 * factor))
    card_r = cv2.resize(base[:300, 150:650] if base.shape[0]>=300 else base, (cw, ch))
    x      = (800 - cw) // 2; y = (600 - ch) // 2
    x      = max(0, min(x, 800-cw)); y = max(0, min(y, 600-ch))
    bg[y:y+ch, x:x+cw] = card_r
    record(f"size_{size_pct}pct", bg, f"card size={size_pct}% of frame")

# ── CARD POSITION IN FRAME (9) ────────────────────────────────────────────────
log("[AGENT2] === CARD POSITION ===")
cw, ch = 350, 210
card_r = cv2.resize(base, (cw, ch))
positions = {
    "top_left":    (10, 10),
    "top_center":  (225, 10),
    "top_right":   (440, 10),
    "mid_left":    (10, 195),
    "center":      (225, 195),
    "mid_right":   (440, 195),
    "bot_left":    (10, 380),
    "bot_center":  (225, 380),
    "bot_right":   (440, 380),
}
for pos_name, (px, py) in positions.items():
    bg = np.full((600, 800, 3), 80, dtype=np.uint8)
    py2, px2 = min(py+ch, 600), min(px+cw, 800)
    ch2, cw2 = py2-py, px2-px
    bg[py:py2, px:px2] = card_r[:ch2, :cw2]
    record(f"pos_{pos_name}", bg, f"position={pos_name}")

# ── ASPECT RATIO VARIATIONS (10) ─────────────────────────────────────────────
log("[AGENT2] === ASPECT RATIO ===")
for w, h in [(856,540),(500,500),(1000,500),(400,600),(600,400),
             (800,450),(900,600),(300,200),(1000,700),(600,300)]:
    doc = make_doc_image(bg_w=w+100, bg_h=h+100, card_w=w, card_h=h)
    record(f"aspect_{w}x{h}", doc, f"aspect={w/h:.2f} ({w}x{h})")

# ── MULTIPLE CARDS (5) ────────────────────────────────────────────────────────
log("[AGENT2] === MULTIPLE CARDS ===")
card_sm = cv2.resize(base, (300, 180))

# 1 two side by side
bg = np.full((600,800,3), 80, dtype=np.uint8)
bg[210:390, 50:350]  = card_sm
bg[210:390, 450:750] = card_sm
record("two_cards_sidebyside", bg, "two cards side by side")

# 2 two overlapping
bg = np.full((600,800,3), 80, dtype=np.uint8)
bg[200:380, 100:400] = card_sm
bg[220:400, 250:550] = card_sm
record("two_cards_overlap", bg, "two cards overlapping")

# 3 large + small
bg = np.full((600,800,3), 80, dtype=np.uint8)
card_lg = cv2.resize(base, (500, 300))
bg[150:450, 150:650] = card_lg
card_tiny = cv2.resize(base, (100, 60))
bg[20:80, 20:120] = card_tiny
record("large_small_card", bg, "one large, one small card")

# 4 three arranged
bg = np.full((600,800,3), 80, dtype=np.uint8)
bg[20:200,  230:530]  = card_sm
bg[350:530, 50:350]   = card_sm
bg[350:530, 430:730]  = card_sm
record("three_cards", bg, "three cards triangle")

# 5 surrounded by rectangles
bg = np.full((600,800,3), 80, dtype=np.uint8)
bg[200:380, 250:550] = card_sm
for _ in range(6):
    x, y = np.random.randint(0,700), np.random.randint(0,500)
    w2, h2 = np.random.randint(30,120), np.random.randint(20,80)
    cv2.rectangle(bg, (x,y), (x+w2,y+h2), tuple(np.random.randint(50,200,3).tolist()), -1)
record("card_surrounded", bg, "card surrounded by objects")

# ── CURVED/BENT (5) ───────────────────────────────────────────────────────────
log("[AGENT2] === CURVED/BENT ===")
def bend_image(img, strength=0.05):
    h, w = img.shape[:2]
    map_x = np.zeros((h, w), np.float32)
    map_y = np.zeros((h, w), np.float32)
    for y in range(h):
        for x in range(w):
            offset = int(strength * h * np.sin(np.pi * x / w))
            map_x[y, x] = x
            map_y[y, x] = y + offset
    return cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderValue=(128,128,128))

for name, strength, desc in [
    ("bend_slight", 0.03, "slight horizontal curve (3%)"),
    ("bend_moderate", 0.07, "moderate curve (7%)"),
    ("bend_strong", 0.15, "strong curve (15%)"),
    ("bend_rolled", 0.20, "rolled card (20%)"),
]:
    img = bend_image(base, strength)
    record(name, img, desc)

# fold corner
img = base.copy(); h2, w2 = img.shape[:2]
fold_size = 80
pts1 = np.float32([[w2-fold_size,0],[w2,0],[w2,fold_size]])
pts2 = np.float32([[w2-fold_size,fold_size],[w2-fold_size,0],[w2,fold_size]])
M    = cv2.getAffineTransform(pts1, pts2)
img  = cv2.warpAffine(img, M, (w2,h2), flags=cv2.WARP_INVERSE_MAP,
                      borderMode=cv2.BORDER_REFLECT_101)
record("folded_corner", img, "card with folded corner")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
total  = len(results); passed = sum(1 for r in results if r["pass"]); failed = total - passed
times  = [r["ms"] for r in results]
log(""); log("="*60); log(f"[AGENT2] SUMMARY")
log(f"[AGENT2] Total: {total}  Passed: {passed}  Failed: {failed}  Pass rate: {passed/total*100:.1f}%")
log(f"[AGENT2] Avg: {sum(times)/len(times):.1f}ms  Slowest: {max(results,key=lambda r:r['ms'])['name']}")
log("="*60)

summary = {"agent":"Agent2-Geometry","total":total,"passed":passed,"failed":failed,
           "pass_rate":f"{passed/total*100:.1f}%","avg_ms":round(sum(times)/len(times),1),
           "failures":[{"test":r["name"],"reason":r["reason"]} for r in results if not r["pass"]]}
with open(os.path.join(LOG_BASE, f"agent2_summary_{TS}.json"),"w") as f: json.dump(summary,f,indent=2)
fh.close()
print(f"\nAgent 2 complete.")
