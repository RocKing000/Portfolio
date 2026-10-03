"""
BaseDetector — abstract contract for all presence-and-location detectors.

Single Responsibility: detect whether something is present in an image
and return its location(s).
Examples: DocumentDetector, FaceDetector, EdgeDetector.
"""

from abc import ABC, abstractmethod

import numpy as np


class BaseDetector(ABC):
    """
    Abstract base for all detectors.

    A detector answers two questions: "Is X present?" and "Where is X?"
    It returns bounding boxes, corners, or landmarks — never a modified image.
    """

    @abstractmethod
    def detect(self, image: np.ndarray) -> dict:
        """
        Detect objects in *image*.

        Parameters
        ----------
        image:
            Input image as a numpy array (H x W x C).

        Returns
        -------
        dict with keys:
            detected    : bool         — True if at least one object found.
            locations   : list         — Bounding boxes or corner coordinates.
            confidence  : float        — Detection confidence in [0, 1].
            metadata    : dict         — Detector-specific diagnostic data.
            message     : str          — Human-readable status.
        """

    @abstractmethod
    def get_confidence_threshold(self) -> float:
        """
        Return the minimum confidence required for a positive detection.

        Returns
        -------
        float in [0, 1].
        """

    @property
    @abstractmethod
    def detector_name(self) -> str:
        """Unique, stable identifier for this detector (e.g. 'document_detector')."""
