"""
generate_test_images.py — create synthetic test images for all module tests.

Run from the vision_framework/ directory:
    py -3 tests/generate_test_images.py

Generates tests/test_images/:
  sharp_document.jpg   — clear, well-positioned document simulation
  blurry_document.jpg  — same image with strong GaussianBlur
  angled_document.jpg  — perspective-warped document
  no_document.jpg      — plain background, no document
  sharp_face.jpg       — synthetic oval face (or downloaded)
  blurry_face.jpg      — blurred face
"""

import os
import sys
import time

# Allow running from project root
_THIS = os.path.dirname(os.path.abspath(__file__))
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

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

GENERATED = 0


def save(filename: str, image: np.ndarray) -> None:
    global GENERATED
    path = os.path.join(OUTPUT_DIR, filename)
    cv2.imwrite(path, image)
    print(f"Generated: {filename}  ({image.shape[1]}x{image.shape[0]})")
    GENERATED += 1


# ─────────────────────────────────────────────────────────────────────────────
# Helper: draw a document card on a background
# ─────────────────────────────────────────────────────────────────────────────

def make_base_document(bg_w: int = 800, bg_h: int = 600) -> np.ndarray:
    """
    Returns a BGR image (bg_h x bg_w x 3) with a white document rectangle
    centered on a dark-gray background (high contrast for blur detection).

    Content:
      - Colored header band (blue, like an Aadhaar header)
      - 'TEST AADHAAR' title text (thick, scale 2.0)
      - '2345 6789 0123' UID number
      - QR-code placeholder square
      - Name, DOB, Gender rows
    """
    # Dark background for high contrast against white card
    canvas = np.full((bg_h, bg_w, 3), (50, 50, 50), dtype=np.uint8)

    # Document rectangle: 500×300, centered — pure white card
    doc_x, doc_y, doc_w, doc_h = 150, 150, 500, 300
    doc_img = np.full((doc_h, doc_w, 3), (255, 255, 255), dtype=np.uint8)

    # Blue header band
    cv2.rectangle(doc_img, (0, 0), (doc_w, 55), (180, 50, 10), -1)
    cv2.putText(doc_img, "Government of India", (10, 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(doc_img, "TEST AADHAAR", (10, 47),
                cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 255, 255), 3, cv2.LINE_AA)

    # QR placeholder
    cv2.rectangle(doc_img, (380, 65), (480, 165), (0, 0, 0), 3)
    cv2.putText(doc_img, "QR", (410, 120),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)

    # Face photo placeholder
    cv2.rectangle(doc_img, (15, 65), (105, 175), (200, 200, 200), -1)
    cv2.rectangle(doc_img, (15, 65), (105, 175), (0, 0, 0), 3)
    cv2.putText(doc_img, "PHOTO", (20, 125),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 2)

    # Name / DOB / Gender — thick text for high variance
    cv2.putText(doc_img, "Name: Test User", (15, 200),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2, cv2.LINE_AA)
    cv2.putText(doc_img, "DOB: 01/01/1990", (15, 225),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2, cv2.LINE_AA)
    cv2.putText(doc_img, "MALE", (15, 250),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2, cv2.LINE_AA)

    # UID number — large, at bottom (this is what OCR and masker will target)
    cv2.putText(doc_img, "2345 6789 0123", (100, 285),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 3, cv2.LINE_AA)

    # Strong border around card
    cv2.rectangle(doc_img, (0, 0), (doc_w - 1, doc_h - 1), (0, 0, 0), 5)

    canvas[doc_y:doc_y + doc_h, doc_x:doc_x + doc_w] = doc_img
    return canvas


# ─────────────────────────────────────────────────────────────────────────────
# 1. Sharp document
# ─────────────────────────────────────────────────────────────────────────────
sharp = make_base_document()
save("sharp_document.jpg", sharp)

# ─────────────────────────────────────────────────────────────────────────────
# 2. Blurry document
# ─────────────────────────────────────────────────────────────────────────────
blurry = cv2.GaussianBlur(sharp.copy(), (21, 21), 0)
save("blurry_document.jpg", blurry)

# ─────────────────────────────────────────────────────────────────────────────
# 3. Angled document — perspective warp
# ─────────────────────────────────────────────────────────────────────────────
h, w = sharp.shape[:2]
src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
dst_pts = np.float32([
    [60, 40],
    [w - 40, 20],
    [w - 20, h - 50],
    [30, h - 30],
])
M = cv2.getPerspectiveTransform(src_pts, dst_pts)
angled = cv2.warpPerspective(sharp.copy(), M, (w, h), borderValue=(70, 70, 70))
save("angled_document.jpg", angled)

# ─────────────────────────────────────────────────────────────────────────────
# 4. No document — plain background
# ─────────────────────────────────────────────────────────────────────────────
no_doc = np.full((600, 800, 3), (110, 110, 110), dtype=np.uint8)
# Add some noise so it doesn't look like a solid block
noise = np.random.randint(-15, 15, no_doc.shape, dtype=np.int16)
no_doc = np.clip(no_doc.astype(np.int16) + noise, 0, 255).astype(np.uint8)
save("no_document.jpg", no_doc)

# ─────────────────────────────────────────────────────────────────────────────
# 5. Sharp face — try downloading, fall back to synthetic oval
# ─────────────────────────────────────────────────────────────────────────────

def make_synthetic_face(size: int = 400) -> np.ndarray:
    """
    Produce a plausible synthetic 'face' image:
      - Skin-tone oval head
      - Two darker eye ellipses
      - Nose dot
      - Mouth arc
      - Simple hair region
    """
    img = np.full((size, size, 3), (200, 220, 240), dtype=np.uint8)  # light blue bg

    cx, cy = size // 2, size // 2
    rx, ry = size // 3, int(size * 0.42)

    # Head — skin tone BGR ≈ (120, 170, 210)
    cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, (120, 170, 210), -1)

    # Hair
    hair_pts = np.array([
        [cx - rx, cy - ry // 2],
        [cx, cy - ry - 20],
        [cx + rx, cy - ry // 2],
    ], dtype=np.int32)
    cv2.fillPoly(img, [hair_pts], (40, 30, 20))
    cv2.ellipse(img, (cx, cy - ry + 10), (rx, ry // 3), 0, 180, 360, (40, 30, 20), -1)

    # Left eye
    le_cx, le_cy = cx - rx // 3, cy - ry // 5
    cv2.ellipse(img, (le_cx, le_cy), (rx // 7, ry // 10), 0, 0, 360, (255, 255, 255), -1)
    cv2.ellipse(img, (le_cx, le_cy), (rx // 12, ry // 14), 0, 0, 360, (30, 30, 80), -1)

    # Right eye
    re_cx, re_cy = cx + rx // 3, cy - ry // 5
    cv2.ellipse(img, (re_cx, re_cy), (rx // 7, ry // 10), 0, 0, 360, (255, 255, 255), -1)
    cv2.ellipse(img, (re_cx, re_cy), (rx // 12, ry // 14), 0, 0, 360, (30, 30, 80), -1)

    # Nose
    cv2.ellipse(img, (cx, cy + ry // 8), (rx // 12, ry // 16), 0, 0, 360, (100, 140, 170), -1)

    # Mouth
    cv2.ellipse(img, (cx, cy + ry // 3), (rx // 3, ry // 8), 0, 0, 180, (80, 80, 160), 2)

    # Ear left/right
    cv2.ellipse(img, (cx - rx, cy), (rx // 8, ry // 7), 0, 90, 270, (120, 170, 210), -1)
    cv2.ellipse(img, (cx + rx, cy), (rx // 8, ry // 7), 0, 270, 90, (120, 170, 210), -1)

    return img


def try_download_face() -> np.ndarray:
    try:
        import requests
        resp = requests.get("https://thispersondoesnotexist.com",
                            timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        arr = np.frombuffer(resp.content, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None and img.size > 0:
            print("  (downloaded real face from thispersondoesnotexist.com)")
            return cv2.resize(img, (400, 400))
    except Exception as e:
        print(f"  (download failed: {e} — using synthetic face)")
    return make_synthetic_face(400)


face_img = try_download_face()
save("sharp_face.jpg", face_img)

# ─────────────────────────────────────────────────────────────────────────────
# 6. Blurry face
# ─────────────────────────────────────────────────────────────────────────────
blurry_face = cv2.GaussianBlur(face_img.copy(), (21, 21), 0)
save("blurry_face.jpg", blurry_face)

# ─────────────────────────────────────────────────────────────────────────────
print(f"\nGenerated {GENERATED} test images in {OUTPUT_DIR}")
