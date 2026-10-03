"""Augmentation pipeline for synthetic document images."""
from .geometric import apply_geometric
from .photometric import apply_photometric
from .environmental import add_background, add_shadow, add_glare
from .camera import apply_camera_effects

__all__ = [
    "apply_geometric", "apply_photometric",
    "add_background", "add_shadow", "add_glare",
    "apply_camera_effects",
]
