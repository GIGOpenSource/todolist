"""OpenAI 兼容 LLM 调用封装（汇报生成）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx

from common.logger import get_logger
from settings.config import get_settings

logger = get_logger("third_api.llm")


@dataclass
class LlmRuntimeConfig:
    api_key: str
    base_url: str
    model: str
    timeout_seconds: float
    source: str  # "db" | "env"


def _load_db_default() -> Optional[LlmRuntimeConfig]:
    """Prefer enabled + is_default row from llm_model_configs."""
    try:
        from core.database import SessionLocal
        from models.llm_model_config import LlmModelConfig

        db = SessionLocal()
        try:
            row = (
                db.query(LlmModelConfig)
                .filter(LlmModelConfig.enabled.is_(True), LlmModelConfig.is_default.is_(True))
                .order_by(LlmModelConfig.id.asc())
                .first()
            )
            if row is None:
                # Fallback: any enabled model
                row = (
                    db.query(LlmModelConfig)
                    .filter(LlmModelConfig.enabled.is_(True))
                    .order_by(LlmModelConfig.id.asc())
                    .first()
                )
            if row is None:
                return None
            key = (row.api_key or "").strip()
            if not key:
                return None
            settings = get_settings()
            return LlmRuntimeConfig(
                api_key=key,
                base_url=(row.base_url or "https://api.openai.com/v1").rstrip("/"),
                model=(row.model or "gpt-4o-mini").strip() or "gpt-4o-mini",
                timeout_seconds=float(settings.llm_timeout_seconds),
                source="db",
            )
        finally:
            db.close()
    except Exception:
        logger.exception("load llm config from db failed")
        return None


def resolve_llm_config() -> Optional[LlmRuntimeConfig]:
    db_cfg = _load_db_default()
    if db_cfg is not None:
        return db_cfg

    settings = get_settings()
    key = (settings.llm_api_key or "").strip()
    if not key:
        return None
    return LlmRuntimeConfig(
        api_key=key,
        base_url=(settings.llm_base_url or "https://api.openai.com/v1").rstrip("/"),
        model=(settings.llm_model or "gpt-4o-mini").strip() or "gpt-4o-mini",
        timeout_seconds=float(settings.llm_timeout_seconds),
        source="env",
    )


def llm_configured() -> bool:
    return resolve_llm_config() is not None


async def chat_completion_async(
    *,
    system: str,
    user: str,
    temperature: float = 0.4,
) -> Optional[str]:
    """Async OpenAI-compatible chat. Returns content or None on failure / unconfigured."""
    cfg = resolve_llm_config()
    if cfg is None:
        return None

    url = cfg.base_url + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": cfg.model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=cfg.timeout_seconds) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )
            if isinstance(content, str) and content.strip():
                return content.strip()
            logger.warning("llm empty content model=%s source=%s", cfg.model, cfg.source)
            return None
    except Exception as exc:  # noqa: BLE001
        logger.exception("llm request failed source=%s: %s", cfg.source, exc)
        return None


def chat_completion(
    *,
    system: str,
    user: str,
    temperature: float = 0.4,
) -> Optional[str]:
    """Sync wrapper for non-async callers (prefer chat_completion_async)."""
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(
                lambda: asyncio.run(
                    chat_completion_async(system=system, user=user, temperature=temperature)
                )
            ).result()
    return asyncio.run(chat_completion_async(system=system, user=user, temperature=temperature))
