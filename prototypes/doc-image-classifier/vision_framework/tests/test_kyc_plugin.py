"""
test_kyc_plugin.py — unit tests for the KYC plugin.

Tests each KYC component independently so failures are easy to pinpoint.
All tests use synthetic numpy images — no real document images required.
"""

import unittest
from typing import Any
from unittest.mock import MagicMock, patch

import cv2
import numpy as np

from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
from vision_framework.plugins.kyc.processors.perspective_corrector import PerspectiveCorrector
from vision_framework.plugins.kyc.processors.digit_masker import DigitMasker
from vision_framework.plugins.kyc.classifiers.document_classifier import DocumentClassifier
from vision_framework.plugins.kyc.validators.aadhaar_validator import AadhaarValidator
from vision_framework.plugins.kyc.validators.pan_validator import PANValidator
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _make_sharp_image(h: int = 300, w: int = 400) -> np.ndarray:
    """Create a high-contrast synthetic sharp image."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w, h), (200, 200, 200), -1)
    cv2.putText(img, "TEST DOC", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 0, 0), 5)
    return img


def _make_blurry_image(h: int = 300, w: int = 400) -> np.ndarray:
    """Create a strongly blurred image that will fail the sharpness check."""
    img = np.ones((h, w, 3), dtype=np.uint8) * 128
    return cv2.GaussianBlur(img, (51, 51), 30)


def _make_document_image() -> np.ndarray:
    """Create a synthetic document on a contrasting background."""
    canvas = np.ones((600, 800, 3), dtype=np.uint8) * 50
    # White document rectangle
    cv2.rectangle(canvas, (100, 150), (700, 450), (255, 255, 255), -1)
    cv2.rectangle(canvas, (100, 150), (700, 450), (0, 0, 0), 3)
    cv2.putText(canvas, "DOCUMENT", (200, 300), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3)
    return canvas


# ------------------------------------------------------------------
# BlurProcessor
# ------------------------------------------------------------------

class TestBlurProcessor(unittest.TestCase):

    def test_sharp_image_passes(self):
        proc = BlurProcessor(threshold=50.0)
        result = proc.process(_make_sharp_image())
        self.assertTrue(result["success"])
        self.assertIn("laplacian_variance", result["metadata"])

    def test_blurry_image_fails(self):
        proc = BlurProcessor(threshold=100.0)
        result = proc.process(_make_blurry_image())
        self.assertFalse(result["success"])
        self.assertIn("blurry", result["message"].lower())

    def test_invalid_input_fails(self):
        proc = BlurProcessor()
        result = proc.process(None)  # type: ignore[arg-type]
        self.assertFalse(result["success"])

    def test_processor_name(self):
        self.assertEqual(BlurProcessor().processor_name, "blur_detector")

    def test_output_is_copy(self):
        img = _make_sharp_image()
        proc = BlurProcessor(threshold=0)
        result = proc.process(img)
        result["image"][0, 0] = [1, 2, 3]
        self.assertFalse(np.array_equal(result["image"][0, 0], img[0, 0]))


# ------------------------------------------------------------------
# PerspectiveCorrector
# ------------------------------------------------------------------

class TestPerspectiveCorrector(unittest.TestCase):

    def _valid_corners(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        return np.float32([[0, 0], [w, 0], [w, h], [0, h]])

    def test_valid_corners(self):
        img = _make_sharp_image()
        corrector = PerspectiveCorrector(output_size=(200, 150))
        result = corrector.process(img, corners=self._valid_corners(img))
        self.assertTrue(result["success"])
        self.assertEqual(result["image"].shape[:2], (150, 200))

    def test_no_corners_fails(self):
        corrector = PerspectiveCorrector()
        result = corrector.process(_make_sharp_image())
        self.assertFalse(result["success"])

    def test_wrong_shape_corners_fails(self):
        corrector = PerspectiveCorrector()
        bad_corners = np.float32([[0, 0], [100, 0]])
        result = corrector.process(_make_sharp_image(), corners=bad_corners)
        self.assertFalse(result["success"])


# ------------------------------------------------------------------
# DigitMasker
# ------------------------------------------------------------------

class TestDigitMasker(unittest.TestCase):

    def test_mask_applied(self):
        img = np.random.randint(0, 255, (100, 400, 3), dtype=np.uint8)
        masker = DigitMasker(digits_to_mask=8)
        # EasyOCR-style bbox for a number spanning the image
        bbox = [[10, 10], [390, 10], [390, 90], [10, 90]]
        result = masker.process(img, bboxes=[bbox])
        self.assertTrue(result["success"])
        self.assertTrue(result["metadata"]["masked"])

    def test_no_bboxes_skips(self):
        masker = DigitMasker()
        result = masker.process(_make_sharp_image(), bboxes=[])
        self.assertTrue(result["success"])
        self.assertFalse(result["metadata"]["masked"])

    def test_processor_name(self):
        self.assertEqual(DigitMasker().processor_name, "digit_masker")


# ------------------------------------------------------------------
# DocumentClassifier (rule-based only — no model loaded)
# ------------------------------------------------------------------

class TestDocumentClassifier(unittest.TestCase):

    def test_returns_valid_class(self):
        clf = DocumentClassifier()
        # White/neutral image → should return one of the known classes
        img = np.ones((224, 224, 3), dtype=np.uint8) * 255
        result = clf.classify(img)
        self.assertIn(result["class_label"], KYCConfig.SUPPORTED_CLASSES)
        self.assertIn("method", result)
        self.assertIn("confidence", result)

    def test_all_scores_present(self):
        clf = DocumentClassifier()
        result = clf.classify(np.zeros((100, 100, 3), dtype=np.uint8))
        for cls in KYCConfig.SUPPORTED_CLASSES:
            self.assertIn(cls, result["all_scores"])

    def test_classifier_name(self):
        self.assertEqual(DocumentClassifier().classifier_name, "document_classifier")


# ------------------------------------------------------------------
# AadhaarValidator
# ------------------------------------------------------------------

class TestAadhaarValidator(unittest.TestCase):

    def setUp(self):
        self._validator = AadhaarValidator()

    def test_valid_aadhaar(self):
        result = self._validator.validate({
            "aadhaar_number": "234567890123",
            "name": "Ramesh Kumar",
            "dob": "01/01/1990",
            "gender": "MALE",
        })
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["errors"]), 0)

    def test_short_number(self):
        result = self._validator.validate({"aadhaar_number": "12345"})
        self.assertFalse(result["valid"])
        self.assertTrue(any("12 digits" in e for e in result["errors"]))

    def test_starts_with_1(self):
        result = self._validator.validate({"aadhaar_number": "123456789012"})
        self.assertFalse(result["valid"])

    def test_all_same_digit(self):
        result = self._validator.validate({"aadhaar_number": "111111111111"})
        self.assertFalse(result["valid"])

    def test_future_dob(self):
        result = self._validator.validate({
            "aadhaar_number": "234567890123",
            "dob": "01/01/2099",
            "name": "Test User",
            "gender": "MALE",
        })
        self.assertFalse(result["valid"])

    def test_invalid_gender_is_warning(self):
        result = self._validator.validate({
            "aadhaar_number": "234567890123",
            "name": "Test",
            "dob": "01/01/1990",
            "gender": "UNKNOWN_GENDER",
        })
        # Valid number but unknown gender → warning, not error
        self.assertTrue(result["valid"])
        self.assertTrue(any("gender" in w.lower() for w in result["warnings"]))

    def test_get_validation_rules(self):
        rules = self._validator.get_validation_rules()
        self.assertIsInstance(rules, dict)
        self.assertGreater(len(rules), 0)


# ------------------------------------------------------------------
# PANValidator
# ------------------------------------------------------------------

class TestPANValidator(unittest.TestCase):

    def setUp(self):
        self._validator = PANValidator()

    def test_valid_pan(self):
        result = self._validator.validate({
            "pan_number": "ABCDE1234F",
            "name": "RAMESH KUMAR",
        })
        self.assertTrue(result["valid"])
        self.assertEqual(result["validated_data"]["pan_number"], "ABCDE1234F")

    def test_invalid_format(self):
        result = self._validator.validate({"pan_number": "ABCDE12345"})
        self.assertFalse(result["valid"])

    def test_lowercase_normalised(self):
        result = self._validator.validate({"pan_number": "abcde1234f"})
        # Lowercase should fail the regex (all uppercase required)
        self.assertFalse(result["valid"])

    def test_missing_pan(self):
        result = self._validator.validate({})
        self.assertFalse(result["valid"])
        self.assertTrue(any("missing" in e for e in result["errors"]))

    def test_taxpayer_type_extracted(self):
        result = self._validator.validate({"pan_number": "ABCPE1234F"})
        if result["valid"]:
            self.assertIn("taxpayer_type", result["validated_data"])


# ------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
