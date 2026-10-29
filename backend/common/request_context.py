"""请求级 ContextVar：request_id / lang，供日志与 i18n 兜底读取。"""

from __future__ import annotations

from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
lang_ctx: ContextVar[str] = ContextVar("lang", default="en")


def set_request_context(*, request_id: str, lang: str) -> None:
    request_id_ctx.set(request_id or "-")
    lang_ctx.set(lang or "en")


def get_request_id() -> str:
    return request_id_ctx.get()


def get_context_lang() -> str:
    return lang_ctx.get()
