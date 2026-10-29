<script setup>
/**
 * 统计页：汇总待办完成情况与趋势数据。
 */
import { ref, computed, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlassTabBar from '../../components/GlassTabBar.vue'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import { resyncScrollEdges, onScrollViewEdge } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'
import {
  getToken,
  getUsername,
  getDisplayName,
  getAvatar,
  touchActiveDay,
  getStreakDays,
  syncStreakToServer,
} from '../../utils/storage.js'
import { todos, ensureTodoCache, revision } from '../../utils/todoStore.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion } from '../../utils/i18n.js'
import { touchStreak } from '../../api/index.js'
import { BRAND_LOGO } from '../../utils/brand.js'
import {
  collectStreakPosterData,
  renderStreakPoster,
  downloadDataUrl,
} from '../../utils/streakPoster.js'
import { sharePosterToChannel } from '../../utils/shareChannels.js'

const streak = ref(0)
const titleProgress = ref(0)
const pageThemeClass = computed(() => themeClass())

const posterOpen = ref(false)
const posterStatus = ref('')
const posterDataUrl = ref('')
const posterReady = ref(false)
const sharing = ref(false)
const channelBusy = ref('')

function onStatsScroll(e) {
  onScrollViewEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
}

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('stats.title'),
    subtitle: t('stats.subtitle'),
    all: t('stats.all'),
    pending: t('stats.pending'),
    done: t('stats.done'),
    rate: t('stats.rate'),
    last7: t('stats.last7'),
    legendCreated: t('stats.legendCreated'),
    legendFinished: t('stats.legendFinished'),
    streak: t('stats.streak'),
    streakDays: t('stats.streakDays', { n: streak.value }),
    streakHint: t('stats.streakHint'),
    streakShare: t('stats.streakShare'),
    posterModalTitle: t('stats.streakPosterModalTitle'),
    posterRendering: t('stats.streakPosterRendering'),
    posterDownload: t('stats.streakPosterDownload'),
    posterClose: t('stats.streakPosterClose'),
    shareChannelHint: t('stats.shareChannelHint'),
    shareInstagram: t('stats.shareInstagram'),
    shareFacebook: t('stats.shareFacebook'),
    reportEntry: t('report.entry'),
  }
})

function goReport() {
  uni.navigateTo({ url: '/pages/report/report' })
}

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function refresh() {
  touchActiveDay()
  ensureTodoCache()
  void revision.value
  streak.value = getStreakDays()
  syncStreakToServer(touchStreak).then((n) => {
    if (typeof n === 'number') streak.value = n
  })
}

function closePosterModal() {
  posterOpen.value = false
  posterStatus.value = ''
  if (!sharing.value) {
    posterDataUrl.value = ''
    posterReady.value = false
  }
}

function downloadPoster() {
  if (!posterDataUrl.value) return
  downloadDataUrl(
    posterDataUrl.value,
    `${t('stats.streakPosterFilename')}-${streak.value}.png`
  )
  uni.showToast({ title: t('report.saved'), icon: 'success' })
}

async function shareToChannel(channel) {
  if (!posterReady.value || !posterDataUrl.value || channelBusy.value) return
  channelBusy.value = channel
  const filename = `${t('stats.streakPosterFilename')}-${streak.value}.png`
  const title = t('stats.streakPosterTitle', { n: streak.value })
  const text = `${title} · Upgrade`
  try {
    const result = await sharePosterToChannel(channel, {
      dataUrl: posterDataUrl.value,
      filename,
      title,
      text,
    })
    if (result.reason === 'cancelled') {
      uni.showToast({ title: t('stats.shareCancelled'), icon: 'none' })
      return
    }
    if (result.method === 'files' || result.method === 'text') {
      uni.showToast({ title: t('report.saved'), icon: 'success' })
      return
    }
    if (channel === 'instagram') {
      uni.showToast({ title: t('stats.shareIgFallback'), icon: 'none', duration: 2800 })
    } else if (channel === 'facebook') {
      uni.showToast({ title: t('stats.shareFbFallback'), icon: 'none', duration: 2800 })
    } else if (!result.ok) {
      uni.showToast({ title: t('stats.shareFailed'), icon: 'none' })
    }
  } catch (_) {
    uni.showToast({ title: t('stats.shareFailed'), icon: 'none' })
  } finally {
    channelBusy.value = ''
  }
}

async function handleShareStreak() {
  if (sharing.value) return
  if (typeof document === 'undefined') {
    uni.showToast({ title: t('report.posterErrorH5'), icon: 'none' })
    return
  }

  sharing.value = true
  posterOpen.value = true
  posterReady.value = false
  posterDataUrl.value = ''
  posterStatus.value = i18n.value.posterRendering

  try {
    await nextTick()
    const data = collectStreakPosterData({
      days: streak.value,
      brand: t('report.brand'),
      nickname: getDisplayName() || t('report.nicknameFallback'),
      avatar: getAvatar(),
    })
    const dataUrl = await renderStreakPoster(data, { logoSrc: BRAND_LOGO })
    posterDataUrl.value = dataUrl
    posterReady.value = true
    posterStatus.value = ''
  } catch (e) {
    posterStatus.value = e.message || t('report.saveFailed')
    posterReady.value = false
  } finally {
    sharing.value = false
  }
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  refresh()
})

const total = computed(() => todos.value.length)
const pending = computed(() => todos.value.filter((t) => !t.completed).length)
const done = computed(() => todos.value.filter((t) => t.completed).length)
const rate = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

const last7 = computed(() => {
  const days = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = dayKey(d.getTime())
    days.push({
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      created: todos.value.filter((t) => dayKey(t.created_at) === key).length,
      finished: todos.value.filter((t) => t.completed && dayKey(t.updated_at) === key).length,
    })
  }
  return days
})

const maxBar = computed(() => Math.max(1, ...last7.value.map((d) => Math.max(d.created, d.finished))))
</script>

<template>
  <view class="page ios-page stats-page" :class="pageThemeClass">
    <CollapsingNavBar :title="i18n.title" :progress="titleProgress" />
    <view class="content ios-content has-collapse-nav stats-content">
      <scroll-view scroll-y class="stats-scroll" :show-scrollbar="false" @scroll="onStatsScroll">
        <view class="large-title-wrap">
          <text class="large-title">{{ i18n.title }}</text>
          <text class="subtitle">{{ i18n.subtitle }}</text>
        </view>

        <view class="group streak-card">
          <view class="streak-main">
            <text class="streak-num">{{ streak }}</text>
            <view class="streak-copy">
              <text class="streak-title">{{ i18n.streak }}</text>
              <text class="streak-days">{{ i18n.streakDays }}</text>
            </view>
            <!-- #ifdef H5 -->
            <view
              class="streak-share"
              :class="{ disabled: sharing }"
              @click.stop="handleShareStreak"
            >
              <text>{{ i18n.streakShare }}</text>
            </view>
            <!-- #endif -->
          </view>
          <text class="streak-hint">{{ i18n.streakHint }}</text>
        </view>

        <view class="cards">
          <view class="group card">
            <text class="num">{{ total }}</text>
            <text class="label">{{ i18n.all }}</text>
          </view>
          <view class="group card">
            <text class="num">{{ pending }}</text>
            <text class="label">{{ i18n.pending }}</text>
          </view>
          <view class="group card">
            <text class="num">{{ done }}</text>
            <text class="label">{{ i18n.done }}</text>
          </view>
          <view class="group card">
            <text class="num">{{ rate }}%</text>
            <text class="label">{{ i18n.rate }}</text>
          </view>
        </view>

        <view class="group panel">
          <text class="panel-title">{{ i18n.last7 }}</text>
          <view class="bars">
            <view v-for="d in last7" :key="d.key" class="bar-col">
              <view class="bar-wrap">
                <view class="bar created" :style="{ height: `${(d.created / maxBar) * 160}rpx` }"></view>
                <view class="bar finished" :style="{ height: `${(d.finished / maxBar) * 160}rpx` }"></view>
              </view>
              <text class="bar-label">{{ d.label }}</text>
            </view>
          </view>
          <view class="legend">
            <view class="leg"><view class="swatch created"></view><text>{{ i18n.legendCreated }}</text></view>
            <view class="leg"><view class="swatch finished"></view><text>{{ i18n.legendFinished }}</text></view>
          </view>
        </view>

        <view class="pill-btn tint report-btn" @click="goReport">
          <text>{{ i18n.reportEntry }}</text>
        </view>
        <view class="scroll-spacer"></view>
      </scroll-view>
    </view>
    <GlassTabBar />

    <!-- #ifdef H5 -->
    <view
      v-if="posterOpen"
      class="poster-modal open"
      @click="closePosterModal"
    >
      <view class="poster-sheet" @click.stop>
        <view class="poster-sheet-header">
          <text class="poster-sheet-title">{{ i18n.posterModalTitle }}</text>
          <view class="poster-close" @click="closePosterModal">
            <text>×</text>
          </view>
        </view>
        <view class="poster-preview">
          <!-- H5: native img handles large data: URLs more reliably than uni-image -->
          <!-- #ifdef H5 -->
          <img
            v-if="posterReady && posterDataUrl"
            class="poster-preview-img"
            :src="posterDataUrl"
            alt=""
          />
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <image
            v-if="posterReady && posterDataUrl"
            class="poster-preview-img"
            :src="posterDataUrl"
            mode="widthFix"
          />
          <!-- #endif -->
          <text v-else class="poster-status">{{ posterStatus || i18n.posterRendering }}</text>
        </view>
        <text v-if="posterReady" class="share-channel-hint">{{ i18n.shareChannelHint }}</text>
        <view class="share-channels">
          <view
            class="share-channel ig"
            :class="{ disabled: !posterReady || channelBusy === 'instagram' }"
            @click="shareToChannel('instagram')"
          >
            <text class="share-channel-icon">IG</text>
            <text class="share-channel-label">{{ i18n.shareInstagram }}</text>
          </view>
          <view
            class="share-channel fb"
            :class="{ disabled: !posterReady || channelBusy === 'facebook' }"
            @click="shareToChannel('facebook')"
          >
            <text class="share-channel-icon">f</text>
            <text class="share-channel-label">{{ i18n.shareFacebook }}</text>
          </view>
        </view>
        <view class="poster-actions">
          <view
            class="poster-btn primary"
            :class="{ disabled: !posterReady }"
            @click="downloadPoster"
          >
            <text>{{ i18n.posterDownload }}</text>
          </view>
          <view class="poster-btn ghost" @click="closePosterModal">
            <text>{{ i18n.posterClose }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<style scoped>
.stats-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.stats-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: 0;
}

.stats-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.scroll-spacer {
  height: calc(160rpx + env(safe-area-inset-bottom));
}

.large-title-wrap {
  padding: 0 8rpx 28rpx;
}

.large-title {
  display: block;
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
}

.streak-card {
  padding: 28rpx 28rpx 24rpx;
  margin-bottom: 16rpx;
  overflow: visible;
}

.streak-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.streak-num {
  font-size: 72rpx;
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--app-tint);
  line-height: 1;
}

.streak-copy {
  flex: 1;
  min-width: 0;
}

.streak-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--app-label);
}

.streak-days {
  display: block;
  margin-top: 4rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
}

.streak-share {
  flex-shrink: 0;
  height: 56rpx;
  padding: 0 22rpx;
  border-radius: 999px;
  background: var(--app-tint);
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.streak-share.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.streak-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--app-tertiary);
}

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

@media (min-width: 768px) {
  .cards {
    grid-template-columns: repeat(4, 1fr);
  }
}

.card {
  padding: 28rpx 24rpx;
  overflow: visible;
}

.num {
  display: block;
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--app-label);
  line-height: 1.05;
}

.label {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--app-secondary);
}

.panel {
  padding: 28rpx 24rpx;
  overflow: visible;
}

.panel-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--app-label);
  margin-bottom: 24rpx;
}

.bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 8rpx;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-wrap {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 160rpx;
  margin-bottom: 10rpx;
}

.bar {
  width: 12rpx;
  min-height: 4rpx;
  border-radius: 6rpx 6rpx 2rpx 2rpx;
}

.bar.created {
  background: var(--app-tint-soft);
}

.bar.finished {
  background: var(--app-tint);
}

.bar-label {
  font-size: 18rpx;
  color: var(--app-tertiary);
}

.legend {
  display: flex;
  gap: 28rpx;
  margin-top: 22rpx;
}

.leg {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: var(--app-secondary);
}

.swatch {
  width: 18rpx;
  height: 18rpx;
  border-radius: 4rpx;
}

.swatch.created {
  background: var(--app-tint-soft);
}

.swatch.finished {
  background: var(--app-tint);
}

.report-btn {
  margin-top: 24rpx;
  margin-bottom: 0;
}

/* #ifdef H5 */
.poster-modal {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(8, 18, 36, 0.72);
  backdrop-filter: blur(10px);
}

.poster-sheet {
  width: min(100%, 420px);
  max-height: min(92vh, 900px);
  overflow: auto;
  background: #0f1b2d;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 1rem;
}

.poster-sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.poster-sheet-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.poster-close {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  line-height: 1;
  color: #fff;
}

.poster-preview {
  width: 100%;
  border-radius: 14px;
  background: #091221;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.poster-preview-img {
  display: block;
  width: 100%;
}

.poster-status {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  padding: 2rem 1rem;
  text-align: center;
}

.share-channel-hint {
  display: block;
  margin: 0.85rem 0 0.55rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.02em;
}

.share-channels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.share-channel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.88rem;
  color: #fff;
}

.share-channel.ig {
  background: linear-gradient(135deg, #f58529 0%, #dd2a7b 45%, #8134af 75%, #515bd4 100%);
}

.share-channel.fb {
  background: #1877f2;
}

.share-channel.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.share-channel-icon {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}

.share-channel.fb .share-channel-icon {
  border-radius: 999px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 0.95rem;
}

.share-channel-label {
  letter-spacing: -0.01em;
}

.poster-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.poster-btn {
  border-radius: 12px;
  padding: 0.78rem 0.7rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.88rem;
}

.poster-btn.primary {
  background: #fff;
  color: #0f1b2d;
}

.poster-btn.primary.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.poster-btn.ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.28);
}
/* #endif */
</style>
