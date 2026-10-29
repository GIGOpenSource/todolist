"""管理端路由：用户/统计/任务/LLM/管理员/官网配置。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from common.deps import get_lang, require_admin_perm
from common.deps_filters import parse_admin_filters
from common.admin_filters import AdminFilters
from common.i18n import t
from common.logger import get_logger
from common.permissions import (
    PERM_ADMINS,
    PERM_LLM,
    PERM_NOTES,
    PERM_SITE,
    PERM_STATS,
    PERM_TODOS,
    PERM_USERS,
)
from common.response import build_page_info, resp_success
from core.database import get_db
from models.user import User
from schemas.admin import (
    AdminCreateRequest,
    AdminNoteUpdateRequest,
    AdminTodoUpdateRequest,
    AdminUpdateRequest,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    LlmModelCreateRequest,
    LlmModelUpdateRequest,
)
from schemas.site import SiteConfigUpdateRequest
from service.admin_service import AdminService
from service.site_service import SiteService

logger = get_logger("api.admin")
router = APIRouter(prefix="/admin", tags=["管理端"])


@router.get(
    "/users",
    summary="管理端-分页查询用户",
    description=(
        "管理端分页查询用户（默认普通用户）。需管理员权限 users。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n"
        "- q: 搜索 UID / 用户名 / 昵称\n"
        "- role: user | admin | all（默认 user）\n"
        "- platform / country / language / dateFrom / dateTo: 公共筛选\n\n"
        "**出参 result**：用户对象数组；并携带 pageInfo。\n"
        "- id / username / nickname / avatar / gender / gender_label / role\n"
        "- register_method / register_method_label / register_region\n"
        "- register_platform / register_platform_label / device_language\n"
        "- created_at / deleted_at / has_password"
    ),
)
def list_users(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    q: str = Query("", description="搜索 UID / 用户名 / 昵称"),
    role: str = Query("user", description="user | admin | all"),
    filters: AdminFilters = Depends(parse_admin_filters),
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result, total = AdminService(db, lang=lang).list_users(
        pageNum, pageSize, q=q, role=role, filters=filters
    )
    logger.info("admin list users admin_id=%s total=%s", admin.id, total)
    return resp_success(
        result=result,
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.get(
    "/users/{user_id}",
    summary="管理端-用户详情",
    description=(
        "按用户 ID 查询详情。需管理员权限 users。\n\n"
        "**入参**\n"
        "- user_id: 路径参数，用户 ID\n\n"
        "**出参 result**\n"
        "- id / username / nickname / avatar / gender / gender_label / role\n"
        "- register_method / register_method_label / register_region\n"
        "- register_platform / register_platform_label / device_language\n"
        "- created_at / deleted_at / has_password"
    ),
)
def get_user(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).get_user(user_id)
    return resp_success(result=result, message=t("ok", lang=lang))


@router.post(
    "/users",
    summary="管理端-新建用户",
    description=(
        "管理端创建普通用户账号。需管理员权限 users。\n\n"
        "**入参**\n"
        "- username: 登录用户名，3-64 字符\n"
        "- password: 密码，至少 6 位\n"
        "- nickname / gender（male|female|other|空）/ avatar\n"
        "- register_region / register_platform（ios|android|web|pc|unknown）\n"
        "- device_language / register_method（password|apple|google）\n\n"
        "**出参 result**：同用户详情公开字段"
    ),
)
def create_user(
    body: AdminUserCreateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).create_user(body)
    logger.info("admin create user actor=%s new_id=%s", admin.id, result.get("id"))
    return resp_success(result=result, message=t("admin.user.created", lang=lang))


@router.put(
    "/users/{user_id}",
    summary="管理端-更新用户",
    description=(
        "更新普通用户资料；不可改管理员账号。需管理员权限 users。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- user_id: 路径参数\n"
        "- nickname / gender / avatar / register_region / register_platform\n"
        "- device_language / register_method\n"
        "- password: 重置密码（至少 6 位）；传入则吊销该用户全部会话\n\n"
        "**出参 result**：同用户详情公开字段"
    ),
)
def update_user(
    user_id: int,
    body: AdminUserUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).update_user(user_id, body)
    logger.info("admin update user actor=%s target=%s", admin.id, user_id)
    return resp_success(result=result, message=t("admin.user.updated", lang=lang))


@router.delete(
    "/users/{user_id}",
    summary="管理端-删除用户",
    description=(
        "默认软删除普通用户并吊销会话；`purge=1` 时永久删除不可恢复。"
        "管理员账号不可软/硬删走此接口。需管理员权限 users。\n\n"
        "**入参**\n"
        "- user_id: 路径参数\n"
        "- purge: Query 0|1，默认 0（软删）\n\n"
        "**出参 result**：软删时为用户公开字段；硬删时为空对象 {}"
    ),
)
def delete_user(
    user_id: int,
    request: Request,
    purge: int = Query(0, ge=0, le=1, description="1=永久删除"),
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    if purge:
        AdminService(db, lang=lang).hard_delete_user(user_id)
        logger.info("admin hard-delete user actor=%s target=%s", admin.id, user_id)
        return resp_success(result={}, message=t("admin.user.hard_deleted", lang=lang))
    result = AdminService(db, lang=lang).soft_delete_user(user_id)
    logger.info("admin soft-delete user actor=%s target=%s", admin.id, user_id)
    return resp_success(result=result, message=t("admin.user.deleted", lang=lang))


@router.delete(
    "/users/{user_id}/deletion",
    summary="管理端-撤销用户软删除",
    description=(
        "删除「软删除」状态（恢复普通用户）。需管理员权限 users。\n\n"
        "**入参**\n"
        "- user_id: 路径参数\n\n"
        "**出参 result**：同用户详情公开字段（deleted_at 为空）"
    ),
)
def undelete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_USERS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).restore_user(user_id)
    logger.info("admin restore user actor=%s target=%s", admin.id, user_id)
    return resp_success(result=result, message=t("admin.user.restored", lang=lang))


@router.get(
    "/stats",
    summary="管理端-数据统计",
    description=(
        "返回运营/产品/工程指标与趋势。需管理员权限 stats。\n\n"
        "**入参**（Query 筛选）\n"
        "- platform / country / language / dateFrom / dateTo\n\n"
        "**出参 result**\n"
        "- date / timezone / generated_at / filters\n"
        "- new_users / dau / reports / site_visits / todos_created / todos_completed（今日/累计）\n"
        "- overview / ops / product / eng / trends / retention"
    ),
)
def get_stats(
    request: Request,
    filters: AdminFilters = Depends(parse_admin_filters),
    admin: User = Depends(require_admin_perm(PERM_STATS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).get_stats(filters=filters)
    logger.info("admin stats admin_id=%s", admin.id)
    return resp_success(result=result, message=t("ok", lang=lang))


@router.get(
    "/todos",
    summary="管理端-任务列表",
    description=(
        "分页查询全站任务。需管理员权限 todos。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n"
        "- q: 搜索标题或 UID\n"
        "- platform / country / language / dateFrom / dateTo: 公共筛选\n\n"
        "**出参 result**：任务对象数组；并携带 pageInfo。\n"
        "- id / title / detail / due_at / user_id / nickname\n"
        "- register_platform / register_platform_label / register_region\n"
        "- completed / created_at / updated_at"
    ),
)
def list_todos(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    q: str = Query("", description="搜索标题或 UID"),
    filters: AdminFilters = Depends(parse_admin_filters),
    admin: User = Depends(require_admin_perm(PERM_TODOS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result, total = AdminService(db, lang=lang).list_todos(pageNum, pageSize, q, filters=filters)
    logger.info("admin list todos admin_id=%s total=%s", admin.id, total)
    return resp_success(
        result=result,
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.put(
    "/todos/{todo_id}",
    summary="管理端-编辑任务",
    description=(
        "编辑指定任务；会 bump 所属用户 sync 时间戳。需管理员权限 todos。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- todo_id: 路径参数\n"
        "- title / detail / completed\n"
        "- due_at: 截止时间戳（毫秒）；0 表示清空\n\n"
        "**出参 result**\n"
        "- id / title / detail / due_at / user_id / nickname\n"
        "- register_platform / register_platform_label / register_region\n"
        "- completed / created_at / updated_at"
    ),
)
def update_todo(
    todo_id: str,
    body: AdminTodoUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_TODOS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).update_todo(todo_id, body)
    logger.info("admin update todo actor=%s todo_id=%s", admin.id, todo_id)
    return resp_success(result=result, message=t("admin.todo.updated", lang=lang))


@router.delete(
    "/todos/{todo_id}",
    summary="管理端-删除任务",
    description=(
        "删除指定任务并 bump 所属用户 sync 时间戳。需管理员权限 todos。\n\n"
        "**入参**\n"
        "- todo_id: 路径参数\n\n"
        "**出参 result**：空对象 {}"
    ),
)
def delete_todo(
    todo_id: str,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_TODOS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    AdminService(db, lang=lang).delete_todo(todo_id)
    logger.info("admin delete todo actor=%s todo_id=%s", admin.id, todo_id)
    return resp_success(result={}, message=t("admin.todo.deleted", lang=lang))


@router.get(
    "/notes",
    summary="管理端-笔记列表",
    description=(
        "分页查询全站笔记。需管理员权限 notes。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n"
        "- q: 搜索标题、正文或 UID\n"
        "- platform / country / language / dateFrom / dateTo: 公共筛选\n\n"
        "**出参 result**：笔记对象数组；并携带 pageInfo。\n"
        "- id / title / content / user_id / nickname\n"
        "- register_platform / register_platform_label / register_region\n"
        "- created_at / updated_at"
    ),
)
def list_notes(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    q: str = Query("", description="搜索标题、正文或 UID"),
    filters: AdminFilters = Depends(parse_admin_filters),
    admin: User = Depends(require_admin_perm(PERM_NOTES)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result, total = AdminService(db, lang=lang).list_notes(pageNum, pageSize, q, filters=filters)
    logger.info("admin list notes admin_id=%s total=%s", admin.id, total)
    return resp_success(
        result=result,
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.put(
    "/notes/{note_id}",
    summary="管理端-编辑笔记",
    description=(
        "编辑指定笔记；会 bump 所属用户 notes sync 时间戳。需管理员权限 notes。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- note_id: 路径参数\n"
        "- title / content\n\n"
        "**出参 result**\n"
        "- id / title / content / user_id / nickname\n"
        "- register_platform / register_platform_label / register_region\n"
        "- created_at / updated_at"
    ),
)
def update_note(
    note_id: str,
    body: AdminNoteUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTES)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).update_note(note_id, body)
    logger.info("admin update note actor=%s note_id=%s", admin.id, note_id)
    return resp_success(result=result, message=t("admin.note.updated", lang=lang))


@router.delete(
    "/notes/{note_id}",
    summary="管理端-删除笔记",
    description=(
        "删除指定笔记并 bump 所属用户 notes sync 时间戳。需管理员权限 notes。\n\n"
        "**入参**\n"
        "- note_id: 路径参数\n\n"
        "**出参 result**：空对象 {}"
    ),
)
def delete_note(
    note_id: str,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTES)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    AdminService(db, lang=lang).delete_note(note_id)
    logger.info("admin delete note actor=%s note_id=%s", admin.id, note_id)
    return resp_success(result={}, message=t("admin.note.deleted", lang=lang))


@router.get(
    "/llm-models",
    summary="管理端-LLM 模型列表",
    description=(
        "返回全部 LLM 模型配置（API Key 脱敏）。需管理员权限 llm。\n\n"
        "**出参 result**：模型对象数组\n"
        "- id / name / base_url / api_key_masked / has_api_key / model\n"
        "- enabled / is_default / remark / created_at / updated_at"
    ),
)
def list_llm_models(
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_LLM)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).list_llm_models()
    return resp_success(result=result, message=t("ok", lang=lang))


@router.post(
    "/llm-models",
    summary="管理端-新建 LLM 模型",
    description=(
        "新建 LLM 模型配置。需管理员权限 llm。\n\n"
        "**入参**\n"
        "- name: 配置显示名\n"
        "- base_url / api_key / model\n"
        "- enabled / is_default / remark\n\n"
        "**出参 result**：同 LLM 模型公开字段（含 api_key_masked）"
    ),
)
def create_llm_model(
    body: LlmModelCreateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_LLM)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).create_llm_model(body)
    logger.info("admin create llm model admin_id=%s id=%s", admin.id, result.get("id"))
    return resp_success(result=result, message=t("admin.llm.created", lang=lang))


@router.put(
    "/llm-models/{model_id}",
    summary="管理端-更新 LLM 模型",
    description=(
        "更新指定 LLM 模型配置。需管理员权限 llm。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- model_id: 路径参数\n"
        "- name / base_url / api_key（不传则不改；空串清空）/ model\n"
        "- enabled / is_default / remark\n\n"
        "**出参 result**：同 LLM 模型公开字段"
    ),
)
def update_llm_model(
    model_id: int,
    body: LlmModelUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_LLM)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).update_llm_model(model_id, body)
    logger.info("admin update llm model admin_id=%s id=%s", admin.id, model_id)
    return resp_success(result=result, message=t("admin.llm.updated", lang=lang))


@router.delete(
    "/llm-models/{model_id}",
    summary="管理端-删除 LLM 模型",
    description=(
        "删除指定 LLM 模型配置。需管理员权限 llm。\n\n"
        "**入参**\n"
        "- model_id: 路径参数\n\n"
        "**出参 result**：空对象 {}"
    ),
)
def delete_llm_model(
    model_id: int,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_LLM)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    AdminService(db, lang=lang).delete_llm_model(model_id)
    logger.info("admin delete llm model admin_id=%s id=%s", admin.id, model_id)
    return resp_success(result={}, message=t("admin.llm.deleted", lang=lang))


@router.get(
    "/permissions",
    summary="管理端-权限目录",
    description=(
        "返回可分配权限列表。需管理员权限 admins。\n\n"
        "**出参 result**：权限对象数组\n"
        "- key / label / route / label_key"
    ),
)
def list_permissions(
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_ADMINS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).list_permission_catalog()
    return resp_success(result=result, message=t("ok", lang=lang))


@router.get(
    "/admins",
    summary="管理端-管理员列表",
    description=(
        "分页查询管理员账号。需管理员权限 admins。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n\n"
        "**出参 result**：管理员对象数组；并携带 pageInfo。\n"
        "- id / username / nickname / role / permissions / permission_labels / created_at"
    ),
)
def list_admins(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),
    admin: User = Depends(require_admin_perm(PERM_ADMINS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result, total = AdminService(db, lang=lang).list_admins(pageNum, pageSize)
    return resp_success(
        result=result,
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.post(
    "/admins",
    summary="管理端-新建管理员",
    description=(
        "创建管理员账号并分配权限。需管理员权限 admins。\n\n"
        "**入参**\n"
        "- username: 登录用户名，3-64 字符\n"
        "- password: 密码，至少 6 位\n"
        "- nickname: 可选昵称\n"
        "- permissions: 权限列表，或 ['*'] 表示全部\n\n"
        "**出参 result**\n"
        "- id / username / nickname / role / permissions / permission_labels / created_at"
    ),
)
def create_admin(
    body: AdminCreateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_ADMINS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).create_admin(body)
    logger.info("admin create admin actor=%s new_id=%s", admin.id, result.get("id"))
    return resp_success(result=result, message=t("admin.account.created", lang=lang))


@router.put(
    "/admins/{admin_id}",
    summary="管理端-更新管理员",
    description=(
        "更新管理员昵称/密码/权限。需管理员权限 admins。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- admin_id: 路径参数\n"
        "- nickname / password（至少 6 位）/ permissions\n\n"
        "**出参 result**\n"
        "- id / username / nickname / role / permissions / permission_labels / created_at"
    ),
)
def update_admin(
    admin_id: int,
    body: AdminUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_ADMINS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = AdminService(db, lang=lang).update_admin(admin_id, body, actor_id=admin.id)
    logger.info("admin update admin actor=%s target=%s", admin.id, admin_id)
    return resp_success(result=result, message=t("admin.account.updated", lang=lang))


@router.delete(
    "/admins/{admin_id}",
    summary="管理端-删除管理员",
    description=(
        "删除管理员账号（不可删自己或最后一个管理员）。需管理员权限 admins。\n\n"
        "**入参**\n"
        "- admin_id: 路径参数\n\n"
        "**出参 result**：空对象 {}"
    ),
)
def delete_admin(
    admin_id: int,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_ADMINS)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    AdminService(db, lang=lang).delete_admin(admin_id, actor_id=admin.id)
    logger.info("admin delete admin actor=%s target=%s", admin.id, admin_id)
    return resp_success(result={}, message=t("admin.account.deleted", lang=lang))


@router.get(
    "/site-config",
    summary="管理端-官网配置",
    description=(
        "读取官网 CMS 配置。需管理员权限 site。\n\n"
        "**出参 result**\n"
        "- brand / contactEmail / loginUrl\n"
        "- downloads（各端 url / ready）/ shots / i18n / updated_at"
    ),
)
def get_admin_site_config(
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_SITE)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = SiteService(db).get_config()
    return resp_success(result=result, message=t("ok", lang=lang))


@router.put(
    "/site-config",
    summary="管理端-更新官网配置",
    description=(
        "部分更新官网 CMS 配置。需管理员权限 site。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- brand / contactEmail / loginUrl\n"
        "- downloads / shots / i18n\n\n"
        "**出参 result**：同官网配置完整字段（含 updated_at）"
    ),
)
def update_admin_site_config(
    body: SiteConfigUpdateRequest,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_SITE)),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    payload = body.model_dump(exclude_unset=True)
    # Convert nested pydantic models
    if "downloads" in payload and payload["downloads"] is not None:
        payload["downloads"] = {
            k: (v if isinstance(v, dict) else v.model_dump() if hasattr(v, "model_dump") else v)
            for k, v in payload["downloads"].items()
        }
    if "shots" in payload and payload["shots"] is not None:
        payload["shots"] = [
            s if isinstance(s, dict) else s.model_dump() if hasattr(s, "model_dump") else s
            for s in payload["shots"]
        ]
    result = SiteService(db).update_config(payload)
    logger.info("admin update site config actor=%s", admin.id)
    return resp_success(result=result, message=t("admin.site.updated", lang=lang))
