"""
PerspectiveCorrector — de-warp a document using its four corner points.

Single Responsibility: apply a perspective transform so that the document
fills the output image as a clean rectangle, ready for OCR.

Standard output: 600x378 px (credit-card aspect ratio 1.586:1, landscape).
"""

import logging
import os
from typing import Optional, Tuple

import cv2
import numpy as np

from vision_framework.core.interfaces.base_processor import BaseProcessor

logger = logging.getLogger(__name__)

# Standard card output dimensions — credit-card ratio 1.586:1, landscape
CARD_WIDTH  = 600
CARD_HEIGHT = 378


class PerspectiveCorrector(BaseProcessor):
    """
    Rectifies a skewed/angled document image using perspective transformation.

    The four corners of the document (TL, TR, BR, BL) must be supplied
    either via the constructor or the *corners* keyword argument at process
    time.  If both are given, the runtime value takes precedence.

    Output is always CARD_WIDTH x CARD_HEIGHT (600x378) — landscape orientation
    with the standard credit-card aspect ratio.
    """

    def __init__(
        self,
        output_size: Tuple[int, int] = (CARD_WIDTH, CARD_HEIGHT),
        corners: Optional[np.ndarray] = None,
    ) -> None:
        self._output_size = output_size
        self._corners = corners

    @property
    def processor_name(self) -> str:
        return "perspective_corrector"

    def validate_input(self, image: np.ndarray) -> bool:
        return (
            image is not None
            and isinstance(image, np.ndarray)
            and image.ndim == 3
            and image.size > 0
        )

    def process(self, image: np.ndarray, **kwargs) -> dict:
        """
        Apply perspective correction to *image*.

        Parameters
        ----------
        image:
            Source BGR uint8 image.
        **kwargs:
            corners     : np.ndarray (4, 2) — overrides constructor corners.
            output_size : (int, int) — overrides constructor output_size.
        """
        if not self.validate_input(image):
            return self._failure("Invalid image.", image)

        corners: Optional[np.ndarray] = kwargs.get("corners", self._corners)
        output_size: Tuple[int, int] = kwargs.get("output_size", self._output_size)

        if corners is None:
            return self._failure(
                "PerspectiveCorrector: no corner points provided.", image
            )

        corners_arr = np.array(corners, dtype=np.float32)
        if corners_arr.shape != (4, 2):
            return self._failure(
                f"PerspectiveCorrector: expected corners shape (4,2), got {corners_arr.shape}.",
                image,
            )

        # Robust corner ordering: TL, TR, BR, BL
        corners_arr = self._order_corners(corners_arr)

        # Debug: save corner visualisation before warp
        self._debug_corners(image, corners_arr,
                            "D:/vision_logs/corners_before_warp.jpg")

        w, h = output_size
        dst_pts = np.float32([
            [0,     0    ],
            [w - 1, 0    ],
            [w - 1, h - 1],
            [0,     h - 1],
        ])

        try:
            M = cv2.getPerspectiveTransform(corners_arr, dst_pts)
            warped = cv2.warpPerspective(image, M, (w, h), flags=cv2.INTER_LINEAR)
        except cv2.error as exc:
            return self._failure(f"cv2.getPerspectiveTransform failed: {exc}", image)

        # Save raw warp output for debugging
        try:
            os.makedirs("D:/vision_logs", exist_ok=True)
            cv2.imwrite("D:/vision_logs/warp_raw_output.jpg", warped)
        except Exception:
            pass

        # Validate warp output contains card content
        if not self._validate_warp_output(warped):
            return {
                "success": False,
                "image": image,
                "metadata": {
                    "error": "Perspective correction captured wrong region",
                    "corners_used": corners_arr.tolist(),
                    "warp_mean": float(np.mean(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY))),
                },
                "message": "Could not isolate card — reposition and retry",
            }

        # Ensure landscape output — if result is portrait, rotate 90 deg CW
        out_h, out_w = warped.shape[:2]
        if out_h > out_w:
            warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)
            logger.debug("PerspectiveCorrector: rotated portrait output to landscape")

        logger.debug(
            "PerspectiveCorrector: warped %s -> %s", image.shape, warped.shape
        )

        return {
            "success": True,
            "image": warped,
            "metadata": {
                "corners_used": corners_arr.tolist(),
                "output_size": output_size,
                "transform_matrix": M.tolist(),
            },
            "message": "Perspective correction applied.",
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _order_corners(corners: np.ndarray) -> np.ndarray:
        """
        Order corners as: top-left, top-right, bottom-right, bottom-left.

        Top-left    : smallest sum  (x+y)
        Bottom-right: largest sum   (x+y)
        Top-right   : smallest diff (y-x) — most negative (large x, small y)
        Bottom-left : largest diff  (y-x) — most positive (small x, large y)
        """
        # Flatten to (4, 2)
        pts = corners.reshape(4, 2).astype("float32")

        rect = np.zeros((4, 2), dtype="float32")

        # Sum of coordinates
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]   # top-left
        rect[2] = pts[np.argmax(s)]   # bottom-right

        # Difference of coordinates (y - x)
        diff = pts[:, 1] - pts[:, 0]
        rect[1] = pts[np.argmin(diff)]  # top-right
        rect[3] = pts[np.argmax(diff)]  # bottom-left

        return rect

    def _debug_corners(
        self,
        image: np.ndarray,
        corners: np.ndarray,
        save_path: str = "D:/vision_logs/corners_debug.jpg",
    ) -> np.ndarray:
        """
        Draw corners on image with labels so we can see if ordering is correct.
        TL=green, TR=blue, BR=red, BL=yellow
        """
        try:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            debug = image.copy()
            ordered = self._order_corners(corners)

            colors = [
                (0, 255, 0),    # TL = green
                (255, 0, 0),    # TR = blue
                (0, 0, 255),    # BR = red
                (0, 255, 255),  # BL = yellow
            ]
            labels = ["TL", "TR", "BR", "BL"]

            for pt, color, label in zip(ordered, colors, labels):
                x, y = int(pt[0]), int(pt[1])
                cv2.circle(debug, (x, y), 10, color, -1)
                cv2.putText(
                    debug, label, (x + 12, y + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2,
                )

            # Draw lines between corners in order
            pts = ordered.astype(np.int32)
            cv2.polylines(debug, [pts], True, (255, 255, 255), 2)

            cv2.imwrite(save_path, debug)
            return debug
        except Exception:
            return image

    @staticmethod
    def _validate_warp_output(warped: np.ndarray) -> bool:
        """
        Check warped image actually contains card content.
        A valid card warp should:
        - Not be mostly black (wrong region captured)
        - Not be mostly white (captured blank background)
        - Have reasonable pixel variance (actual content, not blank)
        """
        if warped is None:
            return False

        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        mean_val = float(np.mean(gray))
        variance = float(np.var(gray))

        if mean_val < 30:
            logger.warning(
                "[CORRECTOR] Warp output too dark (mean=%.1f) — wrong region captured",
                mean_val,
            )
            return False

        if mean_val > 240:
            logger.warning(
                "[CORRECTOR] Warp output too bright (mean=%.1f) — captured background",
                mean_val,
            )
            return False

        if variance < 100:
            logger.warning(
                "[CORRECTOR] Warp output has low variance (%.1f) — no content detected",
                variance,
            )
            return False

        return True

    @staticmethod
    def _failure(message: str, image: np.ndarray) -> dict:
        return {
            "success": False,
            "image": image.copy() if image is not None else None,
            "metadata": {},
            "message": message,
        }
