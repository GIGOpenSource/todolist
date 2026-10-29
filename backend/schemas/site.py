"""官网配置 Schema。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SiteDownloadItem(BaseModel):
    id: Optional[str] = None
    url: str = ""
    ready: bool = False


class SiteShotItem(BaseModel):
    src: str = Field(..., min_length=1)
    key: int = 0


class SiteConfigUpdateRequest(BaseModel):
    brand: Optional[str] = Field(None, max_length=64)
    contactEmail: Optional[str] = Field(None, max_length=120)
    loginUrl: Optional[str] = Field(None, max_length=512)
    downloads: Optional[Dict[str, SiteDownloadItem]] = None
    shots: Optional[List[SiteShotItem]] = None
    i18n: Optional[Dict[str, Any]] = None
