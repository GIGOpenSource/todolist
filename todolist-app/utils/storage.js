/**
 * 移动端本地存储：按账号隔离鉴权、资料、待办与同步元数据。
 */

/** 通用读取本地存储。 */
export function getItem(key) {
  return uni.getStorageSync(key) || ''
}

/** 通用写入本地存储。 */
export function setItem(key, value) {
  uni.setStorageSync(key, value ?? '')
}

/** 通用删除本地存储。 */
export function removeItem(key) {
  uni.removeStorageSync(key)
}

const TOKEN_KEY = 'todolist_token'
const REFRESH_KEY = 'todolist_refresh_token'
const USER_KEY = 'todolist_username'
const LEGACY_TODOS_KEY = 'todolist_todos'
const LEGACY_LIST_TS_KEY = 'todolist_list_updated_at'

function todosKey(username) {
  return `todolist_todos__${username}`
}

function listTsKey(username) {
  return `todolist_list_updated_at__${username}`
}

function userIdKey(username) {
  return `todolist_user_id__${username}`
}

function todoSeqKey(username) {
  return `todolist_todo_seq__${username}`
}

function nicknameKey(username) {
  return `todolist_nickname__${username}`
}

function avatarKey(username) {
  return `todolist_avatar__${username}`
}

function signatureKey(username) {
  return `todolist_signature__${username}`
}

function genderKey(username) {
  return `todolist_gender__${username}`
}

function pendingDeletesKey(username) {
  return `todolist_pending_deletes__${username}`
}

function syncWeeksKey(username) {
  return `todolist_sync_weeks__${username}`
}

function syncExhaustedKey(username) {
  return `todolist_sync_exhausted__${username}`
}

function cloudCountKey(username) {
  return `todolist_cloud_count__${username}`
}

function lastSyncedAtKey(username) {
  return `todolist_last_synced_at__${username}`
}

function lastAutoSyncDueKey(username) {
  return `todolist_last_auto_sync_due__${username}`
}

function pendingNoteIdKey() {
  return 'todolist_pending_note_id'
}

/** 跨页跳转笔记：switchTab 前写入，notes onShow 消费。 */
export function setPendingNoteId(noteId) {
  const id = String(noteId || '').trim()
  if (!id) {
    uni.removeStorageSync(pendingNoteIdKey())
    return
  }
  uni.setStorageSync(pendingNoteIdKey(), id)
}

export function consumePendingNoteId() {
  const key = pendingNoteIdKey()
  const id = String(uni.getStorageSync(key) || '').trim()
  if (id) uni.removeStorageSync(key)
  return id
}

function activeDaysKey(username) {
  return `todolist_active_days__${username}`
}

function requireUsername() {
  return getUsername()
}

/** 读取访问令牌。 */
export function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

/** 保存访问令牌。 */
export function setToken(token) {
  uni.setStorageSync(TOKEN_KEY, token || '')
}

/** 清除访问令牌。 */
export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

/** 读取刷新令牌。 */
export function getRefreshToken() {
  return uni.getStorageSync(REFRESH_KEY) || ''
}

/** 保存刷新令牌。 */
export function setRefreshToken(token) {
  uni.setStorageSync(REFRESH_KEY, token || '')
}

/** 清除刷新令牌。 */
export function clearRefreshToken() {
  uni.removeStorageSync(REFRESH_KEY)
}

/** 读取当前用户名。 */
export function getUsername() {
  return uni.getStorageSync(USER_KEY) || ''
}

/** 保存当前用户名。 */
export function setUsername(name) {
  uni.setStorageSync(USER_KEY, name || '')
}

/** 清除当前用户名。 */
export function clearUsername() {
  uni.removeStorageSync(USER_KEY)
}

/** 读取当前账号昵称。 */
export function getNickname() {
  const username = getUsername()
  if (!username) return ''
  return uni.getStorageSync(nicknameKey(username)) || ''
}

/** 保存当前账号昵称。 */
export function setNickname(nickname) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(nicknameKey(username), (nickname || '').trim())
}

/** 读取当前账号头像。 */
export function getAvatar() {
  const username = getUsername()
  if (!username) return ''
  return uni.getStorageSync(avatarKey(username)) || ''
}

/** 保存当前账号头像。 */
export function setAvatar(avatar) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(avatarKey(username), avatar || '')
}

/** 读取当前账号签名。 */
export function getSignature() {
  const username = getUsername()
  if (!username) return ''
  return uni.getStorageSync(signatureKey(username)) || ''
}

/** 保存当前账号签名。 */
export function setSignature(signature) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(signatureKey(username), (signature || '').trim())
}

/** 读取当前账号性别。 */
export function getGender() {
  const username = getUsername()
  if (!username) return ''
  return uni.getStorageSync(genderKey(username)) || ''
}

/** 保存当前账号性别。 */
export function setGender(gender) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(genderKey(username), (gender || '').trim())
}

/** 批量写入资料缓存 */
export function setProfileCache({ nickname, avatar, signature, gender } = {}) {
  if (nickname !== undefined) setNickname(nickname)
  if (avatar !== undefined) setAvatar(avatar)
  if (signature !== undefined) setSignature(signature)
  if (gender !== undefined) setGender(gender)
}

/** 展示名：有昵称用昵称，否则回退登录用户名 */
export function getDisplayName() {
  return getNickname() || getUsername() || ''
}

/**
 * 登录/注册成功后绑定会话。
 * 每个账号的本地待办独立存储，互不覆盖。
 */
export function bindSession(token, username, profile = {}) {
  const name = (username || '').trim()
  setToken(token || '')
  setUsername(name)
  if (name) {
    const p = typeof profile === 'string' ? { nickname: profile } : profile || {}
    uni.setStorageSync(nicknameKey(name), (p.nickname || '').trim())
    if (p.avatar !== undefined) uni.setStorageSync(avatarKey(name), p.avatar || '')
    if (p.signature !== undefined) uni.setStorageSync(signatureKey(name), (p.signature || '').trim())
    if (p.gender !== undefined) uni.setStorageSync(genderKey(name), (p.gender || '').trim())
    if (p.refresh_token !== undefined) setRefreshToken(p.refresh_token || '')
    const uid = Number(p.user_id ?? p.userId ?? 0) || decodeUserIdFromToken(token)
    if (uid > 0) setUserId(uid)
  } else if (profile && profile.refresh_token !== undefined) {
    setRefreshToken(profile.refresh_token || '')
  }
  // 清理旧版全局 key，避免误读到其他账号残留
  uni.removeStorageSync(LEGACY_TODOS_KEY)
  uni.removeStorageSync(LEGACY_LIST_TS_KEY)
}

/** 解析 JWT payload.sub 为 user_id（无验签，仅本地兜底）。 */
export function decodeUserIdFromToken(token) {
  try {
    const raw = String(token || '').split('.')[1] || ''
    if (!raw) return 0
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    let json = ''
    if (typeof atob === 'function') json = atob(pad)
    else if (typeof uni !== 'undefined' && typeof uni.base64ToArrayBuffer === 'function') {
      // UniApp fallback: use decodeURIComponent escape of binary
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
      let str = ''
      let i = 0
      const input = pad.replace(/[^A-Za-z0-9+/=]/g, '')
      while (i < input.length) {
        const enc1 = chars.indexOf(input.charAt(i++))
        const enc2 = chars.indexOf(input.charAt(i++))
        const enc3 = chars.indexOf(input.charAt(i++))
        const enc4 = chars.indexOf(input.charAt(i++))
        const chr1 = (enc1 << 2) | (enc2 >> 4)
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
        const chr3 = ((enc3 & 3) << 6) | enc4
        str += String.fromCharCode(chr1)
        if (enc3 !== 64) str += String.fromCharCode(chr2)
        if (enc4 !== 64) str += String.fromCharCode(chr3)
      }
      json = str
    }
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
  const stored = Number(uni.getStorageSync(userIdKey(username)) || 0) || 0
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
  if (n > 0) uni.setStorageSync(userIdKey(username), n)
}

function getTodoSeq() {
  const username = getUsername()
  if (!username) return 0
  return Math.max(0, Number(uni.getStorageSync(todoSeqKey(username)) || 0) || 0)
}

function setTodoSeq(seq) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(todoSeqKey(username), Math.max(0, Number(seq) || 0))
}

/**
 * 根据已有待办 ID 抬高序号，避免重启后重复。
 * 识别 u{uid}_{seq}；其它格式忽略。
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

/** 读取当前账号的本地待办。 */
export function getLocalTodos() {
  const username = requireUsername()
  if (!username) return []

  const raw = uni.getStorageSync(todosKey(username))
  if (!raw) return []
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return []
  }
}

/** 保存当前账号的本地待办。 */
export function setLocalTodos(todos) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(todosKey(username), todos || [])
}

/** 读取待办列表更新时间。 */
export function getListUpdatedAt() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(listTsKey(username))
  return v ? Number(v) : 0
}

/** 保存待办列表更新时间。 */
export function setListUpdatedAt(ts) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(listTsKey(username), Number(ts) || 0)
}

/** 读取待同步的删除记录。 */
export function getPendingDeletes() {
  const username = requireUsername()
  if (!username) return []
  const raw = uni.getStorageSync(pendingDeletesKey(username))
  if (!raw) return []
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? list.filter(Boolean) : []
  } catch {
    return []
  }
}

/** 保存待同步的删除记录。 */
export function setPendingDeletes(ids) {
  const username = requireUsername()
  if (!username) return
  const unique = [...new Set((ids || []).filter(Boolean))]
  uni.setStorageSync(pendingDeletesKey(username), unique)
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
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(syncWeeksKey(username))
  return v ? Number(v) || 0 : 0
}

/** 保存已同步的历史周数。 */
export function setSyncWeeks(weeks) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(syncWeeksKey(username), Math.max(0, Number(weeks) || 0))
}

/** 判断历史数据是否已全部同步。 */
export function getSyncExhausted() {
  const username = requireUsername()
  if (!username) return false
  return !!uni.getStorageSync(syncExhaustedKey(username))
}

/** 记录历史数据是否已全部同步。 */
export function setSyncExhausted(value) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(syncExhaustedKey(username), !!value)
}

/** 读取云端待办数量。 */
export function getCloudCount() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(cloudCountKey(username))
  return v ? Number(v) || 0 : 0
}

/** 保存云端待办数量。 */
export function setCloudCount(n) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(cloudCountKey(username), Math.max(0, Number(n) || 0))
}

/** 读取最近同步时间。 */
export function getLastSyncedAt() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(lastSyncedAtKey(username))
  return v ? Number(v) || 0 : 0
}

/** 保存最近同步时间。 */
export function setLastSyncedAt(ts) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(lastSyncedAtKey(username), Number(ts) || 0)
}

/** 读取最近一次自动同步窗口。 */
export function getLastAutoSyncDueAt() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(lastAutoSyncDueKey(username))
  return v ? Number(v) || 0 : 0
}

/** 保存最近一次自动同步窗口。 */
export function setLastAutoSyncDueAt(ts) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(lastAutoSyncDueKey(username), Number(ts) || 0)
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
  const username = requireUsername()
  if (!username) return []
  const raw = uni.getStorageSync(activeDaysKey(username))
  if (!Array.isArray(raw)) return []
  return raw.filter((k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k))
}

/** 记录今日打开；登录后打开任意页面时调用 */
export function touchActiveDay() {
  const username = requireUsername()
  if (!username) return
  const today = toDayKey()
  const days = getActiveDays()
  if (days.includes(today)) return
  days.push(today)
  days.sort()
  uni.setStorageSync(activeDaysKey(username), days.slice(-400))
}

/**
 * 连续坚持天数：仅统计「打开应用」的活跃日。
 * 从今天（若今日未打开则从昨天）往前数连续天数；中间断一天则归零。
 * 不再把任务创建/完成日并入，避免断档被任务活动补上。
 */
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

/** 将本地打开日同步到服务端，返回服务端连续天数（失败时返回本地计算结果） */
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

/** 仅清除登录态；各账号本地缓存仍按用户名保留，下次同账号登录可继续用 */
export function clearAuth() {
  clearToken()
  clearRefreshToken()
  clearUsername()
}

/** 返回当前毫秒时间戳。 */
export function nowTs() {
  return Date.now()
}

/**
 * 生成待办 ID：u{userId}_{seq}
 * 例：u12_1、u12_2。跨用户天然不冲突。
 */
export function genId() {
  const uid = getUserId()
  if (!uid) {
    // 未拿到 user_id 时兜底（极少）；同步时服务端仍会做冲突校验
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
  const next = getTodoSeq() + 1
  setTodoSeq(next)
  return `u${uid}_${next}`
}

// ── Notes (notepad) storage — parallel to todos ──────────────────────

function notesKey(username) {
  return `todolist_notes__${username}`
}

function notesListTsKey(username) {
  return `todolist_notes_list_updated_at__${username}`
}

function noteSeqKey(username) {
  return `todolist_note_seq__${username}`
}

function notesPendingDeletesKey(username) {
  return `todolist_notes_pending_deletes__${username}`
}

function notesSyncWeeksKey(username) {
  return `todolist_notes_sync_weeks__${username}`
}

function notesSyncExhaustedKey(username) {
  return `todolist_notes_sync_exhausted__${username}`
}

function notesCloudCountKey(username) {
  return `todolist_notes_cloud_count__${username}`
}

function notesLastSyncedAtKey(username) {
  return `todolist_notes_last_synced_at__${username}`
}

function getNoteSeq() {
  const username = getUsername()
  if (!username) return 0
  return Math.max(0, Number(uni.getStorageSync(noteSeqKey(username)) || 0) || 0)
}

function setNoteSeq(seq) {
  const username = getUsername()
  if (!username) return
  uni.setStorageSync(noteSeqKey(username), Math.max(0, Number(seq) || 0))
}

/** 根据已有笔记 ID 抬高序号（n{uid}_{seq}）。 */
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

export function getLocalNotes() {
  const username = requireUsername()
  if (!username) return []
  const raw = uni.getStorageSync(notesKey(username))
  if (!raw) return []
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return []
  }
}

export function setLocalNotes(list) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesKey(username), Array.isArray(list) ? list : [])
}

export function getNotesListUpdatedAt() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(notesListTsKey(username))
  return v ? Number(v) || 0 : 0
}

export function setNotesListUpdatedAt(ts) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesListTsKey(username), Number(ts) || 0)
}

export function getNotesPendingDeletes() {
  const username = requireUsername()
  if (!username) return []
  const raw = uni.getStorageSync(notesPendingDeletesKey(username))
  if (!raw) return []
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? list.filter(Boolean) : []
  } catch {
    return []
  }
}

export function setNotesPendingDeletes(ids) {
  const username = requireUsername()
  if (!username) return
  const unique = [...new Set((ids || []).filter(Boolean))]
  uni.setStorageSync(notesPendingDeletesKey(username), unique)
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
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(notesSyncWeeksKey(username))
  return v ? Number(v) || 0 : 0
}

export function setNotesSyncWeeks(weeks) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesSyncWeeksKey(username), Math.max(0, Number(weeks) || 0))
}

export function getNotesSyncExhausted() {
  const username = requireUsername()
  if (!username) return false
  return !!uni.getStorageSync(notesSyncExhaustedKey(username))
}

export function setNotesSyncExhausted(value) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesSyncExhaustedKey(username), !!value)
}

export function getNotesCloudCount() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(notesCloudCountKey(username))
  return v ? Number(v) || 0 : 0
}

export function setNotesCloudCount(n) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesCloudCountKey(username), Math.max(0, Number(n) || 0))
}

export function getNotesLastSyncedAt() {
  const username = requireUsername()
  if (!username) return 0
  const v = uni.getStorageSync(notesLastSyncedAtKey(username))
  return v ? Number(v) || 0 : 0
}

export function setNotesLastSyncedAt(ts) {
  const username = requireUsername()
  if (!username) return
  uni.setStorageSync(notesLastSyncedAtKey(username), Number(ts) || 0)
}

export function hasPendingNotesSyncChanges() {
  if (getNotesPendingDeletes().length) return true
  const last = getNotesLastSyncedAt()
  return getNotesListUpdatedAt() > last
}

/** 生成笔记 ID：n{userId}_{seq} */
export function genNoteId() {
  const uid = getUserId()
  if (!uid) {
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
  const next = getNoteSeq() + 1
  setNoteSeq(next)
  return `n${uid}_${next}`
}
