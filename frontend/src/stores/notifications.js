/**
 * 桌面网页端通知状态：云端已读同步 + 本地缓存；消费 /notifications/config。
 */

import { ref, computed } from 'vue'
import {
  fetchNotifications,
  fetchNotificationConfig,
  markNotificationsRead,
} from '../api/client.js'
import { getUsername, getToken } from './storage.js'
import { STORAGE_PREFIX } from '../config.js'

const unreadCount = ref(0)
const revision = ref(0)
const rulesCache = ref(null)
const rulesUpdatedAt = ref('')
let refreshing = null
let configPromise = null

function readKey() {
  return `${STORAGE_PREFIX}notif_read_${getUsername() || 'anon'}`
}

function rulesKey() {
  return `${STORAGE_PREFIX}notif_rules_${getUsername() || 'anon'}`
}

function listKey(platform = 'pc', channel = 'system') {
  return `${STORAGE_PREFIX}notif_list_${getUsername() || 'anon'}_${platform}_${channel}`
}

/** 读取当前账号的通知列表缓存。 */
export function loadNotificationListCache({ platform = 'pc', channel = 'system' } = {}) {
  try {
    const raw = localStorage.getItem(listKey(platform, channel))
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || !Array.isArray(parsed.items)) return null
    return {
      items: parsed.items,
      total: Number(parsed.total) || parsed.items.length,
      pageNum: Number(parsed.pageNum) || 1,
      savedAt: parsed.savedAt || 0,
    }
  } catch {
    return null
  }
}

/** 保存当前账号的通知列表缓存（首页快照）。 */
export function saveNotificationListCache(
  { platform = 'pc', channel = 'system', items, total, pageNum = 1 } = {},
) {
  try {
    localStorage.setItem(
      listKey(platform, channel),
      JSON.stringify({
        items: Array.isArray(items) ? items : [],
        total: Number(total) || 0,
        pageNum: Number(pageNum) || 1,
        savedAt: Date.now(),
      }),
    )
  } catch {
    // ignore
  }
}

/** 读取当前账号的通知已读集合。 */
export function loadReadSet() {
  try {
    const raw = localStorage.getItem(readKey())
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.map(Number) : [])
  } catch {
    return new Set()
  }
}

/** 保存当前账号的通知已读集合。 */
export function saveReadSet(set) {
  try {
    localStorage.setItem(readKey(), JSON.stringify([...set]))
  } catch {
    // ignore
  }
  revision.value += 1
}

/** 判断通知是否未读。 */
export function isUnreadId(id, readSet = loadReadSet()) {
  return id != null && !readSet.has(Number(id))
}

function mergeServerReads(items) {
  if (!Array.isArray(items) || !items.length) return loadReadSet()
  const next = loadReadSet()
  let changed = false
  for (const item of items) {
    if (item && item.is_read && item.id != null) {
      const n = Number(item.id)
      if (!next.has(n)) {
        next.add(n)
        changed = true
      }
    }
  }
  if (changed) saveReadSet(next)
  return next
}

/** 将指定通知标记为已读（本地 + 云端）。 */
export function markIdsRead(ids) {
  const next = loadReadSet()
  const fresh = []
  for (const id of ids || []) {
    if (id == null) continue
    const n = Number(id)
    if (!next.has(n)) {
      next.add(n)
      fresh.push(n)
    }
  }
  if (fresh.length) {
    saveReadSet(next)
    if (unreadCount.value > 0) {
      unreadCount.value = Math.max(0, unreadCount.value - fresh.length)
    }
    if (getToken()) {
      markNotificationsRead(fresh).catch(() => {})
    }
  }
  return next
}

/** 批量标记通知为已读。 */
export function markAllIdsRead(ids) {
  return markIdsRead(ids)
}

function inQuietHours(rules) {
  const qh = rules?.quiet_hours
  if (!qh || qh.enabled === false) return false
  const start = String(qh.start || '22:00')
  const end = String(qh.end || '08:00')
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const parse = (s) => {
    const [h, m] = String(s).split(':').map((x) => Number(x) || 0)
    return h * 60 + m
  }
  const a = parse(start)
  const b = parse(end)
  if (a === b) return false
  if (a < b) return mins >= a && mins < b
  return mins >= a || mins < b
}

function countUnread(items, read, rules) {
  const enabled = rules?.enabled !== false
  const quiet = inQuietHours(rules)
  return items.filter((x) => {
    if (!isUnreadId(x.id, read)) return false
    if (!enabled && !(x.bypass_quiet && x.channel === 'system')) return false
    if (quiet && !(x.bypass_quiet && x.channel === 'system')) return false
    return true
  }).length
}

/** 拉取并缓存通知规则。 */
export async function ensureNotificationConfig({ force = false } = {}) {
  if (!force && rulesCache.value) return rulesCache.value
  if (configPromise) return configPromise
  configPromise = (async () => {
    try {
      const res = await fetchNotificationConfig()
      const rules = res.rules || res || {}
      rulesCache.value = rules
      rulesUpdatedAt.value = res.updated_at || ''
      try {
        localStorage.setItem(
          rulesKey(),
          JSON.stringify({ rules, updated_at: rulesUpdatedAt.value }),
        )
      } catch {
        // ignore
      }
      return rules
    } catch {
      try {
        const raw = localStorage.getItem(rulesKey())
        const parsed = raw ? JSON.parse(raw) : null
        if (parsed?.rules) {
          rulesCache.value = parsed.rules
          rulesUpdatedAt.value = parsed.updated_at || ''
          return parsed.rules
        }
      } catch {
        // ignore
      }
      return rulesCache.value
    } finally {
      configPromise = null
    }
  })()
  return configPromise
}

export function getNotificationRules() {
  return rulesCache.value
}

/** 刷新通知未读数量。 */
export async function refreshUnreadCount({ platform = 'pc' } = {}) {
  if (!getToken()) {
    unreadCount.value = 0
    return 0
  }
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const [rules, res] = await Promise.all([
        ensureNotificationConfig({ force: true }),
        fetchNotifications({
          pageNum: 1,
          pageSize: 100,
          platform,
          channel: 'system',
        }),
      ])
      const items = Array.isArray(res.items) ? res.items : []
      saveNotificationListCache({
        platform,
        channel: 'system',
        items,
        total: res.pageInfo?.total ?? items.length,
        pageNum: 1,
      })
      const read = mergeServerReads(items)
      const n = countUnread(items, read, rules)
      unreadCount.value = n
      revision.value += 1
      return n
    } catch {
      return unreadCount.value
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** 清空通知未读角标。 */
export function clearUnreadBadge() {
  unreadCount.value = 0
  revision.value += 1
}

export const hasUnread = computed(() => {
  void revision.value
  return unreadCount.value > 0
})

export { unreadCount, revision, rulesCache, rulesUpdatedAt }
