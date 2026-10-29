<script setup>
/**
 * 周期报告页：生成报告并导出文字或可视化海报。
 */
import { ref, computed, nextTick } from 'vue'
import { onShow, onPageScroll } from '@dcloudio/uni-app'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
// #ifndef H5
import PosterCapture from '../../components/PosterCapture.vue'
// #endif
import { onPageScrollEdge, resyncScrollEdges } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'
import { generateReport, fetchReportJob, touchStreak } from '../../api/index.js'
import {
  getToken,
  getUsername,
  getDisplayName,
  touchActiveDay,
  getStreakDays,
  syncStreakToServer,
} from '../../utils/storage.js'
import { todos, ensureTodoCache } from '../../utils/todoStore.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion, getAcceptLanguage } from '../../utils/i18n.js'
import { htmlToPlainText } from '../../utils/reportHtml.js'
import {
  collectReportHighlights,
  renderHighlightPoster,
  randomCheer,
} from '../../utils/reportPoster.js'
import { sharePosterToChannel } from '../../utils/shareChannels.js'
import { saveDataUrlToDevice, shareDataUrlWithSystem } from '../../utils/saveImage.js'
import { filterPeriodTodos, buildVisualSections } from '../../utils/reportVisual.js'
import { BRAND_LOGO, loadNativeLogoDataUrl } from '../../utils/brand.js'

const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const saving = ref(false)
const content = ref('')
const source = ref('')
const taskCount = ref(0)
const completedCount = ref(0)
const pendingCount = ref(0)
const nickname = ref('')
const streakDays = ref(0)
/** visual | text */
const viewMode = ref('visual')

/** Contens 海报弹层（对齐 templates/personal-report 导出海报） */
const posterOpen = ref(false)
const posterStatus = ref('')
const posterDataUrl = ref('')
const posterReady = ref(false)
const titleProgress = ref(0)
const channelBusy = ref('')
const posterJobStr = ref('')
let posterWaitTimer = null

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('report.title'),
    sub: t('report.sub'),
    start: t('report.start'),
    end: t('report.end'),
    generate: t('report.generate'),
    generating: t('report.generating'),
    result: t('report.result'),
    copy: t('report.copy'),
    back: t('report.back'),
    saveImage: t('report.saveImage'),
    saving: t('report.saving'),
    brand: t('report.brand'),
    viewVisual: t('report.viewVisual'),
    viewText: t('report.viewText'),
    posterTitle: t('report.posterTitle'),
    posterDownload: (() => {
      const album = t('report.posterSaveAlbum')
      if (album && album !== 'report.posterSaveAlbum') return album
      return t('report.posterDownload')
    })(),
    posterClose: t('report.posterClose'),
    posterExtracting: t('report.posterExtracting'),
    posterRendering: t('report.posterRendering'),
    shareChannelHint: t('stats.shareChannelHint'),
    shareInstagram: t('stats.shareInstagram'),
    shareFacebook: t('stats.shareFacebook'),
  }
})

const pageThemeClass = computed(() => themeClass())

const sourceLabel = computed(() => {
  void localeVersion.value
  if (source.value === 'ai') return t('report.sourceAi')
  if (source.value === 'template') return t('report.sourceTemplate')
  return ''
})

const statsLabel = computed(() => {
  void localeVersion.value
  if (!content.value) return ''
  return t('report.stats', {
    total: taskCount.value,
    done: completedCount.value,
    pending: pendingCount.value,
  })
})

const streakLabel = computed(() => {
  void localeVersion.value
  return t('report.streakLabel', { n: streakDays.value })
})

const displayName = computed(() => {
  void localeVersion.value
  return nickname.value || t('report.nicknameFallback')
})

const plainText = computed(() => htmlToPlainText(content.value))

const periodLabel = computed(() => {
  if (!startDate.value || !endDate.value) return ''
  return `${startDate.value} — ${endDate.value}`
})

const rate = computed(() =>
  taskCount.value ? Math.round((completedCount.value / taskCount.value) * 100) : 0
)

const periodTodos = computed(() => {
  if (!startDate.value || !endDate.value) return []
  return filterPeriodTodos(todos.value || [], dayStartMs(startDate.value), dayEndMs(endDate.value))
})

const visual = computed(() => {
  void localeVersion.value
  return buildVisualSections(periodTodos.value, {
    startAt: startDate.value ? dayStartMs(startDate.value) : 0,
    endAt: endDate.value ? dayEndMs(endDate.value) : 0,
    rate: rate.value,
    streakDays: streakDays.value,
  })
})

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayStartMs(str) {
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function dayEndMs(str) {
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

function refreshProfile() {
  touchActiveDay()
  ensureTodoCache()
  nickname.value = getDisplayName()
  streakDays.value = getStreakDays()
  syncStreakToServer(touchStreak).then((n) => {
    if (typeof n === 'number') streakDays.value = n
  })
}

function initRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  startDate.value = toDateStr(start)
  endDate.value = toDateStr(end)
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  refreshProfile()
  if (!startDate.value || !endDate.value) initRange()
})

onPageScroll((e) => {
  onPageScrollEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
})

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

function onStartChange(e) {
  startDate.value = e.detail.value
}

function onEndChange(e) {
  endDate.value = e.detail.value
}

async function pollReportJob(jobId, { maxMs = 90000, intervalMs = 1200 } = {}) {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    const job = await fetchReportJob(jobId)
    const status = job.status || ''
    if (status === 'done') return job
    if (status === 'failed') {
      throw Object.assign(new Error(job.error || t('report.jobFailed')), { job })
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(t('report.jobTimeout'))
}

async function handleGenerate() {
  if (loading.value) return
  if (!startDate.value || !endDate.value) {
    uni.showToast({ title: t('report.needRange'), icon: 'none' })
    return
  }
  const startAt = dayStartMs(startDate.value)
  const endAt = dayEndMs(endDate.value)
  if (endAt < startAt) {
    uni.showToast({ title: t('report.invalidRange'), icon: 'none' })
    return
  }

  refreshProfile()
  loading.value = true
  content.value = ''
  source.value = ''
  try {
    const locale = getAcceptLanguage()
    let res = await generateReport({
      startAt,
      endAt,
      todos: todos.value || [],
      locale,
      nickname: nickname.value,
      streakDays: streakDays.value,
      asyncMode: true,
    })
    if (res.job_id) {
      uni.showToast({ title: t('report.queued'), icon: 'none' })
      res = await pollReportJob(res.job_id)
    }
    content.value = res.content || ''
    source.value = res.source || ''
    taskCount.value = res.task_count || 0
    completedCount.value = res.completed_count || 0
    pendingCount.value = res.pending_count || 0
    if (content.value) viewMode.value = 'visual'
    if (!content.value) {
      uni.showToast({ title: t('report.failed'), icon: 'none' })
    } else if (taskCount.value === 0) {
      uni.showToast({ title: t('report.emptyRange'), icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: e.message || t('report.failed'), icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleCopy() {
  if (!content.value) return
  uni.setClipboardData({
    data: plainText.value || content.value,
    success: () => uni.showToast({ title: t('report.copied'), icon: 'success' }),
  })
}

function setViewMode(mode) {
  viewMode.value = mode === 'text' ? 'text' : 'visual'
}

function closePosterModal() {
  posterOpen.value = false
  posterStatus.value = ''
  if (!saving.value) {
    posterDataUrl.value = ''
    posterReady.value = false
  }
}

async function downloadPoster() {
  if (!posterDataUrl.value) return
  const week = (periodLabel.value || 'week').replace(/\s+/g, '')
  try {
    await saveDataUrlToDevice(
      posterDataUrl.value,
      `${t('report.posterFilename')}-${week}.png`
    )
    uni.showToast({ title: t('report.saved'), icon: 'success' })
  } catch (_) {
    uni.showToast({ title: t('report.saveFailed'), icon: 'none' })
  }
}

async function sharePosterTo(channel) {
  if (!posterReady.value || !posterDataUrl.value || channelBusy.value) return
  channelBusy.value = channel
  const week = (periodLabel.value || 'week').replace(/\s+/g, '')
  const filename = `${t('report.posterFilename')}-${week}.png`
  try {
    if (typeof plus !== 'undefined') {
      const nativeShare = await shareDataUrlWithSystem(posterDataUrl.value, {
        title: t('report.posterDefaultTitle'),
        text: `${displayName.value} · ${periodLabel.value}`,
      })
      if (nativeShare.ok) {
        uni.showToast({ title: t('report.saved'), icon: 'success' })
        return
      }
      if (nativeShare.reason !== 'unsupported') {
        uni.showToast({ title: t('stats.shareFailed'), icon: 'none' })
        return
      }
    }
    const result = await sharePosterToChannel(channel, {
      dataUrl: posterDataUrl.value,
      filename,
      title: t('report.posterDefaultTitle'),
      text: `${displayName.value} · ${periodLabel.value}`,
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

function clearPosterWait() {
  if (posterWaitTimer) {
    clearTimeout(posterWaitTimer)
    posterWaitTimer = null
  }
}

function onPosterCaptureDone(payload) {
  clearPosterWait()
  saving.value = false
  if (!payload || !payload.ok || !payload.dataUrl) {
    const msg = String((payload && payload.message) || '')
    posterStatus.value =
      !msg || msg === t('report.posterErrorH5') ? t('report.posterErrorRender') : msg
    posterReady.value = false
    return
  }
  posterDataUrl.value = payload.dataUrl
  posterReady.value = true
  posterStatus.value = ''
}

/** 保存图片 = Contens 周报「导出海报」 */
async function handleSaveImage() {
  if (!content.value || saving.value) return
  if (viewMode.value !== 'visual') {
    setViewMode('visual')
    await nextTick()
  }
  saving.value = true
  posterOpen.value = true
  posterReady.value = false
  posterDataUrl.value = ''
  posterStatus.value = i18n.value.posterExtracting

  let waitForView = false
  try {
    await nextTick()
    const data = collectReportHighlights({
      brand: i18n.value.brand,
      week: periodLabel.value,
      title: t('report.visualHeadline'),
      sub: statsLabel.value,
      rate: rate.value,
      taskCount: taskCount.value,
      completedCount: completedCount.value,
      pendingCount: pendingCount.value,
      streakDays: streakDays.value,
      html: content.value,
      todos: periodTodos.value,
      quote: visual.value.quote,
      wins: visual.value.wins.map((w) => w.title),
      tracks: visual.value.tracks.map((tr) => ({ name: tr.name, pct: tr.pct })),
      labels: {
        rate: t('stats.rate'),
        all: t('stats.all'),
        done: t('stats.done'),
        pending: t('stats.pending'),
        doneOf: t('report.metricDoneOf', {
          done: completedCount.value,
          total: taskCount.value,
        }),
        streak: streakLabel.value,
        pendingHint:
          pendingCount.value > 0 ? t('report.metricPendingHint') : t('report.metricAllClear'),
        completion: t('report.trackCompletion'),
        delivery: t('report.trackDelivery'),
      },
    })

    posterStatus.value = i18n.value.posterRendering
    // #ifdef H5
    {
      const dataUrl = await renderHighlightPoster(data, { logoSrc: BRAND_LOGO })
      posterDataUrl.value = dataUrl
      posterReady.value = true
      posterStatus.value = ''
    }
    // #endif
    // #ifndef H5
    waitForView = true
    clearPosterWait()
    let logoSrc = BRAND_LOGO
    try {
      const nativeLogo = await loadNativeLogoDataUrl()
      if (nativeLogo) logoSrc = nativeLogo
    } catch (_) {
      /* renderjs 仍会再解析路径 / 画品牌标 */
    }
    posterJobStr.value = JSON.stringify({
      id: Date.now(),
      data: { ...data, cheer: randomCheer() },
      logoSrc,
    })
    posterWaitTimer = setTimeout(() => {
      if (saving.value && !posterReady.value) {
        saving.value = false
        posterStatus.value = t('report.posterErrorRender')
      }
    }, 25000)
    // #endif
  } catch (e) {
    const msg = String((e && e.message) || '')
    posterStatus.value =
      !msg || msg === t('report.posterErrorH5') ? t('report.posterErrorRender') : msg
    posterReady.value = false
  } finally {
    if (!waitForView) saving.value = false
  }
}
</script>

<template>
  <view class="page ios-page" :class="pageThemeClass">
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
          <view class="gen-btn" :class="{ disabled: loading }" @click="handleGenerate">
            <text>{{ loading ? i18n.generating : t('report.generateShort') }}</text>
          </view>
        </view>
        <text class="subtitle">{{ i18n.sub }}</text>
      </view>

      <view class="group">
        <view class="row">
          <text class="label">{{ i18n.start }}</text>
          <picker mode="date" :value="startDate" @change="onStartChange">
            <view class="picker-val">
              <text class="value">{{ startDate || '—' }}</text>
              <text class="chev">›</text>
            </view>
          </picker>
        </view>
        <view class="row last">
          <text class="label">{{ i18n.end }}</text>
          <picker mode="date" :value="endDate" @change="onEndChange">
            <view class="picker-val">
              <text class="value">{{ endDate || '—' }}</text>
              <text class="chev">›</text>
            </view>
          </picker>
        </view>
      </view>

      <view v-if="content" class="result-wrap">
        <view class="view-seg glass">
          <view
            class="seg-item"
            :class="{ active: viewMode === 'visual' }"
            @click="setViewMode('visual')"
          >
            <text>{{ i18n.viewVisual }}</text>
          </view>
          <view
            class="seg-item"
            :class="{ active: viewMode === 'text' }"
            @click="setViewMode('text')"
          >
            <text>{{ i18n.viewText }}</text>
          </view>
        </view>

        <text v-if="sourceLabel" class="source">{{ sourceLabel }}</text>

        <!-- 可视化版：布局对齐 templates/personal-report（Contens 周报 #metrics） -->
        <view v-if="viewMode === 'visual'" class="report-card" id="report-card">
          <view class="hero">
            <view class="hero-visual" aria-hidden="true"></view>
            <view class="hero-top">
              <view class="brand-lockup">
                <image class="project-logo" :src="BRAND_LOGO" mode="aspectFit" />
                <view class="brand-col">
                  <text class="brand">{{ i18n.brand }}</text>
                  <text class="hero-meta">{{ displayName }} · {{ streakLabel }}</text>
                </view>
              </view>
              <view class="week-chip">
                <text class="week-chip-text">{{ periodLabel }}</text>
              </view>
            </view>
            <view class="hero-copy">
              <text class="hero-title">{{ t('report.visualHeadline') }}</text>
              <text class="hero-sub">{{ statsLabel }}</text>
            </view>
          </view>

          <view class="section metrics-section">
            <view class="section-head">
              <text class="kicker">Week Snapshot</text>
              <text class="section-title">{{ t('report.metricsTitle') }}</text>
            </view>
            <view class="metrics">
              <view class="metric metric-hero">
                <text class="metric-label">{{ t('stats.rate') }}</text>
                <text class="metric-value">{{ rate }}%</text>
                <text class="metric-delta">
                  {{ t('report.metricDoneOf', { done: completedCount, total: taskCount }) }}
                </text>
                <view class="metric-bar">
                  <view class="metric-bar-fill" :style="{ width: rate + '%' }"></view>
                </view>
              </view>
              <view class="metric">
                <text class="metric-label">{{ t('stats.all') }}</text>
                <text class="metric-value">{{ taskCount }}</text>
                <text class="metric-delta">{{ t('report.metricPeriodTasks') }}</text>
              </view>
              <view class="metric">
                <text class="metric-label">{{ t('stats.done') }}</text>
                <text class="metric-value">{{ completedCount }}</text>
                <text class="metric-delta">{{ streakLabel }}</text>
              </view>
              <view class="metric">
                <text class="metric-label">{{ t('stats.pending') }}</text>
                <text class="metric-value">{{ pendingCount }}</text>
                <text class="metric-delta" :class="{ down: pendingCount > 0 }">
                  {{ pendingCount > 0 ? t('report.metricPendingHint') : t('report.metricAllClear') }}
                </text>
              </view>
            </view>
          </view>

          <!-- 业务线进度 -->
          <view v-if="visual.tracks.length" class="section">
            <view class="section-head">
              <text class="kicker">Progress</text>
              <text class="section-title">{{ t('report.tracksTitle') }}</text>
            </view>
            <view class="tracks">
              <view v-for="(tr, i) in visual.tracks" :key="i" class="track">
                <text class="track-name">{{ tr.name }}</text>
                <view class="track-body">
                  <text class="track-desc">{{ tr.desc }}</text>
                  <view class="progress">
                    <view class="progress-fill" :style="{ width: tr.pct + '%' }"></view>
                  </view>
                </view>
                <text class="track-pct">{{ tr.pct }}%</text>
              </view>
            </view>
          </view>

          <!-- 成果与风险 -->
          <view class="section">
            <view class="section-head">
              <text class="kicker">Outcomes</text>
              <text class="section-title">{{ t('report.winsTitle') }}</text>
            </view>
            <view class="split">
              <view class="panel">
                <text class="panel-h">{{ t('report.winsPanel') }}</text>
                <view v-if="visual.wins.length" class="list">
                  <view v-for="(w, i) in visual.wins" :key="'w' + i" class="list-item">
                    <view class="dot"></view>
                    <view class="list-body">
                      <text class="list-title">{{ w.title }}</text>
                      <text class="list-desc">{{ w.detail }}</text>
                    </view>
                  </view>
                </view>
                <text v-else class="empty-hint">{{ t('report.winsEmpty') }}</text>
              </view>
              <view class="panel">
                <text class="panel-h">{{ t('report.risksPanel') }}</text>
                <view v-if="visual.risks.length" class="list">
                  <view v-for="(r, i) in visual.risks" :key="'r' + i" class="list-item">
                    <view class="dot" :class="r.level"></view>
                    <view class="list-body">
                      <text class="list-title">{{ r.title }}</text>
                      <text class="list-desc">{{ r.detail }}</text>
                    </view>
                  </view>
                </view>
                <text v-else class="empty-hint">{{ t('report.risksEmpty') }}</text>
              </view>
            </view>
          </view>

          <!-- 本周节奏 -->
          <view v-if="visual.timeline.length" class="section">
            <view class="section-head">
              <text class="kicker">Cadence</text>
              <text class="section-title">{{ t('report.timelineTitle') }}</text>
            </view>
            <view class="panel">
              <view class="timeline">
                <view v-for="(node, i) in visual.timeline" :key="'t' + i" class="t-item">
                  <text class="t-day">{{ node.day }}</text>
                  <text class="t-title">{{ node.title }}</text>
                  <text class="t-desc">{{ node.detail }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 未来计划 -->
          <view class="section">
            <view class="section-head">
              <text class="kicker">Next</text>
              <text class="section-title">{{ t('report.plansTitle') }}</text>
            </view>
            <view v-if="visual.plans.length" class="plan-grid">
              <view v-for="(p, i) in visual.plans" :key="'p' + i" class="plan">
                <view class="prio" :class="p.prioClass">
                  <text>{{ p.prio }}</text>
                </view>
                <view class="plan-body">
                  <text class="plan-title">{{ p.title }}</text>
                  <text class="plan-desc">{{ p.detail }}</text>
                </view>
              </view>
            </view>
            <text v-else class="empty-hint block">{{ t('report.plansEmpty') }}</text>
          </view>

          <!-- 一句话复盘 -->
          <view class="section">
            <view class="section-head">
              <text class="kicker">Reflection</text>
              <text class="section-title">{{ t('report.quoteTitle') }}</text>
            </view>
            <view class="quote">
              <text class="quote-mark">“</text>
              <text class="quote-text">{{ visual.quote }}</text>
              <text class="quote-foot">{{ visual.quoteFooter }}</text>
            </view>
          </view>

          <view class="card-foot">
            <text class="foot-meta">{{ statsLabel }}</text>
            <text class="foot-streak">{{ displayName }} · {{ streakLabel }}</text>
          </view>
        </view>

        <view v-else class="text-panel group">
          <text class="text-body" user-select>{{ plainText }}</text>
        </view>
      </view>

      <view class="bottom-space" :class="{ 'with-dock': !!content }"></view>
    </view>

    <!-- 底部悬浮：复制 / 导出海报 -->
    <view v-if="content" class="action-dock">
      <view class="dock-inner glass">
        <view class="dock-btn ghost" @click="handleCopy">
          <text>{{ i18n.copy }}</text>
        </view>
        <view
          class="dock-btn primary"
          :class="{ disabled: saving }"
          @click="handleSaveImage"
        >
          <text>{{ saving ? i18n.saving : i18n.saveImage }}</text>
        </view>
      </view>
    </view>

    <!-- #ifndef H5 -->
    <PosterCapture :job="posterJobStr" @done="onPosterCaptureDone" />
    <!-- #endif -->

    <!-- Contens 高光海报弹层（对齐 templates/personal-report） -->
    <view
      v-if="posterOpen"
      class="poster-modal open"
      id="posterModal"
      @click="closePosterModal"
    >
      <view class="poster-sheet" @click.stop>
        <view class="poster-sheet-header">
          <text class="poster-sheet-title">{{ i18n.posterTitle }}</text>
          <view class="poster-close" @click="closePosterModal">
            <text>×</text>
          </view>
        </view>
        <view class="poster-preview" id="posterPreview">
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
          <text v-else class="poster-status">{{ posterStatus || i18n.posterExtracting }}</text>
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
  </view>
</template>

<style scoped>
.content {
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: 40rpx;
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

.gen-btn {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  height: 64rpx;
  padding: 0 28rpx;
  border-radius: 999px;
  background: var(--app-tint);
  color: #fff;
  font-size: 26rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gen-btn.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.4;
}

.group {
  margin-bottom: 24rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 0.5px solid var(--app-separator);
}

.row.last {
  border-bottom: none;
}

.label {
  font-size: 30rpx;
  color: var(--app-label);
}

.picker-val {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value {
  font-size: 28rpx;
  color: var(--app-secondary);
}

.chev {
  font-size: 28rpx;
  color: var(--app-tertiary);
}

.result-wrap {
  margin-bottom: 12rpx;
}

.view-seg {
  display: flex;
  padding: 6rpx;
  border-radius: var(--app-radius-pill);
  margin-bottom: 16rpx;
}

.seg-item {
  flex: 1;
  height: 64rpx;
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--app-secondary);
}

.seg-item.active {
  background: var(--app-tint-soft);
  color: var(--app-tint);
}

.source {
  display: block;
  font-size: 22rpx;
  color: var(--app-tertiary);
  margin-bottom: 14rpx;
  padding: 0 4rpx;
}

/* Contens 周报模板视觉（templates/personal-report）
   日/夜仅换色：布局、圆角、间距、渐变结构与阴影几何保持一致 */
.report-card {
  --rpt-ink: #0f1b2d;
  --rpt-muted: #5d6f86;
  --rpt-line: rgba(15, 27, 45, 0.12);
  --rpt-accent: #1a6dff;
  --rpt-accent-deep: #0d4fd6;
  --rpt-accent-mid: #3b8bff;
  --rpt-accent-soft: rgba(26, 109, 255, 0.12);
  --rpt-accent-soft-2: rgba(26, 109, 255, 0.14);
  --rpt-accent-soft-3: rgba(56, 146, 255, 0.08);
  --rpt-accent-soft-4: rgba(56, 146, 255, 0.14);
  --rpt-accent-ring: rgba(26, 109, 255, 0.12);
  --rpt-accent-glow: rgba(26, 109, 255, 0.16);
  --rpt-warn: #d97706;
  --rpt-warn-soft: rgba(217, 119, 6, 0.12);
  --rpt-prio2: #1d5db8;
  --rpt-dot-muted: #8aa39a;
  --rpt-track: rgba(15, 27, 45, 0.08);
  --rpt-rail-fade: rgba(15, 27, 45, 0.08);
  --rpt-surface: rgba(255, 255, 255, 0.92);
  --rpt-chip: rgba(255, 255, 255, 0.72);
  --rpt-bg-a: #e8f0fb;
  --rpt-bg-b: #f3f6fb;
  --rpt-bg-c: #e4edf8;
  --rpt-shadow: 0 16px 40px rgba(15, 45, 96, 0.1);
  overflow: hidden;
  border-radius: 22px;
  background:
    radial-gradient(1000px 640px at 0% -8%, var(--rpt-accent-glow), transparent 55%),
    linear-gradient(180deg, var(--rpt-bg-a), var(--rpt-bg-b) 48%, var(--rpt-bg-c));
  border: 1px solid var(--rpt-line);
  box-shadow: var(--rpt-shadow);
  color: var(--rpt-ink);
}

.theme-dark .report-card {
  --rpt-ink: #f2f5fa;
  --rpt-muted: rgba(235, 235, 245, 0.58);
  --rpt-line: rgba(255, 255, 255, 0.12);
  --rpt-accent: #0a84ff;
  --rpt-accent-deep: #64b5ff;
  --rpt-accent-mid: #5ac8fa;
  --rpt-accent-soft: rgba(10, 132, 255, 0.22);
  --rpt-accent-soft-2: rgba(10, 132, 255, 0.18);
  --rpt-accent-soft-3: rgba(90, 200, 250, 0.1);
  --rpt-accent-soft-4: rgba(10, 132, 255, 0.2);
  --rpt-accent-ring: rgba(10, 132, 255, 0.22);
  --rpt-accent-glow: rgba(10, 132, 255, 0.22);
  --rpt-warn: #d4ab5c;
  --rpt-warn-soft: rgba(212, 171, 92, 0.22);
  --rpt-prio2: #64b5ff;
  --rpt-dot-muted: #8e9aa8;
  --rpt-track: rgba(255, 255, 255, 0.12);
  --rpt-rail-fade: rgba(255, 255, 255, 0.1);
  --rpt-surface: rgba(44, 44, 46, 0.92);
  --rpt-chip: rgba(58, 58, 60, 0.88);
  --rpt-bg-a: #12141a;
  --rpt-bg-b: #0a0a0c;
  --rpt-bg-c: #10141c;
  --rpt-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28rpx;
  padding: 28rpx 26rpx 32rpx;
  overflow: hidden;
  min-height: 280rpx;
}

.hero-visual {
  position: absolute;
  inset: 0;
  border-radius: 22px 22px 0 0;
  background:
    linear-gradient(145deg, #0b1f3f 0%, #1347a8 48%, #1a7dff 100%);
}

.hero-visual::after {
  content: '';
  position: absolute;
  right: -18%;
  top: 8%;
  width: 240rpx;
  height: 240rpx;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2), transparent 62%);
}

.hero-top,
.hero-copy {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
  flex: 1;
}

.project-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.brand-col {
  min-width: 0;
}

.brand {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: #fff;
  line-height: 1.15;
}

.hero-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.35;
}

.week-chip {
  flex-shrink: 0;
  max-width: 46%;
  padding: 12rpx 18rpx;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.08);
}

.week-chip-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.35;
}

.hero-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: -0.6px;
  color: #fff;
  line-height: 1.2;
  margin-bottom: 12rpx;
}

.hero-sub {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.section {
  padding: 28rpx 26rpx 8rpx;
}

.metrics-section {
  padding-top: 32rpx;
}

.section-head {
  margin-bottom: 20rpx;
}

.kicker {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--rpt-accent-deep);
  margin-bottom: 8rpx;
}

.section-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--rpt-ink);
}

.section-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--rpt-muted);
  line-height: 1.45;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.metric {
  position: relative;
  padding: 22rpx 20rpx;
  background: var(--rpt-surface);
  border: 1px solid var(--rpt-line);
  border-radius: 16px;
  overflow: hidden;
  min-width: 0;
}

.metric-hero {
  grid-column: 1 / -1;
  background:
    linear-gradient(135deg, var(--rpt-accent-soft-2), transparent 55%),
    var(--rpt-surface);
}

.metric-label {
  display: block;
  font-size: 22rpx;
  font-weight: 500;
  color: var(--rpt-muted);
}

.metric-value {
  display: block;
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1;
  color: var(--rpt-ink);
}

.metric-hero .metric-value {
  font-size: 56rpx;
}

.metric-delta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--rpt-accent-deep);
  line-height: 1.35;
}

.metric-delta.down {
  color: var(--rpt-warn);
}

.metric-bar {
  margin-top: 16rpx;
  height: 6px;
  border-radius: 999px;
  background: var(--rpt-track);
  overflow: hidden;
}

.metric-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--rpt-accent-deep), var(--rpt-accent-mid));
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.tracks {
  display: grid;
  gap: 14rpx;
}

.track {
  display: grid;
  grid-template-columns: 88rpx 1fr auto;
  gap: 12rpx 16rpx;
  align-items: center;
  padding: 22rpx 24rpx;
  background: var(--rpt-chip);
  border: 1px solid var(--rpt-line);
  border-radius: 14px;
}

.track-name {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--rpt-accent-deep);
}

.track-body {
  min-width: 0;
}

.track-desc {
  display: block;
  font-size: 22rpx;
  color: var(--rpt-muted);
  line-height: 1.4;
}

.progress {
  margin-top: 10rpx;
  height: 7px;
  border-radius: 999px;
  background: var(--rpt-track);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--rpt-accent-deep), var(--rpt-accent-mid));
}

.track-pct {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--rpt-ink);
  min-width: 64rpx;
  text-align: right;
}

.split {
  display: grid;
  gap: 16rpx;
}

.panel {
  background: var(--rpt-surface);
  border: 1px solid var(--rpt-line);
  border-radius: 16px;
  padding: 24rpx;
}

.panel-h {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--rpt-ink);
  margin-bottom: 18rpx;
}

.list {
  display: grid;
  gap: 18rpx;
}

.list-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14rpx;
  align-items: start;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  margin-top: 12rpx;
  border-radius: 50%;
  background: var(--rpt-accent);
}

.dot.warn {
  background: var(--rpt-warn);
}

.dot.muted {
  background: var(--rpt-dot-muted);
}

.list-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--rpt-ink);
  line-height: 1.35;
}

.list-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--rpt-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-hint {
  display: block;
  font-size: 24rpx;
  color: var(--rpt-muted);
  line-height: 1.45;
}

.empty-hint.block {
  padding: 8rpx 4rpx 0;
}

.timeline {
  --rail-x: 20rpx;
  --dot-size: 16rpx;
  position: relative;
  padding-left: 0;
}

.timeline::before {
  content: '';
  position: absolute;
  left: var(--rail-x);
  top: 18rpx;
  bottom: 18rpx;
  width: 2px;
  margin-left: -1px;
  background: linear-gradient(180deg, var(--rpt-accent), var(--rpt-rail-fade));
}

.t-item {
  position: relative;
  padding: 0 0 32rpx calc(var(--rail-x) + 28rpx);
}

.t-item:last-child {
  padding-bottom: 0;
}

.t-item::before {
  content: '';
  position: absolute;
  left: var(--rail-x);
  top: 10rpx;
  width: var(--dot-size);
  height: var(--dot-size);
  margin-left: calc(var(--dot-size) / -2);
  box-sizing: border-box;
  border-radius: 50%;
  background: var(--rpt-surface);
  border: 2px solid var(--rpt-accent);
  box-shadow: 0 0 0 4px var(--rpt-accent-ring);
}

.t-day {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--rpt-accent-deep);
  margin-bottom: 6rpx;
}

.t-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--rpt-ink);
  margin-bottom: 4rpx;
}

.t-desc {
  display: block;
  font-size: 22rpx;
  color: var(--rpt-muted);
}

.plan-grid {
  display: grid;
  gap: 14rpx;
}

.plan {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 18rpx;
  align-items: center;
  padding: 22rpx 24rpx;
  border-radius: 16px;
  border: 1px solid var(--rpt-line);
  background: var(--rpt-chip);
}

.prio {
  width: 64rpx;
  height: 64rpx;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
  background: var(--rpt-accent-soft);
  color: var(--rpt-accent-deep);
}

.prio.p2 {
  background: var(--rpt-accent-soft-4);
  color: var(--rpt-prio2);
}

.prio.p3 {
  background: var(--rpt-warn-soft);
  color: var(--rpt-warn);
}

.plan-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--rpt-ink);
}

.plan-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--rpt-muted);
  line-height: 1.4;
}

.quote {
  position: relative;
  padding: 28rpx 26rpx;
  border-radius: 18px;
  background:
    linear-gradient(135deg, var(--rpt-accent-soft-2), var(--rpt-accent-soft-3)),
    var(--rpt-surface);
  border: 1px solid var(--rpt-line);
  overflow: hidden;
}

.quote-mark {
  display: block;
  font-size: 48rpx;
  line-height: 0.8;
  color: var(--rpt-accent);
  opacity: 0.55;
  margin-bottom: 12rpx;
}

.quote-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.45;
  color: var(--rpt-ink);
}

.quote-foot {
  display: block;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1px solid var(--rpt-line);
  font-size: 22rpx;
  color: var(--rpt-muted);
  line-height: 1.5;
}

.body-section {
  padding-bottom: 8rpx;
}

.card-html {
  font-size: 28rpx;
  line-height: 1.55;
  color: var(--rpt-ink);
  word-break: break-word;
  padding: 4rpx 0 8rpx;
}

.card-html :deep(h2) {
  margin: 0 0 16rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--rpt-ink);
}

.card-html :deep(h3) {
  margin: 22rpx 0 10rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--rpt-ink);
}

.card-html :deep(p) {
  margin: 0 0 12rpx;
  color: var(--rpt-muted);
}

.card-html :deep(ul),
.card-html :deep(ol) {
  margin: 0 0 14rpx;
  padding-left: 36rpx;
}

.card-html :deep(li) {
  margin-bottom: 8rpx;
  color: var(--rpt-ink);
}

.card-html :deep(strong) {
  color: var(--rpt-ink);
  font-weight: 700;
}

.card-html :deep(.footnote),
.card-html :deep(.meta),
.card-html :deep(.period),
.card-html :deep(.overview) {
  font-size: 22rpx;
  color: var(--rpt-muted);
}

.card-foot {
  margin: 8rpx 26rpx 28rpx;
  padding-top: 20rpx;
  border-top: 1px solid var(--rpt-line);
}

.foot-meta {
  display: block;
  font-size: 22rpx;
  color: var(--rpt-muted);
}

.foot-streak {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--rpt-accent-deep);
}

.text-panel {
  padding: 28rpx 24rpx;
  overflow: visible;
}

.text-body {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--app-label);
  white-space: pre-wrap;
  word-break: break-word;
}

.bottom-space {
  height: 60rpx;
}

.bottom-space.with-dock {
  height: calc(140rpx + env(safe-area-inset-bottom, 0px));
}

/* 底部悬浮操作栏 */
.action-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  padding: 16rpx var(--app-space-page) calc(16rpx + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
  display: flex;
  justify-content: center;
}

.dock-inner {
  pointer-events: auto;
  width: 100%;
  max-width: var(--app-content-max, 100%);
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16rpx;
  padding: 12rpx;
  border-radius: 28rpx;
  box-shadow: 0 12px 36px var(--app-shadow);
  box-sizing: border-box;
}

.dock-btn {
  height: 88rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 700;
}

.dock-btn.ghost {
  background: var(--app-fill-strong, rgba(255, 255, 255, 0.88));
  color: var(--app-tint);
  border: 1px solid var(--app-glass-border, rgba(15, 27, 45, 0.1));
}

.dock-btn.primary {
  background: var(--app-tint, #1a6dff);
  color: #fff;
}

.dock-btn.disabled {
  opacity: 0.45;
  pointer-events: none;
}

/* Contens 海报弹层 */
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
</style>
