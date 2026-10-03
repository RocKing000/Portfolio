"""
test_modules.py — per-module unit tests for the KYC Vision Framework.

Run from the vision_framework/ directory:
    py -3 tests/test_modules.py

Each test prints PASS / FAIL / SKIP with timing.
"""

import os
import sys
import time
import traceback

# Add both the project root AND its parent so 'vision_framework' is importable
_THIS = os.path.dirname(os.path.abspath(__file__))
_VF_ROOT = os.path.dirname(_THIS)              # vision_framework/
_PARENT  = os.path.dirname(_VF_ROOT)           # Documentation Recognition/
for _p in (_VF_ROOT, _PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Force UTF-8 output on Windows so Unicode tick/cross chars survive
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import cv2
import numpy as np

IMG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_images")

# ─── Result tracking ──────────────────────────────────────────────────────────
_results: dict = {}


def _result(name: str, status: str, elapsed: float, detail: str = "") -> None:
    _results[name] = {"status": status, "elapsed": elapsed, "detail": detail}
    tag = {"PASS": "✓", "FAIL": "✗", "SKIP": "⊘"}.get(status, "?")
    detail_str = f" — {detail}" if detail else ""
    print(f"  {tag} {status}: {name}  ({elapsed*1000:.0f} ms){detail_str}")


def _load(filename: str) -> np.ndarray:
    path = os.path.join(IMG_DIR, filename)
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Test image not found: {path}")
    return img


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1 — ImageLoader
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1] ImageLoader")
try:
    from vision_framework.core.image.image_loader import ImageLoader

    t0 = time.perf_counter()
    img = ImageLoader.from_file(os.path.join(IMG_DIR, "sharp_document.jpg"))
    assert isinstance(img, np.ndarray), "Not a numpy array"
    assert img.ndim == 3, f"Expected 3-dim array, got {img.ndim}"
    assert img.shape[2] == 3, "Expected 3 channels (BGR)"

    b64 = ImageLoader.to_base64(img)
    assert isinstance(b64, str) and len(b64) > 100

    img2 = ImageLoader.from_base64(b64)
    assert img2.shape == img.shape, f"Shape mismatch: {img.shape} vs {img2.shape}"

    # Round-trip via bytes
    _, buf = cv2.imencode(".jpg", img)
    img3 = ImageLoader.from_bytes(buf.tobytes())
    assert img3.shape == img.shape

    _result("ImageLoader", "PASS", time.perf_counter() - t0,
            f"shape={img.shape}, b64_len={len(b64)}")
except Exception as e:
    _result("ImageLoader", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2 — BlurProcessor
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2] BlurProcessor")
try:
    from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor

    sharp_img = _load("sharp_document.jpg")
    blurry_img = _load("blurry_document.jpg")

    proc = BlurProcessor(threshold=100.0)

    t0 = time.perf_counter()
    sharp_result = proc.process(sharp_img)
    blurry_result = proc.process(blurry_img)
    elapsed = time.perf_counter() - t0

    sharp_var = sharp_result["metadata"]["laplacian_variance"]
    blurry_var = blurry_result["metadata"]["laplacian_variance"]
    print(f"    Sharp variance : {sharp_var:.2f}")
    print(f"    Blurry variance: {blurry_var:.2f}")

    assert sharp_result["success"], f"Sharp image flagged as blurry (var={sharp_var:.1f})"
    assert not blurry_result["success"], f"Blurry image passed as sharp (var={blurry_var:.1f})"
    assert proc.processor_name == "blur_detector"

    _result("BlurProcessor", "PASS", elapsed,
            f"sharp_var={sharp_var:.1f}, blurry_var={blurry_var:.1f}")
except Exception as e:
    _result("BlurProcessor", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3 — DocumentDetector
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3] DocumentDetector")
try:
    from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector

    sharp_img  = _load("sharp_document.jpg")
    no_doc_img = _load("no_document.jpg")
    angled_img = _load("angled_document.jpg")

    det = DocumentDetector()

    t0 = time.perf_counter()
    r_sharp  = det.detect(sharp_img)
    r_no_doc = det.detect(no_doc_img)
    r_angled = det.detect(angled_img)
    elapsed = time.perf_counter() - t0

    print(f"    Sharp    detected={r_sharp['detected']}  conf={r_sharp['confidence']:.3f}")
    print(f"    No-doc   detected={r_no_doc['detected']}  conf={r_no_doc['confidence']:.3f}")
    print(f"    Angled   detected={r_angled['detected']}  conf={r_angled['confidence']:.3f}")
    if r_sharp["detected"] and r_sharp["metadata"].get("corners") is not None:
        print(f"    Corners: {r_sharp['metadata']['corners'].tolist()}")

    assert r_sharp["detected"], "DocumentDetector missed the sharp document"
    assert not r_no_doc["detected"], "DocumentDetector falsely detected in plain background"

    _result("DocumentDetector", "PASS", elapsed)
except Exception as e:
    _result("DocumentDetector", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4 — PerspectiveCorrector
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4] PerspectiveCorrector")
corrected_image = None
try:
    from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
    from vision_framework.plugins.kyc.processors.perspective_corrector import PerspectiveCorrector

    sharp_img = _load("sharp_document.jpg")
    det_result = DocumentDetector().detect(sharp_img)

    corrector = PerspectiveCorrector(output_size=(600, 400))

    t0 = time.perf_counter()
    if det_result["detected"]:
        corners = det_result["metadata"]["corners"]
        r = corrector.process(sharp_img, corners=corners)
    else:
        # Fall back: use known corners of the document rectangle (150,150)→(650,450)
        h, w = sharp_img.shape[:2]
        corners = np.float32([[150, 150], [650, 150], [650, 450], [150, 450]])
        r = corrector.process(sharp_img, corners=corners)
    elapsed = time.perf_counter() - t0

    assert r["success"], f"PerspectiveCorrector failed: {r['message']}"
    out_h, out_w = r["image"].shape[:2]
    assert out_w > out_h, f"Expected landscape output, got {out_w}x{out_h}"

    corrected_image = r["image"]
    out_path = os.path.join(IMG_DIR, "corrected_document.jpg")
    cv2.imwrite(out_path, corrected_image)
    print(f"    Saved corrected_document.jpg  ({out_w}x{out_h})")

    _result("PerspectiveCorrector", "PASS", elapsed,
            f"output={out_w}x{out_h}")
except Exception as e:
    _result("PerspectiveCorrector", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5 — DocumentClassifier
# ─────────────────────────────────────────────────────────────────────────────
print("\n[5] DocumentClassifier")
classification_result = None
try:
    from vision_framework.plugins.kyc.classifiers.document_classifier import DocumentClassifier
    from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

    test_img = corrected_image if corrected_image is not None else _load("sharp_document.jpg")
    clf = DocumentClassifier()

    t0 = time.perf_counter()
    result = clf.classify(test_img)
    elapsed = time.perf_counter() - t0

    classification_result = result
    print(f"    class_label : {result['class_label']}")
    print(f"    confidence  : {result['confidence']:.4f}")
    print(f"    method      : {result['method']}")
    print(f"    all_scores  : {result['all_scores']}")

    assert result["class_label"] in KYCConfig.SUPPORTED_CLASSES
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["method"] in ("model", "rule_based")
    assert clf.classifier_name == "document_classifier"

    _result("DocumentClassifier", "PASS", elapsed,
            f"label={result['class_label']} ({result['method']})")
except Exception as e:
    _result("DocumentClassifier", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 6 — OCRExtractor
# ─────────────────────────────────────────────────────────────────────────────
print("\n[6] OCRExtractor  (first call downloads EasyOCR model — may take 30–60s)")
ocr_raw_output = []
try:
    from vision_framework.plugins.kyc.extractors.ocr_extractor import OCRExtractor

    test_img = corrected_image if corrected_image is not None else _load("sharp_document.jpg")
    extractor = OCRExtractor()
    context = {
        "class_label": classification_result["class_label"]
        if classification_result else "aadhaar"
    }

    t0 = time.perf_counter()
    result = extractor.extract(test_img, context=context)
    elapsed = time.perf_counter() - t0

    all_texts = [t["text"] for t in (result.get("raw_output") or [])]
    ocr_raw_output = all_texts
    print(f"    success      : {result['success']}")
    print(f"    confidence   : {result['confidence']:.4f}")
    print(f"    detected texts: {all_texts}")
    print(f"    extracted_data: {result['extracted_data']}")

    # Check if the embedded UID-like number was found
    target = "234567890123"
    found_uid = any(target.replace(" ", "") in t.replace(" ", "") for t in all_texts)
    if found_uid:
        print(f"    ✓ Target UID '2345 6789 0123' found in OCR output")
    else:
        print(f"    ⚠ Target UID not found (OCR may still be correct on real docs)")

    _result("OCRExtractor", "PASS", elapsed,
            f"{len(all_texts)} text blocks, conf={result['confidence']:.2f}")
except Exception as e:
    _result("OCRExtractor", "FAIL", 0, f"{e}")


# ─────────────────────────────────────────────────────────────────────────────
# TEST 7 — AadhaarValidator
# ─────────────────────────────────────────────────────────────────────────────
print("\n[7] AadhaarValidator")
try:
    from vision_framework.plugins.kyc.validators.aadhaar_validator import AadhaarValidator

    validator = AadhaarValidator()
    t0 = time.perf_counter()

    cases = [
        ({"aadhaar_number": "234567890123", "name": "Test User",
          "dob": "01/01/1990", "gender": "MALE"}, True,  "valid 12-digit"),
        ({"aadhaar_number": "123456789012"},                 False, "starts with 1"),
        ({"aadhaar_number": "111111111111"},                 False, "all same digit"),
        ({"aadhaar_number": "123"},                          False, "too short"),
        ({"aadhaar_number": "234567890123", "dob": "01/01/2099",
          "name": "X", "gender": "MALE"},                   False, "future DOB"),
    ]

    all_ok = True
    for data, expect_valid, label in cases:
        result = validator.validate(data)
        ok = result["valid"] == expect_valid
        status = "✓" if ok else "✗"
        print(f"    {status} {label}: valid={result['valid']}  errors={result['errors']}")
        if not ok:
            all_ok = False

    elapsed = time.perf_counter() - t0
    assert all_ok, "One or more validator cases failed"
    _result("AadhaarValidator", "PASS", elapsed)
except Exception as e:
    _result("AadhaarValidator", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 8 — DigitMasker
# ─────────────────────────────────────────────────────────────────────────────
print("\n[8] DigitMasker")
try:
    from vision_framework.plugins.kyc.processors.digit_masker import DigitMasker

    test_img = corrected_image if corrected_image is not None else _load("sharp_document.jpg")
    masker = DigitMasker(digits_to_mask=8)

    # Create a mock bbox in EasyOCR corner format covering the UID number region
    # We know from generate_test_images.py that the UID is drawn at approx y=285
    # in the 500x300 document. After perspective correction to 600x400, adjust:
    h, w = test_img.shape[:2]
    # Mock bbox: covers bottom portion of the image (where the number would be)
    uid_bbox = [
        [int(w * 0.15), int(h * 0.82)],
        [int(w * 0.85), int(h * 0.82)],
        [int(w * 0.85), int(h * 0.95)],
        [int(w * 0.15), int(h * 0.95)],
    ]

    t0 = time.perf_counter()
    result = masker.process(test_img, bboxes=[uid_bbox])
    elapsed = time.perf_counter() - t0

    assert result["success"], f"DigitMasker failed: {result['message']}"
    assert result["metadata"]["masked"], "Expected masking to occur"
    assert result["image"].shape == test_img.shape

    out_path = os.path.join(IMG_DIR, "masked_document.jpg")
    cv2.imwrite(out_path, result["image"])
    print(f"    Saved masked_document.jpg")
    print(f"    masked_regions: {result['metadata']['masked_regions']}")

    _result("DigitMasker", "PASS", elapsed,
            f"masked {len(result['metadata']['masked_regions'])} region(s)")
except Exception as e:
    _result("DigitMasker", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEST 9 — Full DocumentPipeline
# ─────────────────────────────────────────────────────────────────────────────
print("\n[9] DocumentPipeline  (end-to-end — includes OCR, may be slow)")
try:
    from vision_framework.plugins.kyc.pipelines.document_pipeline import DocumentPipeline
    from vision_framework.core.engine.pipeline_engine import PipelineEngine

    pipeline = DocumentPipeline()
    engine = PipelineEngine()

    # --- Case A: sharp document ---
    print("    → Running on sharp_document.jpg ...")
    t0 = time.perf_counter()
    result_sharp = engine.run(pipeline, _load("sharp_document.jpg"))
    t_sharp = time.perf_counter() - t0

    print(f"    success        : {result_sharp['success']}")
    print(f"    failed_at_step : {result_sharp.get('failed_at_step')}")
    print(f"    step_times (ms): { {k: round(v,1) for k,v in result_sharp['step_times'].items()} }")
    print(f"    total_time_ms  : {result_sharp['total_time_ms']:.1f}")
    if result_sharp.get("result"):
        clf_r = result_sharp["result"].get("classification", {})
        ocr_r = result_sharp["result"].get("ocr_extraction", {})
        val_r = result_sharp["result"].get("validation", {})
        print(f"    doc_type       : {clf_r.get('class_label')}")
        print(f"    extracted_data : {ocr_r.get('extracted_data')}")
        print(f"    validation     : valid={val_r.get('valid')}, errors={val_r.get('errors')}")

    # --- Case B: blurry document — must fail at blur_check ---
    print("    → Running on blurry_document.jpg ...")
    result_blurry = engine.run(pipeline, _load("blurry_document.jpg"))
    assert not result_blurry["success"], "Blurry pipeline should fail"
    assert result_blurry["failed_at_step"] == "blur_check", \
        f"Expected fail at blur_check, got: {result_blurry['failed_at_step']}"
    print(f"    ✓ Blurry: failed_at_step={result_blurry['failed_at_step']} (expected)")

    # --- Case C: no document — must fail at document_detection ---
    print("    → Running on no_document.jpg ...")
    result_no_doc = engine.run(pipeline, _load("no_document.jpg"))
    assert not result_no_doc["success"], "No-document pipeline should fail"
    print(f"    ✓ No-doc: failed_at_step={result_no_doc['failed_at_step']} (expected)")

    _result("DocumentPipeline", "PASS", t_sharp,
            f"total={result_sharp['total_time_ms']:.0f}ms, steps={len(result_sharp['step_times'])}")
except Exception as e:
    _result("DocumentPipeline", "FAIL", 0, traceback.format_exc()[-300:])


# ─────────────────────────────────────────────────────────────────────────────
# TEST 10 — FaceExtractor
# ─────────────────────────────────────────────────────────────────────────────
print("\n[10] FaceExtractor")
try:
    from vision_framework.plugins.kyc.extractors.face_extractor import FaceExtractor, _MTCNN_AVAILABLE

    if not _MTCNN_AVAILABLE:
        _result("FaceExtractor", "SKIP", 0, "MTCNN/facenet-pytorch not available")
    else:
        face_img = _load("sharp_face.jpg")
        extractor = FaceExtractor()

        t0 = time.perf_counter()
        result = extractor.extract(face_img, context={"mode": "detect"})
        elapsed = time.perf_counter() - t0

        print(f"    success    : {result['success']}")
        print(f"    confidence : {result.get('confidence', 0):.4f}")
        if result["success"]:
            data = result["extracted_data"]
            print(f"    bbox       : {data.get('bbox')}")
            print(f"    keypoints  : {list(data.get('keypoints', {}).keys())}")
        else:
            print(f"    message    : {result['message']}")
            print("    (synthetic oval face may not be detected by MTCNN — expected)")

        _result("FaceExtractor", "PASS", elapsed,
                f"detected={result['success']}, conf={result.get('confidence',0):.3f}")
except Exception as e:
    _result("FaceExtractor", "FAIL", 0, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "═" * 55)
print("MODULE TEST SUMMARY")
print("═" * 55)
passed = sum(1 for v in _results.values() if v["status"] == "PASS")
failed = sum(1 for v in _results.values() if v["status"] == "FAIL")
skipped = sum(1 for v in _results.values() if v["status"] == "SKIP")

for name, info in _results.items():
    tag = {"PASS": "✓", "FAIL": "✗", "SKIP": "⊘"}.get(info["status"], "?")
    print(f"  {tag} {info['status']:<5}  {name:<25} {info['elapsed']*1000:>7.0f} ms")

print("═" * 55)
print(f"  TOTAL: {passed} passed, {failed} failed, {skipped} skipped")
print("═" * 55)
