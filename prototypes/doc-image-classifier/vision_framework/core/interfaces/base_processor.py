"""
BaseProcessor — abstract contract for all image-to-image transformations.

Single Responsibility: transform an input image into an output image.
Every processor is stateless; identical inputs always produce identical outputs.
Examples of concrete implementations: BlurProcessor, PerspectiveCorrector, DigitMasker.
"""

from abc import ABC, abstractmethod
from typing import Any

import numpy as np


class BaseProcessor(ABC):
    """
    Abstract base for all image processors.

    A processor receives a numpy image array, performs a single focused
    transformation, and returns the result wrapped in a standard dict.
    Processors MUST NOT mutate the input array; they return new arrays.
    """

    @abstractmethod
    def process(self, image: np.ndarray, **kwargs: Any) -> dict:
        """
        Transform *image* and return a result envelope.

        Parameters
        ----------
        image:
            Input image as a numpy array (H x W x C, uint8 or float32).
        **kwargs:
            Processor-specific optional parameters.

        Returns
        -------
        dict with keys:
            success  : bool          — True if processing succeeded.
            image    : np.ndarray    — Processed output image (new array).
            metadata : dict          — Processor-specific diagnostic data.
            message  : str           — Human-readable status or error text.
        """

    @abstractmethod
    def validate_input(self, image: np.ndarray) -> bool:
        """
        Validate *image* before processing begins.

        Parameters
        ----------
        image:
            Image to validate.

        Returns
        -------
        bool — True if the image is acceptable for this processor.
        """

    @property
    @abstractmethod
    def processor_name(self) -> str:
        """Unique, stable identifier for this processor (e.g. 'blur_detector')."""
