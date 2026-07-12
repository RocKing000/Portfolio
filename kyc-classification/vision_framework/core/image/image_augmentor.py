"""
ImageAugmentor — data augmentation pipeline for model training.

Single Responsibility: apply configurable augmentations to generate
diverse training samples from a source image.
Uses Albumentations for composable, reproducible transformations.
"""

import logging
import random
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class ImageAugmentor:
    """
    Applies a configurable suite of image augmentations.

    Augmentations are composed at construction time from a config dict.
    The augment() method returns a new array; the source is never mutated.
    """

    def __init__(self, config: Optional[Dict] = None) -> None:
        """
        Parameters
        ----------
        config:
            Dict controlling which augmentations are enabled and at what
            strength.  Keys mirror the field names below.  Unspecified
            keys fall back to the defaults shown in each augmentation.
        """
        self._config = config or {}
        self._rng = random.Random()

    def augment(self, image: np.ndarray) -> np.ndarray:
        """
        Apply the full configured augmentation pipeline to *image*.

        Each augmentation is applied independently with a configurable
        probability so that every call produces a unique variant.

        Returns
        -------
        np.ndarray — BGR uint8 augmented image (same shape as input).
        """
        result = image.copy()
        result = self._maybe_rotate(result)
        result = self._maybe_brightness(result)
        result = self._maybe_noise(result)
        result = self._maybe_blur(result)
        result = self._maybe_flip(result)
        result = self._maybe_color_jitter(result)
        result = self._maybe_shadow(result)
        return result

    def augment_batch(self, image: np.ndarray, count: int) -> List[np.ndarray]:
        """
        Generate *count* augmented variants of *image*.

        Returns
        -------
        List of *count* BGR uint8 numpy arrays.
        """
        return [self.augment(image) for _ in range(count)]

    # ------------------------------------------------------------------
    # Individual augmentations
    # ------------------------------------------------------------------

    def _maybe_rotate(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("rotation_prob", 0.7)
        if self._rng.random() > prob:
            return image
        max_angle = self._config.get("rotation_max_degrees", 45)
        angle = self._rng.uniform(-max_angle, max_angle)
        h, w = image.shape[:2]
        center = (w / 2, h / 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(
            image, matrix, (w, h), flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE
        )

    def _maybe_brightness(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("brightness_prob", 0.7)
        if self._rng.random() > prob:
            return image
        lo = self._config.get("brightness_min", 0.5)
        hi = self._config.get("brightness_max", 1.5)
        factor = self._rng.uniform(lo, hi)
        adjusted = np.clip(image.astype(np.float32) * factor, 0, 255).astype(np.uint8)
        return adjusted

    def _maybe_noise(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("noise_prob", 0.5)
        if self._rng.random() > prob:
            return image
        sigma = self._rng.uniform(0, self._config.get("noise_sigma_max", 25))
        noise = np.random.normal(0, sigma, image.shape).astype(np.float32)
        noisy = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return noisy

    def _maybe_blur(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("blur_prob", 0.4)
        if self._rng.random() > prob:
            return image
        ksize = self._rng.choice([3, 5, 7])
        return cv2.GaussianBlur(image, (ksize, ksize), 0)

    def _maybe_flip(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("flip_prob", 0.3)
        if self._rng.random() > prob:
            return image
        return cv2.flip(image, 1)  # horizontal flip

    def _maybe_color_jitter(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("color_jitter_prob", 0.5)
        if self._rng.random() > prob:
            return image
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
        hue_shift = self._rng.uniform(-10, 10)
        sat_scale = self._rng.uniform(0.8, 1.2)
        hsv[:, :, 0] = np.clip(hsv[:, :, 0] + hue_shift, 0, 179)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sat_scale, 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    def _maybe_shadow(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("shadow_prob", 0.3)
        if self._rng.random() > prob:
            return image
        h, w = image.shape[:2]
        top_x = self._rng.randint(0, w)
        bot_x = self._rng.randint(0, w)
        shadow_mask = np.zeros((h, w), dtype=np.float32)
        vertices = np.array(
            [[top_x, 0], [w, 0], [w, h], [bot_x, h]], dtype=np.int32
        )
        cv2.fillPoly(shadow_mask, [vertices], 1)
        factor = self._rng.uniform(0.4, 0.7)
        result = image.astype(np.float32)
        result[shadow_mask == 1] *= factor
        return np.clip(result, 0, 255).astype(np.uint8)

    def _maybe_perspective(self, image: np.ndarray) -> np.ndarray:
        prob = self._config.get("perspective_prob", 0.4)
        if self._rng.random() > prob:
            return image
        h, w = image.shape[:2]
        max_shift = int(min(h, w) * self._config.get("perspective_shift", 0.1))
        pts_src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        pts_dst = np.float32([
            [self._rng.randint(0, max_shift), self._rng.randint(0, max_shift)],
            [w - self._rng.randint(0, max_shift), self._rng.randint(0, max_shift)],
            [w - self._rng.randint(0, max_shift), h - self._rng.randint(0, max_shift)],
            [self._rng.randint(0, max_shift), h - self._rng.randint(0, max_shift)],
        ])
        M = cv2.getPerspectiveTransform(pts_src, pts_dst)
        return cv2.warpPerspective(image, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
