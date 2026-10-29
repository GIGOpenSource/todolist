/**
 * 桌面网页端自动同步：定时增量同步本地与云端待办 / 笔记。
 */

import { syncTodos, syncNotes } from '../api/client.js'
import {
  getToken,
  getUsername,
  getPendingDeletes,
  getNotesPendingDeletes,
  getLastAutoSyncDueAt,
  setLastAutoSyncDueAt,
} from './storage.js'
import {
  todos,
  listUpdatedAt,
  syncWeeks,
  syncExhausted,
  ensureTodoCache,
  applySyncResult,
  normalizeTodo,
  refreshTodosFromServer,
} from './todos.js'
import {
  notes,
  listUpdatedAt as notesListUpdatedAt,
  syncWeeks as notesSyncWeeks,
  syncExhausted as notesSyncExhausted,
  ensureNoteCache,
  applyNotesSyncResult,
  normalizeNote,
  refreshNotesFromServer,
} from './notes.js'

export const AUTO_SYNC_HOUR = 4
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ROUNDS = 52
const FORCE_WAIT_MS = 60_000

let timerId = null
let running = false
let schedulerGeneration = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getLastDue4Am(now = Date.now()) {
  const d = new Date(now)
  const today4 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), AUTO_SYNC_HOUR, 0, 0, 0)
  if (now >= today4.getTime()) return today4.getTime()
  return today4.getTime() - DAY_MS
}

export function msUntilNext4Am(now = Date.now()) {
  const d = new Date(now)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), AUTO_SYNC_HOUR, 0, 0, 0)
  if (now >= next.getTime()) next.setDate(next.getDate() + 1)
  return Math.max(1000, next.getTime() - now)
}

export function isAutoSyncDue(now = Date.now()) {
  if (!getToken() || !getUsername()) return false
  return getLastAutoSyncDueAt() < getLastDue4Am(now)
}

function markAutoSyncDone(now = Date.now()) {
  setLastAutoSyncDueAt(getLastDue4Am(now))
}

async function waitForIdle(maxMs = FORCE_WAIT_MS) {
  const start = Date.now()
  while (running && Date.now() - start < maxMs) {
    await sleep(100)
  }
  return !running
}

async function runTodosPipeline() {
  ensureTodoCache()
  const needHistory = !syncExhausted.value
  let rounds = 0
  let lastRes = null

  while (rounds < MAX_ROUNDS) {
    rounds += 1
    const current = syncWeeks.value
    const exhausted = syncExhausted.value
    const nextWeeks = exhausted ? Math.max(1, current || 1) : current + 1
    const deletedIds = getPendingDeletes()

    lastRes = await syncTodos(todos.value.map(normalizeTodo), listUpdatedAt.value, {
      deletedIds,
      syncWeeks: nextWeeks,
    })
    applySyncResult(lastRes, { deletedIds, nextWeeks })

    if (!needHistory) break
    if (!lastRes.has_more) break
  }

  const hydrated = await refreshTodosFromServer()
  return { rounds, lastRes, hydrated }
}

async function runNotesPipeline() {
  ensureNoteCache()
  const needHistory = !notesSyncExhausted.value
  let rounds = 0
  let lastRes = null

  while (rounds < MAX_ROUNDS) {
    rounds += 1
    const current = notesSyncWeeks.value
    const exhausted = notesSyncExhausted.value
    const nextWeeks = exhausted ? Math.max(1, current || 1) : current + 1
    const deletedIds = getNotesPendingDeletes()

    lastRes = await syncNotes(notes.value.map(normalizeNote), notesListUpdatedAt.value, {
      deletedIds,
      syncWeeks: nextWeeks,
    })
    applyNotesSyncResult(lastRes, { deletedIds, nextWeeks })

    if (!needHistory) break
    if (!lastRes.has_more) break
  }

  const hydrated = await refreshNotesFromServer()
  return { rounds, lastRes, hydrated }
}

export async function runAutoSync({ force = false } = {}) {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  if (!force && !isAutoSyncDue()) return { ok: false, reason: 'not_due' }

  if (running) {
    if (!force) return { ok: false, reason: 'busy' }
    const free = await waitForIdle()
    if (!free) return { ok: false, reason: 'busy' }
  }

  running = true
  try {
    const todosResult = await runTodosPipeline()
    const notesResult = await runNotesPipeline()

    if (
      !todosResult.hydrated?.ok &&
      !todosResult.lastRes &&
      !notesResult.hydrated?.ok &&
      !notesResult.lastRes
    ) {
      return {
        ok: false,
        reason: 'error',
        error: todosResult.hydrated?.error || notesResult.hydrated?.error,
      }
    }

    markAutoSyncDone()
    return {
      ok: true,
      rounds: todosResult.rounds + notesResult.rounds,
      hasMore: !!(todosResult.lastRes?.has_more || notesResult.lastRes?.has_more),
    }
  } catch (e) {
    return { ok: false, reason: 'error', error: e }
  } finally {
    running = false
  }
}

export async function runManualSync() {
  return runAutoSync({ force: true })
}

export function maybeRunAutoSync() {
  return runAutoSync({ force: false })
}

export function stopAutoSyncScheduler() {
  schedulerGeneration += 1
  if (timerId != null) {
    clearTimeout(timerId)
    timerId = null
  }
}

export function startAutoSyncScheduler() {
  stopAutoSyncScheduler()
  if (!getToken() || !getUsername()) return

  const gen = schedulerGeneration
  maybeRunAutoSync().catch(() => {})

  const delay = msUntilNext4Am()
  timerId = setTimeout(async () => {
    if (gen !== schedulerGeneration) return
    await runAutoSync({ force: false })
    if (gen !== schedulerGeneration) return
    startAutoSyncScheduler()
  }, delay)
}
