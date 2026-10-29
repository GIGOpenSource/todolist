<script setup>
/**
 * 笔记编辑器：标题 + 正文一体，横排样式/段落工具栏（contenteditable）。
 */
import { ref, watch, nextTick, onMounted } from 'vue'
import { t } from '../i18n/index.js'
import { contentToEditorHtml, htmlToPlainPreview } from '../utils/noteHtml.js'

const props = defineProps({
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  /** 切换笔记时重置编辑器 DOM */
  editorKey: { type: String, default: '' },
  autofocusTitle: { type: Boolean, default: false },
})

const emit = defineEmits(['update:title', 'update:content'])

const titleRef = ref(null)
const bodyRef = ref(null)
const lastKey = ref('')

function applyBodyFromProp() {
  const el = bodyRef.value
  if (!el) return
  const html = contentToEditorHtml(props.content)
  if (el.innerHTML !== html) el.innerHTML = html || ''
}

function emitBody() {
  const el = bodyRef.value
  if (!el) return
  const html = el.innerHTML
  const plain = htmlToPlainPreview(html)
  emit('update:content', plain ? html : '')
}

function onTitleInput(e) {
  emit('update:title', e.target.value)
}

function run(cmd, value = null) {
  bodyRef.value?.focus()
  try {
    document.execCommand(cmd, false, value)
  } catch {
    /* ignore */
  }
  emitBody()
}

function formatBlock(tag) {
  bodyRef.value?.focus()
  try {
    document.execCommand('formatBlock', false, tag)
  } catch {
    /* ignore */
  }
  emitBody()
}

function onToolbarMouseDown(e) {
  e.preventDefault()
}

watch(
  () => props.editorKey,
  async (key) => {
    if (key === lastKey.value) return
    lastKey.value = key
    await nextTick()
    applyBodyFromProp()
    if (props.autofocusTitle) {
      await nextTick()
      titleRef.value?.focus()
    }
  },
  { immediate: true },
)

watch(
  () => props.content,
  () => {
    if (!bodyRef.value) return
    if (document.activeElement === bodyRef.value) return
    applyBodyFromProp()
  },
)

onMounted(() => {
  applyBodyFromProp()
  if (props.autofocusTitle) titleRef.value?.focus()
})
</script>

<template>
  <div class="note-editor">
    <input
      ref="titleRef"
      class="note-editor-title"
      type="text"
      :value="title"
      :placeholder="t('notes.titlePh')"
      @input="onTitleInput"
    />

    <div
      class="note-fmt-toolbar"
      role="toolbar"
      :aria-label="t('notes.fmtToolbar')"
      @mousedown="onToolbarMouseDown"
    >
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtBold')" @click="run('bold')">
        <strong>B</strong>
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtItalic')" @click="run('italic')">
        <em>I</em>
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtUnderline')" @click="run('underline')">
        <span class="u">U</span>
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtStrike')" @click="run('strikeThrough')">
        <span class="s">S</span>
      </button>
      <span class="note-fmt-sep" />
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtH2')" @click="formatBlock('h2')">
        H
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtParagraph')" @click="formatBlock('p')">
        ¶
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtQuote')" @click="formatBlock('blockquote')">
        “”
      </button>
      <span class="note-fmt-sep" />
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtUl')" @click="run('insertUnorderedList')">
        •≡
      </button>
      <button type="button" class="note-fmt-btn" :title="t('notes.fmtOl')" @click="run('insertOrderedList')">
        1.
      </button>
    </div>

    <div
      ref="bodyRef"
      class="note-editor-body"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="t('notes.contentPh')"
      @input="emitBody"
      @blur="emitBody"
    />
  </div>
</template>
