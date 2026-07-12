"""
Two-tier cache: in-memory LRU → Redis (optional).
Reads hit memory first, then Redis; writes go to both tiers.
"""
import logging
from collections import OrderedDict
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(
        self,
        use_redis: bool = False,
        redis_host: str = "localhost",
        redis_port: int = 6379,
    ):
        self._lru: OrderedDict[str, str] = OrderedDict()
        self._max_size = settings.memory_cache_size
        self._redis = None

        if use_redis:
            try:
                import redis as redis_lib

                client = redis_lib.Redis(
                    host=redis_host,
                    port=redis_port,
                    decode_responses=True,
                    socket_timeout=1,
                )
                client.ping()
                self._redis = client
                logger.info("Redis cache connected at %s:%s", redis_host, redis_port)
            except Exception as e:
                logger.warning("Redis unavailable — memory-only cache active: %s", e)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[str]:
        # L1: memory
        value = self._lru_get(key)
        if value is not None:
            return value

        # L2: Redis
        if self._redis:
            try:
                value = self._redis.get(key)
                if value:
                    self._lru_set(key, value)
                    return value
            except Exception as e:
                logger.error("Redis GET error: %s", e)

        return None

    def set(self, key: str, value: str, ttl: int = None):
        self._lru_set(key, value)

        if self._redis:
            try:
                effective_ttl = ttl or settings.redis_ttl
                self._redis.setex(key, effective_ttl, value)
            except Exception as e:
                logger.error("Redis SET error: %s", e)

    def clear(self):
        self._lru.clear()
        if self._redis:
            try:
                self._redis.flushdb()
            except Exception as e:
                logger.error("Redis FLUSHDB error: %s", e)

    # ------------------------------------------------------------------
    # LRU helpers
    # ------------------------------------------------------------------

    def _lru_get(self, key: str) -> Optional[str]:
        if key not in self._lru:
            return None
        self._lru.move_to_end(key)
        return self._lru[key]

    def _lru_set(self, key: str, value: str):
        if key in self._lru:
            self._lru.move_to_end(key)
        self._lru[key] = value
        if len(self._lru) > self._max_size:
            self._lru.popitem(last=False)
