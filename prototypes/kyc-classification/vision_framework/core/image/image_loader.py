"""
ImageLoader — single entry point for all image input to the framework.

Single Responsibility: load images from any source (file, base64, bytes,
URL, numpy array) and return a consistent numpy BGR uint8 array.
"""

import base64
import io
import logging
from typing import Union

import cv2
import numpy as np
import requests
from PIL import Image

logger = logging.getLogger(__name__)

_SUPPORTED_FORMATS = {"jpg", "jpeg", "png", "bmp", "webp", "tiff", "tif"}


class ImageLoader:
    """
    Loads images from heterogeneous sources into numpy arrays.

    All methods are static — no state is needed.  Every method returns a
    BGR uint8 numpy array (the native OpenCV format) or raises ValueError
    on failure so callers can build structured error responses.
    """

    @staticmethod
    def from_file(path: str) -> np.ndarray:
        """
        Load an image from a filesystem path.

        Parameters
        ----------
        path:
            Absolute or relative path to an image file.

        Returns
        -------
        np.ndarray — BGR uint8 (H x W x 3).

        Raises
        ------
        ValueError if the file cannot be read.
        """
        image = cv2.imread(path)
        if image is None:
            raise ValueError(f"ImageLoader.from_file: cannot read '{path}'.")
        logger.debug("Loaded image from file: %s %s", path, image.shape)
        return image

    @staticmethod
    def from_base64(encoded: str) -> np.ndarray:
        """
        Decode a base64-encoded image string.

        Parameters
        ----------
        encoded:
            Base64 string, optionally with a data-URI prefix
            (e.g. 'data:image/jpeg;base64,...').

        Returns
        -------
        np.ndarray — BGR uint8.

        Raises
        ------
        ValueError if decoding fails.
        """
        try:
            # Strip data-URI header if present
            if "," in encoded:
                encoded = encoded.split(",", 1)[1]
            raw_bytes = base64.b64decode(encoded)
            return ImageLoader.from_bytes(raw_bytes)
        except Exception as exc:
            raise ValueError(f"ImageLoader.from_base64: {exc}") from exc

    @staticmethod
    def from_bytes(data: bytes) -> np.ndarray:
        """
        Decode an image from raw bytes.

        Parameters
        ----------
        data:
            Raw image file bytes (JPEG, PNG, etc.).

        Returns
        -------
        np.ndarray — BGR uint8.

        Raises
        ------
        ValueError if decoding fails.
        """
        try:
            arr = np.frombuffer(data, dtype=np.uint8)
            image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("cv2.imdecode returned None.")
            logger.debug("Loaded image from bytes: %s", image.shape)
            return image
        except Exception as exc:
            raise ValueError(f"ImageLoader.from_bytes: {exc}") from exc

    @staticmethod
    def from_url(url: str, timeout: int = 10) -> np.ndarray:
        """
        Download and decode an image from *url*.

        Parameters
        ----------
        url:
            HTTP/HTTPS URL pointing to an image resource.
        timeout:
            Request timeout in seconds.

        Returns
        -------
        np.ndarray — BGR uint8.

        Raises
        ------
        ValueError if the request fails or the content is not an image.
        """
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return ImageLoader.from_bytes(response.content)
        except Exception as exc:
            raise ValueError(f"ImageLoader.from_url: {exc}") from exc

    @staticmethod
    def from_pil(pil_image: Image.Image) -> np.ndarray:
        """
        Convert a PIL Image to a BGR numpy array.

        Parameters
        ----------
        pil_image:
            A PIL / Pillow Image object.

        Returns
        -------
        np.ndarray — BGR uint8.
        """
        rgb = np.array(pil_image.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    @staticmethod
    def to_base64(image: np.ndarray, fmt: str = ".jpg") -> str:
        """
        Encode a numpy image array to a base64 string.

        Parameters
        ----------
        image:
            BGR uint8 numpy array.
        fmt:
            File format extension (e.g. '.jpg', '.png').

        Returns
        -------
        str — Plain base64 string (no data-URI prefix).

        Raises
        ------
        ValueError if encoding fails.
        """
        success, buffer = cv2.imencode(fmt, image)
        if not success:
            raise ValueError(f"ImageLoader.to_base64: cv2.imencode failed for fmt={fmt}.")
        return base64.b64encode(buffer).decode("utf-8")

    @staticmethod
    def to_pil(image: np.ndarray) -> Image.Image:
        """
        Convert a BGR numpy array to a PIL Image (RGB).

        Parameters
        ----------
        image:
            BGR uint8 numpy array.

        Returns
        -------
        PIL.Image.Image — RGB image.
        """
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)
