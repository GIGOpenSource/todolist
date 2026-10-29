<!-- 管理端-数据统计看板（日活/任务/访问等）。 -->
<template>
  <div class="dash">
    <div class="page-head">
      <div>
        <h1>{{ t('stats.title') }}</h1>
        <p>
          {{ t('stats.subtitle', { date: stats?.date || t('common.dash') }) }}
          <span v-if="stats?.generated_at">
            · {{ t('stats.generatedAt', { time: formatTime(stats.generated_at) }) }}
          </span>
        </p>
      </div>
      <button class="btn" type="button" :disabled="loading" @click="load">
        {{ loading ? t('common.refreshing') : t('common.refresh') }}
      </button>
    </div>

    <PageFilters page-key="stats" @change="onFiltersChange" />

    <p v-if="error" class="login-error">{{ error }}</p>

    <template v-if="stats">
      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.overview') }}</div>
        <div class="stats-grid overview-grid">
          <div v-for="c in overviewCards" :key="c.key" class="stat-card">
            <h3>{{ c.title }}</h3>
            <div class="stat-today">{{ c.value }}</div>
            <div class="stat-total">{{ c.sub }}</div>
          </div>
        </div>
      </section>

      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.trends') }}</div>
        <div class="trend-grid">
          <div v-for="chart in trendCharts" :key="chart.key" class="trend-card">
            <div class="trend-head">
              <span>{{ chart.title }}</span>
              <strong>{{ chart.sum }}</strong>
            </div>
            <div class="bars" :title="chart.title">
              <div
                v-for="(v, i) in chart.values"
                :key="i"
                class="bar"
                :style="{ height: barHeight(v, chart.max) + '%' }"
                :title="`${stats.trends.days[i]}: ${v}`"
              />
            </div>
            <div class="trend-days">
              <span>{{ shortDay(stats.trends.days[0]) }}</span>
              <span>{{ shortDay(stats.trends.days[stats.trends.days.length - 1]) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.retention') }}</div>
        <p class="muted retention-tip">{{ t('stats.retention.tip') }}</p>
        <div class="table-wrap retention-wrap">
          <table class="retention-table">
            <thead>
              <tr>
                <th>{{ t('stats.retention.cohort') }}</th>
                <th>{{ t('stats.retention.newUsers') }}</th>
                <th v-for="day in retentionDays" :key="day">
                  {{ retentionDayHeader(day) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!retentionCohorts.length">
                <td :colspan="2 + retentionDays.length" class="empty">
                  {{ t('common.empty') }}
                </td>
              </tr>
              <tr v-for="row in retentionCohorts" :key="row.date">
                <td class="mono">{{ row.date }}</td>
                <td class="mono">{{ row.new_users }}</td>
                <td
                  v-for="day in retentionDays"
                  :key="day"
                  class="mono retention-cell"
                  :class="retentionCellClass(row, day)"
                  :title="retentionCellTitle(row, day)"
                >
                  <template v-if="row.rates?.[day] == null">
                    {{ t('common.dash') }}
                  </template>
                  <template v-else>
                    <span class="retention-rate">{{ formatRetentionRate(row.rates[day]) }}</span>
                    <span class="retention-count">
                      {{ row.retained?.[day] ?? 0 }}/{{ row.new_users ?? 0 }}
                    </span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.ops') }}</div>
        <div class="stats-grid">
          <div v-for="c in opsCards" :key="c.key" class="stat-card">
            <h3>{{ c.title }}</h3>
            <div class="stat-today">{{ c.value }}</div>
            <div class="stat-total">{{ c.sub }}</div>
          </div>
        </div>
        <div class="split-panels">
          <div class="panel">
            <h4>{{ t('stats.ops.registerMethods') }}</h4>
            <ul v-if="ops.register_methods?.length" class="kv-list">
              <li v-for="row in ops.register_methods" :key="row.method">
                <span>{{ methodLabel(row.method) }}</span>
                <strong>{{ row.count }}</strong>
              </li>
            </ul>
            <p v-else class="muted empty-inline">{{ t('common.empty') }}</p>
          </div>
          <div class="panel">
            <h4>{{ t('stats.ops.registerRegions') }}</h4>
            <ul v-if="ops.register_regions?.length" class="kv-list">
              <li v-for="row in ops.register_regions" :key="row.region">
                <span>{{ row.region || t('stats.unknown') }}</span>
                <strong>{{ row.count }}</strong>
              </li>
            </ul>
            <p v-else class="muted empty-inline">{{ t('common.empty') }}</p>
          </div>
          <div class="panel">
            <h4>{{ t('stats.ops.registerPlatforms') }}</h4>
            <ul v-if="ops.register_platforms?.length" class="kv-list">
              <li v-for="row in ops.register_platforms" :key="row.platform">
                <span>{{ row.label || row.platform || t('stats.unknown') }}</span>
                <strong>{{ row.count }}</strong>
              </li>
            </ul>
            <p v-else class="muted empty-inline">{{ t('common.empty') }}</p>
          </div>
        </div>
      </section>

      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.product') }}</div>
        <div class="stats-grid">
          <div v-for="c in productCards" :key="c.key" class="stat-card">
            <h3>{{ c.title }}</h3>
            <div class="stat-today">{{ c.value }}</div>
            <div class="stat-total">{{ c.sub }}</div>
          </div>
        </div>
        <div class="split-panels">
          <div class="panel">
            <h4>{{ t('stats.product.reportStatus') }}</h4>
            <ul class="kv-list">
              <li v-for="(n, k) in product.reports?.by_status || {}" :key="k">
                <span>{{ statusLabel(k) }}</span>
                <strong>{{ n }}</strong>
              </li>
            </ul>
          </div>
          <div class="panel">
            <h4>{{ t('stats.product.reportSource') }}</h4>
            <ul class="kv-list">
              <li v-for="(n, k) in product.reports?.by_source || {}" :key="k">
                <span>{{ sourceLabel(k) }}</span>
                <strong>{{ n }}</strong>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="dash-section">
        <div class="section-label">{{ t('stats.section.eng') }}</div>
        <div class="stats-grid">
          <div v-for="c in engCards" :key="c.key" class="stat-card">
            <h3>{{ c.title }}</h3>
            <div class="stat-today" :class="c.warn ? 'warn' : ''">{{ c.value }}</div>
            <div class="stat-total">{{ c.sub }}</div>
          </div>
        </div>
        <div class="split-panels">
          <div class="panel">
            <h4>{{ t('stats.eng.http') }}</h4>
            <ul class="kv-list">
              <li>
                <span>{{ t('stats.eng.requestsTotal') }}</span>
                <strong>{{ eng.process?.requests_total ?? 0 }}</strong>
              </li>
              <li>
                <span>{{ t('stats.eng.avgElapsed') }}</span>
                <strong>{{ eng.process?.avg_elapsed_ms ?? 0 }} ms</strong>
              </li>
              <li v-for="(n, code) in eng.process?.status_counts || {}" :key="code">
                <span>HTTP {{ code }}</span>
                <strong>{{ n }}</strong>
              </li>
            </ul>
          </div>
          <div class="panel">
            <h4>{{ t('stats.eng.topPaths') }}</h4>
            <ul v-if="(eng.process?.top_paths || []).length" class="kv-list path-list">
              <li v-for="([path, n], i) in eng.process.top_paths.slice(0, 8)" :key="path + i">
                <span class="mono path">{{ path }}</span>
                <strong>{{ n }}</strong>
              </li>
            </ul>
            <p v-else class="muted empty-inline">{{ t('stats.eng.noRequests') }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
/**
 * 管理端-数据统计看板（日活/任务/访问等）。
 */
/**
 * 管理后台统计页：展示用户、待办与活跃数据。
 */
import { computed, onMounted, ref } from 'vue'
import { fetchStats } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'
import PageFilters from '../components/PageFilters.vue'
import { loadFilters } from '../utils/filters.js'
import { formatBeijingTimeLabel } from '../utils/time.js'

const loading = ref(false)
const error = ref('')
const stats = ref(null)
const filters = ref(loadFilters('stats'))
const RETENTION_MAX_DAY = 30

const ops = computed(() => stats.value?.ops || {})
const product = computed(() => stats.value?.product || {})
const eng = computed(() => stats.value?.eng || {})
const overview = computed(() => stats.value?.overview || {})
const retention = computed(() => stats.value?.retention || {})
const retentionCohorts = computed(() => retention.value?.cohorts || [])
const retentionMaxDay = computed(() => retention.value?.max_day ?? RETENTION_MAX_DAY)

const retentionDays = computed(() => {
  const days = []
  for (let d = 0; d <= retentionMaxDay.value; d++) days.push(d)
  return days
})

function retentionDayHeader(day) {
  void localeVersion.value
  if (day === 0) return t('stats.retention.day0')
  return t('stats.retention.dayN', { n: day })
}

function formatRetentionRate(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return t('common.dash')
  return `${Number(rate).toFixed(1)}%`
}

function retentionCellTitle(row, day) {
  const retained = row.retained?.[day]
  const rate = row.rates?.[day]
  if (rate == null) return t('stats.retention.pending')
  return t('stats.retention.cellTip', {
    retained: retained ?? 0,
    total: row.new_users ?? 0,
    rate: Number(rate).toFixed(1),
  })
}

function retentionCellClass(row, day) {
  const rate = row.rates?.[day]
  if (rate == null) return 'is-pending'
  if (rate >= 40) return 'is-good'
  if (rate >= 20) return 'is-mid'
  return 'is-low'
}
const overviewCards = computed(() => {
  void localeVersion.value
  const o = overview.value
  const dash = t('common.dash')
  return [
    {
      key: 'users',
      title: t('stats.overview.users'),
      value: o.users_total ?? dash,
      sub: t('stats.overview.usersSub', { n: o.users_active ?? dash }),
    },
    {
      key: 'dau',
      title: t('stats.overview.dau'),
      value: o.dau ?? dash,
      sub: t('stats.overview.dauSub', { wau: o.wau ?? dash, mau: o.mau ?? dash }),
    },
    {
      key: 'visits',
      title: t('stats.overview.visits'),
      value: o.visits_today ?? dash,
      sub: t('stats.overview.visitsSub'),
    },
    {
      key: 'todos',
      title: t('stats.overview.todos'),
      value: o.todos_total ?? dash,
      sub: t('stats.overview.todosSub', { n: o.completion_rate ?? 0 }),
    },
    {
      key: 'reports',
      title: t('stats.overview.reports'),
      value: o.reports_today ?? dash,
      sub: t('stats.overview.reportsSub'),
    },
    {
      key: 'db',
      title: t('stats.overview.db'),
      value: o.db_ok ? t('stats.overview.dbOk') : t('stats.overview.dbFail'),
      sub: o.db_ok ? t('stats.overview.dbOkSub') : t('stats.overview.dbFailSub'),
    },
  ]
})

const opsCards = computed(() => {
  void localeVersion.value
  const o = ops.value
  const dash = t('common.dash')
  return [
    {
      key: 'new',
      title: t('stats.ops.newUsers'),
      value: o.new_users?.today ?? dash,
      sub: t('stats.ops.newUsersSub', {
        d7: o.new_users?.d7 ?? dash,
        d30: o.new_users?.d30 ?? dash,
      }),
    },
    {
      key: 'active',
      title: t('stats.ops.active'),
      value: o.active_users?.dau ?? dash,
      sub: t('stats.ops.activeSub', {
        wau: o.active_users?.wau ?? dash,
        mau: o.active_users?.mau ?? dash,
      }),
    },
    {
      key: 'visits',
      title: t('stats.ops.visits'),
      value: o.site_visits?.today ?? dash,
      sub: t('stats.ops.visitsSub', {
        d7: o.site_visits?.d7 ?? dash,
        total: o.site_visits?.total ?? dash,
      }),
    },
    {
      key: 'cvr',
      title: t('stats.ops.cvr'),
      value:
        o.visit_to_register_pct_today == null ? dash : `${o.visit_to_register_pct_today}%`,
      sub: t('stats.ops.cvrSub'),
    },
    {
      key: 'pending',
      title: t('stats.ops.pending'),
      value: o.users_pending_delete ?? dash,
      sub: t('stats.ops.pendingSub'),
    },
    {
      key: 'admins',
      title: t('stats.ops.admins'),
      value: o.admins ?? dash,
      sub: t('stats.ops.adminsSub'),
    },
  ]
})

const productCards = computed(() => {
  void localeVersion.value
  const todoStats = product.value.todos || {}
  const reports = product.value.reports || {}
  const dash = t('common.dash')
  return [
    {
      key: 'created',
      title: t('stats.product.created'),
      value: todoStats.created_today ?? dash,
      sub: t('stats.product.createdSub', {
        d7: todoStats.created_7d ?? dash,
        total: todoStats.total ?? dash,
      }),
    },
    {
      key: 'done',
      title: t('stats.product.done'),
      value: todoStats.completed_today ?? dash,
      sub: t('stats.product.doneSub', {
        d7: todoStats.completed_7d ?? dash,
        pending: todoStats.pending ?? dash,
      }),
    },
    {
      key: 'rate',
      title: t('stats.product.rate'),
      value: `${todoStats.completion_rate ?? 0}%`,
      sub: t('stats.product.rateSub', {
        avg: todoStats.avg_per_active_user ?? 0,
        users: todoStats.users_with_todos ?? 0,
      }),
    },
    {
      key: 'reports',
      title: t('stats.product.reports'),
      value: reports.today ?? dash,
      sub: t('stats.product.reportsSub', {
        d7: reports.d7 ?? dash,
        rate: reports.success_rate ?? 0,
      }),
    },
  ]
})

const engCards = computed(() => {
  void localeVersion.value
  const e = eng.value
  const llm = e.llm_models || {}
  const jobs = e.report_jobs || {}
  const dash = t('common.dash')
  return [
    {
      key: 'db',
      title: t('stats.eng.db'),
      value: e.db === 'ok' ? 'OK' : 'FAIL',
      sub: t('stats.eng.dbSub'),
      warn: e.db !== 'ok',
    },
    {
      key: 'llm',
      title: t('stats.eng.llm'),
      value: llm.enabled ?? 0,
      sub: e.llm_runtime_configured
        ? t('stats.eng.llmReady', { model: llm.default_model || llm.default_name || dash })
        : t('stats.eng.llmMissing'),
    },
    {
      key: 'jobs',
      title: t('stats.eng.jobs'),
      value: jobs.failed ?? 0,
      sub: t('stats.eng.jobsSub', {
        done: jobs.done ?? 0,
        queued: jobs.queued ?? 0,
        running: jobs.running ?? 0,
      }),
      warn: (jobs.failed || 0) > 0,
    },
    {
      key: 'sync',
      title: t('stats.eng.sync'),
      value: e.sync_users ?? 0,
      sub: t('stats.eng.syncSub'),
    },
  ]
})

const trendCharts = computed(() => {
  void localeVersion.value
  const tr = stats.value?.trends || {}
  const defs = [
    { key: 'new_users', title: t('stats.trend.newUsers'), values: tr.new_users || [] },
    { key: 'dau', title: t('stats.trend.dau'), values: tr.dau || [] },
    { key: 'site_visits', title: t('stats.trend.visits'), values: tr.site_visits || [] },
    { key: 'todos_created', title: t('stats.trend.todos'), values: tr.todos_created || [] },
    { key: 'reports', title: t('stats.trend.reports'), values: tr.reports || [] },
  ]
  return defs.map((d) => {
    const values = d.values.map((v) => Number(v) || 0)
    const max = Math.max(...values, 1)
    const sum = values.reduce((a, b) => a + b, 0)
    return { ...d, values, max, sum }
  })
})

function barHeight(v, max) {
  if (!max) return 4
  return Math.max(4, Math.round((v / max) * 100))
}

function shortDay(iso) {
  if (!iso) return ''
  return String(iso).slice(5)
}

function formatTime(iso) {
  if (!iso) return t('common.dash')
  return formatBeijingTimeLabel(iso) || t('common.dash')
}

function methodLabel(m) {
  void localeVersion.value
  const normalized = m === 'ios' ? 'apple' : m
  const key = `users.method.${normalized}`
  const label = t(key)
  return label === key ? m || t('stats.unknown') : label
}

function statusLabel(s) {
  void localeVersion.value
  const key = `stats.status.${s}`
  const label = t(key)
  return label === key ? s || t('stats.unknown') : label
}

function sourceLabel(s) {
  void localeVersion.value
  if (s === 'llm') return t('stats.source.llm')
  if (s === 'template') return t('stats.source.template')
  if (s === '' || s == null) return t('stats.source.unmarked')
  return s
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await fetchStats(filters.value)
    stats.value = data
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function onFiltersChange(next) {
  filters.value = { ...next }
  load()
}

onMounted(load)
</script>

<style scoped>
.dash-section {
  margin-bottom: 28px;
}

.section-label {
  margin-bottom: 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
}

.retention-tip {
  margin: 0 0 10px;
  font-size: 12px;
}

.retention-wrap {
  margin-bottom: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.retention-table {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
}

.retention-table th,
.retention-table td {
  text-align: center;
  white-space: nowrap;
  padding: 8px 10px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  overflow: visible;
  text-overflow: clip;
  vertical-align: middle;
  border-bottom: 1px solid var(--border);
}

.retention-table th {
  min-width: 4.25rem;
}

.retention-table td.retention-cell {
  min-width: 4.75rem;
}

.retention-table th:first-child,
.retention-table td:first-child {
  text-align: left;
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 7.5rem;
  background: var(--bg-elevated, #1c2430);
  box-shadow: 1px 0 0 var(--border);
}

.retention-table th:nth-child(2),
.retention-table td:nth-child(2) {
  text-align: right;
  position: sticky;
  left: 7.5rem;
  z-index: 2;
  min-width: 3.5rem;
  background: var(--bg-elevated, #1c2430);
  box-shadow: 1px 0 0 var(--border);
}

.retention-rate {
  display: block;
  font-weight: 600;
  line-height: 1.25;
}

.retention-count {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.2;
}

.retention-cell.is-good .retention-rate {
  color: #6ee7b7;
}

.retention-cell.is-mid .retention-rate {
  color: #fbbf24;
}

.retention-cell.is-low .retention-rate {
  color: #f87171;
}

.retention-cell.is-pending {
  color: var(--text-muted);
}

.overview-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.trend-card {
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.trend-head strong {
  color: var(--text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 56px;
}

.bar {
  flex: 1;
  min-width: 0;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #5eb0f7, rgba(61, 156, 240, 0.35));
}

.trend-days {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--mono);
}

.split-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.panel {
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.panel h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
}

.kv-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.kv-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.kv-list li:last-child {
  border-bottom: none;
}

.kv-list .path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.empty-inline {
  margin: 0;
  font-size: 13px;
}

.stat-today.warn {
  color: #ffb4b4;
}

@media (max-width: 1100px) {
  .trend-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .overview-grid,
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .split-panels,
  .trend-grid {
    grid-template-columns: 1fr;
  }
}
</style>
