"""
DocumentClassifier — classify document type from a rectified document image.

Single Responsibility: determine whether the document is Aadhaar, PAN,
Passport, Driving Licence, or unknown.

Primary path   : MobileNetV2 model (via ModelRegistry)
Secondary path : rule-based colour/structure analysis
Tertiary path  : Ollama vision model (no training required)
"""

import logging
import re
from typing import Dict, List, Optional

import cv2
import numpy as np

from vision_framework.core.interfaces.base_classifier import BaseClassifier
from vision_framework.core.engine.model_registry import ModelRegistry
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

# Soft-import OllamaClient — if Ollama is not running the classifier still
# works via the rule-based path; Ollama is only invoked as final fallback.
try:
    from vision_framework.core.llm.ollama_client import OllamaClient as _OllamaClient
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

# Patterns for OCR-based classification
_UID_RE  = re.compile(r'\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b')
_PAN_RE  = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')
_PASS_RE = re.compile(r'\b[A-Z]\d{7}\b')
_DL_RE   = re.compile(r'\b[A-Z]{2}[0-9]{2}\s?[0-9]{11}\b')

logger = logging.getLogger(__name__)

_CLASSES = list(KYCConfig.SUPPORTED_CLASSES)


class DocumentClassifier(BaseClassifier):
    """
    Classifies KYC document type.

    Classification waterfall (first success wins):
      1. MobileNetV2 ONNX model  — fastest, highest accuracy when trained
      2. Rule-based colour/structure heuristics  — instant, no model needed
      3. Ollama vision model  — best accuracy when no trained model exists
    """

    def __init__(
        self,
        model_registry: Optional[ModelRegistry] = None,
        confidence_threshold: float = KYCConfig.CLASSIFIER_THRESHOLD,
        use_ollama_fallback: bool = True,
    ) -> None:
        self._registry = model_registry or ModelRegistry()
        self._threshold = confidence_threshold
        self._ollama: Optional[_OllamaClient] = None

        if use_ollama_fallback and _OLLAMA_AVAILABLE:
            try:
                self._ollama = _OllamaClient()
                logger.info("[CLASSIFIER] Ollama fallback enabled")
            except ConnectionError:
                logger.info("[CLASSIFIER] Ollama not running — Ollama fallback disabled")

    @property
    def classifier_name(self) -> str:
        return "document_classifier"

    def get_supported_classes(self) -> List[str]:
        return _CLASSES

    def classify(self, image: np.ndarray) -> dict:
        """
        Classify the document type in *image*.

        Normalises portrait orientation to landscape first, then tries the
        deep-learning model; falls back to rule-based on failure.
        """
        # Normalise portrait → landscape before any classification
        h, w = image.shape[:2]
        original_orientation = "portrait" if h > w else "landscape"
        orientation_corrected = False

        if h > w:
            image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
            orientation_corrected = True
            logger.debug("[CLASSIFIER] Card in portrait orientation — rotating to landscape")

        # --- Attempt model-based classification ---
        if self._registry.is_registered(KYCConfig.CLASSIFIER_MODEL_NAME):
            try:
                model = self._registry.get(KYCConfig.CLASSIFIER_MODEL_NAME)
                pred = model.predict(image)
                if pred.get("success") and pred.get("confidence", 0) >= self._threshold:
                    return {
                        "class_label": pred["predictions"],
                        "confidence": pred["confidence"],
                        "all_scores": pred.get("all_scores", {}),
                        "method": "model",
                        "orientation_corrected": orientation_corrected,
                        "original_orientation": original_orientation,
                    }
            except Exception as exc:
                logger.warning("DocumentClassifier: model failed (%s), using fallback.", exc)

        # --- Rule-based fallback ---
        result = self._rule_based_classify(image)
        result["orientation_corrected"] = orientation_corrected
        result["original_orientation"] = original_orientation

        # --- OCR text-pattern fallback (fast, before Ollama) ---
        if result["class_label"] == "unknown":
            ocr_type = self._classify_by_ocr_pattern(image)
            if ocr_type != "unknown":
                logger.debug("[CLASSIFIER] OCR pattern matched: %s", ocr_type)
                result = {
                    "class_label": ocr_type,
                    "confidence": 0.80,
                    "all_scores": {},
                    "method": "ocr_pattern",
                    "orientation_corrected": orientation_corrected,
                    "original_orientation": original_orientation,
                }

        # --- Ollama fallback (only when rule-based returns "unknown") ---
        if result["class_label"] == "unknown" and self._ollama is not None:
            try:
                logger.debug("[CLASSIFIER] Rule-based unknown — trying Ollama")
                ollama_result = self._ollama.classify_document(image)
                result = {
                    "class_label": ollama_result.get("document_type", "unknown"),
                    "confidence": ollama_result.get("confidence", 0.5),
                    "all_scores": {},
                    "method": "ollama_vision",
                    "orientation_corrected": orientation_corrected,
                    "original_orientation": original_orientation,
                    "ollama_reasoning": ollama_result.get("reasoning", ""),
                }
                logger.debug(
                    "[CLASSIFIER] Ollama result: %s (%.2f)",
                    result["class_label"],
                    result["confidence"],
                )
            except Exception as exc:
                logger.warning("[CLASSIFIER] Ollama fallback failed: %s", exc)

        return result

    # ------------------------------------------------------------------
    # OCR text-pattern fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_by_ocr_pattern(image: np.ndarray) -> str:
        """
        Run EasyOCR on the image and match text against known document
        number patterns (Aadhaar 12-digit, PAN 10-char, etc.).

        Uses the module-level EasyOCR singleton from ocr_extractor so the
        reader is only initialised once across the whole application.
        Returns a document-type string or "unknown".
        """
        try:
            # Lazy import to avoid circular-import at module load
            from vision_framework.plugins.kyc.extractors.ocr_extractor import _get_reader
            from vision_framework.plugins.kyc.config.kyc_config import KYCConfig as _cfg

            reader = _get_reader(_cfg.OCR_LANGUAGES)
            if reader is None:
                return "unknown"

            raw = reader.readtext(image, detail=0)          # list[str]
            text = " ".join(str(t) for t in raw)

            if _UID_RE.search(text):
                return "aadhaar"
            if _PAN_RE.search(text):
                return "pan"
            if _PASS_RE.search(text):
                return "passport"
            if _DL_RE.search(text):
                return "driving_license"
        except Exception as exc:
            logger.debug("[CLASSIFIER] OCR pattern step failed: %s", exc)
        return "unknown"

    # ------------------------------------------------------------------
    # Rule-based fallback
    # ------------------------------------------------------------------

    def _rule_based_classify(self, image: np.ndarray) -> dict:
        """
        Priority-based classification using colour analysis.

        Rules (first match wins):
          1. Aadhaar  — saffron/orange strip on left side
          2. PAN      — cream/yellow dominant background
          3. Passport — MRZ strip at bottom (dense dark text)
          4. Default  — unknown
        """
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        h, w = image.shape[:2]

        # Step 1: Aadhaar — saffron/orange strip in left 15% of image
        left_strip = hsv[:, :int(w * 0.15), :]
        aadhaar_mask = (
            (left_strip[:, :, 0] >= 10) & (left_strip[:, :, 0] <= 25)
            & (left_strip[:, :, 1] > 100)
        )
        orange_ratio = float(aadhaar_mask.mean())
        if orange_ratio > 0.05:
            logger.debug("[CLASSIFIER] Rule-based: aadhaar (orange_ratio=%.3f)", orange_ratio)
            return {
                "class_label": "aadhaar",
                "confidence": 0.75,
                "all_scores": {"aadhaar": 0.75},
                "method": "rule_based",
            }

        # Step 2: PAN — cream/yellow background (low saturation, warm hue)
        mean_hue = float(np.mean(hsv[:, :, 0]))
        mean_sat = float(np.mean(hsv[:, :, 1]))
        if 20 <= mean_hue <= 35 and 30 <= mean_sat <= 80:
            logger.debug(
                "[CLASSIFIER] Rule-based: pan (mean_hue=%.1f, mean_sat=%.1f)",
                mean_hue, mean_sat,
            )
            return {
                "class_label": "pan",
                "confidence": 0.70,
                "all_scores": {"pan": 0.70},
                "method": "rule_based",
            }

        # Step 3: Passport — MRZ band at bottom (dense dark pixels in bottom 15%)
        bottom_strip_v = hsv[int(h * 0.85):, :, 2]
        mrz_dark_ratio = float(np.mean(bottom_strip_v < 80))
        if mrz_dark_ratio > 0.20:
            logger.debug(
                "[CLASSIFIER] Rule-based: passport (mrz_dark_ratio=%.3f)", mrz_dark_ratio
            )
            return {
                "class_label": "passport",
                "confidence": 0.65,
                "all_scores": {"passport": 0.65},
                "method": "rule_based",
            }

        # Step 4: Default
        logger.debug("[CLASSIFIER] Rule-based: unknown (no rule matched)")
        return {
            "class_label": "unknown",
            "confidence": 1.0 / len(_CLASSES),
            "all_scores": {},
            "method": "rule_based",
        }
