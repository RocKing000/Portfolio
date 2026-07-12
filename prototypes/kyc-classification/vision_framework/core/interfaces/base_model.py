"""
BaseModel — abstract contract for all ML model wrappers.

Single Responsibility: wrap any ML model (PyTorch, TF, ONNX, rule-based)
behind a consistent load / predict / save interface.
Callers never know which framework powers the model.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseModel(ABC):
    """
    Abstract base for all ML model wrappers.

    Hides the underlying framework (PyTorch, TensorFlow, ONNX, scikit-learn,
    or pure rule-based logic) behind a stable, minimal interface.
    Models are loaded lazily; load() must be called before predict().
    """

    @abstractmethod
    def load(self, model_path: str = None) -> bool:
        """
        Load model weights from *model_path*.

        Parameters
        ----------
        model_path:
            Filesystem path to the model artifact.  May be None if the model
            loads from a built-in path or downloads automatically.

        Returns
        -------
        bool — True if the model loaded successfully.
        """

    @abstractmethod
    def predict(self, input_data: Any) -> dict:
        """
        Run inference on *input_data*.

        Parameters
        ----------
        input_data:
            Model-specific input (numpy array, tensor, dict, etc.).

        Returns
        -------
        dict — Model-specific prediction result.
        Must always include at least:
            success     : bool
            predictions : any
            confidence  : float
            message     : str
        """

    @abstractmethod
    def is_loaded(self) -> bool:
        """Return True if the model is ready for inference."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Unique, stable identifier (e.g. 'mobilenetv2_document_classifier')."""
