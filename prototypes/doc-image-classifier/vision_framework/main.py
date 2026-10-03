"""
main.py — Vision Framework entry point.

Run the FastAPI server:
    python main.py

Or via uvicorn directly:
    uvicorn vision_framework.api.fastapi_app:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
import os
import sys

# Ensure project root is on the path when running directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vision_framework.core.config.config_loader import ConfigLoader

# Configure logging before importing the app
config = ConfigLoader().load()
logging.basicConfig(
    level=getattr(logging, config.get("LOG_LEVEL", "INFO"), logging.INFO),
    format="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)


def main() -> None:
    """Start the Vision Framework API server."""
    try:
        import uvicorn
    except ImportError:
        logger.error("uvicorn is not installed. Run: pip install uvicorn")
        sys.exit(1)

    host = config.get("API_HOST", "0.0.0.0")
    port = int(config.get("API_PORT", 8000))
    workers = int(config.get("API_WORKERS", 1))

    logger.info(
        "Starting Vision Framework API on %s:%d (workers=%d)", host, port, workers
    )

    uvicorn.run(
        "vision_framework.api.fastapi_app:app",
        host=host,
        port=port,
        workers=workers,
        reload=os.getenv("ENV", "production").lower() == "development",
        log_level=config.get("LOG_LEVEL", "info").lower(),
    )


if __name__ == "__main__":
    main()
