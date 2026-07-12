"""Shared utilities for all stress test agents."""
import os, sys, time
from datetime import datetime

# ── Path setup ────────────────────────────────────────────────────────────────
_THIS    = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(os.path.dirname(_THIS))
_PARENT  = os.path.dirname(_VF_ROOT)
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

LOG_BASE = "D:/vision_logs/stress_test"
IMG_DIR  = os.path.join(LOG_BASE, "images")
os.makedirs(LOG_BASE, exist_ok=True)
os.makedirs(IMG_DIR,  exist_ok=True)

TEST_IMG = os.path.join(_VF_ROOT, "tests", "test_images", "sharp_document.jpg")

import cv2, numpy as np


def make_logger(log_file: str):
    fh = open(log_file, "w", encoding="utf-8")
    def log(msg: str):
        ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        line = f"[{ts}] {msg}"
        print(line, flush=True)
        fh.write(line + "\n"); fh.flush()
    return log, fh


def run_pipeline(image: np.ndarray):
    """Run full document pipeline; return (success, confidence, step_times, message, ms)."""
    try:
        from vision_framework.plugins.kyc.pipelines.document_pipeline import DocumentPipeline
        pipe = DocumentPipeline()
        t0   = time.perf_counter()
        res  = pipe.execute(image)
        elapsed = (time.perf_counter() - t0) * 1000
        return res.get("success", False), res.get("result", {}).get("document_detection", {}).get("confidence", 0.0), res.get("step_times", {}), res.get("reason", ""), elapsed
    except Exception as e:
        return False, 0.0, {}, str(e), 0.0


def run_detection(image: np.ndarray):
    """Run only blur + document detection (fast, ~10-20ms). No OCR.
    Returns (detected, confidence, reason, elapsed_ms)."""
    try:
        from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
        from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
        t0 = time.perf_counter()
        blur_res = BlurProcessor().process(image)
        if not blur_res.get("success", False):
            return False, 0.0, blur_res.get("message", "blur_fail"), (time.perf_counter()-t0)*1000
        det_res  = DocumentDetector().detect(image)
        detected = det_res.get("detected", False)
        conf     = float(det_res.get("confidence", 0.0))
        msg      = det_res.get("message", "")
        return detected, conf, msg, (time.perf_counter()-t0)*1000
    except Exception as e:
        return False, 0.0, str(e), 0.0


def blur_variance(img: np.ndarray) -> float:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def save_failure(name: str, img: np.ndarray):
    path = os.path.join(IMG_DIR, f"fail_{name}.jpg")
    try:
        cv2.imwrite(path, img)
    except Exception:
        pass


def make_doc_image(bg_w=800, bg_h=600, bg_color=(50, 50, 50),
                   card_w=500, card_h=300, card_color=(255,255,255)) -> np.ndarray:
    canvas = np.full((bg_h, bg_w, 3), bg_color, dtype=np.uint8)
    cx = (bg_w - card_w) // 2
    cy = (bg_h - card_h) // 2
    card = np.full((card_h, card_w, 3), card_color, dtype=np.uint8)
    cv2.rectangle(card, (0,0), (card_w, 55), (180,50,10), -1)
    cv2.putText(card, "TEST AADHAAR", (10,47), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (255,255,255), 3, cv2.LINE_AA)
    cv2.putText(card, "Name: Test User", (10,130), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2, cv2.LINE_AA)
    cv2.putText(card, "DOB: 01/01/1990",  (10,170), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2, cv2.LINE_AA)
    cv2.putText(card, "2345 6789 0123",   (100,285), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,0), 3, cv2.LINE_AA)
    cv2.rectangle(card, (0,0), (card_w-1, card_h-1), (0,0,0), 5)
    canvas[cy:cy+card_h, cx:cx+card_w] = card
    return canvas
