from __future__ import annotations

import json
import redis.asyncio as aioredis


class MappingRegistry:
    """
    Session-scoped token↔real-value registry backed by Redis.
    All mappings are cleared when the session ends.

    Properties:
    - Consistent within session: same entity always maps to the same token.
    - Cleared at session end: no cross-session correlation possible.
    - Irreversible externally: tokens are opaque ULIDs.
    """

    _PREFIX = "anon"
    _SESSION_TTL = 86400  # 24 hours max safety TTL; session end clears explicitly

    def __init__(self, redis_client: aioredis.Redis, session_id: str):
        self._redis = redis_client
        self._session_id = session_id

    def _forward_key(self, token: str) -> str:
        return f"{self._PREFIX}:{self._session_id}:t2r:{token}"

    def _reverse_key(self, real_value: str) -> str:
        return f"{self._PREFIX}:{self._session_id}:r2t:{real_value}"

    def _index_key(self) -> str:
        return f"{self._PREFIX}:{self._session_id}:index"

    async def store(self, token: str, real_value: str) -> None:
        pipe = self._redis.pipeline()
        pipe.setex(self._forward_key(token), self._SESSION_TTL, real_value)
        pipe.setex(self._reverse_key(real_value), self._SESSION_TTL, token)
        pipe.sadd(self._index_key(), token)
        pipe.expire(self._index_key(), self._SESSION_TTL)
        await pipe.execute()

    async def get_real_value(self, token: str) -> str | None:
        value = await self._redis.get(self._forward_key(token))
        return value.decode() if value else None

    async def get_token(self, real_value: str) -> str | None:
        value = await self._redis.get(self._reverse_key(real_value))
        return value.decode() if value else None

    async def clear_session(self) -> None:
        tokens_raw = await self._redis.smembers(self._index_key())
        pipe = self._redis.pipeline()
        for token_bytes in tokens_raw:
            token = token_bytes.decode()
            real_raw = await self._redis.get(self._forward_key(token))
            pipe.delete(self._forward_key(token))
            if real_raw:
                pipe.delete(self._reverse_key(real_raw.decode()))
        pipe.delete(self._index_key())
        await pipe.execute()

    async def get_all_tokens(self) -> list[str]:
        members = await self._redis.smembers(self._index_key())
        return [m.decode() for m in members]
