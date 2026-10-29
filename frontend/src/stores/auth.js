/**
 * 桌面网页端鉴权状态：处理会话进入、退出与用户资料。
 */

import {
  bindSession,
  clearAuth,
  getToken,
  getUsername,
  getDisplayName,
  getNickname,
  getAvatar,
  getSignature,
  getGender,
  setProfileCache,
} from './storage.js'
import { resetTodoCache, refreshTodosFromServer } from './todos.js'
import { resetNoteCache, refreshNotesFromServer } from './notes.js'
import { startAutoSyncScheduler, stopAutoSyncScheduler } from './autoSync.js'
import { pushSessionToSite, clearSessionOnSite } from '../utils/siteReturn.js'

/** 写入会话并初始化账号状态。 */
export async function enterSession(res) {
  bindSession(res.access_token, res.username, {
    nickname: res.nickname,
    avatar: res.avatar,
    signature: res.signature,
    gender: res.gender,
    refresh_token: res.refresh_token || '',
    user_id: res.user_id,
  })
  resetTodoCache()
  resetNoteCache()
  await Promise.all([refreshTodosFromServer(), refreshNotesFromServer()])
  startAutoSyncScheduler()
  pushSessionToSite({
    access_token: res.access_token,
    refresh_token: res.refresh_token || '',
    username: res.username,
    nickname: res.nickname || '',
    avatar: res.avatar || '',
  }).catch(() => {})
}

/** 退出会话并清理运行时状态。 */
export async function leaveSession() {
  stopAutoSyncScheduler()
  try {
    const m = await import('../api/client.js')
    await m.logout?.()
  } catch {
    // still clear local session
  }
  clearAuth()
  resetTodoCache()
  resetNoteCache()
  clearSessionOnSite().catch(() => {})
}

export {
  getToken,
  getUsername,
  getDisplayName,
  getNickname,
  getAvatar,
  getSignature,
  getGender,
  setProfileCache,
  bindSession,
  clearAuth,
}
