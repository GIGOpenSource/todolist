<script setup>
import { computed, ref, watch } from 'vue'
import {
  LOCALES,
  getLocale,
  getLocaleMeta,
  setLocale,
  t,
  localeVersion,
} from '../utils/i18n.js'

defineProps({
  /** corner | inline */
  variant: {
    type: String,
    default: 'corner',
  },
})

const visible = ref(false)
const localeIndex = ref(0)

const i18n = computed(() => {
  void localeVersion.value
  return {
    language: t('profile.language'),
    cancel: t('common.cancel'),
    languageName: getLocaleMeta().name,
  }
})

function syncIndex() {
  const idx = LOCALES.findIndex((l) => l.code === getLocale())
  localeIndex.value = idx >= 0 ? idx : 0
}

watch(localeVersion, syncIndex, { immediate: true })

function open() {
  syncIndex()
  visible.value = true
}

function close() {
  visible.value = false
}

function select(idx) {
  if (!Number.isFinite(idx) || idx < 0 || idx >= LOCALES.length) return
  localeIndex.value = idx
  setLocale(LOCALES[idx].code)
  visible.value = false
  uni.showToast({ title: t('profile.languageChanged'), icon: 'none' })
}
</script>

<template>
  <view class="locale-picker" :class="variant">
    <view class="lang-trigger" @click="open">
      <text class="lang-label">{{ i18n.languageName }}</text>
      <text class="lang-caret">▼</text>
    </view>

    <view v-if="visible" class="sheet-mask" @click="close">
      <view class="sheet locale-sheet glass" @click.stop>
        <text class="sheet-title">{{ i18n.language }}</text>
        <scroll-view scroll-y class="locale-list" :show-scrollbar="false">
          <view
            v-for="(item, idx) in LOCALES"
            :key="item.code"
            class="locale-item"
            :class="{ active: localeIndex === idx }"
            @click="select(idx)"
          >
            <text class="locale-name">{{ item.name }}</text>
            <text v-if="localeIndex === idx" class="locale-check">✓</text>
          </view>
        </scroll-view>
        <view class="sheet-btn ghost" @click="close">
          <text>{{ i18n.cancel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.locale-picker.corner {
  position: absolute;
  top: calc(12rpx + env(safe-area-inset-top));
  right: 28rpx;
  z-index: 20;
}

.locale-picker.inline {
  position: relative;
  flex-shrink: 0;
}

.lang-trigger {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-height: 56rpx;
  padding: 0 18rpx;
  border-radius: var(--app-radius-pill);
  background: var(--app-fill-strong);
  border: 0.5px solid var(--app-glass-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.lang-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--app-label);
  max-width: 220rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-caret {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--app-label);
  line-height: 1;
  opacity: 0.72;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.36);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  border-radius: 28rpx 28rpx 0 0;
  padding: 28rpx 32rpx 24rpx;
  box-sizing: border-box;
}

.locale-sheet {
  max-height: 72vh;
  width: min(100%, var(--app-sheet-max, 100%));
  display: flex;
  flex-direction: column;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: var(--app-fill-strong);
}

.sheet-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--app-label);
  margin-bottom: 12rpx;
}

.locale-list {
  max-height: 52vh;
  margin-bottom: 20rpx;
}

.locale-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 8rpx;
  border-bottom: 0.5px solid var(--app-separator);
}

.locale-item:last-child {
  border-bottom: none;
}

.locale-name {
  font-size: 30rpx;
  color: var(--app-label);
}

.locale-item.active .locale-name {
  color: var(--app-tint);
  font-weight: 600;
}

.locale-check {
  font-size: 28rpx;
  color: var(--app-tint);
  font-weight: 700;
}

.sheet-btn {
  height: var(--app-btn-height);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.sheet-btn.ghost {
  background: var(--app-fill);
  color: var(--app-label);
  font-size: 30rpx;
  font-weight: 600;
}
</style>
