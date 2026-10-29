/**
 * 移动端待办状态仓库：管理内存缓存、本地持久化与同步结果合并。
 */

import { ref } from 'vue'
import {
  getToken,
  getUsername,
  getLocalTodos,
  setLocalTodos,
  getListUpdatedAt,
  setListUpdatedAt,
  getSyncWeeks,
  setSyncWeeks,
  getSyncExhausted,
  setSyncExhausted,
  getCloudCount,
  setCloudCount,
  setLastSyncedAt,
  hasPendingSyncChanges,
  getPendingDeletes,
  clearPendingDeletes,
  addPendingDelete,
  nowTs,
  bumpTodoSeqFromTodos,
} from './storage.js'

/** 内存缓存：跨页面共享，避免每次 onShow 重新读盘/拉网 */
const todos = ref([])
const listUpdatedAt = ref(0)
const syncWeeks = ref(0)
const syncExhausted = ref(false)
const cloudCount = ref(0)
const localDirty = ref(false)
const hydratedUser = ref('')
const revision = ref(0)

/** 规范化待办字段（保留 due_at 时分，与网页端一致）。 */
export function normalizeTodo(t) {
  const due = Number(t?.due_at) || 0
  return {
    id: t?.id,
    title: t?.title || '',
    detail: t?.detail || '',
    due_at: due > 0 ? due : 0,
    completed: !!t?.completed,
    is_deleted: !!(t?.is_deleted ?? t?.is_delete),
    created_at: t?.created_at,
    updated_at: t?.updated_at,
  }
}

function bump() {
  revision.value += 1
}

function readMetaFromStorage() {
  listUpdatedAt.value = getListUpdatedAt()
  syncWeeks.value = getSyncWeeks()
  syncExhausted.value = getSyncExhausted()
  cloudCount.value = getCloudCount()
  localDirty.value = hasPendingSyncChanges()
}

/** 仅在用户切换或尚未 hydrate 时从本地磁盘灌入内存 */
export function ensureTodoCache() {
  const user = getUsername()
  if (!user) {
    resetTodoCache()
    return todos.value
  }
  if (hydratedUser.value === user) {
    return todos.value
  }
  hydratedUser.value = user
  todos.value = (getLocalTodos() || []).map(normalizeTodo)
  bumpTodoSeqFromTodos(todos.value)
  readMetaFromStorage()
  bump()
  return todos.value
}

/** 重置内存中的待办缓存。 */
export function resetTodoCache() {
  todos.value = []
  listUpdatedAt.value = 0
  syncWeeks.value = 0
  syncExhausted.value = false
  cloudCount.value = 0
  localDirty.value = false
  hydratedUser.value = ''
  bump()
}

/** 持久化当前待办及更新时间。 */
export function persistTodos(bumpTs = true) {
  if (!getUsername()) return
  ensureTodoCache()
  setLocalTodos(todos.value.map(normalizeTodo))
  if (bumpTs) {
    const ts = nowTs()
    listUpdatedAt.value = ts
    setListUpdatedAt(ts)
    localDirty.value = true
  } else {
    setListUpdatedAt(listUpdatedAt.value)
  }
  bump()
}

/**
 * 按条目 updated_at 做 LWW 合并；is_deleted / 本地 pending 删除则丢弃本地缓存。
 */
export function mergeWindowTodos(incoming) {
  ensureTodoCache()
  const map = new Map(todos.value.map((t) => [t.id, t]))
  for (const raw of incoming || []) {
    const item = normalizeTodo(raw)
    const prev = map.get(item.id)
    if (!prev || (item.updated_at || 0) >= (prev.updated_at || 0)) {
      map.set(item.id, item)
    }
  }
  const pending = new Set(getPendingDeletes())
  todos.value = [...map.values()].filter(
    (item) => !item.is_deleted && !pending.has(item.id)
  )
  bumpTodoSeqFromTodos(todos.value)
  bump()
}

/** 应用服务端同步结果并更新本地元数据。 */
export function applySyncResult(res, { deletedIds = [], nextWeeks = 1 } = {}) {
  mergeWindowTodos(res.todos)
  listUpdatedAt.value = res.list_updated_at || listUpdatedAt.value
  setLocalTodos(todos.value.map(normalizeTodo))
  setListUpdatedAt(listUpdatedAt.value)
  clearPendingDeletes(deletedIds)
  setSyncWeeks(res.sync_weeks || nextWeeks)
  setSyncExhausted(!res.has_more)
  setCloudCount(Number(res.cloud_count) || 0)
  setLastSyncedAt(listUpdatedAt.value || nowTs())
  syncWeeks.value = getSyncWeeks()
  syncExhausted.value = getSyncExhausted()
  cloudCount.value = getCloudCount()
  localDirty.value = false
  bump()
}

/**
 * Replace local cache with full cloud list (GET /api/todos).
 * Call on login / after weekly sync — App previously only merged a week window.
 */
export async function refreshTodosFromServer() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  try {
    const { fetchTodos } = await import('../api/index.js')
    const res = await fetchTodos()
    const user = getUsername()
    hydratedUser.value = user
    todos.value = (res.todos || [])
      .map(normalizeTodo)
      .filter((item) => !item.is_deleted)
    bumpTodoSeqFromTodos(todos.value)
    listUpdatedAt.value = Number(res.list_updated_at) || 0
    setLocalTodos(todos.value.map(normalizeTodo))
    setListUpdatedAt(listUpdatedAt.value)
    clearPendingDeletes(getPendingDeletes())
    const count = Number(res.cloud_count)
    setCloudCount(Number.isFinite(count) ? count : todos.value.length)
    cloudCount.value = getCloudCount()
    setLastSyncedAt(listUpdatedAt.value || nowTs())
    setSyncWeeks(Number(res.sync_weeks) || 0)
    setSyncExhausted(true)
    syncWeeks.value = getSyncWeeks()
    syncExhausted.value = true
    localDirty.value = false
    bump()
    return { ok: true }
  } catch (e) {
    ensureTodoCache()
    return { ok: false, reason: 'error', error: e }
  }
}

/** 删除指定待办并记录待同步删除。 */
export function removeTodoById(id) {
  ensureTodoCache()
  todos.value = todos.value.filter((t) => t.id !== id)
  addPendingDelete(id)
  persistTodos(true)
}

export {
  todos,
  listUpdatedAt,
  syncWeeks,
  syncExhausted,
  cloudCount,
  localDirty,
  revision,
  hydratedUser,
}
