"""
BaseClassifier — abstract contract for all image classifiers.

Single Responsibility: assign a class label to an image (or image region).
Examples: DocumentClassifier, LanguageClassifier, QualityClassifier.
"""

from abc import ABC, abstractmethod
from typing import List

import numpy as np


class BaseClassifier(ABC):
    """
    Abstract base for all classifiers.

    A classifier answers "What is this?" returning a label, confidence, and
    per-class scores.  It never modifies the image or extracts structured data.
    """

    @abstractmethod
    def classify(self, image: np.ndarray) -> dict:
        """
        Classify *image* into one of the supported classes.

        Parameters
        ----------
        image:
            Input image as a numpy array (H x W x C).

        Returns
        -------
        dict with keys:
            class_label : str    — Predicted class (e.g. 'aadhaar').
            confidence  : float  — Confidence for the predicted class in [0, 1].
            all_scores  : dict   — Mapping of class_name -> score for every class.
            method      : str    — 'model' when a trained model was used,
                                   'rule_based' when falling back to heuristics.
        """

    @abstractmethod
    def get_supported_classes(self) -> List[str]:
        """
        Return the list of class labels this classifier can produce.

        Returns
        -------
        list of str.
        """

    @property
    @abstractmethod
    def classifier_name(self) -> str:
        """Unique, stable identifier (e.g. 'document_classifier')."""
