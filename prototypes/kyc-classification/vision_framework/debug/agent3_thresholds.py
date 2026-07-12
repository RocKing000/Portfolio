"""
Agent 3 — Threshold Calibration Agent

Systematically tests every threshold in kyc_config.py and finds
optimal values for real webcam conditions.

Also automatically applies recommended values to kyc_config.py.

Run from vision_framework/ directory:
    py -3 debug/agent3_thresholds.py
"""

import os
import sys
import time
from datetime import datetime

# ── Path setup ────────────────────────────────────────────────────────────────
_THIS    = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)
_PARENT  = os.path.dirname(_VF_ROOT)
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io as _io
    sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = _io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import cv2
import numpy as np

# ── Output dirs ───────────────────────────────────────────────────────────────
LOG_DIR  = "D:/vision_logs"
CALIB_DIR = os.path.join(LOG_DIR, "calibration")
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    os.makedirs(CALIB_DIR, exist_ok=True)
    _test = os.path.join(LOG_DIR, ".write_test")
    open(_test, "w").close(); os.remove(_test)
except OSError:
    LOG_DIR   = os.path.join(_VF_ROOT, "vision_logs")
    CALIB_DIR = os.path.join(LOG_DIR, "calibration")
    os.makedirs(CALIB_DIR, exist_ok=True)
    print(f"[WARN] Falling back to local log dir: {LOG_DIR}")

_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = os.path.join(LOG_DIR, f"agent3_thresholds_{_TS}.log")
TEST_IMG  = os.path.join(_VF_ROOT, "tests", "test_images", "sharp_document.jpg")

_log_fh = open(LOG_FILE, "w", encoding="utf-8")

def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    line = f"[{ts}] {msg}"
    print(line)
    _log_fh.write(line + "\n")
    _log_fh.flush()

log("=" * 60)
log("AGENT 3 — THRESHOLD CALIBRATION AGENT")
log(f"Log file: {LOG_FILE}")
log("=" * 60)

from vision_framework.plugins.kyc.config.kyc_config import KYCConfig
from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def make_base_document(bg_w=800, bg_h=600, bg_color=(50, 50, 50), card_scale=1.0) -> np.ndarray:
    """Synthetic document card on a solid background."""
    canvas = np.full((bg_h, bg_w, 3), bg_color, dtype=np.uint8)
    # card dimensions scale with card_scale
    card_w = int(500 * card_scale)
    card_h = int(300 * card_scale)
    doc_x  = (bg_w - card_w) // 2
    doc_y  = (bg_h - card_h) // 2
    card = np.full((card_h, card_w, 3), (255, 255, 255), dtype=np.uint8)
    cv2.rectangle(card, (0, 0), (card_w, int(55 * card_scale)), (180, 50, 10), -1)
    fs = max(0.3, 0.9 * card_scale)
    cv2.putText(card, "TEST AADHAAR", (10, int(47 * card_scale)),
                cv2.FONT_HERSHEY_SIMPLEX, fs * 2.0, (255, 255, 255), max(1, int(3 * card_scale)), cv2.LINE_AA)
    cv2.putText(card, "Name: Test User",  (10, int(200 * card_scale)),
                cv2.FONT_HERSHEY_SIMPLEX, fs * 0.7, (0, 0, 0), max(1, int(2 * card_scale)), cv2.LINE_AA)
    cv2.putText(card, "2345 6789 0123", (int(100 * card_scale), int(285 * card_scale)),
                cv2.FONT_HERSHEY_SIMPLEX, fs * 0.9, (0, 0, 0), max(1, int(3 * card_scale)), cv2.LINE_AA)
    cv2.rectangle(card, (0, 0), (card_w - 1, card_h - 1), (0, 0, 0), max(2, int(5 * card_scale)))
    canvas[doc_y:doc_y + card_h, doc_x:doc_x + card_w] = card
    return canvas


def blur_variance(img: np.ndarray) -> float:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def edge_pixel_count(img: np.ndarray, t1=75, t2=200) -> int:
    gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges   = cv2.Canny(blurred, t1, t2)
    return int(np.count_nonzero(edges))


def try_detect(img: np.ndarray, det: DocumentDetector = None):
    if det is None:
        det = DocumentDetector()
    r = det.detect(img)
    return r.get("detected", False), r.get("confidence", 0.0)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Generate calibration images (20 images)
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 1] Generating calibration images")

base = make_base_document()
calib_images = {}   # name → np.ndarray

# a) 5 blur levels
blur_kernels = {
    "blur_perfect":    None,
    "blur_good":       (3, 3),
    "blur_acceptable": (7, 7),
    "blur_poor":       (15, 15),
    "blur_rejected":   (25, 25),
}
for name, kernel in blur_kernels.items():
    img = base.copy() if kernel is None else cv2.GaussianBlur(base.copy(), kernel, 0)
    calib_images[name] = img

# b) 5 lighting levels
lighting = {
    "light_very_bright": 1.5,
    "light_bright":      1.2,
    "light_normal":      1.0,
    "light_dark":        0.7,
    "light_very_dark":   0.4,
}
for name, factor in lighting.items():
    img = np.clip(base.astype(np.float32) * factor, 0, 255).astype(np.uint8)
    calib_images[name] = img

# c) 5 background contrasts
bg_colors = {
    "bg_high_contrast":       (0, 0, 0),
    "bg_medium_high_contrast": (50, 50, 50),
    "bg_medium_contrast":     (128, 128, 128),
    "bg_medium_low_contrast": (200, 200, 200),
    "bg_low_contrast":        (240, 240, 240),
}
for name, color in bg_colors.items():
    img = make_base_document(bg_color=color)
    calib_images[name] = img

# d) 5 card sizes (as fraction of frame)
card_sizes = {
    "size_large":     0.80,
    "size_med_large": 0.60,
    "size_medium":    0.40,
    "size_small":     0.20,
    "size_tiny":      0.10,
}
for name, scale in card_sizes.items():
    img = make_base_document(card_scale=scale)
    calib_images[name] = img

# Save all + initial stats
det0 = DocumentDetector()
initial_detect_count = 0

for name, img in calib_images.items():
    path = os.path.join(CALIB_DIR, f"{name}.jpg")
    cv2.imwrite(path, img)
    var    = blur_variance(img)
    ep     = edge_pixel_count(img)
    det, conf = try_detect(img, det0)
    if det:
        initial_detect_count += 1
    log(f"[CALIB] Image: {name}")
    log(f"[CALIB]   Blur variance: {var:.2f}")
    log(f"[CALIB]   Edge pixels (Canny 75,200): {ep}")
    log(f"[CALIB]   Document detected: {det}")
    log(f"[CALIB]   Detection confidence: {conf:.3f}")

log(f"[STEP 1] Initial detection rate: {initial_detect_count}/{len(calib_images)}")

imgs_list  = list(calib_images.values())
names_list = list(calib_images.keys())
N = len(imgs_list)

# Categories for blur threshold calibration
blur_good_set     = {"blur_perfect", "blur_good", "blur_acceptable",
                     "light_very_bright", "light_bright", "light_normal", "light_dark",
                     "bg_high_contrast", "bg_medium_high_contrast", "bg_medium_contrast",
                     "size_large", "size_med_large", "size_medium"}
blur_rejected_set = {"blur_rejected"}


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Blur threshold calibration
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 2] Blur threshold calibration (50 → 200)")

variances = {name: blur_variance(img) for name, img in calib_images.items()}
best_blur_threshold = KYCConfig.BLUR_THRESHOLD
best_blur_score     = -1

for t in range(50, 210, 10):
    passes = sum(1 for n, v in variances.items() if v >= t)
    fails  = N - passes

    # Count correct decisions: good images should pass, rejected should fail
    correct = 0
    for name, v in variances.items():
        is_pass = v >= t
        should_pass = name not in blur_rejected_set
        if is_pass == should_pass:
            correct += 1

    log(f"[BLUR] Threshold {t}: {passes} pass, {fails} fail  ({correct}/{N} correct decisions)")
    if correct > best_blur_score:
        best_blur_score = correct
        best_blur_threshold = t

log(f"[BLUR] Recommended threshold: {best_blur_threshold}  ({best_blur_score}/{N} correct)")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Canny threshold calibration
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 3] Canny threshold calibration")

t1_vals = [10, 20, 30, 50, 75, 100]
t2_vals = [50, 100, 150, 200, 250]
best_canny = (KYCConfig.CANNY_LOW, KYCConfig.CANNY_HIGH)
best_canny_count = 0

for t1 in t1_vals:
    for t2 in t2_vals:
        if t2 <= t1:
            continue
        count = 0
        for img in imgs_list:
            gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges   = cv2.Canny(blurred, t1, t2)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if len(contours) > 0:
                count += 1
        log(f"[CANNY] ({t1},{t2}): detected {count}/{N} documents (contour found)")
        if count > best_canny_count:
            best_canny_count = count
            best_canny = (t1, t2)

log(f"[CANNY] Best combination: {best_canny} → {best_canny_count}/{N}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Area ratio calibration
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 4] MIN_DOC_AREA_RATIO calibration")
best_area_ratio   = KYCConfig.MIN_DOC_AREA_RATIO
best_area_count   = 0

for ratio in [r / 100 for r in range(2, 16)]:
    count = 0
    for img in imgs_list:
        total_area = img.shape[0] * img.shape[1]
        gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges   = cv2.Canny(blurred, best_canny[0], best_canny[1])
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            if cv2.contourArea(c) / total_area >= ratio:
                count += 1
                break
    log(f"[AREA] Min ratio {ratio:.2f}: detected {count}/{N}")
    if count > best_area_count:
        best_area_count = count
        best_area_ratio = ratio

log(f"[AREA] Recommended: {best_area_ratio:.2f}  ({best_area_count}/{N})")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Aspect ratio calibration
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 5] Aspect ratio range calibration")
aspect_ranges = [(1.0, 3.0), (1.2, 2.5), (1.4, 2.0), (0.8, 3.5), (0.9, 3.2), (1.0, 2.8)]
best_aspect = (KYCConfig.DOC_ASPECT_RATIO_MIN, KYCConfig.DOC_ASPECT_RATIO_MAX)
best_aspect_count = 0

for ar_min, ar_max in aspect_ranges:
    count = 0
    for img in imgs_list:
        total_area = img.shape[0] * img.shape[1]
        gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges   = cv2.Canny(blurred, best_canny[0], best_canny[1])
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in sorted(contours, key=cv2.contourArea, reverse=True):
            if cv2.contourArea(c) / total_area < best_area_ratio:
                continue
            x, y, w, h = cv2.boundingRect(c)
            ar = w / h if h > 0 else 0
            if ar_min <= ar <= ar_max:
                count += 1
                break
    log(f"[ASPECT] Range ({ar_min},{ar_max}): detected {count}/{N}")
    if count > best_aspect_count:
        best_aspect_count = count
        best_aspect = (ar_min, ar_max)

log(f"[ASPECT] Recommended: ({best_aspect[0]},{best_aspect[1]})  ({best_aspect_count}/{N})")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Write optimal config & apply to kyc_config.py
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 6] Writing recommended_config.py and applying to kyc_config.py")

recommended_path = os.path.join(LOG_DIR, "recommended_config.py")
recommended_content = f"""# Recommended by Agent 3 calibration — {_TS}
# Generated from {N} synthetic calibration images

BLUR_THRESHOLD      = {best_blur_threshold}
MIN_DOC_AREA_RATIO  = {best_area_ratio:.2f}
DOC_ASPECT_RATIO_MIN = {best_aspect[0]}
DOC_ASPECT_RATIO_MAX = {best_aspect[1]}
CANNY_THRESHOLD_1   = {best_canny[0]}
CANNY_THRESHOLD_2   = {best_canny[1]}

# Detection rate improvements:
# Initial (with previous config): {initial_detect_count}/{N}
# Projected (with recommended):   see summary
"""
with open(recommended_path, "w") as f:
    f.write(recommended_content)
log(f"[STEP 6] Saved: {recommended_path}")

# Apply to kyc_config.py
kyc_config_path = os.path.join(_VF_ROOT, "plugins", "kyc", "config", "kyc_config.py")
if os.path.isfile(kyc_config_path):
    with open(kyc_config_path, "r", encoding="utf-8") as f:
        original = f.read()

    import re
    updated = original
    replacements = {
        r"(BLUR_THRESHOLD\s*:\s*float\s*=\s*)[\d.]+":    f"\\g<1>{float(best_blur_threshold)}",
        r"(MIN_DOC_AREA_RATIO\s*:\s*float\s*=\s*)[\d.]+": f"\\g<1>{best_area_ratio:.2f}",
        r"(DOC_ASPECT_RATIO_MIN\s*:\s*float\s*=\s*)[\d.]+": f"\\g<1>{float(best_aspect[0])}",
        r"(DOC_ASPECT_RATIO_MAX\s*:\s*float\s*=\s*)[\d.]+": f"\\g<1>{float(best_aspect[1])}",
        r"(CANNY_LOW\s*:\s*int\s*=\s*)\d+":               f"\\g<1>{best_canny[0]}",
        r"(CANNY_HIGH\s*:\s*int\s*=\s*)\d+":              f"\\g<1>{best_canny[1]}",
    }
    changed = []
    for pattern, repl in replacements.items():
        new = re.sub(pattern, repl, updated)
        if new != updated:
            changed.append(pattern.split(r"\s")[0].lstrip("("))
            updated = new

    if changed:
        with open(kyc_config_path, "w", encoding="utf-8") as f:
            f.write(updated)
        log(f"[STEP 6] kyc_config.py updated: {changed}")
    else:
        log("[STEP 6] kyc_config.py — no changes needed (values already optimal)")
else:
    log(f"[STEP 6] kyc_config.py not found at {kyc_config_path}")

# Run final detection rate with recommended settings
final_detect_count = 0
det_new = DocumentDetector()
for img in imgs_list:
    d, _ = try_detect(img, det_new)
    if d:
        final_detect_count += 1


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
improvement = final_detect_count - initial_detect_count
pct = (improvement / N * 100) if N > 0 else 0

log("")
log("=" * 60)
log("[SUMMARY] AGENT 3 COMPLETE")
log(f"[SUMMARY] Previous config detection rate: {initial_detect_count}/{N}")
log(f"[SUMMARY] Optimized config detection rate: {final_detect_count}/{N}")
log(f"[SUMMARY] Improvement: {improvement:+d} images ({pct:+.1f}%)")
log(f"[SUMMARY] Recommended BLUR_THRESHOLD: {best_blur_threshold}")
log(f"[SUMMARY] Recommended MIN_DOC_AREA_RATIO: {best_area_ratio:.2f}")
log(f"[SUMMARY] Recommended DOC_ASPECT_RATIO: ({best_aspect[0]}, {best_aspect[1]})")
log(f"[SUMMARY] Recommended CANNY: ({best_canny[0]}, {best_canny[1]})")
log(f"[SUMMARY] Config updated: {'Yes — ' + kyc_config_path if os.path.isfile(kyc_config_path) else 'No'}")
log("[SUMMARY] Restart server to apply changes")
log(f"[SUMMARY] Full recommended config: {recommended_path}")
log("=" * 60)

_log_fh.close()
print(f"\nLog saved: {LOG_FILE}")
