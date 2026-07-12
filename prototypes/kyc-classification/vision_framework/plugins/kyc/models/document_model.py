"""
DocumentModel — MobileNetV2 classifier wrapper for document type recognition.

Single Responsibility: wrap the MobileNetV2 PyTorch model behind BaseModel
so that DocumentClassifier never touches PyTorch directly.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig

logger = logging.getLogger(__name__)

try:
    import torch
    import torchvision.models as tv_models
    import torchvision.transforms as T
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False
    logger.warning("DocumentModel: PyTorch not available; model will not load.")

_CLASS_NAMES = list(KYCConfig.SUPPORTED_CLASSES)


class DocumentModel(BaseModel):
    """
    MobileNetV2-based document type classifier.

    Wraps torchvision's MobileNetV2.  The final fully-connected layer is
    replaced to output len(SUPPORTED_CLASSES) logits.  Falls back gracefully
    when PyTorch is not installed — is_loaded() returns False and the
    DocumentClassifier will use its rule-based fallback.
    """

    def __init__(self) -> None:
        self._model: Optional[Any] = None
        self._device: str = "cpu"
        self._transform: Optional[Any] = None

    @property
    def model_name(self) -> str:
        return KYCConfig.CLASSIFIER_MODEL_NAME

    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self, model_path: Optional[str] = None) -> bool:
        """
        Load MobileNetV2 weights.

        If *model_path* points to a .pth file, loads fine-tuned weights.
        Otherwise initialises a pre-trained ImageNet backbone with a random
        head (useful for development without trained weights).
        """
        if not _TORCH_AVAILABLE:
            logger.error("DocumentModel.load: PyTorch not installed.")
            return False

        try:
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            model = tv_models.mobilenet_v2(pretrained=False)
            num_classes = len(_CLASS_NAMES)
            # Replace classifier head
            in_features = model.classifier[1].in_features
            model.classifier[1] = torch.nn.Linear(in_features, num_classes)

            if model_path and Path(model_path).exists():
                state = torch.load(model_path, map_location=self._device)
                model.load_state_dict(state)
                logger.info("DocumentModel: loaded weights from %s.", model_path)
            else:
                logger.warning(
                    "DocumentModel: no weights file found at '%s'; using random init.",
                    model_path,
                )

            model.eval()
            model.to(self._device)
            self._model = model
            self._transform = T.Compose([
                T.ToPILImage(),
                T.Resize(KYCConfig.CLASSIFIER_INPUT_SIZE),
                T.ToTensor(),
                T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            return True
        except Exception as exc:
            logger.exception("DocumentModel.load failed: %s", exc)
            return False

    def predict(self, input_data: np.ndarray) -> dict:
        """
        Classify a BGR document image.

        Parameters
        ----------
        input_data:
            BGR uint8 numpy array.

        Returns
        -------
        dict: success, predictions (class_label str), confidence, all_scores.
        """
        if not self.is_loaded():
            return {
                "success": False,
                "predictions": "unknown",
                "confidence": 0.0,
                "all_scores": {},
                "message": "Model not loaded.",
            }

        try:
            import torch
            rgb = input_data[..., ::-1].copy()  # BGR → RGB
            tensor = self._transform(rgb).unsqueeze(0).to(self._device)
            with torch.no_grad():
                logits = self._model(tensor)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

            best_idx = int(probs.argmax())
            all_scores: Dict[str, float] = {
                cls: round(float(probs[i]), 4)
                for i, cls in enumerate(_CLASS_NAMES)
            }

            return {
                "success": True,
                "predictions": _CLASS_NAMES[best_idx],
                "confidence": round(float(probs[best_idx]), 4),
                "all_scores": all_scores,
                "message": f"Predicted: {_CLASS_NAMES[best_idx]}.",
            }
        except Exception as exc:
            logger.exception("DocumentModel.predict failed: %s", exc)
            return {
                "success": False,
                "predictions": "unknown",
                "confidence": 0.0,
                "all_scores": {},
                "message": str(exc),
            }
