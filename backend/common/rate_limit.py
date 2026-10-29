"""基于 Redis 或进程内存的请求频率限制。"""

from __future__ import annotations

import time
from typing import Deque
from collections import defaultdict, deque
import threading

from common.constants import CODE_RATE_LIMITED
from common.exceptions import AppError
from common.redis_client import get_redis


class SlidingWindowLimiter:
    """提供内存滑动窗口与 Redis 计数限流。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, Deque[float]] = defaultdict(deque)

    def check_memory(self, key: str, limit: int, window_seconds: float = 60.0) -> None:
        """使用进程内滑动窗口检查调用频率。"""

        if limit <= 0:
            return
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            q = self._hits[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= limit:
                raise AppError(CODE_RATE_LIMITED, "common.rate_limited", http_status=429)
            q.append(now)

    def check_redis(self, key: str, limit: int, window_seconds: int = 60) -> None:
        """使用 Redis 固定窗口计数检查调用频率。"""

        if limit <= 0:
            return
        r = get_redis()
        rk = f"rl:{key}"
        n = int(r.incr(rk))
        if n == 1:
            r.expire(rk, window_seconds)
        if n > limit:
            raise AppError(CODE_RATE_LIMITED, "common.rate_limited", http_status=429)


_limiter = SlidingWindowLimiter()


def rate_limit(key: str, limit: int, window_seconds: float = 60.0) -> None:
    """根据存储可用性选择 Redis 或内存限流。"""

    from common.logger import get_logger
    from common.redis_client import MemoryRedis

    r = get_redis()
    try:
        if isinstance(r, MemoryRedis):
            _limiter.check_memory(key, limit, window_seconds)
        else:
            _limiter.check_redis(key, limit, int(window_seconds))
    except AppError:
        raise
    except Exception:
        get_logger("rate_limit").exception("redis rate limit failed key=%s", key)
        _limiter.check_memory(key, limit, window_seconds)


def client_ip(request) -> str:
    """从代理请求头或连接信息获取客户端 IP。"""

    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def auth_rate_key(request, username: str) -> str:
    """构造登录类接口的限流键。"""

    return f"auth:{client_ip(request)}:{(username or '').strip().lower()}"


def user_rate_key(prefix: str, user_id: int, request) -> str:
    """构造指定用户接口的限流键。"""

    return f"{prefix}:{user_id}:{client_ip(request)}"
