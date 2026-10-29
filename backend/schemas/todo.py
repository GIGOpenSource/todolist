"""待办与同步入出参 Schema。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ClientSyncHint(BaseModel):
    dirty_only: bool = Field(False, description="客户端提示仅推送脏数据（服务端仅作日志/未来优化）")


class TodoItem(BaseModel):
    id: str = Field(
        ...,
        description="待办唯一 ID。推荐 u{user_id}_{seq}（如 u12_3）；旧客户端随机 ID 仍兼容",
        max_length=64,
    )
    title: str = Field(..., description="待办标题")
    detail: str = Field("", description="待办详情")
    due_at: float = Field(0, description="计划完成时间（本地 epoch 毫秒；0 表示未设置）")
    completed: bool = Field(False, description="是否完成")
    is_deleted: bool = Field(
        False,
        description="软删除标记；同步时按 updated_at LWW，为 true 时其它端应丢弃本地缓存",
    )
    created_at: float = Field(..., description="创建时间（UTC epoch 毫秒/秒，与客户端一致）")
    updated_at: float = Field(..., description="更新时间（UTC epoch）；越大越新，用于 LWW")


class SyncRequest(BaseModel):
    todos: List[TodoItem] = Field(default_factory=list, description="本地待办清单（可含 is_deleted）")
    list_updated_at: float = Field(0.0, description="本地清单级时间戳，越大越新")
    deleted_ids: List[str] = Field(
        default_factory=list,
        description="兼容旧客户端：等价于将这些 id 标记 is_deleted=true 并刷新 updated_at",
    )
    sync_weeks: int = Field(1, ge=1, le=520, description="同步时间窗：最近 N 周")
    client_hint: Optional[ClientSyncHint] = Field(None, description="可选客户端提示；未知字段忽略")


class SyncResult(BaseModel):
    todos: List[TodoItem] = Field(
        default_factory=list,
        description="本时间窗内应合并的待办（含软删除项，客户端按 is_deleted 清理本地）",
    )
    list_updated_at: float = Field(..., description="最终清单级时间戳")
    source: str = Field(..., description="数据来源：merged / server / client / empty")
    cloud_count: int = Field(0, description="云端未删除任务总数")
    has_more: bool = Field(False, description="云端是否还有更早的任务未纳入本窗")
    sync_weeks: int = Field(0, description="本次实际使用的周数")
