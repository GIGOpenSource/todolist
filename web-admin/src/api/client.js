/**
 * 管理后台 API 请求封装：统一鉴权、错误处理与管理接口。
 */

import { BASE_URL } from '../config.js'
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAuth,
} from '../stores/storage.js'
import { getAcceptLanguage, t } from '../i18n/index.js'

let onUnauthorized = null
let refreshPromise = null

/** 注册未授权响应处理器。 */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function rawFetch({ url, method = 'GET', data = null, auth = true }) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': getAcceptLanguage(),
  }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: data != null ? JSON.stringify(data) : undefined,
    })
  } catch {
    throw new Error(t('common.networkError'))
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
      return {
        data: body.result,
        message: body.message,
        pageInfo: body.pageInfo || null,
      }
    }
    throw Object.assign(new Error(body.message || t('common.requestFailed')), {
      code: body.code,
      result: body.result,
    })
  }
  if (res.status === 401) {
    throw Object.assign(new Error(t('common.unauthorized')), { code: 40102 })
  }
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
        })
        const parsed = parseBody(res, body)
        const result = parsed.data || {}
        if (!result.access_token) return false
        setToken(result.access_token)
        if (result.refresh_token) setRefreshToken(result.refresh_token)
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

async function request({ url, method = 'GET', data = null, auth = true, _retried = false }) {
  try {
    const { res, body } = await rawFetch({ url, method, data, auth })
    return parseBody(res, body)
  } catch (err) {
    const code = err && err.code
    const authFail = code === 40102 || code === 40103 || code === 40104
    if (auth && !_retried && authFail && getRefreshToken()) {
      const ok = await refreshAccessToken()
      if (ok) return request({ url, method, data, auth, _retried: true })
    }
    if (authFail) {
      clearAuth()
      if (typeof onUnauthorized === 'function') onUnauthorized()
    }
    throw err
  }
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

/** 登出并吊销 refresh token。 */
export function logout(refreshToken) {
  return request({
    url: '/api/auth/sessions',
    method: 'DELETE',
    data: { refresh_token: refreshToken || '' },
    auth: false,
  })
}

/** 获取后台统计数据。 */
export function fetchStats(filters = {}) {
  const params = new URLSearchParams()
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.country) params.set('country', filters.country)
  if (filters.language) params.set('language', filters.language)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  const qs = params.toString()
  return request({ url: `/api/admin/stats${qs ? `?${qs}` : ''}`, method: 'GET' })
}

/** 获取云端待办列表。 */
export function fetchTodos({ pageNum = 1, pageSize = 20, q = '', ...filters } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (q) params.set('q', q)
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.country) params.set('country', filters.country)
  if (filters.language) params.set('language', filters.language)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return request({ url: `/api/admin/todos?${params}`, method: 'GET' })
}

/** 更新指定用户待办。 */
export function updateTodo(id, data) {
  return request({
    url: `/api/admin/todos/${encodeURIComponent(id)}`,
    method: 'PUT',
    data,
  })
}

/** 删除指定用户待办。 */
export function deleteTodo(id) {
  return request({
    url: `/api/admin/todos/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}

export function fetchNotes({ pageNum = 1, pageSize = 20, q = '', ...filters } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (q) params.set('q', q)
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.country) params.set('country', filters.country)
  if (filters.language) params.set('language', filters.language)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return request({ url: `/api/admin/notes?${params}`, method: 'GET' })
}

export function updateNote(id, data) {
  return request({
    url: `/api/admin/notes/${encodeURIComponent(id)}`,
    method: 'PUT',
    data,
  })
}

export function deleteNote(id) {
  return request({
    url: `/api/admin/notes/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}

/** 分页获取用户列表。 */
export function fetchUsers({ pageNum = 1, pageSize = 20, q = '', role = 'user', ...filters } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
    role: role || 'user',
  })
  if (q) params.set('q', q)
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.country) params.set('country', filters.country)
  if (filters.language) params.set('language', filters.language)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return request({ url: `/api/admin/users?${params}`, method: 'GET' })
}

/** 创建用户。 */
export function createUser(data) {
  return request({ url: '/api/admin/users', method: 'POST', data })
}

/** 更新用户资料。 */
export function updateUser(id, data) {
  return request({ url: `/api/admin/users/${id}`, method: 'PUT', data })
}

/** 停用指定用户。 */
export function softDeleteUser(id) {
  return request({ url: `/api/admin/users/${id}`, method: 'DELETE' })
}

/** 恢复已停用用户。 */
export function restoreUser(id) {
  return request({ url: `/api/admin/users/${id}/deletion`, method: 'DELETE' })
}

/** 永久删除指定用户。 */
export function hardDeleteUser(id) {
  return request({ url: `/api/admin/users/${id}?purge=1`, method: 'DELETE' })
}

/** 获取站点配置。 */
export function fetchSiteConfig() {
  return request({ url: '/api/admin/site-config', method: 'GET' })
}

/** 更新站点配置。 */
export function updateSiteConfig(data) {
  return request({ url: '/api/admin/site-config', method: 'PUT', data })
}

/** 获取大模型配置列表。 */
export function fetchLlmModels() {
  return request({ url: '/api/admin/llm-models', method: 'GET' })
}

/** 创建大模型配置。 */
export function createLlmModel(data) {
  return request({ url: '/api/admin/llm-models', method: 'POST', data })
}

/** 更新大模型配置。 */
export function updateLlmModel(id, data) {
  return request({ url: `/api/admin/llm-models/${id}`, method: 'PUT', data })
}

/** 删除大模型配置。 */
export function deleteLlmModel(id) {
  return request({ url: `/api/admin/llm-models/${id}`, method: 'DELETE' })
}

/** 分页获取管理员列表。 */
export function fetchAdmins({ pageNum = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  return request({ url: `/api/admin/admins?${params}`, method: 'GET' })
}

/** 创建管理员。 */
export function createAdmin(data) {
  return request({ url: '/api/admin/admins', method: 'POST', data })
}

/** 更新管理员。 */
export function updateAdmin(id, data) {
  return request({ url: `/api/admin/admins/${id}`, method: 'PUT', data })
}

/** 删除管理员。 */
export function deleteAdmin(id) {
  return request({ url: `/api/admin/admins/${id}`, method: 'DELETE' })
}

/** 获取可分配权限目录（与后端 ALL_PERMISSIONS 对齐）。 */
export function fetchPermissionCatalog() {
  return request({ url: '/api/admin/permissions', method: 'GET' })
}

/** 获取通知规则。 */
export function fetchNotificationRules() {
  return request({ url: '/api/admin/notifications/rules', method: 'GET' })
}

/** 更新通知规则。 */
export function updateNotificationRules(data) {
  return request({ url: '/api/admin/notifications/rules', method: 'PUT', data })
}

/** 重置通知规则。 */
export function resetNotificationRules() {
  return request({ url: '/api/admin/notifications/rules', method: 'DELETE' })
}

/** 分页获取通知活动。 */
export function fetchNotificationCampaigns({ pageNum = 1, pageSize = 20, status = '' } = {}) {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (status) params.set('status', status)
  return request({ url: `/api/admin/notifications/campaigns?${params}`, method: 'GET' })
}

/** 创建通知活动。 */
export function createNotificationCampaign(data) {
  return request({ url: '/api/admin/notifications/campaigns', method: 'POST', data })
}

/** 更新通知活动。 */
export function updateNotificationCampaign(id, data) {
  return request({ url: `/api/admin/notifications/campaigns/${id}`, method: 'PUT', data })
}

/** 删除通知活动。 */
export function deleteNotificationCampaign(id) {
  return request({ url: `/api/admin/notifications/campaigns/${id}`, method: 'DELETE' })
}
