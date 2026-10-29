/**
 * 桌面网页端笔记仓库：管理缓存、编辑提交与云端同步合并。
 */

import { ref } from 'vue'
import {
  getUsername,
  getToken,
  getLocalNotes,
  setLocalNotes,
  getNotesListUpdatedAt,
  setNotesListUpdatedAt,
  getNotesSyncWeeks,
  setNotesSyncWeeks,
  getNotesSyncExhausted,
  setNotesSyncExhausted,
  getNotesCloudCount,
  setNotesCloudCount,
  setNotesLastSyncedAt,
  hasPendingNotesSyncChanges,
  getNotesPendingDeletes,
  clearNotesPendingDeletes,
  addNotesPendingDelete,
  nowTs,
  bumpNoteSeqFromNotes,
  genNoteId,
} from './storage.js'

const notes = ref([])
const listUpdatedAt = ref(0)
const syncWeeks = ref(0)
const syncExhausted = ref(false)
const cloudCount = ref(0)
const localDirty = ref(false)
const hydratedUser = ref('')
const revision = ref(0)
const loading = ref(false)
const committing = ref(false)

let writeChain = Promise.resolve()

export function normalizeNote(n) {
  return {
    id: n?.id,
    title: n?.title || '',
    content: n?.content || '',
    is_deleted: !!(n?.is_deleted ?? n?.is_delete),
    created_at: n?.created_at,
    updated_at: n?.updated_at,
  }
}

function bump() {
  revision.value += 1
}

function readMetaFromStorage() {
  listUpdatedAt.value = getNotesListUpdatedAt()
  syncWeeks.value = getNotesSyncWeeks()
  syncExhausted.value = getNotesSyncExhausted()
  cloudCount.value = getNotesCloudCount()
  localDirty.value = hasPendingNotesSyncChanges()
}

async function getClient() {
  return import('../api/client.js')
}

export function ensureNoteCache() {
  const user = getUsername()
  if (!user) {
    resetNoteCache()
    return notes.value
  }
  if (hydratedUser.value === user) return notes.value
  hydratedUser.value = user
  notes.value = (getLocalNotes() || []).map(normalizeNote)
  bumpNoteSeqFromNotes(notes.value)
  readMetaFromStorage()
  bump()
  return notes.value
}

export function resetNoteCache() {
  notes.value = []
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

export function persistNotes(bumpTs = true) {
  if (!getUsername()) return
  ensureNoteCache()
  setLocalNotes(notes.value.map(normalizeNote))
  if (bumpTs) {
    const ts = nowTs()
    listUpdatedAt.value = ts
    setNotesListUpdatedAt(ts)
    localDirty.value = true
  } else {
    setNotesListUpdatedAt(listUpdatedAt.value)
  }
  bump()
}

export async function refreshNotesFromServer() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  loading.value = true
  try {
    const { fetchNotes } = await getClient()
    const res = await fetchNotes()
    const user = getUsername()
    hydratedUser.value = user
    notes.value = (res.notes || [])
      .map(normalizeNote)
      .filter((item) => !item.is_deleted)
    bumpNoteSeqFromNotes(notes.value)
    listUpdatedAt.value = Number(res.list_updated_at) || 0
    setLocalNotes(notes.value.map(normalizeNote))
    setNotesListUpdatedAt(listUpdatedAt.value)
    clearNotesPendingDeletes(getNotesPendingDeletes())
    const count = Number(res.cloud_count)
    setNotesCloudCount(Number.isFinite(count) ? count : notes.value.length)
    cloudCount.value = getNotesCloudCount()
    setNotesLastSyncedAt(listUpdatedAt.value || nowTs())
    setNotesSyncWeeks(Number(res.sync_weeks) || 0)
    setNotesSyncExhausted(true)
    syncWeeks.value = getNotesSyncWeeks()
    syncExhausted.value = true
    localDirty.value = false
    bump()
    return { ok: true }
  } catch (e) {
    ensureNoteCache()
    return { ok: false, reason: 'error', error: e }
  } finally {
    loading.value = false
  }
}

export async function commitNotes() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  ensureNoteCache()
  const deletedIds = getNotesPendingDeletes()
  committing.value = true
  try {
    const { syncNotes } = await getClient()
    const res = await syncNotes(notes.value.map(normalizeNote), listUpdatedAt.value, {
      deletedIds,
      syncWeeks: 1,
      clientHint: { dirty_only: true },
    })
    if (res.list_updated_at != null) {
      listUpdatedAt.value = Number(res.list_updated_at) || listUpdatedAt.value
      setNotesListUpdatedAt(listUpdatedAt.value)
    }
    clearNotesPendingDeletes(deletedIds)
    const count = Number(res.cloud_count)
    if (Number.isFinite(count)) {
      setNotesCloudCount(count)
      cloudCount.value = count
    } else {
      setNotesCloudCount(notes.value.length)
      cloudCount.value = notes.value.length
    }
    setNotesLastSyncedAt(listUpdatedAt.value || nowTs())
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
  const run = () => commitNotes()
  writeChain = writeChain.then(run, run)
  return writeChain
}

export function mergeWindowNotes(incoming) {
  ensureNoteCache()
  const map = new Map(notes.value.map((n) => [n.id, n]))
  for (const raw of incoming || []) {
    const item = normalizeNote(raw)
    const prev = map.get(item.id)
    if (!prev || (item.updated_at || 0) >= (prev.updated_at || 0)) {
      map.set(item.id, item)
    }
  }
  const pending = new Set(getNotesPendingDeletes())
  notes.value = [...map.values()].filter(
    (item) => !item.is_deleted && !pending.has(item.id)
  )
  bumpNoteSeqFromNotes(notes.value)
  bump()
}

export function applyNotesSyncResult(res, { deletedIds = [], nextWeeks = 1 } = {}) {
  mergeWindowNotes(res.notes)
  listUpdatedAt.value = res.list_updated_at || listUpdatedAt.value
  setLocalNotes(notes.value.map(normalizeNote))
  setNotesListUpdatedAt(listUpdatedAt.value)
  clearNotesPendingDeletes(deletedIds)
  setNotesSyncWeeks(res.sync_weeks || nextWeeks)
  setNotesSyncExhausted(!res.has_more)
  setNotesCloudCount(Number(res.cloud_count) || 0)
  setNotesLastSyncedAt(listUpdatedAt.value || nowTs())
  syncWeeks.value = getNotesSyncWeeks()
  syncExhausted.value = getNotesSyncExhausted()
  cloudCount.value = getNotesCloudCount()
  localDirty.value = false
  bump()
}

export async function removeNoteById(id) {
  ensureNoteCache()
  notes.value = notes.value.filter((n) => n.id !== id)
  addNotesPendingDelete(id)
  persistNotes(true)
  return enqueueCommit()
}

export async function patchNote(id, patch) {
  ensureNoteCache()
  const idx = notes.value.findIndex((n) => n.id === id)
  if (idx < 0) return null
  const next = { ...notes.value[idx], ...patch, updated_at: nowTs() }
  notes.value.splice(idx, 1, normalizeNote(next))
  persistNotes(true)
  const commitRes = await enqueueCommit()
  return { item: notes.value.find((n) => n.id === id) || null, commit: commitRes }
}

export async function addNote(title, content = '') {
  ensureNoteCache()
  const ts = nowTs()
  const item = {
    id: genNoteId(),
    title: String(title || '').trim() || 'Untitled',
    content: content || '',
    created_at: ts,
    updated_at: ts,
  }
  notes.value.unshift(item)
  persistNotes(true)
  const commitRes = await enqueueCommit()
  return { item, commit: commitRes }
}

export {
  notes,
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
