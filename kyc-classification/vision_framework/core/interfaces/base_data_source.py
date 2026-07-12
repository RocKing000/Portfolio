"""
BaseDataSource — abstract contract for all image data sources.

Single Responsibility: supply raw image frames to the framework,
hiding whether data originates from a file, camera, URL, or memory buffer.
"""

from abc import ABC, abstractmethod

import numpy as np


class BaseDataSource(ABC):
    """
    Abstract base for all image data sources.

    A data source is a stateful object that produces numpy image frames on
    demand.  It abstracts over files, camera streams, network URLs, and
    in-memory buffers so that the rest of the framework never needs to know
    where images come from.
    """

    @abstractmethod
    def get_frame(self) -> np.ndarray:
        """
        Return the next available image frame as a numpy array (H x W x C).

        Returns
        -------
        np.ndarray — BGR uint8 image array, or raises StopIteration when
        no more frames are available.
        """

    @abstractmethod
    def is_available(self) -> bool:
        """
        Return True if the source has frames available for reading.

        Returns
        -------
        bool.
        """

    @abstractmethod
    def release(self) -> None:
        """
        Release any held resources (file handles, camera devices, sockets).

        Must be idempotent — safe to call multiple times.
        """
