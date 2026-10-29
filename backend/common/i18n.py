"""国际化：从 locale/*.json 加载文案，按 Accept-Language / 用户偏好解析语言。"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import Request

from common.constants import ACCEPT_LANGUAGE_HEADER
from common.logger import get_logger
from settings.config import get_settings

logger = get_logger("i18n")
LOCALE_DIR = Path(__file__).resolve().parent.parent / "locale"


@lru_cache
def _load_locale(lang: str) -> dict[str, str]:
    """加载指定语言的键值文案表。"""
    path = LOCALE_DIR / f"{lang}.json"
    if not path.exists():
        logger.warning("locale file missing: %s", path)
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_lang(request: Optional[Request] = None, lang: Optional[str] = None) -> str:
    """根据显式参数和请求头解析受支持的语言。"""

    settings = get_settings()
    candidates: list[str] = []
    if lang:
        candidates.append(lang.lower()[:2])
    if request is not None:
        header = request.headers.get(ACCEPT_LANGUAGE_HEADER, "")
        if header:
            # e.g. "zh-CN,zh;q=0.9,en;q=0.8"
            for part in header.split(","):
                code = part.strip().split(";")[0].strip().lower()
                if code:
                    candidates.append(code[:2])
    candidates.append(settings.default_locale)

    for c in candidates:
        if c in settings.supported_locales:
            return c
    return settings.default_locale


def parse_device_language(
    *,
    device_header: str = "",
    accept_language: str = "",
) -> str:
    """提取供管理端展示的主要设备语言标签。"""
    for raw in (device_header, accept_language):
        text = (raw or "").strip()
        if not text:
            continue
        # Take first tag; drop q= weight
        tag = text.split(",")[0].strip().split(";")[0].strip()
        if not tag:
            continue
        # Normalize underscore (zh_CN) → hyphen
        tag = tag.replace("_", "-")
        return tag[:32]
    return ""


def t(key: str, lang: Optional[str] = None, request: Optional[Request] = None, **kwargs) -> str:
    """按语言读取文案并应用命名格式参数。"""

    locale = resolve_lang(request=request, lang=lang)
    messages = _load_locale(locale)
    text = messages.get(key)
    if text is None and locale != "en":
        text = _load_locale("en").get(key)
    if text is None:
        logger.warning("missing i18n key=%s locale=%s", key, locale)
        text = key
    if kwargs:
        try:
            return text.format(**kwargs)
        except Exception:
            return text
    return text
