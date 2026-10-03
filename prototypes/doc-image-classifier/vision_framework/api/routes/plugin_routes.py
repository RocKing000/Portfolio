"""
plugin_routes.py — dynamically generated KYC API routes.

Single Responsibility: map HTTP endpoints to KYC pipeline executions.
Each endpoint:
  1. Accepts image input (file upload or base64 JSON)
  2. Decodes it to a numpy array
  3. Runs the appropriate pipeline via PipelineEngine
  4. Returns a typed JSON response

This module is the ONLY place that knows about HTTP; all business logic
lives in the KYC plugin and its pipelines.
"""

import logging
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from vision_framework.core.image.image_loader import ImageLoader
from vision_framework.api.file_handler import image_from_base64, image_from_upload

logger = logging.getLogger(__name__)


def _sanitize(obj):
    """Recursively convert numpy scalars/arrays to native Python types."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):   # catches int32, float64, bool_, str_, etc.
        return obj.item()
    return obj


# ------------------------------------------------------------------
# Pydantic request / response models
# ------------------------------------------------------------------

class Base64ImageRequest(BaseModel):
    image: str  # base64-encoded image


class ScanDocumentB64Request(BaseModel):
    image_base64: str  # base64 or data-URI encoded image


class LivenessRequest(BaseModel):
    frames: List[str]   # list of base64 frames
    challenge: str = "passive"


class MatchRequest(BaseModel):
    document_image: str  # base64
    selfie: str          # base64


class ScanResponse(BaseModel):
    success: bool
    document_type: Optional[str] = None
    extracted_data: Optional[dict] = None
    masked_image_base64: Optional[str] = None
    step_times: Optional[dict] = None
    validation_errors: Optional[List[str]] = None
    message: Optional[str] = None


# ------------------------------------------------------------------
# Router factory
# ------------------------------------------------------------------

def build_kyc_router(kyc_plugin) -> APIRouter:
    """
    Build and return the KYC APIRouter.

    Parameters
    ----------
    kyc_plugin:
        Initialized KYCPlugin instance.

    Returns
    -------
    APIRouter with all KYC endpoints registered.
    """
    router = APIRouter(prefix="/api/kyc", tags=["KYC"])
    pipelines = kyc_plugin.get_pipelines()
    doc_pipeline = pipelines.get("document_scan")
    face_pipeline = pipelines.get("face_capture")

    # ------------------------------------------------------------------
    # POST /api/kyc/scan-document
    # ------------------------------------------------------------------
    @router.post("/scan-document")
    async def scan_document(
        file: Optional[UploadFile] = File(default=None),
        image_base64: Optional[str] = Form(default=None),
    ):
        """
        Scan a KYC document.

        Accepts either a multipart file upload OR a base64 form field.
        Runs the full document pipeline: blur → detect → correct → classify → OCR → validate → mask.
        """
        image = await _resolve_image(file, image_base64)
        result = doc_pipeline.execute(image)

        corrected_b64, masked_b64 = _extract_images(result)
        ocr_data = result.get("result", {}).get("ocr_extraction", {})
        classification = result.get("result", {}).get("classification", {})
        validation = result.get("result", {}).get("validation", {})
        detection = result.get("result", {}).get("document_detection", {})
        return JSONResponse(content=_sanitize({
            "success": result["success"],
            "failed_at_step": result.get("failed_at_step"),
            "document_type": classification.get("class_label"),
            "extracted_data": ocr_data.get("extracted_data"),
            "corrected_image_base64": corrected_b64,
            "masked_image_base64": masked_b64,
            "step_times": result.get("step_times"),
            "validation_errors": validation.get("errors", []),
            "hand_detected": detection.get("hand_detected", False),
            "occlusion_ratio": detection.get("occlusion_ratio", 0.0),
            "message": result.get("reason") or "Scan complete.",
        }))

    # ------------------------------------------------------------------
    # POST /api/kyc/scan-document (JSON body)
    # ------------------------------------------------------------------
    @router.post("/scan-document-json")
    async def scan_document_json(body: Base64ImageRequest):
        """Scan a KYC document from a base64-encoded JSON body."""
        image = image_from_base64(body.image)
        result = doc_pipeline.execute(image)
        return JSONResponse(content=_format_scan_response(result))

    # ------------------------------------------------------------------
    # POST /api/kyc/scan-document-b64
    # ------------------------------------------------------------------
    @router.post("/scan-document-b64")
    async def scan_document_b64(body: ScanDocumentB64Request):
        """
        Scan a KYC document from a base64 string.

        Accepts both raw base64 and data-URI format
        (e.g. "data:image/jpeg;base64,<data>") — the prefix is stripped
        automatically.  This is the preferred endpoint for Angular clients
        using canvas.toDataURL().
        """
        b64 = body.image_base64
        logger.debug("[API] b64 endpoint called — string length: %d", len(b64))
        has_prefix = "," in b64
        logger.debug("[API] has data URI prefix: %s", has_prefix)

        image = image_from_base64(b64)
        logger.debug("[API] decoded image shape: %s", image.shape)

        result = doc_pipeline.execute(image)

        corrected_b64, masked_b64 = _extract_images(result)
        ocr_data = result.get("result", {}).get("ocr_extraction", {})
        classification = result.get("result", {}).get("classification", {})
        validation = result.get("result", {}).get("validation", {})
        detection = result.get("result", {}).get("document_detection", {})

        return JSONResponse(content=_sanitize({
            "success": result["success"],
            "failed_at_step": result.get("failed_at_step"),
            "document_type": classification.get("class_label"),
            "extracted_data": ocr_data.get("extracted_data"),
            "corrected_image_base64": corrected_b64,
            "masked_image_base64": masked_b64,
            "step_times": result.get("step_times"),
            "validation_errors": validation.get("errors", []),
            "hand_detected": detection.get("hand_detected", False),
            "occlusion_ratio": detection.get("occlusion_ratio", 0.0),
            "message": result.get("reason") or "Scan complete.",
        }))

    # ------------------------------------------------------------------
    # POST /api/kyc/capture-face
    # ------------------------------------------------------------------
    @router.post("/capture-face")
    async def capture_face(
        file: Optional[UploadFile] = File(default=None),
        image_b64: Optional[str] = Form(default=None),
    ):
        """
        Detect a face in the image and return bounding box.
        Accepts either a multipart file upload or a base64 form field.
        """
        if file is not None:
            image = await image_from_upload(file)
        elif image_b64:
            image = image_from_base64(image_b64)
        else:
            raise HTTPException(status_code=400, detail="No image provided")
        result = face_pipeline.execute(image)
        face_data = result.get("result", {}).get("face_detection", {})

        return JSONResponse(content=_sanitize({
            "success": result["success"],
            "face_detected": face_data.get("success", False),
            "bounding_box": face_data.get("bbox"),
            "confidence": face_data.get("confidence"),
            "liveness_required": True,
            "challenge": "blink",
            "step_times": result.get("step_times"),
            "message": result.get("reason") or "Face capture complete.",
        }))

    # ------------------------------------------------------------------
    # POST /api/kyc/verify-liveness
    # ------------------------------------------------------------------
    @router.post("/verify-liveness")
    async def verify_liveness(body: LivenessRequest):
        """
        Verify liveness from a sequence of frames.

        Accepts base64-encoded frames and a challenge string.
        """
        if not body.frames:
            raise HTTPException(status_code=400, detail="No frames provided.")

        frames = [image_from_base64(f) for f in body.frames]
        input_data = {"frames": frames, "challenge": body.challenge}
        result = face_pipeline.execute(input_data)
        liveness = result.get("result", {}).get("liveness_check", {})

        return JSONResponse(content=_sanitize({
            "is_live": liveness.get("is_live", False),
            "motion_score": liveness.get("motion_score"),
            "challenge_passed": liveness.get("challenge_passed", False),
            "confidence": liveness.get("confidence", 0.0),
            "challenge": body.challenge,
            "step_times": result.get("step_times"),
            "message": result.get("reason") or "Liveness check complete.",
        }))

    # ------------------------------------------------------------------
    # POST /api/kyc/match-face
    # ------------------------------------------------------------------
    @router.post("/match-face")
    async def match_face(body: MatchRequest):
        """
        Compare a document photo with a live selfie.

        Returns cosine similarity and a match/no-match verdict.
        """
        from vision_framework.plugins.kyc.extractors.face_extractor import FaceExtractor
        doc_img = image_from_base64(body.document_image)
        selfie_img = image_from_base64(body.selfie)

        extractor = FaceExtractor()
        match_result = extractor.extract(
            doc_img, context={"mode": "match", "other_image": selfie_img}
        )

        data = match_result.get("extracted_data", {})
        return JSONResponse(content=_sanitize({
            "is_match": data.get("is_match", False),
            "similarity_score": data.get("similarity_score", 0.0),
            "confidence_level": data.get("confidence_level", "no_match"),
            "threshold": data.get("threshold"),
            "message": match_result.get("message", ""),
        }))

    # ------------------------------------------------------------------
    # POST /api/kyc/debug-detection
    # ------------------------------------------------------------------
    @router.post("/debug-detection")
    async def debug_detection(
        file: Optional[UploadFile] = File(default=None),
        image_base64: Optional[str] = Form(default=None),
        debug_dir: str = Form(default="debug_frames"),
    ):
        """
        Run detect_with_debug() and return intermediate image stats.

        Saves 6 intermediate images (original → grayscale → blur → edges
        → sensitive edges → contours) to *debug_dir* on the server, and
        returns contour statistics so you can see what the detector finds.
        """
        import os
        import cv2
        from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector

        image = await _resolve_image(file, image_base64)

        # ── Pre-detection diagnostics ──────────────────────────────────
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(os.path.join(debug_dir, "0_received.jpg"), image)

        print(f"Image shape: {image.shape}")
        print(f"Image dtype: {image.dtype}")
        print(f"Min pixel:   {image.min()}")
        print(f"Max pixel:   {image.max()}")
        print(f"Mean pixel:  {image.mean():.2f}")

        if image.max() == 0:
            return {"error": "Image is completely black — encoding issue in frontend"}

        if image.shape[0] < 50 or image.shape[1] < 50:
            return {"error": "Image too small — capture issue"}
        # ──────────────────────────────────────────────────────────────

        detector = DocumentDetector()
        debug_result = detector.detect_with_debug(image, debug_dir=debug_dir)
        return JSONResponse(content=_sanitize(debug_result))

    # ------------------------------------------------------------------
    # POST /api/kyc/diagnose
    # ------------------------------------------------------------------
    @router.post("/diagnose")
    async def diagnose(body: ScanDocumentB64Request):
        """
        Return detailed diagnostics for a frame without running the full pipeline.

        Useful for debugging why Angular camera frames fail detection.
        Runs blur analysis and document detection internals only — no OCR.
        """
        import base64 as _b64
        import cv2 as _cv2
        from vision_framework.plugins.kyc.config.kyc_config import KYCConfig
        from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
        from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector

        image = image_from_base64(body.image_base64)
        if image is None or image.size == 0:
            raise HTTPException(status_code=400, detail="Could not decode image.")

        h, w = image.shape[:2]
        gray = _cv2.cvtColor(image, _cv2.COLOR_BGR2GRAY)
        mean_px = float(image.mean())
        max_px = int(image.max())

        # Brightness category
        mean_brightness = float(gray.mean())
        if mean_brightness < 80:
            brightness_cat = "dark"
        elif mean_brightness < 120:
            brightness_cat = "dim"
        elif mean_brightness < 200:
            brightness_cat = "normal"
        else:
            brightness_cat = "bright"

        # Blur
        blur_variance = float(_cv2.Laplacian(gray, _cv2.CV_64F).var())
        blur_threshold = KYCConfig.BLUR_THRESHOLD
        if mean_brightness < 80:
            effective_blur_threshold = blur_threshold * 0.5
        elif mean_brightness < 120:
            effective_blur_threshold = blur_threshold * 0.7
        else:
            effective_blur_threshold = blur_threshold
        blur_passes = blur_variance >= effective_blur_threshold

        # Canny pass 1
        blurred = _cv2.GaussianBlur(gray, (5, 5), 0)
        edges1 = _cv2.Canny(blurred, KYCConfig.CANNY_LOW, KYCConfig.CANNY_HIGH)
        canny_pass1_pixels = int((edges1 > 0).sum())

        # Canny pass 2 (adaptive)
        adaptive = _cv2.adaptiveThreshold(gray, 255,
                                          _cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          _cv2.THRESH_BINARY, 11, 2)
        kernel = np.ones((3, 3), np.uint8)
        closed = _cv2.morphologyEx(adaptive, _cv2.MORPH_CLOSE, kernel)
        canny_pass2_pixels = int((closed > 0).sum())

        # Contours pass 1
        img_area = h * w
        min_area = img_area * KYCConfig.MIN_DOC_AREA_RATIO
        contours1, _ = _cv2.findContours(edges1, _cv2.RETR_EXTERNAL, _cv2.CHAIN_APPROX_SIMPLE)
        large1 = [c for c in contours1 if _cv2.contourArea(c) >= min_area]
        largest_ratio = _cv2.contourArea(large1[0]) / img_area if large1 else 0.0
        quads1 = 0
        for c in large1[:10]:
            p = _cv2.arcLength(c, True)
            a = _cv2.approxPolyDP(c, KYCConfig.CONTOUR_APPROX_EPSILON * p, True)
            if len(a) == 4:
                quads1 += 1

        # Contours pass 2
        contours2, _ = _cv2.findContours(closed, _cv2.RETR_EXTERNAL, _cv2.CHAIN_APPROX_SIMPLE)
        large2 = [c for c in contours2 if _cv2.contourArea(c) >= min_area]
        quads2 = 0
        for c in large2[:10]:
            p = _cv2.arcLength(c, True)
            a = _cv2.approxPolyDP(c, 0.06 * p, True)
            if len(a) == 4:
                quads2 += 1

        second_pass_attempted = quads1 == 0

        # Best quad confidence
        detector = DocumentDetector()
        det_result = detector.detect(image)
        best_conf = det_result.get("confidence", 0.0)

        # Recommendation
        if not blur_passes:
            recommendation = f"Image too blurry (variance={blur_variance:.1f} < threshold={effective_blur_threshold:.1f}). Ask user to hold steady."
        elif quads1 == 0 and quads2 == 0:
            recommendation = "No document quadrilateral found in either pass. Ensure document fills at least 1.5% of frame and has visible edges."
        elif not det_result.get("detected"):
            recommendation = f"Document found but confidence too low ({best_conf:.2f} < 0.5). Improve lighting or reduce background clutter."
        else:
            recommendation = "Detection should succeed."

        return JSONResponse(content=_sanitize({
            "image_received": True,
            "shape": [h, w, image.shape[2] if image.ndim == 3 else 1],
            "mean_pixel": round(mean_px, 2),
            "max_pixel": max_px,
            "blur_variance": round(blur_variance, 2),
            "blur_threshold": blur_threshold,
            "blur_passes": blur_passes,
            "brightness_category": brightness_cat,
            "effective_blur_threshold": round(effective_blur_threshold, 2),
            "canny_edge_pixels_pass1": canny_pass1_pixels,
            "canny_edge_pixels_pass2": canny_pass2_pixels,
            "contours_found": len(large1),
            "largest_contour_area_ratio": round(largest_ratio, 4),
            "quadrilaterals_found": quads1,
            "best_quad_confidence": round(float(best_conf), 3),
            "second_pass_attempted": second_pass_attempted,
            "second_pass_contours": len(large2),
            "second_pass_quads": quads2,
            "recommendation": recommendation,
        }))

    return router


# ------------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------------

async def _resolve_image(
    file: Optional[UploadFile], b64: Optional[str]
) -> np.ndarray:
    """Accept either file or base64; raise 400 if neither provided."""
    if file is not None:
        return await image_from_upload(file)
    if b64:
        return image_from_base64(b64)
    raise HTTPException(
        status_code=400,
        detail="Provide either 'file' (multipart) or 'image_base64' (form field).",
    )


def _extract_images(pipeline_result: dict):
    """
    Extract corrected and masked card images from a pipeline result.

    Fallback chain for corrected image:
      1. perspective_correction.image  (warp — best quality)
      2. document_detection.image      (bbox crop — reliable fallback)

    Masked image:
      1. digit_masking.image
      2. corrected image (fallback when masking was skipped)

    Returns (corrected_b64, masked_b64) — either may be None.
    """
    steps = pipeline_result.get("result", {})

    # ── corrected image ───────────────────────────────────────────────
    corrected_img = steps.get("perspective_correction", {}).get("image")
    if corrected_img is None:
        corrected_img = steps.get("document_detection", {}).get("image")

    if corrected_img is not None:
        print(f"[API] corrected_image shape: {corrected_img.shape}  "
              f"mean: {corrected_img.mean():.1f}")
    else:
        print("[API] WARNING: corrected_image is None — check pipeline")

    # ── masked image ──────────────────────────────────────────────────
    masked_img = steps.get("digit_masking", {}).get("image")
    if masked_img is None:
        masked_img = corrected_img   # fallback: show corrected if no masking done

    if masked_img is not None:
        print(f"[API] masked_image shape: {masked_img.shape}  "
              f"mean: {masked_img.mean():.1f}")
    else:
        print("[API] WARNING: masked_image is None")

    # ── encode ────────────────────────────────────────────────────────
    def _to_b64(img):
        if img is None:
            return None
        try:
            return ImageLoader.to_base64(img)
        except Exception:
            return None

    return _to_b64(corrected_img), _to_b64(masked_img)


def _format_scan_response(result: dict) -> dict:
    """Flatten a pipeline result into a clean API response dict."""
    ocr_data = result.get("result", {}).get("ocr_extraction", {})
    classification = result.get("result", {}).get("classification", {})
    validation = result.get("result", {}).get("validation", {})
    detection = result.get("result", {}).get("document_detection", {})

    corrected_b64, masked_b64 = _extract_images(result)

    return _sanitize({
        "success": result["success"],
        "failed_at_step": result.get("failed_at_step"),
        "document_type": classification.get("class_label"),
        "extracted_data": ocr_data.get("extracted_data"),
        "corrected_image_base64": corrected_b64,
        "masked_image_base64": masked_b64,
        "step_times": result.get("step_times"),
        "validation_errors": validation.get("errors", []),
        "hand_detected": detection.get("hand_detected", False),
        "occlusion_ratio": detection.get("occlusion_ratio", 0.0),
        "message": result.get("reason") or "Scan complete.",
    })  # caller wraps in JSONResponse
