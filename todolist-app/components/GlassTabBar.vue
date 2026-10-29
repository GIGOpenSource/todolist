<script setup>
/**
 * 移动端毛玻璃底部 TabBar。
 *
 * 架构说明：每个 tab 页面各自有独立的 GlassTabBar 实例。
 * - switchTab()：用户点击时驱动 pill 动画（仅在当前实例）
 * - syncFromRoute()：页面 onShow 时校正位置（永远 snap，不做动画）
 */
import { ref, computed, nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { t, localeVersion } from '../utils/i18n.js'
import {
  rememberTabIndex,
  syncTabIndex,
} from '../utils/tabBarState.js'
import { refreshUnreadCount, unreadCount, hasUnread } from '../utils/notificationStore.js'

const selected = ref(0)
const pillIndex = ref(0)
const pillReady = ref(false)
const reduceMotion = ref(false)
let pendingSwitch = -1

const tabs = computed(() => {
  void localeVersion.value
  return [
    {
      pagePath: '/pages/todos/todos',
      text: t('tab.tasks'),
      icon: 'task',
      iconPath: '/static/tab/task.png',
      selectedIconPath: '/static/tab/task_active.png',
    },
    {
      pagePath: '/pages/calendar/calendar',
      text: t('tab.calendar'),
      icon: 'calendar',
      iconPath: '/static/tab/calendar.png',
      selectedIconPath: '/static/tab/calendar_active.png',
    },
    {
      pagePath: '/pages/notes/notes',
      text: t('tab.notes'),
      icon: 'notes',
      iconPath: '/static/tab/notes.png',
      selectedIconPath: '/static/tab/notes_active.png',
    },
    {
      pagePath: '/pages/stats/stats',
      text: t('tab.stats'),
      icon: 'stats',
      iconPath: '/static/tab/stats.png',
      selectedIconPath: '/static/tab/stats_active.png',
    },
    {
      pagePath: '/pages/profile/profile',
      text: t('tab.profile'),
      icon: 'profile',
      iconPath: '/static/tab/profile.png',
      selectedIconPath: '/static/tab/profile_active.png',
    },
  ]
})

const pillStyle = computed(() => {
  const n = tabs.value.length || 1
  const i = pillIndex.value
  return {
    width: `${100 / n}%`,
    transform: `translate3d(${i * 100}%, 0, 0)`,
    transition: pillReady.value
      ? 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)'
      : 'none',
  }
})

function routeIndex() {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1]
  const route = cur ? `/${cur.route}` : ''
  return tabs.value.findIndex((tab) => tab.pagePath === route)
}

function placePill(index, animate) {
  if (index < 0) return
  selected.value = index
  if (!animate || reduceMotion.value) {
    pillReady.value = false
    pillIndex.value = index
    nextTick(() => {
      pillReady.value = true
    })
    return
  }
  pillReady.value = true
  pillIndex.value = index
}

/** onShow 时校正 pill 位置。永远 snap（无动画）。 */
function snapToRoute() {
  const idx = routeIndex()
  if (idx < 0) {
    setTimeout(snapToRoute, 150)
    return
  }

  if (pillIndex.value === idx && selected.value === idx) {
    syncTabIndex(idx)
    return
  }

  syncTabIndex(idx)
  placePill(idx, false)
}

/** 只在 switchTab 中调用——用户直接交互，有动画。 */
function animateFromTo(fromIdx, toIdx) {
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) {
    placePill(toIdx, false)
    return
  }
  pillReady.value = false
  pillIndex.value = fromIdx
  selected.value = fromIdx
  nextTick(() => {
    requestAnimationFrame(() => {
      placePill(toIdx, true)
    })
  })
}

/** App 端 custom:true 不会自动隐藏原生 tabBar，必须 API 关掉，否则与圆角栏叠层抢点击。 */
function hideNativeTabBar() {
  // #ifdef APP-PLUS
  try {
    uni.hideTabBar({ animation: false })
  } catch {
    /* ignore */
  }
  // #endif
}

onMounted(() => {
  hideNativeTabBar()
  try {
    reduceMotion.value =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch {
    reduceMotion.value = false
  }

  const idx = routeIndex()
  if (idx >= 0) {
    selected.value = idx
    pillIndex.value = idx
  }
})

onShow(() => {
  hideNativeTabBar()
  snapToRoute()
  refreshUnreadCount().catch(() => {})
})

function switchTab(index) {
  if (index === selected.value) return

  const fromIdx = selected.value
  rememberTabIndex(index)
  pendingSwitch = index

  animateFromTo(fromIdx, index)

  uni.switchTab({
    url: tabs.value[index].pagePath,
    complete: () => {
      setTimeout(() => {
        if (pendingSwitch === index) pendingSwitch = -1
      }, 600)
    },
  })
}
</script>

<template>
  <view class="tab-safe">
    <view class="tab-shell">
      <view class="tab-glass">
        <view class="tab-inner">
          <!-- iOS 26：滑动液态玻璃选中胶囊（独立层，避免嵌套 blur） -->
          <view class="tab-pill" :style="pillStyle" aria-hidden="true" />

          <view
            v-for="(tab, index) in tabs"
            :key="tab.pagePath"
            class="tab-item"
            :class="{ active: selected === index }"
            @click="switchTab(index)"
          >
            <view class="icon">
              <image
                class="tab-icon"
                :src="selected === index ? tab.selectedIconPath : tab.iconPath"
                mode="aspectFit"
              />
              <view v-if="tab.icon === 'profile' && hasUnread" class="tab-badge">
                <text>{{ unreadCount > 99 ? '99+' : unreadCount }}</text>
              </view>
            </view>
            <text class="tab-text">{{ tab.text }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tab-safe {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  pointer-events: none;
  padding: 0 max(32rpx, env(safe-area-inset-left, 0px))
    calc(14rpx + env(safe-area-inset-bottom)) max(32rpx, env(safe-area-inset-right, 0px));
  display: flex;
  justify-content: center;
}

.tab-shell {
  pointer-events: auto;
  width: 100%;
  max-width: var(--app-tab-max, 100%);
}

/*
 * iOS 26 Liquid Glass 外层胶囊：
 * 高透明 + 强模糊 + 饱和，内容能透出；上滑不缩小。
 */
.tab-glass {
  padding: 6rpx;
  background: var(--app-tab-bg);
  backdrop-filter: saturate(180%) blur(50px);
  -webkit-backdrop-filter: saturate(180%) blur(50px);
  border-radius: 999rpx;
  border: 0.5px solid var(--app-tab-border);
  box-shadow:
    0 10px 36px var(--app-shadow),
    0 1px 0 rgba(255, 255, 255, 0.35) inset,
    0 -0.5px 0 rgba(0, 0, 0, 0.04) inset;
  overflow: hidden;
  isolation: isolate;
}

.tab-inner {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
}

.tab-pill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 999rpx;
  background: var(--app-tab-pill);
  border: 0.5px solid var(--app-tab-pill-border);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85) inset,
    0 -0.5px 0 rgba(0, 0, 0, 0.06) inset,
    0 2px 10px rgba(0, 0, 0, 0.06);
  pointer-events: none;
  z-index: 0;
  box-sizing: border-box;
  will-change: transform;
}

.theme-dark .tab-glass,
html[data-theme='dark'] .tab-glass,
:root[data-theme='dark'] .tab-glass {
  box-shadow:
    0 10px 36px rgba(0, 0, 0, 0.5),
    0 1px 0 rgba(255, 255, 255, 0.14) inset,
    0 -0.5px 0 rgba(0, 0, 0, 0.35) inset;
}

.theme-dark .tab-pill,
html[data-theme='dark'] .tab-pill,
:root[data-theme='dark'] .tab-pill {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.22) inset,
    0 -0.5px 0 rgba(0, 0, 0, 0.28) inset,
    0 2px 12px rgba(0, 0, 0, 0.28);
}

.tab-item {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 12rpx 0 10rpx;
  border-radius: 999rpx;
  min-height: 44px;
  min-width: 64px;
  background: transparent;
  border: none;
  box-shadow: none;
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}

.tab-item:active {
  transform: scale(0.94);
}

.icon {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.tab-badge {
  position: absolute;
  top: -10rpx;
  right: -18rpx;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 6rpx;
  border-radius: 999rpx;
  background: var(--app-danger, #d96058);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.tab-badge text {
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.tab-icon {
  width: 40rpx;
  height: 40rpx;
}

.tab-text {
  position: relative;
  font-size: 18rpx;
  color: var(--app-tab-text);
  letter-spacing: -0.2px;
  line-height: 1.1;
  font-weight: 500;
  transition: color 0.28s ease, font-weight 0.28s ease;
}

.tab-item.active .tab-text {
  color: var(--app-tint);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .tab-item,
  .tab-item:active,
  .tab-text {
    transition: none;
  }

  .tab-pill {
    transition: none !important;
  }

  .tab-glass {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
