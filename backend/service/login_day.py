"""用户打开日记录与连续天数（streak）。"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, List, Optional, Set, Union

from sqlalchemy.orm import Session

from common.logger import get_logger
from models.user_login_day import UserLoginDay
from utils.time_util import utc_today

logger = get_logger("login_day")

DayLike = Union[str, date, None]


def _coerce_day(value: DayLike = None) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            logger.warning("invalid day key ignored day=%s", value)
    return utc_today()


def record_login_day(db: Session, user_id: int, day: DayLike = None) -> date:
    """Upsert one UTC calendar day the user opened/used the app.

    Client may still send a local YYYY-MM-DD; missing/invalid day defaults to UTC today.
    Best-effort; never raises.
    """
    target = _coerce_day(day)
    try:
        existing = (
            db.query(UserLoginDay)
            .filter(UserLoginDay.user_id == user_id, UserLoginDay.login_date == target)
            .first()
        )
        if existing is not None:
            return target
        db.add(UserLoginDay(user_id=user_id, login_date=target))
        db.commit()
        logger.info("login day recorded user_id=%s date=%s", user_id, target.isoformat())
    except Exception:
        logger.exception("record login day failed user_id=%s", user_id)
        db.rollback()
    return target


def record_login_days(db: Session, user_id: int, days: Optional[Iterable[DayLike]] = None) -> List[date]:
    """Bulk upsert active days (e.g. client local open-day sync). Caps at 120 newest."""
    if not days:
        return []
    parsed: List[date] = []
    seen: Set[date] = set()
    for raw in days:
        d = _coerce_day(raw)
        if d in seen:
            continue
        seen.add(d)
        parsed.append(d)
    parsed.sort()
    parsed = parsed[-120:]
    for d in parsed:
        record_login_day(db, user_id, d)
    return parsed


def _login_day_set(db: Session, user_id: int) -> Set[date]:
    rows = db.query(UserLoginDay.login_date).filter(UserLoginDay.user_id == user_id).all()
    out: Set[date] = set()
    for row in rows:
        value = row[0] if not isinstance(row, date) else row
        if isinstance(value, date):
            out.add(value)
    return out


def compute_streak_days(db: Session, user_id: int, today: DayLike = None) -> int:
    """
    Consecutive open days ending on the latest active day.
    Starts from `today` (or UTC today). Tolerates ±1 day skew vs client local dates.
    A gap larger than one day resets the streak to 0.
    """
    day_set = _login_day_set(db, user_id)
    if not day_set:
        return 0

    cursor = _coerce_day(today)
    newest = max(day_set)
    # Client local day may be one day ahead of UTC (or behind near midnight).
    if newest > cursor and newest <= cursor + timedelta(days=1):
        cursor = newest
    elif cursor not in day_set:
        if newest >= cursor - timedelta(days=1):
            cursor = newest
        else:
            return 0

    streak = 0
    while cursor in day_set:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak
