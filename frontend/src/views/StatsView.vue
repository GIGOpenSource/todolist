<script setup>
/**
 * 桌面端统计页：展示待办完成趋势与效率指标。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { todos, ensureTodoCache, revision } from '../stores/todos.js'
import { touchActiveDay, getStreakDays, syncStreakToServer } from '../stores/storage.js'
import { touchStreak } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'

const router = useRouter()
const streak = ref(0)

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

onMounted(refresh)

const total = computed(() => {
  void revision.value
  return todos.value.length
})
const pending = computed(() => todos.value.filter((x) => !x.completed).length)
const done = computed(() => todos.value.filter((x) => x.completed).length)
const rate = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

const last7 = computed(() => {
  void revision.value
  const days = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = dayKey(d.getTime())
    days.push({
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      created: todos.value.filter((x) => dayKey(x.created_at) === key).length,
      finished: todos.value.filter((x) => x.completed && dayKey(x.updated_at) === key).length,
    })
  }
  return days
})

const maxBar = computed(() => Math.max(1, ...last7.value.map((d) => Math.max(d.created, d.finished))))

const i18n = computed(() => {
  void localeVersion.value
  return {
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
    reportEntry: t('report.entry'),
  }
})
</script>

<template>
  <div class="stats-layout">
    <section class="streak-card panel">
      <div class="streak-main">
        <span class="streak-num">{{ streak }}</span>
        <div>
          <div class="streak-title">{{ i18n.streak }}</div>
          <div class="streak-days">{{ i18n.streakDays }}</div>
        </div>
      </div>
      <p class="page-sub">{{ i18n.streakHint }}</p>
      <button type="button" class="btn btn-primary btn-compact" @click="router.push({ name: 'report' })">
        {{ i18n.reportEntry }}
      </button>
    </section>

    <section class="stat-cards">
      <div class="panel stat-card"><strong>{{ total }}</strong><span>{{ i18n.all }}</span></div>
      <div class="panel stat-card"><strong>{{ pending }}</strong><span>{{ i18n.pending }}</span></div>
      <div class="panel stat-card"><strong>{{ done }}</strong><span>{{ i18n.done }}</span></div>
      <div class="panel stat-card"><strong>{{ rate }}%</strong><span>{{ i18n.rate }}</span></div>
    </section>

    <section class="panel bars-card">
      <div class="bars-head">
        <h2>{{ i18n.last7 }}</h2>
        <div class="legend">
          <span><i class="dot created" />{{ i18n.legendCreated }}</span>
          <span><i class="dot finished" />{{ i18n.legendFinished }}</span>
        </div>
      </div>
      <div class="bars">
        <div v-for="d in last7" :key="d.key" class="bar-col">
          <div class="bar-pair">
            <div class="bar created" :style="{ height: `${(d.created / maxBar) * 120}px` }" />
            <div class="bar finished" :style="{ height: `${(d.finished / maxBar) * 120}px` }" />
          </div>
          <span>{{ d.label }}</span>
        </div>
      </div>
      <p class="page-sub">{{ i18n.subtitle }}</p>
    </section>
  </div>
</template>
