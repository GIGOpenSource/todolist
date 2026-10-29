/**
 * 桌面网页端待办仓库：管理缓存、编辑提交与云端同步合并。
 */

import { ref } from 'vue'
import {
  getUsername,
  getToken,
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
  getLastSyncedAt,
  setLastSyncedAt,
  hasPendingSyncChanges,
  getPendingDeletes,
  clearPendingDeletes,
  addPendingDelete,
  nowTs,
  bumpTodoSeqFromTodos,
  genTodoId,
} from './storage.js'

const todos = ref([])
const listUpdatedAt = ref(0)
const syncWeeks = ref(0)
const syncExhausted = ref(false)
const cloudCount = ref(0)
const localDirty = ref(false)
const hydratedUser = ref('')
const revision = ref(0)
const loading = ref(false)
const committing = ref(false)

/** Serialize API writes so rapid toggles don't race */
let writeChain = Promise.resolve()

/** 规范化待办字段与日期。 */
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

async function getClient() {
  return import('../api/client.js')
}

/** 确保当前账号待办已载入内存。 */
export function ensureTodoCache() {
  const user = getUsername()
  if (!user) {
    resetTodoCache()
    return todos.value
  }
  if (hydratedUser.value === user) return todos.value
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
  loading.value = false
  committing.value = false
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
 * Replace local cache with full cloud list (GET /api/todos).
 * Call on login / app shell enter — no manual sync.
 */
export async function refreshTodosFromServer() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  loading.value = true
  try {
    const { fetchTodos } = await getClient()
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
    // Fall back to local cache so UI still works offline briefly
    ensureTodoCache()
    return { ok: false, reason: 'error', error: e }
  } finally {
    loading.value = false
  }
}

/**
 * Push local mutations to cloud immediately via PUT /api/todos/sync.
 */
export async function commitTodos() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  ensureTodoCache()
  const deletedIds = getPendingDeletes()
  committing.value = true
  try {
    const { syncTodos } = await getClient()
    const res = await syncTodos(
      todos.value.map(normalizeTodo),
      listUpdatedAt.value,
      {
        deletedIds,
        syncWeeks: 1,
        clientHint: { dirty_only: true },
      }
    )
    if (res.list_updated_at != null) {
      listUpdatedAt.value = Number(res.list_updated_at) || listUpdatedAt.value
      setListUpdatedAt(listUpdatedAt.value)
    }
    clearPendingDeletes(deletedIds)
    const count = Number(res.cloud_count)
    if (Number.isFinite(count)) {
      setCloudCount(count)
      cloudCount.value = count
    } else {
      setCloudCount(todos.value.length)
      cloudCount.value = todos.value.length
    }
    setLastSyncedAt(listUpdatedAt.value || nowTs())
    localDirty.value = false
    bump()
    return { ok: true }
  } catch (e) {
    localDirty.value = true
    return { ok: false, reason: 'error', error: e }
  } finally {
    committing.value = false
  }
}

function enqueueCommit() {
  const run = () => commitTodos()
  writeChain = writeChain.then(run, run)
  return writeChain
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

/** 删除指定待办并记录待同步删除。 */
export async function removeTodoById(id) {
  ensureTodoCache()
  todos.value = todos.value.filter((t) => t.id !== id)
  addPendingDelete(id)
  persistTodos(true)
  return enqueueCommit()
}

/** 更新指定待办并提交变更。 */
export async function patchTodo(id, patch) {
  ensureTodoCache()
  const idx = todos.value.findIndex((t) => t.id === id)
  if (idx < 0) return null
  const next = { ...todos.value[idx], ...patch }
  todos.value.splice(idx, 1, normalizeTodo(next))
  persistTodos(true)
  const commitRes = await enqueueCommit()
  return { item: todos.value.find((t) => t.id === id) || null, commit: commitRes }
}

/** 创建待办并提交变更。 */
export async function addTodo(title) {
  ensureTodoCache()
  const ts = nowTs()
  const item = {
    id: genTodoId(),
    title: title.trim(),
    detail: '',
    due_at: 0,
    completed: false,
    created_at: ts,
    updated_at: ts,
  }
  todos.value.unshift(item)
  persistTodos(true)
  const commitRes = await enqueueCommit()
  return { item, commit: commitRes }
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
  loading,
  committing,
}
