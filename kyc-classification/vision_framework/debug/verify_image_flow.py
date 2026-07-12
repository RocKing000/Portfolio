"""
verify_image_flow.py — Trace what image exists at each pipeline stage.

Saves each step's output image to D:/vision_logs/image_flow/ and prints
shape + mean brightness so you can see exactly where the image chain breaks.

Usage:
    cd "d:/Documentation Recognition"
    python vision_framework/debug/verify_image_flow.py [path/to/test_image.jpg]

If no path is given, a synthetic test card is generated automatically.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import cv2
import numpy as np

OUT_DIR = "D:/vision_logs/image_flow"
os.makedirs(OUT_DIR, exist_ok=True)


# ── helpers ────────────────────────────────────────────────────────────────

def save(name: str, img):
    if img is None or not hasattr(img, "shape"):
        print(f"  {name}: NONE — skipped")
        return
    path = os.path.join(OUT_DIR, f"{name}.jpg")
    cv2.imwrite(path, img)
    print(f"  {name}: shape={img.shape}  mean={img.mean():.1f}  → {path}")


# ── load / synthesise input ────────────────────────────────────────────────

if len(sys.argv) > 1:
    image_path = sys.argv[1]
    image = cv2.imread(image_path)
    if image is None:
        print(f"[ERROR] Could not load image: {image_path}")
        sys.exit(1)
    print(f"Input: {image_path}  shape={image.shape}")
else:
    print("No image path given — generating synthetic Aadhaar card")
    image = np.ones((480, 640, 3), dtype=np.uint8) * 200
    # Card region (centred, card-proportioned)
    card = np.ones((300, 476, 3), dtype=np.uint8) * 230
    card[:, :60] = [20, 100, 220]
    cv2.rectangle(card, (0, 0), (475, 299), (160, 160, 160), 2)
    cv2.putText(card, "AADHAAR", (100, 160),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (30, 30, 30), 2)
    cv2.putText(card, "1234 5678 9012", (80, 220),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 50, 50), 2)
    # Paste card onto background
    y0, x0 = 90, 82
    image[y0:y0 + 300, x0:x0 + 476] = card
    print(f"Synthetic image shape={image.shape}")

save("0_input", image)


# ── run pipeline step by step ──────────────────────────────────────────────

from vision_framework.plugins.kyc.pipelines.document_pipeline import DocumentPipeline

pipeline = DocumentPipeline()
result = pipeline.execute(image)

print(f"\nPipeline success:     {result['success']}")
print(f"Failed at step:       {result.get('failed_at_step')}")
print(f"Reason:               {result.get('reason')}")
print(f"Step times (ms):      {result.get('step_times')}")
print()

steps = result.get("result", {})
print(f"Steps present: {list(steps.keys())}")
print()

# ── per-step image report ──────────────────────────────────────────────────

for step_name, step_result in steps.items():
    if not isinstance(step_result, dict):
        print(f"[{step_name}] not a dict — skipping")
        continue

    success = step_result.get("success", "?")
    msg = step_result.get("message", "")
    print(f"[{step_name}] success={success}  msg={msg!r}")

    if "image" in step_result:
        img = step_result["image"]
        save(step_name, img)
    else:
        print(f"  (no 'image' key in result)")

    # Extra info for key steps
    if step_name == "document_detection":
        print(f"  corners: {step_result.get('corners') is not None}  "
              f"confidence: {step_result.get('confidence', 0):.3f}  "
              f"hand_detected: {step_result.get('hand_detected')}")
    if step_name == "classification":
        print(f"  class: {step_result.get('class_label')}  "
              f"confidence: {step_result.get('confidence', 0):.3f}")
    if step_name == "ocr_extraction":
        print(f"  extracted: {step_result.get('extracted_data')}")


# ── what the API would encode ──────────────────────────────────────────────

print("\n=== What API would send to Angular ===")

corrected = steps.get("perspective_correction", {}).get("image")
if corrected is None:
    corrected = steps.get("document_detection", {}).get("image")
    src = "document_detection (bbox crop fallback)"
else:
    src = "perspective_correction"

masked = steps.get("digit_masking", {}).get("image")
if masked is None:
    masked = corrected
    msrc = "corrected (masking skipped)"
else:
    msrc = "digit_masking"

print(f"corrected_image:  {corrected.shape if corrected is not None else 'NONE'}  (from {src})")
print(f"masked_image:     {masked.shape if masked is not None else 'NONE'}  (from {msrc})")

if corrected is not None:
    save("API_corrected", corrected)
if masked is not None:
    save("API_masked", masked)

print(f"\nAll images saved to: {OUT_DIR}")
