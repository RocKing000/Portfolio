"""
face_generator.py — Synthetic face image generation for document photos.

Generates simple procedural face images that can be pasted into
document templates. These are schematic, not photorealistic.
For photorealistic faces, integrate a GAN-based generator separately.
"""

import random
import numpy as np
import cv2


def generate_face_placeholder(width: int = 120, height: int = 150) -> np.ndarray:
    """
    Generate a synthetic face placeholder image (BGR numpy array).

    Creates a simple procedural human silhouette suitable for
    placement in ID card photo regions.
    """
    img = np.ones((height, width, 3), dtype=np.uint8) * 220  # light gray bg

    # Randomize skin tone
    skin_tones = [
        (180, 155, 130),   # medium
        (210, 185, 160),   # light
        (150, 120, 95),    # dark
        (190, 165, 140),   # medium-light
    ]
    skin = random.choice(skin_tones)

    # Head (ellipse)
    cx = width // 2
    cy = int(height * 0.38)
    rx = int(width  * 0.30)
    ry = int(height * 0.28)
    cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, skin, -1)

    # Hair (darker ellipse on top)
    hair_color = random.choice([
        (30, 20, 15), (50, 35, 20), (80, 60, 40), (20, 15, 10)
    ])
    hair_rx = int(rx * 1.05)
    hair_ry = int(ry * 0.55)
    hair_cy = cy - int(ry * 0.55)
    cv2.ellipse(img, (cx, hair_cy), (hair_rx, hair_ry + 4),
                0, 180, 360, hair_color, -1)
    cv2.ellipse(img, (cx, cy - ry), (hair_rx, hair_ry),
                0, 0, 180, hair_color, -1)

    # Eyes
    eye_y = cy - int(ry * 0.10)
    eye_offset = int(rx * 0.40)
    for ex in [cx - eye_offset, cx + eye_offset]:
        cv2.ellipse(img, (ex, eye_y), (int(rx * 0.14), int(ry * 0.09)),
                    0, 0, 360, (255, 255, 255), -1)
        cv2.ellipse(img, (ex, eye_y), (int(rx * 0.09), int(ry * 0.07)),
                    0, 0, 360, (40, 30, 20), -1)
        cv2.ellipse(img, (ex, eye_y), (int(rx * 0.04), int(ry * 0.04)),
                    0, 0, 360, (10, 8, 5), -1)

    # Nose (small triangle)
    nose_y = cy + int(ry * 0.22)
    nose_pts = np.array([
        [cx, nose_y],
        [cx - int(rx * 0.10), nose_y + int(ry * 0.14)],
        [cx + int(rx * 0.10), nose_y + int(ry * 0.14)],
    ], dtype=np.int32)
    darker_skin = tuple(max(0, c - 25) for c in skin)
    cv2.fillPoly(img, [nose_pts], darker_skin)

    # Mouth
    mouth_y = cy + int(ry * 0.50)
    cv2.ellipse(img, (cx, mouth_y), (int(rx * 0.22), int(ry * 0.08)),
                0, 0, 180, (120, 60, 70), -1)

    # Shoulders / body
    shoulder_y = cy + ry + 2
    shirt_colors = [
        (180, 100, 60), (60, 120, 180), (80, 160, 80),
        (160, 160, 80), (120, 80, 160), (60, 60, 60),
    ]
    shirt_color = random.choice(shirt_colors)
    body_pts = np.array([
        [cx - int(width * 0.45), height],
        [cx - int(width * 0.30), shoulder_y],
        [cx + int(width * 0.30), shoulder_y],
        [cx + int(width * 0.45), height],
    ], dtype=np.int32)
    cv2.fillPoly(img, [body_pts], shirt_color)

    # Neck
    neck_w = int(rx * 0.28)
    cv2.rectangle(
        img,
        (cx - neck_w, cy + ry - 4),
        (cx + neck_w, shoulder_y + 4),
        skin, -1,
    )

    # Slight Gaussian blur for softness
    img = cv2.GaussianBlur(img, (3, 3), 0)

    return img


class FaceGenerator:
    """Generates synthetic face placeholder images."""

    def generate(self, width: int = 120, height: int = 150) -> np.ndarray:
        """Return a synthetic face image of the given dimensions."""
        return generate_face_placeholder(width, height)

    def generate_batch(self, n: int, width: int = 120, height: int = 150) -> list:
        """Return a list of n synthetic face images."""
        return [generate_face_placeholder(width, height) for _ in range(n)]
