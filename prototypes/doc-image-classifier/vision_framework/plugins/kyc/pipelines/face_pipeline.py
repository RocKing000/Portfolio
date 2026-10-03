"""
FacePipeline — KYC face capture, liveness, and matching pipeline.

Single Responsibility: declare the ordered steps for face-based KYC.
Execution is delegated to PipelineEngine.

Steps:
  1. face_detection  (required) — detect and locate a face
  2. liveness_check  (required) — passive or active liveness
  3. embedding       (optional) — extract 512-d face embedding
"""

import logging
from typing import Any, Callable, List, Optional, Tuple

import numpy as np

from vision_framework.core.interfaces.base_pipeline import BasePipeline
from vision_framework.core.engine.pipeline_engine import PipelineEngine
from vision_framework.plugins.kyc.extractors.face_extractor import FaceExtractor

logger = logging.getLogger(__name__)


class FacePipeline(BasePipeline):
    """
    KYC face pipeline: detect → liveness → embed.

    *input_data* may be a single numpy frame or a dict with keys:
      frames    : List[np.ndarray]  — sequence of frames for liveness
      challenge : str               — 'passive', 'blink', etc.
      mode      : str               — 'capture' | 'match'
    """

    def __init__(self) -> None:
        self._face_extractor = FaceExtractor()
        self._engine = PipelineEngine()

    def get_steps(self) -> List[Tuple[str, Callable, bool]]:
        return [
            ("face_detection",  self._detect_face,   True),
            ("liveness_check",  self._check_liveness, True),
            ("embedding",       self._extract_embed,  False),
        ]

    def execute(self, input_data: Any) -> dict:
        return self._engine.run(self, input_data)

    # ------------------------------------------------------------------
    # Step implementations
    # ------------------------------------------------------------------

    def _detect_face(self, input_data: Any, _prev: dict) -> dict:
        frame = self._get_primary_frame(input_data)
        result = self._face_extractor.extract(frame, context={"mode": "detect"})
        return {
            "success": result["success"],
            "bbox": result["extracted_data"].get("bbox"),
            "confidence": result["confidence"],
            "keypoints": result["extracted_data"].get("keypoints"),
            "message": result["message"],
        }

    def _check_liveness(self, input_data: Any, _prev: dict) -> dict:
        frames = self._get_frames(input_data)
        challenge = self._get_challenge(input_data)
        result = self._face_extractor.extract(
            frames[0],
            context={"mode": "liveness", "frames": frames, "challenge": challenge},
        )
        liveness_data = result.get("extracted_data", {})
        return {
            "success": result["success"] and liveness_data.get("is_live", False),
            "is_live": liveness_data.get("is_live", False),
            "challenge": challenge,
            "challenge_passed": liveness_data.get("challenge_passed", False),
            "motion_score": liveness_data.get("motion_score"),
            "confidence": result["confidence"],
            "message": result["message"],
        }

    def _extract_embed(self, input_data: Any, _prev: dict) -> dict:
        frame = self._get_primary_frame(input_data)
        result = self._face_extractor.extract(frame, context={"mode": "embed"})
        return {
            "success": result["success"],
            "embedding": result["extracted_data"].get("embedding"),
            "dim": result["extracted_data"].get("dim"),
            "confidence": result["confidence"],
            "message": result["message"],
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_primary_frame(input_data: Any) -> np.ndarray:
        if isinstance(input_data, np.ndarray):
            return input_data
        if isinstance(input_data, dict):
            frames = input_data.get("frames")
            if frames and len(frames) > 0:
                return frames[0]
            img = input_data.get("image")
            if img is not None:
                return img
        raise ValueError("FacePipeline: cannot extract primary frame from input_data.")

    @staticmethod
    def _get_frames(input_data: Any) -> List[np.ndarray]:
        if isinstance(input_data, np.ndarray):
            return [input_data]
        if isinstance(input_data, dict):
            frames = input_data.get("frames", [])
            if frames:
                return frames
            img = input_data.get("image")
            if img is not None:
                return [img]
        return [input_data] if isinstance(input_data, np.ndarray) else []

    @staticmethod
    def _get_challenge(input_data: Any) -> str:
        if isinstance(input_data, dict):
            return input_data.get("challenge", "passive")
        return "passive"
