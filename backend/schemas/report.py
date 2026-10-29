"""汇报生成与 job Schema。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ReportTodoItem(BaseModel):
    id: str = ""
    title: str = ""
    detail: str = ""
    due_at: float = 0
    completed: bool = False
    created_at: float = 0
    updated_at: float = 0


class ReportGenerateRequest(BaseModel):
    start_at: float = Field(..., description="周期开始（epoch ms，含当日 0 点）")
    end_at: float = Field(..., description="周期结束（epoch ms，含当日末）")
    todos: List[ReportTodoItem] = Field(
        default_factory=list,
        description="本地任务快照；可空。服务端会与云端任务按 id LWW 合并后再按周期过滤",
    )
    locale: str = Field("en", description="汇报语言偏好，如 zh / en")
    nickname: str = Field("", description="用户昵称，写入汇报上下文")
    streak_days: int = Field(
        0,
        ge=0,
        description="客户端连续打开天数（仅作参考）；服务端按登录/打开日重算，中断归零",
    )


class ReportGenerateResult(BaseModel):
    content: str = Field(..., description="生成的汇报正文")
    source: str = Field(..., description="ai / template")
    task_count: int = 0
    completed_count: int = 0
    pending_count: int = 0
    job_id: str = Field("", description="异步任务 id（async 模式）")
    status: str = Field("", description="queued|running|done|failed（异步时）")


class ReportJobResult(BaseModel):
    job_id: str
    status: str
    content: str = ""
    source: str = ""
    task_count: int = 0
    completed_count: int = 0
    pending_count: int = 0
    error: str = ""
