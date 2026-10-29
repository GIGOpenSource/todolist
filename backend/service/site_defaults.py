"""Default website CMS payload (mirrors website/js/config.js + marketing i18n)."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List

# Align with frontend/website LOCALES (20 product languages)
SITE_LOCALES: List[str] = [
    "en",
    "zh-Hans",
    "zh-Hant",
    "ja",
    "ko",
    "fr",
    "de",
    "es",
    "pt",
    "it",
    "ru",
    "vi",
    "th",
    "id",
    "ms",
    "tr",
    "pl",
    "nl",
    "sv",
    "hi",
]

SITE_LOCALE_NAMES: Dict[str, str] = {
    "en": "English",
    "zh-Hans": "简体中文",
    "zh-Hant": "繁體中文",
    "ja": "日本語",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "pt": "Português",
    "it": "Italiano",
    "ru": "Русский",
    "vi": "Tiếng Việt",
    "th": "ไทย",
    "id": "Bahasa Indonesia",
    "ms": "Bahasa Melayu",
    "tr": "Türkçe",
    "pl": "Polski",
    "nl": "Nederlands",
    "sv": "Svenska",
    "hi": "हिन्दी",
}

# Marketing fields editable in admin CMS (chrome keys stay in website/js/i18n.js)
CMS_I18N_KEYS: tuple[str, ...] = (
    "hook",
    "slogan",
    "support",
    "ctaLogin",
    "ctaDownload",
    "showcaseTitle",
    "showcaseSub",
    "productTitle",
    "productSub",
    "downloadTitle",
    "downloadSub",
    "desireTitle",
    "desireSub",
    "footerNote",
)

_I18N_PATH = Path(__file__).resolve().parent / "site_i18n_defaults.json"


def _load_i18n_defaults() -> Dict[str, Any]:
    with _I18N_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, Any] = {}
    en_pack = raw.get("en") if isinstance(raw.get("en"), dict) else {}
    for code in SITE_LOCALES:
        pack = raw.get(code)
        if not isinstance(pack, dict):
            pack = dict(en_pack)
        else:
            # Fill missing scalar keys from en
            merged = dict(en_pack)
            merged.update(pack)
            pack = merged
        shots = pack.get("shots") if isinstance(pack.get("shots"), list) else []
        features = pack.get("features") if isinstance(pack.get("features"), list) else []
        en_shots = en_pack.get("shots") if isinstance(en_pack.get("shots"), list) else []
        en_features = en_pack.get("features") if isinstance(en_pack.get("features"), list) else []
        out[code] = {
            **{k: str(pack.get(k, en_pack.get(k, "")) or "") for k in CMS_I18N_KEYS},
            "shots": [
                {
                    "title": str((shots[i] if i < len(shots) else {}).get("title")
                                 or (en_shots[i] if i < len(en_shots) else {}).get("title")
                                 or ""),
                    "desc": str((shots[i] if i < len(shots) else {}).get("desc")
                                or (en_shots[i] if i < len(en_shots) else {}).get("desc")
                                or ""),
                }
                for i in range(3)
            ],
            "features": [
                {
                    "title": str((features[i] if i < len(features) else {}).get("title")
                                 or (en_features[i] if i < len(en_features) else {}).get("title")
                                 or ""),
                    "desc": str((features[i] if i < len(features) else {}).get("desc")
                                or (en_features[i] if i < len(en_features) else {}).get("desc")
                                or ""),
                }
                for i in range(3)
            ],
        }
    return out


DEFAULT_SITE_CONFIG: Dict[str, Any] = {
    "brand": "Upgrade",
    "contactEmail": "you@example.com",
    # Empty by default — set via admin CMS for production (avoid baking localhost).
    "loginUrl": "",
    "downloads": {
        "androidPhone": {"id": "androidPhone", "url": "", "ready": False},
        "androidPad": {"id": "androidPad", "url": "", "ready": False},
        "iosPhone": {"id": "iosPhone", "url": "", "ready": False},
        "iosPad": {"id": "iosPad", "url": "", "ready": False},
    },
    "shots": [
        {"src": "./assets/shots/tasks.svg", "key": 0},
        {"src": "./assets/shots/calendar.svg", "key": 1},
        {"src": "./assets/shots/stats.svg", "key": 2},
    ],
    "i18n": _load_i18n_defaults(),
}


def empty_locale_pack() -> Dict[str, Any]:
    return {
        **{k: "" for k in CMS_I18N_KEYS},
        "shots": [{"title": "", "desc": ""} for _ in range(3)],
        "features": [{"title": "", "desc": ""} for _ in range(3)],
    }


def ensure_all_locale_packs(i18n: Any) -> Dict[str, Any]:
    """Guarantee every SITE_LOCALES key exists (merge onto defaults)."""
    base = default_site_config()["i18n"]
    src = i18n if isinstance(i18n, dict) else {}
    out: Dict[str, Any] = {}
    for code in SITE_LOCALES:
        default_pack = base.get(code) or empty_locale_pack()
        raw = src.get(code)
        if not isinstance(raw, dict):
            out[code] = deepcopy(default_pack)
            continue
        pack = deepcopy(default_pack)
        for k in CMS_I18N_KEYS:
            if k in raw and raw[k] is not None:
                pack[k] = str(raw[k])
        if isinstance(raw.get("shots"), list):
            shots = []
            for i in range(3):
                item = raw["shots"][i] if i < len(raw["shots"]) and isinstance(raw["shots"][i], dict) else {}
                fallback = pack["shots"][i]
                shots.append(
                    {
                        "title": str(item.get("title", fallback["title"]) or ""),
                        "desc": str(item.get("desc", fallback["desc"]) or ""),
                    }
                )
            pack["shots"] = shots
        if isinstance(raw.get("features"), list):
            features = []
            for i in range(3):
                item = (
                    raw["features"][i]
                    if i < len(raw["features"]) and isinstance(raw["features"][i], dict)
                    else {}
                )
                fallback = pack["features"][i]
                features.append(
                    {
                        "title": str(item.get("title", fallback["title"]) or ""),
                        "desc": str(item.get("desc", fallback["desc"]) or ""),
                    }
                )
            pack["features"] = features
        out[code] = pack
    # Preserve unknown extra locales if any (forward-compatible)
    for code, pack in src.items():
        if code not in out and isinstance(pack, dict):
            out[code] = pack
    return out


def default_site_config() -> Dict[str, Any]:
    return deepcopy(DEFAULT_SITE_CONFIG)
