"""
ImageUtils — common numpy/OpenCV operations used across the framework.

Single Responsibility: provide reusable, stateless image utility functions
that don't belong to loading, preprocessing, or augmentation.
"""

import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class ImageUtils:
    """Collection of stateless image utility helpers."""

    @staticmethod
    def crop(image: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Crop *image* to *bbox* = (x, y, w, h).

        Returns a copy of the cropped region.

        Raises
        ------
        ValueError if bbox is outside image bounds.
        """
        x, y, w, h = bbox
        ih, iw = image.shape[:2]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(iw, x + w), min(ih, y + h)
        if x2 <= x1 or y2 <= y1:
            raise ValueError(f"ImageUtils.crop: invalid bbox {bbox} for image {image.shape}.")
        return image[y1:y2, x1:x2].copy()

    @staticmethod
    def crop_corners(
        image: np.ndarray, corners: np.ndarray, output_size: Tuple[int, int] = (800, 600)
    ) -> np.ndarray:
        """
        Apply a perspective transform using four *corners* to produce a
        rectified image of *output_size* (W, H).

        Parameters
        ----------
        corners:
            np.ndarray of shape (4, 2), ordered: TL, TR, BR, BL.
        output_size:
            (width, height) of the output image.
        """
        w, h = output_size
        dst_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        src_pts = corners.astype(np.float32)
        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        return cv2.warpPerspective(image, M, (w, h))

    @staticmethod
    def draw_bounding_box(
        image: np.ndarray,
        bbox: Tuple[int, int, int, int],
        color: Tuple[int, int, int] = (0, 255, 0),
        thickness: int = 2,
        label: Optional[str] = None,
    ) -> np.ndarray:
        """
        Draw a bounding box on a *copy* of *image*.

        bbox format: (x, y, w, h).
        """
        result = image.copy()
        x, y, w, h = bbox
        cv2.rectangle(result, (x, y), (x + w, y + h), color, thickness)
        if label:
            cv2.putText(
                result, label, (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA
            )
        return result

    @staticmethod
    def draw_contour(
        image: np.ndarray,
        points: np.ndarray,
        color: Tuple[int, int, int] = (0, 255, 0),
        thickness: int = 2,
    ) -> np.ndarray:
        """Draw a polygon defined by *points* on a copy of *image*."""
        result = image.copy()
        pts = points.astype(np.int32).reshape((-1, 1, 2))
        cv2.polylines(result, [pts], isClosed=True, color=color, thickness=thickness)
        return result

    @staticmethod
    def get_image_quality_score(image: np.ndarray) -> float:
        """
        Return a sharpness score (Laplacian variance).

        Higher = sharper.  Values below ~100 typically indicate blur.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    @staticmethod
    def is_valid_image(image: Optional[np.ndarray]) -> bool:
        """Return True if *image* is a non-empty numpy array with 2 or 3 dims."""
        return (
            image is not None
            and isinstance(image, np.ndarray)
            and image.ndim in (2, 3)
            and image.size > 0
        )

    @staticmethod
    def stack_horizontally(images: List[np.ndarray], padding: int = 10) -> np.ndarray:
        """
        Horizontally concatenate *images* of the same height with *padding*.

        All images are resized to share the height of the first image.
        """
        if not images:
            raise ValueError("ImageUtils.stack_horizontally: empty list.")
        target_h = images[0].shape[0]
        resized = []
        for img in images:
            scale = target_h / img.shape[0]
            new_w = int(img.shape[1] * scale)
            resized.append(cv2.resize(img, (new_w, target_h)))
        sep = np.zeros((target_h, padding, 3), dtype=np.uint8)
        parts: List[np.ndarray] = []
        for i, img in enumerate(resized):
            parts.append(img)
            if i < len(resized) - 1:
                parts.append(sep)
        return np.concatenate(parts, axis=1)

    @staticmethod
    def calculate_iou(
        bbox1: Tuple[int, int, int, int], bbox2: Tuple[int, int, int, int]
    ) -> float:
        """
        Calculate Intersection over Union for two (x, y, w, h) bounding boxes.
        """
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        xi1, yi1 = max(x1, x2), max(y1, y2)
        xi2, yi2 = min(x1 + w1, x2 + w2), min(y1 + h1, y2 + h2)
        intersection = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        union = w1 * h1 + w2 * h2 - intersection
        return intersection / union if union > 0 else 0.0
