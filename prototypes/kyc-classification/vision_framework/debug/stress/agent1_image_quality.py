"""Agent 1 — Image Quality Stress Agent (120 tests)"""
import os, sys, time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (make_logger, run_detection, blur_variance, save_failure,
                     make_doc_image, TEST_IMG, LOG_BASE, IMG_DIR, _VF_ROOT)

import cv2, numpy as np

TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
log, fh = make_logger(os.path.join(LOG_BASE, f"agent1_quality_{TS}.log"))
os.makedirs(os.path.join(LOG_BASE, "blur"), exist_ok=True)

results = []

def record(name, img, desc):
    var = blur_variance(img)
    ok, conf, msg, ms = run_detection(img)
    verdict = "PASS" if ok else "FAIL"
    log(f"[AGENT1][{name}] Input: {desc}")
    log(f"[AGENT1][{name}] Blur variance: {var:.2f}")
    log(f"[AGENT1][{name}] Document detected: {verdict}")
    log(f"[AGENT1][{name}] Confidence: {conf:.3f}")
    log(f"[AGENT1][{name}] Overall: {verdict}")
    log(f"[AGENT1][{name}] Time: {ms:.1f}ms")
    if not ok:
        save_failure(name, img)
    results.append({"name": name, "pass": ok, "ms": ms, "reason": msg})
    return ok

# ── Load base image ───────────────────────────────────────────────────────────
base = cv2.imread(TEST_IMG) if os.path.isfile(TEST_IMG) else make_doc_image()
if base is None:
    base = make_doc_image()
log(f"[AGENT1] Base image shape: {base.shape}")
log(f"[AGENT1] Starting 120 tests...")

# ── BLUR VARIATIONS (15) ──────────────────────────────────────────────────────
log("[AGENT1] === BLUR VARIATIONS ===")
blur_kernels = [(3,3),(5,5),(7,7),(9,9),(11,11),(13,13),(15,15),(17,17),
                (19,19),(21,21),(23,23),(25,25),(31,31),(41,41),(51,51)]
for k in blur_kernels:
    img = cv2.GaussianBlur(base.copy(), k, 0)
    cv2.imwrite(os.path.join(LOG_BASE, "blur", f"kernel_{k[0]}.jpg"), img)
    record(f"blur_kernel_{k[0]}x{k[1]}", img, f"GaussianBlur kernel={k}")

# ── MOTION BLUR (10) ──────────────────────────────────────────────────────────
log("[AGENT1] === MOTION BLUR ===")
def motion_blur(img, size=15, angle=0):
    k  = np.zeros((size, size))
    k[size//2, :] = 1.0
    k /= size
    M  = cv2.getRotationMatrix2D((size/2, size/2), angle, 1)
    k  = cv2.warpAffine(k, M, (size, size))
    k /= (k.sum() or 1)
    return cv2.filter2D(img, -1, k)

for angle in [0, 30, 45, 60, 90, 120, 135, 150, 180, 270]:
    img = motion_blur(base.copy(), angle=angle)
    record(f"motion_blur_{angle}deg", img, f"motion blur angle={angle}")

# ── NOISE VARIATIONS (10) ─────────────────────────────────────────────────────
log("[AGENT1] === NOISE VARIATIONS ===")
for sigma in [5, 10, 15, 20, 25, 30, 40, 50, 75, 100]:
    noise = np.random.normal(0, sigma, base.shape).astype(np.float32)
    img   = np.clip(base.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    record(f"noise_sigma_{sigma}", img, f"Gaussian noise sigma={sigma}")

# ── SALT AND PEPPER (5) ───────────────────────────────────────────────────────
log("[AGENT1] === SALT AND PEPPER ===")
for amount in [0.01, 0.05, 0.10, 0.20, 0.30]:
    img  = base.copy()
    n    = int(amount * img.size)
    coords = [np.random.randint(0, i, n) for i in img.shape]
    img[coords[0], coords[1]] = 255
    coords = [np.random.randint(0, i, n) for i in img.shape]
    img[coords[0], coords[1]] = 0
    record(f"salt_pepper_{int(amount*100)}pct", img, f"salt&pepper amount={amount}")

# ── JPEG COMPRESSION (10) ─────────────────────────────────────────────────────
log("[AGENT1] === JPEG COMPRESSION ===")
for quality in [10, 20, 30, 40, 50, 60, 70, 80, 90, 95]:
    _, buf = cv2.imencode(".jpg", base, [cv2.IMWRITE_JPEG_QUALITY, quality])
    img    = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    record(f"jpeg_q{quality}", img, f"JPEG quality={quality} size={len(buf)}bytes")

# ── BRIGHTNESS (10) ───────────────────────────────────────────────────────────
log("[AGENT1] === BRIGHTNESS ===")
for factor in [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.5, 2.0, 2.5, 3.0]:
    img = np.clip(base.astype(np.float32) * factor, 0, 255).astype(np.uint8)
    record(f"brightness_{factor}", img, f"brightness factor={factor}")

# ── CONTRAST (10) ─────────────────────────────────────────────────────────────
log("[AGENT1] === CONTRAST ===")
for alpha in [0.1, 0.3, 0.5, 0.7, 0.9, 1.5, 2.0, 2.5, 3.0, 4.0]:
    img = cv2.convertScaleAbs(base, alpha=alpha, beta=0)
    record(f"contrast_{alpha}", img, f"contrast alpha={alpha}")

# ── RESOLUTION (10) ───────────────────────────────────────────────────────────
log("[AGENT1] === RESOLUTION ===")
h0, w0 = base.shape[:2]
for scale in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.5, 2.0]:
    nw, nh = max(4, int(w0*scale)), max(4, int(h0*scale))
    img    = cv2.resize(base, (nw, nh))
    record(f"scale_{scale}", img, f"scale={scale} resolution={nw}x{nh}")

# ── COLOR CHANNEL (10) ────────────────────────────────────────────────────────
log("[AGENT1] === COLOR CHANNELS ===")
gray_bgr = cv2.cvtColor(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
r_only   = base.copy(); r_only[:,:,0]=0; r_only[:,:,1]=0
g_only   = base.copy(); g_only[:,:,0]=0; g_only[:,:,2]=0
b_only   = base.copy(); b_only[:,:,1]=0; b_only[:,:,2]=0
inverted = 255 - base
hsv      = cv2.cvtColor(base, cv2.COLOR_BGR2HSV).astype(np.float32)
hsv[:,:,0] = (hsv[:,:,0]+30)%180; hue_shift = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
hsv2     = cv2.cvtColor(base, cv2.COLOR_BGR2HSV); hsv2[:,:,1]=0; desat = cv2.cvtColor(hsv2, cv2.COLOR_HSV2BGR)
k_sepia  = np.array([[0.272,0.534,0.131],[0.349,0.686,0.168],[0.393,0.769,0.189]])
sepia    = np.clip(base.astype(np.float32) @ k_sepia.T, 0, 255).astype(np.uint8)
bw       = cv2.cvtColor(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
_, bw    = cv2.threshold(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), 127, 255, cv2.THRESH_BINARY)
bw_bgr   = cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)
overexp  = np.clip(base.astype(np.float32)*2.5, 0, 255).astype(np.uint8)

for name, img, desc in [
    ("gray_bgr",  gray_bgr,  "grayscale to BGR"),
    ("red_only",  r_only,    "red channel only"),
    ("green_only",g_only,    "green channel only"),
    ("blue_only", b_only,    "blue channel only"),
    ("inverted",  inverted,  "inverted colors"),
    ("hue_shift", hue_shift, "HSV hue+30"),
    ("desaturated",desat,    "HSV saturation=0"),
    ("sepia",     sepia,     "sepia filter"),
    ("high_bw",   bw_bgr,    "high contrast B&W"),
    ("overexposed",overexp,  "overexposed mean>220"),
]:
    record(name, img, desc)

# ── WATERMARK/OVERLAY (10) ────────────────────────────────────────────────────
log("[AGENT1] === WATERMARKS/OVERLAYS ===")
def overlay_tests():
    tests = []
    # 1 semi-transparent SAMPLE text
    i=base.copy(); overlay=i.copy()
    cv2.putText(overlay,"SAMPLE",(100,300),cv2.FONT_HERSHEY_SIMPLEX,5,(200,200,200),10)
    tests.append(("watermark_sample", cv2.addWeighted(i,0.7,overlay,0.3,0), "SAMPLE watermark"))
    # 2 shadow top-left
    i=base.copy()
    shadow=np.zeros_like(i); shadow[:200,:200]=80
    tests.append(("shadow_topleft", cv2.subtract(i,shadow), "shadow top-left"))
    # 3 glare center
    i=base.copy(); h,w=i.shape[:2]
    glare=np.zeros((h,w),np.uint8)
    cv2.ellipse(glare,(w//2,h//2),(120,80),0,0,360,200,-1)
    glare=cv2.GaussianBlur(glare,(51,51),0)
    for c in range(3): i[:,:,c]=np.clip(i[:,:,c].astype(np.int32)+glare,0,255)
    tests.append(("glare_center",i,"center glare"))
    # 4 finger corner
    i=base.copy()
    cv2.rectangle(i,(0,h-100),(200,h),(200,150,130),-1)
    tests.append(("finger_corner",i,"finger bottom-left"))
    # 5 horizontal scratch
    i=base.copy()
    cv2.line(i,(0,h//2),(w,h//2),(180,180,180),3)
    tests.append(("scratch_horiz",i,"horizontal scratch"))
    # 6 vertical scratch
    i=base.copy()
    cv2.line(i,(w//2,0),(w//2,h),(180,180,180),3)
    tests.append(("scratch_vert",i,"vertical scratch"))
    # 7 dirt spots
    i=base.copy()
    for _ in range(20):
        cx,cy=np.random.randint(0,w),np.random.randint(0,h)
        cv2.circle(i,(cx,cy),np.random.randint(2,8),(30,30,30),-1)
    tests.append(("dirt_spots",i,"dirt spots"))
    # 8 worn edges
    i=base.copy()
    for c in range(3): i[:30,:,c]=i[:30,:,c]//2; i[-30:,:,c]=i[-30:,:,c]//2
    tests.append(("worn_edges",i,"worn edges"))
    # 9 lamination glare
    i=base.copy(); strip=np.zeros((h,w),np.uint8)
    pts=np.array([[0,0],[100,0],[w,h],[w-100,h]],np.int32)
    cv2.fillPoly(strip,[pts],120); strip=cv2.GaussianBlur(strip,(31,31),0)
    for c in range(3): i[:,:,c]=np.clip(i[:,:,c].astype(np.int32)+strip,0,255)
    tests.append(("lamination_glare",i,"lamination diagonal glare"))
    # 10 partial black bar right
    i=base.copy(); i[:,w-80:]=0
    tests.append(("black_bar_right",i,"black bar right side"))
    return tests

for name, img, desc in overlay_tests():
    record(name, img, desc)

# ── SUMMARY ───────────────────────────────────────────────────────────────────
total  = len(results)
passed = sum(1 for r in results if r["pass"])
failed = total - passed
times  = [r["ms"] for r in results]
slowest = max(results, key=lambda r: r["ms"])
fastest = min(results, key=lambda r: r["ms"])
failures = [r for r in results if not r["pass"]]
fail_reasons = {}
for r in failures:
    k = r["reason"][:50]
    fail_reasons[k] = fail_reasons.get(k,0)+1
most_common_fail = max(fail_reasons, key=fail_reasons.get) if fail_reasons else "N/A"

log("")
log("="*60)
log(f"[AGENT1] SUMMARY")
log(f"[AGENT1] Total tests:    {total}")
log(f"[AGENT1] Passed:         {passed}")
log(f"[AGENT1] Failed:         {failed}")
log(f"[AGENT1] Pass rate:      {passed/total*100:.1f}%")
log(f"[AGENT1] Avg time:       {sum(times)/len(times):.1f}ms")
log(f"[AGENT1] Slowest:        {slowest['name']} ({slowest['ms']:.1f}ms)")
log(f"[AGENT1] Fastest:        {fastest['name']} ({fastest['ms']:.1f}ms)")
log(f"[AGENT1] Most common failure: {most_common_fail}")
log("="*60)

import json
summary = {"agent":"Agent1-ImageQuality","total":total,"passed":passed,"failed":failed,
           "pass_rate":f"{passed/total*100:.1f}%","avg_ms":round(sum(times)/len(times),1),
           "failures":[{"test":r["name"],"reason":r["reason"]} for r in failures]}
with open(os.path.join(LOG_BASE, f"agent1_summary_{TS}.json"),"w") as f:
    json.dump(summary, f, indent=2)
fh.close()
print(f"\nAgent 1 complete. Log: {LOG_BASE}/agent1_quality_{TS}.log")
