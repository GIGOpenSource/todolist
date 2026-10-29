"""通知规则与 campaign Schema。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class NotificationRulesUpdate(BaseModel):
    """Partial rules patch. Prefer nested `rules` object; top-level keys also accepted."""

    rules: Optional[Dict[str, Any]] = Field(
        None, description="Partial rules JSON merged onto current config"
    )
    enabled: Optional[bool] = None


class NotificationCampaignCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field("", max_length=4000)
    channel: str = Field("system", description="system | promo")
    status: str = Field("draft", description="draft|scheduled|active|ended|cancelled")
    platforms: str = Field("all", max_length=128, description="all 或 ios,android,web,pc")
    start_at: Optional[str] = Field(None, description="ISO datetime")
    end_at: Optional[str] = Field(None, description="ISO datetime")
    bypass_quiet: bool = Field(False, description="仅 system 渠道可穿透静默")
    remark: str = Field("", max_length=255)


class NotificationCampaignUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    body: Optional[str] = Field(None, max_length=4000)
    channel: Optional[str] = None
    status: Optional[str] = None
    platforms: Optional[str] = Field(None, max_length=128)
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    bypass_quiet: Optional[bool] = None
    remark: Optional[str] = Field(None, max_length=255)


class NotificationReadRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=200, description="已读 campaign id 列表")
