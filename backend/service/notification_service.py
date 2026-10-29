"""通知规则与 campaign 读写；客户端有效临时通知聚合。"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from common.constants import CODE_NOT_FOUND, CODE_VALIDATION_ERROR
from common.exceptions import AppError
from common.logger import get_logger
from models.notification_campaign import NotificationCampaign
from models.notification_config import NotificationConfig
from schemas.notification import (
    NotificationCampaignCreate,
    NotificationCampaignUpdate,
    NotificationRulesUpdate,
)
from service.notification_defaults import (
    CHANNEL_IDS,
    SCENE_IDS,
    clone_default_rules,
    default_notification_rules,
    localize_rules,
)
from utils.time_util import as_utc, utc_now

logger = get_logger("notification_service")

CAMPAIGN_CHANNELS = ("system", "promo")
CAMPAIGN_STATUSES = ("draft", "scheduled", "active", "ended", "cancelled")
CONFIG_ROW_ID = 1


def _deep_merge(base: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for key, value in (overlay or {}).items():
        if key in out and isinstance(out[key], dict) and isinstance(value, dict):
            if key in ("channels", "frequency", "quiet_hours", "l3_settings_guide", "principles", "ios", "android", "product_map"):
                out[key] = _deep_merge(out[key], value)
            else:
                out[key] = value
        else:
            out[key] = value
    return out


def normalize_rules(payload: Dict[str, Any] | None) -> Dict[str, Any]:
    """将部分通知配置补全为兼容默认策略的规则包。"""

    base = clone_default_rules()
    raw = payload if isinstance(payload, dict) else {}
    merged = _deep_merge(base, raw)

    # Ensure all strategy channels exist
    channels = dict(merged.get("channels") or {})
    for cid in CHANNEL_IDS:
        if cid not in channels or not isinstance(channels[cid], dict):
            channels[cid] = deepcopy(default_notification_rules()["channels"][cid])
    # promo never default-on / v1 send
    if isinstance(channels.get("promo"), dict):
        channels["promo"]["enabled_default"] = False
        channels["promo"]["v1_send"] = bool(channels["promo"].get("v1_send", False))
    merged["channels"] = channels

    # Merge permission scenes by id (keep strategy order)
    default_scenes = {s["id"]: s for s in default_notification_rules()["permission_scenes"]}
    incoming = raw.get("permission_scenes")
    scenes_out: List[Dict[str, Any]] = []
    if isinstance(incoming, list) and incoming:
        by_id = {}
        for item in incoming:
            if isinstance(item, dict) and item.get("id"):
                by_id[str(item["id"])] = item
        for sid in SCENE_IDS:
            base_scene = deepcopy(default_scenes[sid])
            if sid in by_id:
                overlay = by_id[sid]
                for k, v in overlay.items():
                    if k == "l1" and isinstance(v, dict) and isinstance(base_scene.get("l1"), dict):
                        base_scene["l1"] = {**base_scene["l1"], **v}
                    else:
                        base_scene[k] = v
            scenes_out.append(base_scene)
        # allow extra custom scenes after strategy ones
        for sid, item in by_id.items():
            if sid not in SCENE_IDS:
                scenes_out.append(item)
    else:
        scenes_out = [deepcopy(default_scenes[sid]) for sid in SCENE_IDS]
    merged["permission_scenes"] = scenes_out

    merged["enabled"] = bool(merged.get("enabled", True))
    merged["version"] = str(merged.get("version") or "1.0")
    return merged


class NotificationService:
    """管理通知规则、活动及客户端通知收件箱。"""

    def __init__(self, db: Session):
        self.db = db

    def _get_or_create_config_row(self) -> NotificationConfig:
        row = self.db.get(NotificationConfig, CONFIG_ROW_ID)
        if row is None:
            row = NotificationConfig(
                id=CONFIG_ROW_ID,
                config_json=json.dumps(clone_default_rules(), ensure_ascii=False),
                updated_at=utc_now(),
            )
            self.db.add(row)
            self.db.commit()
            self.db.refresh(row)
            logger.info("seeded notification_configs id=1 with strategy defaults")
        return row

    def get_rules(self, lang: str = "en") -> Dict[str, Any]:
        """返回补全默认值后的通知规则包（用户可见文案按 lang 解析）。"""

        row = self._get_or_create_config_row()
        try:
            raw = json.loads(row.config_json or "{}")
        except json.JSONDecodeError:
            raw = {}
        rules = normalize_rules(raw if isinstance(raw, dict) else {})
        return {
            "rules": localize_rules(rules, lang=lang),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    def update_rules(self, body: NotificationRulesUpdate, lang: str = "en") -> Dict[str, Any]:
        """深度合并并保存部分通知规则更新。"""

        row = self._get_or_create_config_row()
        try:
            current = json.loads(row.config_json or "{}")
        except json.JSONDecodeError:
            current = {}
        if not isinstance(current, dict):
            current = {}
        patch = body.model_dump(exclude_unset=True)
        # body.rules may be partial nested dict
        if "rules" in patch and isinstance(patch["rules"], dict):
            merged_src = _deep_merge(current, patch["rules"])
        else:
            # flat fields at top of body (enabled, etc.) applied into current
            flat = {k: v for k, v in patch.items() if k != "rules"}
            merged_src = _deep_merge(current, flat)
        rules = normalize_rules(merged_src)
        row.config_json = json.dumps(rules, ensure_ascii=False)
        row.updated_at = utc_now()
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("notification rules updated")
        return {
            "rules": localize_rules(rules, lang=lang),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    def reset_rules(self, lang: str = "en") -> Dict[str, Any]:
        """将通知规则恢复为策略默认值。"""

        row = self._get_or_create_config_row()
        rules = clone_default_rules()
        row.config_json = json.dumps(rules, ensure_ascii=False)
        row.updated_at = utc_now()
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("notification rules reset to strategy defaults")
        return {
            "rules": localize_rules(rules, lang=lang),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    # ── campaigns ─────────────────────────────────────────────────────

    def _parse_dt(self, value: Optional[str]) -> Optional[datetime]:
        if value is None or value == "":
            return None
        text = str(value).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return as_utc(datetime.fromisoformat(text))
        except ValueError as exc:
            raise AppError(CODE_VALIDATION_ERROR, "common.validation_error") from exc

    @staticmethod
    def _iso(dt: Optional[datetime]) -> Optional[str]:
        aware = as_utc(dt)
        return aware.isoformat() if aware else None

    def _localize_text(self, text: str) -> str:
        raw = text or ""
        if raw.startswith("notif."):
            from common.i18n import t
            from common.request_context import get_context_lang

            return t(raw, lang=get_context_lang())
        return raw

    def _campaign_public(self, row: NotificationCampaign) -> Dict[str, Any]:
        return {
            "id": row.id,
            "title": self._localize_text(row.title),
            "body": self._localize_text(row.body or ""),
            "channel": row.channel,
            "status": row.status,
            "platforms": row.platforms or "all",
            "start_at": self._iso(row.start_at),
            "end_at": self._iso(row.end_at),
            "bypass_quiet": bool(row.bypass_quiet),
            "remark": row.remark or "",
            "created_by": row.created_by,
            "created_at": self._iso(row.created_at),
            "updated_at": self._iso(row.updated_at),
        }

    def list_campaigns(
        self,
        page_num: int,
        page_size: int,
        status: str = "",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """分页查询通知活动并可按状态筛选。"""

        query = self.db.query(NotificationCampaign).order_by(NotificationCampaign.id.desc())
        st = (status or "").strip().lower()
        if st and st in CAMPAIGN_STATUSES:
            query = query.filter(NotificationCampaign.status == st)
        total = query.count()
        rows = query.offset((page_num - 1) * page_size).limit(page_size).all()
        return [self._campaign_public(r) for r in rows], total

    def create_campaign(
        self, body: NotificationCampaignCreate, actor_id: int
    ) -> Dict[str, Any]:
        """校验并创建通知活动。"""

        channel = (body.channel or "system").strip().lower()
        if channel not in CAMPAIGN_CHANNELS:
            raise AppError(CODE_VALIDATION_ERROR, "admin.notif.channel_invalid")
        status = (body.status or "draft").strip().lower()
        if status not in CAMPAIGN_STATUSES:
            raise AppError(CODE_VALIDATION_ERROR, "admin.notif.status_invalid")
        title = (body.title or "").strip()
        if not title:
            raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
        bypass = bool(body.bypass_quiet)
        if bypass and channel != "system":
            raise AppError(CODE_VALIDATION_ERROR, "admin.notif.bypass_system_only")

        row = NotificationCampaign(
            title=title[:120],
            body=(body.body or "")[:4000],
            channel=channel,
            status=status,
            platforms=(body.platforms or "all").strip()[:128] or "all",
            start_at=self._parse_dt(body.start_at),
            end_at=self._parse_dt(body.end_at),
            bypass_quiet=bypass,
            remark=(body.remark or "")[:255],
            created_by=int(actor_id or 0),
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("notification campaign created id=%s", row.id)
        return self._campaign_public(row)

    def update_campaign(
        self, campaign_id: int, body: NotificationCampaignUpdate
    ) -> Dict[str, Any]:
        """校验并更新指定通知活动。"""

        row = self.db.get(NotificationCampaign, campaign_id)
        if row is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        if body.title is not None:
            title = body.title.strip()
            if not title:
                raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
            row.title = title[:120]
        if body.body is not None:
            row.body = (body.body or "")[:4000]
        if body.channel is not None:
            channel = body.channel.strip().lower()
            if channel not in CAMPAIGN_CHANNELS:
                raise AppError(CODE_VALIDATION_ERROR, "admin.notif.channel_invalid")
            row.channel = channel
        if body.status is not None:
            status = body.status.strip().lower()
            if status not in CAMPAIGN_STATUSES:
                raise AppError(CODE_VALIDATION_ERROR, "admin.notif.status_invalid")
            row.status = status
        if body.platforms is not None:
            row.platforms = (body.platforms or "all").strip()[:128] or "all"
        if body.start_at is not None:
            row.start_at = self._parse_dt(body.start_at)
        if body.end_at is not None:
            row.end_at = self._parse_dt(body.end_at)
        if body.bypass_quiet is not None:
            row.bypass_quiet = bool(body.bypass_quiet)
        if body.remark is not None:
            row.remark = (body.remark or "")[:255]

        if row.bypass_quiet and row.channel != "system":
            raise AppError(CODE_VALIDATION_ERROR, "admin.notif.bypass_system_only")

        row.updated_at = utc_now()
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("notification campaign updated id=%s", row.id)
        return self._campaign_public(row)

    def delete_campaign(self, campaign_id: int) -> None:
        """删除指定通知活动。"""

        row = self.db.get(NotificationCampaign, campaign_id)
        if row is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        self.db.delete(row)
        self.db.commit()
        logger.info("notification campaign deleted id=%s", campaign_id)

    @staticmethod
    def _platform_matches(platforms: str, platform: str) -> bool:
        raw = (platforms or "all").strip().lower()
        if not raw or raw == "all":
            return True
        plat = (platform or "").strip().lower()
        if not plat:
            return True
        parts = {p.strip() for p in raw.replace(";", ",").split(",") if p.strip()}
        if "all" in parts:
            return True
        # Desktop H5 uses `pc`; uni-app browser uses `web` — treat as the same client family.
        aliases = {
            "pc": {"pc", "web"},
            "web": {"pc", "web"},
        }
        accepted = aliases.get(plat, {plat})
        return bool(parts & accepted)

    def _inbox_item(
        self, row: NotificationCampaign, *, is_read: bool = False
    ) -> Dict[str, Any]:
        published = as_utc(row.start_at) or as_utc(row.created_at)
        return {
            "id": row.id,
            "title": self._localize_text(row.title),
            "body": self._localize_text(row.body or ""),
            "channel": row.channel,
            "status": row.status,
            "platforms": row.platforms or "all",
            "start_at": self._iso(row.start_at),
            "end_at": self._iso(row.end_at),
            "published_at": self._iso(published),
            "created_at": self._iso(row.created_at),
            "bypass_quiet": bool(row.bypass_quiet) and row.channel == "system",
            "is_read": bool(is_read),
        }

    def _read_ids_for_user(self, user_id: int, campaign_ids: List[int]) -> set:
        if not campaign_ids:
            return set()
        from models.user_notification_read import UserNotificationRead

        rows = (
            self.db.query(UserNotificationRead.campaign_id)
            .filter(
                UserNotificationRead.user_id == user_id,
                UserNotificationRead.campaign_id.in_(campaign_ids),
            )
            .all()
        )
        return {int(r[0]) for r in rows}

    def mark_read(self, user_id: int, ids: List[int]) -> Dict[str, Any]:
        """标记通知已读（幂等）；返回当前已读 id 列表。"""
        from models.user_notification_read import UserNotificationRead

        cleaned: List[int] = []
        seen = set()
        for raw in ids or []:
            try:
                n = int(raw)
            except (TypeError, ValueError):
                continue
            if n <= 0 or n in seen:
                continue
            seen.add(n)
            cleaned.append(n)
        if not cleaned:
            return {"ids": [], "marked": 0}

        existing = (
            self.db.query(NotificationCampaign.id)
            .filter(NotificationCampaign.id.in_(cleaned))
            .all()
        )
        valid = {int(r[0]) for r in existing}
        already = self._read_ids_for_user(user_id, list(valid))
        now = utc_now()
        marked = 0
        for cid in valid:
            if cid in already:
                continue
            self.db.add(
                UserNotificationRead(user_id=user_id, campaign_id=cid, read_at=now)
            )
            marked += 1
        if marked:
            self.db.commit()
        all_read = self._read_ids_for_user(user_id, list(valid))
        return {"ids": sorted(all_read), "marked": marked}

    def list_inbox(
        self,
        page_num: int,
        page_size: int,
        platform: str = "",
        channel: str = "system",
        user_id: int | None = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """分页返回当前平台可见且已发布的通知。"""
        now = utc_now()
        ch = (channel or "system").strip().lower()
        if ch != "all" and ch not in CAMPAIGN_CHANNELS:
            ch = "system"

        query = self.db.query(NotificationCampaign).filter(
            NotificationCampaign.status.in_(("active", "scheduled", "ended"))
        )
        if ch != "all":
            query = query.filter(NotificationCampaign.channel == ch)

        rows = query.order_by(NotificationCampaign.id.desc()).all()
        plat = (platform or "").strip().lower()
        filtered: List[NotificationCampaign] = []
        for row in rows:
            # System inbox is shared per account across App / H5; only promo keeps platform targeting.
            if ch != "system" and not self._platform_matches(row.platforms, plat):
                continue
            # Hide future scheduled items until start
            start_at = as_utc(row.start_at)
            if start_at and start_at > now:
                continue
            filtered.append(row)

        total = len(filtered)
        page_num = max(int(page_num or 1), 1)
        page_size = max(int(page_size or 20), 1)
        start = (page_num - 1) * page_size
        page_rows = filtered[start : start + page_size]
        read_ids: set = set()
        if user_id is not None and page_rows:
            read_ids = self._read_ids_for_user(user_id, [r.id for r in page_rows])
        return [
            self._inbox_item(r, is_read=r.id in read_ids) for r in page_rows
        ], total

    def get_inbox_item(
        self, campaign_id: int, platform: str = "", user_id: int | None = None
    ) -> Dict[str, Any]:
        """返回当前平台可见的单条通知。"""

        row = self.db.get(NotificationCampaign, campaign_id)
        if row is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        if row.status not in ("active", "scheduled", "ended"):
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        now = utc_now()
        start_at = as_utc(row.start_at)
        if start_at and start_at > now:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        # System detail is account-scoped; promo still respects platform.
        if row.channel != "system" and not self._platform_matches(row.platforms, platform):
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        is_read = False
        if user_id is not None:
            is_read = row.id in self._read_ids_for_user(user_id, [row.id])
        return self._inbox_item(row, is_read=is_read)

    def list_active_campaigns_public(self) -> List[Dict[str, Any]]:
        """返回客户端时间窗内有效或待生效的通知活动。"""
        now = utc_now()
        rows = (
            self.db.query(NotificationCampaign)
            .filter(NotificationCampaign.status.in_(("active", "scheduled")))
            .order_by(NotificationCampaign.id.desc())
            .limit(50)
            .all()
        )
        out = []
        for row in rows:
            start_at = as_utc(row.start_at)
            end_at = as_utc(row.end_at)
            if start_at and start_at > now:
                if row.status != "scheduled":
                    continue
            if end_at and end_at < now:
                continue
            # promo never in public feed unless status active (still client must respect opt-in)
            out.append(
                {
                    "id": row.id,
                    "title": self._localize_text(row.title),
                    "body": self._localize_text(row.body or ""),
                    "channel": row.channel,
                    "platforms": row.platforms or "all",
                    "start_at": self._iso(row.start_at),
                    "end_at": self._iso(row.end_at),
                    "bypass_quiet": bool(row.bypass_quiet) and row.channel == "system",
                }
            )
        return out