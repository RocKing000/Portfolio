"""
ConfigLoader — load framework configuration from files and environment.

Single Responsibility: merge default FrameworkConfig values with overrides
from a .env file and OS environment variables, returning a resolved dict.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ConfigLoader:
    """
    Resolves framework configuration from multiple sources (priority order):
      1. OS environment variables  (highest priority)
      2. .env file overrides
      3. FrameworkConfig defaults  (lowest priority)

    The resolved config is returned as a plain dict so callers have no
    dependency on this class at runtime.
    """

    def __init__(self, env_file: Optional[str] = None) -> None:
        """
        Parameters
        ----------
        env_file:
            Path to a .env file.  Defaults to '.env' in the working directory.
        """
        self._env_file = Path(env_file) if env_file else Path(".env")

    def load(self) -> Dict[str, Any]:
        """
        Build and return the fully resolved configuration dict.

        Returns
        -------
        dict mapping config key -> resolved value.
        """
        # Start from defaults
        from vision_framework.core.config.framework_config import FrameworkConfig
        config: Dict[str, Any] = {
            k: v
            for k, v in vars(FrameworkConfig).items()
            if not k.startswith("_")
        }

        # Load .env file
        env_overrides = self._load_env_file()
        config.update(env_overrides)

        # Apply OS environment (highest priority)
        for key in list(config.keys()):
            env_val = os.environ.get(key)
            if env_val is not None:
                config[key] = self._cast(config[key], env_val)

        # Auto-detect GPU
        config["GPU_ENABLED"] = self._detect_gpu()

        logger.debug("ConfigLoader: resolved %d config keys.", len(config))
        return config

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _load_env_file(self) -> Dict[str, Any]:
        """Parse a .env file into a dict of string values."""
        result: Dict[str, Any] = {}
        if not self._env_file.exists():
            return result
        with open(self._env_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                result[key.strip()] = value.strip().strip('"').strip("'")
        return result

    @staticmethod
    def _cast(original: Any, raw_string: str) -> Any:
        """Cast *raw_string* to the same type as *original*."""
        if isinstance(original, bool):
            return raw_string.lower() in ("1", "true", "yes", "on")
        if isinstance(original, int):
            try:
                return int(raw_string)
            except ValueError:
                return original
        if isinstance(original, float):
            try:
                return float(raw_string)
            except ValueError:
                return original
        return raw_string

    @staticmethod
    def _detect_gpu() -> bool:
        """Return True if a CUDA-capable GPU is available."""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            pass
        try:
            import cv2
            return cv2.cuda.getCudaEnabledDeviceCount() > 0
        except Exception:
            pass
        return False
