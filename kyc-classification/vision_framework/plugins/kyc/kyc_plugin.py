"""
KYCPlugin — reference implementation of a Vision Framework plugin.

Single Responsibility: serve as the single entry point for all KYC
functionality.  Registers models, exposes pipelines, and provides
FastAPI routers.  The framework core has ZERO knowledge of this class.

To add a new use case, copy this file's structure — that's all you need.
"""

import logging
from typing import Dict, List

from vision_framework.core.engine.model_registry import ModelRegistry
from vision_framework.core.engine.plugin_manager import PluginManager
from vision_framework.plugins.kyc.config.kyc_config import KYCConfig
from vision_framework.plugins.kyc.models.document_model import DocumentModel
from vision_framework.plugins.kyc.models.face_model import FaceModel
from vision_framework.plugins.kyc.pipelines.document_pipeline import DocumentPipeline
from vision_framework.plugins.kyc.pipelines.face_pipeline import FacePipeline

logger = logging.getLogger(__name__)


class KYCPlugin:
    """
    KYC use-case plugin.

    Exposes:
      - plugin_name  : 'kyc'
      - version      : semantic version string
      - initialize() : register models and perform setup
      - get_pipelines(): dict of pipeline_name -> BasePipeline
      - get_routes()  : list of FastAPI APIRouter objects
    """

    plugin_name: str = "kyc"
    version: str = "1.0.0"
    supported_documents: List[str] = list(KYCConfig.SUPPORTED_CLASSES)

    def __init__(self) -> None:
        self._registry = ModelRegistry()
        self._initialized: bool = False
        self._document_pipeline: DocumentPipeline = DocumentPipeline()
        self._face_pipeline: FacePipeline = FacePipeline()

    def initialize(self, config: dict) -> bool:
        """
        Register models and configure plugin from *config*.

        Parameters
        ----------
        config:
            Dict of configuration overrides (typically from ConfigLoader).

        Returns
        -------
        bool — True if initialization succeeded.
        """
        try:
            # Register document classifier model
            doc_model_path = config.get(
                "DOCUMENT_MODEL_PATH",
                f"models/{KYCConfig.CLASSIFIER_MODEL_NAME}.pth"
            )
            self._registry.register(
                KYCConfig.CLASSIFIER_MODEL_NAME,
                DocumentModel(),
                model_path=doc_model_path,
            )

            # Register face recognition model
            self._registry.register(
                f"insightface_{KYCConfig.FACE_MODEL_NAME}",
                FaceModel(),
            )

            self._initialized = True
            logger.info(
                "KYCPlugin v%s initialized. Supported: %s",
                self.version,
                ", ".join(self.supported_documents),
            )
            return True
        except Exception as exc:
            logger.exception("KYCPlugin.initialize failed: %s", exc)
            return False

    def get_pipelines(self) -> Dict:
        """
        Return the KYC pipeline map.

        Returns
        -------
        dict: pipeline_name -> BasePipeline instance.
        """
        return {
            "document_scan": self._document_pipeline,
            "face_capture": self._face_pipeline,
        }

    def get_routes(self) -> List:
        """
        Return FastAPI APIRouter objects for KYC endpoints.

        Routers are imported lazily to avoid importing FastAPI at module load
        time (not every deployment uses the API layer).
        """
        try:
            from vision_framework.api.routes.plugin_routes import build_kyc_router
            return [build_kyc_router(self)]
        except ImportError as exc:
            logger.warning("KYCPlugin.get_routes: FastAPI not available (%s).", exc)
            return []
