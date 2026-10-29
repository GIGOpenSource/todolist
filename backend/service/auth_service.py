"""认证业务：注册/登录/刷新/资料/改密/账号软删与恢复。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from common.constants import (
    ACCOUNT_DELETION_GRACE_DAYS,
    CODE_ACCOUNT_PENDING_DELETION,
    CODE_FORBIDDEN,
    CODE_INVALID_CREDENTIALS,
    CODE_USERNAME_EMPTY,
    CODE_USERNAME_EXISTS,
    CODE_VALIDATION_ERROR,
    ROLE_ADMIN,
    ROLE_USER,
)
from common.exceptions import AppError
from common.logger import get_logger
from common.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from models.sync_meta import SyncMeta
from models.user import User
from schemas.auth import DeleteAccountResult, ProfileResult, TokenResult, UpdateProfileRequest
from service.account_purge import ensure_active_or_purge, purge_at_for, purge_expired_deleted_accounts
from settings.config import get_settings
from utils.time_util import utc_now

logger = get_logger("auth_service")

ALLOWED_GENDERS = {"", "male", "female", "other"}


def _max_avatar_chars() -> int:
    from settings.config import get_settings

    s = get_settings()
    if (s.oss_bucket or "").strip() and (s.oss_access_key or "").strip():
        return int(s.max_avatar_inline_chars or 0)
    return int(s.max_avatar_data_url_chars or 600_000)


def _str_field(user: User, name: str) -> str:
    return (getattr(user, name, None) or "").strip()


class AuthService:
    """处理用户认证、资料、会话与账号生命周期。"""

    def __init__(self, db: Session):
        self.db = db

    def _profile(self, user: User) -> ProfileResult:
        from common.permissions import get_user_permissions
        from service.login_day import compute_streak_days

        deleted_at = getattr(user, "deleted_at", None)
        try:
            streak_days = compute_streak_days(self.db, user.id)
        except Exception:
            logger.exception("streak compute failed user_id=%s", user.id)
            self.db.rollback()
            streak_days = 0
        return ProfileResult(
            user_id=int(user.id),
            username=user.username,
            nickname=_str_field(user, "nickname"),
            avatar=getattr(user, "avatar", None) or "",
            signature=_str_field(user, "signature"),
            gender=_str_field(user, "gender"),
            role=user.role,
            streak_days=streak_days,
            permissions=get_user_permissions(user) if user.role == ROLE_ADMIN else [],
            deleted_at=deleted_at,
            purge_at=purge_at_for(deleted_at) if deleted_at else None,
        )

    def touch_streak(self, user: User, day: str | None = None, days: list[str] | None = None):
        """记录用户打开日并计算连续天数。"""

        from schemas.auth import TouchStreakResult
        from service.login_day import compute_streak_days, record_login_day, record_login_days

        if days:
            record_login_days(self.db, user.id, days)
        recorded = record_login_day(self.db, user.id, day)
        streak = compute_streak_days(self.db, user.id, recorded)
        return TouchStreakResult(day=recorded.isoformat(), streak_days=streak)

    def _token(self, user: User) -> TokenResult:
        settings = get_settings()
        access = create_access_token(user.id, user.username, user.role)
        refresh = create_refresh_token(user.id, user.username, user.role)
        p = self._profile(user)
        return TokenResult(
            access_token=access,
            refresh_token=refresh,
            user_id=int(user.id),
            username=p.username,
            nickname=p.nickname,
            avatar=p.avatar,
            signature=p.signature,
            gender=p.gender,
            role=p.role,
            expires_in=max(60, int(settings.access_token_expire_minutes) * 60),
            permissions=p.permissions,
        )

    def _raise_pending_deletion(self, user: User, *, lang: str | None = None) -> None:
        """失败信封 result 固定 null；恢复提示写入 message（含 purge_date）。"""
        from common.i18n import t

        purge_at = purge_at_for(user.deleted_at)
        purge_date = purge_at.strftime("%Y-%m-%d") if purge_at else ""
        raise AppError(
            CODE_ACCOUNT_PENDING_DELETION,
            "auth.account_pending_deletion",
            message=t(
                "auth.account_pending_deletion",
                lang=lang,
                purge_date=purge_date,
                grace_days=ACCOUNT_DELETION_GRACE_DAYS,
            ),
        )

    def register(
        self,
        username: str,
        password: str,
        *,
        register_region: str = "",
        register_method: str = "password",
        register_platform: str = "",
        device_language: str = "",
    ) -> TokenResult:
        """注册普通用户并返回 access/refresh token。"""
        """创建普通用户、初始化同步元数据并签发令牌。"""

        from common.admin_filters import normalize_platform

        try:
            purge_expired_deleted_accounts(self.db)
        except Exception:
            logger.exception("register purge skipped")
            self.db.rollback()
        name = (username or "").strip()
        if not name:
            raise AppError(CODE_USERNAME_EMPTY, "auth.username_empty")

        existing = self.db.query(User).filter(User.username == name).first()
        if existing is not None:
            active, _ = ensure_active_or_purge(self.db, existing)
            if active is not None:
                logger.info("register conflict username=%s", name)
                raise AppError(CODE_USERNAME_EXISTS, "auth.username_exists")

        method = (register_method or "password").strip()[:32] or "password"
        region = (register_region or "").strip()[:64]
        platform = normalize_platform(register_platform) or (register_platform or "").strip()[:32]
        lang = (device_language or "").strip()[:32]

        user = User(
            username=name,
            nickname="",
            avatar="",
            signature="",
            gender="",
            hashed_password=hash_password(password),
            role=ROLE_USER,
            register_method=method,
            register_region=region,
            register_platform=platform,
            device_language=lang,
            deleted_at=None,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        if self.db.get(SyncMeta, user.id) is None:
            self.db.add(SyncMeta(user_id=user.id, list_updated_at=0.0, notes_list_updated_at=0.0))
            self.db.commit()

        logger.info("register success user_id=%s username=%s", user.id, user.username)
        return self._token(user)

    def login(
        self,
        username: str,
        password: str,
        *,
        device_language: str = "",
        lang: str | None = None,
    ) -> TokenResult:
        """校验账号状态与密码，记录登录并签发令牌。"""

        try:
            purge_expired_deleted_accounts(self.db)
        except Exception:
            logger.exception("login purge skipped")
            self.db.rollback()
        name = (username or "").strip()
        user = self.db.query(User).filter(User.username == name).first()
        if user is None or not verify_password(password, user.hashed_password):
            logger.warning("login failed username=%s", name)
            raise AppError(CODE_INVALID_CREDENTIALS, "auth.invalid_credentials")

        active, purge_at = ensure_active_or_purge(self.db, user)
        if active is None:
            logger.warning("login purged expired soft-delete username=%s", name)
            raise AppError(CODE_INVALID_CREDENTIALS, "auth.invalid_credentials")
        if purge_at is not None:
            logger.info("login blocked pending deletion user_id=%s", active.id)
            self._raise_pending_deletion(active, lang=lang)

        # Capture device language only on first successful login (once)
        lang = (device_language or "").strip()[:32]
        if lang and not (getattr(active, "device_language", None) or "").strip():
            active.device_language = lang
            self.db.add(active)
            self.db.commit()
            self.db.refresh(active)

        logger.info("login success user_id=%s role=%s", active.id, active.role)
        from service.login_day import record_login_day

        record_login_day(self.db, active.id)
        return self._token(active)

    def get_profile(self, user: User, *, touch_login_day: bool = False) -> ProfileResult:
        """返回用户公开资料与账号状态；可选记入今日打开日。"""
        if touch_login_day:
            from service.login_day import record_login_day

            record_login_day(self.db, user.id)
        return self._profile(user)

    def update_profile(self, user: User, body: UpdateProfileRequest) -> ProfileResult:
        """校验并更新用户可编辑资料。"""

        if getattr(user, "deleted_at", None):
            self._raise_pending_deletion(user)

        if body.nickname is not None:
            name = (body.nickname or "").strip()
            user.nickname = name[:64]

        if body.signature is not None:
            sig = (body.signature or "").strip()
            user.signature = sig[:120]

        if body.gender is not None:
            g = (body.gender or "").strip().lower()
            if g not in ALLOWED_GENDERS:
                g = ""
            user.gender = g

        if body.avatar is not None:
            avatar = body.avatar or ""
            if avatar and not (
                avatar.startswith("data:image/")
                or avatar.startswith("http://")
                or avatar.startswith("https://")
            ):
                raise AppError(CODE_VALIDATION_ERROR, "auth.avatar_invalid")
            max_chars = _max_avatar_chars()
            if max_chars > 0 and len(avatar) > max_chars:
                raise AppError(CODE_VALIDATION_ERROR, "auth.avatar_too_large")
            # When OSS enabled, prefer https URLs over huge data URLs
            from third_api.oss import oss_configured

            if oss_configured() and avatar.startswith("data:image/"):
                raise AppError(CODE_VALIDATION_ERROR, "auth.avatar_use_upload")
            user.avatar = avatar

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info("profile updated user_id=%s", user.id)
        return self._profile(user)

    def schedule_delete(self, user: User) -> DeleteAccountResult:
        """软删除普通用户并撤销现有会话。"""

        if user.role == ROLE_ADMIN:
            raise AppError(CODE_FORBIDDEN, "auth.forbidden")
        if getattr(user, "deleted_at", None):
            purge_at = purge_at_for(user.deleted_at)
            return DeleteAccountResult(
                deleted_at=user.deleted_at,
                purge_at=purge_at,
                grace_days=ACCOUNT_DELETION_GRACE_DAYS,
            )

        user.deleted_at = utc_now()
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        from common.session_store import revoke_all_user_sessions

        revoke_all_user_sessions(user.id)
        purge_at = purge_at_for(user.deleted_at)
        logger.info(
            "account soft-deleted user_id=%s purge_at=%s",
            user.id,
            purge_at.isoformat(),
        )
        return DeleteAccountResult(
            deleted_at=user.deleted_at,
            purge_at=purge_at,
            grace_days=ACCOUNT_DELETION_GRACE_DAYS,
        )

    def restore_account(self, username: str, password: str) -> TokenResult:
        """在宽限期内恢复软删除账号。"""

        try:
            purge_expired_deleted_accounts(self.db)
        except Exception:
            logger.exception("restore purge skipped")
            self.db.rollback()
        name = (username or "").strip()
        user = self.db.query(User).filter(User.username == name).first()
        if user is None or not verify_password(password, user.hashed_password):
            raise AppError(CODE_INVALID_CREDENTIALS, "auth.invalid_credentials")

        active, purge_at = ensure_active_or_purge(self.db, user)
        if active is None:
            raise AppError(CODE_INVALID_CREDENTIALS, "auth.invalid_credentials")
        from service.login_day import record_login_day

        if purge_at is None:
            # Already active — just log in
            record_login_day(self.db, active.id)
            return self._token(active)

        active.deleted_at = None
        self.db.add(active)
        self.db.commit()
        self.db.refresh(active)
        logger.info("account restored user_id=%s", active.id)
        record_login_day(self.db, active.id)
        return self._token(active)

    def change_password(self, user: User, old_password: str, new_password: str) -> TokenResult:
        """校验旧密码后更新密码并重置会话。"""

        if not verify_password(old_password or "", user.hashed_password):
            raise AppError(CODE_INVALID_CREDENTIALS, "auth.password_incorrect")

        new_pw = (new_password or "").strip()
        if len(new_pw) < 6:
            raise AppError(CODE_VALIDATION_ERROR, "auth.password_too_short")
        if verify_password(new_pw, user.hashed_password):
            raise AppError(CODE_VALIDATION_ERROR, "auth.password_unchanged")

        user.hashed_password = hash_password(new_pw)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Invalidate other sessions, then mint tokens for this device
        self.logout_all(user)
        logger.info("password changed user_id=%s", user.id)
        return self._token(user)

    def refresh(self, refresh_token: str) -> TokenResult:
        """验证并轮换刷新令牌会话。"""

        from jwt import ExpiredSignatureError, PyJWTError

        from common.constants import CODE_TOKEN_EXPIRED, CODE_UNAUTHORIZED
        from common.session_store import revoke_refresh_session, session_valid, user_epoch

        try:
            payload = decode_refresh_token(refresh_token)
            user_id = int(payload.get("sub", 0))
            jti = str(payload.get("jti") or "")
        except ExpiredSignatureError:
            raise AppError(CODE_TOKEN_EXPIRED, "auth.token_expired")
        except (PyJWTError, ValueError, TypeError):
            raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized")

        if not session_valid(user_id, jti):
            raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized")

        token_epoch = int(payload.get("epoch") or 0)
        if token_epoch < user_epoch(user_id):
            revoke_refresh_session(jti)
            raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized")

        user = self.db.get(User, user_id)
        if user is None:
            raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized")

        active, purge_at = ensure_active_or_purge(self.db, user)
        if active is None or purge_at is not None:
            raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized")

        # Rotate: revoke old jti
        revoke_refresh_session(jti)
        logger.info("token refreshed user_id=%s", active.id)
        return self._token(active)

    def logout(self, refresh_token: str = "") -> None:
        """吊销单个刷新令牌会话。"""

        from common.session_store import revoke_refresh_session

        if not refresh_token:
            return
        try:
            payload = decode_refresh_token(refresh_token)
            jti = str(payload.get("jti") or "")
            revoke_refresh_session(jti)
        except Exception:
            return

    def logout_all(self, user: User) -> None:
        """撤销用户全部历史会话。"""

        from common.session_store import revoke_all_user_sessions

        revoke_all_user_sessions(user.id)
        logger.info("revoked all sessions user_id=%s", user.id)

    @staticmethod
    def register_meta_from_request(request) -> dict:
        """从注册请求头解析 region / platform / device_language（不下沉到路由编排）。"""
        from common.admin_filters import normalize_platform
        from common.constants import (
            ACCEPT_LANGUAGE_HEADER,
            CLIENT_PLATFORM_HEADER,
            DEVICE_LANGUAGE_HEADER,
        )
        from common.i18n import parse_device_language

        region = (
            request.headers.get("CF-IPCountry")
            or request.headers.get("X-Register-Region")
            or ""
        ).strip()
        if region.upper() in ("XX", "T1"):
            region = ""
        platform = normalize_platform(request.headers.get(CLIENT_PLATFORM_HEADER) or "")
        device_lang = parse_device_language(
            device_header=request.headers.get(DEVICE_LANGUAGE_HEADER) or "",
            accept_language=request.headers.get(ACCEPT_LANGUAGE_HEADER) or "",
        )
        return {
            "register_region": region[:64],
            "register_platform": platform,
            "device_language": device_lang,
        }

    def avatar_presign(self, user: User, content_type: str) -> dict:
        """创建头像直传预签名；OSS 未配置或类型非法时抛业务错误。"""
        from common.constants import CODE_VALIDATION_ERROR
        from third_api.oss import create_avatar_presign, oss_configured

        if not oss_configured():
            raise AppError(CODE_VALIDATION_ERROR, "auth.oss_not_configured")
        try:
            return create_avatar_presign(user.id, content_type)
        except ValueError:
            raise AppError(CODE_VALIDATION_ERROR, "auth.avatar_invalid")
        except Exception:
            logger.exception("avatar presign failed user_id=%s", user.id)
            raise AppError(CODE_VALIDATION_ERROR, "auth.oss_not_configured")
