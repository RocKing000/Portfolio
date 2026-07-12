"""
environmental.py — Environmental augmentations: background, shadow, glare.

Simulates placing a physical document card on a surface, with
realistic lighting conditions.
"""

import random
import numpy as np
import cv2


def add_background(card: np.ndarray, bg_type: str = "random") -> np.ndarray:
    """
    Paste the card onto a larger synthetic background.

    bg_type: "dark" | "light" | "textured" | "cluttered" | "random"
    Returns an image larger than the input card.
    """
    options = ["dark", "light", "textured", "cluttered"]
    if bg_type == "random":
        bg_type = random.choice(options)

    h, w = card.shape[:2]
    bg_h = int(h * random.uniform(1.4, 2.5))
    bg_w = int(w * random.uniform(1.4, 2.5))

    if bg_type == "dark":
        val = random.randint(10, 70)
        bg = np.full((bg_h, bg_w, 3), val, dtype=np.uint8)
        # Add slight grain
        noise = np.random.randint(-10, 10, (bg_h, bg_w, 3))
        bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    elif bg_type == "light":
        val = random.randint(200, 245)
        bg = np.full((bg_h, bg_w, 3), val, dtype=np.uint8)
        noise = np.random.randint(-8, 8, (bg_h, bg_w, 3))
        bg = np.clip(bg.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    elif bg_type == "textured":
        base = random.randint(50, 130)
        bg = np.random.randint(
            max(0, base - 20), min(255, base + 20),
            (bg_h, bg_w, 3), dtype=np.uint8,
        )
        blur_k = random.choice([15, 21, 31])
        bg = cv2.GaussianBlur(bg, (blur_k, blur_k), 0)

    else:  # cluttered
        base = random.randint(120, 180)
        bg = np.full((bg_h, bg_w, 3), base, dtype=np.uint8)
        for _ in range(random.randint(4, 10)):
            x1 = random.randint(0, bg_w - 1)
            y1 = random.randint(0, bg_h - 1)
            x2 = min(bg_w, x1 + random.randint(40, 220))
            y2 = min(bg_h, y1 + random.randint(25, 140))
            color = tuple(int(random.randint(40, 210)) for _ in range(3))
            cv2.rectangle(bg, (x1, y1), (x2, y2), color, -1)
        bg = cv2.GaussianBlur(bg, (5, 5), 0)

    # Paste card at random offset
    max_x = max(0, bg_w - w)
    max_y = max(0, bg_h - h)
    x_off = random.randint(int(max_x * 0.05), max(1, int(max_x * 0.95)))
    y_off = random.randint(int(max_y * 0.05), max(1, int(max_y * 0.95)))
    x_off = min(x_off, bg_w - w)
    y_off = min(y_off, bg_h - h)

    bg[y_off:y_off + h, x_off:x_off + w] = card
    return bg


def add_shadow(image: np.ndarray) -> np.ndarray:
    """
    Add a realistic directional shadow to one side of the image.
    Simulates a hand/object casting shadow near the card edge.
    """
    shadow = np.ones(image.shape, dtype=np.float32)
    side = random.choice(["top", "bottom", "left", "right", "corner"])
    strength = random.uniform(0.25, 0.65)

    h, w = image.shape[:2]
    band = random.uniform(0.15, 0.40)  # fraction of dimension affected

    if side == "top":
        band_px = int(h * band)
        for i in range(band_px):
            factor = 1.0 - strength * (1.0 - i / band_px)
            shadow[i, :] *= factor

    elif side == "bottom":
        band_px = int(h * band)
        for i in range(band_px):
            factor = 1.0 - strength * (1.0 - i / band_px)
            shadow[h - 1 - i, :] *= factor

    elif side == "left":
        band_px = int(w * band)
        for i in range(band_px):
            factor = 1.0 - strength * (1.0 - i / band_px)
            shadow[:, i] *= factor

    elif side == "right":
        band_px = int(w * band)
        for i in range(band_px):
            factor = 1.0 - strength * (1.0 - i / band_px)
            shadow[:, w - 1 - i] *= factor

    else:  # corner
        cx = random.choice([0, w - 1])
        cy = random.choice([0, h - 1])
        for y in range(h):
            for x in range(w):
                dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                max_dist = (w ** 2 + h ** 2) ** 0.5
                shadow[y, x] *= max(1.0 - strength * (1.0 - dist / max_dist), 0.3)

    # Apply and smooth the transition
    result = (image.astype(np.float32) * shadow).clip(0, 255).astype(np.uint8)
    return result


def add_glare(image: np.ndarray) -> np.ndarray:
    """
    Add specular highlight (glare) to simulate laminated card surface.
    Creates a soft oval bright spot.
    """
    h, w = image.shape[:2]
    glare = np.zeros((h, w), dtype=np.float32)

    # Random ellipse position — tends toward center-ish
    cx = random.randint(w // 5, 4 * w // 5)
    cy = random.randint(h // 5, 4 * h // 5)
    ax = random.randint(w // 10, w // 3)
    ay = random.randint(h // 10, h // 3)
    angle = random.randint(0, 180)
    intensity = random.uniform(0.20, 0.50)

    cv2.ellipse(glare, (cx, cy), (ax, ay), angle, 0, 360, intensity, -1)

    # Soft blur to make it look realistic
    blur_k = random.choice([41, 51, 71])
    glare = cv2.GaussianBlur(glare, (blur_k, blur_k), 0)

    # Apply glare (add to all channels)
    result = image.astype(np.float32)
    for c in range(3):
        result[:, :, c] = np.clip(result[:, :, c] + glare * 255, 0, 255)
    return result.astype(np.uint8)
