import redis
import json
import logging
from typing import Optional, Any
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class Cache:
    def __init__(self):
        self.client = None
        self.enabled = settings.redis_enabled

        if self.enabled:
            try:
                self.client = redis.Redis(
                    host=settings.redis_host,
                    port=settings.redis_port,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                self.client.ping()
                logger.info("Redis cache connected")
            except Exception as e:
                logger.warning(f"Redis not available: {e}. Running without cache.")
                self.enabled = False

    def get(self, key: str) -> Optional[Any]:
        if not self.enabled:
            return None
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
        return None

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        if not self.enabled:
            return False
        try:
            ttl = ttl or settings.cache_ttl_seconds
            serialized = json.dumps(value, default=str)
            self.client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error: {e}")
            return False

    def flush(self) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.flushdb()
            logger.info("Cache flushed")
            return True
        except Exception as e:
            logger.warning(f"Cache flush error: {e}")
            return False

    def is_available(self) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.ping()
            return True
        except:
            return False

cache = Cache()
