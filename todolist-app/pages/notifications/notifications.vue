<script setup>
/**
 * 通知中心页：展示系统通知、详情与已读状态。
 */
import { ref, computed } from 'vue'
import { onShow, onReachBottom, onPageScroll } from '@dcloudio/uni-app'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion } from '../../utils/i18n.js'
import { fetchNotifications } from '../../api/index.js'
import { resyncScrollEdges, onPageScrollEdge } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'
import {
  loadReadSet,
  markIdsRead,
  refreshUnreadCount,
  loadNotificationListCache,
  saveNotificationListCache,
  ensureNotificationConfig,
} from '../../utils/notificationStore.js'

const titleProgress = ref(0)
const pageThemeClass = computed(() => themeClass())
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const items = ref([])
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const readIds = ref(loadReadSet())
const detailVisible = ref(false)
const detailItem = ref(null)

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('notif.title'),
    subtitle: t('notif.subtitle'),
    loading: t('notif.loading'),
    emptyTitle: t('notif.emptyTitle'),
    emptySub: t('notif.emptySub'),
    markAllRead: t('notif.markAllRead'),
    system: t('notif.channel.system'),
    promo: t('notif.channel.promo'),
    back: t('common.back'),
    done: t('notif.done'),
  }
})

const hasMore = computed(() => items.value.length < total.value)
const unreadCount = computed(() => items.value.filter((x) => isUnread(x)).length)

function clientPlatform() {
  try {
    const info = uni.getSystemInfoSync() || {}
    const p = String(info.platform || '').toLowerCase()
    if (p === 'ios' || p === 'android') return p
    const ua = String(info.system || '').toLowerCase()
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'ios'
    if (ua.includes('android')) return 'android'
  } catch {
    // ignore
  }
  return 'web'
}

function isUnread(item) {
  if (item?.is_read) return false
  return item?.id != null && !readIds.value.has(Number(item.id))
}

function markRead(item) {
  if (!item?.id) return
  readIds.value = markIdsRead([item.id])
  refreshUnreadCount({ platform: clientPlatform() }).catch(() => {})
}

function markAllRead() {
  if (!items.value.length || !unreadCount.value) return
  readIds.value = markIdsRead(items.value.map((x) => x.id))
  refreshUnreadCount({ platform: clientPlatform() }).catch(() => {})
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}`
  } catch {
    return String(iso).slice(0, 16)
  }
}

function channelLabel(ch) {
  return ch === 'promo' ? i18n.value.promo : i18n.value.system
}

function previewText(body) {
  const s = String(body || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > 72 ? `${s.slice(0, 72)}…` : s
}

async function load(reset = true) {
  if (reset) {
    loading.value = true
    pageNum.value = 1
    error.value = ''
    readIds.value = loadReadSet()
    const plat = clientPlatform()
    const cached = loadNotificationListCache({ platform: plat, channel: 'system' })
    if (cached?.items?.length && !items.value.length) {
      items.value = cached.items
      total.value = cached.total
    }
  } else {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
  }
  try {
    const plat = clientPlatform()
    if (reset) ensureNotificationConfig({ force: true }).catch(() => {})
    const res = await fetchNotifications({
      pageNum: pageNum.value,
      pageSize,
      platform: plat,
      channel: 'system',
    })
    const list = Array.isArray(res.items) ? res.items : []
    total.value = res.pageInfo?.total ?? list.length
    items.value = reset ? list : items.value.concat(list)
    if (reset) {
      saveNotificationListCache({
        platform: plat,
        channel: 'system',
        items: list,
        total: total.value,
        pageNum: 1,
      })
      await refreshUnreadCount({ platform: plat })
    }
  } catch (e) {
    if (reset) {
      const plat = clientPlatform()
      const cached = loadNotificationListCache({ platform: plat, channel: 'system' })
      if (cached?.items?.length) {
        items.value = cached.items
        total.value = cached.total
      } else if (!items.value.length) {
        error.value = e.message || t('common.requestFailed')
      }
    } else {
      error.value = e.message || t('common.requestFailed')
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function openItem(item) {
  detailItem.value = item
  detailVisible.value = true
  markRead(item)
}

function closeDetail() {
  detailVisible.value = false
  detailItem.value = null
}

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  load(true)
})

onPageScroll((e) => {
  onPageScrollEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
})

onReachBottom(() => {
  if (!hasMore.value || loading.value || loadingMore.value) return
  pageNum.value += 1
  load(false)
})
</script>

<template>
  <view class="page ios-page notif-page" :class="pageThemeClass">
    <CollapsingNavBar
      :title="i18n.title"
      :progress="titleProgress"
      show-back
      :back-label="i18n.back"
      @back="goBack"
    />

    <view class="content ios-content has-collapse-nav">
      <view class="large-title-wrap">
        <view class="title-row">
          <text class="large-title">{{ i18n.title }}</text>
          <view
            class="mark-btn"
            :class="{ disabled: !unreadCount || loading }"
            hover-class="mark-btn-hover"
            :hover-start-time="0"
            :hover-stay-time="80"
            @click="markAllRead"
          >
            <text>{{ i18n.markAllRead }}</text>
          </view>
        </view>
        <text class="subtitle">{{ i18n.subtitle }}</text>
      </view>

      <view v-if="error" class="empty">
        <text class="empty-title">{{ error }}</text>
      </view>
      <view v-else-if="loading && !items.length" class="empty">
        <text class="empty-title">{{ i18n.loading }}</text>
      </view>
      <view v-else-if="!items.length" class="empty">
        <text class="empty-title">{{ i18n.emptyTitle }}</text>
        <text class="empty-sub">{{ i18n.emptySub }}</text>
      </view>
      <view v-else class="group">
        <view
          v-for="(item, idx) in items"
          :key="item.id"
          class="row"
          :class="{ last: idx === items.length - 1, unread: isUnread(item) }"
          hover-class="row-hover"
          :hover-start-time="0"
          :hover-stay-time="80"
          @click="openItem(item)"
        >
          <view class="dot" />
          <view class="row-main">
            <text class="row-title">{{ item.title }}</text>
            <text class="row-meta">
              {{ channelLabel(item.channel) }} · {{ formatTime(item.published_at || item.created_at) }}
            </text>
            <text v-if="item.body" class="row-preview">{{ previewText(item.body) }}</text>
          </view>
          <text class="chev">›</text>
        </view>
      </view>
      <view v-if="loadingMore" class="more">
        <text>{{ i18n.loading }}</text>
      </view>
      <view class="bottom-space" />
    </view>

    <view v-if="detailVisible && detailItem" class="sheet-mask" @click="closeDetail">
      <view class="sheet" @click.stop>
        <text class="sheet-meta">
          {{ channelLabel(detailItem.channel) }} ·
          {{ formatTime(detailItem.published_at || detailItem.created_at) }}
        </text>
        <text class="sheet-title">{{ detailItem.title }}</text>
        <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
          <text class="sheet-body">{{ detailItem.body }}</text>
        </scroll-view>
        <view
          class="sheet-btn"
          hover-class="sheet-btn-hover"
          :hover-start-time="0"
          :hover-stay-time="80"
          @click="closeDetail"
        >
          <text>{{ i18n.done }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.notif-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.content {
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.large-title-wrap {
  padding: 0 8rpx 28rpx;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.large-title {
  flex: 1;
  min-width: 0;
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
  line-height: 1.15;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.4;
}

.mark-btn {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  height: 64rpx;
  padding: 0 28rpx;
  border-radius: 999px;
  background: var(--app-tint-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mark-btn text {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--app-tint);
  white-space: nowrap;
}

.mark-btn-hover {
  opacity: 0.82;
}

.mark-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.group {
  margin-bottom: 24rpx;
  background: var(--app-fill-strong);
  border-radius: var(--app-radius-panel);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 96rpx;
  padding: 24rpx 28rpx;
  border-bottom: 0.5px solid var(--app-separator);
  box-sizing: border-box;
}

.row.last {
  border-bottom: none;
}

.row-hover {
  background: var(--app-fill);
}

.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
}

.row.unread .dot {
  background: var(--app-tint);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  display: block;
  font-size: 30rpx;
  font-weight: 650;
  color: var(--app-label);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row.unread .row-title {
  font-weight: 700;
}

.row-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--app-tertiary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-preview {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chev {
  font-size: 32rpx;
  line-height: 1;
  color: var(--app-tertiary);
  flex-shrink: 0;
  width: 20rpx;
  text-align: center;
}

.empty {
  padding: 96rpx 24rpx;
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 650;
  color: var(--app-label);
}

.empty-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.4;
}

.more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: var(--app-tertiary);
}

.bottom-space {
  height: 40rpx;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: var(--app-scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  touch-action: none;
  overscroll-behavior: none;
}

.sheet {
  width: min(100%, var(--app-sheet-max, 100%));
  max-height: min(78vh, 920rpx);
  background: var(--app-fill-strong);
  border-radius: var(--app-radius-panel) var(--app-radius-panel) 0 0;
  padding: 32rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sheet-meta {
  display: block;
  font-size: 24rpx;
  color: var(--app-tertiary);
  margin-bottom: 12rpx;
}

.sheet-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--app-label);
  line-height: 1.3;
  margin-bottom: 20rpx;
  word-break: break-word;
}

.sheet-scroll {
  flex: 1;
  min-height: 0;
  max-height: 48vh;
  margin-bottom: 24rpx;
}

.sheet-body {
  display: block;
  font-size: 30rpx;
  color: var(--app-label);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  padding-bottom: 8rpx;
}

.sheet-btn {
  height: var(--app-btn-height-sheet, 88rpx);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-fill);
  flex-shrink: 0;
}

.sheet-btn text {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--app-tint);
}

.sheet-btn-hover {
  opacity: 0.85;
}
</style>
