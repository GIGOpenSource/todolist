<script setup>
/**
 * 笔记富文本编辑器：基于 uni-app 内置 editor。
 */
import { ref, getCurrentInstance } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const formats = ref({})
const ready = ref(false)
let ctx = null

function queryEditor() {
  const inst = getCurrentInstance()
  const q = uni.createSelectorQuery()
  if (inst?.proxy) q.in(inst.proxy)
  return q
}

function applyHtml(html) {
  if (!ctx) return
  const value = String(html || '')
  ctx.setContents({
    html: value,
  })
}

function onReady() {
  queryEditor()
    .select('#noteEditor')
    .context((res) => {
      ctx = res && res.context
      if (!ctx) return
      ready.value = true
      applyHtml(props.modelValue)
    })
    .exec()
}

function onInput(e) {
  const html = (e && e.detail && e.detail.html) || ''
  emit('update:modelValue', html)
}

function onStatusChange(e) {
  formats.value = (e && e.detail) || {}
}

function apply(name, value) {
  if (!ctx) return
  if (value === undefined) ctx.format(name)
  else ctx.format(name, value)
}

let lastFormatAt = 0
function onFormat(e, name, value) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault()
  const now = Date.now()
  if (now - lastFormatAt < 80) return
  lastFormatAt = now
  apply(name, value)
}
</script>

<template>
  <view class="note-editor">
    <view class="toolbar">
      <view
        class="fmt"
        :class="{ on: formats.bold }"
        @touchend.prevent.stop="onFormat($event, 'bold')"
        @mousedown.prevent="onFormat($event, 'bold')"
      >
        <text class="b">B</text>
      </view>
      <view
        class="fmt"
        :class="{ on: formats.italic }"
        @touchend.prevent.stop="onFormat($event, 'italic')"
        @mousedown.prevent="onFormat($event, 'italic')"
      >
        <text class="i">I</text>
      </view>
      <view
        class="fmt"
        :class="{ on: formats.underline }"
        @touchend.prevent.stop="onFormat($event, 'underline')"
        @mousedown.prevent="onFormat($event, 'underline')"
      >
        <text class="u">U</text>
      </view>
      <view
        class="fmt"
        :class="{ on: formats.strike }"
        @touchend.prevent.stop="onFormat($event, 'strike')"
        @mousedown.prevent="onFormat($event, 'strike')"
      >
        <text class="s">S</text>
      </view>
      <view class="divider" />
      <view
        class="fmt"
        :class="{ on: formats.list === 'ordered' }"
        @touchend.prevent.stop="onFormat($event, 'list', 'ordered')"
        @mousedown.prevent="onFormat($event, 'list', 'ordered')"
      >
        <text>1.</text>
      </view>
      <view
        class="fmt"
        :class="{ on: formats.list === 'bullet' }"
        @touchend.prevent.stop="onFormat($event, 'list', 'bullet')"
        @mousedown.prevent="onFormat($event, 'list', 'bullet')"
      >
        <text>•</text>
      </view>
    </view>
    <editor
      id="noteEditor"
      class="canvas"
      :placeholder="placeholder"
      @ready="onReady"
      @input="onInput"
      @statuschange="onStatusChange"
    />
  </view>
</template>

<style scoped>
.note-editor {
  margin-bottom: 24rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 12rpx;
  border-bottom: 0.5px solid var(--app-separator);
}

.fmt {
  min-width: 56rpx;
  height: 56rpx;
  padding: 0 10rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fmt.on {
  background: var(--app-tint-soft);
}

.fmt text {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--app-label);
}

.fmt.on text {
  color: var(--app-tint);
}

.fmt .i {
  font-style: italic;
  font-weight: 600;
}

.fmt .u {
  text-decoration: underline;
}

.fmt .s {
  text-decoration: line-through;
  font-weight: 600;
}

.divider {
  width: 1rpx;
  height: 28rpx;
  margin: 0 6rpx;
  background: var(--app-separator);
}

.canvas {
  min-height: 320rpx;
  height: 360rpx;
  padding: 16rpx 20rpx;
  box-sizing: border-box;
  width: 100%;
}

:deep(.ql-editor) {
  min-height: 280rpx;
  font-size: 30rpx;
  line-height: 1.55;
  color: var(--app-label);
}

:deep(.ql-editor.ql-blank::before) {
  color: var(--app-tertiary, #8e8e93);
  font-style: normal;
}
</style>
