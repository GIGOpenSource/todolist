/**
 * 移动端 API 请求封装：统一鉴权、令牌刷新、错误处理与业务接口。
 */

import { BASE_URL } from '../utils/config.js'
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAuth,
} from '../utils/storage.js'
import { resetTodoCache } from '../utils/todoStore.js'
import { getAcceptLanguage, getDeviceLanguage, t } from '../utils/i18n.js'

// 复用同一个刷新请求，避免并发 401 触发多次令牌轮换。
let refreshPromise = null

function forceRelogin(message) {
  clearAuth()
  resetTodoCache()
  uni.showToast({ title: message || t('common.relogin'), icon: 'none' })
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/login' })
  }, 500)
}

function rawRequest({ url, method = 'GET', data = null, auth = true, headerExtra = {} }) {
  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json',
      'Accept-Language': getAcceptLanguage(),
      'X-Device-Language': getDeviceLanguage(),
      ...headerExtra,
    }
    if (auth) {
      const token = getToken()
      if (token) header.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
      timeout: 15000,
      success: (res) => resolve(res),
      fail: (err) => reject(new Error(err.errMsg || t('common.networkError'))),
    })
  })
}

function parseEnvelope(res) {
  const body = res.data || {}
  if (typeof body.code === 'number') {
    if (body.code === 200) {
      if (body.result && typeof body.result === 'object' && !Array.isArray(body.result)) {
        return { ...body.result, message: body.message, pageInfo: body.pageInfo }
      }
      return { result: body.result, message: body.message, pageInfo: body.pageInfo }
    }
    const err = Object.assign(new Error(body.message || t('common.requestFailed')), {
      code: body.code,
      result: body.result,
      httpStatus: res.statusCode,
    })
    throw err
  }
  if (res.statusCode === 401) {
    throw Object.assign(new Error(t('common.unauthorized')), { code: 40102 })
  }
  if (res.statusCode >= 200 && res.statusCode < 300) return body
  throw new Error(body.message || body.detail || t('common.requestFailed'))
}

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return false
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await rawRequest({
          url: '/api/auth/tokens',
          method: 'POST',
          data: { refresh_token: refresh },
          auth: false,
        })
        const body = parseEnvelope(res)
        if (!body.access_token) return false
        setToken(body.access_token)
        if (body.refresh_token) setRefreshToken(body.refresh_token)
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
    const res = await rawRequest({ url, method, data, auth })
    return parseEnvelope(res)
  } catch (err) {
    const code = err && err.code
    const authFail = code === 40102 || code === 40103 || code === 40104
    if (auth && !_retried && authFail && getRefreshToken()) {
      const ok = await refreshAccessToken()
      if (ok) {
        return request({ url, method, data, auth, _retried: true })
      }
    }
    if (authFail) {
      forceRelogin(err.message)
    }
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
    auth: true,
  }).catch(() => null)
}

/** 拉取当前用户资料。 */
export function fetchProfile() {
  return request({
    url: '/api/auth/me',
    method: 'GET',
  })
}

/** 更新当前用户资料。 */
export function updateProfile(data = {}) {
  const payload = {}
  if (data.nickname !== undefined) payload.nickname = data.nickname || ''
  if (data.avatar !== undefined) payload.avatar = data.avatar || ''
  if (data.signature !== undefined) payload.signature = data.signature || ''
  if (data.gender !== undefined) payload.gender = data.gender || ''
  return request({
    url: '/api/auth/profile',
    method: 'PUT',
    data: payload,
  })
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

/** 申请头像上传地址。 */
export function presignAvatar(contentType = 'image/jpeg') {
  return request({
    url: '/api/auth/avatar-uploads',
    method: 'POST',
    data: { content_type: contentType },
  })
}

/** 申请删除当前账号。 */
export function deleteAccount() {
  return request({
    url: '/api/auth/account',
    method: 'DELETE',
  })
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
export function syncTodos(todos, listUpdatedAt, { deletedIds = [], syncWeeks = 1 } = {}) {
  return request({
    url: '/api/todos/sync',
    method: 'PUT',
    data: {
      todos,
      list_updated_at: listUpdatedAt,
      deleted_ids: deletedIds,
      sync_weeks: syncWeeks,
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
export function syncNotes(notes, listUpdatedAt, { deletedIds = [], syncWeeks = 1 } = {}) {
  return request({
    url: '/api/notes/sync',
    method: 'PUT',
    data: {
      notes,
      list_updated_at: listUpdatedAt,
      deleted_ids: deletedIds,
      sync_weeks: syncWeeks,
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
  })
}

/** 查询异步报告任务。 */
export function fetchReportJob(jobId) {
  return request({
    url: `/api/reports/jobs/${jobId}`,
    method: 'GET',
  })
}

/** 分页获取通知列表。 */
export function fetchNotifications({ pageNum = 1, pageSize = 20, platform = '', channel = 'system' } = {}) {
  const params = [`pageNum=${pageNum}`, `pageSize=${pageSize}`, `channel=${encodeURIComponent(channel || 'system')}`]
  if (platform) params.push(`platform=${encodeURIComponent(platform)}`)
  return request({
    url: `/api/notifications?${params.join('&')}`,
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

/** 云端标记通知已读。 */
export function markNotificationsRead(ids = []) {
  return request({
    url: '/api/notifications/reads',
    method: 'PUT',
    data: { ids: (ids || []).map(Number).filter((n) => n > 0) },
  })
}

/** 获取通知详情。 */
export function fetchNotification(id, { platform = '' } = {}) {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : ''
  return request({
    url: `/api/notifications/${id}${qs}`,
    method: 'GET',
  })
}
