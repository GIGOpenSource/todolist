<script setup>
/**
 * 桌面端日历页：按日期浏览、查看与编辑待办详情。
 */
import { ref, computed, onMounted } from 'vue'
import {
  todos,
  ensureTodoCache,
  removeTodoById,
  patchTodo,
  revision,
} from '../stores/todos.js'
import { nowTs } from '../stores/storage.js'
import { t, localeVersion, weekdaysShort, formatMonthTitle, formatDateShort } from '../i18n/index.js'
import { toast } from '../utils/toast.js'
import DueDateTimeRow from '../components/DueDateTimeRow.vue'

const cursor = ref(new Date())
const selectedKey = ref('')
const selectedId = ref('')

const editTitle = ref('')
const editDetail = ref('')
const editDueDate = ref('')
const editDueTime = ref('')

onMounted(() => {
  ensureTodoCache()
  selectedKey.value = dayKey(new Date())
})

function pad2(n) {
  return String(n).padStart(2, '0')
}

function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayStart(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function parseDueDateTime(dateStr, timeStr) {
  if (!dateStr) return 0
  const parts = String(dateStr).split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 0
  const [y, m, day] = parts
  let h = 0
  let min = 0
  if (timeStr) {
    const tp = String(timeStr).split(':').map(Number)
    h = Number.isFinite(tp[0]) ? tp[0] : 0
    min = Number.isFinite(tp[1]) ? tp[1] : 0
  }
  return new Date(y, m - 1, day, h, min).getTime()
}

function toDueDateStr(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toDueTimeStr(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDueTime(ts) {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDueLabel(ts) {
  if (!ts) return ''
  const start = dayStart(ts)
  const today = dayStart(Date.now())
  const tomorrow = today + 86400000
  const yesterday = today - 86400000
  const time = formatDueTime(ts)
  if (start === today) return t('todos.dueTodayAt', { time })
  if (start === tomorrow) return t('todos.dueTomorrowAt', { time })
  if (start === yesterday) return t('todos.dueYesterdayAt', { time })
  return t('todos.dueOnAt', { date: formatDateShort(ts), time })
}

function isOverdue(item) {
  if (!item || item.completed || !item.due_at) return false
  return Number(item.due_at) < Date.now()
}

const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth() + 1)

const week = computed(() => {
  void localeVersion.value
  return weekdaysShort()
})

const monthTitle = computed(() => {
  void localeVersion.value
  return formatMonthTitle(year.value, month.value)
})

const countByDay = computed(() => {
  void revision.value
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
  while (list.length % 7 !== 0) {
    list.push({ empty: true, key: `e-tail-${list.length}` })
  }
  return list
})

const selectedTodos = computed(() => {
  void revision.value
  return todos.value
    .filter((item) => dayKey(new Date(item.created_at)) === selectedKey.value)
    .sort((a, b) => {
      const doneA = a.completed ? 1 : 0
      const doneB = b.completed ? 1 : 0
      if (doneA !== doneB) return doneA - doneB
      return b.created_at - a.created_at
    })
})

const selected = computed(() => {
  void revision.value
  if (!selectedId.value) return null
  return todos.value.find((x) => x.id === selectedId.value) || null
})

const isDirty = computed(() => {
  if (!selected.value) return false
  return (
    editTitle.value !== (selected.value.title || '') ||
    editDetail.value !== (selected.value.detail || '') ||
    editDueDate.value !== toDueDateStr(selected.value.due_at) ||
    editDueTime.value !== toDueTimeStr(selected.value.due_at)
  )
})

const selectedLabel = computed(() => {
  void localeVersion.value
  if (!selectedKey.value) return ''
  const [y, m, d] = selectedKey.value.split('-').map(Number)
  return formatDateShort(new Date(y, m - 1, d).getTime())
})

const selectedCountLabel = computed(() => {
  void localeVersion.value
  return t('todos.subtitle', {
    pending: selectedTodos.value.filter((x) => !x.completed).length,
    done: selectedTodos.value.filter((x) => x.completed).length,
  })
})

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
  if (cell.empty) return
  selectedKey.value = cell.key
  selectedId.value = ''
  editTitle.value = ''
  editDetail.value = ''
  editDueDate.value = ''
  editDueTime.value = ''
}

function selectItem(item) {
  selectedId.value = item.id
  editTitle.value = item.title
  editDetail.value = item.detail || ''
  editDueDate.value = toDueDateStr(item.due_at)
  editDueTime.value = toDueTimeStr(item.due_at)
}

function toastCommit(commit) {
  if (commit && !commit.ok && commit.error) {
    toast(commit.error.message || t('common.requestFailed'))
  }
}

async function toggle(item) {
  const res = await patchTodo(item.id, {
    completed: !item.completed,
    updated_at: nowTs(),
  })
  toastCommit(res?.commit)
}

async function saveEdit() {
  if (!selected.value) return
  const title = editTitle.value.trim()
  if (!title) {
    toast(t('todos.titleRequired'))
    return
  }
  const res = await patchTodo(selected.value.id, {
    title,
    detail: editDetail.value.trim(),
    due_at: parseDueDateTime(editDueDate.value, editDueTime.value),
    updated_at: nowTs(),
  })
  toastCommit(res?.commit)
  if (!res?.commit || res.commit.ok) toast(t('todos.saved'))
}

async function onDelete() {
  if (!selected.value) return
  if (!window.confirm(t('todos.deleteContent'))) return
  const id = selected.value.id
  const commit = await removeTodoById(id)
  selectedId.value = ''
  toastCommit(commit)
}
</script>

<template>
  <div class="calendar-layout">
    <section class="cal-panel panel">
      <div class="cal-head">
        <button type="button" class="btn btn-secondary btn-compact" @click="prevMonth">‹</button>
        <h2>{{ monthTitle }}</h2>
        <button type="button" class="btn btn-secondary btn-compact" @click="nextMonth">›</button>
      </div>
      <div class="cal-week">
        <span v-for="(w, i) in week" :key="i">{{ w }}</span>
      </div>
      <div class="cal-grid">
        <button
          v-for="cell in cells"
          :key="cell.key"
          type="button"
          class="cal-cell"
          :class="{
            empty: cell.empty,
            today: cell.isToday,
            selected: cell.isSelected,
            pending: cell.hasPending,
          }"
          :disabled="cell.empty"
          @click="selectDay(cell)"
        >
          <template v-if="!cell.empty">
            <span class="day-num">{{ cell.day }}</span>
            <span v-if="cell.count" class="day-count">{{ cell.count }}</span>
          </template>
        </button>
      </div>
    </section>

    <section class="cal-day panel">
      <div class="cal-day-head">
        <h2>{{ selectedLabel || selectedKey }}</h2>
        <span class="cal-day-meta">{{ selectedCountLabel }}</span>
      </div>
      <div v-if="!selectedTodos.length" class="empty">
        <strong>{{ t('calendar.emptyDay') }}</strong>
      </div>
      <div v-else class="day-list">
        <button
          v-for="item in selectedTodos"
          :key="item.id"
          type="button"
          class="todo-row"
          :class="{ selected: item.id === selectedId, done: item.completed }"
          @click="selectItem(item)"
        >
          <span
            class="check"
            :class="{ on: item.completed }"
            @click.stop="toggle(item)"
          />
          <span class="todo-body">
            <span class="todo-title">{{ item.title }}</span>
            <span v-if="item.due_at" class="todo-due" :class="{ overdue: isOverdue(item) }">
              {{ formatDueLabel(item.due_at) }}
            </span>
            <span v-else-if="item.detail" class="todo-due">{{ item.detail }}</span>
          </span>
        </button>
      </div>
    </section>

    <aside class="tasks-detail panel">
      <template v-if="selected">
        <h2>{{ t('todos.editTitle') }}</h2>
        <div class="field">
          <label>{{ t('todos.fieldTitle') }}</label>
          <input v-model="editTitle" :placeholder="t('todos.titlePh')" />
        </div>
        <div class="field">
          <label>{{ t('todos.fieldDetail') }}</label>
          <textarea v-model="editDetail" rows="6" :placeholder="t('todos.detailPh')" />
        </div>
        <div class="field">
          <label>{{ t('todos.fieldDue') }}</label>
          <DueDateTimeRow v-model:date="editDueDate" v-model:time="editDueTime" />
        </div>
        <div class="detail-actions">
          <button type="button" class="btn btn-danger btn-compact" @click="onDelete">
            {{ t('common.delete') }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-compact"
            :disabled="!isDirty"
            @click="saveEdit"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </template>
      <div v-else class="empty">
        <strong>{{ t('calendar.selectTask') }}</strong>
        {{ t('calendar.selectTaskSub') }}
      </div>
    </aside>
  </div>
</template>
