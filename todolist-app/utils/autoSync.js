/**
 * 移动端自动同步调度：按本地时间增量拉取并回传待办与笔记变更。
 */

import { syncTodos, syncNotes } from '../api/index.js'
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
} from './todoStore.js'
import {
  notes,
  listUpdatedAt as notesListUpdatedAt,
  syncWeeks as notesSyncWeeks,
  syncExhausted as notesSyncExhausted,
  ensureNoteCache,
  applyNotesSyncResult,
  normalizeNote,
  refreshNotesFromServer,
} from './noteStore.js'

/** Local wall-clock hour for daily background sync */
export const AUTO_SYNC_HOUR = 4

/** Spread 04:00 herd across this many minutes (Phase B) */
export const AUTO_SYNC_JITTER_MINUTES = 45

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ROUNDS = 52
const ROUND_GAP_MS = 350
const MAX_RETRIES = 3
const FORCE_WAIT_MS = 60_000

let timerId = null
let running = false
let schedulerGeneration = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitterMs(maxMinutes = AUTO_SYNC_JITTER_MINUTES) {
  const span = Math.max(0, Number(maxMinutes) || 0) * 60 * 1000
  if (!span) return 0
  return Math.floor(Math.random() * span)
}

/** 计算最近一次已到达的自动同步时间点。 */
export function getLastDue4Am(now = Date.now()) {
  const d = new Date(now)
  const today4 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), AUTO_SYNC_HOUR, 0, 0, 0)
  if (now >= today4.getTime()) return today4.getTime()
  return today4.getTime() - DAY_MS
}

/** 计算距离下次自动同步的毫秒数。 */
export function msUntilNext4Am(now = Date.now()) {
  const d = new Date(now)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), AUTO_SYNC_HOUR, 0, 0, 0)
  if (now >= next.getTime()) next.setDate(next.getDate() + 1)
  return Math.max(1000, next.getTime() - now)
}

/** 判断当前是否需要自动同步。 */
export function isAutoSyncDue(now = Date.now()) {
  if (!getToken() || !getUsername()) return false
  return getLastAutoSyncDueAt() < getLastDue4Am(now)
}

function markAutoSyncDone(now = Date.now()) {
  setLastAutoSyncDueAt(getLastDue4Am(now))
}

function isRetryableSyncError(err) {
  const code = err && err.code
  if (code === 42901) return true
  const msg = String((err && err.message) || '')
  return /timeout|network|fail|429|503/i.test(msg)
}

async function syncTodosOnceWithRetry(payload) {
  let lastErr = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await syncTodos(payload.todos, payload.listUpdatedAt, {
        deletedIds: payload.deletedIds,
        syncWeeks: payload.syncWeeks,
      })
    } catch (e) {
      lastErr = e
      if (!isRetryableSyncError(e) || attempt === MAX_RETRIES - 1) throw e
      await sleep(400 * 2 ** attempt)
    }
  }
  throw lastErr
}

async function syncNotesOnceWithRetry(payload) {
  let lastErr = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await syncNotes(payload.notes, payload.listUpdatedAt, {
        deletedIds: payload.deletedIds,
        syncWeeks: payload.syncWeeks,
      })
    } catch (e) {
      lastErr = e
      if (!isRetryableSyncError(e) || attempt === MAX_RETRIES - 1) throw e
      await sleep(400 * 2 ** attempt)
    }
  }
  throw lastErr
}

async function waitForIdle(maxMs = FORCE_WAIT_MS) {
  const start = Date.now()
  while (running && Date.now() - start < maxMs) {
    await sleep(100)
  }
  return !running
}

async function runTodosSyncPipeline() {
  ensureTodoCache()
  const needHistory = !syncExhausted.value
  let rounds = 0
  let lastRes = null
  const started = Date.now()
  const budgetMs = 2 * 60 * 1000

  while (rounds < MAX_ROUNDS) {
    if (Date.now() - started > budgetMs) break
    rounds += 1
    const current = syncWeeks.value
    const exhausted = syncExhausted.value
    const nextWeeks = exhausted ? Math.max(1, current || 1) : current + 1
    const deletedIds = getPendingDeletes()

    lastRes = await syncTodosOnceWithRetry({
      todos: todos.value.map(normalizeTodo),
      listUpdatedAt: listUpdatedAt.value,
      deletedIds,
      syncWeeks: nextWeeks,
    })
    applySyncResult(lastRes, { deletedIds, nextWeeks })

    if (!needHistory) break
    if (!lastRes.has_more) break
    await sleep(ROUND_GAP_MS)
  }

  await refreshTodosFromServer().catch(() => {})
  return { rounds, hasMore: !!(lastRes && lastRes.has_more) }
}

async function runNotesSyncPipeline() {
  ensureNoteCache()
  const needHistory = !notesSyncExhausted.value
  let rounds = 0
  let lastRes = null
  const started = Date.now()
  const budgetMs = 2 * 60 * 1000

  while (rounds < MAX_ROUNDS) {
    if (Date.now() - started > budgetMs) break
    rounds += 1
    const current = notesSyncWeeks.value
    const exhausted = notesSyncExhausted.value
    const nextWeeks = exhausted ? Math.max(1, current || 1) : current + 1
    const deletedIds = getNotesPendingDeletes()

    lastRes = await syncNotesOnceWithRetry({
      notes: notes.value.map(normalizeNote),
      listUpdatedAt: notesListUpdatedAt.value,
      deletedIds,
      syncWeeks: nextWeeks,
    })
    applyNotesSyncResult(lastRes, { deletedIds, nextWeeks })

    if (!needHistory) break
    if (!lastRes.has_more) break
    await sleep(ROUND_GAP_MS)
  }

  await refreshNotesFromServer().catch(() => {})
  return { rounds, hasMore: !!(lastRes && lastRes.has_more) }
}

/**
 * Quiet cloud sync for the daily 4 AM window.
 * Runs todos then notes pipelines under one lock.
 */
export async function runAutoSync({ force = false, skipJitter = false } = {}) {
  if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
  if (!force && !isAutoSyncDue()) return { ok: false, reason: 'not_due' }

  if (!force && !skipJitter) {
    await sleep(jitterMs())
    if (!getToken() || !getUsername()) return { ok: false, reason: 'auth' }
    if (!isAutoSyncDue()) return { ok: false, reason: 'not_due' }
  }

  if (running) {
    if (!force) return { ok: false, reason: 'busy' }
    const free = await waitForIdle()
    if (!free) return { ok: false, reason: 'busy' }
  }

  running = true
  try {
    const todosResult = await runTodosSyncPipeline()
    const notesResult = await runNotesSyncPipeline()
    markAutoSyncDone()
    return {
      ok: true,
      rounds: todosResult.rounds + notesResult.rounds,
      hasMore: !!(todosResult.hasMore || notesResult.hasMore),
    }
  } catch (e) {
    return { ok: false, reason: 'error', error: e }
  } finally {
    running = false
  }
}

/** 立即执行一次手动同步。 */
export async function runManualSync() {
  return runAutoSync({ force: true, skipJitter: true })
}

/** 在满足条件时触发自动同步。 */
export function maybeRunAutoSync() {
  return runAutoSync({ force: false })
}

function clearTimer() {
  if (timerId != null) {
    clearTimeout(timerId)
    timerId = null
  }
}

/** 停止自动同步调度器。 */
export function stopAutoSyncScheduler() {
  schedulerGeneration += 1
  clearTimer()
}

/**
 * Catch up if past today's 4 AM window, then schedule the next local 4 AM tick.
 */
export function startAutoSyncScheduler() {
  stopAutoSyncScheduler()
  if (!getToken() || !getUsername()) return

  const gen = schedulerGeneration
  maybeRunAutoSync().catch(() => {})

  const delay = msUntilNext4Am()
  timerId = setTimeout(async () => {
    if (gen !== schedulerGeneration) return
    await runAutoSync({ force: false, skipJitter: false })
    if (gen !== schedulerGeneration) return
    startAutoSyncScheduler()
  }, delay)
}
