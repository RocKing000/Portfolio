"""
FaceExtractor — detect faces, extract embeddings, assess liveness, match faces.

Single Responsibility: all face-related extraction in one place.
Uses MTCNN for detection and InsightFace buffalo_l for 512-d embeddings.
Liveness uses passive (optical flow) and active (EAR / nose shift) methods.
"""

import logging
import math
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from vision_framework.core.interfaces.base_extractor import BaseExtractor
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)

try:
    # Prefer facenet-pytorch MTCNN (PyTorch-based, no TF dependency)
    from facenet_pytorch import MTCNN as _MTCNN
    _MTCNN_AVAILABLE = True
    _MTCNN_BACKEND = "facenet_pytorch"
except ImportError:
    try:
        from mtcnn import MTCNN as _MTCNN
        _MTCNN_AVAILABLE = True
        _MTCNN_BACKEND = "mtcnn"
    except ImportError:
        _MTCNN_AVAILABLE = False
        _MTCNN_BACKEND = None
        logger.warning("FaceExtractor: neither facenet-pytorch nor mtcnn is installed.")

try:
    import insightface
    from insightface.app import FaceAnalysis as _FaceAnalysis
    _INSIGHTFACE_AVAILABLE = True
except ImportError:
    _INSIGHTFACE_AVAILABLE = False
    logger.warning("FaceExtractor: insightface not installed.")


class FaceExtractor(BaseExtractor):
    """
    Extracts face location, embedding, and liveness indicators.

    Three modes depending on the *context* dict:
      - detect    : locate face bounding box
      - embed     : extract 512-d embedding
      - liveness  : passive + active liveness checks
      - match     : cosine similarity between two embeddings
    """

    def __init__(self) -> None:
        self._mtcnn: Optional[Any] = None
        self._face_app: Optional[Any] = None

    @property
    def extractor_name(self) -> str:
        return "face_extractor"

    def _get_mtcnn(self):
        if self._mtcnn is None and _MTCNN_AVAILABLE:
            if _MTCNN_BACKEND == "facenet_pytorch":
                import torch
                self._mtcnn = _MTCNN(keep_all=True, device=torch.device("cpu"))
            else:
                self._mtcnn = _MTCNN()
        return self._mtcnn

    def _get_face_app(self):
        if self._face_app is None and _INSIGHTFACE_AVAILABLE:
            app = _FaceAnalysis(name=KYCConfig.FACE_MODEL_NAME)
            app.prepare(ctx_id=0, det_size=(640, 640))
            self._face_app = app
        return self._face_app

    def extract(self, image: np.ndarray, context: Optional[Dict] = None) -> dict:
        """
        Dispatch to the appropriate face operation based on context['mode'].

        Modes: 'detect' (default), 'embed', 'liveness', 'match'.
        """
        context = context or {}
        mode = context.get("mode", "detect")

        if mode == "detect":
            return self._detect_face(image)
        elif mode == "embed":
            return self._extract_embedding(image)
        elif mode == "liveness":
            frames: List[np.ndarray] = context.get("frames", [image])
            challenge: str = context.get("challenge", "passive")
            return self._assess_liveness(frames, challenge)
        elif mode == "match":
            other: Optional[np.ndarray] = context.get("other_image")
            return self._match_faces(image, other)
        else:
            return self._failure(f"Unknown mode '{mode}'.")

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def _detect_face(self, image: np.ndarray) -> dict:
        mtcnn = self._get_mtcnn()
        if mtcnn is None:
            return self._failure("MTCNN not available.")

        img_h, img_w = image.shape[:2]
        img_area = img_h * img_w
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        try:
            if _MTCNN_BACKEND == "facenet_pytorch":
                from PIL import Image as PILImage
                pil_img = PILImage.fromarray(rgb)
                boxes, probs, points = mtcnn.detect(pil_img, landmarks=True)
                if boxes is None or len(boxes) == 0:
                    return self._failure("No face detected.")
                # Convert facenet_pytorch format → unified format
                detections = []
                for i, (box, prob) in enumerate(zip(boxes, probs)):
                    x1, y1, x2, y2 = [int(v) for v in box]
                    kps = {}
                    if points is not None and i < len(points):
                        kp = points[i]
                        kps = {
                            "left_eye": (float(kp[0][0]), float(kp[0][1])),
                            "right_eye": (float(kp[1][0]), float(kp[1][1])),
                            "nose": (float(kp[2][0]), float(kp[2][1])),
                            "mouth_left": (float(kp[3][0]), float(kp[3][1])),
                            "mouth_right": (float(kp[4][0]), float(kp[4][1])),
                        }
                    detections.append({
                        "box": [x1, y1, x2 - x1, y2 - y1],
                        "confidence": float(prob),
                        "keypoints": kps,
                    })
            else:
                detections = mtcnn.detect_faces(rgb)
        except Exception as exc:
            return self._failure(f"MTCNN error: {exc}")

        if not detections:
            return self._failure("No face detected.")

        # Pick highest confidence face
        best = max(detections, key=lambda d: d["confidence"])
        conf = float(best["confidence"])
        x, y, w, h = best["box"]
        x, y = max(0, x), max(0, y)
        face_area_ratio = (w * h) / img_area

        if conf < KYCConfig.FACE_CONFIDENCE_MIN:
            return self._failure(f"Face confidence {conf:.2f} < {KYCConfig.FACE_CONFIDENCE_MIN}.")
        if not (KYCConfig.FACE_AREA_MIN <= face_area_ratio <= KYCConfig.FACE_AREA_MAX):
            return self._failure(
                f"Face area ratio {face_area_ratio:.3f} outside [{KYCConfig.FACE_AREA_MIN}, {KYCConfig.FACE_AREA_MAX}]."
            )

        return {
            "success": True,
            "extracted_data": {
                "bbox": [x, y, w, h],
                "confidence": conf,
                "keypoints": best.get("keypoints", {}),
                "face_area_ratio": face_area_ratio,
            },
            "raw_output": detections,
            "confidence": conf,
            "message": f"Face detected (conf={conf:.3f}).",
        }

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------

    def _extract_embedding(self, image: np.ndarray) -> dict:
        app = self._get_face_app()
        if app is None:
            return self._failure("InsightFace not available.")

        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        try:
            faces = app.get(rgb)
        except Exception as exc:
            return self._failure(f"InsightFace error: {exc}")

        if not faces:
            return self._failure("No face found for embedding.")

        face = faces[0]
        embedding = np.array(face.embedding, dtype=np.float32)
        # Normalise
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return {
            "success": True,
            "extracted_data": {"embedding": embedding.tolist(), "dim": len(embedding)},
            "raw_output": face,
            "confidence": float(face.det_score) if hasattr(face, "det_score") else 1.0,
            "message": f"Embedding extracted (dim={len(embedding)}).",
        }

    # ------------------------------------------------------------------
    # Liveness
    # ------------------------------------------------------------------

    def _assess_liveness(self, frames: List[np.ndarray], challenge: str) -> dict:
        if len(frames) < KYCConfig.LIVENESS_FRAMES_MIN:
            return self._failure(
                f"Need ≥{KYCConfig.LIVENESS_FRAMES_MIN} frames, got {len(frames)}."
            )

        if challenge == "passive":
            return self._passive_liveness(frames)
        elif challenge == "blink":
            return self._blink_challenge(frames)
        elif challenge in ("turn_left", "turn_right"):
            return self._turn_challenge(frames, challenge)
        elif challenge == "nod":
            return self._nod_challenge(frames)
        elif challenge == "smile":
            return self._smile_challenge(frames)
        else:
            return self._passive_liveness(frames)

    def _passive_liveness(self, frames: List[np.ndarray]) -> dict:
        """Optical flow in eye region across consecutive frames."""
        gray_frames = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
        motion_scores = []
        for i in range(1, len(gray_frames)):
            flow = cv2.calcOpticalFlowFarneback(
                gray_frames[i - 1], gray_frames[i], None,
                0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
            motion_scores.append(float(mag.mean()))

        avg_motion = float(np.mean(motion_scores)) if motion_scores else 0.0
        is_live = avg_motion >= KYCConfig.LIVENESS_MOTION_THRESHOLD

        return {
            "success": True,
            "extracted_data": {
                "is_live": is_live,
                "motion_score": round(avg_motion, 4),
                "challenge": "passive",
                "challenge_passed": is_live,
            },
            "raw_output": motion_scores,
            "confidence": min(1.0, avg_motion / (KYCConfig.LIVENESS_MOTION_THRESHOLD * 2)),
            "message": f"Passive liveness: motion={avg_motion:.3f}, live={is_live}.",
        }

    def _blink_challenge(self, frames: List[np.ndarray]) -> dict:
        """Detect at least one blink (EAR < threshold for ≥2 consecutive frames)."""
        ear_scores = [self._estimate_ear(f) for f in frames]
        blink_detected = False
        consecutive = 0
        for ear in ear_scores:
            if ear is not None and ear < KYCConfig.BLINK_EAR_THRESHOLD:
                consecutive += 1
                if consecutive >= KYCConfig.BLINK_CONSECUTIVE_FRAMES:
                    blink_detected = True
                    break
            else:
                consecutive = 0

        return {
            "success": True,
            "extracted_data": {
                "is_live": blink_detected,
                "challenge": "blink",
                "challenge_passed": blink_detected,
                "ear_scores": ear_scores,
            },
            "raw_output": ear_scores,
            "confidence": 1.0 if blink_detected else 0.0,
            "message": f"Blink challenge: {'passed' if blink_detected else 'failed'}.",
        }

    def _turn_challenge(self, frames: List[np.ndarray], direction: str) -> dict:
        """Detect horizontal nose shift > threshold pixels."""
        nose_xs = [self._estimate_nose_x(f) for f in frames]
        valid = [x for x in nose_xs if x is not None]
        if len(valid) < 2:
            return self._failure("Could not track nose across frames.")
        shift = max(valid) - min(valid) if direction == "turn_left" else min(valid) - max(valid)
        passed = abs(shift) >= KYCConfig.TURN_NOSE_X_SHIFT_PX
        return {
            "success": True,
            "extracted_data": {
                "is_live": passed,
                "challenge": direction,
                "challenge_passed": passed,
                "nose_shift_px": round(float(shift), 1),
            },
            "raw_output": nose_xs,
            "confidence": 1.0 if passed else 0.0,
            "message": f"Turn challenge ({direction}): shift={shift:.0f}px, passed={passed}.",
        }

    def _nod_challenge(self, frames: List[np.ndarray]) -> dict:
        """Detect vertical nose shift > threshold pixels."""
        nose_ys = [self._estimate_nose_y(f) for f in frames]
        valid = [y for y in nose_ys if y is not None]
        if len(valid) < 2:
            return self._failure("Could not track nose vertically.")
        shift = max(valid) - min(valid)
        passed = shift >= KYCConfig.NOD_NOSE_Y_SHIFT_PX
        return {
            "success": True,
            "extracted_data": {
                "is_live": passed,
                "challenge": "nod",
                "challenge_passed": passed,
                "nose_shift_px": round(float(shift), 1),
            },
            "raw_output": nose_ys,
            "confidence": 1.0 if passed else 0.0,
            "message": f"Nod challenge: shift={shift:.0f}px, passed={passed}.",
        }

    def _smile_challenge(self, frames: List[np.ndarray]) -> dict:
        """Detect mouth-corner distance increase > threshold."""
        widths = [self._estimate_mouth_width(f) for f in frames]
        valid = [w for w in widths if w is not None and w > 0]
        if len(valid) < 2:
            return self._failure("Could not estimate mouth width.")
        increase = (max(valid) - min(valid)) / min(valid)
        passed = increase >= KYCConfig.SMILE_MOUTH_INCREASE_PCT
        return {
            "success": True,
            "extracted_data": {
                "is_live": passed,
                "challenge": "smile",
                "challenge_passed": passed,
                "mouth_increase_pct": round(float(increase * 100), 1),
            },
            "raw_output": valid,
            "confidence": 1.0 if passed else 0.0,
            "message": f"Smile challenge: increase={increase*100:.1f}%, passed={passed}.",
        }

    # ------------------------------------------------------------------
    # Face matching
    # ------------------------------------------------------------------

    def _match_faces(
        self, image_a: np.ndarray, image_b: Optional[np.ndarray]
    ) -> dict:
        if image_b is None:
            return self._failure("Second image not provided for face match.")

        emb_a = self._extract_embedding(image_a)
        emb_b = self._extract_embedding(image_b)

        if not emb_a["success"] or not emb_b["success"]:
            return self._failure("Could not extract embedding from one or both images.")

        a = np.array(emb_a["extracted_data"]["embedding"], dtype=np.float32)
        b = np.array(emb_b["extracted_data"]["embedding"], dtype=np.float32)

        similarity = float(np.dot(a, b))  # already unit-normalised
        is_match = similarity >= KYCConfig.FACE_MATCH_THRESHOLD

        if similarity >= KYCConfig.FACE_MATCH_HIGH_CONFIDENCE:
            confidence_level = "high"
        elif similarity >= KYCConfig.FACE_MATCH_THRESHOLD:
            confidence_level = "medium"
        else:
            confidence_level = "no_match"

        return {
            "success": True,
            "extracted_data": {
                "is_match": is_match,
                "similarity_score": round(similarity, 4),
                "confidence_level": confidence_level,
                "threshold": KYCConfig.FACE_MATCH_THRESHOLD,
            },
            "raw_output": {"similarity": similarity},
            "confidence": round(similarity, 4),
            "message": f"Face match: similarity={similarity:.3f}, level={confidence_level}.",
        }

    # ------------------------------------------------------------------
    # Landmark estimation helpers (simplified, MTCNN-based)
    # ------------------------------------------------------------------

    def _get_keypoints_from_frame(self, frame: np.ndarray) -> Optional[dict]:
        """Return unified keypoints dict from any MTCNN backend, or None."""
        mtcnn = self._get_mtcnn()
        if mtcnn is None:
            return None
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            if _MTCNN_BACKEND == "facenet_pytorch":
                from PIL import Image as PILImage
                pil_img = PILImage.fromarray(rgb)
                boxes, probs, points = mtcnn.detect(pil_img, landmarks=True)
                if boxes is None or len(boxes) == 0 or points is None:
                    return None
                kp = points[0]
                return {
                    "left_eye": (float(kp[0][0]), float(kp[0][1])),
                    "right_eye": (float(kp[1][0]), float(kp[1][1])),
                    "nose": (float(kp[2][0]), float(kp[2][1])),
                    "mouth_left": (float(kp[3][0]), float(kp[3][1])),
                    "mouth_right": (float(kp[4][0]), float(kp[4][1])),
                }
            else:
                dets = mtcnn.detect_faces(rgb)
                if not dets:
                    return None
                return dets[0].get("keypoints", {})
        except Exception:
            return None

    def _estimate_ear(self, frame: np.ndarray) -> Optional[float]:
        """Approximate Eye Aspect Ratio from MTCNN keypoints."""
        kps = self._get_keypoints_from_frame(frame)
        if kps is None:
            return None
        try:
            le = kps.get("left_eye")
            re = kps.get("right_eye")
            if le is None or re is None:
                return None
            # Simplified EAR approximation using eye distance / image height
            eye_dist = math.dist(le, re)
            return eye_dist / frame.shape[0]
        except Exception:
            return None

    def _estimate_nose_x(self, frame: np.ndarray) -> Optional[float]:
        kps = self._get_keypoints_from_frame(frame)
        if kps is None:
            return None
        try:
            nose = kps.get("nose")
            return float(nose[0]) if nose else None
        except Exception:
            return None

    def _estimate_nose_y(self, frame: np.ndarray) -> Optional[float]:
        kps = self._get_keypoints_from_frame(frame)
        if kps is None:
            return None
        try:
            nose = kps.get("nose")
            return float(nose[1]) if nose else None
        except Exception:
            return None

    def _estimate_mouth_width(self, frame: np.ndarray) -> Optional[float]:
        kps = self._get_keypoints_from_frame(frame)
        if kps is None:
            return None
        try:
            ml = kps.get("mouth_left")
            mr = kps.get("mouth_right")
            if ml is None or mr is None:
                return None
            return math.dist(ml, mr)
        except Exception:
            return None

    # ------------------------------------------------------------------

    @staticmethod
    def _failure(message: str) -> dict:
        return {
            "success": False,
            "extracted_data": {},
            "raw_output": None,
            "confidence": 0.0,
            "message": message,
        }
