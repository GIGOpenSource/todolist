/**
 * 移动端笔记状态仓库：管理内存缓存、本地持久化与同步结果合并。
 */

import { ref } from 'vue'
import {
  getToken,
  getUsername,
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
} from './storage.js'

const notes = ref([])
const notesListUpdatedAt = ref(0)
const notesSyncWeeks = ref(0)
const notesSyncExhausted = ref(false)
const notesCloudCount = ref(0)
const notesLocalDirty = ref(false)
const notesHydratedUser = ref('')
const notesRevision = ref(0)

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
  notesRevision.value += 1
}

function readMetaFromStorage() {
  notesListUpdatedAt.value = getNotesListUpdatedAt()
  notesSyncWeeks.value = getNotesSyncWeeks()
  notesSyncExhausted.value = getNotesSyncExhausted()
  notesCloudCount.value = getNotesCloudCount()
  notesLocalDirty.value = hasPendingNotesSyncChanges()
}

export function ensureNoteCache() {
  const user = getUsername()
  if (!user) {
    resetNoteCache()
    return notes.value
  }
  if (notesHydratedUser.value === user) {
    return notes.value
  }
  notesHydratedUser.value = user
  notes.value = (getLocalNotes() || []).map(normalizeNote)
  bumpNoteSeqFromNotes(notes.value)
  readMetaFromStorage()
  bump()
  return notes.value
}

export function resetNoteCache() {
  notes.value = []
  notesListUpdatedAt.value = 0
  notesSyncWeeks.value = 0
  notesSyncExhausted.value = false
  notesCloudCount.value = 0
  notesLocalDirty.value = false
  notesHydratedUser.value = ''
  bump()
}

export function persistNotes(bumpTs = true) {
  if (!getUsername()) return
  ensureNoteCache()
  setLocalNotes(notes.value.map(normalizeNote))
  if (bumpTs) {
    const ts = nowTs()
    notesListUpdatedAt.value = ts
    setNotesListUpdatedAt(ts)
    notesLocalDirty.value = true
  } else {
    setNotesListUpdatedAt(notesListUpdatedAt.value)
  }
  bump()
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
  notesListUpdatedAt.value = res.list_updated_at || notesListUpdatedAt.value
  setLocalNotes(notes.value.map(normalizeNote))
  setNotesListUpdatedAt(notesListUpdatedAt.value)
  clearNotesPendingDeletes(deletedIds)
  setNotesSyncWeeks(res.sync_weeks || nextWeeks)
  setNotesSyncExhausted(!res.has_more)
  setNotesCloudCount(Number(res.cloud_count) || 0)
  setNotesLastSyncedAt(notesListUpdatedAt.value || nowTs())
  notesSyncWeeks.value = getNotesSyncWeeks()
  notesSyncExhausted.value = getNotesSyncExhausted()
  notesCloudCount.value = getNotesCloudCount()
  notesLocalDirty.value = false
  bump()
}

export async function refreshNotesFromServer() {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  try {
    const { fetchNotes } = await import('../api/index.js')
    const res = await fetchNotes()
    const user = getUsername()
    notesHydratedUser.value = user
    notes.value = (res.notes || [])
      .map(normalizeNote)
      .filter((item) => !item.is_deleted)
    bumpNoteSeqFromNotes(notes.value)
    notesListUpdatedAt.value = Number(res.list_updated_at) || 0
    setLocalNotes(notes.value.map(normalizeNote))
    setNotesListUpdatedAt(notesListUpdatedAt.value)
    clearNotesPendingDeletes(getNotesPendingDeletes())
    const count = Number(res.cloud_count)
    setNotesCloudCount(Number.isFinite(count) ? count : notes.value.length)
    notesCloudCount.value = getNotesCloudCount()
    setNotesLastSyncedAt(notesListUpdatedAt.value || nowTs())
    setNotesSyncWeeks(Number(res.sync_weeks) || 0)
    setNotesSyncExhausted(true)
    notesSyncWeeks.value = getNotesSyncWeeks()
    notesSyncExhausted.value = true
    notesLocalDirty.value = false
    bump()
    return { ok: true }
  } catch (e) {
    ensureNoteCache()
    return { ok: false, reason: 'error', error: e }
  }
}

export function removeNoteById(id) {
  ensureNoteCache()
  notes.value = notes.value.filter((n) => n.id !== id)
  addNotesPendingDelete(id)
  persistNotes(true)
}

export {
  notes,
  notesListUpdatedAt as listUpdatedAt,
  notesSyncWeeks as syncWeeks,
  notesSyncExhausted as syncExhausted,
  notesCloudCount as cloudCount,
  notesLocalDirty as localDirty,
  notesRevision as revision,
  notesHydratedUser as hydratedUser,
}
