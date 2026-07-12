"""
DocumentDetector — detect the boundaries of a document in an image.

Single Responsibility: locate the four corners of a rectangular document
using edge detection and contour analysis.
Implements BaseDetector; returns corner coordinates for perspective correction.
"""

import logging
from typing import List, Optional, Tuple

import cv2
import numpy as np

from vision_framework.core.interfaces.base_detector import BaseDetector
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)

# Maximum dimension used for internal processing — larger images are resized
# down before detection and corners scaled back up afterwards.  5× speedup on
# full-HD frames with negligible accuracy loss.
_PROC_MAX_DIM = 800


class DocumentDetector(BaseDetector):
    """
    Locates a rectangular document in an image.

    Pipeline:
      1. Resize image to max 800px longest side for speed
      2. Grayscale conversion
      3. Gaussian blur (5×5 kernel) to reduce noise
      4. Canny edge detection
      5. Find + filter contours by area
      6. Approximate each contour to a quadrilateral
      7. Validate aspect ratio and position
      8. Score candidates and return the best
      9. Hand occlusion check on winning candidate
    """

    def __init__(
        self,
        confidence_threshold: float = 0.5,
        min_area_ratio: float = KYCConfig.MIN_DOC_AREA_RATIO,
        aspect_ratio_min: float = KYCConfig.DOC_ASPECT_RATIO_MIN,
        aspect_ratio_max: float = KYCConfig.DOC_ASPECT_RATIO_MAX,
        center_bias_ratio: float = KYCConfig.CENTER_BIAS_RATIO,
    ) -> None:
        self._confidence_threshold = confidence_threshold
        self._min_area_ratio = min_area_ratio
        self._aspect_ratio_min = aspect_ratio_min
        self._aspect_ratio_max = aspect_ratio_max
        self._center_bias_ratio = center_bias_ratio

    @property
    def detector_name(self) -> str:
        return "document_detector"

    def get_confidence_threshold(self) -> float:
        return self._confidence_threshold

    def detect(self, image: np.ndarray) -> dict:
        """
        Detect document corners in *image*.

        Returns
        -------
        dict:
            detected       : bool
            locations      : list of corner arrays (shape 4×2 each)
            confidence     : float
            metadata       : dict
            hand_detected  : bool
            occlusion_ratio: float
            message        : str
        """
        if image is None or image.size == 0:
            return self._failure("Invalid image.")

        orig_h, orig_w = image.shape[:2]

        # Step 1: resize for speed — scale corners back afterwards
        proc_img, scale = self._resize_for_processing(image)
        img_h, img_w = proc_img.shape[:2]
        img_area = img_h * img_w

        # Step 2: grayscale
        gray = cv2.cvtColor(proc_img, cv2.COLOR_BGR2GRAY)

        # Step 3: blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Step 4: Canny
        edges = cv2.Canny(blurred, KYCConfig.CANNY_LOW, KYCConfig.CANNY_HIGH)

        # Step 5: contours
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return self._failure("No contours found.", {
                "contours_found": 0,
                "largest_area_ratio": 0.0,
                "best_candidate_sides": 0,
            })

        # Filter by minimum area
        min_area = img_area * self._min_area_ratio
        large_contours = [c for c in contours if cv2.contourArea(c) >= min_area]
        large_contours = sorted(large_contours, key=cv2.contourArea, reverse=True)

        largest_area_ratio = (
            cv2.contourArea(large_contours[0]) / img_area if large_contours else 0.0
        )
        best_candidate_sides = 0

        candidates = []
        for contour in large_contours[:10]:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(
                contour, KYCConfig.CONTOUR_APPROX_EPSILON * peri, True
            )
            best_candidate_sides = max(best_candidate_sides, len(approx))
            if len(approx) != 4:
                continue

            corners = approx.reshape(4, 2).astype(np.float32)
            corners = self._order_corners(corners)

            w = float(np.linalg.norm(corners[1] - corners[0]))
            h = float(np.linalg.norm(corners[3] - corners[0]))
            if h == 0:
                continue
            aspect = w / h
            if aspect < self._aspect_ratio_min:
                aspect = h / w
            if not (self._aspect_ratio_min <= aspect <= self._aspect_ratio_max):
                continue

            cx = float(corners[:, 0].mean())
            cy = float(corners[:, 1].mean())
            center_x_ok = abs(cx - img_w / 2) < img_w * (1 - self._center_bias_ratio) / 2
            center_y_ok = abs(cy - img_h / 2) < img_h * (1 - self._center_bias_ratio) / 2

            d1 = np.linalg.norm(corners[2] - corners[0])
            d2 = np.linalg.norm(corners[3] - corners[1])
            diag_ok = d1 > 0 and abs(d1 - d2) / max(d1, d2) < 0.15

            area_score = cv2.contourArea(contour) / img_area
            position_score = (1.0 if center_x_ok and center_y_ok else 0.5)
            diag_score = 1.0 if diag_ok else 0.7
            geometric_confidence = min(1.0, area_score * 3) * position_score * diag_score

            content_score = self._validate_quad_content(proc_img, corners)
            confidence = geometric_confidence * (0.5 + content_score * 0.5)

            candidates.append({
                "corners": corners,
                "confidence": confidence,
                "area": cv2.contourArea(contour),
                "aspect_ratio": aspect,
            })

        debug_info = {
            "contours_found": len(large_contours),
            "largest_area_ratio": round(largest_area_ratio, 4),
            "best_candidate_sides": best_candidate_sides,
        }

        if not candidates:
            # Second pass only when first pass completely failed.
            # Skip if we got a reasonable confidence from first pass.
            second = self._second_pass_detection(proc_img)
            if second["detected"]:
                logger.debug(
                    "DocumentDetector: second pass succeeded, confidence=%.3f",
                    second["confidence"],
                )
                # Scale corners back to original image space
                second = self._scale_result_corners(second, scale)
                return second

            # Fallback: minAreaRect of largest contour
            if not large_contours:
                return self._failure("No contours found.", debug_info)

            largest = large_contours[0]
            rect = cv2.minAreaRect(largest)
            box = cv2.boxPoints(rect).astype(np.float32)
            corners = self._order_corners(box)

            w = float(np.linalg.norm(corners[1] - corners[0]))
            h = float(np.linalg.norm(corners[3] - corners[0]))
            aspect = (w / h) if h > 0 else 1.0
            if aspect < 1.0:
                aspect = 1.0 / aspect

            fallback_area = cv2.contourArea(largest)
            # Scale corners back to original space
            corners_orig = corners / scale

            logger.debug(
                "DocumentDetector: no quad found — using minAreaRect fallback, "
                "area_ratio=%.3f, sides=%d",
                fallback_area / img_area, best_candidate_sides,
            )
            return {
                "detected": True,
                "locations": [corners_orig.tolist()],
                "confidence": 0.4,
                "hand_detected": False,
                "occlusion_ratio": 0.0,
                "metadata": {
                    "corners": corners_orig,
                    "aspect_ratio": aspect,
                    "document_area": fallback_area,
                    "image_area": orig_h * orig_w,
                    "all_candidates": 0,
                    "fallback": True,
                },
                "debug_info": debug_info,
                "message": "Document approximated via bounding rectangle (low confidence).",
            }

        # Pick best candidate
        best = max(candidates, key=lambda c: c["confidence"])

        # Skip expensive second pass when first pass is confident enough
        # (confidence > 0.5 means we have a solid quad — no need for adaptive pass)

        logger.debug(
            "DocumentDetector: found document, confidence=%.3f, aspect=%.2f",
            best["confidence"], best["aspect_ratio"],
        )

        # Scale corners back to original image space
        corners_orig = best["corners"] / scale

        # Hand occlusion check on original-resolution image
        occlusion = self._check_hand_occlusion(image, corners_orig)
        hand_detected = occlusion > 0.10

        if occlusion > 0.15:
            # Hard reject only when confidence is also low.
            # High-confidence detection (>0.7) can survive partial occlusion
            # — the card is clearly visible even with a hand partially in frame.
            if best["confidence"] < 0.7:
                return {
                    "detected": False,
                    "locations": [corners_orig.tolist()],
                    "confidence": best["confidence"],
                    "hand_detected": True,
                    "occlusion_ratio": round(float(occlusion), 3),
                    "metadata": {
                        "corners": corners_orig,
                        "aspect_ratio": best["aspect_ratio"],
                        "document_area": best["area"],
                        "image_area": orig_h * orig_w,
                        "all_candidates": len(candidates),
                    },
                    "debug_info": debug_info,
                    "message": (
                        f"Hand covering {occlusion * 100:.0f}% of card. "
                        "Lay card flat without holding it."
                    ),
                }
            # High confidence despite occlusion — warn but allow
            logger.debug(
                "DocumentDetector: occlusion=%.2f but confidence=%.3f — allowing with warning",
                occlusion, best["confidence"],
            )

        return {
            "detected": best["confidence"] >= self._confidence_threshold,
            "locations": [corners_orig.tolist()],
            "confidence": best["confidence"],
            "hand_detected": hand_detected,
            "occlusion_ratio": round(float(occlusion), 3),
            "metadata": {
                "corners": corners_orig,
                "aspect_ratio": best["aspect_ratio"],
                "document_area": best["area"],
                "image_area": orig_h * orig_w,
                "all_candidates": len(candidates),
            },
            "debug_info": debug_info,
            "message": "Document detected successfully.",
        }

    # ------------------------------------------------------------------
    # Debug helper
    # ------------------------------------------------------------------

    def detect_with_debug(self, image: np.ndarray,
                          debug_dir: str = "debug_frames/") -> dict:
        """Run intermediate pipeline steps and save each result as an image."""
        import os
        os.makedirs(debug_dir, exist_ok=True)

        cv2.imwrite(os.path.join(debug_dir, "1_original.jpg"), image)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        cv2.imwrite(os.path.join(debug_dir, "2_grayscale.jpg"), gray)

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        cv2.imwrite(os.path.join(debug_dir, "3_blurred.jpg"), blurred)

        edges = cv2.Canny(blurred, KYCConfig.CANNY_LOW, KYCConfig.CANNY_HIGH)
        cv2.imwrite(os.path.join(debug_dir, "4_edges.jpg"), edges)

        edges_sensitive = cv2.Canny(blurred, 30, 100)
        cv2.imwrite(os.path.join(debug_dir, "5_edges_sensitive.jpg"), edges_sensitive)

        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        contour_img = image.copy()
        cv2.drawContours(contour_img, contours, -1, (0, 255, 0), 2)
        cv2.imwrite(os.path.join(debug_dir, "6_all_contours.jpg"), contour_img)

        total_area = image.shape[0] * image.shape[1]
        contour_info = sorted(
            [{"index": i, "area": int(cv2.contourArea(c)),
              "area_ratio": round(cv2.contourArea(c) / total_area, 4),
              "perimeter": round(cv2.arcLength(c, True), 2)}
             for i, c in enumerate(contours)],
            key=lambda x: x["area"], reverse=True,
        )

        logger.debug(
            "detect_with_debug: saved 6 images to '%s', contours=%d",
            debug_dir, len(contours),
        )

        return {
            "debug_dir": os.path.abspath(debug_dir),
            "image_shape": list(image.shape),
            "total_contours": len(contours),
            "top_5_contours": contour_info[:5],
            "edges_pixels": int(np.sum(edges > 0)),
            "edges_sensitive_pixels": int(np.sum(edges_sensitive > 0)),
            "saved_files": [
                "1_original.jpg", "2_grayscale.jpg", "3_blurred.jpg",
                "4_edges.jpg", "5_edges_sensitive.jpg", "6_all_contours.jpg",
            ],
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resize_for_processing(image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Resize image so its longest side is at most _PROC_MAX_DIM pixels.

        Returns (resized_image, scale_factor).
        scale_factor < 1.0 means image was shrunk; divide corners by scale to
        convert back to original pixel coordinates.
        """
        h, w = image.shape[:2]
        if max(h, w) <= _PROC_MAX_DIM:
            return image, 1.0
        scale = _PROC_MAX_DIM / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return resized, scale

    @staticmethod
    def _scale_result_corners(result: dict, scale: float) -> dict:
        """Scale corner coordinates in a detect() result back to original space."""
        if scale == 1.0:
            return result
        meta = result.get("metadata", {})
        if "corners" in meta and meta["corners"] is not None:
            corners_orig = np.array(meta["corners"], dtype=np.float32) / scale
            meta["corners"] = corners_orig
            result["locations"] = [corners_orig.tolist()]
        return result

    @staticmethod
    def _order_corners(pts: np.ndarray) -> np.ndarray:
        """Order corners as: top-left, top-right, bottom-right, bottom-left."""
        pts = pts.reshape(4, 2).astype("float32")
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]   # TL
        rect[2] = pts[np.argmax(s)]   # BR
        diff = pts[:, 1] - pts[:, 0]  # y - x
        rect[1] = pts[np.argmin(diff)]  # TR
        rect[3] = pts[np.argmax(diff)]  # BL
        return rect

    @staticmethod
    def _validate_quad_content(image: np.ndarray, corners: np.ndarray) -> float:
        """
        Score a quadrilateral by the content inside it (0.0 to 1.0).
        Cards have a light background with printed content (reasonable variance).
        Dark regions (hand/background) score low; bright card content scores high.
        """
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        pts = corners.reshape(4, 2).astype(np.int32)
        cv2.fillPoly(mask, [pts], 255)

        gray_region = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        pixels = gray_region[mask > 0]

        if len(pixels) == 0:
            return 0.0

        mean_brightness = float(np.mean(pixels))
        variance = float(np.var(pixels))

        score = 0.0

        # Cards are generally light-coloured (white/cream background)
        if 150 <= mean_brightness <= 240:
            score += 0.4
        elif 120 <= mean_brightness < 150:
            score += 0.2

        # Cards have printed content — moderate-to-high variance
        if variance > 500:
            score += 0.4
        elif variance > 200:
            score += 0.2

        # Penalise dark regions — likely hand or background
        if mean_brightness < 100:
            score -= 0.3

        return max(0.0, min(1.0, score))

    def _second_pass_detection(self, image: np.ndarray) -> dict:
        """
        More aggressive detection using adaptive thresholding.
        Called only when first pass finds no valid quadrilateral.
        Confidence capped at 0.65.
        """
        img_h, img_w = image.shape[:2]
        img_area = img_h * img_w

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        adaptive = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2,
        )
        kernel = np.ones((3, 3), np.uint8)
        closed = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(
            closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        logger.debug("[DETECTOR] Second pass attempted — adaptive contours: %d", len(contours))

        min_area = img_area * self._min_area_ratio
        large = sorted(
            [c for c in contours if cv2.contourArea(c) >= min_area],
            key=cv2.contourArea, reverse=True,
        )

        candidates = []
        for contour in large[:10]:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.06 * peri, True)
            if len(approx) != 4:
                continue
            corners = self._order_corners(approx.reshape(4, 2).astype(np.float32))
            w = float(np.linalg.norm(corners[1] - corners[0]))
            h = float(np.linalg.norm(corners[3] - corners[0]))
            if h == 0:
                continue
            aspect = w / h
            if aspect < self._aspect_ratio_min:
                aspect = h / w
            if not (self._aspect_ratio_min <= aspect <= self._aspect_ratio_max):
                continue
            area_score = cv2.contourArea(contour) / img_area
            confidence = min(0.65, min(1.0, area_score * 3))
            candidates.append({"corners": corners, "confidence": confidence,
                                "area": cv2.contourArea(contour), "aspect_ratio": aspect})

        if not candidates:
            logger.debug("[DETECTOR] Second pass result: False confidence=0.000")
            return self._failure("Second pass: no quadrilateral found.")

        best = max(candidates, key=lambda c: c["confidence"])
        detected = best["confidence"] >= self._confidence_threshold
        logger.debug("[DETECTOR] Second pass result: %s confidence=%.3f", detected, best["confidence"])
        return {
            "detected": detected,
            "locations": [best["corners"].tolist()],
            "confidence": best["confidence"],
            "hand_detected": False,
            "occlusion_ratio": 0.0,
            "metadata": {
                "corners": best["corners"],
                "aspect_ratio": best["aspect_ratio"],
                "document_area": best["area"],
                "image_area": img_area,
                "all_candidates": len(candidates),
                "second_pass": True,
            },
            "debug_info": {"second_pass_contours": len(large), "second_pass_quads": len(candidates)},
            "message": "Document detected via adaptive threshold (second pass).",
        }

    def _check_hand_occlusion(
        self, image: np.ndarray, corners: np.ndarray
    ) -> float:
        """
        Returns occlusion ratio 0.0 (none) to 1.0 (fully covered).
        Uses skin colour detection in HSV space.
        """
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.fillPoly(mask, [corners.astype(np.int32)], 255)

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        skin_lower = np.array([0, 20, 70], dtype=np.uint8)
        skin_upper = np.array([20, 255, 255], dtype=np.uint8)
        skin_mask = cv2.inRange(hsv, skin_lower, skin_upper)

        overlap = cv2.bitwise_and(skin_mask, mask)
        card_area = float(np.sum(mask > 0))
        skin_area = float(np.sum(overlap > 0))

        if card_area == 0:
            return 0.0
        return skin_area / card_area

    @staticmethod
    def _failure(message: str, debug_info: Optional[dict] = None) -> dict:
        return {
            "detected": False,
            "locations": [],
            "confidence": 0.0,
            "hand_detected": False,
            "occlusion_ratio": 0.0,
            "metadata": {},
            "debug_info": debug_info or {},
            "message": message,
        }
