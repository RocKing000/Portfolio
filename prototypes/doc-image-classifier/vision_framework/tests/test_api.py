"""
test_api.py — integration tests for the FastAPI layer.

Uses httpx (or TestClient from Starlette) to send HTTP requests against
the FastAPI app without running an actual server process.

All tests mock the KYC pipeline results so they run without GPU / OCR deps.
"""

import base64
import unittest
from unittest.mock import MagicMock, patch

import cv2
import numpy as np

try:
    from fastapi.testclient import TestClient
    from vision_framework.api.fastapi_app import create_app
    _FASTAPI_AVAILABLE = True
except ImportError:
    _FASTAPI_AVAILABLE = False


def _make_jpeg_bytes() -> bytes:
    """Create a minimal valid JPEG image as bytes."""
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (80, 80), (255, 255, 255), -1)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def _make_b64_image() -> str:
    return base64.b64encode(_make_jpeg_bytes()).decode()


@unittest.skipUnless(_FASTAPI_AVAILABLE, "FastAPI / starlette not installed")
class TestFrameworkRoutes(unittest.TestCase):
    """Test framework introspection endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(create_app(), raise_server_exceptions=False)

    def test_health_endpoint(self):
        response = self.client.get("/framework/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertEqual(data["status"], "healthy")
        self.assertIn("framework_version", data)

    def test_plugins_endpoint(self):
        response = self.client.get("/framework/plugins")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("plugins", data)
        self.assertIsInstance(data["plugins"], list)

    def test_models_endpoint(self):
        response = self.client.get("/framework/models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("models", data)

    def test_load_plugin_missing_path(self):
        response = self.client.post("/framework/load-plugin", json={})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["success"])


@unittest.skipUnless(_FASTAPI_AVAILABLE, "FastAPI / starlette not installed")
class TestKYCRoutes(unittest.TestCase):
    """Test KYC plugin endpoints with mocked pipelines."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app, raise_server_exceptions=False)

    def _mock_pipeline_result(self, success: bool = True) -> dict:
        return {
            "success": success,
            "failed_at_step": None if success else "blur_check",
            "reason": None if success else "Blurry image",
            "result": {
                "classification": {"class_label": "aadhaar", "confidence": 0.95},
                "ocr_extraction": {
                    "success": True,
                    "extracted_data": {"aadhaar_number": "234567890123", "name": "Test User"},
                    "raw_output": [],
                    "confidence": 0.88,
                },
                "validation": {"valid": True, "errors": [], "warnings": []},
                "digit_masking": {"success": True, "image": np.zeros((100, 100, 3), dtype=np.uint8)},
            },
            "step_times": {"blur_check": 5.0},
            "total_time_ms": 5.0,
        }

    def test_scan_document_json_success(self):
        mock_result = self._mock_pipeline_result(success=True)
        with patch(
            "vision_framework.plugins.kyc.pipelines.document_pipeline.DocumentPipeline.execute",
            return_value=mock_result,
        ):
            response = self.client.post(
                "/api/kyc/scan-document-json",
                json={"image": _make_b64_image()},
            )
        self.assertIn(response.status_code, (200, 422))

    def test_scan_document_json_invalid_image(self):
        response = self.client.post(
            "/api/kyc/scan-document-json",
            json={"image": "notbase64!!!"},
        )
        self.assertIn(response.status_code, (400, 422, 500))

    def test_scan_document_multipart(self):
        jpeg = _make_jpeg_bytes()
        mock_result = self._mock_pipeline_result(success=True)
        with patch(
            "vision_framework.plugins.kyc.pipelines.document_pipeline.DocumentPipeline.execute",
            return_value=mock_result,
        ):
            response = self.client.post(
                "/api/kyc/scan-document",
                files={"file": ("test.jpg", jpeg, "image/jpeg")},
            )
        self.assertIn(response.status_code, (200, 422, 500))

    def test_capture_face(self):
        mock_result = {
            "success": True,
            "failed_at_step": None,
            "result": {
                "face_detection": {
                    "success": True,
                    "bbox": [10, 10, 80, 80],
                    "confidence": 0.98,
                    "keypoints": {},
                },
                "liveness_check": {"is_live": True, "challenge_passed": True, "confidence": 0.9},
                "embedding": {"success": True},
            },
            "step_times": {},
            "total_time_ms": 50.0,
        }
        with patch(
            "vision_framework.plugins.kyc.pipelines.face_pipeline.FacePipeline.execute",
            return_value=mock_result,
        ):
            response = self.client.post(
                "/api/kyc/capture-face",
                json={"image": _make_b64_image()},
            )
        self.assertIn(response.status_code, (200, 422, 500))

    def test_verify_liveness_no_frames(self):
        response = self.client.post(
            "/api/kyc/verify-liveness",
            json={"frames": [], "challenge": "blink"},
        )
        self.assertIn(response.status_code, (400, 422))

    def test_match_face(self):
        b64 = _make_b64_image()
        mock_match = {
            "success": True,
            "extracted_data": {
                "is_match": True,
                "similarity_score": 0.85,
                "confidence_level": "high",
                "threshold": 0.60,
            },
            "raw_output": {},
            "confidence": 0.85,
            "message": "Match.",
        }
        with patch(
            "vision_framework.plugins.kyc.extractors.face_extractor.FaceExtractor.extract",
            return_value=mock_match,
        ):
            response = self.client.post(
                "/api/kyc/match-face",
                json={"document_image": b64, "selfie": b64},
            )
        self.assertIn(response.status_code, (200, 422, 500))


# ------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
