"""认证相关入出参 Schema。"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="登录用户名，3-64 字符")
    password: str = Field(..., min_length=6, max_length=128, description="密码，至少 6 位")


class LoginRequest(BaseModel):
    username: str = Field(..., description="登录用户名")
    password: str = Field(..., description="密码")


class RestoreAccountRequest(BaseModel):
    username: str = Field(..., description="登录用户名")
    password: str = Field(..., description="密码")


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., description="登录/注册返回的 refresh_token")


class TokenResult(BaseModel):
    access_token: str = Field(..., description="JWT Bearer Token")
    refresh_token: str = Field("", description="用于续期的 refresh_token（可选使用）")
    token_type: str = Field("bearer", description="固定 bearer")
    user_id: int = Field(..., description="用户数字 ID；客户端待办 ID 前缀 u{user_id}_")
    username: str = Field(..., description="登录用户名")
    nickname: str = Field("", description="昵称（展示用，可为空）")
    avatar: str = Field("", description="头像（data URL 或空）")
    signature: str = Field("", description="个性签名")
    gender: str = Field("", description="性别：male / female / other / 空")
    role: str = Field(..., description="角色：user / admin")
    expires_in: int = Field(0, description="access_token 有效秒数（提示用）")
    permissions: List[str] = Field(
        default_factory=list,
        description="管理员权限列表；* 表示全部。普通用户为空",
    )


class ProfileResult(BaseModel):
    user_id: int = Field(..., description="用户数字 ID")
    username: str = Field(..., description="登录用户名（不可改）")
    nickname: str = Field("", description="昵称")
    avatar: str = Field("", description="头像")
    signature: str = Field("", description="个性签名")
    gender: str = Field("", description="性别")
    role: str = Field(..., description="角色")
    streak_days: int = Field(0, ge=0, description="连续打开应用天数；中断则归零")
    permissions: List[str] = Field(
        default_factory=list,
        description="管理员权限列表；* 表示全部。普通用户为空",
    )
    deleted_at: Optional[datetime] = Field(None, description="软删除时间（UTC），空表示正常")
    purge_at: Optional[datetime] = Field(None, description="预计硬删除时间（UTC）")


class TouchStreakRequest(BaseModel):
    day: Optional[str] = Field(
        None,
        description="客户端本地日期 YYYY-MM-DD；缺省用服务端 UTC 今天",
    )
    days: Optional[List[str]] = Field(
        None,
        description="可选：同步本地打开日列表（最多保留最近 120 天）",
    )


class TouchStreakResult(BaseModel):
    day: str = Field(..., description="本次记入的日期 YYYY-MM-DD")
    streak_days: int = Field(0, ge=0, description="连续打开天数；中断归零")


class DeleteAccountResult(BaseModel):
    deleted_at: datetime = Field(..., description="软删除时间 UTC")
    purge_at: datetime = Field(..., description="若未取消，将于此时间后硬删除")
    grace_days: int = Field(..., description="宽限天数")


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=64, description="昵称，传空串可清空")
    avatar: Optional[str] = Field(None, description="头像 data URL，传空串可清空")
    signature: Optional[str] = Field(None, max_length=120, description="个性签名，最长 120")
    gender: Optional[str] = Field(None, max_length=16, description="male / female / other / 空")


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128, description="当前密码")
    new_password: str = Field(..., min_length=6, max_length=128, description="新密码，至少 6 位")
