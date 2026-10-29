"""管理端列表查询的公共筛选参数依赖。"""

from __future__ import annotations

from fastapi import Query

from common.admin_filters import AdminFilters


def parse_admin_filters(
    platform: str = Query("", description="ios|android|web|pc|unknown"),
    country: str = Query("", description="国家 ISO 代码，如 CN / US"),
    language: str = Query("", description="设备语言，如 zh / en / zh-Hans"),
    dateFrom: str = Query("", description="开始日期 YYYY-MM-DD（北京时间）"),
    dateTo: str = Query("", description="结束日期 YYYY-MM-DD（北京时间）"),
) -> AdminFilters:
    """解析平台、国家、语言与日期范围筛选条件。"""

    return AdminFilters(
        platform=platform,
        country=country,
        language=language,
        date_from=dateFrom or None,
        date_to=dateTo or None,
    )
