"""
ModelRegistry — singleton registry for all BaseModel instances.

Single Responsibility: store, retrieve, and lazily load ML models by name.
The registry is the single source of truth for model availability across
the entire framework and all plugins.
"""

import logging
import threading
from typing import Dict, List, Optional

from vision_framework.core.interfaces.base_model import BaseModel

logger = logging.getLogger(__name__)


class ModelRegistry:
    """
    Thread-safe singleton registry for BaseModel instances.

    Models are registered by a unique string name.  Actual model weights are
    loaded lazily — only when the model is first retrieved via get().
    This keeps startup time short when many models are registered.

    Usage
    -----
    registry = ModelRegistry()          # always returns the same instance
    registry.register("my_model", MyModel())
    model = registry.get("my_model")   # loads on first call
    """

    _instance: Optional["ModelRegistry"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls) -> "ModelRegistry":
        with cls._lock:
            if cls._instance is None:
                instance = super().__new__(cls)
                instance._models: Dict[str, BaseModel] = {}
                instance._model_paths: Dict[str, Optional[str]] = {}
                cls._instance = instance
        return cls._instance

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        name: str,
        model: BaseModel,
        model_path: Optional[str] = None,
    ) -> None:
        """
        Register *model* under *name*.

        Parameters
        ----------
        name:
            Unique string key (e.g. 'mobilenetv2_document').
        model:
            An unloaded BaseModel instance.
        model_path:
            Optional filesystem path; passed to model.load() on first use.
        """
        if name in self._models:
            logger.warning(
                "ModelRegistry: overwriting existing registration for '%s'.", name
            )
        self._models[name] = model
        self._model_paths[name] = model_path
        logger.info("ModelRegistry: registered model '%s'.", name)

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get(self, name: str) -> BaseModel:
        """
        Return the model registered under *name*, loading it if necessary.

        Parameters
        ----------
        name:
            Registered model name.

        Returns
        -------
        BaseModel — loaded and ready for inference.

        Raises
        ------
        KeyError  — if *name* is not registered.
        RuntimeError — if the model fails to load.
        """
        if name not in self._models:
            raise KeyError(f"ModelRegistry: no model registered as '{name}'.")

        model = self._models[name]

        if not model.is_loaded():
            path = self._model_paths.get(name)
            logger.info(
                "ModelRegistry: lazy-loading model '%s' from path=%s.", name, path
            )
            success = model.load(path)
            if not success:
                raise RuntimeError(
                    f"ModelRegistry: failed to load model '{name}' from '{path}'."
                )

        return model

    # ------------------------------------------------------------------
    # Inspection
    # ------------------------------------------------------------------

    def list_models(self) -> List[dict]:
        """
        Return metadata for every registered model.

        Returns
        -------
        List of dicts with keys: name, loaded, model_path.
        """
        return [
            {
                "name": name,
                "loaded": model.is_loaded(),
                "model_path": self._model_paths.get(name),
                "model_class": type(model).__name__,
            }
            for name, model in self._models.items()
        ]

    def is_registered(self, name: str) -> bool:
        """Return True if a model is registered under *name*."""
        return name in self._models

    def unregister(self, name: str) -> bool:
        """
        Remove a model registration.

        Returns
        -------
        bool — True if removed, False if the name was not registered.
        """
        if name in self._models:
            del self._models[name]
            del self._model_paths[name]
            logger.info("ModelRegistry: unregistered model '%s'.", name)
            return True
        return False
