"""
camera.py — Camera-specific augmentations: sensor noise, lens distortion, chromatic aberration.
"""

import random
import numpy as np
import cv2


def apply_camera_effects(image: np.ndarray) -> np.ndarray:
    """
    Apply a random selection of camera-specific degradations.

    Effects:
      - Barrel / pincushion lens distortion   (p=0.3)
      - Chromatic aberration (color fringing)  (p=0.25)
      - Vignetting (darkened corners)           (p=0.4)
      - Sensor hot pixels                       (p=0.2)
    """
    if random.random() < 0.30:
        image = _apply_lens_distortion(image)
    if random.random() < 0.25:
        image = _apply_chromatic_aberration(image)
    if random.random() < 0.40:
        image = _apply_vignetting(image)
    if random.random() < 0.20:
        image = _apply_hot_pixels(image)
    return image


def _apply_lens_distortion(image: np.ndarray) -> np.ndarray:
    """Barrel or pincushion distortion."""
    h, w = image.shape[:2]
    k1 = random.uniform(-0.3, 0.3)
    k2 = random.uniform(-0.1, 0.1)
    dist_coeffs = np.array([k1, k2, 0, 0, 0], dtype=np.float32)
    fx = fy = max(w, h) * 1.0
    cx, cy = w / 2, h / 2
    cam_matrix = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float32)
    return cv2.undistort(image, cam_matrix, dist_coeffs)


def _apply_chromatic_aberration(image: np.ndarray) -> np.ndarray:
    """Shift R and B channels slightly to simulate lens fringing."""
    shift = random.randint(1, 3)
    b, g, r = cv2.split(image)
    # Shift red channel right+down, blue channel left+up
    M_r = np.float32([[1, 0, shift], [0, 1, shift]])
    M_b = np.float32([[1, 0, -shift], [0, 1, -shift]])
    h, w = image.shape[:2]
    r = cv2.warpAffine(r, M_r, (w, h))
    b = cv2.warpAffine(b, M_b, (w, h))
    return cv2.merge([b, g, r])


def _apply_vignetting(image: np.ndarray) -> np.ndarray:
    """Darken image corners to simulate lens vignetting."""
    h, w = image.shape[:2]
    # Create radial falloff mask
    Y, X = np.ogrid[:h, :w]
    cx, cy = w / 2, h / 2
    dist = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)
    max_dist = np.sqrt(cx ** 2 + cy ** 2)
    strength = random.uniform(0.3, 0.7)
    mask = 1.0 - strength * (dist / max_dist) ** 2
    mask = np.clip(mask, 0, 1).astype(np.float32)
    result = image.astype(np.float32)
    for c in range(3):
        result[:, :, c] *= mask
    return result.clip(0, 255).astype(np.uint8)


def _apply_hot_pixels(image: np.ndarray) -> np.ndarray:
    """Add a few random bright (hot) pixels — sensor defects."""
    result = image.copy()
    h, w = image.shape[:2]
    n = random.randint(5, 30)
    for _ in range(n):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        result[y, x] = [255, 255, 255]
    return result
