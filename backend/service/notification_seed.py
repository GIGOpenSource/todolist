"""Seed demo system notifications for local / empty databases.

User-facing copy is stored as notif.seed.* i18n keys and resolved on read.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Set

from sqlalchemy.orm import Session

from common.logger import get_logger
from models.notification_campaign import NotificationCampaign
from utils.time_util import utc_now

logger = get_logger("notification_seed")

SEED_REMARK_PREFIX = "seed:demo"


def _remark(seed_id: str) -> str:
    return f"{SEED_REMARK_PREFIX}:{seed_id}"


def _demo_samples(now) -> List[Dict[str, Any]]:
    """Structural demo campaigns; title/body are locale keys."""
    return [
        {
            "seed_id": "welcome",
            "title": "notif.seed.welcome.title",
            "body": "notif.seed.welcome.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(days=3),
            "end_at": None,
            "bypass_quiet": True,
        },
        {
            "seed_id": "maintenance",
            "title": "notif.seed.maintenance.title",
            "body": "notif.seed.maintenance.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(days=1),
            "end_at": now + timedelta(days=7),
            "bypass_quiet": True,
        },
        {
            "seed_id": "pc_update",
            "title": "notif.seed.pc_update.title",
            "body": "notif.seed.pc_update.body",
            "channel": "system",
            "status": "active",
            "platforms": "pc,web",
            "start_at": now - timedelta(hours=12),
            "end_at": None,
            "bypass_quiet": False,
        },
        {
            "seed_id": "mobile_reminders",
            "title": "notif.seed.mobile_reminders.title",
            "body": "notif.seed.mobile_reminders.body",
            "channel": "system",
            "status": "active",
            "platforms": "ios,android",
            "start_at": now - timedelta(hours=6),
            "end_at": now + timedelta(days=14),
            "bypass_quiet": False,
        },
        {
            "seed_id": "v1_retro",
            "title": "notif.seed.v1_retro.title",
            "body": "notif.seed.v1_retro.body",
            "channel": "system",
            "status": "ended",
            "platforms": "all",
            "start_at": now - timedelta(days=30),
            "end_at": now - timedelta(days=7),
            "bypass_quiet": False,
        },
        {
            "seed_id": "next_week",
            "title": "notif.seed.next_week.title",
            "body": "notif.seed.next_week.body",
            "channel": "system",
            "status": "scheduled",
            "platforms": "all",
            "start_at": now + timedelta(days=3),
            "end_at": now + timedelta(days=10),
            "bypass_quiet": False,
        },
        {
            "seed_id": "privacy",
            "title": "notif.seed.privacy.title",
            "body": "notif.seed.privacy.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(days=2),
            "end_at": None,
            "bypass_quiet": True,
        },
        {
            "seed_id": "sync_guide",
            "title": "notif.seed.sync_guide.title",
            "body": "notif.seed.sync_guide.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(hours=18),
            "end_at": now + timedelta(days=21),
            "bypass_quiet": False,
        },
        {
            "seed_id": "short",
            "title": "notif.seed.short.title",
            "body": "notif.seed.short.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(hours=3),
            "end_at": None,
            "bypass_quiet": False,
        },
        {
            "seed_id": "web_only",
            "title": "notif.seed.web_only.title",
            "body": "notif.seed.web_only.body",
            "channel": "system",
            "status": "active",
            "platforms": "web",
            "start_at": now - timedelta(hours=8),
            "end_at": now + timedelta(days=5),
            "bypass_quiet": False,
        },
        {
            "seed_id": "ios_only",
            "title": "notif.seed.ios_only.title",
            "body": "notif.seed.ios_only.body",
            "channel": "system",
            "status": "active",
            "platforms": "ios",
            "start_at": now - timedelta(hours=4),
            "end_at": now + timedelta(days=9),
            "bypass_quiet": False,
        },
        {
            "seed_id": "android_only",
            "title": "notif.seed.android_only.title",
            "body": "notif.seed.android_only.body",
            "channel": "system",
            "status": "active",
            "platforms": "android",
            "start_at": now - timedelta(hours=5),
            "end_at": now + timedelta(days=9),
            "bypass_quiet": False,
        },
        {
            "seed_id": "calendar_tips",
            "title": "notif.seed.calendar_tips.title",
            "body": "notif.seed.calendar_tips.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(days=5),
            "end_at": None,
            "bypass_quiet": False,
        },
        {
            "seed_id": "report_help",
            "title": "notif.seed.report_help.title",
            "body": "notif.seed.report_help.body",
            "channel": "system",
            "status": "active",
            "platforms": "pc,web,ios,android",
            "start_at": now - timedelta(days=4),
            "end_at": now + timedelta(days=30),
            "bypass_quiet": False,
        },
        {
            "seed_id": "security",
            "title": "notif.seed.security.title",
            "body": "notif.seed.security.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(minutes=90),
            "end_at": now + timedelta(days=3),
            "bypass_quiet": True,
        },
        {
            "seed_id": "greeting",
            "title": "notif.seed.greeting.title",
            "body": "notif.seed.greeting.body",
            "channel": "system",
            "status": "ended",
            "platforms": "all",
            "start_at": now - timedelta(days=20),
            "end_at": now - timedelta(days=14),
            "bypass_quiet": False,
        },
        {
            "seed_id": "draft",
            "title": "notif.seed.draft.title",
            "body": "notif.seed.draft.body",
            "channel": "system",
            "status": "draft",
            "platforms": "all",
            "start_at": None,
            "end_at": None,
            "bypass_quiet": False,
        },
        {
            "seed_id": "cancelled",
            "title": "notif.seed.cancelled.title",
            "body": "notif.seed.cancelled.body",
            "channel": "system",
            "status": "cancelled",
            "platforms": "all",
            "start_at": now - timedelta(days=10),
            "end_at": now - timedelta(days=8),
            "bypass_quiet": False,
        },
        {
            "seed_id": "promo",
            "title": "notif.seed.promo.title",
            "body": "notif.seed.promo.body",
            "channel": "promo",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(hours=2),
            "end_at": now + timedelta(days=4),
            "bypass_quiet": False,
        },
        {
            "seed_id": "long_title",
            "title": "notif.seed.long_title.title",
            "body": "notif.seed.long_title.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(minutes=40),
            "end_at": None,
            "bypass_quiet": False,
        },
        {
            "seed_id": "just_now",
            "title": "notif.seed.just_now.title",
            "body": "notif.seed.just_now.body",
            "channel": "system",
            "status": "active",
            "platforms": "all",
            "start_at": now - timedelta(minutes=5),
            "end_at": now + timedelta(days=2),
            "bypass_quiet": False,
        },
        {
            "seed_id": "scheduled_due",
            "title": "notif.seed.scheduled_due.title",
            "body": "notif.seed.scheduled_due.body",
            "channel": "system",
            "status": "scheduled",
            "platforms": "all",
            "start_at": now - timedelta(hours=1),
            "end_at": now + timedelta(days=6),
            "bypass_quiet": False,
        },
    ]


def _known_seed_ids(db: Session) -> Set[str]:
    rows = (
        db.query(NotificationCampaign.remark)
        .filter(NotificationCampaign.remark.like(f"{SEED_REMARK_PREFIX}%"))
        .all()
    )
    out: Set[str] = set()
    for (remark,) in rows:
        text = (remark or "").strip()
        if text.startswith(f"{SEED_REMARK_PREFIX}:"):
            out.add(text.split(":", 2)[-1])
        elif text == SEED_REMARK_PREFIX:
            # legacy seed rows without id — treat as blocking re-seed of all demos
            out.add("__legacy__")
    return out


def _known_titles(db: Session) -> Set[str]:
    return {
        t
        for (t,) in db.query(NotificationCampaign.title)
        .filter(NotificationCampaign.remark.like(f"{SEED_REMARK_PREFIX}%"))
        .all()
        if t
    }


def seed_demo_notification_campaigns(db: Session, *, force: bool = False) -> int:
    """
    Insert sample system notifications if the campaigns table is empty
    (or force=True). When seed rows already exist, append any missing demo
    ids so new samples land without wiping local data.

    Returns number of rows inserted.
    """
    now = utc_now()
    samples = _demo_samples(now)

    if force:
        db.query(NotificationCampaign).filter(
            NotificationCampaign.remark.like(f"{SEED_REMARK_PREFIX}%")
        ).delete(synchronize_session=False)
        to_insert = samples
    else:
        existing = db.query(NotificationCampaign).count()
        if existing == 0:
            to_insert = samples
        else:
            known_ids = _known_seed_ids(db)
            known_titles = _known_titles(db)
            if "__legacy__" in known_ids:
                # Old Chinese seed batch present — avoid duplicate spam
                return 0
            to_insert = [
                item
                for item in samples
                if item["seed_id"] not in known_ids and item["title"] not in known_titles
            ]
            if not to_insert:
                return 0

    rows = []
    for item in to_insert:
        rows.append(
            NotificationCampaign(
                title=item["title"],
                body=item["body"],
                channel=item["channel"],
                status=item["status"],
                platforms=item["platforms"],
                start_at=item["start_at"],
                end_at=item["end_at"],
                bypass_quiet=bool(item["bypass_quiet"]),
                remark=_remark(item["seed_id"]),
                created_by=0,
                created_at=now,
                updated_at=now,
            )
        )
    db.add_all(rows)
    db.commit()
    logger.info("seeded notification campaigns count=%s force=%s", len(rows), force)
    return len(rows)
