"""
Agent 1 — Image Pipeline Agent

Traces every transformation an image goes through in the vision pipeline.
Runs independently without FastAPI.

Run from vision_framework/ directory:
    py -3 debug/agent1_image_pipeline.py
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
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import cv2
import numpy as np

# ── Output dirs ───────────────────────────────────────────────────────────────
LOG_DIR = "D:/vision_logs"
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    # quick write-test
    _test = os.path.join(LOG_DIR, ".write_test")
    open(_test, "w").close(); os.remove(_test)
except OSError:
    LOG_DIR = os.path.join(_VF_ROOT, "vision_logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"[WARN] Falling back to local log dir: {LOG_DIR}")

_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = os.path.join(LOG_DIR, f"agent1_image_pipeline_{_TS}.log")
TEST_IMG  = os.path.join(_VF_ROOT, "tests", "test_images", "sharp_document.jpg")


# ── Logger ────────────────────────────────────────────────────────────────────
_log_fh = open(LOG_FILE, "w", encoding="utf-8")

def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    line = f"[{ts}] {msg}"
    print(line)
    _log_fh.write(line + "\n")
    _log_fh.flush()

def save_img(filename: str, img: np.ndarray) -> None:
    path = os.path.join(LOG_DIR, filename)
    cv2.imwrite(path, img)
    log(f"  Saved: {path}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 0 — Image sources
# ══════════════════════════════════════════════════════════════════════════════
log("=" * 60)
log("AGENT 1 — IMAGE PIPELINE AGENT")
log(f"Log file: {LOG_FILE}")
log("=" * 60)

# 0a — disk file
log("[STEP 0a] Source: disk file")
log(f"[STEP 0a] Path: {TEST_IMG}")
file_exists = os.path.isfile(TEST_IMG)
log(f"[STEP 0a] File exists: {file_exists}")

img_disk = None
if file_exists:
    file_size = os.path.getsize(TEST_IMG)
    log(f"[STEP 0a] File size bytes: {file_size}")
    img_disk = cv2.imread(TEST_IMG)
    loaded = img_disk is not None and img_disk.size > 0
    log(f"[STEP 0a] Image loaded: {loaded}")
    if loaded:
        log(f"[STEP 0a] Shape: {img_disk.shape}")
        log(f"[STEP 0a] dtype: {img_disk.dtype}")
        log(f"[STEP 0a] Min pixel: {img_disk.min()}")
        log(f"[STEP 0a] Max pixel: {img_disk.max()}")
        log(f"[STEP 0a] Mean pixel: {img_disk.mean():.2f}")
        log(f"[STEP 0a] Is entirely black: {img_disk.max() == 0}")
        log(f"[STEP 0a] Is entirely white: {img_disk.min() == 255}")
        log(f"[STEP 0a] Has content: {img_disk.max() > 0 and img_disk.min() < 255}")
        thumb = cv2.resize(img_disk, (320, 240))
        save_img("step0a_source.jpg", thumb)
    else:
        log("[STEP 0a] ERROR: Could not load image from disk")
else:
    log("[STEP 0a] ERROR: Test image not found — run tests/generate_test_images.py first")

# 0b — simulate Angular camera capture
log("[STEP 0b] Source: simulated camera (cv2.VideoCapture(0))")
cap = cv2.VideoCapture(0)
img_camera = None
if cap.isOpened():
    ret, frame = cap.read()
    cap.release()
    if ret and frame is not None and frame.size > 0:
        img_camera = frame
        log(f"[STEP 0b] Camera frame captured: True")
        log(f"[STEP 0b] Shape: {img_camera.shape}")
        log(f"[STEP 0b] Mean pixel: {img_camera.mean():.2f}")
        save_img("step0b_camera.jpg", img_camera)
    else:
        log("[STEP 0b] Camera opened but frame read failed — using test image as stand-in")
        img_camera = img_disk
else:
    cap.release()
    log("[STEP 0b] No camera available — using disk image as stand-in")
    img_camera = img_disk

# 0c — base64 round trip
log("[STEP 0c] Source: base64 round trip")
if img_disk is not None:
    _, enc_buf = cv2.imencode(".jpg", img_disk)
    import base64
    b64_str = base64.b64encode(enc_buf.tobytes()).decode("utf-8")
    log(f"[STEP 0c] Base64 string length: {len(b64_str)} chars")
    arr = np.frombuffer(base64.b64decode(b64_str), dtype=np.uint8)
    img_b64 = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    identical = img_b64 is not None and img_b64.shape == img_disk.shape
    log(f"[STEP 0c] Decoded image shape: {img_b64.shape if img_b64 is not None else 'None'}")
    log(f"[STEP 0c] Round-trip identical shape: {identical}")
    if img_b64 is not None:
        diff = float(np.abs(img_disk.astype(np.int32) - img_b64.astype(np.int32)).max())
        log(f"[STEP 0c] Max pixel diff after round-trip: {diff:.1f}")
    save_img("step0c_b64_decoded.jpg", img_b64 if img_b64 is not None else np.zeros((240, 320, 3), np.uint8))
else:
    log("[STEP 0c] Skipped — no source image loaded")

# Choose primary image for rest of pipeline
image = img_disk if img_disk is not None else img_camera
if image is None:
    log("[FATAL] No image available for pipeline test. Exiting.")
    _log_fh.close()
    sys.exit(1)

log(f"[INFO] Using image shape {image.shape} for steps 1-9")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Blur detection
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 1] BlurProcessor called")
log(f"[STEP 1] Input shape: {image.shape}")

try:
    from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
    bp = BlurProcessor()
    t0 = time.perf_counter()

    gray_check = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    log("[STEP 1] Grayscale conversion: success")

    lap_var = float(cv2.Laplacian(gray_check, cv2.CV_64F).var())
    log("[STEP 1] Laplacian computed: success")
    log(f"[STEP 1] Variance score: {lap_var:.2f}")

    blur_result = bp.process(image)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    log(f"[STEP 1] Threshold: {blur_result['metadata']['threshold']}")
    log(f"[STEP 1] Decision: {'PASS' if blur_result['success'] else 'FAIL'}")
    log(f"[STEP 1] Time taken: {elapsed_ms:.1f}ms")

    if not blur_result["success"]:
        log(f"[STEP 1] FAIL message: {blur_result['message']}")
        log("[STEP 1] Pipeline blocked at blur check — this is the bottleneck")
    else:
        log("[STEP 1] Blur check passed — continuing to Step 2")
except Exception as e:
    log(f"[STEP 1] ERROR: {e}")
    blur_result = {"success": True}  # assume pass so we can test the rest


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Grayscale conversion
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 2] Grayscale conversion")
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image.copy()
log(f"[STEP 2] Grayscale shape: {gray.shape}")
log(f"[STEP 2] Grayscale min: {gray.min()}, max: {gray.max()}, mean: {gray.mean():.2f}")
log(f"[STEP 2] All zeros: {gray.max() == 0}")
save_img("step2_grayscale.jpg", gray)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Gaussian blur
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 3] Gaussian blur (5,5)")
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
log(f"[STEP 3] Blurred shape: {blurred.shape}")
log(f"[STEP 3] Blurred min: {blurred.min()}, max: {blurred.max()}, mean: {blurred.mean():.2f}")
save_img("step3_blurred.jpg", blurred)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Canny edge detection (multiple thresholds)
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 4] Canny edge detection — testing 5 threshold combinations")
canny_configs = [(10, 50), (30, 100), (50, 150), (75, 200), (100, 250)]
total_px = blurred.size
best_edges = None
best_count = 0

for t1, t2 in canny_configs:
    edges = cv2.Canny(blurred, t1, t2)
    count = int(np.count_nonzero(edges))
    pct   = count / total_px * 100
    log(f"[STEP 4] Canny({t1},{t2}) edge pixels: {count} / {total_px} = {pct:.2f}%")
    save_img(f"step4_canny_{t1}_{t2}.jpg", edges)
    if count > best_count:
        best_count = count
        best_edges = edges
        best_t = (t1, t2)

log(f"[STEP 4] Best Canny: {best_t} with {best_count} edge pixels")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Contour detection
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 5] Contour detection")
contours, _ = cv2.findContours(best_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
total_area = image.shape[0] * image.shape[1]
log(f"[STEP 5] Total contours found: {len(contours)}")
log(f"[STEP 5] Image total area: {total_area} px")

sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)
contour_img = image.copy()
cv2.drawContours(contour_img, sorted_contours, -1, (0, 255, 0), 2)

for i, c in enumerate(sorted_contours[:10]):
    area   = cv2.contourArea(c)
    ratio  = area / total_area
    perim  = cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, 0.04 * perim, True)
    log(f"[STEP 5] Contour {i}: area={area:.0f}, ratio={ratio:.4f}, "
        f"perimeter={perim:.0f}, approx_sides={len(approx)}")

save_img("step5_contours.jpg", contour_img)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Quadrilateral filtering
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 6] Quadrilateral filtering")
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

ih, iw = image.shape[:2]
img_cx, img_cy = iw / 2, ih / 2
quad_img = image.copy()

for i, c in enumerate(sorted_contours[:15]):
    area = cv2.contourArea(c)
    if area / total_area < KYCConfig.MIN_DOC_AREA_RATIO:
        continue
    perim  = cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, KYCConfig.CONTOUR_APPROX_EPSILON * perim, True)
    sides  = len(approx)
    is_quad = sides == 4
    log(f"[STEP 6] Contour {i}: sides after approx = {sides}")
    log(f"[STEP 6] Contour {i}: is quadrilateral = {is_quad}")

    x, y, w, h = cv2.boundingRect(c)
    aspect = w / h if h > 0 else 0
    passes_aspect = KYCConfig.DOC_ASPECT_RATIO_MIN <= aspect <= KYCConfig.DOC_ASPECT_RATIO_MAX
    log(f"[STEP 6] Contour {i}: aspect ratio = {aspect:.3f}")
    log(f"[STEP 6] Contour {i}: passes aspect filter = {passes_aspect}")

    M = cv2.moments(c)
    if M["m00"] > 0:
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]
        offset = ((cx - img_cx) ** 2 + (cy - img_cy) ** 2) ** 0.5
        max_offset = KYCConfig.CENTER_BIAS_RATIO * min(iw, ih) / 2
        in_center = offset <= max_offset
        log(f"[STEP 6] Contour {i}: center offset from image center = {offset:.0f}px "
            f"(max allowed {max_offset:.0f}px) — {'OK' if in_center else 'OUTSIDE'}")

    conf = 0.0
    if is_quad and passes_aspect:
        conf = min(1.0, (area / total_area) / 0.15)
    log(f"[STEP 6] Contour {i}: confidence score = {conf:.3f}")

    if is_quad:
        cv2.drawContours(quad_img, [approx], -1, (0, 0, 255), 3)

save_img("step6_quads.jpg", quad_img)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Full DocumentDetector.detect()
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 7] DocumentDetector.detect() called")
try:
    from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
    det = DocumentDetector()
    t0 = time.perf_counter()
    det_result = det.detect(image)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    log(f"[STEP 7] detected: {det_result.get('detected', False)}")
    log(f"[STEP 7] confidence: {det_result.get('confidence', 0)}")
    log(f"[STEP 7] message: {det_result.get('message', '')}")
    log(f"[STEP 7] Time taken: {elapsed_ms:.1f}ms")
    log(f"[STEP 7] Full result keys: {list(det_result.keys())}")
except Exception as e:
    log(f"[STEP 7] ERROR calling DocumentDetector.detect(): {e}")
    det_result = {}


# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Perspective correction
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 8] PerspectiveCorrector")
corners = det_result.get("corners")
if corners is not None:
    try:
        from vision_framework.plugins.kyc.processors.perspective_corrector import PerspectiveCorrector
        pc = PerspectiveCorrector()
        pc_result = pc.process(image, corners=corners)
        corrected = pc_result.get("image")
        if corrected is not None:
            log(f"[STEP 8] Output shape: {corrected.shape}")
            h2, w2 = corrected.shape[:2]
            log(f"[STEP 8] Output aspect ratio: {w2/h2:.3f}")
            save_img("step8_corrected.jpg", corrected)
        else:
            log("[STEP 8] PerspectiveCorrector returned no image")
        corrected_image = corrected if corrected is not None else image
    except Exception as e:
        log(f"[STEP 8] ERROR: {e}")
        corrected_image = image
else:
    log("[STEP 8] No corners from detector — using original image for OCR")
    corrected_image = image


# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — OCR
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 9] OCRExtractor called")
try:
    from vision_framework.plugins.kyc.extractors.ocr_extractor import OCRExtractor
    ocr = OCRExtractor()
    log(f"[STEP 9] Languages: {KYCConfig.OCR_LANGUAGES}")
    t0 = time.perf_counter()
    ocr_result = ocr.extract(corrected_image)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    raw_texts = ocr_result.get("raw_texts", []) or ocr_result.get("extracted_data", {}).get("raw_texts", [])
    log(f"[STEP 9] Number of text regions: {len(raw_texts)}")
    for i, t in enumerate(raw_texts[:20]):
        log(f"[STEP 9]   [{i}] {t}")

    exdata = ocr_result.get("extracted_data", {})
    uid = exdata.get("uid") or exdata.get("aadhaar_number") or exdata.get("document_number")
    log(f"[STEP 9] Looking for Aadhaar pattern...")
    log(f"[STEP 9] Extracted number: {uid}")
    log(f"[STEP 9] Time taken: {elapsed_ms:.1f}ms")
except Exception as e:
    log(f"[STEP 9] ERROR: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
log("")
log("=" * 60)
log("[SUMMARY] AGENT 1 COMPLETE")

# Determine where pipeline broke
if not blur_result.get("success", True):
    broke_at = "Step 1 — Blur detection"
    root_cause = f"Laplacian variance {lap_var:.1f} below threshold {KYCConfig.BLUR_THRESHOLD}"
    fix = f"Lower BLUR_THRESHOLD below {lap_var:.0f} in kyc_config.py, or improve image quality"
elif not det_result.get("detected", False):
    broke_at = "Step 7 — Document detection"
    root_cause = f"No document contour found: {det_result.get('message', 'unknown')}"
    fix = "Loosen MIN_DOC_AREA_RATIO, CANNY thresholds, or CENTER_BIAS_RATIO in kyc_config.py"
else:
    broke_at = "None — pipeline completed successfully"
    root_cause = "N/A"
    fix = "N/A"

log(f"[SUMMARY] Pipeline broke at step: {broke_at}")
log(f"[SUMMARY] Root cause: {root_cause}")
log(f"[SUMMARY] Recommended fix: {fix}")
log(f"[SUMMARY] All debug images saved to: {LOG_DIR}")
log("=" * 60)

_log_fh.close()
print(f"\nLog saved: {LOG_FILE}")
