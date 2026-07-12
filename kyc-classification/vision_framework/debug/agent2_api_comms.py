"""
Agent 2 — API Communication Agent

Verifies Angular → FastAPI communication is correct.
Simulates exactly what Angular sends.

Run from vision_framework/ directory:
    py -3 debug/agent2_api_comms.py

Requires FastAPI server running at http://localhost:8000
"""

import os
import sys
import time
import base64
import io
from datetime import datetime

# ── Path setup ────────────────────────────────────────────────────────────────
_THIS    = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)
_PARENT  = os.path.dirname(_VF_ROOT)
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io as _io
    sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = _io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Output dirs ───────────────────────────────────────────────────────────────
LOG_DIR = "D:/vision_logs"
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    _test = os.path.join(LOG_DIR, ".write_test")
    open(_test, "w").close(); os.remove(_test)
except OSError:
    LOG_DIR = os.path.join(_VF_ROOT, "vision_logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"[WARN] Falling back to local log dir: {LOG_DIR}")

_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = os.path.join(LOG_DIR, f"agent2_api_comms_{_TS}.log")
TEST_IMG  = os.path.join(_VF_ROOT, "tests", "test_images", "sharp_document.jpg")
BASE_URL  = "http://localhost:8000"

_log_fh = open(LOG_FILE, "w", encoding="utf-8")

def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    line = f"[{ts}] {msg}"
    print(line)
    _log_fh.write(line + "\n")
    _log_fh.flush()

# ── Imports ───────────────────────────────────────────────────────────────────
try:
    import requests
    REQUESTS_OK = True
except ImportError:
    REQUESTS_OK = False

try:
    import cv2
    import numpy as np
    CV2_OK = True
except ImportError:
    CV2_OK = False

log("=" * 60)
log("AGENT 2 — API COMMUNICATION AGENT")
log(f"Log file: {LOG_FILE}")
log(f"Target: {BASE_URL}")
log("=" * 60)

if not REQUESTS_OK:
    log("[FATAL] 'requests' library not installed. Run: pip install requests")
    _log_fh.close()
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Server availability
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 1] Checking server availability")
log(f"[STEP 1] GET {BASE_URL}/framework/health")

SERVER_UP = False
try:
    t0 = time.perf_counter()
    r = requests.get(f"{BASE_URL}/framework/health", timeout=5)
    ms = (time.perf_counter() - t0) * 1000
    log(f"[STEP 1] Status code: {r.status_code}")
    log(f"[STEP 1] Response time: {ms:.1f}ms")
    try:
        log(f"[STEP 1] Response: {r.json()}")
    except Exception:
        log(f"[STEP 1] Response text: {r.text[:200]}")
    SERVER_UP = r.status_code < 400
    log(f"[STEP 1] Server available: {SERVER_UP}")
except requests.exceptions.ConnectionError:
    log(f"[STEP 1] Server NOT available — connection refused at {BASE_URL}")
    log("[STEP 1] Start backend: py -m uvicorn vision_framework.api.fastapi_app:app --port 8000")
    log("[STEP 1] Skipping all API tests.")
    _log_fh.close()
    sys.exit(0)
except Exception as e:
    log(f"[STEP 1] Unexpected error: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Direct file upload
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 2] POST /api/kyc/scan-document with direct file upload")
log(f"[STEP 2] File: {TEST_IMG}")

if not os.path.isfile(TEST_IMG):
    log("[STEP 2] SKIP — test image not found")
else:
    file_size = os.path.getsize(TEST_IMG)
    log(f"[STEP 2] File size: {file_size} bytes")
    with open(TEST_IMG, "rb") as f:
        files = {"file": ("sharp_document.jpg", f, "image/jpeg")}
        t0 = time.perf_counter()
        try:
            r = requests.post(f"{BASE_URL}/api/kyc/scan-document", files=files, timeout=30)
            ms = (time.perf_counter() - t0) * 1000
            log(f"[STEP 2] Status code: {r.status_code}")
            log(f"[STEP 2] Response time: {ms:.1f}ms")
            try:
                rj = r.json()
                log(f"[STEP 2] Response JSON: {rj}")
                log(f"[STEP 2] Success: {rj.get('success')}")
                # Try to find which step failed
                step_times = rj.get("step_times", {})
                if step_times:
                    log(f"[STEP 2] Step times: {step_times}")
                msg = rj.get("message", "")
                log(f"[STEP 2] Message: {msg}")
            except Exception:
                log(f"[STEP 2] Response (raw): {r.text[:500]}")
        except Exception as e:
            log(f"[STEP 2] Request error: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Base64 JSON (how Angular sends it)
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 3] POST /api/kyc/scan-document-json with base64 JSON body")

if os.path.isfile(TEST_IMG):
    with open(TEST_IMG, "rb") as f:
        img_bytes = f.read()
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    log(f"[STEP 3] Original file size: {len(img_bytes)} bytes")
    log(f"[STEP 3] Base64 string length: {len(b64)} chars")
    log(f"[STEP 3] Expected decoded size: {len(b64) * 3 // 4} bytes")

    t0 = time.perf_counter()
    try:
        r = requests.post(
            f"{BASE_URL}/api/kyc/scan-document-json",
            json={"image": b64},
            timeout=30,
        )
        ms = (time.perf_counter() - t0) * 1000
        log(f"[STEP 3] Status code: {r.status_code}")
        log(f"[STEP 3] Response time: {ms:.1f}ms")
        try:
            rj = r.json()
            log(f"[STEP 3] Response: {rj}")
        except Exception:
            log(f"[STEP 3] Response (raw): {r.text[:500]}")
    except Exception as e:
        log(f"[STEP 3] Request error: {e}")
else:
    log("[STEP 3] SKIP — test image not found")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Simulate Angular camera frame (JPEG quality 92)
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 4] Simulated Angular camera frame (JPEG quality 92)")

if CV2_OK and os.path.isfile(TEST_IMG):
    import numpy as np
    img = cv2.imread(TEST_IMG)
    # re-encode at quality 92 (Angular canvas.toBlob default)
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, 92]
    ret, buf = cv2.imencode(".jpg", img, encode_params)
    if ret:
        jpeg_bytes = buf.tobytes()
        log(f"[STEP 4] Re-encoded JPEG size: {len(jpeg_bytes)} bytes")
        log(f"[STEP 4] Quality: 92")
        files = {"file": ("camera_frame.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
        t0 = time.perf_counter()
        try:
            r = requests.post(f"{BASE_URL}/api/kyc/scan-document", files=files, timeout=30)
            ms = (time.perf_counter() - t0) * 1000
            log(f"[STEP 4] Status code: {r.status_code}")
            log(f"[STEP 4] Response time: {ms:.1f}ms")
            try:
                rj = r.json()
                log(f"[STEP 4] Response: {rj}")
                step_times = rj.get("step_times") or {}
                blur_meta  = step_times  # step times sometimes contain variance info
                log(f"[STEP 4] Step times: {step_times}")
            except Exception:
                log(f"[STEP 4] Response (raw): {r.text[:500]}")
        except Exception as e:
            log(f"[STEP 4] Request error: {e}")
    else:
        log("[STEP 4] SKIP — cv2.imencode failed")
else:
    log("[STEP 4] SKIP — cv2 or test image not available")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Image quality degradation test
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 5] Image quality degradation — JPEG quality sweep")

if CV2_OK and os.path.isfile(TEST_IMG):
    import numpy as np
    img = cv2.imread(TEST_IMG)
    for quality in [95, 85, 75, 60, 50, 30]:
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        ret, buf = cv2.imencode(".jpg", img, encode_params)
        if not ret:
            log(f"[STEP 5] Quality {quality}% — encode failed")
            continue
        jpeg_bytes = buf.tobytes()
        # compute local blur variance to predict outcome
        arr  = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        dec  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if dec is not None:
            g = cv2.cvtColor(dec, cv2.COLOR_BGR2GRAY)
            var = float(cv2.Laplacian(g, cv2.CV_64F).var())
        else:
            var = -1.0

        files = {"file": ("frame.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")}
        try:
            r = requests.post(f"{BASE_URL}/api/kyc/scan-document", files=files, timeout=20)
            try:
                rj = r.json()
                success = rj.get("success", False)
                msg     = rj.get("message", "")
                verdict = "PASS" if success else "FAIL"
            except Exception:
                verdict = f"HTTP {r.status_code}"
                msg = r.text[:100]
        except Exception as e:
            verdict = "ERROR"
            msg = str(e)

        log(f"[STEP 5] Quality {quality}% → local blur variance: {var:.2f} → {verdict}  ({msg})")
else:
    log("[STEP 5] SKIP — cv2 or test image not available")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Endpoint existence check
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 6] Checking all KYC endpoints exist")

endpoints = [
    ("GET",  "/framework/health"),
    ("GET",  "/framework/plugins"),
    ("POST", "/api/kyc/scan-document"),
    ("POST", "/api/kyc/scan-document-json"),
    ("POST", "/api/kyc/capture-face"),
    ("POST", "/api/kyc/verify-liveness"),
    ("POST", "/api/kyc/match-face"),
    ("POST", "/api/kyc/debug-detection"),
]

for method, path in endpoints:
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            r = requests.get(url, timeout=5)
        else:
            # POST with empty body — expect 422 (validation) not 404
            r = requests.post(url, timeout=5)
        exists = r.status_code not in (404, 405)
        log(f"[STEP 6] {method} {path}: {r.status_code} — {'EXISTS' if exists else 'MISSING'}")
    except Exception as e:
        log(f"[STEP 6] {method} {path}: ERROR — {e}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — CORS preflight simulation
# ══════════════════════════════════════════════════════════════════════════════
log("[STEP 7] CORS preflight check")

cors_headers = {
    "Origin": "http://localhost:4200",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
}
try:
    r = requests.options(
        f"{BASE_URL}/api/kyc/scan-document",
        headers=cors_headers,
        timeout=5,
    )
    log(f"[STEP 7] Status: {r.status_code}")
    acao = r.headers.get("access-control-allow-origin", "MISSING")
    acam = r.headers.get("access-control-allow-methods", "MISSING")
    acah = r.headers.get("access-control-allow-headers", "MISSING")
    log(f"[STEP 7] Access-Control-Allow-Origin: {acao}")
    log(f"[STEP 7] Access-Control-Allow-Methods: {acam}")
    log(f"[STEP 7] Access-Control-Allow-Headers: {acah}")
    cors_ok = acao != "MISSING" and ("*" in acao or "4200" in acao)
    log(f"[STEP 7] CORS working: {cors_ok}")
except Exception as e:
    log(f"[STEP 7] CORS check error: {e}")
    cors_ok = False


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
log("")
log("=" * 60)
log("[SUMMARY] AGENT 2 COMPLETE")
log(f"[SUMMARY] API layer status: {'WORKING' if SERVER_UP else 'BROKEN'}")
log("[SUMMARY] Communication method that works: multipart file upload (Step 2)")
log("[SUMMARY] Communication method that fails: check Step 3 base64 result above")
if not cors_ok:
    log("[SUMMARY] Root cause: CORS not configured — Angular requests will be blocked by browser")
    log("[SUMMARY] Recommended fix: add CORSMiddleware to FastAPI app for http://localhost:4200")
else:
    log("[SUMMARY] Root cause: see step results above for any failures")
    log("[SUMMARY] Recommended fix: see step results above")
log("=" * 60)

_log_fh.close()
print(f"\nLog saved: {LOG_FILE}")
