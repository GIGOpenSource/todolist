"""请求上下文中间件与全局异常处理（AppError / 校验错误 → 统一信封）。"""

from __future__ import annotations

import json
import time
import traceback
import uuid
from typing import Any, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from common.constants import (
    CODE_INTERNAL_ERROR,
    CODE_VALIDATION_ERROR,
    REQUEST_ID_HEADER,
)
from common.exceptions import AppError
from common.i18n import resolve_lang, t
from common.logger import get_logger
from common.metrics import metrics
from common.response import resp_fail
from settings.config import get_settings

logger = get_logger("middleware")

_SENSITIVE_KEYS = {"password", "hashed_password", "access_token", "refresh_token", "token", "secret"}
_QUIET_BODY_PREFIXES = ("/api/todos/sync", "/api/notes/sync", "/api/report/")


def _mask_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if str(k).lower() in _SENSITIVE_KEYS:
                out[k] = "***"
            else:
                out[k] = _mask_sensitive(v)
        return out
    if isinstance(value, list):
        return [_mask_sensitive(v) for v in value]
    return value


def _summarize_body(path: str, parsed: Any) -> Any:
    if any(path.startswith(p) for p in _QUIET_BODY_PREFIXES):
        if isinstance(parsed, dict):
            todos = parsed.get("todos")
            notes = parsed.get("notes")
            deleted = parsed.get("deleted_ids")
            summary = {
                "deleted_count": len(deleted) if isinstance(deleted, list) else 0,
                "list_updated_at": parsed.get("list_updated_at"),
                "sync_weeks": parsed.get("sync_weeks"),
            }
            if todos is not None:
                summary["todos_count"] = len(todos) if isinstance(todos, list) else 0
            if notes is not None:
                summary["notes_count"] = len(notes) if isinstance(notes, list) else 0
            return summary
        return "<omitted>"
    return _mask_sensitive(parsed)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """注入请求标识与语言，并记录脱敏后的请求指标。"""

    async def dispatch(self, request: Request, call_next: Callable):
        """处理单次请求并附加追踪信息与耗时统计。"""

        settings = get_settings()
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id
        request.state.lang = resolve_lang(request=request)
        from common.request_context import set_request_context

        set_request_context(request_id=request_id, lang=request.state.lang)
        started = time.perf_counter()
        path = request.url.path

        body_preview: Any = None
        if settings.log_request_bodies and request.method in {"POST", "PUT", "PATCH"}:
            try:
                raw = await request.body()
                if raw:
                    parsed = json.loads(raw.decode("utf-8"))
                    body_preview = _summarize_body(path, parsed)

                async def receive():
                    return {"type": "http.request", "body": raw, "more_body": False}

                request = Request(request.scope, receive)
            except Exception:
                body_preview = "<unparsed>"

        logger.info(
            "request start id=%s method=%s path=%s query=%s lang=%s%s",
            request_id,
            request.method,
            path,
            dict(request.query_params),
            request.state.lang,
            f" body={body_preview}" if body_preview is not None else "",
        )

        try:
            response = await call_next(request)
        except Exception:
            logger.error(
                "request crash id=%s path=%s\n%s",
                request_id,
                path,
                traceback.format_exc(),
            )
            raise

        elapsed_ms = (time.perf_counter() - started) * 1000
        status = getattr(response, "status_code", 0) or 0
        response.headers[REQUEST_ID_HEADER] = request_id
        metrics.record(path, status, elapsed_ms)

        if elapsed_ms >= 500:
            logger.warning(
                "slow request id=%s path=%s elapsed_ms=%.2f status=%s",
                request_id,
                path,
                elapsed_ms,
                status,
            )
        else:
            logger.info(
                "request end id=%s status=%s elapsed_ms=%.2f",
                request_id,
                status,
                elapsed_ms,
            )
        return response


def register_exception_handlers(app: FastAPI) -> None:
    """注册业务异常、参数校验与兜底异常处理器。"""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        """将业务异常转换为统一失败响应。"""

        lang = getattr(request.state, "lang", None) or resolve_lang(request=request)
        message = exc.message or t(exc.message_key, lang=lang)
        logger.warning(
            "business error id=%s code=%s key=%s message=%s",
            getattr(request.state, "request_id", "-"),
            exc.code,
            exc.message_key,
            message,
        )
        return resp_fail(exc.code, message, http_status=exc.http_status)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        """将请求参数校验错误转换为统一失败响应。"""

        lang = getattr(request.state, "lang", None) or resolve_lang(request=request)
        logger.warning(
            "validation error id=%s errors=%s",
            getattr(request.state, "request_id", "-"),
            exc.errors(),
        )
        return resp_fail(
            CODE_VALIDATION_ERROR,
            t("common.validation_error", lang=lang),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        """记录未捕获异常并返回统一内部错误。"""

        lang = getattr(request.state, "lang", None) or resolve_lang(request=request)
        logger.error(
            "unhandled error id=%s\n%s",
            getattr(request.state, "request_id", "-"),
            traceback.format_exc(),
        )
        return resp_fail(
            CODE_INTERNAL_ERROR,
            t("common.internal_error", lang=lang),
        )
