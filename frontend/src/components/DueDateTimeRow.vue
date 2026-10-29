<script setup>
/**
 * 截止日期/时刻选择：品牌风格弹出层（对齐日历格与 panel 语言）。
 * dateOnly=true 时仅选日期（汇报起止日等场景）。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  t,
  localeVersion,
  weekdaysShort,
  formatMonthTitle,
} from '../i18n/index.js'

const date = defineModel('date', { type: String, default: '' })
const time = defineModel('time', { type: String, default: '' })

const props = defineProps({
  dateOnly: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  placeholder: { type: String, default: '' },
})

const rootEl = ref(null)
const panelEl = ref(null)
const dateTriggerEl = ref(null)
const timeTriggerEl = ref(null)
const open = ref(null) // null | 'date' | 'time'
const panelStyle = ref({})
const cursor = ref(new Date())

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function pad2(n) {
  return String(n).padStart(2, '0')
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function nowTimeStr() {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDateParts(str) {
  const parts = String(str || '')
    .split('-')
    .map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  return { y: parts[0], m: parts[1], d: parts[2] }
}

function parseTimeParts(str) {
  const parts = String(str || '')
    .split(':')
    .map(Number)
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null
  return { h: parts[0], min: parts[1] }
}

function ensureDefaults() {
  if (!date.value) date.value = todayStr()
  if (!props.dateOnly && !time.value) time.value = nowTimeStr()
}

function syncCursorFromDate() {
  const p = parseDateParts(date.value) || parseDateParts(todayStr())
  cursor.value = new Date(p.y, p.m - 1, 1)
}

const week = computed(() => {
  void localeVersion.value
  return weekdaysShort()
})

const monthTitle = computed(() => {
  void localeVersion.value
  return formatMonthTitle(cursor.value.getFullYear(), cursor.value.getMonth() + 1)
})

const cells = computed(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const first = new Date(y, m, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = todayStr()
  const selected = date.value
  const list = []
  for (let i = 0; i < startPad; i += 1) {
    list.push({ key: `e-${i}`, empty: true })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${y}-${pad2(m + 1)}-${pad2(day)}`
    list.push({
      key,
      empty: false,
      day,
      isToday: key === today,
      isSelected: key === selected,
    })
  }
  return list
})

const selectedHour = computed(() => parseTimeParts(time.value)?.h ?? new Date().getHours())
const selectedMinute = computed(() => parseTimeParts(time.value)?.min ?? new Date().getMinutes())

const timePreview = computed(
  () => `${pad2(selectedHour.value)}:${pad2(selectedMinute.value)}`,
)

const dateLabel = computed(() => {
  void localeVersion.value
  return date.value || props.placeholder || t('common.notSet')
})

const timeLabel = computed(() => {
  void localeVersion.value
  return time.value || t('todos.fieldDueTime')
})

const hasValue = computed(() =>
  props.dateOnly ? Boolean(date.value) : Boolean(date.value || time.value),
)

function placePanel() {
  const trigger =
    open.value === 'time' ? timeTriggerEl.value : dateTriggerEl.value
  const anchor = trigger || rootEl.value
  const panel = panelEl.value
  if (!anchor) return

  const rect = anchor.getBoundingClientRect()
  const gap = 6
  const width = open.value === 'time' ? 168 : 292
  const panelH = panel?.offsetHeight || (open.value === 'time' ? 248 : 320)
  const margin = 12

  let left = rect.left
  if (open.value === 'time') {
    // Prefer aligning to the time field; keep within viewport
    left = rect.right - width
    if (left < margin) left = rect.left
  }
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin
  }
  left = Math.max(margin, left)

  let top = rect.bottom + gap
  if (top + panelH > window.innerHeight - margin) {
    const above = rect.top - panelH - gap
    top = above >= margin ? above : Math.max(margin, window.innerHeight - panelH - margin)
  }

  panelStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    zIndex: 240,
  }
}

async function toggle(kind) {
  if (open.value === kind) {
    open.value = null
    return
  }
  if (kind === 'date') syncCursorFromDate()
  if (kind === 'time') ensureDefaults()
  open.value = kind
  await nextTick()
  placePanel()
  if (kind === 'time') {
    await nextTick()
    scrollTimeIntoView()
    placePanel()
  }
}

function close() {
  open.value = null
}

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

function pickToday() {
  date.value = todayStr()
  syncCursorFromDate()
  if (!props.dateOnly && !time.value) time.value = nowTimeStr()
  close()
}

function pickDay(cell) {
  if (cell.empty) return
  date.value = cell.key
  if (!props.dateOnly && !time.value) time.value = nowTimeStr()
  close()
}

function pickHour(h) {
  const min = pad2(selectedMinute.value)
  time.value = `${h}:${min}`
  if (!date.value) date.value = todayStr()
}

function pickMinute(min) {
  const h = pad2(selectedHour.value)
  time.value = `${h}:${min}`
  if (!date.value) date.value = todayStr()
  close()
}

function scrollTimeIntoView() {
  const panel = panelEl.value
  if (!panel) return
  panel.querySelectorAll('[data-active="true"]').forEach((el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
}

function clear() {
  date.value = ''
  if (!props.dateOnly) time.value = ''
  close()
}

function onDocPointer(e) {
  if (!open.value) return
  const panel = panelEl.value
  const root = rootEl.value
  if (panel?.contains(e.target) || root?.contains(e.target)) return
  close()
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

function onResize() {
  if (open.value) placePanel()
}

watch(open, (v) => {
  if (v) placePanel()
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onResize, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onResize, true)
})
</script>

<template>
  <div ref="rootEl" class="due-row" :class="{ 'date-only': dateOnly, open: !!open }">
    <button
      ref="dateTriggerEl"
      type="button"
      class="due-trigger-wrap"
      :aria-expanded="open === 'date'"
      :aria-label="placeholder || t('todos.fieldDue')"
      @click="toggle('date')"
    >
      <span class="due-trigger-label" :class="{ empty: !date }">{{ dateLabel }}</span>
    </button>
    <button
      v-if="!dateOnly"
      ref="timeTriggerEl"
      type="button"
      class="due-trigger-wrap"
      :aria-expanded="open === 'time'"
      :aria-label="t('todos.fieldDueTime')"
      @click="toggle('time')"
    >
      <span class="due-trigger-label" :class="{ empty: !time }">{{ timeLabel }}</span>
    </button>
    <button
      v-if="clearable && hasValue"
      type="button"
      class="btn btn-ghost btn-compact due-clear"
      @click="clear"
    >
      {{ t('common.clear') }}
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelEl"
        class="due-picker panel"
        :class="open === 'time' ? 'is-time' : 'is-date'"
        role="dialog"
        :aria-label="open === 'time' ? t('todos.fieldDueTime') : t('todos.fieldDue')"
        :style="panelStyle"
      >
        <template v-if="open === 'date'">
          <div class="due-picker-head">
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              aria-label="Previous month"
              @click="prevMonth"
            >
              ‹
            </button>
            <strong>{{ monthTitle }}</strong>
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              aria-label="Next month"
              @click="nextMonth"
            >
              ›
            </button>
          </div>
          <div class="due-picker-week">
            <span v-for="(w, i) in week" :key="i">{{ w }}</span>
          </div>
          <div class="due-picker-grid">
            <button
              v-for="cell in cells"
              :key="cell.key"
              type="button"
              class="due-picker-day"
              :class="{
                empty: cell.empty,
                today: cell.isToday,
                selected: cell.isSelected,
              }"
              :disabled="cell.empty"
              @click="pickDay(cell)"
            >
              <span v-if="!cell.empty">{{ cell.day }}</span>
            </button>
          </div>
          <div class="due-picker-foot">
            <button type="button" class="btn btn-ghost btn-compact" @click="pickToday">
              {{ t('todos.today') }}
            </button>
            <button type="button" class="btn btn-ghost btn-compact" @click="close">
              {{ t('common.cancel') }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="due-time-preview" aria-hidden="true">{{ timePreview }}</div>
          <div class="due-picker-time">
            <div class="due-time-pane">
              <span class="due-time-col-label">HH</span>
              <div class="due-time-col" aria-label="Hour">
                <button
                  v-for="h in HOURS"
                  :key="'h-' + h"
                  type="button"
                  class="due-time-opt"
                  :data-active="Number(h) === selectedHour ? 'true' : undefined"
                  :class="{ active: Number(h) === selectedHour }"
                  @click="pickHour(h)"
                >
                  {{ h }}
                </button>
              </div>
            </div>
            <div class="due-time-pane">
              <span class="due-time-col-label">MM</span>
              <div class="due-time-col" aria-label="Minute">
                <button
                  v-for="m in MINUTES"
                  :key="'m-' + m"
                  type="button"
                  class="due-time-opt"
                  :data-active="Number(m) === selectedMinute ? 'true' : undefined"
                  :class="{ active: Number(m) === selectedMinute }"
                  @click="pickMinute(m)"
                >
                  {{ m }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>
