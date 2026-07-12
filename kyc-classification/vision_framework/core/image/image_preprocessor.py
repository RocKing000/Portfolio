"""
ImagePreprocessor — resize, normalize, denoise, and prepare images.

Single Responsibility: apply standard pre-processing transformations that
prepare a raw image for downstream detectors, classifiers, and extractors.
All methods return new arrays; inputs are never mutated.
"""

import logging
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """
    Collection of stateless image pre-processing operations.

    Every method is static.  Each method returns a new numpy array — the
    original image passed in is never modified.
    """

    @staticmethod
    def resize(
        image: np.ndarray,
        width: Optional[int] = None,
        height: Optional[int] = None,
        max_side: Optional[int] = None,
        interpolation: int = cv2.INTER_LINEAR,
    ) -> np.ndarray:
        """
        Resize *image* to the specified dimensions.

        Specify either (width, height) or max_side (scales the longer side).
        Aspect ratio is preserved when only one dimension or max_side is given.
        """
        h, w = image.shape[:2]

        if max_side is not None:
            scale = max_side / max(h, w)
            new_w, new_h = int(w * scale), int(h * scale)
        elif width is not None and height is not None:
            new_w, new_h = width, height
        elif width is not None:
            scale = width / w
            new_w, new_h = width, int(h * scale)
        elif height is not None:
            scale = height / h
            new_w, new_h = int(w * scale), height
        else:
            return image.copy()

        return cv2.resize(image, (new_w, new_h), interpolation=interpolation)

    @staticmethod
    def normalize(
        image: np.ndarray,
        mean: Tuple[float, float, float] = (0.485, 0.456, 0.406),
        std: Tuple[float, float, float] = (0.229, 0.224, 0.225),
    ) -> np.ndarray:
        """
        Normalize a uint8 BGR image to float32 using ImageNet statistics.

        Returns a float32 array in channel-last format (H x W x C).
        """
        img_float = image.astype(np.float32) / 255.0
        # Convert BGR -> RGB for standard normalization
        img_rgb = img_float[..., ::-1]
        normalized = (img_rgb - np.array(mean)) / np.array(std)
        return normalized.astype(np.float32)

    @staticmethod
    def denoise(
        image: np.ndarray,
        strength: int = 10,
        color_strength: int = 10,
        template_window: int = 7,
        search_window: int = 21,
    ) -> np.ndarray:
        """
        Apply Non-local Means denoising (cv2.fastNlMeansDenoisingColored).

        Returns a new denoised BGR uint8 array.
        """
        return cv2.fastNlMeansDenoisingColored(
            image, None, strength, color_strength, template_window, search_window
        )

    @staticmethod
    def to_grayscale(image: np.ndarray) -> np.ndarray:
        """Convert BGR *image* to single-channel grayscale (H x W, uint8)."""
        if len(image.shape) == 2:
            return image.copy()
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    @staticmethod
    def adjust_contrast(image: np.ndarray, alpha: float = 1.5, beta: int = 0) -> np.ndarray:
        """
        Adjust contrast and brightness via cv2.convertScaleAbs.

        alpha > 1 increases contrast; beta > 0 increases brightness.
        """
        return cv2.convertScaleAbs(image, alpha=alpha, beta=beta)

    @staticmethod
    def apply_clahe(image: np.ndarray, clip_limit: float = 2.0) -> np.ndarray:
        """
        Apply Contrast-Limited Adaptive Histogram Equalization.

        Operates on the L channel in LAB colour space; preserves colour.
        Returns BGR uint8.
        """
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_ch, a_ch, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
        cl = clahe.apply(l_ch)
        merged = cv2.merge((cl, a_ch, b_ch))
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

    @staticmethod
    def pad_to_square(image: np.ndarray, fill_value: int = 0) -> np.ndarray:
        """
        Pad *image* with *fill_value* so that H == W (square canvas).

        Returns a new array; does not crop.
        """
        h, w = image.shape[:2]
        side = max(h, w)
        if h == w:
            return image.copy()
        canvas = np.full((side, side, image.shape[2]), fill_value, dtype=image.dtype)
        pad_top = (side - h) // 2
        pad_left = (side - w) // 2
        canvas[pad_top: pad_top + h, pad_left: pad_left + w] = image
        return canvas

    @staticmethod
    def to_model_input(
        image: np.ndarray,
        target_size: Tuple[int, int] = (224, 224),
    ) -> np.ndarray:
        """
        Prepare *image* for a standard CNN: resize, normalize, add batch dim.

        Returns float32 array of shape (1, H, W, 3) in RGB channel order,
        normalized with ImageNet statistics.
        """
        resized = ImagePreprocessor.resize(image, width=target_size[0], height=target_size[1])
        normalized = ImagePreprocessor.normalize(resized)
        return np.expand_dims(normalized, axis=0)
