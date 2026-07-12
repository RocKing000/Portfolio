"""
stream_handler.py — WebSocket endpoint for real-time camera frame processing.

Single Responsibility: accept a WebSocket connection, process incoming frames
using a frame-sampling strategy, and stream results back to the client.

Frame-sampling strategy:
  - Blur check on every frame (cheap — always run)
  - Motion check on every frame (cheap)
  - Document detection every 5th sharp, steady frame
  - Classification only when document is detected
  - OCR only on the best-quality detected frame
"""

import asyncio
import base64
import json
import logging
import time
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from vision_framework.core.image.image_loader import ImageLoader
from vision_framework.plugins.kyc.processors.blur_processor import BlurProcessor
from vision_framework.plugins.kyc.processors.document_detector import DocumentDetector
from vision_framework.plugins.kyc.classifiers.document_classifier import DocumentClassifier
from vision_framework.plugins.kyc.extractors.ocr_extractor import OCRExtractor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws/kyc", tags=["WebSocket"])

# Sampling constants
_DETECTION_EVERY_N_FRAMES: int = 5
_MIN_SHARPNESS_FOR_DETECTION: float = 80.0
_MIN_MOTION_THRESHOLD: float = 2.0   # minimum pixel diff mean to ensure camera moved


class StreamProcessor:
    """
    Manages the per-WebSocket processing state.

    Maintains frame counter and best-quality frame reference for OCR.
    """

    def __init__(self) -> None:
        self._blur_check = BlurProcessor()
        self._detector = DocumentDetector()
        self._classifier = DocumentClassifier()
        self._ocr = OCRExtractor()
        self._frame_count = 0
        self._best_frame: Optional[np.ndarray] = None
        self._best_sharpness: float = 0.0
        self._prev_gray: Optional[np.ndarray] = None

    def process_frame(self, image: np.ndarray) -> dict:
        """
        Process a single frame and return a progressive result dict.
        """
        self._frame_count += 1
        result: dict = {"frame": self._frame_count, "timestamp_ms": int(time.time() * 1000)}

        # --- Always: blur check ---
        blur_result = self._blur_check.process(image)
        sharpness = blur_result["metadata"].get("laplacian_variance", 0)
        result["sharpness"] = round(sharpness, 1)
        result["is_sharp"] = blur_result["success"]

        if not blur_result["success"]:
            result["status"] = "blurry"
            result["message"] = blur_result["message"]
            self._prev_gray = None
            return result

        # --- Always: motion check ---
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        if self._prev_gray is not None:
            diff = float(np.mean(np.abs(gray.astype(float) - self._prev_gray.astype(float))))
            result["motion_score"] = round(diff, 2)
        else:
            result["motion_score"] = 0.0
        self._prev_gray = gray

        # Track best frame for OCR
        if sharpness > self._best_sharpness:
            self._best_sharpness = sharpness
            self._best_frame = image.copy()

        # --- Every Nth sharp frame: document detection ---
        if self._frame_count % _DETECTION_EVERY_N_FRAMES != 0:
            result["status"] = "scanning"
            return result

        detection = self._detector.detect(image)
        result["document_detected"] = detection["detected"]
        result["detection_confidence"] = round(detection["confidence"], 3)

        if not detection["detected"]:
            result["status"] = "no_document"
            result["message"] = detection["message"]
            return result

        # --- Document detected: classify ---
        clf = self._classifier.classify(image)
        result["document_type"] = clf["class_label"]
        result["classification_confidence"] = round(clf["confidence"], 3)

        # --- Run OCR on best-quality frame ---
        if self._best_frame is not None:
            context = {"class_label": clf["class_label"]}
            ocr_result = self._ocr.extract(self._best_frame, context=context)
            result["extracted_data"] = ocr_result.get("extracted_data", {})
            result["ocr_confidence"] = round(ocr_result.get("confidence", 0), 3)

        result["status"] = "document_found"
        result["corners"] = detection["locations"]
        return result


@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time document scanning.

    Client sends frames as JSON: {"image": "<base64>"}
    Server responds with progressive JSON results per frame.
    """
    await websocket.accept()
    logger.info("WebSocket: client connected.")
    processor = StreamProcessor()

    try:
        while True:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            payload = json.loads(raw)
            b64 = payload.get("image", "")

            if not b64:
                await websocket.send_json({"error": "No image in payload."})
                continue

            try:
                image = ImageLoader.from_base64(b64)
            except ValueError as exc:
                await websocket.send_json({"error": f"Decode failed: {exc}"})
                continue

            frame_result = processor.process_frame(image)
            await websocket.send_json(frame_result)

    except WebSocketDisconnect:
        logger.info("WebSocket: client disconnected normally.")
    except asyncio.TimeoutError:
        logger.warning("WebSocket: client timed out.")
        await websocket.close(code=1001)
    except Exception as exc:
        logger.exception("WebSocket: unhandled error: %s", exc)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
