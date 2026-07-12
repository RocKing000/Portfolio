"""KYC pipelines."""
from .document_pipeline import DocumentPipeline
from .face_pipeline import FacePipeline

__all__ = ["DocumentPipeline", "FacePipeline"]
