"""
DigitMasker — blur a subset of digits in a document image for privacy.

Single Responsibility: accept an image and OCR bounding box data, compute
the region covering the digits to be masked, and apply Gaussian blur.
Used to mask the first 8 digits of an Aadhaar number (leaving last 4).
"""

import logging
from typing import List, Optional

import cv2
import numpy as np

from vision_framework.core.interfaces.base_processor import BaseProcessor
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)


class DigitMasker(BaseProcessor):
    """
    Masks a configurable number of leading digits using Gaussian blur.

    The process:
      1. Receive the full bounding box list of the digit string from OCR.
      2. Calculate which characters to mask based on digits_to_mask.
      3. Build a rectangle covering those characters + small padding.
      4. Apply strong Gaussian blur to that region.
      5. Return the new image and the masked region coordinates.
    """

    def __init__(
        self,
        digits_to_mask: int = KYCConfig.AADHAAR_MASK_FROM_DIGIT,
        blur_kernel: int = KYCConfig.DIGIT_MASK_BLUR_KERNEL,
        blur_sigma: int = KYCConfig.DIGIT_MASK_BLUR_SIGMA,
        padding: int = 4,
    ) -> None:
        """
        Parameters
        ----------
        digits_to_mask:
            Number of leading digits to obscure (default 8 → first 8 of 12).
        blur_kernel:
            Gaussian blur kernel size (must be odd).
        blur_sigma:
            Gaussian blur sigma value.
        padding:
            Extra pixels added around the mask rectangle.
        """
        self._digits_to_mask = digits_to_mask
        self._blur_kernel = blur_kernel if blur_kernel % 2 == 1 else blur_kernel + 1
        self._blur_sigma = blur_sigma
        self._padding = padding

    @property
    def processor_name(self) -> str:
        return "digit_masker"

    def validate_input(self, image: np.ndarray) -> bool:
        return (
            image is not None
            and isinstance(image, np.ndarray)
            and image.ndim == 3
            and image.size > 0
        )

    def process(self, image: np.ndarray, **kwargs) -> dict:
        """
        Apply digit masking to *image*.

        Parameters
        ----------
        image:
            Source BGR uint8 image.
        **kwargs:
            bboxes       : list of bounding boxes from OCR, each as
                           [[x1,y1], [x2,y1], [x2,y2], [x1,y2]] (EasyOCR format)
                           or (x, y, w, h) tuples.
            digits_to_mask : int — override constructor value.

        Returns
        -------
        Standard processor result dict.
        """
        if not self.validate_input(image):
            return self._failure("Invalid image.", image)

        bboxes: List = kwargs.get("bboxes", [])
        digits_to_mask: int = kwargs.get("digits_to_mask", self._digits_to_mask)

        if not bboxes:
            return {
                "success": True,
                "image": image.copy(),
                "metadata": {"masked": False, "reason": "No bounding boxes provided."},
                "message": "No bounding boxes — nothing masked.",
            }

        result = image.copy()
        masked_regions = []

        for bbox in bboxes:
            mask_region = self._compute_mask_region(bbox, digits_to_mask, image.shape)
            if mask_region is None:
                continue

            x1, y1, x2, y2 = mask_region
            roi = result[y1:y2, x1:x2]
            blurred = cv2.GaussianBlur(
                roi,
                (self._blur_kernel, self._blur_kernel),
                self._blur_sigma,
            )
            result[y1:y2, x1:x2] = blurred
            masked_regions.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})

        logger.debug(
            "DigitMasker: masked %d region(s) with %d leading digits.",
            len(masked_regions), digits_to_mask,
        )

        return {
            "success": True,
            "image": result,
            "metadata": {
                "masked": len(masked_regions) > 0,
                "digits_masked": digits_to_mask,
                "masked_regions": masked_regions,
            },
            "message": f"Masked {digits_to_mask} leading digits in {len(masked_regions)} region(s).",
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _compute_mask_region(
        self, bbox, digits_to_mask: int, image_shape: tuple
    ) -> Optional[tuple]:
        """
        Convert an OCR bbox into a pixel rectangle for the digits to mask.

        Supports both EasyOCR corner format and (x, y, w, h) tuples.
        Returns (x1, y1, x2, y2) clipped to image bounds, or None.
        """
        img_h, img_w = image_shape[:2]

        # EasyOCR: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        if isinstance(bbox, (list, np.ndarray)) and len(bbox) == 4 and hasattr(bbox[0], '__len__'):
            pts = np.array(bbox, dtype=np.float32)
            bx1 = int(pts[:, 0].min())
            bx2 = int(pts[:, 0].max())
            by1 = int(pts[:, 1].min())
            by2 = int(pts[:, 1].max())
        elif len(bbox) == 4:
            bx1, by1, bw, bh = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
            bx2, by2 = bx1 + bw, by1 + bh
        else:
            return None

        total_w = bx2 - bx1
        # Assume uniform character width
        char_w = total_w / max(12, 1)
        mask_end_x = int(bx1 + char_w * digits_to_mask)

        x1 = max(0, bx1 - self._padding)
        y1 = max(0, by1 - self._padding)
        x2 = min(img_w, mask_end_x + self._padding)
        y2 = min(img_h, by2 + self._padding)

        if x2 <= x1 or y2 <= y1:
            return None
        return x1, y1, x2, y2

    @staticmethod
    def _failure(message: str, image: np.ndarray) -> dict:
        return {
            "success": False,
            "image": image.copy() if image is not None else None,
            "metadata": {},
            "message": message,
        }
