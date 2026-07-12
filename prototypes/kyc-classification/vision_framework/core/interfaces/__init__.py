"""Abstract interfaces — the contracts every plugin component must fulfill."""

from .base_processor import BaseProcessor
from .base_detector import BaseDetector
from .base_classifier import BaseClassifier
from .base_extractor import BaseExtractor
from .base_validator import BaseValidator
from .base_pipeline import BasePipeline
from .base_model import BaseModel
from .base_data_source import BaseDataSource

__all__ = [
    "BaseProcessor",
    "BaseDetector",
    "BaseClassifier",
    "BaseExtractor",
    "BaseValidator",
    "BasePipeline",
    "BaseModel",
    "BaseDataSource",
]
