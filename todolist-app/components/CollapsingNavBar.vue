<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  /** 0 = expanded large title, 1 = compact nav title fully shown */
  progress: { type: Number, default: 0 },
  showBack: { type: Boolean, default: false },
  backLabel: { type: String, default: '‹' },
})

defineEmits(['back'])

const slots = useSlots()

const p = computed(() => {
  const n = Number(props.progress)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
})

const hasRight = computed(() => !!slots.right)
const glassOn = computed(() => p.value > 0.02)

/**
 * Root stays pointer-events:none so the tall blur layer never steals taps
 * from large-title / gen-btn below. Only .is-hit sides receive clicks.
 * Opacity stays 1 when back/right exist so the control chrome is visible.
 */
const barStyle = computed(() => {
  const interactive = props.showBack || hasRight.value
  const show = interactive || glassOn.value
  return {
    opacity: show ? 1 : 0,
  }
})

const tintStyle = computed(() => ({
  opacity: p.value,
}))

const titleStyle = computed(() => ({
  opacity: p.value,
  transform: `translateY(${(1 - p.value) * 8}px)`,
}))
</script>

<template>
  <view class="collapse-nav" :style="barStyle">
    <!-- fixed 铺满 2H，避免被 uni-view 裁成硬边色块 -->
    <view class="collapse-nav-blur" :class="{ on: glassOn }" aria-hidden="true" />
    <view
      class="collapse-nav-tint"
      :class="{ on: glassOn }"
      :style="tintStyle"
      aria-hidden="true"
    />
    <view class="collapse-nav-inner">
      <view
        v-if="showBack"
        class="collapse-nav-side left is-hit"
        @click="$emit('back')"
      >
        <text class="collapse-back">{{ backLabel }}</text>
      </view>
      <view v-else class="collapse-nav-side left" />

      <view class="collapse-nav-title-wrap" :style="titleStyle">
        <text class="collapse-nav-title">{{ title }}</text>
      </view>

      <view class="collapse-nav-side right" :class="{ 'is-hit': hasRight }">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.collapse-nav {
  --collapse-h: calc(
    max(
      var(--status-bar-height, 0px),
      var(--app-status-bar-height, 0px),
      env(safe-area-inset-top, 0px)
    ) + 44px
  );
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* 显式占满 2H，防止子层被裁切成「色块切割」 */
  height: calc(var(--collapse-h) * 2);
  z-index: 40;
  padding-top: max(
    var(--status-bar-height, 0px),
    var(--app-status-bar-height, 0px),
    env(safe-area-inset-top, 0px)
  );
  box-sizing: border-box;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none;
  pointer-events: none;
  overflow: visible !important;
}

.collapse-nav-blur,
.collapse-nav-tint {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  border: none;
  box-shadow: none;
  transition: opacity 0.2s ease;
}

.collapse-nav-blur.on {
  opacity: 1;
}

/* tint 的淡入由 inline opacity=progress 控制 */
.collapse-nav-tint.on {
  /* inline style 覆盖；此处保持可过渡 */
}

/*
 * 禁止硬边：全程多档缓降
 * 文字一带约 40% 透明（alpha≈0.6），底部 100% 透明
 */
.collapse-nav-blur {
  background: transparent;
  backdrop-filter: saturate(170%) blur(40px);
  -webkit-backdrop-filter: saturate(170%) blur(40px);
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.6) 18%,
    rgba(0, 0, 0, 0.42) 36%,
    rgba(0, 0, 0, 0.26) 52%,
    rgba(0, 0, 0, 0.12) 68%,
    rgba(0, 0, 0, 0.04) 84%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.6) 18%,
    rgba(0, 0, 0, 0.42) 36%,
    rgba(0, 0, 0, 0.26) 52%,
    rgba(0, 0, 0, 0.12) 68%,
    rgba(0, 0, 0, 0.04) 84%,
    transparent 100%
  );
}

.collapse-nav-tint {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.48) 0%,
    rgba(255, 255, 255, 0.36) 18%,
    rgba(255, 255, 255, 0.22) 36%,
    rgba(255, 255, 255, 0.12) 52%,
    rgba(255, 255, 255, 0.05) 68%,
    rgba(255, 255, 255, 0.015) 84%,
    rgba(255, 255, 255, 0) 100%
  );
}

.theme-dark .collapse-nav-tint,
html[data-theme='dark'] .collapse-nav-tint,
:root[data-theme='dark'] .collapse-nav-tint {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.48) 0%,
    rgba(0, 0, 0, 0.36) 18%,
    rgba(0, 0, 0, 0.22) 36%,
    rgba(0, 0, 0, 0.12) 52%,
    rgba(0, 0, 0, 0.05) 68%,
    rgba(0, 0, 0, 0.015) 84%,
    rgba(0, 0, 0, 0) 100%
  );
}

.collapse-nav-inner {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  box-sizing: border-box;
  max-width: var(--app-content-max);
  margin: 0 auto;
  width: 100%;
  pointer-events: none;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  z-index: 1;
}

.collapse-nav-side {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 64px;
  display: flex;
  align-items: center;
  pointer-events: none;
  background: transparent;
}

.collapse-nav-side.is-hit {
  pointer-events: auto;
}

.collapse-nav-side.left {
  left: max(4px, env(safe-area-inset-left, 0px));
  justify-content: flex-start;
  padding-left: 4px;
}

.collapse-nav-side.right {
  right: max(4px, env(safe-area-inset-right, 0px));
  justify-content: flex-end;
  padding-right: 4px;
}

.collapse-back {
  font-size: 17px;
  font-weight: 500;
  color: var(--app-tint);
  padding: 8px 6px;
}

.collapse-nav-title-wrap {
  max-width: 56%;
  pointer-events: none;
  background: transparent;
}

.collapse-nav-title {
  display: block;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--app-label);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .collapse-nav-title-wrap {
    transform: none !important;
  }

  .collapse-nav-blur,
  .collapse-nav-tint {
    transition: none;
  }

  .collapse-nav-blur {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
