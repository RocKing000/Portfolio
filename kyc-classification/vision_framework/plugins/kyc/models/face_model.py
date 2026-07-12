"""
FaceModel — InsightFace buffalo_l wrapper for face recognition.

Single Responsibility: wrap InsightFace's FaceAnalysis behind BaseModel
so that FaceExtractor never touches InsightFace directly.
"""

import logging
from typing import Any, Optional

import numpy as np

from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)

try:
    from insightface.app import FaceAnalysis as _FaceAnalysis
    _INSIGHTFACE_AVAILABLE = True
except ImportError:
    _INSIGHTFACE_AVAILABLE = False
    logger.warning("FaceModel: insightface not installed.")


class FaceModel(BaseModel):
    """
    Wraps InsightFace buffalo_l for face detection and embedding extraction.

    Provides a consistent BaseModel interface; hides InsightFace details
    from the rest of the framework.
    """

    def __init__(self, model_pack: str = KYCConfig.FACE_MODEL_NAME) -> None:
        self._model_pack = model_pack
        self._app: Optional[Any] = None

    @property
    def model_name(self) -> str:
        return f"insightface_{self._model_pack}"

    def is_loaded(self) -> bool:
        return self._app is not None

    def load(self, model_path: Optional[str] = None) -> bool:
        """
        Download / initialise InsightFace model pack.

        Parameters
        ----------
        model_path:
            Ignored for InsightFace (it manages its own cache).
        """
        if not _INSIGHTFACE_AVAILABLE:
            logger.error("FaceModel.load: insightface not installed.")
            return False
        try:
            app = _FaceAnalysis(
                name=self._model_pack,
                root=model_path or "~/.insightface",
            )
            app.prepare(ctx_id=0, det_size=(640, 640))
            self._app = app
            logger.info("FaceModel: loaded InsightFace '%s'.", self._model_pack)
            return True
        except Exception as exc:
            logger.exception("FaceModel.load failed: %s", exc)
            return False

    def predict(self, input_data: np.ndarray) -> dict:
        """
        Run face detection + embedding extraction on *input_data* (BGR uint8).

        Returns
        -------
        dict: success, predictions (list of face dicts), confidence, message.
        """
        if not self.is_loaded():
            return {
                "success": False,
                "predictions": [],
                "confidence": 0.0,
                "message": "FaceModel not loaded.",
            }
        try:
            import cv2
            rgb = cv2.cvtColor(input_data, cv2.COLOR_BGR2RGB)
            faces = self._app.get(rgb)
            if not faces:
                return {
                    "success": False,
                    "predictions": [],
                    "confidence": 0.0,
                    "message": "No faces detected.",
                }

            face_list = []
            for face in faces:
                emb = np.array(face.embedding, dtype=np.float32)
                norm = np.linalg.norm(emb)
                if norm > 0:
                    emb = emb / norm
                face_list.append({
                    "bbox": face.bbox.tolist(),
                    "det_score": float(face.det_score),
                    "embedding": emb.tolist(),
                })

            return {
                "success": True,
                "predictions": face_list,
                "confidence": float(faces[0].det_score),
                "message": f"Detected {len(face_list)} face(s).",
            }
        except Exception as exc:
            logger.exception("FaceModel.predict failed: %s", exc)
            return {
                "success": False,
                "predictions": [],
                "confidence": 0.0,
                "message": str(exc),
            }
