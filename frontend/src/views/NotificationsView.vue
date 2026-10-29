<script setup>
/**
 * 桌面端通知页：浏览通知并维护已读状态。
 */
import { ref, computed, onMounted } from 'vue'
import { fetchNotifications } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'
import {
  loadReadSet,
  markIdsRead,
  refreshUnreadCount,
  loadNotificationListCache,
  saveNotificationListCache,
  ensureNotificationConfig,
} from '../stores/notifications.js'

const loading = ref(false)
const error = ref('')
const items = ref([])
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const selectedId = ref(null)
const readIds = ref(loadReadSet())

const pages = computed(() => Math.ceil(total.value / pageSize) || 0)

const selected = computed(() => {
  if (!selectedId.value) return null
  return items.value.find((x) => x.id === selectedId.value) || null
})

const unreadCount = computed(() => items.value.filter((x) => isUnread(x)).length)

function isUnread(item) {
  if (item?.is_read) return false
  return item?.id != null && !readIds.value.has(Number(item.id))
}

function markRead(item) {
  if (!item?.id) return
  readIds.value = markIdsRead([item.id])
  refreshUnreadCount({ platform: 'pc' }).catch(() => {})
}

function markAllRead() {
  if (!items.value.length) return
  readIds.value = markIdsRead(items.value.map((x) => x.id))
  refreshUnreadCount({ platform: 'pc' }).catch(() => {})
}

function formatTime(iso) {
  void localeVersion.value
  if (!iso) return t('common.dash')
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function channelLabel(ch) {
  void localeVersion.value
  if (ch === 'promo') return t('notif.channel.promo')
  return t('notif.channel.system')
}

async function load() {
  loading.value = true
  error.value = ''
  readIds.value = loadReadSet()
  const cached = loadNotificationListCache({ platform: 'pc', channel: 'system' })
  if (cached?.items?.length && pageNum.value === 1 && !items.value.length) {
    items.value = cached.items
    total.value = cached.total
  }
  try {
    ensureNotificationConfig({ force: true }).catch(() => {})
    const res = await fetchNotifications({
      pageNum: pageNum.value,
      pageSize,
      platform: 'pc',
      channel: 'system',
    })
    items.value = Array.isArray(res.items) ? res.items : []
    total.value = res.pageInfo?.total ?? items.value.length
    if (pageNum.value === 1) {
      saveNotificationListCache({
        platform: 'pc',
        channel: 'system',
        items: items.value,
        total: total.value,
        pageNum: 1,
      })
    }
    if (selectedId.value && !items.value.some((x) => x.id === selectedId.value)) {
      selectedId.value = null
    }
    await refreshUnreadCount({ platform: 'pc' })
  } catch (e) {
    if (!items.value.length && cached?.items?.length) {
      items.value = cached.items
      total.value = cached.total
    }
    if (!items.value.length) {
      error.value = e.message || t('common.requestFailed')
    }
  } finally {
    loading.value = false
  }
}

function openItem(item) {
  selectedId.value = item.id
  markRead(item)
}

function prev() {
  if (pageNum.value > 1) {
    pageNum.value -= 1
    load()
  }
}

function next() {
  if (pageNum.value < pages.value) {
    pageNum.value += 1
    load()
  }
}

onMounted(load)
</script>

<template>
  <div class="notif-layout">
    <section class="panel notif-list">
      <div class="notif-toolbar">
        <p class="page-sub">{{ t('notif.subtitle') }}</p>
        <button
          type="button"
          class="btn btn-ghost btn-compact"
          :disabled="!unreadCount || loading"
          @click="markAllRead"
        >
          {{ t('notif.markAllRead') }}
        </button>
      </div>
      <p v-if="error" class="empty">{{ error }}</p>
      <div v-else-if="loading && !items.length" class="empty">{{ t('notif.loading') }}</div>
      <div v-else-if="!items.length" class="empty">
        <strong>{{ t('notif.emptyTitle') }}</strong>
        {{ t('notif.emptySub') }}
      </div>
      <div v-else class="notif-rows">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="notif-row"
          :class="{ selected: item.id === selectedId, unread: isUnread(item) }"
          @click="openItem(item)"
        >
          <span class="notif-dot" aria-hidden="true" />
          <span class="notif-body">
            <span class="notif-title">{{ item.title }}</span>
            <span class="notif-meta">
              {{ channelLabel(item.channel) }} · {{ formatTime(item.published_at || item.created_at) }}
            </span>
            <span class="notif-preview">{{ item.body }}</span>
          </span>
        </button>
      </div>
      <div v-if="pages > 1" class="notif-pager">
        <button type="button" class="btn btn-ghost btn-compact" :disabled="pageNum <= 1 || loading" @click="prev">
          {{ t('common.prev') }}
        </button>
        <span>{{ pageNum }} / {{ pages }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-compact"
          :disabled="pageNum >= pages || loading"
          @click="next"
        >
          {{ t('common.next') }}
        </button>
      </div>
    </section>

    <aside class="panel notif-detail">
      <template v-if="selected">
        <p class="notif-detail-meta">
          {{ channelLabel(selected.channel) }} · {{ formatTime(selected.published_at || selected.created_at) }}
        </p>
        <h2>{{ selected.title }}</h2>
        <div class="notif-detail-body">{{ selected.body }}</div>
      </template>
      <div v-else class="empty">
        <strong>{{ t('notif.title') }}</strong>
        {{ t('notif.selectHint') }}
      </div>
    </aside>
  </div>
</template>
