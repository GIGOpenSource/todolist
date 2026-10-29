"""异步汇报任务入队与状态查询。"""

from __future__ import annotations

import json
import uuid
from typing import Any, Optional, Tuple

from sqlalchemy.orm import Session

from common.logger import get_logger
from models.report_job import ReportJob
from models.user import User
from schemas.report import ReportGenerateRequest, ReportGenerateResult, ReportJobResult
from service.report_service import ReportService
from settings.config import get_settings
from utils.time_util import utc_now

logger = get_logger("service.report_jobs")


class ReportJobService:
    def __init__(self, db: Session):
        self.db = db

    def enqueue(self, user: User, req: ReportGenerateRequest) -> ReportJobResult:
        from service.login_day import compute_streak_days, record_login_day

        record_login_day(self.db, user.id)
        streak = compute_streak_days(self.db, user.id)
        job_id = uuid.uuid4().hex
        row = ReportJob(
            id=job_id,
            user_id=user.id,
            status="queued",
            locale=(req.locale or "en")[:16],
            nickname=(req.nickname or "")[:64],
            streak_days=streak,
            start_at=float(req.start_at),
            end_at=float(req.end_at),
            request_json=json.dumps([t.model_dump() for t in (req.todos or [])]),
        )
        self.db.add(row)
        self.db.commit()

        from common.redis_client import get_redis

        settings = get_settings()
        get_redis().lpush(settings.report_queue_key, job_id)
        logger.info("report job enqueued id=%s user_id=%s", job_id, user.id)
        return self._to_result(row)

    def get(self, user: User, job_id: str) -> ReportJobResult:
        """返回当前用户的汇报任务；不存在或不属于该用户时抛 not_found。"""
        from common.constants import CODE_NOT_FOUND
        from common.exceptions import AppError

        row = self.db.get(ReportJob, job_id)
        if row is None or row.user_id != user.id:
            raise AppError(CODE_NOT_FOUND, "common.not_found")
        return self._to_result(row)

    def enqueue_if_async(
        self, user: User, req: ReportGenerateRequest, *, async_mode: bool
    ) -> Optional[ReportJobResult]:
        """当 async_mode 且 LLM 已配置时入队，否则返回 None（由调用方走同步生成）。"""
        from third_api.llm import llm_configured

        if not async_mode or not llm_configured():
            return None
        return self.enqueue(user, req)

    def _to_result(self, row: ReportJob) -> ReportJobResult:
        return ReportJobResult(
            job_id=row.id,
            status=row.status,
            content=row.content or "",
            source=row.source or "",
            task_count=row.task_count,
            completed_count=row.completed_count,
            pending_count=row.pending_count,
            error=row.error or "",
        )

    async def process_one(self, job_id: str) -> None:
        row = self.db.get(ReportJob, job_id)
        if row is None:
            return
        if row.status not in ("queued", "running"):
            return
        row.status = "running"
        row.updated_at = utc_now()
        self.db.commit()

        try:
            todos_raw = json.loads(row.request_json or "[]")
            from schemas.report import ReportTodoItem

            todos = [ReportTodoItem(**t) for t in todos_raw]
            req = ReportGenerateRequest(
                start_at=row.start_at,
                end_at=row.end_at,
                todos=todos,
                locale=row.locale,
                nickname=row.nickname,
                streak_days=row.streak_days,
            )
            user = self.db.get(User, row.user_id)
            if user is None:
                raise RuntimeError("user missing")
            result, _ = await ReportService(self.db).generate_async(user, req)
            row.content = result.content
            row.source = result.source
            row.task_count = result.task_count
            row.completed_count = result.completed_count
            row.pending_count = result.pending_count
            row.status = "done"
            row.error = ""
        except Exception as exc:  # noqa: BLE001
            logger.exception("report job failed id=%s", job_id)
            row.status = "failed"
            row.error = str(exc)[:2000]
        row.updated_at = utc_now()
        self.db.commit()
