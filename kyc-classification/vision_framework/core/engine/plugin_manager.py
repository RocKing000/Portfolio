"""
PluginManager — discovers, loads, and manages use-case plugins.

Single Responsibility: provide a uniform lifecycle (discover → load →
initialize → expose) for any plugin without knowing what each plugin does.

A valid plugin module must expose:
  plugin_name   : str
  get_pipelines() -> dict[str, BasePipeline]
  get_routes()    -> list[APIRouter]
  initialize(config: dict) -> bool
"""

import importlib
import importlib.util
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PluginManager:
    """
    Manages the full lifecycle of framework plugins.

    Plugins are discovered by path or module name, loaded into the process,
    initialized with a config dict, and made available to the API layer via
    get_plugin() and list_plugins().
    """

    def __init__(self) -> None:
        self._plugins: Dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load_plugin(self, plugin_path: str) -> bool:
        """
        Load a plugin from a filesystem path or dotted module name.

        Parameters
        ----------
        plugin_path:
            Either a dotted module path (e.g. 'vision_framework.plugins.kyc')
            or an absolute/relative filesystem path to the plugin package.

        Returns
        -------
        bool — True if the plugin loaded and initialized successfully.
        """
        try:
            module = self._import_module(plugin_path)
        except Exception as exc:
            logger.error("PluginManager: failed to import '%s': %s", plugin_path, exc)
            return False

        # Validate required attributes
        for attr in ("plugin_name", "get_pipelines", "get_routes", "initialize"):
            if not hasattr(module, attr):
                # Try treating the module as a package with a plugin class
                plugin_obj = self._find_plugin_class(module)
                if plugin_obj is None:
                    logger.error(
                        "PluginManager: '%s' is missing required attribute '%s'.",
                        plugin_path,
                        attr,
                    )
                    return False
                self._plugins[plugin_obj.plugin_name] = plugin_obj
                logger.info(
                    "PluginManager: loaded plugin '%s'.", plugin_obj.plugin_name
                )
                return True

        self._plugins[module.plugin_name] = module
        logger.info("PluginManager: loaded plugin '%s'.", module.plugin_name)
        return True

    def load_plugin_class(self, plugin_instance: Any) -> bool:
        """
        Register a pre-instantiated plugin object directly.

        Parameters
        ----------
        plugin_instance:
            Any object with plugin_name, get_pipelines, get_routes, initialize.

        Returns
        -------
        bool — True if successfully registered.
        """
        name = getattr(plugin_instance, "plugin_name", None)
        if name is None:
            logger.error("PluginManager: plugin object has no plugin_name attribute.")
            return False
        self._plugins[name] = plugin_instance
        logger.info("PluginManager: registered plugin '%s'.", name)
        return True

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize_plugin(self, name: str, config: dict) -> bool:
        """
        Call initialize(config) on a loaded plugin.

        Parameters
        ----------
        name:
            Registered plugin name.
        config:
            Configuration dict forwarded to the plugin.

        Returns
        -------
        bool — True if initialization succeeded.
        """
        plugin = self.get_plugin(name)
        if plugin is None:
            logger.error("PluginManager: cannot initialize unknown plugin '%s'.", name)
            return False

        try:
            result = plugin.initialize(config)
            logger.info(
                "PluginManager: plugin '%s' initialized: %s.", name, result
            )
            return bool(result)
        except Exception as exc:
            logger.exception(
                "PluginManager: plugin '%s' raised during initialize: %s", name, exc
            )
            return False

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get_plugin(self, name: str) -> Optional[Any]:
        """Return the plugin registered under *name*, or None."""
        return self._plugins.get(name)

    def list_plugins(self) -> List[dict]:
        """
        Return metadata for every loaded plugin.

        Returns
        -------
        List of dicts: name, version, supported_documents (if available).
        """
        result = []
        for name, plugin in self._plugins.items():
            result.append(
                {
                    "name": name,
                    "version": getattr(plugin, "version", "unknown"),
                    "supported_documents": getattr(
                        plugin, "supported_documents", []
                    ),
                    "pipelines": list(plugin.get_pipelines().keys())
                    if callable(getattr(plugin, "get_pipelines", None))
                    else [],
                }
            )
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _import_module(plugin_path: str) -> Any:
        """Import by dotted name or filesystem path."""
        path = Path(plugin_path)
        if path.exists():
            spec = importlib.util.spec_from_file_location(
                path.stem, str(path / "__init__.py") if path.is_dir() else str(path)
            )
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[spec.name] = module
                spec.loader.exec_module(module)
                return module

        # Treat as dotted module name
        return importlib.import_module(plugin_path)

    @staticmethod
    def _find_plugin_class(module: Any) -> Optional[Any]:
        """Look for a plugin class inside a module and return an instance."""
        import inspect
        for _name, obj in inspect.getmembers(module, inspect.isclass):
            if hasattr(obj, "plugin_name") and hasattr(obj, "get_pipelines"):
                return obj()
        return None
