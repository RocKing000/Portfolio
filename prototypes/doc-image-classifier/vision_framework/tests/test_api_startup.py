"""
test_api_startup.py — FastAPI layer integration tests.

Run from vision_framework/ directory:
    py -3 tests/test_api_startup.py
"""

import os
import sys
import time
import json
import base64

_THIS = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)
_PARENT  = os.path.dirname(_VF_ROOT)
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

IMG_DIR = os.path.join(_THIS, "test_images")

_results: dict = {}


def _result(name: str, status: str, elapsed: float, detail: str = "") -> None:
    _results[name] = {"status": status, "elapsed": elapsed, "detail": detail}
    tag = {"PASS": "[PASS]", "FAIL": "[FAIL]", "SKIP": "[SKIP]"}.get(status, "[?]")
    detail_str = f" — {detail}" if detail else ""
    print(f"  {tag} {name}  ({elapsed*1000:.0f} ms){detail_str}")


# ─── Import guard ─────────────────────────────────────────────────────────────
try:
    from fastapi.testclient import TestClient
    import numpy as np
    import cv2
    _FASTAPI_AVAILABLE = True
except ImportError as e:
    print(f"SKIP: FastAPI TestClient not available — {e}")
    _FASTAPI_AVAILABLE = False

if not _FASTAPI_AVAILABLE:
    sys.exit(0)

# ─── Build app ────────────────────────────────────────────────────────────────
print("\nBuilding FastAPI app ...")
t_app_start = time.perf_counter()
try:
    from vision_framework.api.fastapi_app import create_app
    app = create_app()
    print(f"  App created in {(time.perf_counter()-t_app_start)*1000:.0f} ms")
except Exception as e:
    print(f"  FATAL: could not build app — {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)


# ─── All tests run inside a single TestClient context ─────────────────────────
# This triggers FastAPI's lifespan (startup/shutdown) events.
print("  Entering TestClient context (triggers lifespan startup) ...")

with TestClient(app, raise_server_exceptions=False) as client:

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 1 — Health endpoint
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-1] Health endpoint")
    try:
        t0 = time.perf_counter()
        response = client.get("/framework/health")
        elapsed = time.perf_counter() - t0

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        print(f"    status           : {data.get('status')}")
        print(f"    framework_version: {data.get('framework_version')}")
        print(f"    gpu_available    : {data.get('gpu_available')}")
        print(f"    plugins_loaded   : {data.get('plugins_loaded')}")
        print(f"    models_registered: {data.get('models_registered')}")

        assert data.get("status") == "healthy"
        assert "framework_version" in data
        _result("API-Health", "PASS", elapsed,
                f"plugins={data.get('plugins_loaded')}, models={data.get('models_registered')}")
    except Exception as e:
        _result("API-Health", "FAIL", 0, str(e))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 2 — Plugins endpoint
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-2] Plugins endpoint")
    try:
        t0 = time.perf_counter()
        response = client.get("/framework/plugins")
        elapsed = time.perf_counter() - t0

        assert response.status_code == 200
        data = response.json()
        plugins = data.get("plugins", [])
        names = [p["name"] for p in plugins]
        print(f"    loaded plugins: {names}")

        assert "kyc" in names, f"KYC plugin not in: {names}"
        kyc_info = next(p for p in plugins if p["name"] == "kyc")
        print(f"    KYC version   : {kyc_info.get('version')}")
        print(f"    KYC pipelines : {kyc_info.get('pipelines')}")

        _result("API-Plugins", "PASS", elapsed, f"plugins={names}")
    except Exception as e:
        _result("API-Plugins", "FAIL", 0, str(e))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 3 — Models endpoint
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-3] Models endpoint")
    try:
        t0 = time.perf_counter()
        response = client.get("/framework/models")
        elapsed = time.perf_counter() - t0

        assert response.status_code == 200
        data = response.json()
        models = data.get("models", [])
        print(f"    registered models: {[m['name'] for m in models]}")
        _result("API-Models", "PASS", elapsed, f"{len(models)} model(s)")
    except Exception as e:
        _result("API-Models", "FAIL", 0, str(e))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 4 — Document scan via multipart upload (mocked pipeline)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-4] Document scan — multipart upload (mocked pipeline)")
    try:
        from unittest.mock import patch
        from vision_framework.core.image.image_loader import ImageLoader

        sharp_path = os.path.join(IMG_DIR, "sharp_document.jpg")
        if not os.path.exists(sharp_path):
            raise FileNotFoundError(f"Test image not found: {sharp_path}")

        mock_corrected = np.zeros((400, 600, 3), dtype=np.uint8)

        mock_pipeline_result = {
            "success": True,
            "failed_at_step": None,
            "reason": None,
            "result": {
                "classification": {"class_label": "aadhaar", "confidence": 0.92},
                "ocr_extraction": {
                    "success": True,
                    "extracted_data": {
                        "aadhaar_number": "234567890123",
                        "name": "Test User",
                        "dob": "01/01/1990",
                        "gender": "M",
                    },
                    "raw_output": [],
                    "confidence": 0.87,
                },
                "validation": {
                    "valid": True, "errors": [], "warnings": [],
                    "validated_data": {"aadhaar_number": "234567890123"},
                },
                "digit_masking": {
                    "success": True,
                    "image": mock_corrected,
                    "metadata": {"masked": True},
                    "message": "Masked.",
                },
                "perspective_correction": {"success": True, "image": mock_corrected},
            },
            "step_times": {
                "blur_check": 8.2, "document_detection": 45.1,
                "perspective_correction": 3.0, "classification": 120.5,
                "ocr_extraction": 850.0, "validation": 1.2, "digit_masking": 5.3,
            },
            "total_time_ms": 1033.3,
        }

        t0 = time.perf_counter()
        with patch(
            "vision_framework.plugins.kyc.pipelines.document_pipeline.DocumentPipeline.execute",
            return_value=mock_pipeline_result,
        ):
            with open(sharp_path, "rb") as f:
                response = client.post(
                    "/api/kyc/scan-document",
                    files={"file": ("sharp_document.jpg", f, "image/jpeg")},
                )
        elapsed = time.perf_counter() - t0

        print(f"    HTTP status     : {response.status_code}")
        if response.status_code == 200:
            rdata = response.json()
            print(f"    success         : {rdata.get('success')}")
            print(f"    document_type   : {rdata.get('document_type')}")
            print(f"    validation_errs : {rdata.get('validation_errors')}")
            has_masked = rdata.get("masked_image_base64") not in (None, "")
            print(f"    masked_image_b64: {'present' if has_masked else 'absent'}")
            assert rdata.get("success"), "Expected success=True"
            assert rdata.get("document_type") == "aadhaar"
        else:
            print(f"    Response body: {response.text[:400]}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        _result("API-ScanDocument", "PASS", elapsed, f"status={response.status_code}")
    except Exception as e:
        _result("API-ScanDocument", "FAIL", 0, str(e))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 5 — Document scan via JSON base64 body (mocked)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-5] Document scan — JSON base64 body (mocked)")
    try:
        from unittest.mock import patch

        sharp_path = os.path.join(IMG_DIR, "sharp_document.jpg")
        with open(sharp_path, "rb") as f:
            b64_img = base64.b64encode(f.read()).decode()

        mock_corrected = np.zeros((400, 600, 3), dtype=np.uint8)
        mock_result = {
            "success": True, "failed_at_step": None, "reason": None,
            "result": {
                "classification": {"class_label": "pan", "confidence": 0.88},
                "ocr_extraction": {
                    "success": True,
                    "extracted_data": {"pan_number": "ABCDE1234F"},
                    "raw_output": [], "confidence": 0.91,
                },
                "validation": {"valid": True, "errors": [], "warnings": [], "validated_data": {}},
                "digit_masking": {"success": True, "image": mock_corrected, "metadata": {}},
                "perspective_correction": {"success": True, "image": mock_corrected},
            },
            "step_times": {"blur_check": 5.0},
            "total_time_ms": 5.0,
        }

        t0 = time.perf_counter()
        with patch(
            "vision_framework.plugins.kyc.pipelines.document_pipeline.DocumentPipeline.execute",
            return_value=mock_result,
        ):
            response = client.post(
                "/api/kyc/scan-document-json",
                json={"image": b64_img},
            )
        elapsed = time.perf_counter() - t0

        print(f"    HTTP status    : {response.status_code}")
        if response.status_code == 200:
            rdata = response.json()
            print(f"    success        : {rdata.get('success')}")
            print(f"    document_type  : {rdata.get('document_type')}")
            assert rdata.get("success")
            assert rdata.get("document_type") == "pan"
        else:
            print(f"    Response: {response.text[:300]}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        _result("API-ScanDocumentJSON", "PASS", elapsed, f"status={response.status_code}")
    except Exception as e:
        _result("API-ScanDocumentJSON", "FAIL", 0, str(e))

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 6 — Liveness endpoint — empty frames rejected
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[API-6] Verify-liveness — empty frames → 400")
    try:
        t0 = time.perf_counter()
        response = client.post(
            "/api/kyc/verify-liveness",
            json={"frames": [], "challenge": "blink"},
        )
        elapsed = time.perf_counter() - t0
        print(f"    HTTP status: {response.status_code}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        _result("API-LivenessEmptyFrames", "PASS", elapsed, "correctly returned 400")
    except Exception as e:
        _result("API-LivenessEmptyFrames", "FAIL", 0, str(e))

# ─── Summary ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 55)
print("API TEST SUMMARY")
print("=" * 55)
passed  = sum(1 for v in _results.values() if v["status"] == "PASS")
failed  = sum(1 for v in _results.values() if v["status"] == "FAIL")
skipped = sum(1 for v in _results.values() if v["status"] == "SKIP")

for name, info in _results.items():
    tag = {"PASS": "[PASS]", "FAIL": "[FAIL]", "SKIP": "[SKIP]"}.get(info["status"], "[?]")
    print(f"  {tag}  {name:<32} {info['elapsed']*1000:>7.0f} ms")

print("=" * 55)
print(f"  TOTAL: {passed} passed, {failed} failed, {skipped} skipped")
print("=" * 55)
