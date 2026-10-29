"""Redis client with in-memory fallback for local/dev without Redis."""

from __future__ import annotations

import threading
import time
from typing import Optional

from common.logger import get_logger
from settings.config import get_settings

logger = get_logger("redis")

_client = None
_memory: dict[str, tuple[str, float]] = {}
_mem_lock = threading.Lock()


class MemoryRedis:
    """Minimal subset used by rate limit + session store."""

    def get(self, key: str) -> Optional[str]:
        with _mem_lock:
            item = _memory.get(key)
            if not item:
                return None
            val, exp = item
            if exp and exp < time.time():
                _memory.pop(key, None)
                return None
            return val

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        with _mem_lock:
            exp = (time.time() + ex) if ex else 0.0
            _memory[key] = (str(value), exp)
        return True

    def setex(self, key: str, seconds: int, value: str) -> bool:
        return self.set(key, value, ex=seconds)

    def delete(self, *keys: str) -> int:
        with _mem_lock:
            n = 0
            for k in keys:
                if _memory.pop(k, None) is not None:
                    n += 1
            return n

    def exists(self, key: str) -> int:
        return 1 if self.get(key) is not None else 0

    def incr(self, key: str) -> int:
        with _mem_lock:
            item = _memory.get(key)
            now = time.time()
            if not item or (item[1] and item[1] < now):
                _memory[key] = ("1", 0.0)
                return 1
            n = int(item[0] or "0") + 1
            _memory[key] = (str(n), item[1])
            return n

    def expire(self, key: str, seconds: int) -> bool:
        with _mem_lock:
            item = _memory.get(key)
            if not item:
                return False
            _memory[key] = (item[0], time.time() + seconds)
            return True

    def ttl(self, key: str) -> int:
        with _mem_lock:
            item = _memory.get(key)
            if not item:
                return -2
            _, exp = item
            if not exp:
                return -1
            return max(0, int(exp - time.time()))

    def lpush(self, key: str, *values: str) -> int:
        with _mem_lock:
            raw, exp = _memory.get(key, ("[]", 0.0))
            import json

            try:
                arr = json.loads(raw)
            except Exception:
                arr = []
            for v in values:
                arr.insert(0, v)
            _memory[key] = (json.dumps(arr), exp)
            return len(arr)

    def brpop(self, key: str, timeout: int = 1):
        # Non-blocking poll for in-memory (worker uses short sleep)
        import json

        deadline = time.time() + max(0, timeout)
        while time.time() <= deadline:
            with _mem_lock:
                raw, exp = _memory.get(key, ("[]", 0.0))
                try:
                    arr = json.loads(raw)
                except Exception:
                    arr = []
                if arr:
                    val = arr.pop()
                    _memory[key] = (json.dumps(arr), exp)
                    return key, val
            time.sleep(0.05)
        return None

    def ping(self) -> bool:
        return True


def get_redis():
    """Return redis client or MemoryRedis fallback."""
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    url = (settings.redis_url or "").strip()
    if not url:
        logger.info("REDIS_URL empty — using in-memory store")
        _client = MemoryRedis()
        return _client

    try:
        import redis

        client = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        logger.info("redis connected url=%s", url.split("@")[-1])
        _client = client
        return _client
    except Exception:
        logger.exception("redis unavailable — falling back to memory")
        _client = MemoryRedis()
        return _client
