"""
BlurProcessor — detect whether an image is too blurry for processing.

Single Responsibility: evaluate image sharpness via Laplacian variance
and return a structured result.  Triggers early exit when image is blurry.
"""

import logging

import cv2
import numpy as np

from vision_framework.core.interfaces.base_processor import BaseProcessor
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)


class BlurProcessor(BaseProcessor):
    """
    Sharpness evaluator using Laplacian variance.

    A Laplacian filter highlights rapid intensity changes (edges).  Sharp
    images have high variance; blurry images have low variance.
    Threshold is read from KYCConfig — never hardcoded here.
    """

    def __init__(self, threshold: float = KYCConfig.BLUR_THRESHOLD) -> None:
        """
        Parameters
        ----------
        threshold:
            Laplacian variance below this value is classified as blurry.
        """
        self._threshold = threshold

    @property
    def processor_name(self) -> str:
        return "blur_detector"

    def validate_input(self, image: np.ndarray) -> bool:
        return (
            image is not None
            and isinstance(image, np.ndarray)
            and image.ndim in (2, 3)
            and image.size > 0
        )

    def process(self, image: np.ndarray, **kwargs) -> dict:
        """
        Evaluate sharpness of *image*.

        Returns success=False (triggers early exit) when the image is blurry.
        The output image is the *original* — blur check is non-destructive.
        """
        if not self.validate_input(image):
            return {
                "success": False,
                "image": image,
                "metadata": {},
                "message": "Invalid image passed to BlurProcessor.",
            }

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image.copy()
        variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Adaptive threshold based on image brightness.
        # Dark images naturally produce lower Laplacian variance even when sharp.
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 80:
            effective_threshold = self._threshold * 0.5
            brightness_reason = "dark image — threshold adjusted"
        elif mean_brightness < 120:
            effective_threshold = self._threshold * 0.7
            brightness_reason = "dim image — threshold adjusted"
        else:
            effective_threshold = self._threshold
            brightness_reason = "normal brightness"

        is_sharp = variance >= effective_threshold

        print(f"Blur variance: {variance:.2f}, threshold: {self._threshold}")
        logger.debug(
            "[BLUR] brightness=%.1f effective_threshold=%.1f reason=%s variance=%.2f sharp=%s",
            mean_brightness, effective_threshold, brightness_reason, variance, is_sharp,
        )

        return {
            "success": is_sharp,
            "image": image.copy(),
            "metadata": {
                "laplacian_variance": variance,
                "threshold": self._threshold,
                "effective_threshold": effective_threshold,
                "mean_brightness": round(mean_brightness, 1),
                "brightness_reason": brightness_reason,
                "is_sharp": is_sharp,
            },
            "message": "Image is sharp." if is_sharp
                       else f"Image too blurry (variance={variance:.1f} < {effective_threshold:.1f}).",
        }
