"""
framework_routes.py — framework management endpoints.

Single Responsibility: expose read-only framework introspection endpoints
so operators can inspect which plugins and models are active.
"""

import logging
import platform

from fastapi import APIRouter

from vision_framework.core.engine.model_registry import ModelRegistry
from vision_framework.core.engine.plugin_manager import PluginManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/framework", tags=["Framework"])


def _get_plugin_manager() -> PluginManager:
    """Return the shared PluginManager from the app module."""
    from vision_framework.api.fastapi_app import plugin_manager
    return plugin_manager


@router.get("/health")
async def health() -> dict:
    """
    Return framework health status including GPU availability.
    """
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        gpu_count = torch.cuda.device_count() if gpu_available else 0
        gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    except ImportError:
        gpu_available = False
        gpu_count = 0
        gpu_name = None

    registry = ModelRegistry()
    models = registry.list_models()
    loaded_count = sum(1 for m in models if m["loaded"])

    return {
        "status": "healthy",
        "framework_version": "1.0.0",
        "python_version": platform.python_version(),
        "platform": platform.system(),
        "gpu_available": gpu_available,
        "gpu_count": gpu_count,
        "gpu_name": gpu_name,
        "models_registered": len(models),
        "models_loaded": loaded_count,
        "plugins_loaded": len(_get_plugin_manager().list_plugins()),
    }


@router.get("/plugins")
async def list_plugins() -> dict:
    """List all loaded plugins with metadata."""
    return {
        "plugins": _get_plugin_manager().list_plugins()
    }


@router.get("/models")
async def list_models() -> dict:
    """List all registered models and their load state."""
    return {
        "models": ModelRegistry().list_models()
    }


@router.post("/load-plugin")
async def load_plugin(payload: dict) -> dict:
    """
    Dynamically load a plugin by module path.

    Body: {"plugin_path": "vision_framework.plugins.my_plugin"}
    """
    plugin_path: str = payload.get("plugin_path", "")
    if not plugin_path:
        return {"success": False, "message": "plugin_path is required."}

    pm = _get_plugin_manager()
    success = pm.load_plugin(plugin_path)
    if success:
        # Attempt initialization with empty config
        loaded_plugins = pm.list_plugins()
        new_plugin = loaded_plugins[-1] if loaded_plugins else None
        message = f"Plugin loaded: {new_plugin['name']}" if new_plugin else "Loaded."
    else:
        message = f"Failed to load plugin from '{plugin_path}'."

    return {"success": success, "message": message}
