"""
fastapi_app.py — FastAPI application factory and startup lifecycle.

Single Responsibility: create the FastAPI app, load plugins on startup,
and mount routes dynamically so the framework serves any plugin's endpoints
without modification.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from vision_framework.core.config.config_loader import ConfigLoader
from vision_framework.core.engine.plugin_manager import PluginManager
from vision_framework.plugins.kyc.kyc_plugin import KYCPlugin
from vision_framework.api.routes.framework_routes import router as framework_router

logger = logging.getLogger(__name__)

# Module-level singletons shared across request handlers
plugin_manager = PluginManager()
config: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    FastAPI lifespan context manager.
    Runs startup logic before yielding, teardown logic after.
    """
    global config
    logger.info("Vision Framework API starting up...")

    # Load configuration
    loader = ConfigLoader()
    config = loader.load()

    # Load KYC plugin automatically
    kyc = KYCPlugin()
    plugin_manager.load_plugin_class(kyc)
    plugin_manager.initialize_plugin("kyc", config)

    # Dynamically mount plugin routes
    for plugin_meta in plugin_manager.list_plugins():
        name = plugin_meta["name"]
        plugin_obj = plugin_manager.get_plugin(name)
        if plugin_obj and callable(getattr(plugin_obj, "get_routes", None)):
            for router in plugin_obj.get_routes():
                app.include_router(router)
                logger.info("Mounted routes for plugin '%s'.", name)

    logger.info("Vision Framework API ready.")
    yield

    logger.info("Vision Framework API shutting down.")


def create_app() -> FastAPI:
    """
    Factory function — create and configure the FastAPI application.

    Returns
    -------
    FastAPI instance ready to serve.
    """
    app = FastAPI(
        title="Vision Framework API",
        description="Modular Computer Vision & ML Framework",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Framework management endpoints (always present)
    app.include_router(framework_router)

    # Serve test camera page
    import os as _os
    _test_page = _os.path.join(
        _os.path.dirname(_os.path.dirname(_os.path.dirname(__file__))),
        "test_camera.html"
    )

    @app.get("/test", include_in_schema=False)
    async def test_camera_page():
        return FileResponse(_test_page)

    # WebSocket endpoint
    from vision_framework.api.stream_handler import router as ws_router
    app.include_router(ws_router)

    return app


# Module-level app instance for uvicorn
app = create_app()
