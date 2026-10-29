<script setup>
/**
 * 桌面端待办页：创建、筛选、编辑并同步待办。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  todos,
  ensureTodoCache,
  removeTodoById,
  addTodo,
  patchTodo,
  revision,
} from '../stores/todos.js'
import { notes, ensureNoteCache, revision as notesRevision } from '../stores/notes.js'
import { nowTs } from '../stores/storage.js'
import { splitNoteLinkSegments } from '../utils/noteLinks.js'
import { t, localeVersion, formatDateShort } from '../i18n/index.js'
import { toast } from '../utils/toast.js'
import DueDateTimeRow from '../components/DueDateTimeRow.vue'

const router = useRouter()

const FILTER_KEYS = [
  { key: 'all', labelKey: 'todos.filterAll' },
  { key: 'pending', labelKey: 'todos.filterPending' },
  { key: 'done', labelKey: 'todos.filterDone' },
]

const inputTitle = ref('')
const filterKey = ref('all')
const selectedId = ref('')

const editTitle = ref('')
const editDetail = ref('')
const editDueDate = ref('')
const editDueTime = ref('')

onMounted(() => {
  ensureTodoCache()
  ensureNoteCache()
})

function pad2(n) {
  return String(n).padStart(2, '0')
}

const filters = computed(() => {
  void localeVersion.value
  return FILTER_KEYS.map((f) => ({ key: f.key, label: t(f.labelKey) }))
})

const pendingCount = computed(() => {
  void revision.value
  return todos.value.filter((x) => !x.completed).length
})
const doneCount = computed(() => {
  void revision.value
  return todos.value.filter((x) => x.completed).length
})

const subtitle = computed(() => {
  void localeVersion.value
  return t('todos.subtitle', { pending: pendingCount.value, done: doneCount.value })
})

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

function isOverdue(item) {
  if (!item || item.completed || !item.due_at) return false
  return Number(item.due_at) < Date.now()
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

function formatDayLabel(ts) {
  const start = dayStart(ts)
  const today = dayStart(Date.now())
  const yesterday = today - 86400000
  if (start === today) return t('todos.today')
  if (start === yesterday) return t('todos.yesterday')
  return formatDateShort(ts)
}

function formatClock(ts) {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function itemTime(item) {
  if (filterKey.value === 'done') return item.updated_at || item.created_at
  return item.created_at
}

/** Same-day: incomplete above completed; then newer first */
function compareTodos(a, b) {
  const dayA = dayStart(itemTime(a))
  const dayB = dayStart(itemTime(b))
  if (dayA !== dayB) return dayB - dayA
  const doneA = a.completed ? 1 : 0
  const doneB = b.completed ? 1 : 0
  if (doneA !== doneB) return doneA - doneB
  return itemTime(b) - itemTime(a)
}

const filteredTodos = computed(() => {
  void revision.value
  let list = todos.value
  if (filterKey.value === 'pending') list = list.filter((x) => !x.completed)
  if (filterKey.value === 'done') list = list.filter((x) => x.completed)
  return [...list].sort(compareTodos)
})

const groupedTodos = computed(() => {
  void localeVersion.value
  const map = new Map()
  for (const item of filteredTodos.value) {
    const ts = itemTime(item)
    const key = String(dayStart(ts))
    if (!map.has(key)) {
      map.set(key, { key, label: formatDayLabel(ts), sort: dayStart(ts), items: [] })
    }
    map.get(key).items.push(item)
  }
  return [...map.values()].sort((a, b) => b.sort - a.sort)
})

const selected = computed(() => {
  void revision.value
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

function selectItem(item) {
  selectedId.value = item.id
  editTitle.value = item.title
  editDetail.value = item.detail || ''
  editDueDate.value = toDueDateStr(item.due_at)
  editDueTime.value = toDueTimeStr(item.due_at)
}

function openLinkedNote(noteId) {
  const id = String(noteId || '').trim()
  if (!id) return
  router.push({ name: 'notes', query: { id } })
}

function noteChipLabel(noteId) {
  void notesRevision.value
  void localeVersion.value
  const id = String(noteId || '').trim()
  if (!id) return t('notes.title')
  const n = notes.value.find((item) => item.id === id)
  const title = String(n?.title || '').trim()
  if (title) return title
  return t('notes.linkChip')
}

function toastCommit(commit) {
  if (commit && !commit.ok && commit.error) {
    toast(commit.error.message || t('common.requestFailed'))
  }
}

async function onAdd() {
  const title = inputTitle.value.trim()
  if (!title) {
    toast(t('todos.needTitle'))
    return
  }
  const { item, commit } = await addTodo(title)
  inputTitle.value = ''
  selectItem(item)
  toastCommit(commit)
}

async function toggle(item) {
  const res = await patchTodo(item.id, { completed: !item.completed, updated_at: nowTs() })
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

function filterCount(key) {
  void revision.value
  if (key === 'all') return todos.value.length
  if (key === 'pending') return pendingCount.value
  return doneCount.value
}
</script>

<template>
  <div class="tasks-layout">
    <section class="tasks-main panel">
      <p class="page-sub">{{ subtitle }}</p>

      <form class="composer" @submit.prevent="onAdd">
        <input v-model="inputTitle" :placeholder="t('todos.placeholder')" />
        <button class="btn btn-primary btn-compact" type="submit">{{ t('todos.add') }}</button>
      </form>

      <div class="filter-row">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="chip"
          :class="{ active: filterKey === f.key }"
          @click="filterKey = f.key"
        >
          {{ f.label }}
          <span>{{ filterCount(f.key) }}</span>
        </button>
      </div>

      <div v-if="!groupedTodos.length" class="empty">
        <strong>{{
          todos.length ? t('todos.filterEmptyTitle') : t('todos.emptyTitle')
        }}</strong>
        {{ todos.length ? t('todos.filterEmptySub') : t('todos.emptySub') }}
      </div>

      <div v-else class="todo-groups">
        <div v-for="group in groupedTodos" :key="group.key" class="todo-group">
          <div class="group-label">{{ group.label }}</div>
          <button
            v-for="item in group.items"
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
              <span class="todo-title">
                <template v-for="(seg, si) in splitNoteLinkSegments(item.title)" :key="'t' + si">
                  <a
                    v-if="seg.type === 'note'"
                    class="note-link"
                    href="#"
                    :title="seg.text"
                    @click.stop.prevent="openLinkedNote(seg.id)"
                  >{{ noteChipLabel(seg.id) }}</a>
                  <span v-else>{{ seg.text }}</span>
                </template>
              </span>
              <span v-if="item.detail" class="todo-detail">
                <template v-for="(seg, si) in splitNoteLinkSegments(item.detail)" :key="'d' + si">
                  <a
                    v-if="seg.type === 'note'"
                    class="note-link"
                    href="#"
                    :title="seg.text"
                    @click.stop.prevent="openLinkedNote(seg.id)"
                  >{{ noteChipLabel(seg.id) }}</a>
                  <span v-else>{{ seg.text }}</span>
                </template>
              </span>
              <span class="todo-meta">
                <span class="todo-time">{{ formatClock(itemTime(item)) }}</span>
                <span v-if="item.due_at" class="todo-due" :class="{ overdue: isOverdue(item) }">
                  {{ formatDueLabel(item.due_at) }}
                </span>
              </span>
            </span>
          </button>
        </div>
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
        <strong>{{ t('todos.title') }}</strong>
        {{ t('todos.emptySub') }}
      </div>
    </aside>
  </div>
</template>
