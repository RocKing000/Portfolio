"""
file_handler.py — utilities for accepting image uploads in FastAPI endpoints.

Single Responsibility: receive multipart file uploads or base64 JSON bodies
and return a numpy BGR image array ready for pipeline processing.
"""

import logging
from typing import Optional

import numpy as np
from fastapi import HTTPException, UploadFile

from vision_framework.core.image.image_loader import ImageLoader

logger = logging.getLogger(__name__)

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB


async def image_from_upload(file: UploadFile) -> np.ndarray:
    """
    Read an uploaded image file and decode it to a numpy array.

    Parameters
    ----------
    file:
        FastAPI UploadFile from a multipart/form-data request.

    Returns
    -------
    np.ndarray — BGR uint8 image.

    Raises
    ------
    HTTPException 400 if the file cannot be decoded.
    """
    content_type = (file.content_type or "").lower()
    allowed_types = {
        "image/jpeg", "image/jpg", "image/png",
        "image/bmp", "image/webp", "image/tiff",
    }
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{content_type}'. "
                   f"Expected: {', '.join(sorted(allowed_types))}.",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data) // 1024} KB). Maximum is 20 MB.",
        )

    try:
        return ImageLoader.from_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {exc}") from exc


def image_from_base64(encoded: str) -> np.ndarray:
    """
    Decode a base64 image string.

    Parameters
    ----------
    encoded:
        Base64 string (with or without data-URI prefix).

    Returns
    -------
    np.ndarray — BGR uint8 image.

    Raises
    ------
    HTTPException 400 on decode failure.
    """
    try:
        return ImageLoader.from_base64(encoded)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"Cannot decode base64 image: {exc}"
        ) from exc
