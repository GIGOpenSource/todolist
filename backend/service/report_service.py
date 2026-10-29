"""周期汇报生成：本地快照 ∪ 云端，LLM 或模板。"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from common.logger import get_logger
from models.todo import Todo
from models.user import User
from schemas.report import ReportGenerateRequest, ReportGenerateResult, ReportTodoItem
from third_api.llm import chat_completion_async, llm_configured

logger = get_logger("service.report")


def _in_range(ts: float, start: float, end: float) -> bool:
    if not ts:
        return False
    return start <= float(ts) <= end


def filter_todos_in_period(todos: List[ReportTodoItem], start: float, end: float) -> List[ReportTodoItem]:
    """任务在周期内创建、更新、完成或截止，均纳入汇报素材。"""
    out: List[ReportTodoItem] = []
    for item in todos:
        if (
            _in_range(item.created_at, start, end)
            or _in_range(item.updated_at, start, end)
            or _in_range(item.due_at, start, end)
            or (item.completed and _in_range(item.updated_at, start, end))
        ):
            out.append(item)
    return out


def _fmt_ts(ts: float, locale: str) -> str:
    if not ts:
        return "-"
    try:
        dt = datetime.fromtimestamp(float(ts) / 1000.0, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except Exception:  # noqa: BLE001
        return str(ts)


def _esc(text: str) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _lang(locale: str) -> str:
    code = (locale or "en").lower()[:2]
    return code if code in ("zh", "en", "ko") else "en"


def _build_task_lines(todos: List[ReportTodoItem], locale: str) -> str:
    from common.i18n import t

    lang = _lang(locale)
    lines = []
    for i, item in enumerate(todos, 1):
        status = t("report.status.done", lang=lang) if item.completed else t("report.status.open", lang=lang)
        detail = (item.detail or "").strip()
        due = _fmt_ts(item.due_at, locale) if item.due_at else "-"
        lines.append(
            f"{i}. [{status}] {item.title}\n"
            f"   detail: {detail or '-'}\n"
            f"   due: {due}\n"
            f"   created: {_fmt_ts(item.created_at, locale)} | updated: {_fmt_ts(item.updated_at, locale)}"
        )
    return "\n".join(lines) if lines else t("report.tasks.empty", lang=lang)


def _strip_code_fence(text: str) -> str:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:html|HTML)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def build_template_report(
    *,
    start: float,
    end: float,
    todos: List[ReportTodoItem],
    locale: str,
    nickname: str = "",
    streak_days: int = 0,
) -> str:
    """按任务统计生成本地 HTML 周期汇报。"""
    from common.i18n import t

    lang = _lang(locale)
    completed = [item for item in todos if item.completed]
    pending = [item for item in todos if not item.completed]
    start_s = _fmt_ts(start, locale)
    end_s = _fmt_ts(end, locale)
    rate = round(len(completed) / len(todos) * 100) if todos else 0
    name = _esc(nickname) if nickname else ""

    parts = [
        f"<h2>{t('report.tpl.title', lang=lang)}</h2>",
        f"<p class='period'><strong>{t('report.tpl.period', lang=lang)}</strong>"
        f"{t('report.tpl.colon', lang=lang)}{start_s} — {end_s}</p>",
    ]
    if name or streak_days:
        meta = []
        if name:
            meta.append(t("report.tpl.author", lang=lang, name=name))
        if streak_days:
            meta.append(t("report.tpl.streak", lang=lang, days=int(streak_days)))
        parts.append(f"<p class='meta'>{' · '.join(meta)}</p>")
    parts.append(
        t(
            "report.tpl.overview",
            lang=lang,
            total=len(todos),
            done=len(completed),
            open=len(pending),
            rate=rate,
        )
    )
    parts.append(f"<h3>{t('report.tpl.section.done', lang=lang)}</h3><ul>")
    if completed:
        for item in completed:
            line = _esc(item.title)
            if item.detail:
                line += f"{t('report.tpl.detail_sep', lang=lang)}{_esc(item.detail.strip())}"
            parts.append(f"<li>{line}</li>")
    else:
        parts.append(f"<li>{t('report.tpl.none_done', lang=lang)}</li>")
    parts.append(f"</ul><h3>{t('report.tpl.section.open', lang=lang)}</h3><ul>")
    if pending:
        for item in pending:
            line = _esc(item.title)
            if item.detail:
                line += f"{t('report.tpl.detail_sep', lang=lang)}{_esc(item.detail.strip())}"
            if item.due_at:
                line += t(
                    "report.tpl.due_suffix",
                    lang=lang,
                    due=_esc(_fmt_ts(item.due_at, locale)),
                )
            parts.append(f"<li>{line}</li>")
    else:
        parts.append(f"<li>{t('report.tpl.none_open', lang=lang)}</li>")
    parts += [
        f"</ul><h3>{t('report.tpl.section.summary', lang=lang)}</h3><ul>",
        f"<li>{t('report.tpl.summary_rate', lang=lang, total=len(todos), rate=rate)}</li>",
        f"<li>{t('report.tpl.summary_advice', lang=lang)}</li>",
        "</ul>",
        f"<p class='footnote'>{t('report.tpl.footnote', lang=lang)}</p>",
    ]
    return "".join(parts)


class ReportService:
    """合并本地与云端待办并生成周期汇报。"""

    def __init__(self, db: Session):
        self.db = db

    def _cloud_items(self, user: User) -> List[ReportTodoItem]:
        rows = self.db.query(Todo).filter(Todo.user_id == user.id).all()
        return [
            ReportTodoItem(
                id=t.id,
                title=t.title or "",
                detail=getattr(t, "detail", None) or "",
                due_at=float(getattr(t, "due_at", None) or 0),
                completed=bool(t.completed),
                created_at=float(t.created_at or 0),
                updated_at=float(t.updated_at or 0),
            )
            for t in rows
        ]

    @staticmethod
    def _merge_items(client: List[ReportTodoItem], cloud: List[ReportTodoItem]) -> List[ReportTodoItem]:
        """Union by id; newer updated_at wins (item-level LWW)."""
        merged: Dict[str, ReportTodoItem] = {}
        for item in cloud + client:
            key = (item.id or "").strip() or f"_anon_{id(item)}"
            prev = merged.get(key)
            if prev is None or float(item.updated_at or 0) >= float(prev.updated_at or 0):
                merged[key] = item
        return list(merged.values())

    def generate(self, user: User, req: ReportGenerateRequest) -> Tuple[ReportGenerateResult, str]:
        """同步生成周期汇报。"""

        import asyncio

        return asyncio.run(self.generate_async(user, req))

    async def generate_async(self, user: User, req: ReportGenerateRequest) -> Tuple[ReportGenerateResult, str]:
        """优先调用 LLM，失败或未配置时回退本地模板。"""

        start = float(req.start_at)
        end = float(req.end_at)
        if end < start:
            start, end = end, start

        cloud = self._cloud_items(user)
        merged = self._merge_items(req.todos or [], cloud)
        scoped = filter_todos_in_period(merged, start, end)

        completed_n = sum(1 for t in scoped if t.completed)
        pending_n = len(scoped) - completed_n
        locale = (req.locale or "en").lower()
        nickname = (req.nickname or "").strip() or (getattr(user, "nickname", None) or "").strip()
        from service.login_day import compute_streak_days, record_login_day

        record_login_day(self.db, user.id)
        # Consecutive open days only; a missed day resets. Server is source of truth.
        streak_days = compute_streak_days(self.db, user.id)
        task_block = _build_task_lines(scoped, locale)
        period = f"{_fmt_ts(start, locale)} — {_fmt_ts(end, locale)}"
        lang = _lang(locale)
        from common.i18n import t

        system = t("report.llm.system", lang=lang)
        profile_line = ""
        if nickname or streak_days:
            bits = []
            if nickname:
                bits.append(t("report.llm.nickname", lang=lang, name=nickname))
            if streak_days:
                bits.append(t("report.llm.streak", lang=lang, days=streak_days))
            profile_line = t("report.llm.profile_suffix", lang=lang, bits=t("report.llm.bit_join", lang=lang).join(bits))

        user_prompt = t(
            "report.llm.user",
            lang=lang,
            profile=profile_line,
            period=period,
            total=len(scoped),
            done=completed_n,
            open=pending_n,
            tasks=task_block,
        )

        content = None
        source = "template"
        if llm_configured():
            content = await chat_completion_async(system=system, user=user_prompt)
            if content:
                content = _strip_code_fence(content)
                source = "ai"
                logger.info(
                    "report generated via llm user_id=%s scoped=%s cloud=%s client=%s",
                    user.id,
                    len(scoped),
                    len(cloud),
                    len(req.todos or []),
                )
            else:
                logger.warning("llm failed, falling back to template")

        if not content:
            content = build_template_report(
                start=start,
                end=end,
                todos=scoped,
                locale=locale,
                nickname=nickname,
                streak_days=streak_days,
            )
            source = "template"
            logger.info(
                "report generated via template user_id=%s scoped=%s cloud=%s client=%s",
                user.id,
                len(scoped),
                len(cloud),
                len(req.todos or []),
            )

        result = ReportGenerateResult(
            content=content,
            source=source,
            task_count=len(scoped),
            completed_count=completed_n,
            pending_count=pending_n,
        )
        return result, "report.generate.success"


def generate_report(req: ReportGenerateRequest, user: User, db: Session) -> Tuple[ReportGenerateResult, str]:
    """兼容旧调用方式的同步汇报入口。"""
    return ReportService(db).generate(user, req)
