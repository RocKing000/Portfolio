"""
test_perspective_fix.py -- Regression tests for perspective correction fixes.

Tests:
  1. Corner ordering    -- 100 random shuffles all produce correct TL/TR/BR/BL
  2. Warp validation    -- valid card passes, black/white/flat images fail
  3. Content scoring    -- card region scores high, dark hand scores low
  4. Full pipeline      -- end-to-end warp on synthetic card produces landscape output
"""

import os
import sys
import json
import time
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import cv2
import numpy as np

from vision_framework.plugins.kyc.processors.perspective_corrector import (
    PerspectiveCorrector, CARD_WIDTH, CARD_HEIGHT,
)
from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector

results = []


def log(msg):
    print(msg)


def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    log(f"  [{status}] {name}  {detail}")
    results.append({"test": name, "pass": passed, "detail": detail})


# ── TEST 1 -- Corner ordering ────────────────────────────────────────────────

log("\n[TEST 1] Corner ordering -- 100 random shuffles all produce correct TL/TR/BR/BL")

corrector = PerspectiveCorrector()

# Known corners in canonical order
TL = np.float32([50, 50])
TR = np.float32([350, 50])
BR = np.float32([350, 250])
BL = np.float32([50, 250])
expected = np.float32([TL, TR, BR, BL])

NUM_TRIALS = 100
failures = 0

for _ in range(NUM_TRIALS):
    shuffled = [TL.copy(), TR.copy(), BR.copy(), BL.copy()]
    random.shuffle(shuffled)
    pts = np.float32(shuffled)
    ordered = corrector._order_corners(pts)

    if not np.allclose(ordered, expected, atol=1e-3):
        failures += 1

record(
    "corner_ordering",
    failures == 0,
    f"{NUM_TRIALS - failures}/{NUM_TRIALS} shuffles correct",
)

# ── TEST 2 -- Warp validation ────────────────────────────────────────────────

log("\n[TEST 2] Warp validation -- valid/black/white/flat images")

# Valid card: light background with some content
card_img = np.ones((378, 600, 3), dtype=np.uint8) * 220
cv2.putText(card_img, "TEST CARD CONTENT", (50, 190),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (30, 30, 30), 3)
cv2.rectangle(card_img, (20, 20), (580, 358), (100, 100, 100), 2)

valid_result = PerspectiveCorrector._validate_warp_output(card_img)
record("warp_valid_card", valid_result, f"valid card -> {valid_result} (expected True)")

# Black image
black_img = np.zeros((378, 600, 3), dtype=np.uint8)
black_result = PerspectiveCorrector._validate_warp_output(black_img)
record("warp_black_image", not black_result, f"black image -> {black_result} (expected False)")

# White image
white_img = np.ones((378, 600, 3), dtype=np.uint8) * 255
white_result = PerspectiveCorrector._validate_warp_output(white_img)
record("warp_white_image", not white_result, f"white image -> {white_result} (expected False)")

# Near-flat (no variance) gray
flat_img = np.ones((378, 600, 3), dtype=np.uint8) * 128
flat_result = PerspectiveCorrector._validate_warp_output(flat_img)
record("warp_flat_image", not flat_result, f"flat gray -> {flat_result} (expected False)")

# Noisy image (high variance)
noise_img = np.random.randint(50, 200, (378, 600, 3), dtype=np.uint8)
noise_result = PerspectiveCorrector._validate_warp_output(noise_img)
record("warp_noise_image", noise_result, f"noise image -> {noise_result} (expected True)")

# ── TEST 3 -- Content scoring ────────────────────────────────────────────────

log("\n[TEST 3] Content scoring -- card region high, dark region low, gray medium")

detector = DocumentDetector()

# White card with content: 600x378, full region corners
card_content = np.ones((378, 600, 3), dtype=np.uint8) * 210
cv2.putText(card_content, "AADHAAR", (100, 190),
            cv2.FONT_HERSHEY_SIMPLEX, 2.0, (20, 20, 20), 4)
corners_full = np.float32([[0, 0], [600, 0], [600, 378], [0, 378]])
card_score = detector._validate_quad_content(card_content, corners_full)
record(
    "content_score_card",
    card_score > 0.5,
    f"white card score={card_score:.2f} (expected >0.5)",
)

# Dark hand region: BGR skin color fills entire image
hand_img = np.zeros((378, 600, 3), dtype=np.uint8)
hand_img[:] = [40, 80, 130]  # dark brownish (mean ~83, below 100)
hand_score = detector._validate_quad_content(hand_img, corners_full)
record(
    "content_score_hand",
    hand_score < 0.3,
    f"dark hand score={hand_score:.2f} (expected <0.3)",
)

# Gray background (mid-brightness, low variance)
gray_bg = np.ones((378, 600, 3), dtype=np.uint8) * 140
gray_score = detector._validate_quad_content(gray_bg, corners_full)
record(
    "content_score_gray",
    gray_score <= 0.5,
    f"gray bg score={gray_score:.2f} (expected <=0.5)",
)

# ── TEST 4 -- Full pipeline on synthetic card ────────────────────────────────

log("\n[TEST 4] Full pipeline -- synthetic card -> 600x378 landscape output")

# Build a 476x300 synthetic landscape card (Aadhaar proportions)
synth_card = np.ones((300, 476, 3), dtype=np.uint8) * 230
synth_card[:, :60] = [20, 100, 220]   # orange strip (Aadhaar marker)
cv2.rectangle(synth_card, (0, 0), (475, 299), (180, 180, 180), 2)
cv2.putText(synth_card, "AADHAAR", (100, 160),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (30, 30, 30), 2)

# Supply the exact card corners (slightly shuffled to test ordering)
corners_shuffled = np.float32([
    [476, 300],  # BR
    [0,   300],  # BL
    [476,   0],  # TR
    [0,     0],  # TL
])

corrector2 = PerspectiveCorrector()
res = corrector2.process(synth_card, corners=corners_shuffled)

out_h, out_w = res["image"].shape[:2] if res["success"] else (0, 0)
log(f"  success       : {res['success']}")
log(f"  output size   : {out_w}x{out_h}  (expected {CARD_WIDTH}x{CARD_HEIGHT})")
log(f"  landscape     : {out_w > out_h}")
log(f"  message       : {res['message']}")

record(
    "full_pipeline",
    res["success"] and out_w == CARD_WIDTH and out_h == CARD_HEIGHT and out_w > out_h,
    f"size={out_w}x{out_h} success={res['success']}",
)

# Try loading a real frame if available
real_frame_dir = "D:/vision_logs/received_frames"
if os.path.isdir(real_frame_dir):
    frames = [f for f in os.listdir(real_frame_dir) if f.endswith((".jpg", ".jpeg", ".png"))]
    if frames:
        frame_path = os.path.join(real_frame_dir, sorted(frames)[-1])
        real_img = cv2.imread(frame_path)
        if real_img is not None:
            log(f"\n  Found real frame: {frame_path}  shape={real_img.shape}")
            from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
            det = DocumentDetector()
            det_result = det.detect(real_img)
            log(f"  Detected: {det_result['detected']}  confidence={det_result['confidence']:.3f}")
            if det_result["detected"] and det_result["metadata"].get("corners") is not None:
                c = np.array(det_result["metadata"]["corners"], dtype=np.float32)
                warp_res = corrector2.process(real_img, corners=c)
                log(f"  Warp success: {warp_res['success']}  size={warp_res['image'].shape[1]}x{warp_res['image'].shape[0]}")
                os.makedirs("D:/vision_logs", exist_ok=True)
                cv2.imwrite("D:/vision_logs/perspective_test_output.jpg", warp_res["image"])
                log("  Saved: D:/vision_logs/perspective_test_output.jpg")

# ── SUMMARY ──────────────────────────────────────────────────────────────────

log("\n" + "=" * 55)
total  = len(results)
passed = sum(1 for r in results if r["pass"])
failed = total - passed
log(f"RESULTS: {passed}/{total} passed  ({'PASS' if failed == 0 else 'FAIL'})")
for r in results:
    status = "PASS" if r["pass"] else "FAIL"
    log(f"  [{status}] {r['test']}  {r['detail']}")
log("=" * 55)

os.makedirs("D:/vision_logs/stress_test", exist_ok=True)
ts = time.strftime("%Y%m%d_%H%M%S")
report_path = f"D:/vision_logs/stress_test/perspective_fix_{ts}.json"
with open(report_path, "w") as f:
    json.dump({"passed": passed, "failed": failed, "total": total, "tests": results}, f, indent=2)
log(f"\nReport: {report_path}")

sys.exit(0 if failed == 0 else 1)
