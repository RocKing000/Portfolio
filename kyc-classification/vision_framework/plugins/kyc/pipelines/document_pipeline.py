"""
DocumentPipeline — end-to-end KYC document scanning pipeline.

Single Responsibility: declare the ordered processing steps for scanning
a KYC document.  Execution is delegated to PipelineEngine.

Steps:
  1. blur_check           (required) — reject blurry images early
  2. document_detection   (required) — find document boundaries
  3. perspective_correction (required) — rectify the document
  4. classification       (required) — identify document type
  5. ocr_extraction       (required) — extract text fields
  6. validation           (required) — validate extracted data
  7. digit_masking        (optional) — mask Aadhaar digits for privacy
"""

import logging
from typing import Any, Callable, List, Tuple

import numpy as np

from vision_framework.core.interfaces.base_pipeline import BasePipeline
from vision_framework.core.engine.pipeline_engine import PipelineEngine
from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
from vision_framework.plugins.kyc.processors.perspective_corrector import PerspectiveCorrector
from vision_framework.plugins.kyc.processors.digit_masker import DigitMasker
from vision_framework.plugins.kyc.classifiers.document_classifier import DocumentClassifier
from vision_framework.plugins.kyc.extractors.ocr_extractor import OCRExtractor
from vision_framework.plugins.kyc.validators.aadhaar_validator import AadhaarValidator
from vision_framework.plugins.kyc.validators.pan_validator import PANValidator

logger = logging.getLogger(__name__)


class DocumentPipeline(BasePipeline):
    """
    Orchestrates KYC document scanning from raw image to validated data.

    Each step is a separate class; this pipeline wires them together.
    Steps receive (input_data, previous_results) — they read prior results
    for context (e.g. detection corners → corrector, class → OCR router).
    """

    def __init__(self) -> None:
        self._blur = BlurProcessor()
        self._detector = DocumentDetector()
        self._corrector = PerspectiveCorrector()
        self._classifier = DocumentClassifier()
        self._ocr = OCRExtractor()
        self._masker = DigitMasker()
        self._engine = PipelineEngine()
        self._validators = {
            "aadhaar": AadhaarValidator(),
            "pan": PANValidator(),
        }

    def get_steps(self) -> List[Tuple[str, Callable, bool]]:
        return [
            ("blur_check",            self._blur_check,          True),
            ("document_detection",    self._detect_document,     True),
            ("perspective_correction",self._correct_perspective,  True),
            ("classification",        self._classify_document,   True),
            ("ocr_extraction",        self._extract_text,        True),
            ("validation",            self._validate_data,       True),
            ("digit_masking",         self._mask_digits,         False),
        ]

    def execute(self, input_data: Any) -> dict:
        """
        Run the full document pipeline.

        Parameters
        ----------
        input_data:
            BGR uint8 numpy image array.
        """
        return self._engine.run(self, input_data)

    # ------------------------------------------------------------------
    # Step implementations
    # ------------------------------------------------------------------

    def _blur_check(self, input_data: np.ndarray, _prev: dict) -> dict:
        return self._blur.process(input_data)

    def _detect_document(self, input_data: np.ndarray, _prev: dict) -> dict:
        result = self._detector.detect(input_data)
        corners = result["metadata"].get("corners")

        # Produce a bounding-box crop of the card region as a fallback image.
        # This is used by the API when perspective correction fails or is skipped.
        card_crop = None
        if result["detected"] and corners is not None:
            import cv2 as _cv2
            pts = np.array(corners, dtype=np.float32)
            x1 = max(0, int(pts[:, 0].min()))
            y1 = max(0, int(pts[:, 1].min()))
            x2 = min(input_data.shape[1], int(pts[:, 0].max()))
            y2 = min(input_data.shape[0], int(pts[:, 1].max()))
            if x2 > x1 and y2 > y1:
                card_crop = _cv2.resize(
                    input_data[y1:y2, x1:x2], (600, 378),
                    interpolation=_cv2.INTER_LINEAR,
                )

        logger.debug(
            "[PIPELINE] document_detection: detected=%s confidence=%.3f "
            "corners=%s card_crop=%s",
            result["detected"],
            result["confidence"],
            corners is not None,
            card_crop.shape if card_crop is not None else None,
        )

        return {
            "success": result["detected"],
            "image": card_crop,   # bbox crop — fallback if warp fails
            "locations": result["locations"],
            "corners": corners,
            "confidence": result["confidence"],
            "hand_detected": result.get("hand_detected", False),
            "occlusion_ratio": result.get("occlusion_ratio", 0.0),
            "message": result["message"],
        }

    def _correct_perspective(self, input_data: np.ndarray, prev: dict) -> dict:
        detection = prev.get("document_detection", {})
        corners = detection.get("corners")
        result = self._corrector.process(input_data, corners=corners)

        img = result.get("image")
        logger.debug(
            "[PIPELINE] perspective_correction: success=%s has_image=%s shape=%s mean=%.1f",
            result.get("success"),
            img is not None,
            img.shape if img is not None else None,
            float(img.mean()) if img is not None else 0.0,
        )

        return result

    def _classify_document(self, _input: np.ndarray, prev: dict) -> dict:
        corrected_img = prev.get("perspective_correction", {}).get("image")
        if corrected_img is None:
            return {"success": False, "message": "No corrected image for classification."}
        clf_result = self._classifier.classify(corrected_img)
        return {
            "success": True,
            "class_label": clf_result["class_label"],
            "confidence": clf_result["confidence"],
            "all_scores": clf_result["all_scores"],
            "method": clf_result["method"],
            "message": f"Classified as '{clf_result['class_label']}'.",
        }

    def _extract_text(self, _input: np.ndarray, prev: dict) -> dict:
        corrected_img = prev.get("perspective_correction", {}).get("image")
        if corrected_img is None:
            return {"success": False, "message": "No corrected image for OCR."}
        context = {
            "class_label": prev.get("classification", {}).get("class_label", "unknown")
        }
        ocr_result = self._ocr.extract(corrected_img, context=context)
        return {
            "success": ocr_result["success"],
            "extracted_data": ocr_result["extracted_data"],
            "raw_output": ocr_result["raw_output"],
            "confidence": ocr_result["confidence"],
            "message": ocr_result["message"],
        }

    def _validate_data(self, _input: np.ndarray, prev: dict) -> dict:
        doc_type = prev.get("classification", {}).get("class_label", "unknown")
        extracted = prev.get("ocr_extraction", {}).get("extracted_data", {})
        validator = self._validators.get(doc_type)
        if validator is None:
            return {
                "success": True,
                "valid": None,
                "errors": [],
                "warnings": [f"No validator for document type '{doc_type}'."],
                "validated_data": extracted,
                "message": f"No validator for '{doc_type}'.",
            }
        val_result = validator.validate(extracted)
        return {
            "success": val_result["valid"],
            "valid": val_result["valid"],
            "errors": val_result["errors"],
            "warnings": val_result["warnings"],
            "validated_data": val_result["validated_data"],
            "message": "Validation passed." if val_result["valid"] else
                       f"Validation failed: {'; '.join(val_result['errors'])}",
        }

    def _mask_digits(self, _input: np.ndarray, prev: dict) -> dict:
        doc_type = prev.get("classification", {}).get("class_label", "unknown")
        if doc_type != "aadhaar":
            return {"success": True, "message": f"Digit masking skipped for '{doc_type}'."}

        corrected_img = prev.get("perspective_correction", {}).get("image")
        if corrected_img is None:
            return {"success": True, "message": "No image for masking."}

        raw_output = prev.get("ocr_extraction", {}).get("raw_output", [])
        aadhaar_num = prev.get("ocr_extraction", {}).get("extracted_data", {}).get("aadhaar_number", "")
        bboxes = [t["bbox"] for t in (raw_output or [])
                  if aadhaar_num and aadhaar_num[:4] in t.get("text", "")]

        mask_result = self._masker.process(corrected_img, bboxes=bboxes)
        return {
            "success": mask_result["success"],
            "image": mask_result["image"],
            "metadata": mask_result["metadata"],
            "message": mask_result["message"],
        }
