<script setup>
/**
 * 桌面端报告页：生成周期总结并导出报告海报。
 */
import { ref, computed, onMounted } from 'vue'
import { generateReport, fetchReportJob, touchStreak } from '../api/client.js'
import { useModalLock } from '../utils/modalLock.js'
import {
  getDisplayName,
  touchActiveDay,
  getStreakDays,
  syncStreakToServer,
} from '../stores/storage.js'
import { todos, ensureTodoCache, revision } from '../stores/todos.js'
import { t, localeVersion, getAcceptLanguage } from '../i18n/index.js'
import { htmlToPlainText } from '../utils/reportHtml.js'
import {
  collectReportHighlights,
  renderHighlightPoster,
  downloadDataUrl,
  DEFAULT_LOGO,
} from '../utils/reportPoster.js'
import { filterPeriodTodos, buildVisualSections } from '../utils/reportVisual.js'
import { toast } from '../utils/toast.js'
import logoUrl from '../utils/brand.js'
import DueDateTimeRow from '../components/DueDateTimeRow.vue'

const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const content = ref('')
const source = ref('')
const taskCount = ref(0)
const completedCount = ref(0)
const pendingCount = ref(0)
const nickname = ref('')
const streakDays = ref(0)
const viewMode = ref('visual')
const posterOpen = ref(false)
const posterDataUrl = ref('')
const posterBusy = ref(false)

useModalLock(posterOpen)

function refreshStreak() {
  touchActiveDay()
  streakDays.value = getStreakDays()
  syncStreakToServer(touchStreak).then((n) => {
    if (typeof n === 'number') streakDays.value = n
  })
}

function toDayStart(str) {
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function toDayEnd(str) {
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  startDate.value = fmt(start)
  endDate.value = fmt(end)
}

onMounted(() => {
  ensureTodoCache()
  nickname.value = getDisplayName()
  refreshStreak()
  defaultRange()
})

const rate = computed(() =>
  taskCount.value ? Math.round((completedCount.value / taskCount.value) * 100) : 0
)

const plainText = computed(() => htmlToPlainText(content.value))

const visual = computed(() => {
  void revision.value
  void localeVersion.value
  if (!startDate.value || !endDate.value || !content.value) return null
  const startAt = toDayStart(startDate.value)
  const endAt = toDayEnd(endDate.value)
  const period = filterPeriodTodos(todos.value, startAt, endAt)
  return buildVisualSections(period, {
    startAt,
    endAt,
    rate: rate.value,
    streakDays: streakDays.value,
  })
})

const sourceLabel = computed(() => {
  void localeVersion.value
  if (source.value === 'ai') return t('report.sourceAi')
  if (source.value === 'template') return t('report.sourceTemplate')
  return ''
})

const periodLabel = computed(() => {
  if (!startDate.value || !endDate.value) return ''
  return `${startDate.value} → ${endDate.value}`
})

const statsLabel = computed(() => {
  void localeVersion.value
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

const displayName = computed(() => nickname.value || t('common.user'))

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

async function onGenerate() {
  if (!startDate.value || !endDate.value) {
    toast(t('report.needRange'))
    return
  }
  const startAt = toDayStart(startDate.value)
  const endAt = toDayEnd(endDate.value)
  if (endAt < startAt) {
    toast(t('report.invalidRange'))
    return
  }

  loading.value = true
  content.value = ''
  source.value = ''
  try {
    ensureTodoCache()
    refreshStreak()
    nickname.value = getDisplayName()

    let res = await generateReport({
      startAt,
      endAt,
      todos: (todos.value || []).map((item) => ({
        id: item.id,
        title: item.title || '',
        detail: item.detail || '',
        due_at: Number(item.due_at) || 0,
        completed: !!item.completed,
        created_at: Number(item.created_at) || 0,
        updated_at: Number(item.updated_at) || 0,
      })),
      locale: getAcceptLanguage(),
      nickname: nickname.value,
      streakDays: streakDays.value,
      asyncMode: true,
    })
    if (res.job_id) {
      toast(t('report.queued'))
      res = await pollReportJob(res.job_id)
    }

    content.value = typeof res.content === 'string' ? res.content : ''
    source.value = res.source || ''
    taskCount.value = Number(res.task_count) || 0
    completedCount.value = Number(res.completed_count) || 0
    pendingCount.value = Number(res.pending_count) || 0

    if (!content.value) {
      toast(t('report.failed'))
      return
    }
    viewMode.value = 'visual'
    if (taskCount.value === 0) {
      toast(t('report.emptyRange'))
    }
  } catch (e) {
    content.value = ''
    toast(e.message || t('report.failed'))
  } finally {
    loading.value = false
  }
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(plainText.value || content.value)
    toast(t('report.copied'))
  } catch {
    toast(t('common.requestFailed'))
  }
}

async function openPoster() {
  if (!content.value) {
    toast(t('report.posterErrorEmpty'))
    return
  }
  posterBusy.value = true
  posterOpen.value = true
  posterDataUrl.value = ''
  try {
    toast(t('report.posterExtracting'))
    const data = collectReportHighlights({
      brand: 'Upgrade',
      week: periodLabel.value,
      title: t('report.posterDefaultTitle'),
      sub: statsLabel.value,
      quote: visual.value?.quote || '',
      rate: rate.value,
      taskCount: taskCount.value,
      completedCount: completedCount.value,
      pendingCount: pendingCount.value,
      streakDays: streakDays.value,
      html: content.value,
      todos: filterPeriodTodos(todos.value, toDayStart(startDate.value), toDayEnd(endDate.value)),
      wins: visual.value?.wins,
      tracks: visual.value?.tracks,
    })
    toast(t('report.posterRendering'))
    posterDataUrl.value = await renderHighlightPoster(data, { logoSrc: logoUrl || DEFAULT_LOGO })
  } catch (e) {
    toast(e.message || t('report.posterErrorRender'))
    posterOpen.value = false
  } finally {
    posterBusy.value = false
  }
}

function downloadPoster() {
  if (!posterDataUrl.value) return
  downloadDataUrl(posterDataUrl.value, `${t('report.posterFilename')}.png`)
  toast(t('report.saved'))
}
</script>

<template>
  <div class="report-layout">
    <section class="panel report-controls">
      <p class="page-sub">{{ t('report.sub') }}</p>
      <div class="range-row">
        <div class="field">
          <label>{{ t('report.start') }}</label>
          <DueDateTimeRow v-model:date="startDate" date-only :clearable="false" />
        </div>
        <div class="field">
          <label>{{ t('report.end') }}</label>
          <DueDateTimeRow v-model:date="endDate" date-only :clearable="false" />
        </div>
        <button class="btn btn-primary" type="button" :disabled="loading" @click="onGenerate">
          {{ loading ? t('report.generating') : t('report.generate') }}
        </button>
      </div>
    </section>

    <section v-if="content" class="report-result">
      <div class="report-toolbar panel">
        <div class="mode-switch">
          <button type="button" :class="{ active: viewMode === 'visual' }" @click="viewMode = 'visual'">
            {{ t('report.viewVisual') }}
          </button>
          <button type="button" :class="{ active: viewMode === 'text' }" @click="viewMode = 'text'">
            {{ t('report.viewText') }}
          </button>
        </div>
        <div class="toolbar-actions">
          <span v-if="sourceLabel" class="source-tag">{{ sourceLabel }}</span>
          <button type="button" class="btn btn-secondary btn-compact" @click="copyText">
            {{ t('report.copy') }}
          </button>
          <button type="button" class="btn btn-primary btn-compact" :disabled="posterBusy" @click="openPoster">
            {{ t('report.saveImage') }}
          </button>
        </div>
      </div>

      <!-- Visual: Contens 周报模板（对齐 Desktop/周报/index.html） -->
      <div v-if="viewMode === 'visual' && visual" class="report-page">
        <header class="rpt-hero">
          <div class="hero-visual" aria-hidden="true" />
          <div class="hero-top">
            <div>
              <div class="brand-lockup">
                <img class="project-logo" :src="logoUrl" alt="" width="42" height="42" />
                <div class="brand">{{ t('report.brand') }}</div>
              </div>
              <div class="hero-meta">{{ displayName }} · {{ streakLabel }}</div>
            </div>
            <div class="week-chip">{{ periodLabel }}</div>
          </div>
          <div class="hero-copy">
            <h1 class="hero-title">{{ t('report.visualHeadline') }}</h1>
            <p class="hero-sub">{{ statsLabel }}</p>
          </div>
        </header>

        <section class="rpt-section metrics-section">
          <div class="section-head">
            <span class="kicker">Week Snapshot</span>
            <h2 class="section-title">{{ t('report.metricsTitle') }}</h2>
            <p class="section-desc">{{ t('report.metricsSub') }}</p>
          </div>
          <div class="metrics">
            <article class="metric metric-hero">
              <div class="metric-label">{{ t('stats.rate') }}</div>
              <div class="metric-value">{{ rate }}%</div>
              <div class="metric-delta">
                {{ t('report.metricDoneOf', { done: completedCount, total: taskCount }) }}
              </div>
              <div class="metric-bar">
                <span class="metric-bar-fill" :style="{ width: rate + '%' }" />
              </div>
            </article>
            <article class="metric">
              <div class="metric-label">{{ t('stats.all') }}</div>
              <div class="metric-value">{{ taskCount }}</div>
              <div class="metric-delta">{{ t('report.metricPeriodTasks') }}</div>
            </article>
            <article class="metric">
              <div class="metric-label">{{ t('stats.done') }}</div>
              <div class="metric-value">{{ completedCount }}</div>
              <div class="metric-delta">{{ streakLabel }}</div>
            </article>
            <article class="metric">
              <div class="metric-label">{{ t('stats.pending') }}</div>
              <div class="metric-value">{{ pendingCount }}</div>
              <div class="metric-delta" :class="{ down: pendingCount > 0 }">
                {{ pendingCount > 0 ? t('report.metricPendingHint') : t('report.metricAllClear') }}
              </div>
            </article>
          </div>
        </section>

        <section v-if="visual.tracks.length" class="rpt-section">
          <div class="section-head">
            <span class="kicker">Progress</span>
            <h2 class="section-title">{{ t('report.tracksTitle') }}</h2>
            <p class="section-desc">{{ t('report.tracksSub') }}</p>
          </div>
          <div class="tracks">
            <div v-for="(tr, i) in visual.tracks" :key="'tr' + i" class="track">
              <div class="track-name">{{ tr.name }}</div>
              <div class="track-pct">{{ tr.pct }}%</div>
              <div class="track-body">
                <div class="track-desc">{{ tr.desc }}</div>
                <div class="progress">
                  <span class="progress-fill" :style="{ width: tr.pct + '%' }" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="rpt-section">
          <div class="section-head">
            <span class="kicker">Outcomes</span>
            <h2 class="section-title">{{ t('report.winsTitle') }}</h2>
            <p class="section-desc">{{ t('report.winsSub') }}</p>
          </div>
          <div class="split">
            <div class="rpt-panel">
              <h3 class="panel-h">{{ t('report.winsPanel') }}</h3>
              <div v-if="visual.wins.length" class="list">
                <div v-for="(w, i) in visual.wins" :key="'w' + i" class="list-item">
                  <span class="dot" />
                  <div class="list-body">
                    <strong class="list-title">{{ w.title }}</strong>
                    <span class="list-desc">{{ w.detail }}</span>
                  </div>
                </div>
              </div>
              <p v-else class="empty-hint">{{ t('report.winsEmpty') }}</p>
            </div>
            <div class="rpt-panel">
              <h3 class="panel-h">{{ t('report.risksPanel') }}</h3>
              <div v-if="visual.risks.length" class="list">
                <div v-for="(r, i) in visual.risks" :key="'r' + i" class="list-item">
                  <span class="dot" :class="r.level" />
                  <div class="list-body">
                    <strong class="list-title">{{ r.title }}</strong>
                    <span class="list-desc">{{ r.detail }}</span>
                  </div>
                </div>
              </div>
              <p v-else class="empty-hint">{{ t('report.risksEmpty') }}</p>
            </div>
          </div>
        </section>

        <section v-if="visual.timeline.length" class="rpt-section">
          <div class="section-head">
            <span class="kicker">Cadence</span>
            <h2 class="section-title">{{ t('report.timelineTitle') }}</h2>
            <p class="section-desc">{{ t('report.timelineSub') }}</p>
          </div>
          <div class="rpt-panel">
            <div class="timeline">
              <div v-for="(node, i) in visual.timeline" :key="'t' + i" class="t-item">
                <div class="t-day">{{ node.day }}</div>
                <h4 class="t-title">{{ node.title }}</h4>
                <p class="t-desc">{{ node.detail }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="rpt-section">
          <div class="section-head">
            <span class="kicker">Next</span>
            <h2 class="section-title">{{ t('report.plansTitle') }}</h2>
            <p class="section-desc">{{ t('report.plansSub') }}</p>
          </div>
          <div v-if="visual.plans.length" class="plan-grid">
            <article v-for="(p, i) in visual.plans" :key="'p' + i" class="plan">
              <div class="prio" :class="p.prioClass">{{ p.prio }}</div>
              <div class="plan-body">
                <h4 class="plan-title">{{ p.title }}</h4>
                <p class="plan-desc">{{ p.detail }}</p>
              </div>
            </article>
          </div>
          <p v-else class="empty-hint block">{{ t('report.plansEmpty') }}</p>
        </section>

        <section class="rpt-section">
          <div class="section-head">
            <span class="kicker">Reflection</span>
            <h2 class="section-title">{{ t('report.quoteTitle') }}</h2>
            <p class="section-desc">{{ t('report.quoteSub') }}</p>
          </div>
          <blockquote class="quote">
            <p class="quote-text">{{ visual.quote }}</p>
            <footer class="quote-foot">{{ visual.quoteFooter }}</footer>
          </blockquote>
        </section>

        <footer class="card-foot">
          <span class="foot-meta">{{ statsLabel }}</span>
          <span class="foot-streak">{{ displayName }} · {{ streakLabel }}</span>
        </footer>
      </div>

      <pre v-else class="report-text">{{ plainText }}</pre>
    </section>

    <Teleport to="body">
      <div v-if="posterOpen" class="modal-backdrop" @click.self="posterOpen = false">
        <div class="modal poster-modal">
          <h2>{{ t('report.posterTitle') }}</h2>
          <div v-if="posterBusy" class="empty">{{ t('report.posterRendering') }}</div>
          <img v-else-if="posterDataUrl" :src="posterDataUrl" alt="poster" class="poster-preview" />
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="posterOpen = false">
              {{ t('report.posterClose') }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!posterDataUrl"
              @click="downloadPoster"
            >
              {{ t('report.posterDownload') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
