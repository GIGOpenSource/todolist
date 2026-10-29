<script setup>
/**
 * 待办主页：创建、编辑、完成并同步待办。
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
import {
  getToken,
  getUsername,
  nowTs,
  genId,
  setPendingNoteId,
} from '../../utils/storage.js'
import {
  todos,
  ensureTodoCache,
  persistTodos,
  removeTodoById,
} from '../../utils/todoStore.js'
import { splitNoteLinkSegments } from '../../utils/noteLinks.js'
import { runManualSync } from '../../utils/autoSync.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion, formatDateShort } from '../../utils/i18n.js'

const titleProgress = ref(0)
const syncing = ref(false)

function onListScroll(e) {
  onScrollViewEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
}

const FILTER_KEYS = [
  { key: 'all', labelKey: 'todos.filterAll' },
  { key: 'pending', labelKey: 'todos.filterPending' },
  { key: 'done', labelKey: 'todos.filterDone' },
]

const inputTitle = ref('')
const filterKey = ref('all')

const editVisible = ref(false)
const editId = ref('')
const editTitle = ref('')
const editDetail = ref('')
const editDueDate = ref('') // YYYY-MM-DD 或空
const editDueTime = ref('') // HH:mm 或空

const FILTERS = computed(() => {
  void localeVersion.value
  return FILTER_KEYS.map((f) => ({ key: f.key, label: t(f.labelKey) }))
})

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('todos.title'),
    subtitle: t('todos.subtitle', { pending: pendingCount.value, done: doneCount.value }),
    placeholder: t('todos.placeholder'),
    add: t('todos.add'),
    sync: t('todos.sync'),
    syncing: t('todos.syncing'),
    emptyTitle: t('todos.emptyTitle'),
    emptySub: t('todos.emptySub'),
    filterEmptyTitle: t('todos.filterEmptyTitle'),
    filterEmptySub: t('todos.filterEmptySub'),
    editTitle: t('todos.editTitle'),
    fieldTitle: t('todos.fieldTitle'),
    fieldDetail: t('todos.fieldDetail'),
    fieldDue: t('todos.fieldDue'),
    fieldDueTime: t('todos.fieldDueTime'),
    titlePh: t('todos.titlePh'),
    detailPh: t('todos.detailPh'),
    notSet: t('common.notSet'),
    clear: t('common.clear'),
    cancel: t('common.cancel'),
    save: t('common.save'),
  }
})

const pendingCount = computed(() => todos.value.filter((t) => !t.completed).length)
const doneCount = computed(() => todos.value.filter((t) => t.completed).length)
const totalCount = computed(() => todos.value.length)

const filterCount = computed(() => ({
  all: totalCount.value,
  pending: pendingCount.value,
  done: doneCount.value,
}))

function dayStart(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function pad2(n) {
  return String(n).padStart(2, '0')
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
  const tomorrow = today + 24 * 60 * 60 * 1000
  const yesterday = today - 24 * 60 * 60 * 1000
  const time = formatDueTime(ts)
  if (start === today) return t('todos.dueTodayAt', { time })
  if (start === tomorrow) return t('todos.dueTomorrowAt', { time })
  if (start === yesterday) return t('todos.dueYesterdayAt', { time })
  return t('todos.dueOnAt', { date: formatDateShort(ts), time })
}

function formatDayLabel(ts) {
  const start = dayStart(ts)
  const today = dayStart(Date.now())
  const yesterday = today - 24 * 60 * 60 * 1000
  if (start === today) return t('todos.today')
  if (start === yesterday) return t('todos.yesterday')
  return formatDateShort(ts)
}

function formatClock(ts) {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
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
  let list = todos.value
  if (filterKey.value === 'pending') list = list.filter((t) => !t.completed)
  if (filterKey.value === 'done') list = list.filter((t) => t.completed)
  return [...list].sort(compareTodos)
})

const groupedTodos = computed(() => {
  void localeVersion.value
  const map = new Map()
  for (const item of filteredTodos.value) {
    const ts = itemTime(item)
    const key = String(dayStart(ts))
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: formatDayLabel(ts),
        sort: dayStart(ts),
        items: [],
      })
    }
    map.get(key).items.push(item)
  }
  return [...map.values()].sort((a, b) => b.sort - a.sort)
})

function loadLocalOnce() {
  ensureTodoCache()
}

function persist(bumpTs = true) {
  persistTodos(bumpTs)
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  // 仅首次（或换账号）从本地磁盘灌入内存，不在每次打开时重新加载
  loadLocalOnce()
})

function setFilter(key) {
  filterKey.value = key
}

function addTodo() {
  const title = inputTitle.value.trim()
  if (!title) {
    uni.showToast({ title: t('todos.needTitle'), icon: 'none' })
    return
  }
  const ts = nowTs()
  const id = genId()
  todos.value.unshift({
    id,
    title,
    detail: '',
    due_at: 0,
    completed: false,
    created_at: ts,
    updated_at: ts,
  })
  inputTitle.value = ''
  persist(true)
  if (filterKey.value === 'done') filterKey.value = 'all'
}

function toggleTodo(item) {
  item.completed = !item.completed
  item.updated_at = nowTs()
  persist(true)
}

function openMore(item) {
  uni.showActionSheet({
    itemList: [t('common.edit'), t('common.delete')],
    success: (res) => {
      if (res.tapIndex === 0) openEdit(item)
      if (res.tapIndex === 1) removeTodo(item.id)
    },
  })
}

function openLinkedNote(noteId) {
  const id = String(noteId || '').trim()
  if (!id) return
  setPendingNoteId(id)
  uni.switchTab({
    url: '/pages/notes/notes',
    fail: () => {
      uni.navigateTo({ url: `/pages/notes/notes?id=${encodeURIComponent(id)}` })
    },
  })
}

function openEdit(item) {
  editId.value = item.id
  editTitle.value = item.title || ''
  editDetail.value = item.detail || ''
  editDueDate.value = toDueDateStr(item.due_at)
  editDueTime.value = toDueTimeStr(item.due_at)
  editVisible.value = true
}

const duePickerBusy = ref(false)
const pageThemeClass = computed(() => themeClass())
let duePickerTimer = null

function markDuePickerBusy(holdMs = 8000) {
  duePickerBusy.value = true
  if (duePickerTimer) clearTimeout(duePickerTimer)
  duePickerTimer = setTimeout(() => {
    duePickerBusy.value = false
    duePickerTimer = null
  }, holdMs)
}

function releaseDuePickerBusy() {
  if (duePickerTimer) clearTimeout(duePickerTimer)
  // 短暂保持，吞掉确认后穿透到遮罩的点击
  duePickerTimer = setTimeout(() => {
    duePickerBusy.value = false
    duePickerTimer = null
  }, 400)
}

function closeEdit() {
  if (duePickerBusy.value) return
  editVisible.value = false
}

function onMaskClose() {
  if (duePickerBusy.value) return
  closeEdit()
}

function onDuePickerTap() {
  markDuePickerBusy()
}

function onDueChange(e) {
  editDueDate.value = e.detail.value || ''
  if (editDueDate.value && !editDueTime.value) {
    const now = new Date()
    editDueTime.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  }
  if (!editDueDate.value) editDueTime.value = ''
  releaseDuePickerBusy()
}

function onDueTimeChange(e) {
  editDueTime.value = e.detail.value || ''
  if (editDueTime.value && !editDueDate.value) {
    editDueDate.value = toDueDateStr(Date.now())
  }
  releaseDuePickerBusy()
}

function onDueCancel() {
  releaseDuePickerBusy()
}

function clearDue() {
  editDueDate.value = ''
  editDueTime.value = ''
}

function saveEdit() {
  const title = editTitle.value.trim()
  if (!title) {
    uni.showToast({ title: t('todos.titleRequired'), icon: 'none' })
    return
  }
  const target = todos.value.find((t) => t.id === editId.value)
  if (!target) {
    closeEdit()
    return
  }
  target.title = title
  target.detail = (editDetail.value || '').trim()
  target.due_at = parseDueDateTime(editDueDate.value, editDueTime.value)
  target.updated_at = nowTs()
  persist(true)
  closeEdit()
  uni.showToast({ title: t('todos.saved'), icon: 'success' })
}

function removeTodo(id) {
  uni.showModal({
    title: t('todos.deleteTitle'),
    content: t('todos.deleteContent'),
    success: (res) => {
      if (!res.confirm) return
      removeTodoById(id)
    },
  })
}

async function onManualSync() {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await runManualSync()
    if (res.ok) {
      uni.showToast({ title: t('todos.syncSuccess'), icon: 'success' })
    } else if (res.reason === 'busy') {
      uni.showToast({ title: t('todos.syncing'), icon: 'none' })
    } else {
      uni.showToast({
        title: (res.error && res.error.message) || t('todos.syncFailed'),
        icon: 'none',
      })
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || t('todos.syncFailed'), icon: 'none' })
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <view class="page ios-page todos-page" :class="pageThemeClass">
    <CollapsingNavBar :title="i18n.title" :progress="titleProgress" />
    <view class="content ios-content has-collapse-nav todos-content">
      <scroll-view
        scroll-y
        class="list-scroll"
        :show-scrollbar="false"
        @scroll="onListScroll"
      >
        <view class="large-title-wrap">
          <view class="title-row">
            <text class="large-title">{{ i18n.title }}</text>
            <view class="gen-btn" :class="{ disabled: syncing }" @click="onManualSync">
              <text>{{ syncing ? i18n.syncing : i18n.sync }}</text>
            </view>
          </view>
          <text class="subtitle">{{ i18n.subtitle }}</text>
        </view>

        <view class="sticky-tools">
          <view class="composer glass">
            <input
              class="composer-input"
              v-model="inputTitle"
              :placeholder="i18n.placeholder"
              placeholder-class="ph"
              confirm-type="done"
              @confirm="addTodo"
            />
            <view class="glass-btn" @click="addTodo">
              <text class="glass-btn-text">{{ i18n.add }}</text>
            </view>
          </view>

          <view class="segment glass">
            <view
              v-for="f in FILTERS"
              :key="f.key"
              class="seg-item"
              :class="{ active: filterKey === f.key }"
              @click="setFilter(f.key)"
            >
              <text class="seg-text">{{ f.label }}</text>
              <text class="seg-count">{{ filterCount[f.key] }}</text>
            </view>
          </view>
        </view>

        <view v-if="todos.length === 0" class="empty">
          <text class="empty-title">{{ i18n.emptyTitle }}</text>
          <text class="empty-sub">{{ i18n.emptySub }}</text>
        </view>

        <view v-else-if="groupedTodos.length === 0" class="empty">
          <text class="empty-title">{{ i18n.filterEmptyTitle }}</text>
          <text class="empty-sub">{{ i18n.filterEmptySub }}</text>
        </view>

        <view v-else class="timeline">
          <view v-for="group in groupedTodos" :key="group.key" class="day-block">
            <text class="day-label">{{ group.label }}</text>
            <view class="group">
              <view
                v-for="(item, idx) in group.items"
                :key="item.id"
                class="row"
                :class="{
                  last: idx === group.items.length - 1,
                  done: item.completed,
                  overdue: isOverdue(item),
                }"
              >
                <view class="check" @click.stop="toggleTodo(item)">
                  <view class="check-inner" :class="{ on: item.completed }">
                    <text v-if="item.completed" class="tick">✓</text>
                  </view>
                </view>
                <view class="body" @click="openEdit(item)">
                  <view class="title-line">
                    <text
                      v-for="(seg, si) in splitNoteLinkSegments(item.title)"
                      :key="'t' + si"
                      class="title"
                      :class="{ 'note-link': seg.type === 'note' }"
                      @click.stop="seg.type === 'note' ? openLinkedNote(seg.id) : openEdit(item)"
                    >{{ seg.text }}</text>
                  </view>
                  <view v-if="item.detail" class="detail-line">
                    <text
                      v-for="(seg, si) in splitNoteLinkSegments(item.detail)"
                      :key="'d' + si"
                      class="detail"
                      :class="{ 'note-link': seg.type === 'note' }"
                      @click.stop="seg.type === 'note' ? openLinkedNote(seg.id) : openEdit(item)"
                    >{{ seg.text }}</text>
                  </view>
                  <view class="meta-row">
                    <text class="time">{{ formatClock(itemTime(item)) }}</text>
                    <text v-if="item.due_at" class="due" :class="{ late: isOverdue(item) }">
                      {{ formatDueLabel(item.due_at) }}
                    </text>
                  </view>
                </view>
                <view class="more" @click.stop="openMore(item)">
                  <text class="more-dots">···</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="bottom-space"></view>
      </scroll-view>
    </view>
    <GlassTabBar />

    <view
      v-if="editVisible"
      class="sheet-mask"
      :class="{ 'picker-open': duePickerBusy }"
      @click="onMaskClose"
    >
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ i18n.editTitle }}</text>
        <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
          <text class="field-label">{{ i18n.fieldTitle }}</text>
          <input class="sheet-input" v-model="editTitle" maxlength="200" :placeholder="i18n.titlePh" />
          <text class="field-label">{{ i18n.fieldDetail }}</text>
          <textarea
            class="sheet-textarea"
            v-model="editDetail"
            maxlength="2000"
            :placeholder="i18n.detailPh"
            :auto-height="true"
          />
          <text class="field-label">{{ i18n.fieldDue }}</text>
          <view class="due-row">
            <picker
              class="due-picker-wrap"
              mode="date"
              :value="editDueDate || toDueDateStr(Date.now())"
              @click.stop="onDuePickerTap"
              @change="onDueChange"
              @cancel="onDueCancel"
            >
              <view class="due-picker">
                <text :class="editDueDate ? 'due-val' : 'due-ph'">
                  {{ editDueDate || i18n.notSet }}
                </text>
              </view>
            </picker>
            <picker
              class="due-picker-wrap"
              mode="time"
              :value="editDueTime || formatClock(Date.now())"
              @click.stop="onDuePickerTap"
              @change="onDueTimeChange"
              @cancel="onDueCancel"
            >
              <view class="due-picker">
                <text :class="editDueTime ? 'due-val' : 'due-ph'">
                  {{ editDueTime || i18n.fieldDueTime }}
                </text>
              </view>
            </picker>
            <view v-if="editDueDate || editDueTime" class="due-clear" @click.stop="clearDue">
              <text>{{ i18n.clear }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="sheet-actions">
          <view class="sheet-btn ghost" @click="closeEdit"><text>{{ i18n.cancel }}</text></view>
          <view class="sheet-btn primary" @click="saveEdit"><text>{{ i18n.save }}</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.content {
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: 0;
}

.todos-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.todos-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.list-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.large-title-wrap {
  padding: 0 8rpx 28rpx;
}

.sticky-tools {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 5;
  padding-bottom: 12rpx;
  margin-bottom: 4rpx;
  background: var(--app-bg);
  border: none;
  box-shadow: none;
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

.composer {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 10rpx 10rpx 28rpx;
  border-radius: var(--app-radius-pill);
  margin-bottom: 20rpx;
}

.composer-input {
  flex: 1;
  height: 72rpx;
  font-size: 30rpx;
  color: var(--app-label);
}

.ph {
  color: var(--app-tertiary);
}

.glass-btn {
  height: 68rpx;
  padding: 0 28rpx;
  border-radius: var(--app-radius-pill);
  background: var(--app-tint-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.glass-btn-text {
  color: var(--app-tint);
  font-size: 28rpx;
  font-weight: 600;
}

.segment {
  display: flex;
  padding: 6rpx;
  border-radius: var(--app-radius-pill);
  margin-bottom: 0;
}

.seg-item {
  flex: 1;
  height: 64rpx;
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.seg-item.active {
  background: var(--app-tint-soft);
}

.seg-text {
  font-size: 26rpx;
  color: var(--app-secondary);
  font-weight: 500;
}

.seg-item.active .seg-text {
  color: var(--app-tint);
  font-weight: 600;
}

.seg-count {
  font-size: 22rpx;
  color: var(--app-tertiary);
}

.seg-item.active .seg-count {
  color: var(--app-tint);
}

.empty {
  margin-top: 100rpx;
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--app-label);
}

.empty-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.day-label {
  display: block;
  margin: 0 8rpx 12rpx;
  font-size: 24rpx;
  font-weight: 650;
  color: var(--app-tertiary);
  letter-spacing: -0.2px;
}

.group {
  background: var(--app-fill-strong);
  border-radius: var(--app-radius-panel);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 20rpx 24rpx 28rpx;
  border-bottom: 0.5px solid var(--app-separator);
  box-sizing: border-box;
}

.row.last {
  border-bottom: none;
}

.row.done .title,
.row.done .detail {
  color: var(--app-tertiary);
  text-decoration: line-through;
}

.check {
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-inner {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2px solid var(--app-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.check-inner.on {
  background: var(--app-success);
  border-color: var(--app-success);
}

.tick {
  color: var(--app-on-tint);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 650;
  color: var(--app-label);
  letter-spacing: -0.3px;
  line-height: 44rpx;
}

.title-line,
.detail-line {
  display: block;
  word-break: break-word;
}

.note-link {
  color: var(--app-tint) !important;
  text-decoration: underline;
}

.detail {
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.35;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.time {
  font-size: 22rpx;
  color: var(--app-tertiary);
  line-height: 1.3;
}

.due {
  font-size: 22rpx;
  color: var(--app-tint);
  font-weight: 500;
  line-height: 1.3;
}

.due.late {
  color: var(--app-overdue);
}

.more {
  width: 56rpx;
  height: 44rpx;
  margin-top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.more-dots {
  font-size: 32rpx;
  letter-spacing: 1rpx;
  color: var(--app-tertiary);
  font-weight: 700;
  line-height: 1;
}

.bottom-space {
  height: 220rpx;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--app-scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-mask.picker-open {
  pointer-events: none;
}

.sheet-mask.picker-open .sheet {
  pointer-events: auto;
}

.sheet {
  width: min(100%, var(--app-sheet-max, 100%));
  max-height: 85vh;
  background: var(--app-fill-strong);
  backdrop-filter: blur(var(--app-glass-blur));
  -webkit-backdrop-filter: blur(var(--app-glass-blur));
  border-radius: var(--app-radius-panel) var(--app-radius-panel) 0 0;
  padding: 32rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.sheet-scroll {
  max-height: 58vh;
  margin-bottom: 8rpx;
}

.sheet-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--app-label);
  margin-bottom: 28rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  color: var(--app-secondary);
  margin-bottom: 10rpx;
}

.sheet-input {
  height: 80rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  font-size: 30rpx;
  color: var(--app-label);
}

.sheet-textarea {
  width: 100%;
  min-height: 180rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  font-size: 28rpx;
  color: var(--app-label);
  box-sizing: border-box;
}

.due-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 28rpx;
}

.due-picker-wrap {
  flex: 1;
  min-width: 0;
}

.due-picker {
  height: 80rpx;
  padding: 0 20rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  display: flex;
  align-items: center;
}

.due-val {
  font-size: 28rpx;
  color: var(--app-label);
}

.due-ph {
  font-size: 26rpx;
  color: var(--app-tertiary);
}

.due-clear {
  height: 80rpx;
  padding: 0 20rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  display: flex;
  align-items: center;
  color: var(--app-danger);
  font-size: 26rpx;
  font-weight: 500;
  flex-shrink: 0;
}

.sheet-actions {
  display: flex;
  gap: 16rpx;
}

.sheet-btn {
  flex: 1;
  height: var(--app-btn-height-sheet);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
}

.sheet-btn.ghost {
  background: var(--app-fill);
  color: var(--app-label);
}

.sheet-btn.primary {
  background: var(--app-tint);
  color: var(--app-on-tint);
}
</style>
