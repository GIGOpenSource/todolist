"""管理端入出参 Schema。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class LlmModelCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, description="配置显示名")
    base_url: str = Field("https://api.openai.com/v1", max_length=512, description="API Base URL")
    api_key: str = Field("", description="API Key")
    model: str = Field("gpt-4o-mini", max_length=128, description="模型 ID")
    enabled: bool = Field(True, description="是否启用")
    is_default: bool = Field(False, description="是否设为默认")
    remark: str = Field("", max_length=255, description="备注")


class LlmModelUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=64)
    base_url: Optional[str] = Field(None, max_length=512)
    api_key: Optional[str] = Field(None, description="不传则不改；空串清空")
    model: Optional[str] = Field(None, max_length=128)
    enabled: Optional[bool] = None
    is_default: Optional[bool] = None
    remark: Optional[str] = Field(None, max_length=255)


class AdminCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="登录用户名")
    password: str = Field(..., min_length=6, max_length=128, description="密码")
    nickname: str = Field("", max_length=64, description="昵称")
    permissions: List[str] = Field(
        default_factory=lambda: [
            "stats",
            "users",
            "todos",
            "notes",
            "llm",
            "site",
            "notifications",
        ],
        description="权限列表，或 ['*'] 表示全部",
    )


class AdminUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=64)
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="新密码；不传则不改")
    permissions: Optional[List[str]] = Field(None, description="权限列表；不传则不改")


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    nickname: str = Field("", max_length=64)
    gender: str = Field("", max_length=16, description="male|female|other|空")
    avatar: str = Field("", description="头像 URL 或 data URL")
    register_region: str = Field("", max_length=64)
    register_platform: str = Field("", max_length=32, description="ios|android|web|pc|unknown")
    device_language: str = Field("", max_length=32, description="初次登录设备语言")
    register_method: str = Field("password", max_length=32, description="password|apple|google")


class AdminUserUpdateRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=64)
    gender: Optional[str] = Field(None, max_length=16)
    avatar: Optional[str] = None
    register_region: Optional[str] = Field(None, max_length=64)
    register_platform: Optional[str] = Field(None, max_length=32)
    device_language: Optional[str] = Field(None, max_length=32)
    register_method: Optional[str] = Field(None, max_length=32)
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="重置密码；不传则不改")


class AdminTodoUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=2000)
    detail: Optional[str] = Field(None, max_length=10000)
    completed: Optional[bool] = None
    due_at: Optional[float] = Field(None, description="截止时间戳（毫秒）；0 表示清空")


class AdminNoteUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=2000)
    content: Optional[str] = Field(None, max_length=100000)
