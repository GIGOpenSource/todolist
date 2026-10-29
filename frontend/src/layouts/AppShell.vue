<script setup>
/**
 * PC 主壳布局：侧栏导航、主题与登录态出口。
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoUrl from '../utils/brand.js'
import { t, localeVersion } from '../i18n/index.js'
import { getTheme, toggleTheme, themeClass } from '../stores/theme.js'
import { getDisplayName, getAvatar, touchActiveDay, syncStreakToServer } from '../stores/storage.js'
import { ensureTodoCache, localDirty } from '../stores/todos.js'
import { ensureNoteCache } from '../stores/notes.js'
import { runManualSync, startAutoSyncScheduler } from '../stores/autoSync.js'
import { touchStreak } from '../api/client.js'
import { toast } from '../utils/toast.js'
import AppDownloadEntry from '../components/AppDownloadEntry.vue'
import { refreshUnreadCount, unreadCount, hasUnread } from '../stores/notifications.js'

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const syncing = ref(false)
const dark = ref(getTheme() === 'dark')

const nav = computed(() => {
  void localeVersion.value
  return [
    { name: 'tasks', label: t('tab.tasks') },
    { name: 'notes', label: t('tab.notes') },
    { name: 'calendar', label: t('tab.calendar') },
    { name: 'stats', label: t('tab.stats') },
    { name: 'profile', label: t('tab.profile') },
  ]
})

const title = computed(() => {
  void localeVersion.value
  const key = route.meta.titleKey
  return key ? t(key) : 'Upgrade'
})

/** Tasks / Calendar: full-bleed content (no max-width column) */
const pageBleed = computed(() => route.name === 'tasks' || route.name === 'calendar' || route.name === 'notes')

const profileTick = ref(0)

const displayName = computed(() => {
  void localeVersion.value
  void profileTick.value
  return getDisplayName() || t('common.user')
})

const avatar = computed(() => {
  void profileTick.value
  return getAvatar()
})

const avatarLetter = computed(() => {
  const name = displayName.value || t('common.user')
  return String(name).slice(0, 1).toUpperCase()
})

onMounted(() => {
  // Local todo/note cache only; full cloud pull is 4 AM / manual sync / login.
  ensureTodoCache()
  ensureNoteCache()
  startAutoSyncScheduler()
  refreshUnreadCount({ platform: 'pc' }).catch(() => {})
})

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
    profileTick.value += 1
    touchActiveDay()
    ensureTodoCache()
    ensureNoteCache()
    syncStreakToServer(touchStreak).catch(() => {})
    if (route.name !== 'notifications') {
      refreshUnreadCount({ platform: 'pc' }).catch(() => {})
    }
  },
  { immediate: true }
)

async function onSync() {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await runManualSync()
    if (res.ok) toast(t('todos.syncSuccess'))
    else if (res.reason === 'busy') toast(t('todos.syncing'))
    else if (res.reason === 'auth') toast(t('common.relogin'))
    else toast(res.error?.message || t('todos.syncFailed'))
  } catch (e) {
    toast(e.message || t('todos.syncFailed'))
  } finally {
    syncing.value = false
  }
}

function onToggleTheme() {
  dark.value = toggleTheme() === 'dark'
}

function onBack() {
  if (route.name === 'report') {
    router.push({ name: 'stats' })
    return
  }
  if (route.name === 'notifications') {
    router.push({ name: 'profile' })
    return
  }
  router.back()
}
</script>

<template>
  <div class="app-shell" :class="themeClass()">
    <div v-if="sidebarOpen" class="sidebar-scrim" @click="sidebarOpen = false" />
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="Upgrade" width="28" height="28" />
        <span class="brand-word">Upgrade</span>
      </div>
      <nav class="nav-list" aria-label="Primary">
        <router-link
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="nav-item"
          active-class="active"
          >{{ item.label }}</router-link
        >
      </nav>
      <div class="sidebar-foot">
        <AppDownloadEntry placement="sidebar" />
        <div class="user-chip">
          <img v-if="avatar" class="user-chip-avatar" :src="avatar" alt="" />
          <span v-else class="user-chip-avatar letter" aria-hidden="true">{{ avatarLetter }}</span>
          <span class="user-chip-name">{{ displayName }}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-compact" @click="onToggleTheme">
          {{ dark ? '◐' : '☀' }} {{ t('profile.darkMode') }}
        </button>
      </div>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <div class="topbar-left">
          <button type="button" class="menu-btn" aria-label="Menu" @click="sidebarOpen = true">
            ☰
          </button>
          <button
            v-if="route.name === 'report' || route.name === 'notifications'"
            type="button"
            class="btn btn-ghost btn-compact topbar-back"
            @click="onBack"
          >
            {{ route.name === 'report' ? t('report.back') : t('common.back') }}
          </button>
          <h1 class="topbar-title">{{ title }}</h1>
        </div>
        <div class="topbar-actions">
          <button
            type="button"
            class="btn btn-secondary btn-compact"
            :disabled="syncing"
            @click="onSync"
          >
            {{ syncing ? t('todos.syncing') : t('todos.sync') }}
            <span v-if="localDirty" class="dirty-dot" title="Unsynced" />
          </button>
          <button
            v-if="route.name !== 'notifications'"
            type="button"
            class="btn btn-ghost btn-compact notif-entry"
            :aria-label="t('profile.notifications')"
            :title="t('profile.notifications')"
            @click="router.push({ name: 'notifications' })"
          >
            <svg class="notif-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Zm-2 1H6v-6a6 6 0 1 1 12 0v6Z"
              />
            </svg>
            <span v-if="hasUnread" class="notif-badge" :title="String(unreadCount)">
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </button>
          <button
            v-if="route.name !== 'report'"
            type="button"
            class="btn btn-ghost btn-compact"
            @click="router.push({ name: 'report' })"
          >
            {{ t('report.entry') }}
          </button>
        </div>
      </header>
      <main class="page-body" :class="{ 'page-bleed': pageBleed }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar-back {
  flex-shrink: 0;
  padding-inline: 10px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-secondary);
  padding: 4px 8px;
}

.user-chip-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--app-fill);
}

.user-chip-avatar.letter {
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--app-tint);
  background: var(--app-tint-soft);
}

.user-chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--app-warning);
  display: inline-block;
}

.notif-entry {
  position: relative;
  width: 36px;
  min-width: 36px;
  padding: 0;
  justify-content: center;
}

.notif-icon {
  display: block;
  flex-shrink: 0;
}

.notif-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin: 0;
  border-radius: 999px;
  background: var(--app-danger);
  color: var(--app-on-tint);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
</style>
