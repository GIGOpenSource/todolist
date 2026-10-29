"""官网 CMS 配置读写与公开投影。"""

from __future__ import annotations

import json
from typing import Any, Dict

from sqlalchemy.orm import Session

from common.constants import CODE_VALIDATION_ERROR
from common.exceptions import AppError
from common.logger import get_logger
from models.site_config import SiteConfig
from service.site_defaults import default_site_config, ensure_all_locale_packs
from utils.time_util import utc_now

logger = get_logger("site_service")

DOWNLOAD_KEYS = ("androidPhone", "androidPad", "iosPhone", "iosPad")


def _deep_merge(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for key, value in (overlay or {}).items():
        if (
            key in out
            and isinstance(out[key], dict)
            and isinstance(value, dict)
            and key not in ("downloads",)
        ):
            # Nested dict merge for i18n locales etc.; arrays replace wholesale
            if key == "i18n":
                merged_i18n = dict(out.get("i18n") or {})
                for locale, pack in value.items():
                    if isinstance(pack, dict) and isinstance(merged_i18n.get(locale), dict):
                        locale_merged = dict(merged_i18n[locale])
                        for k, v in pack.items():
                            locale_merged[k] = v
                        merged_i18n[locale] = locale_merged
                    else:
                        merged_i18n[locale] = pack
                out["i18n"] = merged_i18n
            else:
                out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _is_loopback_url(url: str) -> bool:
    u = (url or "").strip().lower()
    return "127.0.0.1" in u or "localhost" in u


def _scrub_public_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Drop leftover localhost loginUrl when running production API."""
    from settings.config import get_settings

    out = dict(cfg)
    settings = get_settings()
    if settings.env in ("pro", "prod", "production") and _is_loopback_url(
        str(out.get("loginUrl") or "")
    ):
        out["loginUrl"] = ""
    return out


def _normalize_downloads(raw: Any) -> Dict[str, Any]:
    base = default_site_config()["downloads"]
    src = raw if isinstance(raw, dict) else {}
    out: Dict[str, Any] = {}
    for key in DOWNLOAD_KEYS:
        item = src.get(key) if isinstance(src.get(key), dict) else {}
        fallback = base[key]
        url = str(item.get("url", fallback.get("url", "")) or "").strip()
        if "ready" in item:
            ready = bool(item.get("ready"))
        elif url:
            ready = True
        else:
            ready = bool(fallback.get("ready", False))
        if not url:
            ready = False
        out[key] = {"id": key, "url": url, "ready": ready}
    return out


def _normalize_shots(raw: Any) -> list:
    base = default_site_config()["shots"]
    if not isinstance(raw, list) or not raw:
        return base
    out = []
    for i, item in enumerate(raw[:6]):
        if not isinstance(item, dict):
            continue
        src = str(item.get("src") or "").strip()
        if not src:
            continue
        out.append({"src": src, "key": int(item.get("key", i) or i)})
    return out or base


def normalize_site_config(payload: Dict[str, Any] | None) -> Dict[str, Any]:
    base = default_site_config()
    raw = payload if isinstance(payload, dict) else {}
    merged = _deep_merge(base, raw)
    merged["brand"] = str(merged.get("brand") or "Upgrade").strip()[:64] or "Upgrade"
    merged["contactEmail"] = str(merged.get("contactEmail") or "").strip()[:120]
    merged["loginUrl"] = str(merged.get("loginUrl") or "").strip()[:512]
    merged["downloads"] = _normalize_downloads(merged.get("downloads"))
    merged["shots"] = _normalize_shots(merged.get("shots"))
    merged["i18n"] = ensure_all_locale_packs(merged.get("i18n"))
    return merged


class SiteService:
    def __init__(self, db: Session):
        self.db = db

    def _row(self) -> SiteConfig:
        row = self.db.get(SiteConfig, 1)
        if row is None:
            row = SiteConfig(id=1, config_json=json.dumps(default_site_config(), ensure_ascii=False))
            self.db.add(row)
            self.db.commit()
            self.db.refresh(row)
            logger.info("site config seeded id=1")
        return row

    def get_config(self) -> Dict[str, Any]:
        row = self._row()
        try:
            data = json.loads(row.config_json or "{}")
        except json.JSONDecodeError:
            data = {}
        result = normalize_site_config(data if isinstance(data, dict) else {})
        result = _scrub_public_config(result)
        result["updated_at"] = row.updated_at.isoformat() if row.updated_at else None
        return result

    def update_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
        payload = {k: v for k, v in payload.items() if k != "updated_at"}
        current = self.get_config()
        current.pop("updated_at", None)
        merged = _deep_merge(current, payload)
        # Allow downloads/shots/i18n full replace when provided
        if "downloads" in payload:
            merged["downloads"] = payload["downloads"]
        if "shots" in payload:
            merged["shots"] = payload["shots"]
        if "i18n" in payload and isinstance(payload["i18n"], dict):
            # merge locale packs but keep other locales
            i18n = dict(current.get("i18n") or {})
            for locale, pack in payload["i18n"].items():
                if isinstance(pack, dict):
                    base_pack = dict(i18n.get(locale) or {})
                    base_pack.update(pack)
                    i18n[locale] = base_pack
            merged["i18n"] = i18n
        normalized = normalize_site_config(merged)
        row = self._row()
        row.config_json = json.dumps(normalized, ensure_ascii=False)
        row.updated_at = utc_now()
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("site config updated")
        result = dict(normalized)
        result["updated_at"] = row.updated_at.isoformat() if row.updated_at else None
        return result
