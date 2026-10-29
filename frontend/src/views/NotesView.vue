<script setup>
/**
 * 桌面端笔记页：列表 + 一体编辑器（可直接新建），布局对齐任务页。
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  notes,
  ensureNoteCache,
  removeNoteById,
  addNote,
  patchNote,
  revision,
} from '../stores/notes.js'
import { buildNoteLink, buildNoteWebUrl, extractNoteId } from '../utils/noteLinks.js'
import { htmlToPlainPreview } from '../utils/noteHtml.js'
import { t, localeVersion, formatDateShort } from '../i18n/index.js'
import { toast } from '../utils/toast.js'
import NoteRichEditor from '../components/NoteRichEditor.vue'

const route = useRoute()
const router = useRouter()
const selectedId = ref('')
const drafting = ref(false)
const editTitle = ref('')
const editContent = ref('')
const saving = ref(false)
const focusTitle = ref(false)
const baselineTitle = ref('')
const baselineContent = ref('')

const sortedNotes = computed(() => {
  void revision.value
  return [...notes.value].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
})

const selected = computed(() => {
  void revision.value
  if (drafting.value || !selectedId.value) return null
  return notes.value.find((n) => n.id === selectedId.value) || null
})

const showEditor = computed(() => drafting.value || !!selected.value)

const editorKey = computed(() => (drafting.value ? 'draft' : selectedId.value || ''))

const subtitle = computed(() => {
  void localeVersion.value
  void revision.value
  return t('notes.subtitle', { n: sortedNotes.value.length })
})

const isDirty = computed(() => {
  if (!showEditor.value) return false
  return (
    editTitle.value !== baselineTitle.value ||
    editContent.value !== baselineContent.value
  )
})

const canSave = computed(() => {
  if (saving.value) return false
  if (!isDirty.value) return false
  if (drafting.value) return !!(editTitle.value.trim() || htmlToPlainPreview(editContent.value))
  return !!editTitle.value.trim()
})

function setBaseline(title, content) {
  baselineTitle.value = title || ''
  baselineContent.value = content || ''
}

function loadIntoEditor(title, content, { autofocus = false } = {}) {
  editTitle.value = title || ''
  editContent.value = content || ''
  setBaseline(editTitle.value, editContent.value)
  focusTitle.value = autofocus
}

function preview(n) {
  const body = htmlToPlainPreview(n.content || '')
  if (!body) return ''
  return body.length > 80 ? `${body.slice(0, 80)}…` : body
}

function selectNote(n) {
  drafting.value = false
  selectedId.value = n.id
  loadIntoEditor(n.title, n.content)
  if (route.query.id !== n.id) {
    router.replace({ name: 'notes', query: { id: n.id } }).catch(() => {})
  }
}

function startCreate() {
  drafting.value = true
  selectedId.value = ''
  loadIntoEditor('', '', { autofocus: true })
  router.replace({ name: 'notes' }).catch(() => {})
  nextTick(() => {
    focusTitle.value = true
  })
}

function openNoteById(id) {
  const noteId = String(id || '').trim()
  if (!noteId) return false
  ensureNoteCache()
  const n = notes.value.find((item) => item.id === noteId)
  if (!n) {
    toast(t('notes.noteNotFound'))
    return false
  }
  selectNote(n)
  return true
}

function syncFromRoute() {
  const id = extractNoteId(String(route.query.id || '')) || String(route.query.id || '').trim()
  if (id) {
    openNoteById(id)
    return
  }
  if (drafting.value) return
  if (!selectedId.value && sortedNotes.value.length) {
    selectNote(sortedNotes.value[0])
  }
}

onMounted(() => {
  ensureNoteCache()
  if (!route.query.id && !sortedNotes.value.length) {
    startCreate()
    return
  }
  syncFromRoute()
})

watch(
  () => route.query.id,
  () => {
    if (!route.query.id && drafting.value) return
    syncFromRoute()
  },
)

watch(selected, (n) => {
  if (drafting.value) return
  if (!n) {
    if (!drafting.value) loadIntoEditor('', '')
    return
  }
  if (n.id === selectedId.value) {
    // 外部同步刷新时，未脏则跟上最新内容
    if (!isDirty.value) loadIntoEditor(n.title, n.content)
  }
})

async function onSave() {
  if (!canSave.value) return
  const title = editTitle.value.trim() || t('notes.untitled')
  const content = editContent.value || ''
  saving.value = true
  try {
    if (drafting.value) {
      const res = await addNote(title, content)
      if (res?.commit && !res.commit.ok) {
        toast(res.commit.error?.message || t('notes.syncFailed'))
      } else {
        toast(t('notes.saved'))
      }
      if (res?.item) {
        drafting.value = false
        selectedId.value = res.item.id
        loadIntoEditor(res.item.title, res.item.content)
        router.replace({ name: 'notes', query: { id: res.item.id } }).catch(() => {})
      }
      return
    }
    if (!selected.value) return
    if (!editTitle.value.trim()) {
      toast(t('notes.needTitle'))
      return
    }
    const res = await patchNote(selected.value.id, { title, content })
    if (res?.commit && !res.commit.ok) toast(res.commit.error?.message || t('notes.syncFailed'))
    else {
      toast(t('notes.saved'))
      setBaseline(title, content)
    }
  } finally {
    saving.value = false
  }
}

function cancelDraft() {
  drafting.value = false
  loadIntoEditor('', '')
  if (sortedNotes.value.length) selectNote(sortedNotes.value[0])
}

async function onDeleteNote(n) {
  if (!n?.id) return
  if (!window.confirm(t('notes.deleteContent'))) return
  const id = n.id
  const wasSelected = selectedId.value === id
  await removeNoteById(id)
  if (!wasSelected && !drafting.value) return
  const next = sortedNotes.value[0]
  if (next) selectNote(next)
  else {
    selectedId.value = ''
    startCreate()
  }
}

async function onCopyLink() {
  if (!selected.value) return
  const shortLink = buildNoteLink(selected.value.id)
  const webUrl = buildNoteWebUrl(selected.value.id)
  const text = shortLink || webUrl
  try {
    await navigator.clipboard.writeText(text)
    toast(t('notes.linkCopied'))
  } catch {
    toast(t('notes.linkCopyFailed'))
  }
}
</script>

<template>
  <div class="tasks-layout notes-layout">
    <section class="tasks-main panel">
      <div class="notes-list-head">
        <p class="page-sub">{{ subtitle }}</p>
        <button type="button" class="btn btn-primary btn-compact" @click="startCreate">
          {{ t('notes.new') }}
        </button>
      </div>

      <div v-if="!sortedNotes.length" class="empty">
        <strong>{{ t('notes.emptyTitle') }}</strong>
        {{ t('notes.emptySub') }}
      </div>

      <div v-else class="note-list">
        <div
          v-for="n in sortedNotes"
          :key="n.id"
          class="note-row"
          :class="{ selected: !drafting && n.id === selectedId }"
        >
          <button type="button" class="note-row-main" @click="selectNote(n)">
            <span class="note-body">
              <span class="note-title">{{ n.title }}</span>
              <span v-if="preview(n)" class="note-detail">{{ preview(n) }}</span>
              <span class="note-meta">
                <span class="note-time">{{ formatDateShort(n.updated_at) }}</span>
              </span>
            </span>
          </button>
          <button
            v-if="!drafting && n.id === selectedId"
            type="button"
            class="btn btn-danger btn-compact note-row-delete"
            :aria-label="t('common.delete')"
            @click.stop="onDeleteNote(n)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </section>

    <aside class="tasks-detail panel notes-detail">
      <template v-if="showEditor">
        <NoteRichEditor
          v-model:title="editTitle"
          v-model:content="editContent"
          :editor-key="editorKey"
          :autofocus-title="focusTitle && drafting"
        />
        <div class="detail-actions">
          <button
            v-if="drafting"
            type="button"
            class="btn btn-secondary btn-compact"
            @click="cancelDraft"
          >
            {{ t('common.cancel') }}
          </button>
          <div class="detail-actions-end">
            <button
              v-if="!drafting"
              type="button"
              class="btn btn-secondary btn-compact"
              @click="onCopyLink"
            >
              {{ t('notes.copyLink') }}
            </button>
            <button
              type="button"
              class="btn btn-primary btn-compact"
              :disabled="!canSave"
              @click="onSave"
            >
              {{ saving ? t('notes.syncing') : t('common.save') }}
            </button>
          </div>
        </div>
      </template>
      <div v-else class="empty">
        <strong>{{ t('notes.title') }}</strong>
        {{ t('notes.emptySub') }}
        <button type="button" class="btn btn-primary btn-compact empty-cta" @click="startCreate">
          {{ t('notes.new') }}
        </button>
      </div>
    </aside>
  </div>
</template>
