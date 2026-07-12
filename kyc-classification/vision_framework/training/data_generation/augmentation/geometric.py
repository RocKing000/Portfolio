"""
geometric.py — Geometric augmentations for synthetic document images.

Simulates real-world capture: rotation, perspective warp, scaling, shear.
Gracefully degrades if albumentations is not installed.
"""

import random
import numpy as np
import cv2


def apply_geometric(image: np.ndarray, config: dict = None) -> np.ndarray:
    """
    Apply random geometric transforms to a document image.

    Pipeline (each applied with its own probability):
      - Rotation:    -15 to +15 degrees  (p=0.7)
      - Perspective: simulate camera angle (p=0.6)
      - Scale:       0.75 – 1.25× zoom   (p=0.5)
      - Shear:       slight horizontal shear (p=0.3)

    Falls back to pure OpenCV if albumentations is unavailable.
    """
    if config is None:
        config = {}

    try:
        import albumentations as A

        transforms = []

        if random.random() < 0.7:
            angle = random.uniform(-15, 15)
            transforms.append(A.Rotate(limit=(-abs(angle), abs(angle)), border_mode=cv2.BORDER_REPLICATE, p=1.0))

        if random.random() < 0.6:
            transforms.append(A.Perspective(scale=(0.02, 0.08), p=1.0))

        if random.random() < 0.5:
            scale = random.uniform(-0.25, 0.25)
            transforms.append(A.RandomScale(scale_limit=(scale, scale), p=1.0))

        if random.random() < 0.3:
            transforms.append(A.Affine(shear={"x": (-8, 8), "y": 0}, p=1.0))

        if transforms:
            pipeline = A.Compose(transforms)
            result = pipeline(image=image)
            image = result["image"]

    except ImportError:
        image = _geometric_fallback(image)

    return image


def _geometric_fallback(image: np.ndarray) -> np.ndarray:
    """Pure-OpenCV fallback when albumentations is not installed."""
    h, w = image.shape[:2]

    # Rotation
    if random.random() < 0.7:
        angle = random.uniform(-15, 15)
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        image = cv2.warpAffine(
            image, M, (w, h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )

    # Perspective
    if random.random() < 0.6:
        margin = int(min(w, h) * 0.05)
        src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        dst = src.copy()
        for i in range(4):
            dst[i][0] += random.uniform(-margin, margin)
            dst[i][1] += random.uniform(-margin, margin)
        M = cv2.getPerspectiveTransform(src, dst)
        image = cv2.warpPerspective(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)

    # Scale
    if random.random() < 0.5:
        scale = random.uniform(0.75, 1.25)
        new_w = int(w * scale)
        new_h = int(h * scale)
        image = cv2.resize(image, (new_w, new_h))
        # Crop or pad back to original size
        if scale > 1.0:
            x0 = (new_w - w) // 2
            y0 = (new_h - h) // 2
            image = image[y0:y0 + h, x0:x0 + w]
        else:
            pad_x = (w - new_w) // 2
            pad_y = (h - new_h) // 2
            image = cv2.copyMakeBorder(
                image, pad_y, h - new_h - pad_y,
                pad_x, w - new_w - pad_x,
                cv2.BORDER_REPLICATE,
            )

    return image


def apply_perspective_warp(image: np.ndarray, strength: float = 0.05) -> np.ndarray:
    """Apply a single controlled perspective warp."""
    h, w = image.shape[:2]
    margin = int(min(w, h) * strength)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [random.uniform(0, margin),       random.uniform(0, margin)],
        [w - random.uniform(0, margin),   random.uniform(0, margin)],
        [w - random.uniform(0, margin),   h - random.uniform(0, margin)],
        [random.uniform(0, margin),       h - random.uniform(0, margin)],
    ])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
