"""
BaseExtractor — abstract contract for all structured-data extractors.

Single Responsibility: extract structured data from an image.
Examples: OCRExtractor (text fields), FaceExtractor (embeddings), QRExtractor.
Extractors NEVER return images — only structured data.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

import numpy as np


class BaseExtractor(ABC):
    """
    Abstract base for all extractors.

    An extractor reads an image (or image region) and produces structured,
    serialisable data — strings, numbers, embeddings, etc.
    It may optionally receive a *context* dict from earlier pipeline steps.
    """

    @abstractmethod
    def extract(self, image: np.ndarray, context: Optional[dict] = None) -> dict:
        """
        Extract structured data from *image*.

        Parameters
        ----------
        image:
            Input image as a numpy array (H x W x C).
        context:
            Optional dict containing results from earlier pipeline steps
            (e.g. document type from a classifier) that the extractor can
            use to improve accuracy or route to specialised logic.

        Returns
        -------
        dict with keys:
            success        : bool    — True if extraction produced usable data.
            extracted_data : dict    — Structured output (field->value map).
            raw_output     : Any     — Raw extractor output before structuring.
            confidence     : float   — Overall extraction confidence in [0, 1].
            message        : str     — Human-readable status or error text.
        """

    @property
    @abstractmethod
    def extractor_name(self) -> str:
        """Unique, stable identifier (e.g. 'ocr_extractor')."""
