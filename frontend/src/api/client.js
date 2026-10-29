/**
 * 桌面网页端 API 请求封装：统一鉴权、令牌刷新与业务接口。
 */

import { BASE_URL } from '../config.js'
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAuth,
} from '../stores/storage.js'
import { resetTodoCache } from '../stores/todos.js'
import { getAcceptLanguage, getDeviceLanguage, t } from '../i18n/index.js'
import { toast } from '../utils/toast.js'

let onUnauthorized = null
// 复用同一个刷新请求，避免并发 401 触发多次令牌轮换。
let refreshPromise = null

/** 注册未授权响应处理器。 */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function handleUnauthorized(message) {
  clearAuth()
  resetTodoCache()
  toast(message || t('common.relogin'))
  if (typeof onUnauthorized === 'function') {
    onUnauthorized()
    return
  }
  const { default: router } = await import('../router/index.js')
  router.replace({ name: 'login' })
}

async function rawFetch({ url, method = 'GET', data = null, auth = true, timeoutMs = 60000 }) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': getAcceptLanguage(),
    'X-Device-Language': getDeviceLanguage(),
  }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null

  let res
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: data != null ? JSON.stringify(data) : undefined,
      signal: controller?.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(t('common.requestFailed'))
    throw new Error(t('common.networkError'))
  } finally {
    if (timer) clearTimeout(timer)
  }

  let body = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  return { res, body }
}

function parseBody(res, body) {
  if (typeof body.code === 'number') {
    if (body.code === 200) {
      if (body.result && typeof body.result === 'object' && !Array.isArray(body.result)) {
        return { ...body.result, message: body.message, pageInfo: body.pageInfo }
      }
      return { result: body.result, message: body.message, pageInfo: body.pageInfo }
    }
    throw Object.assign(new Error(body.message || t('common.requestFailed')), {
      code: body.code,
      result: body.result,
      httpStatus: res.status,
    })
  }
  if (res.status === 401) {
    throw Object.assign(new Error(t('common.unauthorized')), { code: 40102 })
  }
  if (res.status >= 200 && res.status < 300) return body
  throw new Error(body.message || body.detail || t('common.requestFailed'))
}

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return false
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { res, body } = await rawFetch({
          url: '/api/auth/tokens',
          method: 'POST',
          data: { refresh_token: refresh },
          auth: false,
          timeoutMs: 15000,
        })
        const parsed = parseBody(res, body)
        if (!parsed.access_token) return false
        setToken(parsed.access_token)
        if (parsed.refresh_token) setRefreshToken(parsed.refresh_token)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

async function request({ url, method = 'GET', data = null, auth = true, timeoutMs = 60000, _retried = false }) {
  try {
    const { res, body } = await rawFetch({ url, method, data, auth, timeoutMs })
    return parseBody(res, body)
  } catch (err) {
    const code = err && err.code
    const authFail = code === 40102 || code === 40103 || code === 40104
    if (auth && !_retried && authFail && getRefreshToken()) {
      const ok = await refreshAccessToken()
      if (ok) return request({ url, method, data, auth, timeoutMs, _retried: true })
    }
    if (authFail) await handleUnauthorized(err.message)
    throw err
  }
}

/** 注册新账号。 */
export function register(username, password) {
  return request({
    url: '/api/auth/register',
    method: 'POST',
    data: { username, password },
    auth: false,
  })
}

/** 登录账号。 */
export function login(username, password) {
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data: { username, password },
    auth: false,
  })
}

/** 注销当前会话。 */
export function logout() {
  const refresh = getRefreshToken()
  return request({
    url: '/api/auth/sessions',
    method: 'DELETE',
    data: { refresh_token: refresh || '' },
  }).catch(() => null)
}

/** 获取当前用户资料。 */
export function fetchProfile() {
  return request({ url: '/api/auth/me', method: 'GET' })
}

/** 更新当前用户资料。 */
export function updateProfile(data = {}) {
  const payload = {}
  if (data.nickname !== undefined) payload.nickname = data.nickname || ''
  if (data.avatar !== undefined) payload.avatar = data.avatar || ''
  if (data.signature !== undefined) payload.signature = data.signature || ''
  if (data.gender !== undefined) payload.gender = data.gender || ''
  return request({ url: '/api/auth/profile', method: 'PUT', data: payload })
}

/** 修改当前账号密码。 */
export function changePassword(oldPassword, newPassword) {
  return request({
    url: '/api/auth/password',
    method: 'PUT',
    data: {
      old_password: oldPassword,
      new_password: newPassword,
    },
  })
}

/** 申请删除当前账号。 */
export function deleteAccount() {
  return request({ url: '/api/auth/account', method: 'DELETE' })
}

/** 恢复已删除账号。 */
export function restoreAccount(username, password) {
  return request({
    url: '/api/auth/account',
    method: 'PUT',
    data: { username, password },
    auth: false,
  })
}

/** 同步本地与云端待办。 */
export function syncTodos(todos, listUpdatedAt, { deletedIds = [], syncWeeks = 1, clientHint } = {}) {
  return request({
    url: '/api/todos/sync',
    method: 'PUT',
    data: {
      todos,
      list_updated_at: listUpdatedAt,
      deleted_ids: deletedIds,
      sync_weeks: syncWeeks,
      ...(clientHint ? { client_hint: clientHint } : {}),
    },
  })
}

/** 获取完整的云端待办列表。 */
export function fetchTodos() {
  return request({
    url: '/api/todos',
    method: 'GET',
  })
}

/** 同步本地与云端笔记。 */
export function syncNotes(notes, listUpdatedAt, { deletedIds = [], syncWeeks = 1, clientHint } = {}) {
  return request({
    url: '/api/notes/sync',
    method: 'PUT',
    data: {
      notes,
      list_updated_at: listUpdatedAt,
      deleted_ids: deletedIds,
      sync_weeks: syncWeeks,
      ...(clientHint ? { client_hint: clientHint } : {}),
    },
  })
}

/** 获取完整的云端笔记列表。 */
export function fetchNotes() {
  return request({
    url: '/api/notes',
    method: 'GET',
  })
}

/** 提交活跃日期并获取连续天数。 */
export function touchStreak({ day, days } = {}) {
  const data = {}
  if (day) data.day = day
  if (Array.isArray(days) && days.length) data.days = days
  return request({
    url: '/api/auth/streak',
    method: 'PUT',
    data,
  })
}

/** 提交数据并生成周期报告。 */
export function generateReport({ startAt, endAt, todos, locale, nickname, streakDays, asyncMode = false }) {
  return request({
    url: `/api/reports${asyncMode ? '?async=1' : ''}`,
    method: 'POST',
    data: {
      start_at: startAt,
      end_at: endAt,
      todos,
      locale,
      nickname: nickname || '',
      streak_days: streakDays || 0,
    },
    timeoutMs: asyncMode ? 30000 : 90000,
  })
}

/** 查询异步报告任务。 */
export function fetchReportJob(jobId) {
  return request({
    url: `/api/reports/jobs/${jobId}`,
    method: 'GET',
  })
}

/** 申请头像上传地址。 */
export function presignAvatar(contentType = 'image/jpeg') {
  return request({
    url: '/api/auth/avatar-uploads',
    method: 'POST',
    data: { content_type: contentType },
  })
}

/** 分页获取通知列表。 */
export function fetchNotifications({ pageNum = 1, pageSize = 20, platform = 'pc', channel = 'system' } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
    platform: platform || 'pc',
    channel: channel || 'system',
  })
  return request({
    url: `/api/notifications?${params.toString()}`,
    method: 'GET',
  })
}

/** 拉取通知规则与有效活动。 */
export function fetchNotificationConfig() {
  return request({
    url: '/api/notifications/config',
    method: 'GET',
    auth: false,
  })
}

/** 官网公开配置（下载链接等）。多处同时调用时复用同一次请求。 */
let siteConfigPromise = null

export function fetchSiteConfig() {
  if (!siteConfigPromise) {
    siteConfigPromise = request({
      url: '/api/site/config',
      method: 'GET',
      auth: false,
    }).catch((err) => {
      siteConfigPromise = null
      throw err
    })
  }
  return siteConfigPromise
}

/** 云端标记通知已读。 */
export function markNotificationsRead(ids = []) {
  return request({
    url: '/api/notifications/reads',
    method: 'PUT',
    data: { ids: (ids || []).map(Number).filter((n) => n > 0) },
  })
}

/** 获取通知详情。 */
export function fetchNotification(id, { platform = 'pc' } = {}) {
  const params = new URLSearchParams({ platform: platform || 'pc' })
  return request({
    url: `/api/notifications/${id}?${params.toString()}`,
    method: 'GET',
  })
}
