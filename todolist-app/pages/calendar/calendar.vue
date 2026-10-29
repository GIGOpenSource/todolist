<script setup>
/**
 * 日历页：按日期浏览与管理待办。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlassTabBar from '../../components/GlassTabBar.vue'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import { resyncScrollEdges, onScrollViewEdge } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'
import { getToken, getUsername, nowTs } from '../../utils/storage.js'
import {
  todos,
  ensureTodoCache,
  persistTodos,
} from '../../utils/todoStore.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion, weekdaysShort, formatMonthTitle } from '../../utils/i18n.js'

const cursor = ref(new Date())
const selectedKey = ref('')
const titleProgress = ref(0)
const pageThemeClass = computed(() => themeClass())

function onPageListScroll(e) {
  onScrollViewEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
}

const WEEK = computed(() => {
  void localeVersion.value
  return weekdaysShort()
})

function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  ensureTodoCache()
  if (!selectedKey.value) selectedKey.value = dayKey(new Date())
})

const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth() + 1)

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('calendar.title'),
    monthTitle: formatMonthTitle(year.value, month.value),
    emptyDay: t('calendar.emptyDay'),
  }
})

const countByDay = computed(() => {
  const map = {}
  for (const item of todos.value) {
    const k = dayKey(new Date(item.created_at))
    if (!map[k]) map[k] = { total: 0, pending: 0 }
    map[k].total += 1
    if (!item.completed) map[k].pending += 1
  }
  return map
})

const cells = computed(() => {
  const y = year.value
  const m = month.value - 1
  const first = new Date(y, m, 1)
  const startWeek = first.getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = dayKey(new Date())
  const list = []
  for (let i = 0; i < startWeek; i++) list.push({ empty: true, key: `e-${i}` })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d)
    const key = dayKey(date)
    const stats = countByDay.value[key]
    list.push({
      empty: false,
      key,
      day: d,
      count: stats?.total || 0,
      hasPending: (stats?.pending || 0) > 0,
      isToday: key === today,
      isSelected: key === selectedKey.value,
    })
  }
  return list
})

const selectedTodos = computed(() =>
  todos.value
    .filter((item) => dayKey(new Date(item.created_at)) === selectedKey.value)
    .sort((a, b) => {
      const doneA = a.completed ? 1 : 0
      const doneB = b.completed ? 1 : 0
      if (doneA !== doneB) return doneA - doneB
      return b.created_at - a.created_at
    })
)

function prevMonth() {
  const d = new Date(cursor.value)
  d.setMonth(d.getMonth() - 1)
  cursor.value = d
}

function nextMonth() {
  const d = new Date(cursor.value)
  d.setMonth(d.getMonth() + 1)
  cursor.value = d
}

function selectDay(cell) {
  if (!cell.empty) selectedKey.value = cell.key
}

function toggleTodo(item) {
  item.completed = !item.completed
  item.updated_at = nowTs()
  persistTodos(true)
}

function isOverdue(item) {
  if (!item || item.completed || !item.due_at) return false
  return Number(item.due_at) < Date.now()
}
</script>

<template>
  <view class="page ios-page calendar-page" :class="pageThemeClass">
    <CollapsingNavBar :title="i18n.title" :progress="titleProgress" />
    <view class="content ios-content has-collapse-nav calendar-content">
      <scroll-view scroll-y class="page-scroll" :show-scrollbar="false" @scroll="onPageListScroll">
        <view class="large-title-wrap">
          <text class="large-title">{{ i18n.title }}</text>
        </view>

        <view class="group cal-card">
          <view class="month-bar">
            <view class="nav-btn" @click="prevMonth"><text>‹</text></view>
            <text class="month-title">{{ i18n.monthTitle }}</text>
            <view class="nav-btn" @click="nextMonth"><text>›</text></view>
          </view>

          <view class="week-row">
            <text v-for="(w, wi) in WEEK" :key="wi" class="week">{{ w }}</text>
          </view>

          <view class="grid">
            <view
              v-for="cell in cells"
              :key="cell.key"
              class="cell"
              :class="{
                empty: cell.empty,
                today: cell.isToday,
                selected: cell.isSelected,
              }"
              @click="selectDay(cell)"
            >
              <text v-if="!cell.empty" class="day">{{ cell.day }}</text>
              <view
                v-if="!cell.empty && cell.count"
                class="dot"
                :class="{ pending: cell.hasPending }"
              ></view>
            </view>
          </view>
        </view>

        <text class="section-label">{{ selectedKey }}</text>

        <view v-if="selectedTodos.length === 0" class="empty-inline">
          <text>{{ i18n.emptyDay }}</text>
        </view>
        <view v-else class="group">
          <view
            v-for="(item, idx) in selectedTodos"
            :key="item.id"
            class="row"
            :class="{
              last: idx === selectedTodos.length - 1,
              done: item.completed,
              overdue: isOverdue(item),
            }"
            @click="toggleTodo(item)"
          >
            <view class="check-inner" :class="{ on: item.completed }">
              <text v-if="item.completed" class="tick">✓</text>
            </view>
            <text class="title">{{ item.title }}</text>
          </view>
        </view>

        <view class="bottom-space"></view>
      </scroll-view>
    </view>
    <GlassTabBar />
  </view>
</template>

<style scoped>
.calendar-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.calendar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: 0;
}

.page-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.large-title-wrap {
  padding: 0 8rpx 28rpx;
}

.large-title {
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
}

.cal-card {
  padding: 20rpx 16rpx 24rpx;
  margin-bottom: 20rpx;
  overflow: visible;
  max-width: var(--app-cal-max, 100%);
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
}

.month-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 16rpx;
}

.month-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--app-label);
}

.nav-btn {
  width: 56rpx;
  height: 56rpx;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--app-fill);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: var(--app-tint);
}

.week-row,
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.week {
  text-align: center;
  font-size: 22rpx;
  color: var(--app-tertiary);
  padding: 8rpx 0;
}

.cell {
  aspect-ratio: 1;
  max-width: var(--app-cal-cell, 52px);
  max-height: var(--app-cal-cell, 52px);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin: 4rpx auto;
}

.cell.selected {
  background: var(--app-tint);
}

.cell.selected .day {
  color: var(--app-on-tint);
  font-weight: 600;
}

.cell.today:not(.selected) .day {
  color: var(--app-tint);
  font-weight: 700;
}

.day {
  font-size: 28rpx;
  color: var(--app-label);
}

.dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--app-tint);
  margin-top: 2rpx;
}

.dot.pending {
  background: var(--app-warning);
}

.cell.selected .dot {
  background: var(--app-on-tint);
}

.cell.selected .dot.pending {
  background: var(--app-warning);
  opacity: 0.85;
}

.section-label {
  display: block;
  font-size: 26rpx;
  color: var(--app-secondary);
  margin: 0 8rpx 12rpx;
  font-weight: 600;
}

.empty-inline {
  padding: 32rpx;
  text-align: center;
  color: var(--app-tertiary);
  font-size: 26rpx;
}

.row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 16rpx 22rpx 24rpx;
  border-bottom: 0.5px solid var(--app-separator);
}

.row.last {
  border-bottom: none;
}

.row.done .title {
  color: var(--app-tertiary);
  text-decoration: line-through;
}

.row.overdue .title {
  color: var(--app-overdue);
}

.check-inner {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2px solid var(--app-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-inner.on {
  background: var(--app-success);
  border-color: var(--app-success);
}

.tick {
  color: var(--app-on-tint);
  font-size: 24rpx;
  font-weight: 700;
}

.title {
  flex: 1;
  font-size: 32rpx;
  color: var(--app-label);
  letter-spacing: -0.3px;
}

.bottom-space {
  height: 220rpx;
}
</style>
