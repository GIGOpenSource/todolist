"""汇报路由：创建汇报资源与异步 job 轮询。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from common.deps import get_current_user, get_lang
from common.i18n import t
from common.logger import get_logger
from common.rate_limit import rate_limit, user_rate_key
from common.response import resp_success
from core.database import get_db
from models.user import User
from schemas.report import ReportGenerateRequest
from service.report_job_service import ReportJobService
from service.report_service import ReportService
from settings.config import get_settings

logger = get_logger("api.report")
router = APIRouter(prefix="/reports", tags=["汇报"])


@router.post(
    "",
    summary="创建周期性汇报",
    description=(
        "创建一份周期汇报资源；`async=1` 且 LLM 已配置时改为入队 job。"
        "未开 LLM 时始终同步返回模板。需 Bearer Token。\n\n"
        "**入参**\n"
        "- start_at / end_at: 周期起止（epoch ms）\n"
        "- todos: 本地任务快照（可空；与云端按 id LWW 合并）\n"
        "- locale / nickname / streak_days\n"
        "- Query async: 0|1，是否尝试异步入队\n\n"
        "**出参 result**（同步）\n"
        "- content / source（ai|template）/ task_count / completed_count / pending_count\n\n"
        "**出参 result**（异步入队）\n"
        "- job_id / status / content / source / task_count / completed_count / pending_count / error"
    ),
)
async def create_report(
    body: ReportGenerateRequest,
    request: Request,
    async_mode: int = Query(0, alias="async", ge=0, le=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建汇报，或按请求创建异步任务。"""

    lang = get_lang(request)
    settings = get_settings()
    rate_limit(
        user_rate_key("report", user.id, request),
        settings.rate_limit_report_per_minute,
    )

    job = ReportJobService(db).enqueue_if_async(user, body, async_mode=bool(async_mode))
    if job is not None:
        return resp_success(
            result=job.model_dump(),
            message=t("report.job.queued", lang=lang),
        )

    result, msg_key = await ReportService(db).generate_async(user, body)
    logger.info(
        "report create user_id=%s tasks=%s source=%s",
        user.id,
        result.task_count,
        result.source,
    )
    return resp_success(result=result.model_dump(), message=t(msg_key, lang=lang))


@router.post(
    "/jobs",
    summary="创建异步汇报任务",
    description=(
        "创建汇报异步 job 资源，返回 job_id；用 GET /jobs/{id} 轮询。需 Bearer Token。\n\n"
        "**入参**\n"
        "- start_at / end_at: 周期起止（epoch ms）\n"
        "- todos / locale / nickname / streak_days\n\n"
        "**出参 result**\n"
        "- job_id / status（queued）/ content / source\n"
        "- task_count / completed_count / pending_count / error"
    ),
)
def create_job(
    body: ReportGenerateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建异步周期汇报任务。"""

    lang = get_lang(request)
    settings = get_settings()
    rate_limit(
        user_rate_key("report", user.id, request),
        settings.rate_limit_report_per_minute,
    )
    job = ReportJobService(db).enqueue(user, body)
    return resp_success(result=job.model_dump(), message=t("report.job.queued", lang=lang))


@router.get(
    "/jobs/{job_id}",
    summary="查询汇报任务状态",
    description=(
        "查询当前用户的汇报异步任务。需 Bearer Token。\n\n"
        "**入参**\n"
        "- job_id: 路径参数\n\n"
        "**出参 result**\n"
        "- job_id / status（queued|running|done|failed）\n"
        "- content / source / task_count / completed_count / pending_count / error"
    ),
)
def get_job(
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询当前用户的汇报任务状态。"""

    lang = get_lang(request)
    job = ReportJobService(db).get(user, job_id)
    return resp_success(result=job.model_dump(), message=t("ok", lang=lang))
