"""统一 API 响应信封：所有接口必须经 resp_success / resp_fail 返回。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from common.constants import CODE_SUCCESS


class PageInfo(BaseModel):
    """固定分页元信息；字段不可增删。"""

    pageNum: int = Field(..., description="当前页码，从 1 开始")
    pageSize: int = Field(..., description="每页条数")
    total: int = Field(..., description="总记录数")
    pages: int = Field(..., description="总页数")


def build_page_info(page_num: int, page_size: int, total: int) -> dict[str, int]:
    """根据 pageNum/pageSize/total 计算 pages 并返回 pageInfo 字典。"""
    page_num = max(int(page_num or 1), 1)
    page_size = max(int(page_size or 10), 1)
    total = max(int(total or 0), 0)
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {
        "pageNum": page_num,
        "pageSize": page_size,
        "total": total,
        "pages": pages,
    }


def resp_success(
    result: Any = None,
    message: str = "",
    page_info: Optional[dict[str, int]] = None,
    http_status: int = 200,
) -> JSONResponse:
    """构造统一成功响应，可选附带分页信息。"""
    if result is None:
        result = {}
    body: dict[str, Any] = {
        "code": CODE_SUCCESS,
        "message": message or "ok",
        "result": result,
    }
    if page_info is not None:
        body["pageInfo"] = page_info
    return JSONResponse(status_code=http_status, content=body)


def resp_fail(
    code: int,
    message: str,
    http_status: int = 200,
) -> JSONResponse:
    """构造统一失败响应；定稿要求失败时 result 固定为 null。"""
    return JSONResponse(
        status_code=http_status,
        content={
            "code": code,
            "message": message,
            "result": None,
        },
    )
