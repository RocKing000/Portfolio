"""
FrameworkConfig — global, immutable framework defaults.

Single Responsibility: provide a single place for all framework-level
constants so that every other module reads from here instead of hardcoding.
Plugin-specific thresholds live in their own config modules.
"""

import os


class FrameworkConfig:
    """
    Global framework configuration constants.

    All values can be overridden via environment variables (see ConfigLoader).
    Never hardcode these values in any other module.
    """

    FRAMEWORK_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    # Directory paths
    TEMP_DIR: str = "temp/"
    MODELS_DIR: str = "models/"
    LOGS_DIR: str = "logs/"
    DATASETS_DIR: str = "datasets/"

    # Image constraints
    MAX_IMAGE_SIZE: int = 4096          # pixels on the longest side
    MIN_IMAGE_SIZE: int = 32            # pixels on the shortest side
    SUPPORTED_FORMATS: tuple = ("jpg", "jpeg", "png", "bmp", "webp", "tiff")

    # Hardware
    GPU_ENABLED: bool = False           # auto-detected by ConfigLoader

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_WORKERS: int = 1
    API_MAX_UPLOAD_MB: int = 20

    # WebSocket streaming
    WS_FRAME_QUEUE_SIZE: int = 10
    WS_HEARTBEAT_INTERVAL_SEC: int = 30

    # Model registry
    MODEL_LOAD_TIMEOUT_SEC: int = 30

    # Pipeline
    PIPELINE_STEP_TIMEOUT_SEC: int = 60

    # ── Ollama (local LLM — replaces OpenAI) ─────────────────────────────────
    # No API key required.  Start the Ollama desktop app before using any
    # LLM-powered feature.  All values are overridable via environment vars.
    OLLAMA_BASE_URL: str = os.getenv(
        "OLLAMA_BASE_URL", "http://localhost:11434"
    )
    OLLAMA_DEFAULT_MODEL: str = os.getenv(
        "OLLAMA_DEFAULT_MODEL", "qwen3:8b"
    )
    OLLAMA_VISION_MODEL: str = os.getenv(
        "OLLAMA_VISION_MODEL", "qwen3:8b"
    )
    OLLAMA_REASONING_MODEL: str = os.getenv(
        "OLLAMA_REASONING_MODEL", "phi4"
    )
    OLLAMA_CODE_MODEL: str = os.getenv(
        "OLLAMA_CODE_MODEL", "phi4"
    )
