"""管理端业务：用户/任务/统计/LLM/管理员/官网配置。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from common.admin_filters import AdminFilters
from common.constants import (
    CODE_FORBIDDEN,
    CODE_NOT_FOUND,
    CODE_USERNAME_EMPTY,
    CODE_USERNAME_EXISTS,
    CODE_VALIDATION_ERROR,
    ROLE_ADMIN,
    ROLE_USER,
)
from common.exceptions import AppError
from common.logger import get_logger
from common.metrics import metrics
from common.security import hash_password
from core.database import ping_db
from models.llm_model_config import LlmModelConfig
from models.note import Note
from models.report_job import ReportJob
from models.site_visit import SiteVisit
from models.sync_meta import SyncMeta
from models.todo import Todo
from models.user import User
from models.user_login_day import UserLoginDay
from schemas.admin import (
    AdminCreateRequest,
    AdminNoteUpdateRequest,
    AdminTodoUpdateRequest,
    AdminUpdateRequest,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    LlmModelCreateRequest,
    LlmModelUpdateRequest,
)
from third_api.llm import llm_configured
from utils.time_util import as_utc, utc_day_bounds, utc_today, utc_ts_bounds, utc_now

logger = get_logger("admin_service")

ALLOWED_GENDERS = {"", "male", "female", "other"}
PLATFORM_KEYS = {
    "ios": "admin.platform.ios",
    "android": "admin.platform.android",
    "web": "admin.platform.web",
    "pc": "admin.platform.pc",
    "unknown": "admin.platform.unknown",
}


def _utc_day_bounds(d) -> Tuple[datetime, datetime]:
    return utc_day_bounds(d)


def _ts_day_bounds(d) -> Tuple[float, float]:
    """UTC calendar-day bounds as epoch milliseconds (Todo timestamps are ms)."""
    start, end = utc_ts_bounds(d)
    return start * 1000.0, end * 1000.0


def _ms_to_iso(ts: Any) -> Optional[str]:
    """Convert Todo epoch-ms float to UTC ISO string."""
    if ts is None or ts == "":
        return None
    try:
        value = float(ts)
    except (TypeError, ValueError):
        return str(ts) if ts else None
    if value <= 0:
        return None
    try:
        return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError, OverflowError):
        return str(ts)


def _mask_api_key(key: str) -> str:
    raw = (key or "").strip()
    if not raw:
        return ""
    if len(raw) <= 4:
        return "****"
    return "****" + raw[-4:]


def _method_label(method: str, lang: str) -> str:
    from common.i18n import t

    m = (method or "password").strip().lower()
    key = {
        "password": "admin.method.password",
        "apple": "admin.method.apple",
        "ios": "admin.method.apple",
        "google": "admin.method.google",
    }.get(m, "admin.method.password")
    return t(key, lang=lang)


def _gender_label(gender: str, lang: str) -> str:
    from common.i18n import t

    g = (gender or "").strip().lower()
    key = {
        "male": "admin.gender.male",
        "female": "admin.gender.female",
        "other": "admin.gender.other",
    }.get(g)
    return t(key, lang=lang) if key else ""


def _platform_label(platform: str, lang: str) -> str:
    from common.i18n import t

    p = (platform or "").strip().lower()
    key = PLATFORM_KEYS.get(p)
    if key:
        return t(key, lang=lang)
    return p or "—"


def _unknown_label(lang: str) -> str:
    from common.i18n import t

    return t("admin.unknown", lang=lang)


def _user_public(u: User, lang: str = "en") -> Dict[str, Any]:
    method = getattr(u, "register_method", None) or "password"
    region = getattr(u, "register_region", None) or ""
    platform = getattr(u, "register_platform", None) or ""
    device_language = getattr(u, "device_language", None) or ""
    return {
        "id": u.id,
        "username": u.username,
        "nickname": u.nickname or "",
        "avatar": u.avatar or "",
        "gender": u.gender or "",
        "gender_label": _gender_label(u.gender or "", lang),
        "role": u.role,
        "register_method": method,
        "register_method_label": _method_label(method, lang),
        "register_region": region,
        "register_platform": platform,
        "register_platform_label": _platform_label(platform, lang),
        "device_language": device_language,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
        "has_password": bool(u.hashed_password),
    }


def _llm_public(row: LlmModelConfig) -> Dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "base_url": row.base_url,
        "api_key_masked": _mask_api_key(row.api_key),
        "has_api_key": bool((row.api_key or "").strip()),
        "model": row.model,
        "enabled": row.enabled,
        "is_default": row.is_default,
        "remark": row.remark or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _admin_public(u: User, lang: str = "en") -> Dict[str, Any]:
    from common.i18n import t
    from common.permissions import PERM_LABELS, get_user_permissions

    perms = get_user_permissions(u)
    labels = []
    if perms == ["*"]:
        labels = [t("admin.perm.all", lang=lang)]
    else:
        labels = [t(PERM_LABELS.get(p, p), lang=lang) for p in perms]
    return {
        "id": u.id,
        "username": u.username,
        "nickname": u.nickname or "",
        "role": u.role,
        "permissions": perms,
        "permission_labels": labels,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


class AdminService:
    """管理端业务：用户/统计/任务/LLM/管理员/官网访问写入。"""

    def __init__(self, db: Session, lang: str = "en"):
        self.db = db
        self.lang = lang or "en"

    # ── users ─────────────────────────────────────────────────────────

    def list_users(
        self,
        page_num: int,
        page_size: int,
        q: str = "",
        role: str = "user",
        filters: Optional[AdminFilters] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters = filters or AdminFilters()
        query = self.db.query(User).order_by(User.id.desc())
        role_filter = (role or "user").strip().lower()
        if role_filter == "user":
            query = query.filter(User.role == "user")
        elif role_filter == "admin":
            query = query.filter(User.role == ROLE_ADMIN)
        # role=all → no filter

        keyword = (q or "").strip()
        if keyword:
            filters_kw = [
                User.username.ilike(f"%{keyword}%"),
                User.nickname.ilike(f"%{keyword}%"),
            ]
            if keyword.isdigit():
                filters_kw.append(User.id == int(keyword))
            query = query.filter(or_(*filters_kw))

        query = filters.apply_user_created(query)

        total = query.count()
        rows = query.offset((page_num - 1) * page_size).limit(page_size).all()
        result = [_user_public(u, self.lang) for u in rows]
        logger.info("list users page_num=%s page_size=%s total=%s", page_num, page_size, total)
        return result, total

    def get_user(self, user_id: int) -> Dict[str, Any]:
        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        return _user_public(user, self.lang)

    def create_user(self, body: AdminUserCreateRequest) -> Dict[str, Any]:
        name = (body.username or "").strip()
        if not name:
            raise AppError(CODE_USERNAME_EMPTY, "auth.username_empty")
        if len(body.password or "") < 6:
            raise AppError(CODE_VALIDATION_ERROR, "auth.password_too_short")
        existing = self.db.query(User).filter(User.username == name).first()
        if existing is not None:
            raise AppError(CODE_USERNAME_EXISTS, "auth.username_exists")

        gender = (body.gender or "").strip().lower()
        if gender not in ALLOWED_GENDERS:
            gender = ""
        method = (body.register_method or "password").strip().lower()[:32] or "password"
        from common.admin_filters import normalize_platform

        platform = normalize_platform(body.register_platform) or (body.register_platform or "").strip()[:32]

        user = User(
            username=name,
            nickname=(body.nickname or "").strip()[:64],
            avatar=body.avatar or "",
            signature="",
            gender=gender,
            hashed_password=hash_password(body.password),
            role="user",
            register_method=method,
            register_region=(body.register_region or "").strip()[:64],
            register_platform=platform,
            device_language=(body.device_language or "").strip()[:32],
            deleted_at=None,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("admin created user id=%s username=%s", user.id, user.username)
        return _user_public(user, self.lang)

    def update_user(self, user_id: int, body: AdminUserUpdateRequest) -> Dict[str, Any]:
        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        if user.role == ROLE_ADMIN:
            raise AppError(CODE_FORBIDDEN, "admin.user_is_admin")

        if body.nickname is not None:
            user.nickname = (body.nickname or "").strip()[:64]
        if body.gender is not None:
            g = (body.gender or "").strip().lower()
            user.gender = g if g in ALLOWED_GENDERS else ""
        if body.avatar is not None:
            user.avatar = body.avatar or ""
        if body.register_region is not None:
            user.register_region = (body.register_region or "").strip()[:64]
        if body.register_platform is not None:
            from common.admin_filters import normalize_platform

            p = normalize_platform(body.register_platform) or (body.register_platform or "").strip()[:32]
            user.register_platform = p
        if body.device_language is not None:
            user.device_language = (body.device_language or "").strip()[:32]
        if body.register_method is not None:
            m = (body.register_method or "password").strip().lower()[:32] or "password"
            user.register_method = m
        if body.password is not None:
            if len(body.password) < 6:
                raise AppError(CODE_VALIDATION_ERROR, "auth.password_too_short")
            user.hashed_password = hash_password(body.password)
            from common.session_store import revoke_all_user_sessions

            revoke_all_user_sessions(user.id)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("admin updated user id=%s", user.id)
        return _user_public(user, self.lang)

    def soft_delete_user(self, user_id: int) -> Dict[str, Any]:
        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        if user.role == ROLE_ADMIN:
            raise AppError(CODE_FORBIDDEN, "admin.user_is_admin")
        if user.deleted_at is not None:
            return _user_public(user, self.lang)

        user.deleted_at = utc_now()
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        from common.session_store import revoke_all_user_sessions

        revoke_all_user_sessions(user.id)
        logger.info("admin soft-deleted user id=%s", user.id)
        return _user_public(user, self.lang)

    def restore_user(self, user_id: int) -> Dict[str, Any]:
        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        if user.role == ROLE_ADMIN:
            raise AppError(CODE_FORBIDDEN, "admin.user_is_admin")
        user.deleted_at = None
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("admin restored user id=%s", user.id)
        return _user_public(user, self.lang)

    def hard_delete_user(self, user_id: int) -> None:
        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        if user.role == ROLE_ADMIN:
            raise AppError(CODE_FORBIDDEN, "admin.user_is_admin")
        from common.session_store import revoke_all_user_sessions
        from service.account_purge import hard_delete_user as purge_hard

        revoke_all_user_sessions(user.id)
        purge_hard(self.db, user)
        logger.info("admin hard-deleted user id=%s", user_id)

    # ── stats ─────────────────────────────────────────────────────────

    def _user_base_q(self, filters: AdminFilters):
        q = self.db.query(func.count(User.id))
        return filters.apply_user_attrs(q)

    def _count_users_created(
        self, start: datetime, end: datetime, filters: AdminFilters
    ) -> int:
        q = self.db.query(func.count(User.id)).filter(
            User.created_at >= start, User.created_at <= end
        )
        q = filters.apply_user_attrs(q)
        return q.scalar() or 0

    def _count_logins_on(self, d: date, filters: AdminFilters) -> int:
        q = self.db.query(func.count(UserLoginDay.id)).filter(UserLoginDay.login_date == d)
        if filters.platform or filters.country or filters.language:
            q = q.join(User, User.id == UserLoginDay.user_id)
            q = filters.apply_user_attrs(q)
        return q.scalar() or 0

    def _count_unique_logins_since(self, since: date, filters: AdminFilters) -> int:
        q = (
            self.db.query(func.count(func.distinct(UserLoginDay.user_id)))
            .filter(UserLoginDay.login_date >= since)
        )
        if filters.date_to:
            q = q.filter(UserLoginDay.login_date <= filters.date_to)
        if filters.platform or filters.country or filters.language:
            q = q.join(User, User.id == UserLoginDay.user_id)
            q = filters.apply_user_attrs(q)
        return q.scalar() or 0

    def _apply_visit_filters(self, query, filters: AdminFilters):
        if filters.platform:
            query = query.filter(SiteVisit.platform == filters.platform)
        if filters.country:
            c = filters.country
            if len(c) == 2 and c.isalpha():
                query = query.filter(SiteVisit.country.ilike(c))
            else:
                query = query.filter(SiteVisit.country.ilike(f"%{c}%"))
        return query

    def _visits_on(self, d: date, filters: AdminFilters) -> int:
        q = self.db.query(func.coalesce(func.sum(SiteVisit.count), 0)).filter(
            SiteVisit.visit_date == d
        )
        q = self._apply_visit_filters(q, filters)
        return int(q.scalar() or 0)

    def _visits_since(self, since: date, filters: AdminFilters, until: Optional[date] = None) -> int:
        q = self.db.query(func.coalesce(func.sum(SiteVisit.count), 0)).filter(
            SiteVisit.visit_date >= since
        )
        if until is not None:
            q = q.filter(SiteVisit.visit_date <= until)
        q = self._apply_visit_filters(q, filters)
        return int(q.scalar() or 0)

    def _todos_q(self, filters: AdminFilters):
        q = self.db.query(Todo)
        if filters.platform or filters.country or filters.language:
            q = q.join(User, User.id == Todo.user_id)
            q = filters.apply_user_attrs(q)
        return q

    def _todos_created_between(
        self, ts_start: float, ts_end: float, filters: AdminFilters
    ) -> int:
        q = self._todos_q(filters).filter(
            Todo.created_at >= ts_start, Todo.created_at <= ts_end
        )
        return q.with_entities(func.count(Todo.id)).scalar() or 0

    def _todos_completed_between(
        self, ts_start: float, ts_end: float, filters: AdminFilters
    ) -> int:
        q = self._todos_q(filters).filter(
            Todo.completed.is_(True),
            Todo.updated_at >= ts_start,
            Todo.updated_at <= ts_end,
        )
        return q.with_entities(func.count(Todo.id)).scalar() or 0

    def _reports_q(self, filters: AdminFilters):
        q = self.db.query(ReportJob)
        if filters.platform or filters.country or filters.language:
            q = q.join(User, User.id == ReportJob.user_id)
            q = filters.apply_user_attrs(q)
        return q

    def _reports_between(
        self, start: datetime, end: datetime, filters: AdminFilters
    ) -> int:
        q = self._reports_q(filters).filter(
            ReportJob.created_at >= start, ReportJob.created_at <= end
        )
        return q.with_entities(func.count(ReportJob.id)).scalar() or 0

    def _build_retention(
        self,
        filters: AdminFilters,
        cohort_end: date,
        today: date,
        max_day: int = 30,
        max_cohorts: int = 31,
    ) -> Dict[str, Any]:
        """
        Registration-day cohorts with D0..D30 login retention (UTC calendar).
        Rate = users who opened/logged in on cohort_date + N / cohort size.
        """
        cohort_start = filters.date_from or (cohort_end - timedelta(days=max_cohorts - 1))
        if (cohort_end - cohort_start).days > max_cohorts - 1:
            cohort_start = cohort_end - timedelta(days=max_cohorts - 1)
        if cohort_start > cohort_end:
            cohort_start, cohort_end = cohort_end, cohort_start

        range_start_dt = _utc_day_bounds(cohort_start)[0]
        range_end_dt = _utc_day_bounds(cohort_end)[1]

        users_q = (
            self.db.query(User.id, User.created_at)
            .filter(User.role == ROLE_USER)
            .filter(User.created_at >= range_start_dt, User.created_at <= range_end_dt)
        )
        users_q = filters.apply_user_attrs(users_q)
        user_rows = users_q.all()

        cohort_members: Dict[date, List[int]] = {}
        user_ids: List[int] = []
        for uid, created_at in user_rows:
            if created_at is None:
                continue
            cdate = as_utc(created_at).date()
            if cdate < cohort_start or cdate > cohort_end:
                continue
            cohort_members.setdefault(cdate, []).append(uid)
            user_ids.append(uid)

        login_by_user: Dict[int, set] = {}
        if user_ids:
            login_end = min(today, cohort_end + timedelta(days=max_day))
            login_rows = (
                self.db.query(UserLoginDay.user_id, UserLoginDay.login_date)
                .filter(
                    UserLoginDay.user_id.in_(user_ids),
                    UserLoginDay.login_date >= cohort_start,
                    UserLoginDay.login_date <= login_end,
                )
                .all()
            )
            for uid, login_date in login_rows:
                login_by_user.setdefault(uid, set()).add(login_date)

        cohorts: List[Dict[str, Any]] = []
        d = cohort_end
        while d >= cohort_start:
            members = cohort_members.get(d, [])
            size = len(members)
            rates: List[Optional[float]] = []
            retained_counts: List[Optional[int]] = []
            for offset in range(0, max_day + 1):
                target = d + timedelta(days=offset)
                if target > today:
                    rates.append(None)
                    retained_counts.append(None)
                    continue
                if size == 0:
                    rates.append(None)
                    retained_counts.append(0)
                    continue
                retained = sum(1 for uid in members if target in login_by_user.get(uid, ()))
                retained_counts.append(retained)
                rates.append(round((retained / size) * 100, 1))
            cohorts.append(
                {
                    "date": d.isoformat(),
                    "new_users": size,
                    "rates": rates,
                    "retained": retained_counts,
                }
            )
            d = d - timedelta(days=1)

        return {
            "max_day": max_day,
            "cohort_from": cohort_start.isoformat(),
            "cohort_to": cohort_end.isoformat(),
            "cohorts": cohorts,
        }

    def get_stats(self, filters: Optional[AdminFilters] = None) -> Dict[str, Any]:
        """汇总今日/累计指标（用户、日活、汇报、官网访问、任务）；支持平台/国家/语言过滤。"""
        filters = filters or AdminFilters()
        today = utc_today()
        range_end = filters.date_to or today
        range_start_default = today - timedelta(days=6)
        # When date range provided, use it; else rolling windows from "today"
        period_end = range_end
        period_start = filters.date_from or range_start_default
        if period_start > period_end:
            period_start, period_end = period_end, period_start

        day_start, day_end = _utc_day_bounds(period_end)
        ts_start, ts_end = _ts_day_bounds(period_end)
        week_start = period_end - timedelta(days=6)
        month_start = period_end - timedelta(days=29)
        if filters.date_from:
            week_start = max(week_start, filters.date_from)
            month_start = max(month_start, filters.date_from)
        week_bounds = _utc_day_bounds(week_start)
        month_bounds = _utc_day_bounds(month_start)
        ts_week = _ts_day_bounds(week_start)
        ts_month = _ts_day_bounds(month_start)
        # clamp upper bound when date_to set
        if filters.date_to:
            day_end = _utc_day_bounds(filters.date_to)[1]
            ts_end = _ts_day_bounds(filters.date_to)[1]

        # ── users ──
        users_q = self.db.query(func.count(User.id))
        users_q = filters.apply_user_attrs(users_q)
        if filters.date_from or filters.date_to:
            users_q = filters.apply_user_created(self.db.query(func.count(User.id)))
            # apply_user_created already includes attrs+dates
        users_total = users_q.scalar() or 0

        users_active_q = self.db.query(func.count(User.id)).filter(
            User.deleted_at.is_(None), User.role == ROLE_USER
        )
        users_active_q = filters.apply_user_attrs(users_active_q)
        if filters.date_from:
            users_active_q = users_active_q.filter(
                User.created_at >= _utc_day_bounds(filters.date_from)[0]
            )
        if filters.date_to:
            users_active_q = users_active_q.filter(
                User.created_at <= _utc_day_bounds(filters.date_to)[1]
            )
        users_active = users_active_q.scalar() or 0

        users_admin = (
            self.db.query(func.count(User.id)).filter(User.role == ROLE_ADMIN).scalar() or 0
        )
        users_pending_delete = (
            self.db.query(func.count(User.id)).filter(User.deleted_at.isnot(None)).scalar() or 0
        )
        users_today = self._count_users_created(day_start, day_end, filters)
        users_7d = self._count_users_created(week_bounds[0], day_end, filters)
        users_30d = self._count_users_created(month_bounds[0], day_end, filters)

        dau = self._count_logins_on(period_end, filters)
        wau = self._count_unique_logins_since(week_start, filters)
        mau = self._count_unique_logins_since(month_start, filters)

        visits_today = self._visits_on(period_end, filters)
        visits_7d = self._visits_since(week_start, filters, until=period_end)
        visits_30d = self._visits_since(month_start, filters, until=period_end)
        visits_total_q = self.db.query(func.coalesce(func.sum(SiteVisit.count), 0))
        visits_total_q = self._apply_visit_filters(visits_total_q, filters)
        if filters.date_from:
            visits_total_q = visits_total_q.filter(SiteVisit.visit_date >= filters.date_from)
        if filters.date_to:
            visits_total_q = visits_total_q.filter(SiteVisit.visit_date <= filters.date_to)
        visits_total = int(visits_total_q.scalar() or 0)

        # register breakdowns
        method_q = (
            self.db.query(User.register_method, func.count(User.id))
            .filter(User.role == ROLE_USER)
        )
        method_q = filters.apply_user_created(method_q) if (filters.date_from or filters.date_to) else filters.apply_user_attrs(method_q)
        method_rows = method_q.group_by(User.register_method).all()

        region_q = (
            self.db.query(User.register_region, func.count(User.id))
            .filter(User.role == ROLE_USER)
        )
        region_q = filters.apply_user_created(region_q) if (filters.date_from or filters.date_to) else filters.apply_user_attrs(region_q)
        region_rows = (
            region_q.group_by(User.register_region)
            .order_by(func.count(User.id).desc())
            .limit(10)
            .all()
        )

        platform_q = (
            self.db.query(User.register_platform, func.count(User.id))
            .filter(User.role == ROLE_USER)
        )
        platform_q = filters.apply_user_created(platform_q) if (filters.date_from or filters.date_to) else filters.apply_user_attrs(platform_q)
        platform_rows = (
            platform_q.group_by(User.register_platform)
            .order_by(func.count(User.id).desc())
            .limit(10)
            .all()
        )

        # ── product / todos ──
        def _scoped_todos():
            q = self._todos_q(filters)
            if filters.date_from:
                q = q.filter(Todo.created_at >= _ts_day_bounds(filters.date_from)[0])
            if filters.date_to:
                q = q.filter(Todo.created_at <= _ts_day_bounds(filters.date_to)[1])
            return q

        todos_total = _scoped_todos().with_entities(func.count(Todo.id)).scalar() or 0
        todos_done = (
            _scoped_todos()
            .filter(Todo.completed.is_(True))
            .with_entities(func.count(Todo.id))
            .scalar()
            or 0
        )
        todos_pending = todos_total - todos_done
        completion_rate = round((todos_done / todos_total) * 100, 1) if todos_total else 0.0
        todos_created_today = self._todos_created_between(ts_start, ts_end, filters)
        todos_created_7d = self._todos_created_between(ts_week[0], ts_end, filters)
        todos_completed_today = self._todos_completed_between(ts_start, ts_end, filters)
        todos_completed_7d = self._todos_completed_between(ts_week[0], ts_end, filters)

        users_with_todos = (
            self._todos_q(filters).with_entities(func.count(func.distinct(Todo.user_id))).scalar()
            or 0
        )
        avg_todos = round(todos_total / users_with_todos, 1) if users_with_todos else 0.0

        # ── reports ──
        def _scoped_reports():
            q = self._reports_q(filters)
            if filters.date_from:
                q = q.filter(ReportJob.created_at >= _utc_day_bounds(filters.date_from)[0])
            if filters.date_to:
                q = q.filter(ReportJob.created_at <= _utc_day_bounds(filters.date_to)[1])
            return q

        reports_total = _scoped_reports().with_entities(func.count(ReportJob.id)).scalar() or 0
        reports_today = self._reports_between(day_start, day_end, filters)
        reports_7d = self._reports_between(week_bounds[0], day_end, filters)
        status_rows = (
            _scoped_reports()
            .with_entities(ReportJob.status, func.count(ReportJob.id))
            .group_by(ReportJob.status)
            .all()
        )
        source_rows = (
            _scoped_reports()
            .with_entities(ReportJob.source, func.count(ReportJob.id))
            .group_by(ReportJob.source)
            .all()
        )
        report_status = {str(s or "unknown"): int(c) for s, c in status_rows}
        report_source = {str(s or "unknown"): int(c) for s, c in source_rows}
        report_failed = int(report_status.get("failed", 0))
        report_done = int(report_status.get("done", 0))
        report_success_rate = (
            round((report_done / reports_total) * 100, 1) if reports_total else 0.0
        )

        # ── eng / infra ──
        llm_q = self.db.query(LlmModelConfig)
        if filters.date_from:
            llm_q = llm_q.filter(LlmModelConfig.created_at >= _utc_day_bounds(filters.date_from)[0])
        if filters.date_to:
            llm_q = llm_q.filter(LlmModelConfig.created_at <= _utc_day_bounds(filters.date_to)[1])
        llm_total = llm_q.with_entities(func.count(LlmModelConfig.id)).scalar() or 0
        llm_enabled = (
            llm_q.filter(LlmModelConfig.enabled.is_(True))
            .with_entities(func.count(LlmModelConfig.id))
            .scalar()
            or 0
        )
        llm_default = (
            self.db.query(LlmModelConfig)
            .filter(LlmModelConfig.enabled.is_(True), LlmModelConfig.is_default.is_(True))
            .first()
        )
        sync_users = self.db.query(func.count(SyncMeta.user_id)).scalar() or 0
        proc = metrics.snapshot()
        db_ok = ping_db()

        # ── trends (within period, max 31 days) ──
        trend_start = filters.date_from or (period_end - timedelta(days=6))
        trend_end = period_end
        span = (trend_end - trend_start).days
        if span > 30:
            trend_start = trend_end - timedelta(days=30)
            span = 30
        days: List[str] = []
        trend_new_users: List[int] = []
        trend_dau: List[int] = []
        trend_visits: List[int] = []
        trend_todos: List[int] = []
        trend_reports: List[int] = []
        for i in range(span, -1, -1):
            d = trend_end - timedelta(days=i)
            days.append(d.isoformat())
            ds, de = _utc_day_bounds(d)
            t0, t1 = _ts_day_bounds(d)
            trend_new_users.append(self._count_users_created(ds, de, filters))
            trend_dau.append(self._count_logins_on(d, filters))
            trend_visits.append(self._visits_on(d, filters))
            trend_todos.append(self._todos_created_between(t0, t1, filters))
            trend_reports.append(self._reports_between(ds, de, filters))

        visit_to_reg = (
            round((users_today / visits_today) * 100, 1) if visits_today else None
        )

        legacy = {
            "new_users": {"today": users_today, "total": users_total},
            "dau": {
                "today": dau,
                "total_days": self.db.query(func.count(func.distinct(UserLoginDay.login_date))).scalar()
                or 0,
            },
            "reports": {"today": reports_today, "total": reports_total},
            "site_visits": {"today": visits_today, "total": visits_total},
            "todos_created": {"today": todos_created_today, "total": todos_total},
            "todos_completed": {"today": todos_completed_today, "total": todos_done},
        }

        return {
            "date": period_end.isoformat(),
            "timezone": "UTC",
            "generated_at": utc_now().isoformat(),
            "filters": filters.to_dict(),
            **legacy,
            "overview": {
                "users_total": users_total,
                "users_active": users_active,
                "dau": dau,
                "wau": wau,
                "mau": mau,
                "visits_today": visits_today,
                "todos_total": todos_total,
                "completion_rate": completion_rate,
                "reports_today": reports_today,
                "db_ok": db_ok,
            },
            "ops": {
                "new_users": {
                    "today": users_today,
                    "d7": users_7d,
                    "d30": users_30d,
                    "total": users_total,
                },
                "active_users": {"dau": dau, "wau": wau, "mau": mau},
                "site_visits": {
                    "today": visits_today,
                    "d7": visits_7d,
                    "d30": visits_30d,
                    "total": visits_total,
                },
                "visit_to_register_pct_today": visit_to_reg,
                "users_pending_delete": users_pending_delete,
                "admins": users_admin,
                "register_methods": [
                    {"method": (m or "password"), "count": int(c)} for m, c in method_rows
                ],
                "register_regions": [
                    {"region": (r or _unknown_label(self.lang)), "count": int(c)} for r, c in region_rows
                ],
                "register_platforms": [
                    {
                        "platform": (p or _unknown_label(self.lang)),
                        "label": _platform_label(p or "", self.lang),
                        "count": int(c),
                    }
                    for p, c in platform_rows
                ],
            },
            "product": {
                "todos": {
                    "total": todos_total,
                    "completed": todos_done,
                    "pending": todos_pending,
                    "completion_rate": completion_rate,
                    "created_today": todos_created_today,
                    "created_7d": todos_created_7d,
                    "completed_today": todos_completed_today,
                    "completed_7d": todos_completed_7d,
                    "users_with_todos": users_with_todos,
                    "avg_per_active_user": avg_todos,
                },
                "reports": {
                    "today": reports_today,
                    "d7": reports_7d,
                    "total": reports_total,
                    "success_rate": report_success_rate,
                    "by_status": report_status,
                    "by_source": report_source,
                },
            },
            "eng": {
                "db": "ok" if db_ok else "fail",
                "llm_runtime_configured": llm_configured(),
                "llm_models": {
                    "total": llm_total,
                    "enabled": llm_enabled,
                    "default_name": llm_default.name if llm_default else None,
                    "default_model": llm_default.model if llm_default else None,
                },
                "report_jobs": {
                    "total": reports_total,
                    "failed": report_failed,
                    "done": report_done,
                    "queued": int(report_status.get("queued", 0)),
                    "running": int(report_status.get("running", 0)),
                    "by_status": report_status,
                },
                "sync_users": sync_users,
                "process": proc,
            },
            "trends": {
                "days": days,
                "new_users": trend_new_users,
                "dau": trend_dau,
                "site_visits": trend_visits,
                "todos_created": trend_todos,
                "reports": trend_reports,
            },
            "retention": self._build_retention(filters, period_end, today),
        }

    # ── todos list ────────────────────────────────────────────────────

    def list_todos(
        self,
        page_num: int,
        page_size: int,
        q: str = "",
        filters: Optional[AdminFilters] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters = filters or AdminFilters()
        query = (
            self.db.query(Todo, User)
            .outerjoin(User, User.id == Todo.user_id)
            .order_by(Todo.created_at.desc())
        )
        keyword = (q or "").strip()
        if keyword:
            kw_filters = [Todo.title.ilike(f"%{keyword}%")]
            if keyword.isdigit():
                kw_filters.append(Todo.user_id == int(keyword))
            query = query.filter(or_(*kw_filters))

        if filters.platform or filters.country or filters.language:
            query = filters.apply_user_attrs(query)
        if filters.date_from:
            query = query.filter(Todo.created_at >= _ts_day_bounds(filters.date_from)[0])
        if filters.date_to:
            query = query.filter(Todo.created_at <= _ts_day_bounds(filters.date_to)[1])

        total = query.count()
        rows = query.offset((page_num - 1) * page_size).limit(page_size).all()
        result = []
        for todo, user in rows:
            nickname = ""
            platform = ""
            region = ""
            if user is not None:
                nickname = (user.nickname or "").strip() or user.username
                platform = getattr(user, "register_platform", None) or ""
                region = getattr(user, "register_region", None) or ""
            result.append(
                {
                    "id": todo.id,
                    "title": todo.title,
                    "detail": todo.detail or "",
                    "due_at": float(todo.due_at or 0),
                    "user_id": todo.user_id,
                    "nickname": nickname,
                    "register_platform": platform,
                    "register_platform_label": _platform_label(platform, self.lang),
                    "register_region": region,
                    "completed": bool(todo.completed),
                    "created_at": _ms_to_iso(todo.created_at),
                    "updated_at": _ms_to_iso(todo.updated_at),
                }
            )
        return result, total

    def _todo_public(self, todo: Todo, user: Optional[User] = None) -> Dict[str, Any]:
        if user is None:
            user = self.db.get(User, todo.user_id)
        nickname = ""
        platform = ""
        region = ""
        if user is not None:
            nickname = (user.nickname or "").strip() or user.username
            platform = getattr(user, "register_platform", None) or ""
            region = getattr(user, "register_region", None) or ""
        return {
            "id": todo.id,
            "title": todo.title,
            "detail": todo.detail or "",
            "due_at": float(todo.due_at or 0),
            "user_id": todo.user_id,
            "nickname": nickname,
            "register_platform": platform,
            "register_platform_label": _platform_label(platform, self.lang),
            "register_region": region,
            "completed": bool(todo.completed),
            "created_at": _ms_to_iso(todo.created_at),
            "updated_at": _ms_to_iso(todo.updated_at),
        }

    def _bump_todo_sync(self, user_id: int, now_ms: Optional[float] = None) -> None:
        import time as _time

        ts = float(now_ms if now_ms is not None else _time.time() * 1000)
        meta = self.db.get(SyncMeta, user_id)
        if meta is None:
            meta = SyncMeta(user_id=user_id, list_updated_at=ts)
        else:
            meta.list_updated_at = max(float(meta.list_updated_at or 0), ts)
        self.db.add(meta)

    def update_todo(self, todo_id: str, body: AdminTodoUpdateRequest) -> Dict[str, Any]:
        import time as _time

        todo = self.db.get(Todo, todo_id)
        if todo is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        changed = False
        if body.title is not None:
            title = (body.title or "").strip()
            if not title:
                raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
            todo.title = title
            changed = True
        if body.detail is not None:
            todo.detail = body.detail or ""
            changed = True
        if body.completed is not None:
            todo.completed = bool(body.completed)
            changed = True
        if body.due_at is not None:
            todo.due_at = float(body.due_at or 0)
            changed = True

        if changed:
            now_ms = _time.time() * 1000
            todo.updated_at = now_ms
            self.db.add(todo)
            self._bump_todo_sync(todo.user_id, now_ms)
            self.db.commit()
            self.db.refresh(todo)
            logger.info("admin updated todo id=%s user_id=%s", todo.id, todo.user_id)
        return self._todo_public(todo)

    def delete_todo(self, todo_id: str) -> None:
        import time as _time

        todo = self.db.get(Todo, todo_id)
        if todo is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        user_id = todo.user_id
        self.db.delete(todo)
        self._bump_todo_sync(user_id, _time.time() * 1000)
        self.db.commit()
        logger.info("admin deleted todo id=%s user_id=%s", todo_id, user_id)

    # ── notes list ────────────────────────────────────────────────────

    def list_notes(
        self,
        page_num: int,
        page_size: int,
        q: str = "",
        filters: Optional[AdminFilters] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters = filters or AdminFilters()
        query = (
            self.db.query(Note, User)
            .outerjoin(User, User.id == Note.user_id)
            .order_by(Note.created_at.desc())
        )
        keyword = (q or "").strip()
        if keyword:
            kw_filters = [
                Note.title.ilike(f"%{keyword}%"),
                Note.content.ilike(f"%{keyword}%"),
            ]
            if keyword.isdigit():
                kw_filters.append(Note.user_id == int(keyword))
            query = query.filter(or_(*kw_filters))

        if filters.platform or filters.country or filters.language:
            query = filters.apply_user_attrs(query)
        if filters.date_from:
            query = query.filter(Note.created_at >= _ts_day_bounds(filters.date_from)[0])
        if filters.date_to:
            query = query.filter(Note.created_at <= _ts_day_bounds(filters.date_to)[1])

        total = query.count()
        rows = query.offset((page_num - 1) * page_size).limit(page_size).all()
        result = []
        for note, user in rows:
            nickname = ""
            platform = ""
            region = ""
            if user is not None:
                nickname = (user.nickname or "").strip() or user.username
                platform = getattr(user, "register_platform", None) or ""
                region = getattr(user, "register_region", None) or ""
            result.append(
                {
                    "id": note.id,
                    "title": note.title,
                    "content": note.content or "",
                    "user_id": note.user_id,
                    "nickname": nickname,
                    "register_platform": platform,
                    "register_platform_label": _platform_label(platform, self.lang),
                    "register_region": region,
                    "created_at": _ms_to_iso(note.created_at),
                    "updated_at": _ms_to_iso(note.updated_at),
                }
            )
        return result, total

    def _note_public(self, note: Note, user: Optional[User] = None) -> Dict[str, Any]:
        if user is None:
            user = self.db.get(User, note.user_id)
        nickname = ""
        platform = ""
        region = ""
        if user is not None:
            nickname = (user.nickname or "").strip() or user.username
            platform = getattr(user, "register_platform", None) or ""
            region = getattr(user, "register_region", None) or ""
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content or "",
            "user_id": note.user_id,
            "nickname": nickname,
            "register_platform": platform,
            "register_platform_label": _platform_label(platform, self.lang),
            "register_region": region,
            "created_at": _ms_to_iso(note.created_at),
            "updated_at": _ms_to_iso(note.updated_at),
        }

    def _bump_note_sync(self, user_id: int, now_ms: Optional[float] = None) -> None:
        import time as _time

        ts = float(now_ms if now_ms is not None else _time.time() * 1000)
        meta = self.db.get(SyncMeta, user_id)
        if meta is None:
            meta = SyncMeta(user_id=user_id, list_updated_at=0.0, notes_list_updated_at=ts)
        else:
            meta.notes_list_updated_at = max(float(getattr(meta, "notes_list_updated_at", None) or 0), ts)
        self.db.add(meta)

    def update_note(self, note_id: str, body: AdminNoteUpdateRequest) -> Dict[str, Any]:
        import time as _time

        note = self.db.get(Note, note_id)
        if note is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        changed = False
        if body.title is not None:
            title = (body.title or "").strip()
            if not title:
                raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
            note.title = title
            changed = True
        if body.content is not None:
            note.content = body.content or ""
            changed = True

        if changed:
            now_ms = _time.time() * 1000
            note.updated_at = now_ms
            self.db.add(note)
            self._bump_note_sync(note.user_id, now_ms)
            self.db.commit()
            self.db.refresh(note)
            logger.info("admin updated note id=%s user_id=%s", note.id, note.user_id)
        return self._note_public(note)

    def delete_note(self, note_id: str) -> None:
        import time as _time

        note = self.db.get(Note, note_id)
        if note is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        user_id = note.user_id
        self.db.delete(note)
        self._bump_note_sync(user_id, _time.time() * 1000)
        self.db.commit()
        logger.info("admin deleted note id=%s user_id=%s", note_id, user_id)

    # ── site visit ────────────────────────────────────────────────────

    def record_site_visit(
        self,
        *,
        platform: str = "",
        country: str = "",
    ) -> Dict[str, Any]:
        from common.admin_filters import normalize_platform

        today = utc_today()
        plat = normalize_platform(platform) or (platform or "").strip()[:32] or "web"
        ctry = (country or "").strip()[:64]
        if ctry.upper() in ("XX", "T1"):
            ctry = ""
        row = self.db.get(SiteVisit, (today, plat, ctry))
        if row is None:
            row = SiteVisit(
                visit_date=today,
                platform=plat,
                country=ctry,
                count=1,
                updated_at=utc_now(),
            )
            self.db.add(row)
        else:
            row.count = int(row.count or 0) + 1
            row.updated_at = utc_now()
            self.db.add(row)
        self.db.commit()
        return {
            "visit_date": today.isoformat(),
            "platform": plat,
            "country": ctry,
            "count": row.count,
        }

    # ── LLM models ────────────────────────────────────────────────────

    def list_llm_models(self) -> List[Dict[str, Any]]:
        rows = self.db.query(LlmModelConfig).order_by(LlmModelConfig.id.asc()).all()
        return [_llm_public(r) for r in rows]

    def _clear_other_defaults(self, keep_id: Optional[int] = None) -> None:
        q = self.db.query(LlmModelConfig).filter(LlmModelConfig.is_default.is_(True))
        if keep_id is not None:
            q = q.filter(LlmModelConfig.id != keep_id)
        for row in q.all():
            row.is_default = False
            row.updated_at = utc_now()
            self.db.add(row)

    def create_llm_model(self, body: LlmModelCreateRequest) -> Dict[str, Any]:
        name = (body.name or "").strip()
        if not name:
            raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
        if body.is_default:
            self._clear_other_defaults()
        row = LlmModelConfig(
            name=name[:64],
            base_url=(body.base_url or "https://api.openai.com/v1").strip()[:512],
            api_key=body.api_key or "",
            model=(body.model or "gpt-4o-mini").strip()[:128],
            enabled=bool(body.enabled),
            is_default=bool(body.is_default),
            remark=(body.remark or "")[:255],
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("llm model created id=%s name=%s", row.id, row.name)
        return _llm_public(row)

    def update_llm_model(self, model_id: int, body: LlmModelUpdateRequest) -> Dict[str, Any]:
        row = self.db.get(LlmModelConfig, model_id)
        if row is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        if body.name is not None:
            name = body.name.strip()
            if not name:
                raise AppError(CODE_VALIDATION_ERROR, "common.validation_error")
            row.name = name[:64]
        if body.base_url is not None:
            row.base_url = body.base_url.strip()[:512]
        if body.api_key is not None:
            row.api_key = body.api_key
        if body.model is not None:
            row.model = body.model.strip()[:128]
        if body.enabled is not None:
            row.enabled = bool(body.enabled)
        if body.remark is not None:
            row.remark = (body.remark or "")[:255]
        if body.is_default is not None:
            if body.is_default:
                self._clear_other_defaults(keep_id=row.id)
            row.is_default = bool(body.is_default)

        row.updated_at = utc_now()
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        logger.info("llm model updated id=%s", row.id)
        return _llm_public(row)

    def delete_llm_model(self, model_id: int) -> None:
        row = self.db.get(LlmModelConfig, model_id)
        if row is None:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        self.db.delete(row)
        self.db.commit()
        logger.info("llm model deleted id=%s", model_id)

    # ── admin accounts ────────────────────────────────────────────────

    def list_permission_catalog(self) -> List[Dict[str, Any]]:
        from common.i18n import t
        from common.permissions import permission_catalog

        items = permission_catalog()
        for item in items:
            key = item.get("label") or ""
            if isinstance(key, str) and key.startswith("admin."):
                item["label"] = t(key, lang=self.lang)
        return items

    def _count_admins_with_admins_perm(self, exclude_id: Optional[int] = None) -> int:
        from common.permissions import PERM_ADMINS, PERM_ALL, get_user_permissions

        count = 0
        rows = self.db.query(User).filter(User.role == ROLE_ADMIN).all()
        for u in rows:
            if exclude_id is not None and u.id == exclude_id:
                continue
            perms = get_user_permissions(u)
            if PERM_ALL in perms or PERM_ADMINS in perms:
                count += 1
        return count

    def list_admins(
        self,
        page_num: int,
        page_size: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = (
            self.db.query(User)
            .filter(User.role == ROLE_ADMIN)
            .order_by(User.id.asc())
        )
        total = query.count()
        rows = query.offset((page_num - 1) * page_size).limit(page_size).all()
        return [_admin_public(u, self.lang) for u in rows], total

    def create_admin(self, body: AdminCreateRequest) -> Dict[str, Any]:
        from common.permissions import serialize_permissions, validate_permissions

        name = (body.username or "").strip()
        if not name:
            raise AppError(CODE_USERNAME_EMPTY, "auth.username_empty")
        if len(body.password or "") < 6:
            raise AppError(CODE_VALIDATION_ERROR, "auth.password_too_short")

        existing = self.db.query(User).filter(User.username == name).first()
        if existing is not None:
            raise AppError(CODE_USERNAME_EXISTS, "auth.username_exists")

        perms = validate_permissions(body.permissions or ["*"])

        user = User(
            username=name,
            nickname=(body.nickname or "").strip()[:64],
            avatar="",
            signature="",
            gender="",
            hashed_password=hash_password(body.password),
            role=ROLE_ADMIN,
            register_method="password",
            register_region="",
            admin_permissions=serialize_permissions(perms),
            deleted_at=None,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("admin created id=%s username=%s perms=%s", user.id, user.username, perms)
        return _admin_public(user, self.lang)

    def update_admin(self, admin_id: int, body: AdminUpdateRequest, actor_id: int) -> Dict[str, Any]:
        from common.permissions import (
            PERM_ADMINS,
            PERM_ALL,
            get_user_permissions,
            serialize_permissions,
            validate_permissions,
        )

        user = self.db.get(User, admin_id)
        if user is None or user.role != ROLE_ADMIN:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        if body.nickname is not None:
            user.nickname = (body.nickname or "").strip()[:64]
        if body.password is not None:
            if len(body.password) < 6:
                raise AppError(CODE_VALIDATION_ERROR, "auth.password_too_short")
            user.hashed_password = hash_password(body.password)

        if body.permissions is not None:
            perms = validate_permissions(body.permissions)
            # Cannot strip the last admin-manager of admins permission
            losing_admins_perm = PERM_ALL not in perms and PERM_ADMINS not in perms
            if losing_admins_perm:
                others = self._count_admins_with_admins_perm(exclude_id=user.id)
                if others <= 0:
                    raise AppError(CODE_FORBIDDEN, "admin.cannot_strip_last_admins_perm")
            # Self cannot remove own admins permission
            if admin_id == actor_id:
                current = get_user_permissions(user)
                had = PERM_ALL in current or PERM_ADMINS in current
                keep = PERM_ALL in perms or PERM_ADMINS in perms
                if had and not keep:
                    raise AppError(CODE_FORBIDDEN, "admin.cannot_strip_self_admins_perm")
            user.admin_permissions = serialize_permissions(perms)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("admin updated id=%s", user.id)
        return _admin_public(user, self.lang)

    def delete_admin(self, admin_id: int, actor_id: int) -> None:
        if admin_id == actor_id:
            raise AppError(CODE_FORBIDDEN, "admin.cannot_delete_self")

        user = self.db.get(User, admin_id)
        if user is None or user.role != ROLE_ADMIN:
            raise AppError(CODE_NOT_FOUND, "common.not_found")

        admin_count = self.db.query(func.count(User.id)).filter(User.role == ROLE_ADMIN).scalar() or 0
        if admin_count <= 1:
            raise AppError(CODE_FORBIDDEN, "admin.cannot_delete_last")

        # Keep at least one admin with admins permission
        from common.permissions import PERM_ADMINS, PERM_ALL, get_user_permissions

        target_perms = get_user_permissions(user)
        if PERM_ALL in target_perms or PERM_ADMINS in target_perms:
            if self._count_admins_with_admins_perm(exclude_id=admin_id) <= 0:
                raise AppError(CODE_FORBIDDEN, "admin.cannot_strip_last_admins_perm")

        self.db.delete(user)
        self.db.commit()
        logger.info("admin deleted id=%s by=%s", admin_id, actor_id)
