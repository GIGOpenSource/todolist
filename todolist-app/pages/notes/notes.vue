<script setup>
/**
 * 笔记（记事本）页：列表 + 编辑弹层，本地优先，随 autoSync 上云。
 */
import { ref, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import GlassTabBar from '../../components/GlassTabBar.vue'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import NoteEditor from '../../components/NoteEditor.vue'
import { resyncScrollEdges, onScrollViewEdge } from '../../utils/scrollEdgeBlur.js'
import {
  getToken,
  getUsername,
  nowTs,
  genNoteId,
  consumePendingNoteId,
} from '../../utils/storage.js'
import {
  notes,
  ensureNoteCache,
  persistNotes,
  removeNoteById,
  revision,
} from '../../utils/noteStore.js'
import { buildNoteLink } from '../../utils/noteLinks.js'
import { runManualSync } from '../../utils/autoSync.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion, formatDateShort } from '../../utils/i18n.js'

const syncing = ref(false)
const pendingOpenId = ref('')
const pageThemeClass = computed(() => themeClass())

const editVisible = ref(false)
const editId = ref('')
const editTitle = ref('')
const editContent = ref('')

function onListScroll(e) {
  onScrollViewEdge(e)
}

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('notes.title'),
    subtitle: t('notes.subtitle', { n: notes.value.length }),
    add: t('notes.new'),
    sync: t('notes.sync'),
    syncing: t('notes.syncing'),
    emptyTitle: t('notes.emptyTitle'),
    emptySub: t('notes.emptySub'),
    createTitle: t('notes.new'),
    editTitle: t('notes.editTitle'),
    fieldTitle: t('notes.fieldTitle'),
    fieldContent: t('notes.fieldContent'),
    titlePh: t('notes.titlePh'),
    contentPh: t('notes.contentPh'),
    needTitle: t('notes.needTitle'),
    saved: t('notes.saved'),
    deleteTitle: t('notes.deleteTitle'),
    deleteContent: t('notes.deleteContent'),
    syncSuccess: t('notes.syncSuccess'),
    syncFailed: t('notes.syncFailed'),
    copyLink: t('notes.copyLink'),
    linkCopied: t('notes.linkCopied'),
    linkCopyFailed: t('notes.linkCopyFailed'),
    noteNotFound: t('notes.noteNotFound'),
    cancel: t('common.cancel'),
    save: t('common.save'),
    delete: t('common.delete'),
    edit: t('common.edit'),
  }
})

const isCreating = computed(() => !editId.value)
const sheetTitle = computed(() => (isCreating.value ? i18n.value.createTitle : i18n.value.editTitle))

const sortedNotes = computed(() => {
  void revision.value
  return [...notes.value].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
})

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function previewText(n) {
  const body = stripHtml(n.content)
  if (!body) return ''
  return body.length > 36 ? `${body.slice(0, 36)}…` : body
}

function formatUpdated(ts) {
  if (!ts) return ''
  return formatDateShort(ts)
}

function ensureAuth() {
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return false
  }
  return true
}

function openCreate() {
  if (!ensureAuth()) return
  editId.value = ''
  editTitle.value = ''
  editContent.value = ''
  editVisible.value = true
}

function openEdit(n) {
  editId.value = n.id
  editTitle.value = n.title || ''
  editContent.value = n.content || ''
  editVisible.value = true
}

function openNoteById(id) {
  const noteId = String(id || '').trim()
  if (!noteId) return false
  ensureNoteCache()
  const n = notes.value.find((item) => item.id === noteId)
  if (!n) {
    uni.showToast({ title: i18n.value.noteNotFound, icon: 'none' })
    return false
  }
  openEdit(n)
  return true
}

function tryOpenPendingNote() {
  const id = pendingOpenId.value || consumePendingNoteId()
  pendingOpenId.value = ''
  if (id) openNoteById(id)
}

function copyNoteLinkById(id) {
  const link = buildNoteLink(id)
  if (!link) return
  uni.setClipboardData({
    data: link,
    success: () => uni.showToast({ title: i18n.value.linkCopied, icon: 'success' }),
    fail: () => uni.showToast({ title: i18n.value.linkCopyFailed, icon: 'none' }),
  })
}

function copyNoteLink() {
  copyNoteLinkById(editId.value)
}

function closeEdit() {
  editVisible.value = false
}

function saveEdit() {
  const title = editTitle.value.trim()
  if (!title) {
    uni.showToast({ title: i18n.value.needTitle, icon: 'none' })
    return
  }
  ensureNoteCache()
  const ts = nowTs()
  if (!editId.value) {
    notes.value.push({
      id: genNoteId(),
      title,
      content: editContent.value || '',
      created_at: ts,
      updated_at: ts,
    })
  } else {
    const idx = notes.value.findIndex((n) => n.id === editId.value)
    if (idx < 0) {
      closeEdit()
      return
    }
    notes.value[idx] = {
      ...notes.value[idx],
      title,
      content: editContent.value || '',
      updated_at: ts,
    }
  }
  persistNotes(true)
  closeEdit()
  uni.showToast({ title: i18n.value.saved, icon: 'success' })
}

function confirmDeleteNote(id) {
  uni.showModal({
    title: i18n.value.deleteTitle,
    content: i18n.value.deleteContent,
    success: (res) => {
      if (!res.confirm) return
      removeNoteById(id)
      if (editId.value === id) closeEdit()
    },
  })
}

function confirmDelete() {
  if (!editId.value) {
    closeEdit()
    return
  }
  confirmDeleteNote(editId.value)
}

function openMore(n) {
  uni.showActionSheet({
    itemList: [i18n.value.edit, i18n.value.copyLink, i18n.value.delete],
    success: (res) => {
      if (res.tapIndex === 0) openEdit(n)
      if (res.tapIndex === 1) copyNoteLinkById(n.id)
      if (res.tapIndex === 2) confirmDeleteNote(n.id)
    },
  })
}

async function onSync() {
  if (syncing.value) return
  if (!ensureAuth()) return
  syncing.value = true
  try {
    const res = await runManualSync()
    if (res?.ok) {
      uni.showToast({ title: i18n.value.syncSuccess, icon: 'success' })
    } else {
      uni.showToast({ title: i18n.value.syncFailed, icon: 'none' })
    }
  } catch {
    uni.showToast({ title: i18n.value.syncFailed, icon: 'none' })
  } finally {
    syncing.value = false
  }
}

onLoad((query) => {
  const id = String(query?.id || '').trim()
  if (id) pendingOpenId.value = id
})

onShow(() => {
  syncPageChrome()
  if (!ensureAuth()) return
  ensureNoteCache()
  tryOpenPendingNote()
  resyncScrollEdges()
})
</script>

<template>
  <view class="page ios-page notes-page" :class="pageThemeClass">
    <CollapsingNavBar :title="i18n.title" :progress="0" />

    <view class="content ios-content has-collapse-nav notes-content">
      <view class="large-title-wrap">
        <text class="large-title">{{ i18n.title }}</text>
        <text class="subtitle">{{ i18n.subtitle }}</text>
      </view>

      <scroll-view
        class="list-scroll"
        scroll-y
        :show-scrollbar="false"
        @scroll="onListScroll"
      >
        <view v-if="!sortedNotes.length" class="empty">
          <text class="empty-title">{{ i18n.emptyTitle }}</text>
          <text class="empty-sub">{{ i18n.emptySub }}</text>
        </view>

        <view v-else class="group list">
          <view
            v-for="(n, idx) in sortedNotes"
            :key="n.id"
            class="row"
            :class="{ last: idx === sortedNotes.length - 1 }"
            @click="openEdit(n)"
          >
            <view class="body">
              <text class="card-title">{{ n.title }}</text>
              <text v-if="previewText(n)" class="card-preview">{{ previewText(n) }}</text>
              <text class="card-meta">{{ formatUpdated(n.updated_at) }}</text>
            </view>
            <view class="more" @click.stop="openMore(n)">
              <text class="more-dots">···</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="create-bar">
        <view class="create-btn" @click="openCreate">
          <text>{{ i18n.add }}</text>
        </view>
      </view>
    </view>

    <view v-if="editVisible" class="sheet-mask" @click="closeEdit">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ sheetTitle }}</text>
        <text class="field-label">{{ i18n.fieldTitle }}</text>
        <input class="sheet-input" v-model="editTitle" :placeholder="i18n.titlePh" maxlength="200" />
        <text class="field-label">{{ i18n.fieldContent }}</text>
        <NoteEditor
          :key="editId || 'new'"
          v-model="editContent"
          :placeholder="i18n.contentPh"
        />
        <view class="sheet-actions">
          <view v-if="!isCreating" class="sheet-btn danger" @click="confirmDelete">
            <text>{{ i18n.delete }}</text>
          </view>
          <view v-if="!isCreating" class="sheet-btn ghost" @click="copyNoteLink">
            <text>{{ i18n.copyLink }}</text>
          </view>
          <view class="sheet-btn ghost" @click="closeEdit">
            <text>{{ i18n.cancel }}</text>
          </view>
          <view class="sheet-btn primary" @click="saveEdit">
            <text>{{ i18n.save }}</text>
          </view>
        </view>
      </view>
    </view>

    <GlassTabBar />
  </view>
</template>

<style scoped lang="scss">
.notes-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.notes-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.nav-btn {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: var(--app-tint-soft);
}

.nav-btn.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.nav-btn text {
  font-size: 24rpx;
  color: var(--app-tint);
  font-weight: 600;
}

.list-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.large-title-wrap {
  flex-shrink: 0;
  padding: 0 8rpx 20rpx;
}

.large-title {
  display: block;
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
  line-height: 1.15;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.4;
}

.empty {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  box-sizing: border-box;
}

.empty-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--app-secondary);
}

.empty-sub {
  font-size: 26rpx;
  color: var(--app-tertiary);
  text-align: center;
}

.list {
  overflow: hidden;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 28rpx 24rpx 28rpx 32rpx;
  border-bottom: 0.5px solid var(--app-separator);
  box-sizing: border-box;
}

.row.last {
  border-bottom: none;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--app-label);
  letter-spacing: -0.3px;
  line-height: 1.3;
}

.card-preview {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--app-secondary);
  line-height: 1.4;
}

.card-meta {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--app-tertiary);
}

.more {
  width: 56rpx;
  height: 44rpx;
  margin-top: 2rpx;
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

.create-bar {
  flex-shrink: 0;
  padding: 20rpx 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.create-btn {
  width: 500rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: var(--app-tint);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 28rpx var(--app-tint-glow, rgba(0, 122, 255, 0.28));
}

.create-btn:active {
  opacity: 0.88;
  transform: scale(0.985);
}

.create-btn text {
  color: var(--app-on-tint);
  font-size: 32rpx;
  font-weight: 650;
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

.sheet .note-editor {
  flex: 1;
  min-height: 280rpx;
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


.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.sheet-btn {
  flex: 1 1 calc(50% - 16rpx);
  min-width: 140rpx;
  height: var(--app-btn-height-sheet);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-btn text {
  font-size: 28rpx;
  font-weight: 600;
}

.sheet-btn.ghost {
  background: var(--app-fill);
}

.sheet-btn.ghost text {
  color: var(--app-label);
}

.sheet-btn.primary {
  background: var(--app-tint);
}

.sheet-btn.primary text {
  color: var(--app-on-tint);
}

.sheet-btn.danger {
  background: rgba(255, 59, 48, 0.12);
}

.sheet-btn.danger text {
  color: #ff3b30;
}
</style>
