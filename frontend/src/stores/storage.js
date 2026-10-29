/**
 * 桌面网页端本地存储：按账号隔离会话、待办与同步元数据。
 */

import { STORAGE_PREFIX } from '../config.js'

const TOKEN_KEY = `${STORAGE_PREFIX}token`
const REFRESH_KEY = `${STORAGE_PREFIX}refresh_token`
const USER_KEY = `${STORAGE_PREFIX}username`

function todosKey(username) {
  return `${STORAGE_PREFIX}todos__${username}`
}
function listTsKey(username) {
  return `${STORAGE_PREFIX}list_updated_at__${username}`
}
function userIdKey(username) {
  return `${STORAGE_PREFIX}user_id__${username}`
}
function todoSeqKey(username) {
  return `${STORAGE_PREFIX}todo_seq__${username}`
}
function nicknameKey(username) {
  return `${STORAGE_PREFIX}nickname__${username}`
}
function avatarKey(username) {
  return `${STORAGE_PREFIX}avatar__${username}`
}
function signatureKey(username) {
  return `${STORAGE_PREFIX}signature__${username}`
}
function genderKey(username) {
  return `${STORAGE_PREFIX}gender__${username}`
}
function pendingDeletesKey(username) {
  return `${STORAGE_PREFIX}pending_deletes__${username}`
}
function syncWeeksKey(username) {
  return `${STORAGE_PREFIX}sync_weeks__${username}`
}
function syncExhaustedKey(username) {
  return `${STORAGE_PREFIX}sync_exhausted__${username}`
}
function cloudCountKey(username) {
  return `${STORAGE_PREFIX}cloud_count__${username}`
}
function lastSyncedAtKey(username) {
  return `${STORAGE_PREFIX}last_synced_at__${username}`
}
function lastAutoSyncDueKey(username) {
  return `${STORAGE_PREFIX}last_auto_sync_due__${username}`
}
function activeDaysKey(username) {
  return `${STORAGE_PREFIX}active_days__${username}`
}

function lsGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    // ignore
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function lsGetJson(key, fallback) {
  const raw = lsGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** 读取访问令牌。 */
export function getToken() {
  return lsGet(TOKEN_KEY) || ''
}

/** 保存访问令牌。 */
export function setToken(token) {
  lsSet(TOKEN_KEY, token || '')
}

/** 清除访问令牌。 */
export function clearToken() {
  lsRemove(TOKEN_KEY)
}

/** 读取刷新令牌。 */
export function getRefreshToken() {
  return lsGet(REFRESH_KEY) || ''
}

/** 保存刷新令牌。 */
export function setRefreshToken(token) {
  lsSet(REFRESH_KEY, token || '')
}

/** 清除刷新令牌。 */
export function clearRefreshToken() {
  lsRemove(REFRESH_KEY)
}

/** 读取当前用户名。 */
export function getUsername() {
  return lsGet(USER_KEY) || ''
}

/** 保存当前用户名。 */
export function setUsername(name) {
  lsSet(USER_KEY, name || '')
}

/** 清除当前用户名。 */
export function clearUsername() {
  lsRemove(USER_KEY)
}

/** 读取当前账号昵称。 */
export function getNickname() {
  const username = getUsername()
  if (!username) return ''
  return lsGet(nicknameKey(username)) || ''
}

/** 保存当前账号昵称。 */
export function setNickname(nickname) {
  const username = getUsername()
  if (!username) return
  lsSet(nicknameKey(username), (nickname || '').trim())
}

/** 读取当前账号头像。 */
export function getAvatar() {
  const username = getUsername()
  if (!username) return ''
  return lsGet(avatarKey(username)) || ''
}

/** 保存当前账号头像。 */
export function setAvatar(avatar) {
  const username = getUsername()
  if (!username) return
  lsSet(avatarKey(username), avatar || '')
}

/** 读取当前账号签名。 */
export function getSignature() {
  const username = getUsername()
  if (!username) return ''
  return lsGet(signatureKey(username)) || ''
}

/** 保存当前账号签名。 */
export function setSignature(signature) {
  const username = getUsername()
  if (!username) return
  lsSet(signatureKey(username), (signature || '').trim())
}

/** 读取当前账号性别。 */
export function getGender() {
  const username = getUsername()
  if (!username) return ''
  return lsGet(genderKey(username)) || ''
}

/** 保存当前账号性别。 */
export function setGender(gender) {
  const username = getUsername()
  if (!username) return
  lsSet(genderKey(username), (gender || '').trim())
}

/** 批量更新当前账号资料缓存。 */
export function setProfileCache({ nickname, avatar, signature, gender } = {}) {
  if (nickname !== undefined) setNickname(nickname)
  if (avatar !== undefined) setAvatar(avatar)
  if (signature !== undefined) setSignature(signature)
  if (gender !== undefined) setGender(gender)
}

/** 返回昵称或用户名作为展示名。 */
export function getDisplayName() {
  return getNickname() || getUsername() || ''
}

/** 绑定登录会话并初始化账号存储。 */
export function bindSession(token, username, profile = {}) {
  const name = (username || '').trim()
  setToken(token || '')
  setUsername(name)
  const p = typeof profile === 'string' ? { nickname: profile } : profile || {}
  if (p.refresh_token !== undefined) setRefreshToken(p.refresh_token || '')
  if (name) {
    lsSet(nicknameKey(name), (p.nickname || '').trim())
    if (p.avatar !== undefined) lsSet(avatarKey(name), p.avatar || '')
    if (p.signature !== undefined) lsSet(signatureKey(name), (p.signature || '').trim())
    if (p.gender !== undefined) lsSet(genderKey(name), (p.gender || '').trim())
    const uid = Number(p.user_id ?? p.userId ?? 0) || decodeUserIdFromToken(token)
    if (uid > 0) setUserId(uid)
  }
}

/** 解析 JWT payload.sub 为 user_id（无验签，仅本地兜底）。 */
export function decodeUserIdFromToken(token) {
  try {
    const raw = String(token || '').split('.')[1] || ''
    if (!raw) return 0
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(pad)
    const payload = JSON.parse(json || '{}')
    return Math.max(0, Number(payload.sub) || 0)
  } catch {
    return 0
  }
}

/** 读取当前账号的数字 user_id。 */
export function getUserId() {
  const username = getUsername()
  if (!username) return 0
  const stored = Number(lsGet(userIdKey(username)) || 0) || 0
  if (stored > 0) return stored
  const fromToken = decodeUserIdFromToken(getToken())
  if (fromToken > 0) {
    setUserId(fromToken)
    return fromToken
  }
  return 0
}

/** 保存当前账号的数字 user_id。 */
export function setUserId(userId) {
  const username = getUsername()
  if (!username) return
  const n = Math.max(0, Number(userId) || 0)
  if (n > 0) lsSet(userIdKey(username), String(n))
}

function getTodoSeq() {
  const username = getUsername()
  if (!username) return 0
  return Math.max(0, Number(lsGet(todoSeqKey(username)) || 0) || 0)
}

function setTodoSeq(seq) {
  const username = getUsername()
  if (!username) return
  lsSet(todoSeqKey(username), String(Math.max(0, Number(seq) || 0)))
}

/**
 * 根据已有待办 ID 抬高序号（u{uid}_{seq}）。
 */
export function bumpTodoSeqFromTodos(todos) {
  const uid = getUserId()
  if (!uid) return
  const prefix = `u${uid}_`
  let maxSeq = getTodoSeq()
  for (const t of todos || []) {
    const id = String(t?.id || '')
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length)) || 0
    if (n > maxSeq) maxSeq = n
  }
  setTodoSeq(maxSeq)
}

/**
 * 生成待办 ID：u{userId}_{seq}
 */
export function genTodoId() {
  const uid = getUserId()
  if (!uid) {
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
  const next = getTodoSeq() + 1
  setTodoSeq(next)
  return `u${uid}_${next}`
}

/** 读取当前账号的本地待办。 */
export function getLocalTodos() {
  const username = getUsername()
  if (!username) return []
  const raw = lsGetJson(todosKey(username), [])
  return Array.isArray(raw) ? raw : []
}

/** 保存当前账号的本地待办。 */
export function setLocalTodos(todos) {
  const username = getUsername()
  if (!username) return
  lsSet(todosKey(username), todos || [])
}

/** 读取待办列表更新时间。 */
export function getListUpdatedAt() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(listTsKey(username)) || 0) || 0
}

/** 保存待办列表更新时间。 */
export function setListUpdatedAt(ts) {
  const username = getUsername()
  if (!username) return
  lsSet(listTsKey(username), String(Number(ts) || 0))
}

/** 读取待同步的删除记录。 */
export function getPendingDeletes() {
  const username = getUsername()
  if (!username) return []
  const list = lsGetJson(pendingDeletesKey(username), [])
  return Array.isArray(list) ? list.filter(Boolean) : []
}

/** 保存待同步的删除记录。 */
export function setPendingDeletes(ids) {
  const username = getUsername()
  if (!username) return
  lsSet(pendingDeletesKey(username), [...new Set((ids || []).filter(Boolean))])
}

/** 追加一条待同步删除记录。 */
export function addPendingDelete(id) {
  if (!id) return
  const list = getPendingDeletes()
  if (!list.includes(id)) list.push(id)
  setPendingDeletes(list)
}

/** 清除已同步的删除记录。 */
export function clearPendingDeletes(ids) {
  if (!ids || !ids.length) {
    setPendingDeletes([])
    return
  }
  const drop = new Set(ids)
  setPendingDeletes(getPendingDeletes().filter((id) => !drop.has(id)))
}

/** 读取已同步的历史周数。 */
export function getSyncWeeks() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(syncWeeksKey(username)) || 0) || 0
}

/** 保存已同步的历史周数。 */
export function setSyncWeeks(weeks) {
  const username = getUsername()
  if (!username) return
  lsSet(syncWeeksKey(username), String(Math.max(0, Number(weeks) || 0)))
}

/** 判断历史数据是否已全部同步。 */
export function getSyncExhausted() {
  const username = getUsername()
  if (!username) return false
  return lsGet(syncExhaustedKey(username)) === '1'
}

/** 记录历史数据是否已全部同步。 */
export function setSyncExhausted(value) {
  const username = getUsername()
  if (!username) return
  lsSet(syncExhaustedKey(username), value ? '1' : '0')
}

/** 读取云端待办数量。 */
export function getCloudCount() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(cloudCountKey(username)) || 0) || 0
}

/** 保存云端待办数量。 */
export function setCloudCount(n) {
  const username = getUsername()
  if (!username) return
  lsSet(cloudCountKey(username), String(Math.max(0, Number(n) || 0)))
}

/** 读取最近同步时间。 */
export function getLastSyncedAt() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(lastSyncedAtKey(username)) || 0) || 0
}

/** 保存最近同步时间。 */
export function setLastSyncedAt(ts) {
  const username = getUsername()
  if (!username) return
  lsSet(lastSyncedAtKey(username), String(Number(ts) || 0))
}

/** 读取最近一次自动同步窗口。 */
export function getLastAutoSyncDueAt() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(lastAutoSyncDueKey(username)) || 0) || 0
}

/** 保存最近一次自动同步窗口。 */
export function setLastAutoSyncDueAt(ts) {
  const username = getUsername()
  if (!username) return
  lsSet(lastAutoSyncDueKey(username), String(Number(ts) || 0))
}

function toDayKey(tsOrDate = Date.now()) {
  const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDayKey(dayKey, delta) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return toDayKey(dt)
}

/** 读取当前账号的活跃日期。 */
export function getActiveDays() {
  const username = getUsername()
  if (!username) return []
  const raw = lsGetJson(activeDaysKey(username), [])
  if (!Array.isArray(raw)) return []
  return raw.filter((k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k))
}

/** 记录当前账号今日活跃。 */
export function touchActiveDay() {
  const username = getUsername()
  if (!username) return
  const today = toDayKey()
  const days = getActiveDays()
  if (days.includes(today)) return
  days.push(today)
  days.sort()
  lsSet(activeDaysKey(username), days.slice(-400))
}

/** 计算当前账号连续活跃天数。 */
export function getStreakDays() {
  const set = new Set(getActiveDays())
  if (set.size === 0) return 0
  let cursor = toDayKey()
  if (!set.has(cursor)) {
    cursor = shiftDayKey(cursor, -1)
    if (!set.has(cursor)) return 0
  }
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = shiftDayKey(cursor, -1)
  }
  return streak
}

/** Sync local open days to server; returns consecutive streak (gap resets). */
let _streakSyncKey = ''
let _streakSyncPromise = null

/** 将本地活跃日期同步到服务端。 */
export async function syncStreakToServer(touchStreakFn) {
  if (typeof touchStreakFn !== 'function') return getStreakDays()
  const today = toDayKey()
  const days = getActiveDays()
  const key = `${today}:${days.length}:${days[days.length - 1] || ''}`
  if (key === _streakSyncKey && _streakSyncPromise) {
    try {
      return await _streakSyncPromise
    } catch (_) {
      return getStreakDays()
    }
  }
  _streakSyncKey = key
  _streakSyncPromise = (async () => {
    const res = await touchStreakFn({ day: today, days })
    const n = Number(res && res.streak_days)
    return Number.isFinite(n) && n >= 0 ? n : getStreakDays()
  })()
  try {
    return await _streakSyncPromise
  } catch (_) {
    _streakSyncKey = ''
    _streakSyncPromise = null
    return getStreakDays()
  }
}

/** 判断本地是否存在待同步变更。 */
export function hasPendingSyncChanges() {
  if (getPendingDeletes().length > 0) return true
  const last = getLastSyncedAt()
  if (!last) return getLocalTodos().length > 0 || getSyncWeeks() === 0
  return getListUpdatedAt() > last
}

/** 清除当前登录态（含同域官网展示用的 upgrade_site_auth）。 */
export function clearAuth() {
  clearToken()
  clearRefreshToken()
  clearUsername()
  try {
    localStorage.removeItem('upgrade_site_auth')
  } catch {
    /* ignore */
  }
}

/** 返回当前毫秒时间戳。 */
export function nowTs() {
  return Date.now()
}

// ── Notes storage (parallel to todos) ────────────────────────────────

function notesKey(username) {
  return `${STORAGE_PREFIX}notes__${username}`
}
function notesListTsKey(username) {
  return `${STORAGE_PREFIX}notes_list_updated_at__${username}`
}
function noteSeqKey(username) {
  return `${STORAGE_PREFIX}note_seq__${username}`
}
function notesPendingDeletesKey(username) {
  return `${STORAGE_PREFIX}notes_pending_deletes__${username}`
}
function notesSyncWeeksKey(username) {
  return `${STORAGE_PREFIX}notes_sync_weeks__${username}`
}
function notesSyncExhaustedKey(username) {
  return `${STORAGE_PREFIX}notes_sync_exhausted__${username}`
}
function notesCloudCountKey(username) {
  return `${STORAGE_PREFIX}notes_cloud_count__${username}`
}
function notesLastSyncedAtKey(username) {
  return `${STORAGE_PREFIX}notes_last_synced_at__${username}`
}

function getNoteSeq() {
  const username = getUsername()
  if (!username) return 0
  return Math.max(0, Number(lsGet(noteSeqKey(username)) || 0) || 0)
}

function setNoteSeq(seq) {
  const username = getUsername()
  if (!username) return
  lsSet(noteSeqKey(username), String(Math.max(0, Number(seq) || 0)))
}

export function bumpNoteSeqFromNotes(notes) {
  const uid = getUserId()
  if (!uid) return
  const prefix = `n${uid}_`
  let maxSeq = getNoteSeq()
  for (const n of notes || []) {
    const id = String(n?.id || '')
    if (!id.startsWith(prefix)) continue
    const num = Number(id.slice(prefix.length)) || 0
    if (num > maxSeq) maxSeq = num
  }
  setNoteSeq(maxSeq)
}

export function genNoteId() {
  const uid = getUserId()
  if (!uid) {
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
  const next = getNoteSeq() + 1
  setNoteSeq(next)
  return `n${uid}_${next}`
}

export function getLocalNotes() {
  const username = getUsername()
  if (!username) return []
  const raw = lsGetJson(notesKey(username), [])
  return Array.isArray(raw) ? raw : []
}

export function setLocalNotes(notes) {
  const username = getUsername()
  if (!username) return
  lsSet(notesKey(username), notes || [])
}

export function getNotesListUpdatedAt() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(notesListTsKey(username)) || 0) || 0
}

export function setNotesListUpdatedAt(ts) {
  const username = getUsername()
  if (!username) return
  lsSet(notesListTsKey(username), String(Number(ts) || 0))
}

export function getNotesPendingDeletes() {
  const username = getUsername()
  if (!username) return []
  const list = lsGetJson(notesPendingDeletesKey(username), [])
  return Array.isArray(list) ? list.filter(Boolean) : []
}

export function setNotesPendingDeletes(ids) {
  const username = getUsername()
  if (!username) return
  lsSet(notesPendingDeletesKey(username), [...new Set((ids || []).filter(Boolean))])
}

export function addNotesPendingDelete(id) {
  if (!id) return
  const list = getNotesPendingDeletes()
  if (!list.includes(id)) list.push(id)
  setNotesPendingDeletes(list)
}

export function clearNotesPendingDeletes(ids) {
  if (!ids || !ids.length) {
    setNotesPendingDeletes([])
    return
  }
  const drop = new Set(ids)
  setNotesPendingDeletes(getNotesPendingDeletes().filter((id) => !drop.has(id)))
}

export function getNotesSyncWeeks() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(notesSyncWeeksKey(username)) || 0) || 0
}

export function setNotesSyncWeeks(weeks) {
  const username = getUsername()
  if (!username) return
  lsSet(notesSyncWeeksKey(username), String(Math.max(0, Number(weeks) || 0)))
}

export function getNotesSyncExhausted() {
  const username = getUsername()
  if (!username) return false
  return lsGet(notesSyncExhaustedKey(username)) === '1'
}

export function setNotesSyncExhausted(value) {
  const username = getUsername()
  if (!username) return
  lsSet(notesSyncExhaustedKey(username), value ? '1' : '0')
}

export function getNotesCloudCount() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(notesCloudCountKey(username)) || 0) || 0
}

export function setNotesCloudCount(n) {
  const username = getUsername()
  if (!username) return
  lsSet(notesCloudCountKey(username), String(Math.max(0, Number(n) || 0)))
}

export function getNotesLastSyncedAt() {
  const username = getUsername()
  if (!username) return 0
  return Number(lsGet(notesLastSyncedAtKey(username)) || 0) || 0
}

export function setNotesLastSyncedAt(ts) {
  const username = getUsername()
  if (!username) return
  lsSet(notesLastSyncedAtKey(username), String(Number(ts) || 0))
}

export function hasPendingNotesSyncChanges() {
  if (getNotesPendingDeletes().length > 0) return true
  const last = getNotesLastSyncedAt()
  if (!last) return getLocalNotes().length > 0 || getNotesSyncWeeks() === 0
  return getNotesListUpdatedAt() > last
}
