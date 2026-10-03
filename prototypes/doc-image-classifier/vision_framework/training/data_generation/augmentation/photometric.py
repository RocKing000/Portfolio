"""
photometric.py — Photometric augmentations for synthetic document images.

Simulates real-world camera capture: brightness, contrast, noise,
blur, JPEG compression, and color temperature shifts.
"""

import random
import numpy as np
import cv2


def apply_photometric(image: np.ndarray) -> np.ndarray:
    """
    Apply stacked photometric augmentations.

    Always applied  : brightness/contrast variation
    Sometimes applied (with probability):
      - Blur (Gaussian / motion / box)
      - Gaussian or Poisson noise
      - JPEG compression artifacts
      - Color temperature shift
    """
    try:
        return _photometric_albumentations(image)
    except ImportError:
        return _photometric_fallback(image)


def _photometric_albumentations(image: np.ndarray) -> np.ndarray:
    import albumentations as A

    pipeline = A.Compose([
        A.RandomBrightnessContrast(
            brightness_limit=0.35, contrast_limit=0.35, p=0.9
        ),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 7)),
            A.MotionBlur(blur_limit=7),
            A.MedianBlur(blur_limit=5),
        ], p=0.45),
        A.OneOf([
            A.GaussNoise(var_limit=(10.0, 40.0), p=0.25),
            A.ISONoise(color_shift=(0.01, 0.04), intensity=(0.1, 0.35), p=0.20),
        ], p=0.35),
        A.ImageCompression(quality_lower=55, quality_upper=95, p=0.70),
        A.ColorJitter(
            brightness=0.15, contrast=0.15,
            saturation=0.15, hue=0.06, p=0.50
        ),
    ])
    return pipeline(image=image)["image"]


def _photometric_fallback(image: np.ndarray) -> np.ndarray:
    """Pure NumPy / OpenCV fallback."""
    img = image.astype(np.float32)

    # Brightness + contrast
    alpha = random.uniform(0.65, 1.35)   # contrast
    beta  = random.uniform(-60, 60)       # brightness
    img = np.clip(img * alpha + beta, 0, 255)

    img = img.astype(np.uint8)

    # Blur
    if random.random() < 0.45:
        choice = random.choice(["gaussian", "motion", "box"])
        if choice == "gaussian":
            k = random.choice([3, 5, 7])
            img = cv2.GaussianBlur(img, (k, k), 0)
        elif choice == "motion":
            k = random.randint(3, 9)
            kernel = np.zeros((k, k))
            kernel[k // 2, :] = 1.0 / k
            angle = random.uniform(0, 180)
            M = cv2.getRotationMatrix2D((k / 2, k / 2), angle, 1)
            kernel = cv2.warpAffine(kernel, M, (k, k))
            kernel = kernel / (kernel.sum() or 1)
            img = cv2.filter2D(img, -1, kernel)
        else:
            k = random.choice([3, 5])
            img = cv2.blur(img, (k, k))

    # Gaussian noise
    if random.random() < 0.30:
        noise = np.random.normal(0, random.uniform(5, 18), img.shape).astype(np.float32)
        img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    # JPEG compression
    if random.random() < 0.70:
        quality = random.randint(55, 95)
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        _, buf = cv2.imencode(".jpg", img, encode_params)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)

    return img
