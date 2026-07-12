"""
services/cache.py

Async Redis cache service for DIRE-X.

Two cache namespaces:
    direx:score:{input_hash}     -- full analysis response keyed by input hash
                                    Avoids re-scoring identical inputs.
                                    TTL: SCORE_TTL (24 h)

    direx:scenario:{scenario_id} -- stored scenario record keyed by scenario_id
                                    Speeds up repeated GET /scenario/{id} lookups.
                                    TTL: RECORD_TTL (1 h)

Design decisions:
    - Redis is optional: if unavailable, all cache operations are no-ops and
      the system falls back to direct DB queries. No exception propagates.
    - Input hashing uses SHA-256 over a canonically sorted JSON dump, so the
      same scenario submitted in any field order hits the same cache key.
    - The cache stores the full serialised response dict (not just scores),
      so a cache hit is a complete short-circuit of validation + scoring + DB.

Public API:
    cache.connect(url)           -- call on startup
    cache.disconnect()           -- call on shutdown
    cache.ping()                 -- True if Redis is reachable
    cache.get_score(d)           -- get cached analysis response for input dict
    cache.set_score(d, resp)     -- cache analysis response
    cache.get_record(sid)        -- get cached stored-scenario record
    cache.set_record(sid, rec)   -- cache stored-scenario record
    cache.invalidate(sid)        -- evict both namespaces for a scenario_id
"""

import json
import hashlib
import logging
from typing import Optional

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

logger = logging.getLogger("dire-x.cache")

# ---------------------------------------------------------------------------
# TTLs
# ---------------------------------------------------------------------------

SCORE_TTL  = 86_400   # 24 h — scored results are deterministic; long TTL is safe
RECORD_TTL = 3_600    # 1 h  — stored records can be updated; shorter TTL


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class CacheService:
    """
    Thin async wrapper around Redis.
    All methods are safe to call even when Redis is not connected —
    they silently return None/False rather than raising.
    """

    def __init__(self) -> None:
        self._client: Optional[object] = None   # aioredis.Redis when connected

    # -----------------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------------

    async def connect(self, url: str) -> None:
        if not _REDIS_AVAILABLE:
            logger.warning("redis package not installed — cache disabled.")
            return
        try:
            self._client = aioredis.from_url(url, decode_responses=True)
            await self._client.ping()
            logger.info(f"Redis connected: {url}")
        except Exception as exc:
            logger.warning(f"Redis unavailable ({exc}) — cache disabled.")
            self._client = None

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def ping(self) -> bool:
        if not self._client:
            return False
        try:
            return bool(await self._client.ping())
        except Exception:
            return False

    @property
    def connected(self) -> bool:
        return self._client is not None

    # -----------------------------------------------------------------------
    # Score cache  (keyed by input hash)
    # -----------------------------------------------------------------------

    async def get_score(self, scenario_dict: dict) -> Optional[dict]:
        """Return cached analysis response for this exact input, or None."""
        return await self._get(self._score_key(scenario_dict))

    async def set_score(self, scenario_dict: dict, response: dict) -> None:
        """Cache the full analysis response for this input."""
        await self._set(self._score_key(scenario_dict), response, SCORE_TTL)

    # -----------------------------------------------------------------------
    # Record cache  (keyed by scenario_id)
    # -----------------------------------------------------------------------

    async def get_record(self, scenario_id: str) -> Optional[dict]:
        """Return cached stored-scenario record, or None."""
        return await self._get(self._record_key(scenario_id))

    async def set_record(self, scenario_id: str, record: dict) -> None:
        """Cache a stored-scenario record."""
        await self._set(self._record_key(scenario_id), record, RECORD_TTL)

    async def invalidate(self, scenario_id: str) -> None:
        """Evict both the record cache for this scenario_id."""
        await self._delete(self._record_key(scenario_id))

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    async def _get(self, key: str) -> Optional[dict]:
        if not self._client:
            return None
        try:
            raw = await self._client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.debug(f"Cache GET failed [{key}]: {exc}")
            return None

    async def _set(self, key: str, value: dict, ttl: int) -> None:
        if not self._client:
            return
        try:
            await self._client.set(key, json.dumps(value), ex=ttl)
        except Exception as exc:
            logger.debug(f"Cache SET failed [{key}]: {exc}")

    async def _delete(self, key: str) -> None:
        if not self._client:
            return
        try:
            await self._client.delete(key)
        except Exception as exc:
            logger.debug(f"Cache DEL failed [{key}]: {exc}")

    # -----------------------------------------------------------------------
    # Key builders
    # -----------------------------------------------------------------------

    @staticmethod
    def _score_key(scenario_dict: dict) -> str:
        """SHA-256 over canonical JSON of the input dict (field-order independent)."""
        canonical = json.dumps(scenario_dict, sort_keys=True, default=str)
        digest    = hashlib.sha256(canonical.encode()).hexdigest()[:20]
        return f"direx:score:{digest}"

    @staticmethod
    def _record_key(scenario_id: str) -> str:
        return f"direx:scenario:{scenario_id}"


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

cache = CacheService()
