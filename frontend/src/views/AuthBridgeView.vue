<script setup>
/**
 * Cross-origin auth bridge for the marketing site (iframe / probe / store / logout).
 */
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  getToken,
  getRefreshToken,
  getUsername,
  getNickname,
  getAvatar,
  bindSession,
  clearAuth,
} from '../stores/storage.js'
import { resetTodoCache } from '../stores/todos.js'
import { stopAutoSyncScheduler } from '../stores/autoSync.js'

const MSG_TYPE = 'upgrade_auth_bridge'
const AUTH_HASH_PREFIX = 'upgrade_site_auth='
const route = useRoute()

function post(payload) {
  const msg = { type: MSG_TYPE, source: 'h5', ...payload }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*')
    }
  } catch {
    /* ignore */
  }
}

function currentSession() {
  const access_token = getToken()
  const username = getUsername()
  if (!access_token || !username) return null
  const avatar = String(getAvatar() || '')
  const safeAvatar =
    /^https?:\/\//i.test(avatar) || (avatar && avatar.length <= 2048 && !avatar.startsWith('data:'))
      ? avatar
      : ''
  return {
    access_token,
    refresh_token: getRefreshToken() || '',
    username,
    nickname: getNickname() || '',
    avatar: safeAvatar,
  }
}

function applySession(data) {
  if (!data?.access_token || !data?.username) return false
  bindSession(data.access_token, data.username, {
    nickname: data.nickname || '',
    avatar: data.avatar || '',
    refresh_token: data.refresh_token || '',
  })
  return true
}

function consumeHash() {
  try {
    const hash = String(location.hash || '')
    const idx = hash.indexOf(AUTH_HASH_PREFIX)
    if (idx === -1) return false
    const encoded = hash.slice(idx + AUTH_HASH_PREFIX.length)
    const data = JSON.parse(decodeURIComponent(encoded))
    const ok = applySession(data)
    history.replaceState(null, '', location.pathname + location.search)
    return ok
  } catch {
    return false
  }
}

onMounted(() => {
  const action = String(route.query.action || 'probe')

  if (action === 'logout') {
    stopAutoSyncScheduler()
    clearAuth()
    resetTodoCache()
    post({ action: 'cleared' })
    return
  }

  if (consumeHash() || action === 'store') {
    post({ action: 'stored', session: currentSession() })
    return
  }

  post({ action: 'session', session: currentSession() })
})
</script>

<template>
  <div aria-hidden="true" />
</template>
