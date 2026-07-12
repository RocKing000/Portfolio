from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Dict, Optional


class Settings(BaseSettings):
    model_config = {"protected_namespaces": (), "env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": False, "extra": "allow"}

    # ── Service ────────────────────────────────────────────────────────────────
    service_name: str = "FedMithra AI Service"
    service_version: str = "3.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_title: str = "FedMithra AI Service"
    api_version: str = "3.0.0"
    api_debug: bool = False

    # ── Database ───────────────────────────────────────────────────────────────
    db_server: str = "localhost"
    db_user: str = "YOUR_DB_USER"
    db_password: str = "YOUR_DB_PASSWORD"
    db_name: str = "YOUR_DB_NAME"
    db_port: int = 1433
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_query_timeout: int = 30

    # ── Redis ──────────────────────────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_enabled: bool = True
    redis_password: Optional[str] = None
    redis_db: int = 0
    enable_redis: bool = False
    redis_ttl: int = 86400

    # ── Search ─────────────────────────────────────────────────────────────────
    ai_model_name: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384
    max_sequence_length: int = 256
    active_model_version: str = "v1.0-minilm"
    model_registry: Dict[str, str] = {
        "v1.0-minilm": "all-MiniLM-L6-v2",
        "v1.1-mpnet": "all-mpnet-base-v2",
        "v2.0-bge": "BAAI/bge-small-en-v1.5"
    }
    fallback_model_name: Optional[str] = None
    similarity_threshold: float = 0.3
    min_similarity_score: float = 0.1
    max_results: int = 10
    bm25_weight: float = 0.3
    semantic_weight: float = 0.7
    bm25_k1: float = 1.5
    bm25_b: float = 0.75
    rrf_k: int = 60
    embedding_cache_enabled: bool = True
    embedding_refresh_hours: int = 168
    embedding_batch_size: int = 50

    # ── Cache TTLs ─────────────────────────────────────────────────────────────
    cache_ttl_seconds: int = 600
    errors_cache_ttl_seconds: int = 3600
    embeddings_cache_ttl_seconds: int = 7200
    synonyms_cache_ttl_seconds: int = 1800
    analytics_cache_ttl_seconds: int = 300

    # ── CORS ───────────────────────────────────────────────────────────────────
    cors_origins: list = ["*"]

    # ── Feature flags ──────────────────────────────────────────────────────────
    feature_semantic_search: bool = True
    feature_bm25_search: bool = True
    feature_hybrid_search: bool = True
    feature_query_expansion: bool = True
    feature_auto_keywords: bool = True
    feature_search_analytics: bool = True
    feature_training_data_collection: bool = True
    reranking_enabled: bool = False
    reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_top_k: int = 20
    search_logging_enabled: bool = True
    log_only_clicked: bool = False
    search_log_sampling_rate: float = 1.0
    spacy_model: str = "en_core_web_sm"
    spacy_enabled: bool = True
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 100
    enable_debug_logging: bool = False
    log_processing_times: bool = True
    slow_query_threshold_ms: float = 1000.0
    batch_size_embedding_generation: int = 50
    batch_size_keyword_extraction: int = 20
    batch_size_training_data: int = 100

    # ── Dynamic Search Config ──────────────────────────────────────────────────
    typo_correction_threshold: float = 0.75
    min_confidence_threshold: float = 0.01
    similarity_threshold: float = 0.3
    bm25_weight_exact_code: float = 0.6
    semantic_weight_exact_code: float = 0.4
    bm25_weight_natural: float = 0.2
    semantic_weight_natural: float = 0.8
    bm25_weight_mixed: float = 0.4
    semantic_weight_mixed: float = 0.6
    did_you_mean_limit: int = 3
    try_keywords_limit: int = 5


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Singleton for translation service compatibility
settings = get_settings()


def get_active_embedding_model() -> str:
    s = get_settings()
    return s.model_registry.get(s.active_model_version, s.ai_model_name)
