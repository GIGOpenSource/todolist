"""逾期软删账号硬清理（启动与周期任务）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from common.constants import ACCOUNT_DELETION_GRACE_DAYS
from common.logger import get_logger
from models.user import User
from utils.time_util import utc_now

logger = get_logger("account_purge")


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def purge_at_for(deleted_at: datetime) -> datetime:
    return _aware(deleted_at) + timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)


def is_past_grace(deleted_at: Optional[datetime], now: Optional[datetime] = None) -> bool:
    if deleted_at is None:
        return False
    now = now or utc_now()
    return now >= purge_at_for(deleted_at)


def hard_delete_user(db: Session, user: User) -> None:
    """删除用户及其无 ORM cascade 的附属行，避免 FK 挡住整次登录。"""
    uid = user.id
    uname = user.username
    from models.note import Note
    from models.report_job import ReportJob
    from models.sync_meta import SyncMeta
    from models.todo import Todo
    from models.user_login_day import UserLoginDay
    from models.user_notification_read import UserNotificationRead

    db.query(UserLoginDay).filter(UserLoginDay.user_id == uid).delete(synchronize_session=False)
    db.query(ReportJob).filter(ReportJob.user_id == uid).delete(synchronize_session=False)
    db.query(UserNotificationRead).filter(UserNotificationRead.user_id == uid).delete(
        synchronize_session=False
    )
    db.query(Todo).filter(Todo.user_id == uid).delete(synchronize_session=False)
    db.query(Note).filter(Note.user_id == uid).delete(synchronize_session=False)
    db.query(SyncMeta).filter(SyncMeta.user_id == uid).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    logger.info("hard-deleted user_id=%s username=%s", uid, uname)


def purge_expired_deleted_accounts(db: Session) -> int:
    """Hard-delete users whose soft-delete grace period has elapsed. Returns count.

    Best-effort: a single FK/schema failure must not abort login/register.
    """
    now = utc_now()
    cutoff = now - timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)
    try:
        expired = (
            db.query(User)
            .filter(User.deleted_at.isnot(None), User.deleted_at <= cutoff)
            .all()
        )
    except Exception:
        logger.exception("list expired accounts failed")
        db.rollback()
        return 0

    count = 0
    for user in expired:
        try:
            hard_delete_user(db, user)
            count += 1
        except Exception:
            logger.exception("hard-delete failed user_id=%s", getattr(user, "id", None))
            db.rollback()
    if count:
        logger.info("purged %s expired soft-deleted account(s)", count)
    return count


def ensure_active_or_purge(db: Session, user: User) -> Tuple[Optional[User], Optional[datetime]]:
    """
    If user is soft-deleted past grace → hard delete and return (None, None).
    If still in grace → return (user, purge_at).
    If active → return (user, None).
    """
    deleted_at = _aware(getattr(user, "deleted_at", None))
    if deleted_at is None:
        return user, None
    if is_past_grace(deleted_at):
        hard_delete_user(db, user)
        return None, None
    return user, purge_at_for(deleted_at)
