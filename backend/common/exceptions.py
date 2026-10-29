"""业务异常 AppError：由中间件映射为统一响应信封。"""

from __future__ import annotations

from typing import Optional


class AppError(Exception):
    """可映射到 { code, message, result: null } 的业务异常。"""

    def __init__(
        self,
        code: int,
        message_key: str,
        *,
        message: Optional[str] = None,
        http_status: int = 200,
    ) -> None:
        self.code = code
        self.message_key = message_key
        self.message = message
        self.http_status = http_status
        super().__init__(message or message_key)
